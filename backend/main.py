"""
DevPilot - AI-Powered Developer Onboarding Assistant
FastAPI Backend - Main Application
"""
import os
import uuid
from dotenv import load_dotenv
load_dotenv()  # Load .env before any other imports read env vars
import re
import json
from datetime import datetime
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn

from rag_pipeline import RAGPipeline, INGESTION_STATUS, VECTOR_STORE_PATH
from knowledge_gap import KnowledgeGapAnalyzer
from auth import init_users_table, login_user, register_user, list_users, delete_user
from sources import init_sources_table, record_source, list_sources
from models import (
    QueryRequest, QueryResponse, IngestRequest, IngestResponse,
    AnalyticsResponse, DeveloperStats, OnboardingStatus
)

app = FastAPI(
    title="DevPilot API",
    description="AI-Powered Intelligent Developer Onboarding Assistant",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

rag = RAGPipeline()
analyzer = KnowledgeGapAnalyzer()

# ── In-memory config store (swap for DB in production) ────────────────────────
_config: dict = {}


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_users_table()
    init_sources_table()


# ─── Auth ─────────────────────────────────────────────────────────────────────
@app.post("/auth/login")
async def auth_login(payload: dict):
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    user = login_user(email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"ok": True, "user": user}


@app.post("/auth/register")
async def auth_register(payload: dict):
    """Senior dev only — create a new onboarder account."""
    name     = payload.get("name", "").strip()
    email    = payload.get("email", "").strip().lower()
    password = payload.get("password", "").strip()
    role     = payload.get("role", "onboarder")
    team     = payload.get("team", "").strip()

    if not name or not email or not password:
        raise HTTPException(status_code=400, detail="name, email and password are required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    try:
        user = register_user(name=name, email=email, password=password, role=role, team=team)
        return {"ok": True, "user": user}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.get("/auth/users")
async def get_users():
    """Senior dev only — list all registered users."""
    return {"users": list_users()}


@app.delete("/auth/users/{user_id}")
async def remove_user(user_id: str):
    """Senior dev only — remove a user."""
    ok = delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "DevPilot",
        "timestamp": datetime.utcnow().isoformat(),
        "rag_ready": rag.is_ready(),
        "docs_indexed": rag.get_doc_count(),
        "vectorstore_loaded": rag.vectorstore is not None,
        "api_key_set": bool(os.getenv("GROQ_API_KEY") or os.getenv("GROK_API_KEY")),
    }


@app.get("/debug/vectorstore")
def debug_vectorstore():
    """Shows sample documents from the vector store for debugging."""
    if not rag.vectorstore:
        return {"error": "Vector store is empty or not loaded", "docs_indexed": 0}
    try:
        # Pull a sample of stored docs
        store = rag.vectorstore.docstore._dict
        samples = []
        for i, (k, doc) in enumerate(store.items()):
            if i >= 10:
                break
            samples.append({
                "source": doc.metadata.get("source", "unknown"),
                "source_type": doc.metadata.get("source_type", "unknown"),
                "preview": doc.page_content[:200],
            })
        return {
            "total_chunks": rag.get_doc_count(),
            "sample_docs": samples
        }
    except Exception as e:
        return {"error": str(e), "docs_indexed": rag.get_doc_count()}


# ─── Query ────────────────────────────────────────────────────────────────────
@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest, background_tasks: BackgroundTasks):
    """Core query: developer asks question, gets contextual AI answer with sources."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        result = await rag.query(
            question=request.question,
            developer_id=request.developer_id,
            context_filter=request.context_filter
        )
        background_tasks.add_task(
            analyzer.log_query,
            developer_id=request.developer_id,
            question=request.question,
            topics=result.get("topics", []),
            confidence=result.get("confidence", 0.0),
            answered=result.get("answered", True)
        )
        return QueryResponse(
            query_id=str(uuid.uuid4()),
            question=request.question,
            answer=result["answer"],
            sources=result.get("sources", []),
            code_references=result.get("code_references", []),
            related_topics=result.get("related_topics", []),
            confidence=result.get("confidence", 0.85),
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


# ─── Ingest ───────────────────────────────────────────────────────────────────
@app.post("/ingest", response_model=IngestResponse)
async def ingest_documents(request: IngestRequest, background_tasks: BackgroundTasks):
    """Ingest documents, READMEs, wikis, or GitHub repos into the vector store."""
    try:
        job_id = str(uuid.uuid4())
        background_tasks.add_task(
            _ingest_and_record,
            sources=request.sources,
            source_type=request.source_type,
            project_id=request.project_id,
            job_id=job_id
        )
        return IngestResponse(
            job_id=job_id,
            status="processing",
            message=f"Ingestion started for {len(request.sources)} source(s)",
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


async def _ingest_and_record(sources, source_type, project_id, job_id):
    """Wrapper that runs ingestion then records each source to DB."""
    await rag.ingest_documents(
        sources=sources, source_type=source_type,
        project_id=project_id, job_id=job_id
    )
    status = INGESTION_STATUS.get(job_id, {})
    chunks = status.get("documents_processed", 0)
    for src in sources:
        title = src.rstrip("/").split("/")[-1] or src
        record_source(
            title=title, source=src,
            source_type=source_type,
            chunks=chunks, project_id=project_id
        )


@app.post("/ingest/upload")
async def ingest_upload(background_tasks: BackgroundTasks,
                        file: UploadFile = File(...),
                        project_id: str = "default"):
    """Upload a local file and ingest it into the vector store."""
    import tempfile
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    suffix = Path(file.filename).suffix.lower()
    allowed = {".txt", ".md", ".py", ".js", ".ts", ".rst", ".html", ".mdx", ".jsx", ".tsx"}
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail=f"File type '{suffix}' not supported.")

    content = await file.read()
    # Save to temp file with original filename so metadata is readable
    tmp_dir = Path(tempfile.gettempdir()) / "devpilot_uploads"
    tmp_dir.mkdir(exist_ok=True)
    tmp_path = tmp_dir / file.filename
    tmp_path.write_bytes(content)

    job_id = str(uuid.uuid4())

    async def _ingest_file():
        from langchain_community.document_loaders import TextLoader
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        INGESTION_STATUS[job_id] = {"status": "processing", "progress": 10}
        try:
            loader = TextLoader(str(tmp_path), encoding="utf-8", autodetect_encoding=True)
            docs = loader.load()
            for doc in docs:
                doc.metadata["source"] = file.filename
                doc.metadata["source_type"] = "code" if suffix in {".py",".js",".ts",".jsx",".tsx"} else "documentation"
                doc.metadata["project_id"] = project_id

            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = splitter.split_documents(docs)

            if chunks and rag.embeddings:
                if rag.vectorstore:
                    rag.vectorstore.add_documents(chunks)
                else:
                    rag.vectorstore = __import__('langchain_community.vectorstores', fromlist=['FAISS']).FAISS.from_documents(chunks, rag.embeddings)
                    rag._ready = True
                Path(VECTOR_STORE_PATH).mkdir(parents=True, exist_ok=True)
                rag.vectorstore.save_local(VECTOR_STORE_PATH)
                rag._doc_count = rag.vectorstore.index.ntotal

            record_source(title=file.filename, source=file.filename,
                          source_type="documentation", chunks=len(chunks), project_id=project_id)
            INGESTION_STATUS[job_id] = {"status": "completed", "progress": 100, "documents_processed": len(chunks)}
            print(f"[DevPilot] Uploaded & indexed '{file.filename}' → {len(chunks)} chunks")
        except Exception as e:
            INGESTION_STATUS[job_id] = {"status": "error", "progress": 0, "message": str(e)}
            print(f"[DevPilot] Upload ingest error: {e}")

    background_tasks.add_task(_ingest_file)
    return IngestResponse(job_id=job_id, status="processing",
                          message=f"Indexing {file.filename}...",
                          timestamp=datetime.utcnow().isoformat())


@app.post("/ingest/rebuild")
async def rebuild_vectorstore(background_tasks: BackgroundTasks):
    """Re-ingest all sources from DB to rebuild the vector store."""
    sources = list_sources()
    if not sources:
        raise HTTPException(status_code=404, detail="No sources in DB to rebuild from")

    job_id = str(uuid.uuid4())
    # Build list of valid sources with their types
    valid = []
    for s in sources:
        src = s["source"]
        if src.startswith("http"):
            valid.append((src, s["source_type"]))
        elif Path(src).exists():
            valid.append((src, s["source_type"]))
        else:
            print(f"[DevPilot] Skipping missing file: {src}")

    if not valid:
        raise HTTPException(status_code=400, detail="No accessible sources found")

    # Use _ingest_and_record for each source
    all_srcs = [v[0] for v in valid]
    # Group github sources together for efficiency
    github_srcs = [s for s, t in valid if s.startswith("https://github.com")]
    other_srcs = [s for s, t in valid if not s.startswith("https://github.com")]

    if github_srcs:
        background_tasks.add_task(_ingest_and_record,
            sources=github_srcs, source_type="github",
            project_id="default", job_id=job_id)
    if other_srcs:
        background_tasks.add_task(_ingest_and_record,
            sources=other_srcs, source_type="documentation",
            project_id="default", job_id=job_id + "_files")

    print(f"[DevPilot] Rebuild queued: {len(github_srcs)} GitHub repos, {len(other_srcs)} files")
    return {"ok": True, "job_id": job_id, "rebuilding": len(valid),
            "message": f"Rebuilding from {len(valid)} sources. Watch the server terminal."}



@app.get("/ingest/status/{job_id}")
async def ingest_status(job_id: str):
    """Poll ingestion job status."""
    status = INGESTION_STATUS.get(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status


@app.get("/ingest/sources")
async def get_sources():
    """Return all indexed sources from DB — visible to both senior and onboarders."""
    return {"sources": list_sources()}


# ─── GitHub ───────────────────────────────────────────────────────────────────
@app.get("/github/repos")
async def github_repos(token: str):
    """
    Fetch authenticated user's GitHub repos using their personal access token.
    Frontend passes token from the UI; we proxy to GitHub API.
    """
    if not token:
        raise HTTPException(status_code=400, detail="GitHub token required")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Get user info
            user_resp = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                }
            )
            user_resp.raise_for_status()
            gh_user = user_resp.json()

            # Get repos (first 50, sorted by updated)
            repos_resp = await client.get(
                "https://api.github.com/user/repos",
                params={"sort": "updated", "per_page": 50, "type": "all"},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                }
            )
            repos_resp.raise_for_status()
            repos = repos_resp.json()

        return {
            "user": {
                "login": gh_user.get("login"),
                "name": gh_user.get("name"),
                "avatar_url": gh_user.get("avatar_url"),
            },
            "repos": [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "full_name": r["full_name"],
                    "description": r.get("description") or "",
                    "clone_url": r["clone_url"],
                    "html_url": r["html_url"],
                    "language": r.get("language"),
                    "stargazers_count": r.get("stargazers_count", 0),
                    "forks_count": r.get("forks_count", 0),
                    "private": r.get("private", False),
                    "updated_at": r.get("updated_at"),
                }
                for r in repos
            ]
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GitHub connection failed: {str(e)}")


# ─── Slack ────────────────────────────────────────────────────────────────────
@app.post("/slack/configure")
async def configure_slack(payload: dict):
    """
    Store Slack bot token and default channel.
    Senior dev configures this from the UI.
    """
    token = payload.get("token", "").strip()
    channel = payload.get("default_channel", "").strip()

    if not token:
        raise HTTPException(status_code=400, detail="Slack token required")

    # Validate token with Slack auth.test
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://slack.com/api/auth.test",
                headers={"Authorization": f"Bearer {token}"}
            )
            data = resp.json()
            if not data.get("ok"):
                raise HTTPException(status_code=400, detail=f"Slack token invalid: {data.get('error', 'unknown')}")

        _config["slack_token"] = token
        _config["slack_channel"] = channel
        _config["slack_team"] = data.get("team")
        _config["slack_bot_user"] = data.get("user_id")

        return {
            "ok": True,
            "team": data.get("team"),
            "bot_user": data.get("user_id"),
            "message": "Slack bot configured successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Slack configuration failed: {str(e)}")


@app.post("/slack/events")
async def slack_events(payload: dict, background_tasks: BackgroundTasks):
    """Slack Events API handler."""
    if payload.get("type") == "url_verification":
        return {"challenge": payload["challenge"]}
    if payload.get("type") == "event_callback":
        event = payload.get("event", {})
        if event.get("type") in ("app_mention", "message") and not event.get("bot_id"):
            background_tasks.add_task(handle_slack_message, event)
    return {"ok": True}


async def handle_slack_message(event: dict):
    token = _config.get("slack_token")
    if not token:
        return

    text = event.get("text", "").strip()
    user = event.get("user", "unknown")
    channel = event.get("channel")
    clean_text = re.sub(r"<@[A-Z0-9]+>", "", text).strip()

    if not clean_text:
        return

    result = await rag.query(question=clean_text, developer_id=user)
    answer = result.get("answer", "I couldn't find an answer.")

    # Truncate for Slack
    if len(answer) > 2900:
        answer = answer[:2900] + "…"

    sources = result.get("sources", [])
    source_text = ""
    if sources:
        source_text = "\n\n*Sources:* " + " · ".join(f"<{s.get('url','#')}|{s.get('title','')}>" for s in sources[:3])

    confidence = result.get("confidence", 0)
    conf_emoji = "🟢" if confidence >= 0.85 else "🟡" if confidence >= 0.7 else "🔴"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "channel": channel,
                    "text": f"{conf_emoji} *DevPilot answer* ({int(confidence*100)}% confidence)\n\n{answer}{source_text}",
                }
            )
    except Exception as e:
        print(f"[DevPilot] Slack send error: {e}")


# ─── Analytics ────────────────────────────────────────────────────────────────
@app.get("/analytics/overview", response_model=AnalyticsResponse)
async def analytics_overview(days: int = 30):
    data = analyzer.get_overview(days=days)
    return AnalyticsResponse(**data)


@app.get("/analytics/developer/{developer_id}", response_model=DeveloperStats)
async def developer_stats(developer_id: str, days: int = 30):
    stats = analyzer.get_developer_stats(developer_id=developer_id, days=days)
    if not stats:
        # New user with no queries yet — return empty stats instead of 404
        stats = {
            "developer_id": developer_id,
            "total_queries": 0,
            "queries_this_week": 0,
            "days_active": 0,
            "unique_topics": [],
            "knowledge_gaps": [],
            "recommended_topics": ["authentication", "database", "api", "testing", "deployment"],
            "onboarding_progress": 0.0,
            "strongest_areas": [],
            "weakest_areas": [],
            "timeline": [],
        }
    return DeveloperStats(**stats)


@app.get("/analytics/hot-topics")
async def hot_topics(limit: int = 10):
    return analyzer.get_hot_topics(limit=limit)


@app.get("/analytics/knowledge-gaps")
async def knowledge_gaps():
    return analyzer.get_knowledge_gaps()


# ─── Onboarding ───────────────────────────────────────────────────────────────
@app.post("/onboarding/roadmap")
async def generate_roadmap(developer_id: str, role: str = "backend", experience: str = "mid"):
    roadmap = await rag.generate_onboarding_roadmap(
        developer_id=developer_id, role=role, experience_level=experience
    )
    return roadmap


@app.get("/onboarding/status/{developer_id}", response_model=OnboardingStatus)
async def onboarding_status(developer_id: str):
    stats = analyzer.get_developer_stats(developer_id, days=90) or {}
    progress = analyzer.calculate_onboarding_progress(developer_id)
    return OnboardingStatus(
        developer_id=developer_id,
        progress_percentage=progress,
        days_active=stats.get("days_active", 0),
        topics_explored=stats.get("unique_topics", []),
        recommended_next=stats.get("recommended_topics", []),
        queries_this_week=stats.get("queries_this_week", 0)
    )


# ─── Semantic search ──────────────────────────────────────────────────────────
@app.get("/search")
async def semantic_search(q: str, limit: int = 5, source_type: Optional[str] = None):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    results = await rag.semantic_search(query=q, limit=limit, source_type=source_type)
    return {"query": q, "results": results, "count": len(results)}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)