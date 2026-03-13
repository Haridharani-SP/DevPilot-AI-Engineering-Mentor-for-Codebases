"""
DevPilot - RAG Pipeline
LangChain + FAISS + OpenAI GPT-4 powered Retrieval-Augmented Generation
"""
import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()  # Must be before any os.getenv() calls

import httpx
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_community.document_loaders import (
    TextLoader, DirectoryLoader, GitLoader,
    UnstructuredMarkdownLoader, UnstructuredURLLoader
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROK_API_KEY = os.getenv("GROK_API_KEY", "")

# Use whichever key is available — Groq preferred (free tier available)
if GROQ_API_KEY:
    _API_KEY  = GROQ_API_KEY
    _API_URL  = "https://api.groq.com/openai/v1/chat/completions"
    _API_MODEL = "llama-3.3-70b-versatile"
elif GROK_API_KEY:
    _API_KEY  = GROK_API_KEY
    _API_URL  = "https://api.x.ai/v1/chat/completions"
    _API_MODEL = "grok-2"
else:
    _API_KEY = _API_URL = _API_MODEL = ""
VECTOR_STORE_PATH = os.getenv("VECTOR_STORE_PATH", "./vector_store")
INGESTION_STATUS: Dict[str, Dict] = {}


# ─── System Prompt ────────────────────────────────────────────────────────────
DEVPILOT_SYSTEM_PROMPT = """You are DevPilot, an AI mentor helping developers understand a specific codebase.

STRICT RULES:
1. ONLY answer based on the retrieved context below. Do NOT use general knowledge.
2. If the context does not contain enough information to answer, say exactly: "I don't have enough information about this in the indexed codebase. Try indexing more files."
3. Always quote or reference specific file names, function names, or code snippets from the context.
4. Never invent file paths or functions that are not in the context.
5. Keep answers concise and specific to THIS codebase.

Retrieved context from the codebase:
---
{context}
---

Developer question: {question}

Answer strictly based on the context above. Reference specific files and functions found in the context. If the context is insufficient, say so clearly.

Answer:"""


ROADMAP_PROMPT = """You are DevPilot generating a personalized developer onboarding roadmap.

Developer Profile:
- Role: {role}
- Experience Level: {experience_level}
- Available documentation topics: {available_topics}
- Detected knowledge gaps: {knowledge_gaps}

Generate a detailed {total_weeks}-week onboarding roadmap in JSON format:
{{
  "items": [
    {{
      "week": 1,
      "title": "Week title",
      "description": "What to focus on",
      "resources": ["resource 1", "resource 2"],
      "estimated_hours": 10,
      "topics": ["topic1", "topic2"]
    }}
  ]
}}

Return ONLY valid JSON, no other text."""


# ─── RAG Pipeline Class ───────────────────────────────────────────────────────
class RAGPipeline:
    def __init__(self):
        self.embeddings = None
        self.vectorstore = None
        self.llm = None
        self.qa_chain = None
        self._doc_count = 0
        self._ready = False
        self._init()

    def _init(self):
        print(f"[DevPilot] Initializing... API key set: {bool(_API_KEY)}, Vector store path: {VECTOR_STORE_PATH}")
        try:
            # Always load embeddings — needed for both ingest AND query
            self.embeddings = HuggingFaceEmbeddings(
                model_name="all-MiniLM-L6-v2",
                model_kwargs={"device": "cpu"}
            )
            print("[DevPilot] Embeddings loaded.")
        except Exception as e:
            print(f"[DevPilot] ERROR loading embeddings: {e}")
            return

        try:
            faiss_path = Path(VECTOR_STORE_PATH) / "index.faiss"
            if faiss_path.exists():
                self.vectorstore = FAISS.load_local(
                    VECTOR_STORE_PATH, self.embeddings, allow_dangerous_deserialization=True
                )
                self._doc_count = self.vectorstore.index.ntotal
                self._ready = True
                print(f"[DevPilot] Loaded vector store — {self._doc_count} chunks indexed.")
            else:
                print(f"[DevPilot] No vector store at {VECTOR_STORE_PATH}. Ingest a repo to create it.")
        except Exception as e:
            print(f"[DevPilot] ERROR loading vector store: {e}")

        if not _API_KEY:
            print("[DevPilot] WARNING: No AI API key. Set GROQ_API_KEY in .env for AI answers.")

    def is_ready(self) -> bool:
        return self._ready and self.vectorstore is not None

    def get_doc_count(self) -> int:
        return self._doc_count

    def _build_qa_chain(self):
        pass  # Grok is called directly via HTTP

    # ─── Query ───────────────────────────────────────────────────────────────
    async def query(
        self,
        question: str,
        developer_id: str = "anonymous",
        context_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        # Only use mock if API key is missing
        if not _API_KEY:
            return self._mock_response(question)
            return self._mock_response(question)

        try:
            # Get relevant docs from vector store
            source_docs = []
            if self.vectorstore:
                loop = asyncio.get_event_loop()
                docs_with_scores = await loop.run_in_executor(
                    None, lambda: self.vectorstore.similarity_search_with_score(question, k=10)
                )
                # Log scores for debugging
                for doc, score in docs_with_scores[:3]:
                    print(f"[DevPilot] Score {score:.3f} | {doc.metadata.get('source','?')[:50]}")

                # Relaxed threshold — FAISS L2 distance, lower = better
                source_docs = [doc for doc, score in docs_with_scores if score < 2.0]
                if not source_docs:
                    source_docs = [doc for doc, _ in docs_with_scores[:4]]  # always return top 4

            # Deduplicate retrieved chunks by content
            seen_content = set()
            unique_docs = []
            for doc in source_docs:
                key = doc.page_content.strip()[:150]
                if key not in seen_content:
                    seen_content.add(key)
                    unique_docs.append(doc)
            source_docs = unique_docs[:6]

            # Build context with clear file attribution
            context = "\n\n---\n\n".join([
                f"[File: {d.metadata.get('source', 'unknown')} | Type: {d.metadata.get('source_type','doc')}]\n{d.page_content[:1200]}"
                for d in source_docs
            ]) or "No documents have been indexed yet."

            # Call Grok API directly
            prompt = DEVPILOT_SYSTEM_PROMPT.format(context=context, question=question)
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    _API_URL,
                    headers={"Authorization": f"Bearer {_API_KEY}", "Content-Type": "application/json"},
                    json={"model": _API_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 1000, "temperature": 0.2}
                )
                resp.raise_for_status()
                answer = resp.json()["choices"][0]["message"]["content"]

            # Sources are used internally for RAG context only — not exposed to UI
            sources = []
            code_refs = []

            topics = self._extract_topics(question, answer)

            return {
                "answer": answer,
                "sources": sources,
                "code_references": code_refs,
                "related_topics": topics,
                "confidence": 0.88 if source_docs else 0.5,
                "answered": True,
                "topics": topics
            }
        except Exception as e:
            return {
                "answer": f"I encountered an error processing your question: {str(e)}",
                "sources": [], "code_references": [],
                "related_topics": [], "confidence": 0.0,
                "answered": False, "topics": []
            }

    # ─── Semantic Search ─────────────────────────────────────────────────────
    async def semantic_search(
        self,
        query: str,
        limit: int = 5,
        source_type: Optional[str] = None
    ) -> List[Dict]:
        if not self.vectorstore:
            return self._mock_search_results(query)
        loop = asyncio.get_event_loop()
        docs = await loop.run_in_executor(
            None,
            lambda: self.vectorstore.similarity_search_with_score(query, k=limit)
        )
        results = []
        for doc, score in docs:
            if source_type and doc.metadata.get("source_type") != source_type:
                continue
            results.append({
                "content": doc.page_content[:500],
                "metadata": doc.metadata,
                "relevance_score": float(1 - score)
            })
        return results

    # ─── Ingestion ───────────────────────────────────────────────────────────
    async def ingest_documents(
        self,
        sources: List[str],
        source_type: str = "documentation",
        project_id: str = "default",
        job_id: str = "unknown"
    ):
        INGESTION_STATUS[job_id] = {"status": "processing", "progress": 0, "total": len(sources)}

        all_docs = []
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        for i, source in enumerate(sources):
            try:
                docs = []
                if source.startswith("https://github.com"):
                    import asyncio
                    loop = asyncio.get_event_loop()
                    docs = await loop.run_in_executor(None, self._load_github, source)
                elif source.startswith("http"):
                    loader = UnstructuredURLLoader(urls=[source])
                    docs = loader.load()
                elif Path(source).is_dir():
                    loader = DirectoryLoader(
                        source,
                        glob="**/*.{md,txt,py,js,ts,java,go,rs}",
                        loader_cls=TextLoader,
                        silent_errors=True
                    )
                    docs = loader.load()
                elif Path(source).is_file():
                    loader = TextLoader(source, encoding="utf-8")
                    docs = loader.load()

                # Tag metadata
                for doc in docs:
                    doc.metadata["source_type"] = source_type
                    doc.metadata["project_id"] = project_id
                    if source.endswith((".py", ".js", ".ts", ".java", ".go", ".rs")):
                        doc.metadata["source_type"] = "code"

                chunks = splitter.split_documents(docs)

                # Deduplicate identical chunks (e.g. repos with repeated README)
                seen = set()
                unique_chunks = []
                for chunk in chunks:
                    key = chunk.page_content.strip()[:200]
                    if key not in seen:
                        seen.add(key)
                        unique_chunks.append(chunk)

                if len(unique_chunks) < len(chunks):
                    print(f"[DevPilot] Deduplicated {len(chunks)} → {len(unique_chunks)} chunks")

                all_docs.extend(unique_chunks)
                INGESTION_STATUS[job_id]["progress"] = int((i + 1) / len(sources) * 100)

            except Exception as e:
                print(f"[DevPilot] Error loading {source}: {e}")

        if all_docs:
            if not self.embeddings:
                print("[DevPilot] ERROR: Embeddings not loaded, cannot index. Check sentence-transformers install.")
                INGESTION_STATUS[job_id] = {"status": "error", "progress": 0, "message": "Embeddings not loaded"}
                return
            if self.vectorstore:
                self.vectorstore.add_documents(all_docs)
            else:
                self.vectorstore = FAISS.from_documents(all_docs, self.embeddings)
            self._ready = True
            Path(VECTOR_STORE_PATH).mkdir(parents=True, exist_ok=True)
            self.vectorstore.save_local(VECTOR_STORE_PATH)
            self._doc_count = self.vectorstore.index.ntotal
            print(f"[DevPilot] Vector store saved. Total chunks: {self._doc_count}")

        INGESTION_STATUS[job_id] = {
            "status": "completed",
            "progress": 100,
            "documents_processed": len(all_docs),
            "total": len(sources)
        }
        print(f"[DevPilot] Ingested {len(all_docs)} chunks from {len(sources)} sources")

    def _load_github(self, repo_url: str) -> List[Document]:
        """
        Fetch a GitHub repo using the GitHub REST API (no git required).

        Workflow:
          1. Parse owner/repo from URL
          2. Get default branch via /repos/{owner}/{repo}
          3. Fetch entire file tree via /git/trees/{branch}?recursive=1  (1 API call)
          4. Filter to allowed extensions, skip noise dirs
          5. Fetch each file via /repos/{owner}/{repo}/contents/{path}
          6. Decode Base64 content -> LangChain Document
        """
        import urllib.request
        import urllib.error
        import base64
        import time
        import re

        ALLOWED_EXT = {
            ".md", ".txt", ".py", ".js", ".ts", ".jsx", ".tsx",
            ".rst", ".html", ".yaml", ".yml", ".java", ".go",
            ".rb", ".php", ".cs", ".cpp", ".c", ".json", ".mdx",
        }
        SKIP_DIRS = {
            "node_modules", "__pycache__", "dist", "build",
            ".venv", "venv", ".git", "vendor", "coverage",
            ".next", ".nuxt", "out", "target", ".gradle",
        }
        MAX_FILE_SIZE = 150_000  # 150 KB per file

        # 1. Parse owner/repo
        repo_url = repo_url.rstrip("/").replace(".git", "")
        m = re.search(r"github\.com[/:]([^/]+)/([^/]+)", repo_url)
        if not m:
            print(f"[DevPilot] Cannot parse GitHub URL: {repo_url}")
            return []
        owner, repo_name = m.group(1), m.group(2)
        print(f"[DevPilot] Fetching repo via GitHub API: {owner}/{repo_name}")

        # Shared HTTP helper
        gh_token = os.getenv("GITHUB_TOKEN", "")
        headers = {"Accept": "application/vnd.github+json", "User-Agent": "DevPilot/1.0"}
        if gh_token:
            headers["Authorization"] = f"Bearer {gh_token}"

        def gh_get(url: str):
            req = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                print(f"[DevPilot] GitHub API HTTP {e.code} for {url}")
                return None
            except Exception as e:
                print(f"[DevPilot] GitHub API error for {url}: {e}")
                return None

        # 2. Get default branch
        repo_meta = gh_get(f"https://api.github.com/repos/{owner}/{repo_name}")
        if not repo_meta:
            print(f"[DevPilot] Could not fetch repo metadata for {owner}/{repo_name}")
            return []
        default_branch = repo_meta.get("default_branch", "main")
        print(f"[DevPilot] Default branch: {default_branch}")

        # 3. Fetch full file tree in ONE API call (Trees API)
        tree_data = gh_get(
            f"https://api.github.com/repos/{owner}/{repo_name}/git/trees/{default_branch}?recursive=1"
        )
        if not tree_data or "tree" not in tree_data:
            print(f"[DevPilot] Could not fetch file tree for {owner}/{repo_name}")
            return []

        # 4. Filter paths
        candidate_files = []
        for item in tree_data["tree"]:
            if item.get("type") != "blob":
                continue
            path = item["path"]
            parts = path.split("/")
            if any(p in SKIP_DIRS for p in parts[:-1]):
                continue
            ext = Path(path).suffix.lower()
            if ext not in ALLOWED_EXT:
                continue
            if item.get("size", 0) > MAX_FILE_SIZE:
                continue
            candidate_files.append(path)

        print(f"[DevPilot] {len(candidate_files)} files to fetch from {owner}/{repo_name}")

        # 5 & 6. Fetch content via Contents API and decode Base64
        docs = []
        unauthenticated = not gh_token
        CODE_EXTS = {".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go",
                     ".rb", ".php", ".cs", ".cpp", ".c"}

        for i, file_path in enumerate(candidate_files):
            # Rate-limit guard for unauthenticated (60 req/hr)
            if unauthenticated and i > 0 and i % 8 == 0:
                time.sleep(1)

            content_data = gh_get(
                f"https://api.github.com/repos/{owner}/{repo_name}/contents/{file_path}"
            )
            if not content_data:
                continue
            if content_data.get("encoding") != "base64":
                continue

            raw_b64 = content_data.get("content", "")
            if not raw_b64:
                continue

            try:
                decoded = base64.b64decode(raw_b64.replace("\n", "")).decode("utf-8", errors="replace")
            except Exception:
                continue

            if not decoded.strip():
                continue

            file_ext = Path(file_path).suffix.lower()
            doc = Document(
                page_content=decoded,
                metadata={
                    "source": file_path,
                    "repo": f"https://github.com/{owner}/{repo_name}",
                    "owner": owner,
                    "repo_name": repo_name,
                    "file_name": Path(file_path).name,
                    "file_ext": file_ext,
                    "sha": content_data.get("sha", ""),
                    "html_url": content_data.get("html_url", ""),
                    "source_type": "code" if file_ext in CODE_EXTS else "documentation",
                }
            )
            docs.append(doc)

        print(f"[DevPilot] Fetched {len(docs)} files from GitHub API: {owner}/{repo_name}")
        return docs


    async def extract_concepts(self, repo: str) -> list:
        """Sample chunks from a repo and ask LLM to extract key concepts + lessons."""
        if not self.vectorstore or not _API_KEY:
            return []

        # Pull up to 30 chunks from this repo
        loop = __import__('asyncio').get_event_loop()
        all_chunks = await loop.run_in_executor(
            None, lambda: self.vectorstore.similarity_search(
                "architecture functions classes main features", k=30
            )
        )
        repo_name = repo.rstrip("/").split("/")[-1].replace(".git", "")
        chunks = [c for c in all_chunks if repo_name.lower() in
                  (c.metadata.get("repo", "") + c.metadata.get("repo_url", "")).lower()]

        if not chunks:
            # Fallback: use all top chunks
            chunks = all_chunks[:20]

        # Build context summary
        file_map: dict = {}
        for c in chunks:
            src = c.metadata.get("source", "unknown")
            if src not in file_map:
                file_map[src] = c.page_content[:800]

        context = "\n\n---\n\n".join([
            f"[File: {src}]\n{content}" for src, content in list(file_map.items())[:15]
        ])

        prompt = f"""You are analyzing a software repository called "{repo_name}".
Based on the code and documentation below, extract 5-8 KEY CONCEPTS that a new developer must understand to work on this codebase.

For each concept, provide:
1. A clear title (e.g. "Authentication Flow", "Database Schema", "API Structure")
2. A one-sentence summary
3. A detailed lesson (3-5 sentences) explaining what it is, why it matters, and how it works in THIS codebase
4. Difficulty: beginner / intermediate / advanced
5. Relevant tags (e.g. ["auth", "jwt", "middleware"])
6. Which files to look at (from the files shown below)

Code and documentation:
{context}

Respond ONLY with a JSON array, no other text:
[
  {{
    "title": "...",
    "summary": "...",
    "lesson": "...",
    "difficulty": "beginner|intermediate|advanced",
    "tags": ["tag1", "tag2"],
    "file_refs": ["path/to/file.py"]
  }}
]"""

        try:
            import httpx, json as _json
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    _API_URL,
                    headers={"Authorization": f"Bearer {_API_KEY}", "Content-Type": "application/json"},
                    json={"model": _API_MODEL, "messages": [{"role": "user", "content": prompt}],
                          "max_tokens": 2000, "temperature": 0.3}
                )
                resp.raise_for_status()
                text = resp.json()["choices"][0]["message"]["content"]
                # Strip markdown fences if present
                text = text.strip()
                if text.startswith("```"):
                    text = "\n".join(text.split("\n")[1:])
                if text.endswith("```"):
                    text = "\n".join(text.split("\n")[:-1])
                concepts = _json.loads(text.strip())
                print(f"[DevPilot] Extracted {len(concepts)} concepts from {repo_name}")
                return concepts
        except Exception as e:
            print(f"[DevPilot] Concept extraction error: {e}")
            return []

    def get_ingestion_status(self, job_id: str) -> Dict:
        return INGESTION_STATUS.get(job_id, {"status": "not_found"})

    # ─── Roadmap Generation ───────────────────────────────────────────────────
    async def generate_onboarding_roadmap(
        self,
        developer_id: str,
        role: str = "backend",
        experience_level: str = "mid"
    ) -> Dict:
        from knowledge_gap import KnowledgeGapAnalyzer
        analyzer = KnowledgeGapAnalyzer()
        gaps = analyzer.get_knowledge_gaps()
        gap_topics = [g["topic"] for g in gaps.get("gaps", [])]
        available_topics = self._get_available_topics()

        total_weeks = 4 if experience_level == "senior" else 6 if experience_level == "mid" else 8

        if not _API_KEY:
            return self._mock_roadmap(developer_id, role, experience_level, total_weeks)

        prompt = ROADMAP_PROMPT.format(
            role=role,
            experience_level=experience_level,
            available_topics=", ".join(available_topics[:20]),
            knowledge_gaps=", ".join(gap_topics[:10]),
            total_weeks=total_weeks
        )

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                _API_URL,
                headers={"Authorization": f"Bearer {_API_KEY}", "Content-Type": "application/json"},
                json={"model": _API_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 2000, "temperature": 0.3}
            )
            resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            import re
            m = re.search(r'\{.*\}', raw, re.DOTALL)
            data = json.loads(m.group()) if m else {"items": []}

        return {
            "developer_id": developer_id,
            "role": role,
            "experience_level": experience_level,
            "total_weeks": total_weeks,
            "items": data.get("items", []),
            "generated_at": __import__("datetime").datetime.utcnow().isoformat()
        }

    def _get_available_topics(self) -> List[str]:
        if not self.vectorstore:
            return ["authentication", "database", "API", "deployment", "testing"]
        return ["authentication", "payments", "notifications", "database", "API", "caching", "deployment"]

    # ─── Topic Extraction ────────────────────────────────────────────────────
    def _extract_topics(self, question: str, answer: str) -> List[str]:
        keywords = [
            "authentication", "authorization", "jwt", "oauth", "session",
            "database", "sql", "orm", "migration", "query",
            "api", "rest", "graphql", "endpoint", "middleware",
            "payment", "billing", "subscription", "stripe",
            "deployment", "docker", "kubernetes", "ci/cd", "pipeline",
            "caching", "redis", "memcache", "performance",
            "testing", "unit test", "integration", "mocking",
            "notification", "email", "webhook", "event",
            "security", "encryption", "hashing", "ssl",
            "logging", "monitoring", "error handling", "debugging"
        ]
        combined = (question + " " + answer).lower()
        return [kw for kw in keywords if kw in combined][:5]

    # ─── Mock Responses (no API key mode) ────────────────────────────────────
    def _mock_response(self, question: str) -> Dict:
        q = question.lower()
        if "auth" in q:
            answer = (
                "The authentication system uses JWT (JSON Web Tokens) for stateless auth. "
                "Entry point is `/services/auth/jwt_handler.py` → `generate_token()`. "
                "Tokens expire in 24h; refresh logic is in `auth/refresh.py`. "
                "Middleware applied in `middleware/auth_middleware.py` protects all `/api/v1/` routes. "
                "Related: `models/user.py` for the User schema, `db/auth_queries.py` for DB lookups."
            )
            sources = [{
                "title": "Authentication Architecture",
                "url": "/docs/auth.md",
                "excerpt": "JWT-based stateless authentication with 24-hour expiry...",
                "source_type": "documentation",
                "relevance_score": 0.95
            }]
            code_refs = [{
                "file_path": "/services/auth/jwt_handler.py",
                "function_name": "generate_token",
                "snippet": "def generate_token(user_id: str, expires_delta=None):\n    payload = {\"sub\": user_id, ...}",
                "relevance_score": 0.92
            }]
            topics = ["authentication", "jwt", "middleware", "security"]
        elif "payment" in q:
            answer = (
                "Payment processing lives in `/services/payment/processor.py`. "
                "It uses Stripe under the hood — `StripeClient` is initialized in `payment/client.py`. "
                "Flow: `create_intent()` → `confirm_payment()` → webhook in `api/webhooks/stripe.py`. "
                "All transactions are logged to the `payments` table via `db/payment_queries.py`."
            )
            sources = [{"title": "Payment Service Docs", "url": "/docs/payments.md",
                        "excerpt": "Stripe-based payment processing with webhook support...",
                        "source_type": "documentation", "relevance_score": 0.93}]
            code_refs = [{"file_path": "/services/payment/processor.py",
                          "function_name": "process_payment",
                          "snippet": "async def process_payment(amount, currency, user_id):\n    intent = stripe.PaymentIntent.create(...)",
                          "relevance_score": 0.9}]
            topics = ["payment", "stripe", "webhook", "billing"]
        else:
            answer = (
                f"I found relevant information about '{question}'. "
                "This topic is covered in the main documentation. "
                "Key files to explore: `/services/`, `/models/`, `/api/`. "
                "Check the README.md for a high-level overview. "
                "(Set GROQ_API_KEY in your .env file to enable full AI answers.)"
            )
            sources = [{"title": "Project README", "url": "/README.md",
                        "excerpt": "High-level project overview and getting started guide...",
                        "source_type": "documentation", "relevance_score": 0.75}]
            code_refs = []
            topics = ["architecture", "documentation"]

        return {
            "answer": answer, "sources": sources,
            "code_references": code_refs, "related_topics": topics,
            "confidence": 0.88, "answered": True, "topics": topics
        }

    def _mock_search_results(self, query: str) -> List[Dict]:
        return [
            {"content": f"Documentation about {query}...", "metadata": {"source": "README.md"}, "relevance_score": 0.85},
            {"content": f"Code implementation for {query}...", "metadata": {"source": "/services/core.py"}, "relevance_score": 0.78}
        ]

    def _mock_roadmap(self, developer_id, role, experience_level, total_weeks) -> Dict:
        items = []
        topics_by_week = [
            ("Project Overview & Local Setup", ["setup", "tooling", "git workflow"], 10),
            ("Core Architecture & Data Models", ["database", "ORM", "schema"], 12),
            ("API Design & Authentication", ["REST", "JWT", "middleware"], 14),
            ("Business Logic & Services", ["services", "domain logic", "patterns"], 12),
            ("Testing & Quality Assurance", ["unit tests", "integration", "CI/CD"], 10),
            ("Deployment & Monitoring", ["docker", "k8s", "observability"], 8),
        ]
        for i in range(min(total_weeks, len(topics_by_week))):
            title, topics, hours = topics_by_week[i]
            items.append({
                "week": i + 1, "title": title,
                "description": f"Focus on understanding {', '.join(topics)} in the context of this project.",
                "resources": [f"docs/{t.replace(' ', '_')}.md" for t in topics],
                "estimated_hours": hours, "topics": topics
            })
        return {
            "developer_id": developer_id, "role": role,
            "experience_level": experience_level, "total_weeks": total_weeks,
            "items": items, "generated_at": __import__("datetime").datetime.utcnow().isoformat()
        }