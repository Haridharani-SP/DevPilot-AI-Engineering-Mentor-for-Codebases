import { useState, useEffect, useRef } from "react";
<<<<<<< HEAD
import DevAnalytics from "./dev_analytics";
=======
import LearnerCheckpoint from "./LearnerCheckpoint";
>>>>>>> origin/develop
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ── Config ────────────────────────────────────────────────────────────────────
const API_URL = typeof window !== "undefined"
  ? (window.DEVPILOT_API_URL || "http://localhost:8000")
  : "http://localhost:8000";

const GAP_COLORS = { high: "#ef4444", medium: "#f97316", low: "#22c55e" };

async function api(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const base = {
  root: { fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#080b14", minHeight: "100vh", color: "#e2e8f0" },
  card: { background: "rgba(15,20,35,0.9)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 14, padding: 20 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 },
  input: { background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, color: "#e2e8f0", padding: "10px 14px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%" },
  btn: (variant = "primary") => ({
    background: variant === "primary" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : variant === "danger" ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.12)",
    border: variant === "danger" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(99,102,241,0.2)",
    borderRadius: 10, color: variant === "danger" ? "#ef4444" : "#e2e8f0", padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "opacity 0.15s",
  }),
  badge: (color) => ({ fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600, background: `${color}20`, color, border: `1px solid ${color}40` }),
};

function ProgressRing({ pct, size = 56, stroke = 5, color = "#6366f1" }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e1b4b" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
  );
}

function Avatar({ name, index = 0, size = 38 }) {
  const palettes = [["#6366f1","#a78bfa"],["#0ea5e9","#06b6d4"],["#10b981","#34d399"],["#f59e0b","#fbbf24"],["#ef4444","#f87171"]];
  const [a, b] = palettes[index % palettes.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${a},${b})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    setLoading(true);
    try {
      const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), password }) });
      onLogin(data.user);
    } catch (e) {
      setError("Invalid email or password.");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ ...base.root, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: 400, background: "rgba(15,20,35,0.95)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 20, padding: 40, boxShadow: "0 24px 80px rgba(99,102,241,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚀</div>
          <div style={{ fontSize: 26, fontWeight: 800, background: "linear-gradient(135deg,#818cf8,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>DevPilot</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>AI-Powered Developer Onboarding</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5 }}>EMAIL</label>
            <input style={base.input} type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="you@company.com" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5 }}>PASSWORD</label>
            <input style={base.input} type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••" />
          </div>
          {error && <div style={{ fontSize: 12, color: "#ef4444", background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "8px 12px", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</div>}
          <button style={{ ...base.btn("primary"), padding: "12px", fontSize: 14, textAlign: "center", width: "100%", opacity: loading ? 0.6 : 1 }} onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </div>
        <div style={{ marginTop: 20, fontSize: 11, color: "#334155", textAlign: "center", lineHeight: 1.7 }}>
          Default senior account: <code style={{ color: "#818cf8" }}>senior@devpilot.ai</code><br />
          Ask your senior dev for your onboarder credentials.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SENIOR DEV PORTAL
// ─────────────────────────────────────────────────────────────────────────────
function SeniorDevPortal({ user, onLogout }) {
  const [tab, setTab] = useState("ingest");
  const [overview, setOverview] = useState(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [ingestStatus, setIngestStatus] = useState(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem("gh_token") || "");
  const [githubRepos, setGithubRepos] = useState(() => { try { return JSON.parse(localStorage.getItem("gh_repos") || "[]"); } catch { return []; } });
  const [ghUser, setGhUser] = useState(() => { try { return JSON.parse(localStorage.getItem("gh_user") || "null"); } catch { return null; } });
  const [ghLoading, setGhLoading] = useState(false);
  const [slackToken, setSlackToken] = useState("");
  const [slackChannel, setSlackChannel] = useState("");
  const [slackStatus, setSlackStatus] = useState(null);
  const [slackSaving, setSlackSaving] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newRole, setNewRole] = useState("onboarder");
  const [userMsg, setUserMsg] = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
<<<<<<< HEAD
  const [selectedOnboarder, setSelectedOnboarder] = useState(null);
  function refreshSources() {
    api("/ingest/sources").then(d => setSources(d.sources || [])).catch(() => {});
  }
=======

  function refreshSources() { api("/ingest/sources").then(d => setSources(d.sources || [])).catch(() => {}); }
>>>>>>> origin/develop

  useEffect(() => {
    api("/analytics/overview").then(setOverview).catch(() => {});
    refreshSources();
    api("/auth/users").then(d => setTeamUsers(d.users || [])).catch(() => {});
  }, []);

  async function createUser() {
    if (!newName || !newEmail || !newPassword) { setUserMsg({ ok: false, text: "Name, email and password are required." }); return; }
    setUserLoading(true); setUserMsg(null);
    try {
      const data = await api("/auth/register", { method: "POST", body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole, team: newTeam }) });
      setUserMsg({ ok: true, text: `✅ Account created for ${data.user.name}` });
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewTeam("");
      api("/auth/users").then(d => setTeamUsers(d.users || [])).catch(() => {});
    } catch (e) { setUserMsg({ ok: false, text: e.message || "Failed to create user." }); }
    finally { setUserLoading(false); }
  }

  async function removeUser(userId) {
    if (!window.confirm("Remove this user?")) return;
    try { await api(`/auth/users/${userId}`, { method: "DELETE" }); setTeamUsers(prev => prev.filter(u => u.user_id !== userId)); }
    catch (e) { alert("Failed to remove user: " + e.message); }
  }

  async function connectGitHub() {
    if (!githubToken.trim()) return; setGhLoading(true);
    try {
      const data = await api(`/github/repos?token=${encodeURIComponent(githubToken)}`);
      setGithubRepos(data.repos || []); setGhUser(data.user || null);
      localStorage.setItem("gh_token", githubToken); localStorage.setItem("gh_repos", JSON.stringify(data.repos || [])); localStorage.setItem("gh_user", JSON.stringify(data.user || null));
    } catch (e) { alert("GitHub connection failed: " + e.message); }
    finally { setGhLoading(false); }
  }

  function disconnectGitHub() {
    localStorage.removeItem("gh_token"); localStorage.removeItem("gh_repos"); localStorage.removeItem("gh_user");
    setGithubToken(""); setGithubRepos([]); setGhUser(null);
  }

  async function ingestRepo(url) {
    if (!url.trim()) return; setIngestLoading(true); setIngestStatus({ status: "starting" });
    try {
      const data = await api("/ingest", { method: "POST", body: JSON.stringify({ sources: [url], source_type: "github", project_id: "default" }) });
      setIngestStatus(data); pollIngest(data.job_id);
    } catch (e) { setIngestStatus({ status: "error", message: e.message }); setIngestLoading(false); }
  }

  async function ingestDoc() {
    if (!docUrl.trim()) return; setIngestLoading(true); setIngestStatus({ status: "starting" });
    try {
      const data = await api("/ingest", { method: "POST", body: JSON.stringify({ sources: [docUrl], source_type: "documentation", project_id: "default" }) });
      setIngestStatus(data); pollIngest(data.job_id);
    } catch (e) { setIngestStatus({ status: "error", message: e.message }); setIngestLoading(false); }
  }

  async function ingestFile() {
    if (!uploadFile) return; setIngestLoading(true); setIngestStatus({ status: "starting" });
    const formData = new FormData(); formData.append("file", uploadFile);
    try {
      const res = await fetch(`${API_URL}/ingest/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json(); setIngestStatus(data); pollIngest(data.job_id); setUploadFile(null);
    } catch (e) { setIngestStatus({ status: "error", message: e.message }); setIngestLoading(false); }
  }

  function pollIngest(jobId) {
    const iv = setInterval(async () => {
      try {
        const st = await api(`/ingest/status/${jobId}`); setIngestStatus(st);
        if (st.status === "completed" || st.status === "error") { clearInterval(iv); setIngestLoading(false); refreshSources(); }
      } catch { clearInterval(iv); setIngestLoading(false); }
    }, 2000);
  }

  async function saveSlack() {
    if (!slackToken.trim()) return; setSlackSaving(true);
    try { await api("/slack/configure", { method: "POST", body: JSON.stringify({ token: slackToken, default_channel: slackChannel }) }); setSlackStatus({ ok: true }); }
    catch (e) { setSlackStatus({ ok: false, error: e.message }); }
    finally { setSlackSaving(false); }
  }

  const navTabs = [
    { id: "ingest", label: "📥 Ingest Content" },
    { id: "github", label: "🐙 GitHub" },
    { id: "slack", label: "💬 Slack" },
    { id: "team", label: "👥 Team" },
    { id: "analytics", label: "📊 Analytics" },
  ];

  return (
    <div style={base.root}>
      <GlobalStyles />
      <div style={{ background: "rgba(8,11,20,0.96)", borderBottom: "1px solid rgba(99,102,241,0.2)", padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 56, backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 17, fontWeight: 800, background: "linear-gradient(135deg,#818cf8,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "flex", alignItems: "center", gap: 6 }}>🚀 DevPilot</div>
        <span style={{ ...base.badge("#6366f1"), fontSize: 9 }}>SENIOR DEV</span>
        <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
          {navTabs.map(t => (
            <button key={t.id} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: tab === t.id ? "rgba(99,102,241,0.18)" : "transparent", color: tab === t.id ? "#818cf8" : "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "inherit" }} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>{user.name}</span>
          <button onClick={onLogout} style={{ ...base.btn("ghost"), fontSize: 11, padding: "5px 12px" }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        {tab === "ingest" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={base.card}>
              <div style={base.sectionTitle}>📄 Ingest URL / Doc Path</div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>Paste a URL, Confluence page, or local file path to add to the knowledge base.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input style={base.input} value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://docs.example.com or ./docs/README.md" />
                <button style={{ ...base.btn("primary"), opacity: ingestLoading ? 0.5 : 1 }} onClick={ingestDoc} disabled={ingestLoading || !docUrl.trim()}>{ingestLoading ? "Ingesting..." : "Ingest →"}</button>
              </div>
            </div>
            <div style={base.card}>
              <div style={base.sectionTitle}>📁 Upload Local File</div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>Upload a file from your computer. Supported: <code style={{ color: "#a5b4fc" }}>.md .txt .py .js .ts .html</code></p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ border: "2px dashed rgba(99,102,241,0.3)", borderRadius: 10, padding: "20px", textAlign: "center", cursor: "pointer", background: uploadFile ? "rgba(99,102,241,0.08)" : "transparent", color: uploadFile ? "#818cf8" : "#475569", fontSize: 13 }}>
                  {uploadFile ? `✅ ${uploadFile.name}` : "Click to choose file or drag & drop"}
                  <input type="file" style={{ display: "none" }} accept=".md,.txt,.py,.js,.ts,.html,.rst,.mdx" onChange={e => setUploadFile(e.target.files[0] || null)} />
                </label>
                <button style={{ ...base.btn("primary"), opacity: (!uploadFile || ingestLoading) ? 0.5 : 1 }} onClick={ingestFile} disabled={!uploadFile || ingestLoading}>{ingestLoading ? "Uploading..." : "Upload & Index →"}</button>
              </div>
            </div>
            <div style={base.card}>
              <div style={base.sectionTitle}>🔗 Ingest GitHub Repo (URL)</div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>Paste any GitHub repo URL. DevPilot will clone and index it automatically.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input style={base.input} value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" />
                <button style={{ ...base.btn("primary"), opacity: ingestLoading ? 0.5 : 1 }} onClick={() => ingestRepo(repoUrl)} disabled={ingestLoading || !repoUrl.trim()}>{ingestLoading ? "Cloning..." : "Clone & Index →"}</button>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#475569" }}>💡 Or connect GitHub in the <strong style={{ color: "#818cf8" }}>GitHub</strong> tab to pick from your repos.</div>
            </div>
            {ingestStatus && (
              <div style={{ ...base.card, background: ingestStatus.status === "completed" ? "rgba(34,197,94,0.06)" : ingestStatus.status === "error" ? "rgba(239,68,68,0.06)" : "rgba(99,102,241,0.06)", border: `1px solid ${ingestStatus.status === "completed" ? "rgba(34,197,94,0.25)" : ingestStatus.status === "error" ? "rgba(239,68,68,0.25)" : "rgba(99,102,241,0.25)"}` }}>
                <div style={base.sectionTitle}>⚡ Ingestion Status</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: ingestStatus.status === "completed" ? "#22c55e" : ingestStatus.status === "error" ? "#ef4444" : "#818cf8" }}>{ingestStatus.status === "completed" ? "✅ Completed" : ingestStatus.status === "error" ? "❌ Error" : "⏳ Processing..."}</div>
                {ingestStatus.message && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{ingestStatus.message}</div>}
                {ingestStatus.documents_processed > 0 && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{ingestStatus.documents_processed} chunks indexed</div>}
                {ingestStatus.status === "processing" && <div style={{ marginTop: 10, height: 4, background: "rgba(99,102,241,0.15)", borderRadius: 99 }}><div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#6366f1,#a78bfa)", width: `${ingestStatus.progress || 15}%`, transition: "width 0.5s ease" }} /></div>}
              </div>
            )}
            <div style={{ ...base.card, gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={base.sectionTitle}>📚 Indexed Knowledge Base ({sources.length} sources)</div>
                <button onClick={refreshSources} style={{ ...base.btn("ghost"), fontSize: 11, padding: "4px 12px" }}>↻ Refresh</button>
              </div>
              {sources.length === 0 ? <div style={{ fontSize: 13, color: "#475569", padding: "24px 0", textAlign: "center" }}>No sources indexed yet. Add a doc, file, or repo above.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sources.map((src, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)", borderRadius: 10, padding: "10px 14px" }}>
                      <span style={{ fontSize: 18 }}>{src.source_type === "github" ? "🐙" : src.source_type === "code" ? "💻" : "📄"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{src.title || src.source}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{src.chunks > 0 ? `${src.chunks} chunks` : "indexed"} · {src.source_type} · {src.ingested_at?.slice(0,10)}</div>
                      </div>
                      <span style={base.badge("#22c55e")}>indexed</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "github" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={base.card}>
              <div style={base.sectionTitle}>🐙 GitHub Account</div>
              {ghUser ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={ghUser.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                  <div><div style={{ fontWeight: 600 }}>@{ghUser.login}</div><div style={{ fontSize: 11, color: "#22c55e" }}>✓ Connected · {githubRepos.length} repos</div></div>
                  <button onClick={disconnectGitHub} style={{ ...base.btn("danger"), marginLeft: "auto", fontSize: 11, padding: "5px 14px" }}>Disconnect</button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>Paste your GitHub Personal Access Token (<code style={{ color: "#a5b4fc" }}>repo</code> scope) to browse your repositories. &nbsp;<a href="https://github.com/settings/tokens/new?scopes=repo&description=DevPilot" target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>Generate token →</a></p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input style={{ ...base.input, flex: 1 }} type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
                    <button style={{ ...base.btn("primary"), whiteSpace: "nowrap", opacity: ghLoading ? 0.5 : 1 }} onClick={connectGitHub} disabled={ghLoading || !githubToken.trim()}>{ghLoading ? "Connecting..." : "Connect →"}</button>
                  </div>
                </>
              )}
            </div>
            {githubRepos.length > 0 && (
              <div style={base.card}>
                <div style={base.sectionTitle}>📦 Your Repositories ({githubRepos.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {githubRepos.map((repo) => (
                    <div key={repo.id} style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{repo.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, minHeight: 30, lineHeight: 1.5 }}>{repo.description || "No description"}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        {repo.language && <span style={base.badge("#06b6d4")}>{repo.language}</span>}
                        <span style={{ fontSize: 10, color: "#475569" }}>⭐ {repo.stargazers_count}</span>
                      </div>
                      <button style={{ ...base.btn("primary"), width: "100%", padding: "7px", fontSize: 11, textAlign: "center", opacity: ingestLoading ? 0.5 : 1 }} onClick={() => ingestRepo(repo.clone_url)} disabled={ingestLoading}>{ingestLoading ? "Indexing..." : "Index This Repo →"}</button>
                    </div>
                  ))}
                </div>
                {ingestStatus && (
                  <div style={{ marginTop: 14, borderRadius: 10, padding: "10px 14px", fontSize: 12, background: ingestStatus.status === "completed" ? "rgba(34,197,94,0.08)" : "rgba(99,102,241,0.08)", border: `1px solid ${ingestStatus.status === "completed" ? "rgba(34,197,94,0.25)" : "rgba(99,102,241,0.25)"}` }}>
                    <strong style={{ color: ingestStatus.status === "completed" ? "#22c55e" : "#818cf8" }}>{ingestStatus.status === "completed" ? "✅ Done" : "⏳ Indexing..."}</strong>
                    {ingestStatus.documents_processed > 0 && <span style={{ color: "#64748b", marginLeft: 8 }}>· {ingestStatus.documents_processed} chunks indexed</span>}
                    {ingestStatus.status === "processing" && <div style={{ marginTop: 8, height: 4, background: "rgba(99,102,241,0.15)", borderRadius: 99 }}><div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#6366f1,#a78bfa)", width: `${ingestStatus.progress || 15}%`, transition: "width 0.5s ease" }} /></div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "slack" && (
          <div style={{ maxWidth: 600 }}>
            <div style={base.card}>
              <div style={base.sectionTitle}>💬 Slack Bot Configuration</div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20, lineHeight: 1.7 }}>Connect DevPilot to your Slack workspace. Once configured, developers can ask DevPilot questions directly in Slack using <code style={{ color: "#a5b4fc" }}>@DevPilot how does auth work?</code></p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5 }}>SLACK BOT TOKEN</label>
                  <input style={base.input} type="password" value={slackToken} onChange={e => setSlackToken(e.target.value)} placeholder="xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx" />
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>From your <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>Slack App settings</a> → OAuth & Permissions → Bot Token</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5 }}>DEFAULT CHANNEL (optional)</label>
                  <input style={base.input} value={slackChannel} onChange={e => setSlackChannel(e.target.value)} placeholder="#onboarding" />
                </div>
                <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "14px 16px", fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
                  <strong style={{ color: "#818cf8", display: "block", marginBottom: 6 }}>📋 Setup checklist</strong>
                  1. Create a Slack App at <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>api.slack.com/apps</a><br />
                  2. Add OAuth scopes: <code style={{ color: "#a5b4fc" }}>chat:write</code>, <code style={{ color: "#a5b4fc" }}>app_mentions:read</code>, <code style={{ color: "#a5b4fc" }}>channels:history</code><br />
                  3. Set Event Subscriptions URL: <code style={{ color: "#a5b4fc" }}>{API_URL}/slack/events</code><br />
                  4. Subscribe to: <code style={{ color: "#a5b4fc" }}>app_mention</code> event<br />
                  5. Install app to workspace and paste the Bot Token above
                </div>
                <button style={{ ...base.btn("primary"), opacity: slackSaving ? 0.5 : 1 }} onClick={saveSlack} disabled={slackSaving || !slackToken.trim()}>{slackSaving ? "Saving..." : "Save Slack Configuration →"}</button>
                {slackStatus && <div style={{ background: slackStatus.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${slackStatus.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: slackStatus.ok ? "#22c55e" : "#ef4444" }}>{slackStatus.ok ? "✅ Slack bot configured successfully!" : `❌ ${slackStatus.error}`}</div>}
              </div>
            </div>
          </div>
        )}

        {tab === "team" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={base.card}>
              <div style={base.sectionTitle}>➕ Add Onboarder Account</div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>Create login credentials for a new team member. Share the email and password with them directly.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div><label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>FULL NAME</label><input style={base.input} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Alice Chen" /></div>
                <div><label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>EMAIL</label><input style={base.input} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="alice@company.com" /></div>
                <div><label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>PASSWORD</label><input style={base.input} type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="min 6 characters" /></div>
                <div><label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>TEAM (optional)</label><input style={base.input} value={newTeam} onChange={e => setNewTeam(e.target.value)} placeholder="e.g. Platform, Consumer" /></div>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>ROLE</label>
                  <select style={{ ...base.input, cursor: "pointer" }} value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="onboarder">Onboarder</option>
                    <option value="senior">Senior Dev</option>
                  </select>
                </div>
                <button style={{ ...base.btn("primary"), opacity: userLoading ? 0.5 : 1 }} onClick={createUser} disabled={userLoading}>{userLoading ? "Creating..." : "Create Account →"}</button>
                {userMsg && <div style={{ fontSize: 12, borderRadius: 8, padding: "8px 12px", background: userMsg.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${userMsg.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, color: userMsg.ok ? "#22c55e" : "#ef4444" }}>{userMsg.text}</div>}
              </div>
            </div>
            <div style={base.card}>
              <div style={base.sectionTitle}>👥 Registered Users ({teamUsers.length})</div>
              {teamUsers.length === 0 ? <div style={{ fontSize: 13, color: "#475569", padding: "20px 0", textAlign: "center" }}>No users yet. Create the first account on the left.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {teamUsers.map((u, i) => (
                    <div key={u.user_id} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)", borderRadius: 10, padding: "10px 14px" }}>
                      <Avatar name={u.name} index={i} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{u.email}{u.team ? ` · ${u.team}` : ""}</div>
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>Last login: {u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}</div>
                      </div>
                      <span style={base.badge(u.role === "senior" ? "#a855f7" : "#06b6d4")}>{u.role}</span>
                      {u.role !== "senior" && <button onClick={() => removeUser(u.user_id)} style={{ ...base.btn("danger"), fontSize: 11, padding: "4px 10px" }}>✕</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

<<<<<<< HEAD
        {/* ── ANALYTICS TAB ──────────────────────────────────────────────── */}
        {tab === "analytics" && (
        selectedOnboarder ? (
          <OnboarderProgress user={selectedOnboarder} onBack={() => setSelectedOnboarder(null)} />
        ) : (
          <DevAnalytics
            onSelectUser={(user) => {
              setSelectedOnboarder(user);
            }}
          />
        )
      )}
=======
        {tab === "analytics" && (overview ? <SeniorAnalytics overview={overview} /> : <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Loading analytics...</div>)}
>>>>>>> origin/develop
      </div>
    </div>
  );
}

function SeniorAnalytics({ overview }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total Queries", val: overview.total_queries?.toLocaleString(), icon: "💬", color: "#6366f1" },
          { label: "Active Developers", val: overview.unique_developers, icon: "👩‍💻", color: "#06b6d4" },
          { label: "Avg AI Confidence", val: `${Math.round((overview.avg_confidence || 0) * 100)}%`, icon: "🎯", color: "#22c55e" },
          { label: "Unanswered Rate", val: `${Math.round((overview.unanswered_rate || 0) * 100)}%`, icon: "❓", color: "#f59e0b" },
        ].map((k, i) => (
          <div key={i} style={{ ...base.card, borderTop: `2px solid ${k.color}` }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={base.card}>
          <div style={base.sectionTitle}>Query Activity — Last 14 Days</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={overview.queries_by_day || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#0f1422", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="queries" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={base.card}>
          <div style={base.sectionTitle}>Knowledge Gap Analysis</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={overview.top_knowledge_gaps || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} />
              <YAxis dataKey="topic" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} width={90} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0f1422", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="query_count" radius={[0, 4, 4, 0]}>
                {(overview.top_knowledge_gaps || []).map((g, i) => (<Cell key={i} fill={GAP_COLORS[g.gap_severity] || "#6366f1"} fillOpacity={0.8} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={base.card}>
        <div style={base.sectionTitle}>Onboarder Progress</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
          {(overview.most_active_developers || []).map((dev, i) => (
            <div key={dev.developer_id} style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <Avatar name={dev.name || dev.developer_id} index={i} />
                <div><div style={{ fontWeight: 600, fontSize: 13 }}>{dev.name || dev.developer_id}</div><div style={{ fontSize: 10, color: "#64748b" }}>{dev.queries_this_week} queries this week</div></div>
                <div style={{ marginLeft: "auto", position: "relative" }}>
                  <ProgressRing pct={dev.onboarding_progress} />
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 9, fontWeight: 700, color: "#818cf8" }}>{Math.round(dev.onboarding_progress)}%</div>
                </div>
              </div>
              <div style={{ height: 4, background: "rgba(99,102,241,0.1)", borderRadius: 99 }}><div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#6366f1,#a78bfa)", width: `${dev.onboarding_progress}%`, transition: "width 0.8s ease" }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnboarderProgress({ user, onBack }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:8000/analytics/developer/${user.user_id}`)
      .then(res => res.json())
      .then(setStats)
      .catch(() => {});
  }, [user]);

  if (!stats) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        Loading progress...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      
      <button
        onClick={onBack}
        style={{
          background: "transparent",
          border: "1px solid #6366f1",
          color: "#6366f1",
          padding: "6px 14px",
          borderRadius: 8,
          width: 120,
          cursor: "pointer"
        }}
      >
        ← Back
      </button>

      <div style={{
        background: "rgba(15,20,35,0.9)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 12,
        padding: 24
      }}>
        <h2>{user.name}</h2>
        <p style={{ color:"#64748b", marginBottom:20 }}>{user.email}</p>

        <div style={{ display:"flex", gap:20 }}>

          <div style={statCard}>
            <h3>{stats.total_queries}</h3>
            <p>Total Queries</p>
          </div>

          <div style={statCard}>
            <h3>{stats.queries_this_week}</h3>
            <p>This Week</p>
          </div>

          <div style={statCard}>
            <h3>{Math.round(stats.onboarding_progress)}%</h3>
            <p>Progress</p>
          </div>

        </div>

        {stats.unique_topics?.length > 0 && (
          <>
            <h3 style={{ marginTop: 20 }}>Topics Learned</h3>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {stats.unique_topics.map((t,i)=>(
                <span key={i} style={{
                  padding:"4px 10px",
                  borderRadius:20,
                  background:"#22c55e20",
                  border:"1px solid #22c55e40",
                  fontSize:12
                }}>
                  {t}
                </span>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

const statCard = {
  background:"#0f172a",
  padding:16,
  borderRadius:10,
  border:"1px solid #334155",
  minWidth:120,
  textAlign:"center"
};

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDER PORTAL
// ─────────────────────────────────────────────────────────────────────────────
function OnboarderPortal({ user, onLogout }) {
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: `Hi ${user.name}! 👋 I'm **DevPilot**, your AI engineering mentor.\n\nAsk me anything about the codebase — architecture, authentication, payments, deployment, or any technical topic. I'll give you answers grounded in your team's actual documentation and code.`,
    ts: Date.now(), sources: [], code_references: [], confidence: 1,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState([]);
  const [devStats, setDevStats] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    api(`/analytics/developer/${user.id}`).then(setDevStats).catch(() => {});
    api("/ingest/sources").then(d => setResources(d.sources || [])).catch(() => {});
  }, [user.id]);

  useEffect(() => {
    const iv = setInterval(() => { api("/ingest/sources").then(d => setResources(d.sources || [])).catch(() => {}); }, 10000);
    return () => clearInterval(iv);
  }, []);

  async function sendMessage() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: q, ts: Date.now() }]);
    setLoading(true);
    try {
      const data = await api("/query", { method: "POST", body: JSON.stringify({ question: q, developer_id: user.id }) });
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, sources: data.sources || [], code_references: data.code_references || [], related_topics: data.related_topics || [], confidence: data.confidence, ts: Date.now() }]);
      api(`/analytics/developer/${user.id}`).then(setDevStats).catch(() => {});
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection error. Make sure the DevPilot API is running at `" + API_URL + "`.", ts: Date.now(), sources: [], code_references: [], confidence: 0 }]);
    } finally { setLoading(false); }
  }

  const progress = devStats?.onboarding_progress || 0;
  const navTabs = [
    { id: "chat", label: "🤖 Ask DevPilot" },
    { id: "resources", label: "📚 Resources" },
    { id: "progress", label: "📈 My Progress" },
  ];

  return (
    <div style={base.root}>
      <GlobalStyles />
      <div style={{ background: "rgba(8,11,20,0.96)", borderBottom: "1px solid rgba(6,182,212,0.2)", padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 56, backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 17, fontWeight: 800, background: "linear-gradient(135deg,#38bdf8,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "flex", alignItems: "center", gap: 6 }}>🚀 DevPilot</div>
        <span style={{ ...base.badge("#06b6d4"), fontSize: 9 }}>ONBOARDER</span>
        <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
          {navTabs.map(t => (<button key={t.id} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: tab === t.id ? "rgba(6,182,212,0.15)" : "transparent", color: tab === t.id ? "#38bdf8" : "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "inherit" }} onClick={() => setTab(t.id)}>{t.label}</button>))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 80, height: 4, background: "rgba(6,182,212,0.15)", borderRadius: 99 }}><div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#0ea5e9,#06b6d4)", width: `${progress}%`, transition: "width 0.8s ease" }} /></div>
            <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600 }}>{Math.round(progress)}%</span>
          </div>
          <span style={{ fontSize: 12, color: "#64748b" }}>{user.name}</span>
          <button onClick={onLogout} style={{ ...base.btn("ghost"), fontSize: 11, padding: "5px 12px" }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

        {/* ── CHAT TAB ───────────────────────────────────────────────────── */}
        {tab === "chat" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, height: "calc(100vh - 104px)" }}>

            {/* Chat panel */}
            <div style={{ ...base.card, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(6,182,212,0.15)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>D</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>DevPilot AI Mentor</div>
                  <div style={{ fontSize: 11, color: "#22c55e" }}>● Online · Grok-powered RAG</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["How does auth work?", "Explain the DB schema", "How to deploy?", "Where are the tests?"].map(q => (
                    <button key={q} onClick={() => setInput(q)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 99, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "#38bdf8", cursor: "pointer", fontFamily: "inherit" }}>{q}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
                {messages.map((msg, i) => <ChatBubble key={i} msg={msg} userName={user.name} />)}
                {loading && (
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>D</div>
                    <div style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: "4px 16px 16px 16px", padding: "12px 16px", display: "flex", gap: 4 }}>
                      {[0,1,2].map(j => (<div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ea5e9", animation: "bounce 1s infinite", animationDelay: `${j * 0.15}s` }} />))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(6,182,212,0.15)", display: "flex", gap: 10 }}>
                <input style={{ ...base.input, flex: 1, border: "1px solid rgba(6,182,212,0.2)" }} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()} placeholder="Ask anything about the codebase, architecture, or workflows..." />
                <button style={{ background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", border: "none", borderRadius: 10, color: "#fff", padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: loading ? 0.5 : 1 }} onClick={sendMessage} disabled={loading}>{loading ? "..." : "Ask →"}</button>
              </div>
            </div>

            {/* ── NEW: Learning Checkpoints sidebar ── */}
            <LearnerCheckpoint
              userId={user.id}
              onAskAI={(q) => setInput(q)}
              style={{ height: "100%", overflow: "hidden" }}
            />
          </div>
        )}

        {/* ── RESOURCES TAB ──────────────────────────────────────────────── */}
        {tab === "resources" && (
          <div>
            <div style={{ ...base.card, marginBottom: 20 }}>
              <div style={base.sectionTitle}>📚 Knowledge Base — Ingested by Your Team</div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>These are the documents and repos your senior dev has indexed. DevPilot uses all of this to answer your questions.</p>
              {resources.length === 0 ? <div style={{ fontSize: 13, color: "#475569", padding: "30px 0", textAlign: "center" }}>No resources indexed yet. Ask your senior dev to add docs & repos.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {resources.map((src, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(6,182,212,0.03)", border: "1px solid rgba(6,182,212,0.1)", borderRadius: 10, padding: "12px 16px" }}>
                      <span style={{ fontSize: 18 }}>{src.source_type === "github" ? "🐙" : src.source_type === "code" ? "💻" : "📄"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{src.title || src.source}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{src.chunks} chunks · {src.source_type}</div>
                      </div>
                      <button onClick={() => { setTab("chat"); setInput(`Explain ${src.title || src.source}`); }} style={{ ...base.btn("ghost"), fontSize: 11, padding: "5px 12px" }}>Ask about this →</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={base.card}>
              <div style={base.sectionTitle}>💡 Suggested Questions to Get Started</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["How does the authentication system work?","Walk me through the database schema","How do I run the project locally?","Where is the payment integration?","How are API endpoints structured?","How do I write and run tests?","What does the deployment pipeline look like?","How is error handling done in this codebase?"].map((q, i) => (
                  <button key={i} onClick={() => { setTab("chat"); setInput(q); }} style={{ textAlign: "left", background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.12)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", color: "#94a3b8", fontSize: 12, fontFamily: "inherit", lineHeight: 1.5, transition: "all 0.15s" }}>💬 {q}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PROGRESS TAB ───────────────────────────────────────────────── */}
        {tab === "progress" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={base.card}>
              <div style={base.sectionTitle}>🎯 Onboarding Progress</div>
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
                <div style={{ position: "relative" }}>
                  <ProgressRing pct={progress} size={80} stroke={7} color="#0ea5e9" />
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 14, fontWeight: 800, color: "#38bdf8" }}>{Math.round(progress)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Onboarding Developer</div>
                  <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>{progress < 33 ? "🌱 Getting started" : progress < 66 ? "📈 Making good progress" : "🚀 Nearly there!"}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[{ label: "Total Queries", val: devStats?.total_queries || 0, color: "#6366f1" },{ label: "This Week", val: devStats?.queries_this_week || 0, color: "#06b6d4" },{ label: "Days Active", val: devStats?.days_active || 0, color: "#22c55e" }].map((s, i) => (
                  <div key={i} style={{ background: `${s.color}10`, border: `1px solid ${s.color}25`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={base.card}>
              <div style={base.sectionTitle}>📖 Topics Explored</div>
              {devStats?.unique_topics?.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{devStats.unique_topics.map((t, i) => (<span key={i} style={base.badge("#22c55e")}>✓ {t}</span>))}</div>
              ) : <div style={{ fontSize: 12, color: "#475569" }}>Start asking questions to track your topics!</div>}
              {devStats?.knowledge_gaps?.length > 0 && (
                <>
                  <div style={{ ...base.sectionTitle, marginTop: 18 }}>⚠️ Areas to Strengthen</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {devStats.knowledge_gaps.map((t, i) => (<button key={i} onClick={() => { setTab("chat"); setInput(`Explain ${t} in detail`); }} style={{ ...base.badge("#f59e0b"), cursor: "pointer", fontFamily: "inherit" }}>📌 {t}</button>))}
                  </div>
                </>
              )}
            </div>
            <div style={{ ...base.card, gridColumn: "1 / -1" }}>
              <div style={base.sectionTitle}>🗺️ Recommended Learning Path</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(devStats?.recommended_topics || ["authentication", "database", "testing", "deployment"]).map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.1)", borderRadius: 10, padding: "12px 16px" }}>
                    <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(6,182,212,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#38bdf8", flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Learn <strong style={{ color: "#38bdf8" }}>{t}</strong></div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Ask DevPilot about this topic to explore</div>
                    </div>
                    <button onClick={() => { setTab("chat"); setInput(`Explain ${t} in this codebase`); }} style={{ ...base.btn("ghost"), fontSize: 11, padding: "6px 14px" }}>Explore →</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ msg, userName }) {
  const isBot = msg.role === "assistant";
  const lines = (msg.content || "").split("\n").map((line, i) => {
    const html = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code style='background:rgba(6,182,212,0.12);color:#a5b4fc;padding:1px 5px;border-radius:4px;font-size:12px'>$1</code>");
    return <p key={i} dangerouslySetInnerHTML={{ __html: html }} style={{ margin: "2px 0", lineHeight: 1.6 }} />;
  });
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexDirection: isBot ? "row" : "row-reverse", alignItems: "flex-start" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: isBot ? "linear-gradient(135deg,#0ea5e9,#06b6d4)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
        {isBot ? "D" : (userName || "U")[0]}
      </div>
      <div style={{ maxWidth: "78%" }}>
        <div style={{ background: isBot ? "rgba(6,182,212,0.06)" : "rgba(99,102,241,0.08)", border: `1px solid ${isBot ? "rgba(6,182,212,0.18)" : "rgba(99,102,241,0.2)"}`, borderRadius: isBot ? "4px 16px 16px 16px" : "16px 4px 16px 16px", padding: "10px 14px", fontSize: 13, color: "#e2e8f0" }}>{lines}</div>

        {isBot && <div style={{ marginTop: 4, fontSize: 10, color: "#334155" }}>{msg.confidence ? `${Math.round(msg.confidence * 100)}% confidence · ` : ""}{new Date(msg.ts).toLocaleTimeString()}</div>}
      </div>
    </div>
  );
}

function GlobalStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 99px; }
      button:hover { opacity: 0.85; }
      @keyframes bounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
        40% { transform: translateY(-6px); opacity: 1; }
      }
    `}</style>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  function handleLogin(u) { setUser(u); }
  function handleLogout() { setUser(null); }
  if (!user) return <LoginScreen onLogin={handleLogin} />;
  if (user.role === "senior") return <SeniorDevPortal user={user} onLogout={handleLogout} />;
  return <OnboarderPortal user={user} onLogout={handleLogout} />;
}