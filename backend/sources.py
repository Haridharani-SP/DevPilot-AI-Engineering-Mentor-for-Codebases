"""
DevPilot - Ingested Sources Registry
Persists indexed sources to SQLite so they survive server restarts.
"""
import os
import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = os.getenv("DB_PATH", "./devpilot.db")


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_sources_table():
    conn = _conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ingested_sources (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            source      TEXT NOT NULL,
            source_type TEXT DEFAULT 'documentation',
            chunks      INTEGER DEFAULT 0,
            project_id  TEXT DEFAULT 'default',
            ingested_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def record_source(title: str, source: str, source_type: str, chunks: int, project_id: str = "default"):
    conn = _conn()
    # Avoid exact duplicates
    existing = conn.execute(
        "SELECT id FROM ingested_sources WHERE source=?", (source,)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE ingested_sources SET chunks=?, ingested_at=? WHERE source=?",
            (chunks, datetime.utcnow().isoformat(), source)
        )
    else:
        conn.execute(
            "INSERT INTO ingested_sources (title, source, source_type, chunks, project_id, ingested_at) VALUES (?,?,?,?,?,?)",
            (title, source, source_type, chunks, project_id, datetime.utcnow().isoformat())
        )
    conn.commit()
    conn.close()


def list_sources():
    conn = _conn()
    rows = conn.execute(
        "SELECT title, source, source_type, chunks, ingested_at FROM ingested_sources ORDER BY ingested_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]