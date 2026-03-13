"""
DevPilot - Auth & User Management
Stores users in the same SQLite DB as the rest of DevPilot.
Passwords are hashed with SHA-256 + salt (swap for bcrypt in production).
"""
import os
import sqlite3
import hashlib
import secrets
import uuid
from datetime import datetime
from typing import Optional, Dict
from pathlib import Path

DB_PATH = os.getenv("DB_PATH", "./devpilot.db")


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_users_table():
    """Create users table and seed a default senior dev account."""
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = _conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      TEXT UNIQUE NOT NULL,
            name         TEXT NOT NULL,
            email        TEXT UNIQUE NOT NULL,
            role         TEXT NOT NULL DEFAULT 'onboarder',  -- 'senior' | 'onboarder'
            team         TEXT,
            password_hash TEXT NOT NULL,
            salt         TEXT NOT NULL,
            created_at   TEXT NOT NULL,
            last_login   TEXT
        );
    """)
    conn.commit()

    # Seed default senior dev if no users exist
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if count == 0:
        _create_user_internal(conn, {
            "name": "Senior Dev",
            "email": "senior@devpilot.ai",
            "role": "senior",
            "team": "Platform",
            "password": "senior123",
        })
        conn.commit()
        print("[DevPilot] Seeded default senior account: senior@devpilot.ai / senior123")

    conn.close()


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def _create_user_internal(conn, data: dict) -> dict:
    salt = secrets.token_hex(16)
    pw_hash = _hash_password(data["password"], salt)
    user_id = f"dev_{data['name'].lower().replace(' ', '_')}_{secrets.token_hex(3)}"
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO users (user_id, name, email, role, team, password_hash, salt, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (user_id, data["name"], data["email"], data.get("role", "onboarder"),
         data.get("team", ""), pw_hash, salt, now)
    )
    return {"user_id": user_id, "name": data["name"], "email": data["email"],
            "role": data.get("role", "onboarder"), "team": data.get("team", "")}


def register_user(name: str, email: str, password: str, role: str = "onboarder", team: str = "") -> Dict:
    conn = _conn()
    # Check duplicate email
    existing = conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
    if existing:
        conn.close()
        raise ValueError(f"Email {email} already registered")
    try:
        user = _create_user_internal(conn, {
            "name": name, "email": email,
            "password": password, "role": role, "team": team
        })
        conn.commit()
        return user
    finally:
        conn.close()


def login_user(email: str, password: str) -> Optional[Dict]:
    conn = _conn()
    row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not row:
        conn.close()
        return None
    expected = _hash_password(password, row["salt"])
    if expected != row["password_hash"]:
        conn.close()
        return None
    # Update last_login
    conn.execute("UPDATE users SET last_login=? WHERE email=?",
                 (datetime.utcnow().isoformat(), email))
    conn.commit()
    conn.close()
    return {
        "id": row["user_id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "team": row["team"],
    }


def list_users() -> list:
    conn = _conn()
    rows = conn.execute(
        "SELECT user_id, name, email, role, team, created_at, last_login FROM users ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_user(user_id: str) -> bool:
    conn = _conn()
    cur = conn.execute("DELETE FROM users WHERE user_id=?", (user_id,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0