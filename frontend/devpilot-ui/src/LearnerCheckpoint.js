import { useState, useEffect } from "react";

const API_URL = typeof window !== "undefined"
  ? (window.DEVPILOT_API_URL || "http://localhost:8000")
  : "http://localhost:8000";

async function api(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const DIFF_COLOR = { beginner: "#22c55e", intermediate: "#f59e0b", advanced: "#ef4444" };
const DIFF_ICON  = { beginner: "🟢", intermediate: "🟡", advanced: "🔴" };

// ── Shared mini-styles (no dependency on App.js base) ─────────────────────────
const s = {
  card: {
    background: "rgba(15,20,35,0.9)",
    border: "1px solid rgba(6,182,212,0.15)",
    borderRadius: 14,
    overflow: "hidden",
  },
  badge: (color) => ({
    fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600,
    background: `${color}20`, color, border: `1px solid ${color}40`,
    display: "inline-flex", alignItems: "center",
  }),
  btn: (variant = "primary") => ({
    background: variant === "primary"
      ? "linear-gradient(135deg,#0ea5e9,#06b6d4)"
      : variant === "success"
      ? "rgba(34,197,94,0.15)"
      : "rgba(6,182,212,0.08)",
    border: variant === "success"
      ? "1px solid rgba(34,197,94,0.3)"
      : "1px solid rgba(6,182,212,0.2)",
    borderRadius: 8,
    color: variant === "success" ? "#22c55e" : "#e2e8f0",
    padding: "6px 14px", cursor: "pointer", fontSize: 11,
    fontWeight: 600, fontFamily: "inherit", transition: "opacity 0.15s",
  }),
};

// ── Single concept card (collapsed / expanded) ────────────────────────────────
function ConceptCard({ concept, status, onMark, onAsk }) {
  const [open, setOpen] = useState(false);
  const done    = status === "done";
  const reading = status === "reading";

  return (
    <div style={{
      borderRadius: 10, overflow: "hidden", marginBottom: 6,
      border: `1px solid ${open ? "rgba(6,182,212,0.3)" : "rgba(6,182,212,0.1)"}`,
      background: open ? "rgba(6,182,212,0.06)" : "rgba(15,20,35,0.6)",
      transition: "all 0.15s",
    }}>
      {/* Header row */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 12px", cursor: "pointer", userSelect: "none",
        }}
      >
        <span style={{ fontSize: 13 }}>
          {done ? "✅" : reading ? "📖" : "○"}
        </span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: done ? 400 : 600,
          color: done ? "#64748b" : "#e2e8f0", textDecoration: done ? "line-through" : "none" }}>
          {concept.title}
        </span>
        <span style={s.badge(DIFF_COLOR[concept.difficulty] || "#6366f1")}>
          {DIFF_ICON[concept.difficulty]} {concept.difficulty}
        </span>
        <span style={{ fontSize: 10, color: "#475569", marginLeft: 4 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(6,182,212,0.1)" }}>
          {/* Summary */}
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 10, marginBottom: 10, lineHeight: 1.6 }}>
            {concept.summary}
          </p>

          {/* Lesson box */}
          <div style={{
            background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.12)",
            borderRadius: 8, padding: "10px 12px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 9, color: "#06b6d4", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>📘 Lesson</div>
            <p style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {concept.lesson}
            </p>
          </div>

          {/* Files */}
          {concept.file_refs?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>📁 Files to explore</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {concept.file_refs.map((f, i) => (
                  <span key={i} style={{
                    fontFamily: "monospace", fontSize: 10, color: "#a5b4fc",
                    background: "rgba(99,102,241,0.1)", borderRadius: 4, padding: "2px 7px",
                  }}>{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {concept.tags?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
              {concept.tags.map((t, i) => (
                <span key={i} style={s.badge("#6366f1")}>{t}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              onClick={e => { e.stopPropagation(); onMark(concept.id, done ? "unseen" : "done"); }}
              style={s.btn(done ? "ghost" : "success")}
            >
              {done ? "↩ Undo" : "✅ Mark Done"}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onMark(concept.id, "reading"); }}
              style={s.btn("ghost")}
              disabled={reading}
            >
              📖 {reading ? "Reading..." : "Mark Reading"}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onAsk(concept.title); }}
              style={{ ...s.btn("primary"), marginLeft: "auto" }}
            >
              💬 Ask AI →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function CheckpointProgress({ concepts, progress }) {
  const total = concepts.length;
  const done  = concepts.filter(c => progress[c.id] === "done").length;
  const reading = concepts.filter(c => progress[c.id] === "reading").length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(6,182,212,0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4" }}>
          🎓 Learning Checkpoints
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          {done}/{total} done {reading > 0 ? `· ${reading} reading` : ""}
        </span>
      </div>
      <div style={{ height: 4, background: "rgba(6,182,212,0.1)", borderRadius: 99 }}>
        <div style={{
          height: "100%", borderRadius: 99,
          background: "linear-gradient(90deg,#0ea5e9,#06b6d4)",
          width: `${pct}%`, transition: "width 0.6s ease",
        }} />
      </div>
      {pct === 100 && total > 0 && (
        <div style={{ fontSize: 11, color: "#22c55e", marginTop: 6, textAlign: "center" }}>
          🏆 All concepts mastered! You're ready to contribute.
        </div>
      )}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
/**
 * LearnerCheckpoint
 *
 * Props:
 *   userId   (string) — current developer's ID
 *   onAskAI  (fn)     — called with (questionString) to pre-fill chat input
 *   style    (obj)    — optional wrapper style override
 */
export default function LearnerCheckpoint({ userId, onAskAI, style = {} }) {
  const [concepts, setConcepts]       = useState([]);
  const [progress, setProgress]       = useState({});
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState("all"); // all | todo | done
  const [search, setSearch]           = useState("");
  const [repoFilter, setRepoFilter]   = useState("all");

  // Load concepts + progress
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api("/concepts").then(d => d.concepts || []).catch(() => []),
      api(`/concepts/progress/${userId}`).then(d => d.progress || {}).catch(() => {}),
    ]).then(([c, p]) => {
      setConcepts(c);
      setProgress(p);
      setLoading(false);
    });
  }, [userId]);

  function markConcept(conceptId, status) {
    setProgress(prev => ({ ...prev, [conceptId]: status }));
    api(`/concepts/${conceptId}/progress`, {
      method: "POST",
      body: JSON.stringify({ developer_id: userId, status }),
    }).catch(() => {});
  }

  function handleAsk(title) {
    if (onAskAI) onAskAI(`Explain "${title}" in detail with examples from the codebase`);
  }

  // Derive repo list
  const repos = ["all", ...Array.from(new Set(concepts.map(c => c.repo).filter(Boolean)))];

  // Filter + search
  const visible = concepts.filter(c => {
    const status = progress[c.id] || "unseen";
    if (filter === "todo" && status === "done") return false;
    if (filter === "done" && status !== "done") return false;
    if (repoFilter !== "all" && c.repo !== repoFilter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())
               && !c.summary?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by difficulty
  const grouped = {
    beginner:     visible.filter(c => c.difficulty === "beginner"),
    intermediate: visible.filter(c => c.difficulty === "intermediate"),
    advanced:     visible.filter(c => c.difficulty === "advanced"),
  };

  return (
    <div style={{ ...s.card, ...style, display: "flex", flexDirection: "column" }}>

      {/* Progress bar */}
      <CheckpointProgress concepts={concepts} progress={progress} />

      {/* Filters */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(6,182,212,0.08)",
        display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search concepts..."
          style={{
            background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
            borderRadius: 7, color: "#e2e8f0", padding: "4px 10px",
            fontSize: 11, outline: "none", fontFamily: "inherit", flex: 1, minWidth: 100,
          }}
        />

        {/* Status filter */}
        {["all", "todo", "done"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            ...s.btn(filter === f ? "primary" : "ghost"),
            padding: "4px 10px", fontSize: 10,
          }}>{f}</button>
        ))}

        {/* Repo filter */}
        {repos.length > 2 && (
          <select
            value={repoFilter}
            onChange={e => setRepoFilter(e.target.value)}
            style={{
              background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
              borderRadius: 7, color: "#94a3b8", padding: "4px 8px",
              fontSize: 10, outline: "none", fontFamily: "inherit",
            }}
          >
            {repos.map(r => <option key={r} value={r}>{r === "all" ? "All repos" : r}</option>)}
          </select>
        )}
      </div>

      {/* Concept list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#475569", fontSize: 12, padding: 24 }}>
            Loading concepts...
          </div>
        ) : concepts.length === 0 ? (
          <div style={{ textAlign: "center", color: "#475569", fontSize: 12,
            padding: 24, lineHeight: 1.7 }}>
            No concepts yet.<br />
            Ask your senior dev to index a repo —<br />concepts are auto-extracted after ingestion.
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", color: "#475569", fontSize: 12, padding: 16 }}>
            No concepts match your filters.
          </div>
        ) : (
          Object.entries(grouped).map(([level, items]) => {
            if (!items.length) return null;
            return (
              <div key={level}>
                <div style={{
                  fontSize: 9, color: "#475569", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 1,
                  padding: "8px 4px 4px",
                }}>
                  {DIFF_ICON[level]} {level} · {items.length}
                </div>
                {items.map(c => (
                  <ConceptCard
                    key={c.id}
                    concept={c}
                    status={progress[c.id] || "unseen"}
                    onMark={markConcept}
                    onAsk={handleAsk}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}