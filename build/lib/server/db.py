from __future__ import annotations

from pathlib import Path

import aiosqlite

from server import config

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    recorded_events TEXT NOT NULL DEFAULT '[]',
    steps TEXT NOT NULL DEFAULT '[]',
    variables TEXT NOT NULL DEFAULT '[]',
    output_schema TEXT NOT NULL DEFAULT '[]',
    workflow_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    sop_id TEXT NOT NULL REFERENCES sops(id),
    params TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    current_step INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 0,
    step_results TEXT NOT NULL DEFAULT '[]',
    output TEXT,
    error TEXT,
    started_at TEXT,
    finished_at TEXT
);
"""


async def get_db() -> aiosqlite.Connection:
    db_path = Path(config.CONSTRUCT_DB)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = await aiosqlite.connect(str(db_path))
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = aiosqlite.Row
    return conn


async def init_db() -> None:
    conn = await get_db()
    try:
        await conn.executescript(_SCHEMA)
        await conn.commit()
    finally:
        await conn.close()
