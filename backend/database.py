"""SQLite database layer for conversations, messages, memory, users, and auth."""

import hashlib
import json
import uuid
from datetime import datetime, timezone

import aiosqlite

from config import settings


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(settings.db_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db() -> None:
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New Chat',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                tool_calls TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS memory (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS prompts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key);

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL DEFAULT '',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
        await db.commit()

        # Safe migration: add expires_at column to sessions
        try:
            await db.execute("ALTER TABLE sessions ADD COLUMN expires_at TEXT DEFAULT ''")
            await db.commit()
        except Exception:
            pass

        # Safe migration: add folder column if missing
        try:
            await db.execute("ALTER TABLE conversations ADD COLUMN folder TEXT DEFAULT ''")
            await db.commit()
        except Exception:
            pass

        # Create projects table
        try:
            await db.executescript("""
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    context TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)
            await db.commit()
        except Exception:
            pass

        # Safe migration: add project_id column to conversations
        try:
            await db.execute("ALTER TABLE conversations ADD COLUMN project_id TEXT DEFAULT ''")
            await db.commit()
        except Exception:
            pass

        # Create prompt_presets table
        try:
            await db.executescript("""
                CREATE TABLE IF NOT EXISTS prompt_presets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)
            await db.commit()
        except Exception:
            pass

        # Create documents table
        try:
            await db.executescript("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    project_id TEXT DEFAULT '',
                    title TEXT NOT NULL DEFAULT 'Untitled',
                    content TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)
            await db.commit()
        except Exception:
            pass

        # Create scheduled_tasks table
        try:
            await db.executescript("""
                CREATE TABLE IF NOT EXISTS scheduled_tasks (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    schedule TEXT NOT NULL,
                    model TEXT DEFAULT '',
                    enabled INTEGER DEFAULT 1,
                    last_run TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)
            await db.commit()
        except Exception:
            pass

        # Create FTS5 virtual table with triggers
        try:
            await db.executescript("""
                CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
                    content, content=messages, content_rowid=rowid
                );
                CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
                    INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
                END;
                CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
                    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
                END;
                CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
                    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
                    INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
                END;
                CREATE INDEX IF NOT EXISTS idx_conv_folder ON conversations(folder);
            """)
            await db.commit()
        except Exception:
            pass

    finally:
        await db.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid() -> str:
    return uuid.uuid4().hex[:12]


# ── Conversations ──

async def get_conversations() -> list[dict]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, title, created_at, updated_at, folder FROM conversations ORDER BY updated_at DESC"
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def create_conversation(title: str = "New Chat", folder: str = "") -> dict:
    db = await get_db()
    try:
        now = _now()
        cid = _uid()
        await db.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at, folder) VALUES (?, ?, ?, ?, ?)",
            (cid, title, now, now, folder),
        )
        await db.commit()
        return {"id": cid, "title": title, "folder": folder, "created_at": now, "updated_at": now}
    finally:
        await db.close()


async def get_conversation(cid: str) -> dict | None:
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT id, title, created_at, updated_at, folder FROM conversations WHERE id = ?", (cid,)
        )
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def delete_conversation(cid: str) -> bool:
    db = await get_db()
    try:
        cur = await db.execute("DELETE FROM conversations WHERE id = ?", (cid,))
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


async def update_conversation_title(cid: str, title: str) -> bool:
    db = await get_db()
    try:
        now = _now()
        cur = await db.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, cid),
        )
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


# ── Messages ──

async def add_message(
    conversation_id: str, role: str, content: str, tool_calls: list | None = None
) -> dict:
    db = await get_db()
    try:
        now = _now()
        mid = _uid()
        tc_json = json.dumps(tool_calls) if tool_calls else None
        await db.execute(
            "INSERT INTO messages (id, conversation_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (mid, conversation_id, role, content, tc_json, now),
        )
        await db.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (now, conversation_id),
        )
        await db.commit()
        return {"id": mid, "conversation_id": conversation_id, "role": role, "content": content, "tool_calls": tool_calls, "created_at": now}
    finally:
        await db.close()


async def get_messages(conversation_id: str) -> list[dict]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, conversation_id, role, content, tool_calls, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        )
        result = []
        for r in rows:
            d = dict(r)
            d["tool_calls"] = json.loads(d["tool_calls"]) if d.get("tool_calls") else None
            result.append(d)
        return result
    finally:
        await db.close()


# ── Memory ──

async def get_all_memories() -> list[dict]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, key, content, created_at, updated_at FROM memory ORDER BY updated_at DESC"
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def add_memory(key: str, content: str) -> dict:
    db = await get_db()
    try:
        now = _now()
        mid = _uid()
        await db.execute(
            "INSERT OR REPLACE INTO memory (id, key, content, created_at, updated_at) VALUES (?, ?, ?, COALESCE((SELECT created_at FROM memory WHERE key = ?), ?), ?)",
            (mid, key, content, key, now, now),
        )
        await db.commit()
        return {"key": key, "content": content, "updated_at": now}
    finally:
        await db.close()


async def get_memory(key: str) -> dict | None:
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT id, key, content, created_at, updated_at FROM memory WHERE key = ?", (key,)
        )
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def delete_memory(key: str) -> bool:
    db = await get_db()
    try:
        cur = await db.execute("DELETE FROM memory WHERE key = ?", (key,))
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


# ── Search ──

async def search_conversations(query: str) -> list[dict]:
    """Search conversations by message content and title using FTS5."""
    db = await get_db()
    try:
        # Search messages
        rows = await db.execute_fetchall(
            """SELECT DISTINCT c.id, c.title, c.created_at, c.updated_at, c.folder
               FROM conversations c
               JOIN messages m ON m.conversation_id = c.id
               JOIN messages_fts fts ON fts.rowid = m.rowid
               WHERE messages_fts MATCH ?
               ORDER BY c.updated_at DESC
               LIMIT 50""",
            (query,),
        )
        results = [dict(r) for r in rows]

        # Also search titles with LIKE
        title_rows = await db.execute_fetchall(
            """SELECT id, title, created_at, updated_at, folder
               FROM conversations
               WHERE title LIKE ?
               ORDER BY updated_at DESC
               LIMIT 50""",
            (f"%{query}%",),
        )
        existing_ids = {r["id"] for r in results}
        for r in title_rows:
            if r["id"] not in existing_ids:
                results.append(dict(r))

        return results
    finally:
        await db.close()


# ── Folder operations ──

async def get_folders() -> list[str]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT DISTINCT folder FROM conversations WHERE folder != '' ORDER BY folder"
        )
        return [r["folder"] for r in rows]
    finally:
        await db.close()


async def update_conversation_folder(cid: str, folder: str) -> bool:
    db = await get_db()
    try:
        cur = await db.execute(
            "UPDATE conversations SET folder = ? WHERE id = ?", (folder, cid)
        )
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


async def get_conversations_by_folder(folder: str) -> list[dict]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, title, created_at, updated_at, folder FROM conversations WHERE folder = ? ORDER BY updated_at DESC",
            (folder,),
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ── Message editing ──

async def edit_message(mid: str, content: str) -> bool:
    db = await get_db()
    try:
        now = _now()
        cur = await db.execute(
            "UPDATE messages SET content = ?, created_at = ? WHERE id = ? AND role = 'user'",
            (content, now, mid),
        )
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


async def delete_messages_after(conversation_id: str, after_message_id: str) -> bool:
    """Delete all messages after a given message (for re-submit on edit)."""
    db = await get_db()
    try:
        # Get the timestamp of the anchor message
        cur = await db.execute(
            "SELECT created_at FROM messages WHERE id = ? AND conversation_id = ?",
            (after_message_id, conversation_id),
        )
        row = await cur.fetchone()
        if not row:
            return False
        ts = row["created_at"]
        await db.execute(
            "DELETE FROM messages WHERE conversation_id = ? AND created_at > ?",
            (conversation_id, ts),
        )
        await db.commit()
        return True
    finally:
        await db.close()


# ── Prompts ──

async def get_prompts() -> list[dict]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, title, content, created_at, updated_at FROM prompts ORDER BY title ASC"
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def create_prompt(title: str, content: str) -> dict:
    db = await get_db()
    try:
        now = _now()
        pid = _uid()
        await db.execute(
            "INSERT INTO prompts (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (pid, title, content, now, now),
        )
        await db.commit()
        return {"id": pid, "title": title, "content": content, "created_at": now, "updated_at": now}
    finally:
        await db.close()


async def update_prompt(pid: str, title: str, content: str) -> bool:
    db = await get_db()
    try:
        now = _now()
        cur = await db.execute(
            "UPDATE prompts SET title = ?, content = ?, updated_at = ? WHERE id = ?",
            (title, content, now, pid),
        )
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


async def delete_prompt(pid: str) -> bool:
    db = await get_db()
    try:
        cur = await db.execute("DELETE FROM prompts WHERE id = ?", (pid,))
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


# ── Auth ──

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


async def count_users() -> int:
    db = await get_db()
    try:
        cur = await db.execute("SELECT COUNT(*) as cnt FROM users")
        row = await cur.fetchone()
        return row["cnt"] if row else 0
    finally:
        await db.close()


async def create_user(username: str, display_name: str, password: str) -> dict:
    db = await get_db()
    try:
        uid = _uid()
        now = _now()
        pwh = _hash_password(password)
        await db.execute(
            "INSERT INTO users (id, username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (uid, username, display_name, pwh, now),
        )
        await db.commit()
        return {"id": uid, "username": username, "display_name": display_name, "created_at": now}
    finally:
        await db.close()


async def get_user_by_username(username: str) -> dict | None:
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT id, username, display_name, password_hash, created_at FROM users WHERE username = ?",
            (username,),
        )
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def get_user_by_id(uid: str) -> dict | None:
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT id, username, display_name, created_at FROM users WHERE id = ?",
            (uid,),
        )
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def create_session(user_id: str) -> str:
    db = await get_db()
    try:
        token = uuid.uuid4().hex
        now = _now()
        from datetime import timedelta
        expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        await db.execute(
            "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, now, expires_at),
        )
        await db.commit()
        return token
    finally:
        await db.close()


async def get_session(token: str) -> dict | None:
    """Return the session row with user data joined, or None."""
    db = await get_db()
    try:
        cur = await db.execute(
            """SELECT s.id as session_id, s.user_id, s.created_at as session_created_at,
                      u.id, u.username, u.display_name, u.created_at
               FROM sessions s
               JOIN users u ON u.id = s.user_id
               WHERE s.id = ? AND (s.expires_at = '' OR s.expires_at > ?)""",
            (token, _now()),
        )
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def delete_session(token: str) -> bool:
    db = await get_db()
    try:
        cur = await db.execute("DELETE FROM sessions WHERE id = ?", (token,))
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


async def verify_password(username: str, password: str) -> dict | None:
    """Return user dict if password matches, else None."""
    user = await get_user_by_username(username)
    if not user:
        return None
    if user["password_hash"] != _hash_password(password):
        return None
    return {"id": user["id"], "username": user["username"], "display_name": user["display_name"], "created_at": user["created_at"]}


async def update_password(user_id: str, current_password: str, new_password: str) -> bool:
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT password_hash FROM users WHERE id = ?", (user_id,)
        )
        row = await cur.fetchone()
        if not row or row["password_hash"] != _hash_password(current_password):
            return False
        await db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (_hash_password(new_password), user_id),
        )
        await db.commit()
        return True
    finally:
        await db.close()


# ── Projects ──

async def get_projects() -> list[dict]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT p.*, (SELECT COUNT(*) FROM conversations c WHERE c.project_id = p.id AND c.project_id != '') as conv_count FROM projects p ORDER BY p.updated_at DESC"
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()

async def create_project(name: str, description: str = "", context: str = "") -> dict:
    db = await get_db()
    try:
        now = _now()
        pid = _uid()
        await db.execute(
            "INSERT INTO projects (id, name, description, context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (pid, name, description, context, now, now),
        )
        await db.commit()
        return {"id": pid, "name": name, "description": description, "context": context, "conv_count": 0, "created_at": now, "updated_at": now}
    finally:
        await db.close()

async def get_project(pid: str) -> dict | None:
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT p.*, (SELECT COUNT(*) FROM conversations c WHERE c.project_id = p.id) as conv_count FROM projects p WHERE p.id = ?", (pid,)
        )
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()

async def update_project(pid: str, name: str | None = None, description: str | None = None, context: str | None = None) -> bool:
    db = await get_db()
    try:
        now = _now()
        updates = []
        params = []
        if name is not None:
            updates.append("name = ?"); params.append(name)
        if description is not None:
            updates.append("description = ?"); params.append(description)
        if context is not None:
            updates.append("context = ?"); params.append(context)
        if not updates:
            return False
        updates.append("updated_at = ?"); params.append(now)
        params.append(pid)
        cur = await db.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()

async def delete_project(pid: str) -> bool:
    db = await get_db()
    try:
        # Remove project_id from conversations in this project
        await db.execute("UPDATE conversations SET project_id = '' WHERE project_id = ?", (pid,))
        cur = await db.execute("DELETE FROM projects WHERE id = ?", (pid,))
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()

async def get_conversations_by_project(pid: str) -> list[dict]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE project_id = ? ORDER BY updated_at DESC",
            (pid,),
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ── Documents ──

async def get_documents(project_id: str = "") -> list[dict]:
    db = await get_db()
    try:
        if project_id:
            rows = await db.execute_fetchall(
                "SELECT id, project_id, title, created_at, updated_at FROM documents WHERE project_id = ? ORDER BY updated_at DESC",
                (project_id,),
            )
        else:
            rows = await db.execute_fetchall(
                "SELECT id, project_id, title, created_at, updated_at FROM documents ORDER BY updated_at DESC"
            )
        return [dict(r) for r in rows]
    finally:
        await db.close()

async def create_document(project_id: str, title: str = "Untitled", content: str = "") -> dict:
    db = await get_db()
    try:
        now = _now()
        did = _uid()
        await db.execute(
            "INSERT INTO documents (id, project_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (did, project_id, title, content, now, now),
        )
        await db.commit()
        return {"id": did, "project_id": project_id, "title": title, "content": content, "created_at": now, "updated_at": now}
    finally:
        await db.close()

async def get_document(did: str) -> dict | None:
    db = await get_db()
    try:
        cur = await db.execute("SELECT * FROM documents WHERE id = ?", (did,))
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()

async def update_document(did: str, title: str | None = None, content: str | None = None) -> bool:
    db = await get_db()
    try:
        now = _now()
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?"); params.append(title)
        if content is not None:
            updates.append("content = ?"); params.append(content)
        if not updates:
            return False
        updates.append("updated_at = ?"); params.append(now)
        params.append(did)
        cur = await db.execute(f"UPDATE documents SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()

async def delete_document(did: str) -> bool:
    db = await get_db()
    try:
        cur = await db.execute("DELETE FROM documents WHERE id = ?", (did,))
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


# ── Scheduled Tasks ──

async def get_all_scheduled_tasks() -> list[dict]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, name, prompt, schedule, model, enabled, last_run, created_at, updated_at FROM scheduled_tasks ORDER BY created_at DESC"
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()

async def get_scheduled_task(task_id: str) -> dict | None:
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT id, name, prompt, schedule, model, enabled, last_run, created_at, updated_at FROM scheduled_tasks WHERE id = ?",
            (task_id,),
        )
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()

async def create_scheduled_task(name: str, prompt: str, schedule: str, model: str = "") -> dict:
    db = await get_db()
    try:
        now = _now()
        tid = _uid()
        await db.execute(
            "INSERT INTO scheduled_tasks (id, name, prompt, schedule, model, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
            (tid, name, prompt, schedule, model, now, now),
        )
        await db.commit()
        return {"id": tid, "name": name, "prompt": prompt, "schedule": schedule, "model": model, "enabled": 1, "last_run": None, "created_at": now, "updated_at": now}
    finally:
        await db.close()

async def update_scheduled_task(task_id: str, name: str | None = None, prompt: str | None = None, schedule: str | None = None, model: str | None = None, enabled: bool | None = None) -> bool:
    db = await get_db()
    try:
        now = _now()
        updates = []
        params = []
        if name is not None:
            updates.append("name = ?"); params.append(name)
        if prompt is not None:
            updates.append("prompt = ?"); params.append(prompt)
        if schedule is not None:
            updates.append("schedule = ?"); params.append(schedule)
        if model is not None:
            updates.append("model = ?"); params.append(model)
        if enabled is not None:
            updates.append("enabled = ?"); params.append(1 if enabled else 0)
        if not updates:
            return False
        updates.append("updated_at = ?"); params.append(now)
        params.append(task_id)
        cur = await db.execute(f"UPDATE scheduled_tasks SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()

async def delete_scheduled_task(task_id: str) -> bool:
    db = await get_db()
    try:
        cur = await db.execute("DELETE FROM scheduled_tasks WHERE id = ?", (task_id,))
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


# ── Prompt Presets ──

async def get_prompt_presets() -> list[dict]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, name, content, created_at, updated_at FROM prompt_presets ORDER BY name ASC"
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()

async def create_prompt_preset(name: str, content: str) -> dict:
    db = await get_db()
    try:
        now = _now()
        pid = _uid()
        await db.execute(
            "INSERT INTO prompt_presets (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (pid, name, content, now, now),
        )
        await db.commit()
        return {"id": pid, "name": name, "content": content, "created_at": now, "updated_at": now}
    finally:
        await db.close()

async def update_prompt_preset(pid: str, name: str, content: str) -> bool:
    db = await get_db()
    try:
        now = _now()
        cur = await db.execute(
            "UPDATE prompt_presets SET name = ?, content = ?, updated_at = ? WHERE id = ?",
            (name, content, now, pid),
        )
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()

async def delete_prompt_preset(pid: str) -> bool:
    db = await get_db()
    try:
        cur = await db.execute("DELETE FROM prompt_presets WHERE id = ?", (pid,))
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


# ── Conversation Export ──

async def get_conversation_with_messages(cid: str) -> dict | None:
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT id, title, created_at, updated_at, folder FROM conversations WHERE id = ?", (cid,)
        )
        conv_row = await cur.fetchone()
        if not conv_row:
            return None
        conv = dict(conv_row)
        rows = await db.execute_fetchall(
            "SELECT id, role, content, tool_calls, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (cid,),
        )
        messages = []
        for r in rows:
            d = dict(r)
            d["tool_calls"] = json.loads(d["tool_calls"]) if d.get("tool_calls") else None
            messages.append(d)
        return {"conversation": conv, "messages": messages}
    finally:
        await db.close()
