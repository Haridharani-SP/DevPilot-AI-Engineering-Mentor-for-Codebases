import { useState, useEffect } from "react";

const API_URL =
  typeof window !== "undefined"
    ? window.DEVPILOT_API_URL || "http://localhost:8000"
    : "http://localhost:8000";

async function api(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error("API error");
  return res.json();
}

export default function DevAnalytics({ onSelectUser }) {
  const [users, setUsers] = useState([]);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    api("/auth/users").then(d => setUsers(d.users || [])).catch(()=>{});
    api("/ingest/sources").then(d => setResources(d.sources || [])).catch(()=>{});
  }, []);

  const onboarders = users.filter(u => u.role === "onboarder");

  return (
    <div style={{ padding: 20 }}>
      
      <h2>Developer Analytics</h2>

      {/* Stats Cards */}
      <div style={{ display:"flex", gap:20, marginBottom:30 }}>
        <div style={cardStyle}>
          <h3>{onboarders.length}</h3>
          <p>Total Onboarders</p>
        </div>

        <div style={cardStyle}>
          <h3>{resources.length}</h3>
          <p>Resources Shared</p>
        </div>
      </div>

      {/* Onboarder Cards */}
      <h3>Onboarders</h3>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,200px)", gap:16 }}>
        {onboarders.map(user => (
          <div
            key={user.user_id}
            style={cardStyle}
            onClick={() => onSelectUser(user)}
          >
            <h4>{user.name}</h4>
            <p>{user.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const cardStyle = {
  background:"#0f172a",
  padding:16,
  borderRadius:10,
  border:"1px solid #334155",
  cursor:"pointer"
};