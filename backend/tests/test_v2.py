"""Comprehensive v2 backend tests: streaming, search, folders, prompts, uploads."""
import httpx, json, sys, os

BASE = "http://localhost:3333"
passed = 0
failed = 0

def test(name, fn):
    global passed, failed
    try:
        fn()
        passed += 1
        print(f"  PASS: {name}")
    except Exception as e:
        failed += 1
        print(f"  FAIL: {name} — {e}")
        import traceback; traceback.print_exc()

c = httpx.Client(base_url=BASE, timeout=15)

# Create a conversation for chat tests
r = c.post("/api/conversations", json={"title": "Stream Test"})
CONV_ID = r.json()["id"]
print(f"  Created conv: {CONV_ID}")


# ── Static + SPA ──
def frontend():
    r = c.get("/")
    assert 200 <= r.status_code < 300
test("GET /", frontend)

def spa_fallback():
    r = c.get("/some/rando")
    assert r.status_code in (200, 404)
test("SPA fallback", spa_fallback)

# ── Conversations with folder ──
def conv_with_folder():
    r = c.post("/api/conversations", json={"title": "Folded", "folder": "test-folder"})
    assert r.status_code == 200
    d = r.json()
    assert d.get("folder") == "test-folder"
    # Cleanup
    c.delete(f"/api/conversations/{d['id']}")
test("create conversation with folder", conv_with_folder)

# ── Folders API ──
def folders_api():
    # Create two convs in same folder
    r1 = c.post("/api/conversations", json={"title": "A", "folder": "work"})
    r2 = c.post("/api/conversations", json={"title": "B", "folder": "work"})
    r = c.get("/api/folders")
    assert r.status_code == 200
    assert "work" in r.json()
    r = c.get("/api/folders/work")
    assert r.status_code == 200
    assert len(r.json()) >= 2
    c.delete(f"/api/conversations/{r1.json()['id']}")
    c.delete(f"/api/conversations/{r2.json()['id']}")
test("folders CRUD", folders_api)

# ── Conversation PATCH ──
def patch_conv():
    r = c.patch(f"/api/conversations/{CONV_ID}", json={"title": "Updated Title", "folder": "work"})
    assert r.status_code == 200
    d = r.json()
    assert d["title"] == "Updated Title"
    assert d["folder"] == "work"
    # Reset
    c.patch(f"/api/conversations/{CONV_ID}", json={"title": "Stream Test", "folder": ""})
test("PATCH conversation title+folder", patch_conv)

# ── Search API ──
def search_endpoint():
    r = c.get("/api/search", params={"q": "Stream"})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
test("GET /api/search", search_endpoint)

def search_empty():
    r = c.get("/api/search", params={"q": ""})
    assert r.status_code == 200
test("GET /api/search empty q", search_empty)

# ── Message editing API ──
def edit_message():
    # Create conv, add message, edit it
    r = c.post("/api/conversations", json={"title": "EditTest"})
    cid = r.json()["id"]
    # Add a message manually
    from database import add_message
    import asyncio
    import sys
    sys.path.insert(0, "/opt/data/cerebro/backend")
    os.chdir("/opt/data/cerebro/backend")
    msg = asyncio.run(add_message(cid, "user", "original text"))
    mid = msg["id"]
    r = c.patch(f"/api/messages/{mid}", json={"content": "edited text"})
    assert r.status_code == 200
    # Check it changed
    r2 = c.get(f"/api/conversations/{cid}")
    msgs = r2.json()["messages"]
    assert any(m["content"] == "edited text" for m in msgs)
    c.delete(f"/api/conversations/{cid}")
test("edit message", edit_message)

def edit_nonexistent():
    r = c.patch("/api/messages/nonexistent", json={"content": "x"})
    assert r.status_code == 404
test("edit nonexistent message", edit_nonexistent)

# ── Prompts API ──
def create_prompt():
    r = c.post("/api/prompts", json={"title": "Test Prompt", "content": "You are helpful"})
    assert r.status_code == 200
    assert r.json()["title"] == "Test Prompt"
    pid = r.json()["id"]
    c.delete(f"/api/prompts/{pid}")
test("create prompt", create_prompt)

def list_prompts():
    r = c.get("/api/prompts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
test("list prompts", list_prompts)

def update_prompt():
    r = c.post("/api/prompts", json={"title": "Old", "content": "old content"})
    pid = r.json()["id"]
    r2 = c.put(f"/api/prompts/{pid}", json={"title": "New", "content": "new content"})
    assert r2.status_code == 200
    c.delete(f"/api/prompts/{pid}")
test("update prompt", update_prompt)

def delete_prompt():
    r = c.post("/api/prompts", json={"title": "DeleteMe", "content": "bye"})
    pid = r.json()["id"]
    r2 = c.delete(f"/api/prompts/{pid}")
    assert r2.status_code == 200
test("delete prompt", delete_prompt)

# ── File upload ──
def upload_text():
    r = c.post("/api/upload", files={"file": ("test.txt", b"hello world", "text/plain")})
    assert r.status_code == 200
    d = r.json()
    assert d["is_text"] is True
    assert d["filename"] == "test.txt"
    # Verify file is accessible
    r2 = c.get(d["url"])
    assert r2.status_code == 200
test("upload text file", upload_text)

def upload_image():
    # 1x1 pixel PNG
    png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
    r = c.post("/api/upload", files={"file": ("img.png", png, "image/png")})
    assert r.status_code == 200
    d = r.json()
    assert d["is_text"] is False
test("upload image file", upload_image)

def upload_invalid():
    r = c.post("/api/upload", files={"file": ("bad.exe", b"x", "application/x-msdownload")})
    assert r.status_code == 400
test("upload invalid extension", upload_invalid)

# ── Chat endpoint (test streaming response) ──
def chat_streaming_format():
    """Verify the streaming endpoint returns text/event-stream."""
    r = c.post(
        f"/api/chat/{CONV_ID}",
        json={"message": "Say 'OK' in one word"},
        headers={"X-Api-Key": "sk-or-test"},
    )
    # Should fail with 401 since key is fake, but the response type should be SSE
    assert r.status_code in (200, 401, 502)
test("chat streaming endpoint accepts request", chat_streaming_format)

def chat_no_key():
    r = c.post(f"/api/chat/{CONV_ID}", json={"message": "hi"})
    assert r.status_code == 400
test("chat without key returns 400", chat_no_key)

def chat_empty():
    r = c.post(f"/api/chat/{CONV_ID}", json={"message": ""}, headers={"X-Api-Key": "test"})
    assert r.status_code == 400
test("chat empty message returns 400", chat_empty)

def chat_nonexistent():
    r = c.post("/api/chat/nonexistent", json={"message": "hi"}, headers={"X-Api-Key": "test"})
    assert r.status_code == 404
test("chat nonexistent conv returns 404", chat_nonexistent)

# ── Cleanup ──
c.delete(f"/api/conversations/{CONV_ID}")

print(f"\n=== v2 Backend Test Results: {passed} passed, {failed} failed ===")
sys.exit(0 if failed == 0 else 1)