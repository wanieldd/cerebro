"""FastAPI application for Cerebro — streaming, search, folders, prompts, files."""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

import database as db
from agent import stream_agent
from config import settings
from llm_client import LLMClient, OPENROUTER_BASE


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    os.makedirs(str(UPLOAD_DIR), exist_ok=True)
    from cron import start_scheduler, load_tasks
    start_scheduler()
    await load_tasks()
    yield


app = FastAPI(title="Cerebro", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request Models ──

class ChatRequest(BaseModel):
    message: str
    reasoning_effort: str | None = None
    scope: str | None = None
    auto_title: bool | None = None
    auto_memory: bool | None = None
    system_prompt: str | None = None

class CreateConversationRequest(BaseModel):
    title: str | None = None
    folder: str | None = None

class ValidateKeyRequest(BaseModel):
    key: str

class MemoryRequest(BaseModel):
    key: str
    content: str

class EditMessageRequest(BaseModel):
    content: str

class CreatePromptRequest(BaseModel):
    title: str
    content: str

class UpdatePromptRequest(BaseModel):
    title: str
    content: str

class UpdateFolderRequest(BaseModel):
    folder: str

class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None
    context: str | None = None

class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    context: str | None = None

class CreateDocumentRequest(BaseModel):
    project_id: str | None = None
    title: str | None = None
    content: str | None = None

class UpdateDocumentRequest(BaseModel):
    title: str | None = None
    content: str | None = None

class SearchRequest(BaseModel):
    q: str

class SignupRequest(BaseModel):
    username: str
    display_name: str
    password: str

class SigninRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ResearchRequest(BaseModel):
    query: str
    depth: str | None = "quick"

class CreateTaskRequest(BaseModel):
    name: str
    prompt: str
    schedule: str
    model: str | None = None

class UpdateTaskRequest(BaseModel):
    name: str | None = None
    prompt: str | None = None
    schedule: str | None = None
    model: str | None = None
    enabled: bool | None = None


# ── Helper ──

UPLOAD_DIR = Path(settings.db_path).parent / "uploads"
os.makedirs(str(UPLOAD_DIR), exist_ok=True)

def get_api_key(request: Request) -> str:
    key = request.headers.get("x-api-key") or request.headers.get("X-Api-Key")
    if not key:
        raise HTTPException(status_code=400, detail="X-Api-Key header required")
    return key


# ── Chat (Streaming) ──

@app.post("/api/chat/{conversation_id}")
async def chat_stream(conversation_id: str, body: ChatRequest, request: Request):
    api_key = get_api_key(request)
    model = request.headers.get("x-model")
    image_model = request.headers.get("x-image-model") or request.headers.get("X-Image-Model")

    # Build base URL from the request for resolving image URLs
    forwarded = request.headers.get("x-forwarded-proto", "http")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost:3333")
    base_url = f"{forwarded}://{host}"

    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    conv = await db.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    async def event_stream():
        async for event in stream_agent(
            conversation_id,
            body.message,
            api_key,
            model=model,
            image_model=image_model,
            base_url=base_url,
            reasoning_effort=body.reasoning_effort,
            scope=body.scope,
            auto_title=body.auto_title,
            auto_memory=body.auto_memory,
            system_prompt=body.system_prompt,
        ):
            yield json.dumps(event) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/api/chat/{conversation_id}/resubmit")
async def chat_resubmit(conversation_id: str, body: EditMessageRequest, request: Request):
    """Edit a user message and regenerate the assistant response."""
    api_key = get_api_key(request)
    model = request.headers.get("x-model")
    image_model = request.headers.get("x-image-model") or request.headers.get("X-Image-Model")

    forwarded = request.headers.get("x-forwarded-proto", "http")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost:3333")
    base_url = f"{forwarded}://{host}"

    conv = await db.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete the last user message and all after it, then re-insert
    msgs = await db.get_messages(conversation_id)
    if not msgs:
        raise HTTPException(status_code=400, detail="No messages to resubmit")

    last_user = None
    for m in reversed(msgs):
        if m["role"] == "user":
            last_user = m
            break

    if not last_user:
        raise HTTPException(status_code=400, detail="No user message to resubmit")

    # Delete messages after this one
    await db.delete_messages_after(conversation_id, last_user["id"])
    # Re-insert with new content
    await db.add_message(conversation_id, "user", body.content)

    async def event_stream():
        async for event in stream_agent(
            conversation_id,
            body.content,
            api_key,
            model=model,
            image_model=image_model,
            base_url=base_url,
        ):
            yield json.dumps(event) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/chat/{conversation_id}/regenerate")
async def chat_regenerate(conversation_id: str, request: Request):
    """Regenerate the last assistant response without editing the user message."""
    api_key = get_api_key(request)
    model = request.headers.get("x-model")
    image_model = request.headers.get("x-image-model") or request.headers.get("X-Image-Model")

    forwarded = request.headers.get("x-forwarded-proto", "http")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost:3333")
    base_url = f"{forwarded}://{host}"

    conv = await db.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = await db.get_messages(conversation_id)
    if not msgs:
        raise HTTPException(status_code=400, detail="No messages to regenerate from")

    # Find last user message
    last_user = None
    for m in reversed(msgs):
        if m["role"] == "user":
            last_user = m
            break

    if not last_user:
        raise HTTPException(status_code=400, detail="No user message to regenerate from")

    # Delete all messages after the last user message
    await db.delete_messages_after(conversation_id, last_user["id"])

    async def event_stream():
        async for event in stream_agent(
            conversation_id,
            last_user["content"],
            api_key,
            model=model,
            image_model=image_model,
            base_url=base_url,
        ):
            yield json.dumps(event) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Conversation Export ──

@app.get("/api/conversations/{conversation_id}/export")
async def export_conversation(conversation_id: str, fmt: str = "json"):
    """Export a conversation as JSON or Markdown."""
    data = await db.get_conversation_with_messages(conversation_id)
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv = data["conversation"]
    messages = data["messages"]

    if fmt == "md":
        lines = [f"# {conv['title']}", f"", f"*Exported: {conv['updated_at']}*", f"", "---", ""]
        for m in messages:
            role_label = "**You**" if m["role"] == "user" else "**Assistant**" if m["role"] == "assistant" else f"**{m['role']}**"
            lines.append(f"### {role_label}")
            lines.append("")
            if m["content"]:
                lines.append(m["content"])
                lines.append("")
            if m.get("tool_calls"):
                for tc in m["tool_calls"]:
                    fname = tc.get("function", {}).get("name", "unknown")
                    lines.append(f"> _Tool call: {fname}_")
                    lines.append("")
        content = "\n".join(lines)
        return Response(content=content, media_type="text/markdown",
                        headers={"Content-Disposition": f'attachment; filename="{conv["title"]}.md"'})
    else:
        return JSONResponse(content=data)


# ── Prompt Presets ──

@app.get("/api/prompt-presets")
async def list_prompt_presets():
    return await db.get_prompt_presets()

class CreatePromptPresetRequest(BaseModel):
    name: str
    content: str = ""

class UpdatePromptPresetRequest(BaseModel):
    name: str
    content: str = ""

@app.post("/api/prompt-presets")
async def new_prompt_preset(body: CreatePromptPresetRequest):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    return await db.create_prompt_preset(body.name.strip(), body.content)

@app.put("/api/prompt-presets/{pid}")
async def update_prompt_preset(pid: str, body: UpdatePromptPresetRequest):
    ok = await db.update_prompt_preset(pid, body.name.strip(), body.content)
    if not ok:
        raise HTTPException(status_code=404, detail="Prompt preset not found")
    return {"updated": True}

@app.delete("/api/prompt-presets/{pid}")
async def delete_prompt_preset(pid: str):
    ok = await db.delete_prompt_preset(pid)
    if not ok:
        raise HTTPException(status_code=404, detail="Prompt preset not found")
    return {"deleted": True}


# ── Token Count (approximate) ──

@app.get("/api/conversations/{conversation_id}/tokens")
async def count_conversation_tokens(conversation_id: str):
    """Rough token estimate (len/4) for context indicator."""
    messages = await db.get_messages(conversation_id)
    total_chars = sum(len(m.get("content", "")) for m in messages)
    # Rough estimate: ~4 chars per token
    total_tokens = total_chars // 4
    # Count per role
    by_role = {"user": 0, "assistant": 0, "tool": 0, "system": 0}
    for m in messages:
        by_role[m["role"]] += len(m.get("content", "")) // 4
    return {"total_tokens": total_tokens, "message_count": len(messages), "by_role": by_role}

@app.post("/api/research")
async def run_research(body: ResearchRequest, request: Request):
    api_key = get_api_key(request)
    model = request.headers.get("x-model")

    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Research query is required")

    async def event_stream():
        from research_agent import run_research as do_research
        async for event in do_research(body.query, api_key, model=model, depth=body.depth or "quick"):
            yield json.dumps(event) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Conversations ──

@app.get("/api/conversations")
async def list_conversations():
    return await db.get_conversations()

@app.post("/api/conversations")
async def new_conversation(body: CreateConversationRequest):
    return await db.create_conversation(
        body.title or "New Chat",
        folder=body.folder or "",
    )

@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    conv = await db.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = await db.get_messages(conversation_id)
    return {"conversation": conv, "messages": messages}

@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    ok = await db.delete_conversation(conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True}

@app.patch("/api/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, body: CreateConversationRequest):
    """Update conversation title and/or folder."""
    conv = await db.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if body.title:
        await db.update_conversation_title(conversation_id, body.title)
    if body.folder is not None:
        await db.update_conversation_folder(conversation_id, body.folder)
    return await db.get_conversation(conversation_id)


# ── Search ──

@app.get("/api/search")
async def search_conversations(q: str = ""):
    if not q.strip():
        return await db.get_conversations()
    return await db.search_conversations(q.strip())


# ── Folders ──

@app.get("/api/folders")
async def list_folders():
    return await db.get_folders()

@app.get("/api/folders/{folder}")
async def get_folder(folder: str):
    return await db.get_conversations_by_folder(folder)


# ── Projects ──

@app.get("/api/projects")
async def list_projects():
    return await db.get_projects()

@app.post("/api/projects")
async def new_project(body: CreateProjectRequest):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Project name is required")
    return await db.create_project(body.name.strip(), (body.description or "").strip(), (body.context or "").strip())

@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    convs = await db.get_conversations_by_project(project_id)
    return {"project": project, "conversations": convs}

@app.patch("/api/projects/{project_id}")
async def update_project(project_id: str, body: UpdateProjectRequest):
    ok = await db.update_project(project_id, name=body.name, description=body.description, context=body.context)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return await db.get_project(project_id)

@app.delete("/api/projects/{project_id}")
async def remove_project(project_id: str):
    ok = await db.delete_project(project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True}


# ── Documents ──

@app.get("/api/documents")
async def list_documents(project_id: str = ""):
    return await db.get_documents(project_id)

@app.post("/api/documents")
async def new_document(body: CreateDocumentRequest):
    return await db.create_document(
        body.project_id or "",
        body.title or "Untitled",
        body.content or "",
    )

@app.get("/api/documents/{doc_id}")
async def get_document(doc_id: str):
    doc = await db.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@app.put("/api/documents/{doc_id}")
async def update_document(doc_id: str, body: UpdateDocumentRequest):
    ok = await db.update_document(doc_id, title=body.title, content=body.content)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return await db.get_document(doc_id)

@app.delete("/api/documents/{doc_id}")
async def remove_document(doc_id: str):
    ok = await db.delete_document(doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": True}


# ── Messages ──

@app.patch("/api/messages/{message_id}")
async def edit_message(message_id: str, body: EditMessageRequest):
    ok = await db.edit_message(message_id, body.content)
    if not ok:
        raise HTTPException(status_code=404, detail="Message not found or not editable")
    return {"updated": True}


# ── Models ──

@app.get("/api/models")
async def list_models(request: Request):
    key = get_api_key(request)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{OPENROUTER_BASE}/models",
                headers={"Authorization": f"Bearer {key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            models = [
                {
                    "id": m["id"],
                    "name": m.get("name", m["id"]),
                    "pricing": m.get("pricing", {}),
                    "context_length": m.get("context_length", 0),
                }
                for m in data.get("data", [])
            ]
            models.sort(key=lambda x: x["id"])
            return models
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch models: {e}")


# ── Validation ──

@app.post("/api/validate-key")
async def validate_key(body: ValidateKeyRequest):
    client = LLMClient(body.key)
    valid = await client.validate_key()
    return {"valid": valid}


# ── Memory ──

@app.get("/api/memories")
async def list_memories():
    return await db.get_all_memories()

@app.post("/api/memories")
async def create_memory(body: MemoryRequest):
    return await db.add_memory(body.key, body.content)

@app.delete("/api/memories/{key}")
async def remove_memory(key: str):
    ok = await db.delete_memory(key)
    if not ok:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"deleted": True}


# ── Prompts ──

@app.get("/api/prompts")
async def list_prompts():
    return await db.get_prompts()

@app.post("/api/prompts")
async def create_prompt(body: CreatePromptRequest):
    return await db.create_prompt(body.title, body.content)

@app.put("/api/prompts/{pid}")
async def update_prompt(pid: str, body: UpdatePromptRequest):
    ok = await db.update_prompt(pid, body.title, body.content)
    if not ok:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"updated": True}

@app.delete("/api/prompts/{pid}")
async def delete_prompt(pid: str):
    ok = await db.delete_prompt(pid)
    if not ok:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"deleted": True}


# ── Scheduled Tasks ──

@app.get("/api/scheduled-tasks")
async def list_tasks():
    return await db.get_all_scheduled_tasks()

@app.post("/api/scheduled-tasks")
async def new_task(body: CreateTaskRequest):
    if not body.name.strip() or not body.prompt.strip() or not body.schedule.strip():
        raise HTTPException(status_code=400, detail="name, prompt, and schedule are required")
    task = await db.create_scheduled_task(body.name.strip(), body.prompt.strip(), body.schedule.strip(), body.model or "")
    from cron import schedule_task
    schedule_task(task)
    return task

@app.delete("/api/scheduled-tasks/{task_id}")
async def remove_task(task_id: str):
    ok = await db.delete_scheduled_task(task_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Task not found")
    from cron import remove_scheduled_task
    remove_scheduled_task(task_id)
    return {"deleted": True}

@app.post("/api/scheduled-tasks/{task_id}/run")
async def run_task_now(task_id: str):
    task = await db.get_scheduled_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    from cron import execute_scheduled_task
    await execute_scheduled_task(task_id)
    return {"ran": True}


# ── Auth routes ──

@app.get("/api/auth/status")
async def auth_status(request: Request):
    """Return whether users exist and if the current session is valid."""
    has_users = await db.count_users() > 0
    session_token = request.headers.get("x-session-token") or request.headers.get("X-Session-Token")
    authenticated = False
    user = None
    if session_token:
        session = await db.get_session(session_token)
        if session:
            authenticated = True
            user = {
                "id": session["id"],
                "username": session["username"],
                "display_name": session["display_name"],
                "created_at": session["created_at"],
            }
    return {"has_users": has_users, "authenticated": authenticated, "user": user}


@app.post("/api/auth/signup")
async def auth_signup(body: SignupRequest):
    if len(body.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    existing = await db.get_user_by_username(body.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    user = await db.create_user(body.username.strip(), body.display_name.strip() or body.username.strip(), body.password)
    token = await db.create_session(user["id"])
    return {"user": user, "session_token": token}


@app.post("/api/auth/signin")
async def auth_signin(body: SigninRequest):
    user = await db.verify_password(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = await db.create_session(user["id"])
    return {"user": user, "session_token": token}


@app.post("/api/auth/signout")
async def auth_signout(request: Request):
    session_token = request.headers.get("x-session-token") or request.headers.get("X-Session-Token")
    if session_token:
        await db.delete_session(session_token)
    return {"ok": True}


@app.post("/api/auth/change-password")
async def auth_change_password(body: ChangePasswordRequest, request: Request):
    session_token = request.headers.get("x-session-token") or request.headers.get("X-Session-Token")
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.get_session(session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    ok = await db.update_password(session["user_id"], body.current_password, body.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    return {"ok": True}


# ── File Upload ──

ALLOWED_EXTENSIONS = {".txt", ".md", ".py", ".js", ".ts", ".jsx", ".tsx", ".json", ".csv",
                      ".html", ".css", ".yaml", ".yml", ".toml", ".xml", ".sh", ".env",
                      ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".pdf"}

@app.post("/api/upload")
async def upload_file(file: UploadFile):
    ext = Path(file.filename or "file").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed")

    filepath = UPLOAD_DIR / f"{db._uid()}{ext}"
    content = await file.read()

    # For text files, read as text
    text_extensions = {".txt", ".md", ".py", ".js", ".ts", ".jsx", ".tsx", ".json", ".csv",
                       ".html", ".css", ".yaml", ".yml", ".toml", ".xml", ".sh"}
    is_text = ext in text_extensions

    with open(filepath, "wb") as f:
        f.write(content)

    return {
        "url": f"/uploads/{filepath.name}",
        "filename": file.filename,
        "size": len(content),
        "is_text": is_text,
        "ext": ext,
    }


# ── Version ──

VERSION = "1.0.0"

@app.get("/api/version")
async def get_version():
    return {"version": VERSION, "name": "Cerebro", "repo": "https://github.com/wanieldd/cerebro"}


# ── Static Files ──

STATIC_DIR = Path(settings.static_dir)
UPLOAD_URL = Path(settings.db_path).parent / "uploads"

@app.get("/uploads/{filename}")
async def serve_upload(filename: str):
    file_path = UPLOAD_URL / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path))

@app.get("/")
@app.get("/{path:path}")
async def serve_frontend(path: str = ""):
    index_path = STATIC_DIR / "index.html"
    file_path = STATIC_DIR / path

    # Don't interfere with API routes
    if path.startswith("api/") or path.startswith("uploads/"):
        raise HTTPException(status_code=404)

    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "message": "Cerebro backend is running. Build the frontend with 'npm run build' in frontend/.",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3333, reload=True)
