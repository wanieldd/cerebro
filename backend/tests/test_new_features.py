"""Test all new features: projects, documents, math, research, scheduled tasks, opencode tool."""
import httpx, json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from _key import API_KEY
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
        print(f"  FAIL: {name} -- {e}")

c = httpx.Client(base_url=BASE, timeout=30)

# ── 1. Projects CRUD ──
def projects_list_empty():
    r = c.get("/api/projects")
    assert r.status_code == 200
    assert r.json() == []
test("GET /api/projects returns empty", projects_list_empty)

def create_project():
    r = c.post("/api/projects", json={"name": "Test Project", "description": "A test"})
    assert r.status_code == 200
    d = r.json()
    assert d["name"] == "Test Project"
    assert d["description"] == "A test"
    global PROJECT_ID
    PROJECT_ID = d["id"]
test("POST /api/projects creates project", create_project)

def create_project_no_name():
    r = c.post("/api/projects", json={"name": ""})
    assert r.status_code == 400
test("POST /api/projects empty name returns 400", create_project_no_name)

def get_project():
    r = c.get(f"/api/projects/{PROJECT_ID}")
    assert r.status_code == 200
    d = r.json()
    assert d["project"]["name"] == "Test Project"
    assert "conversations" in d
test("GET /api/projects/:id returns project+convos", get_project)

def get_nonexistent_project():
    r = c.get("/api/projects/nonexistent")
    assert r.status_code == 404
test("GET /api/projects/:id nonexistent 404", get_nonexistent_project)

def update_project():
    r = c.patch(f"/api/projects/{PROJECT_ID}", json={"name": "Updated", "description": "Updated desc"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated"
test("PATCH /api/projects/:id updates project", update_project)

def delete_project():
    r = c.post("/api/projects", json={"name": "Delete Me"})
    pid = r.json()["id"]
    r2 = c.delete(f"/api/projects/{pid}")
    assert r2.status_code == 200
    r3 = c.get(f"/api/projects/{pid}")
    assert r3.status_code == 404
test("DELETE /api/projects/:id removes project", delete_project)

# ── 2. Documents CRUD ──
DOC_PROJECT_ID = None
def create_document():
    r = c.post("/api/documents", json={"title": "Test Doc", "content": "Hello!"})
    assert r.status_code == 200
    d = r.json()
    assert d["title"] == "Test Doc"
    global DOC_ID
    DOC_ID = d["id"]
test("POST /api/documents creates document", create_document)

def list_documents():
    r = c.get("/api/documents")
    assert r.status_code == 200
    assert len(r.json()) >= 1
test("GET /api/documents returns list", list_documents)

def get_document():
    r = c.get(f"/api/documents/{DOC_ID}")
    assert r.status_code == 200
    assert r.json()["content"] == "Hello!"
test("GET /api/documents/:id returns content", get_document)

def update_document():
    r = c.put(f"/api/documents/{DOC_ID}", json={"content": "Updated content"})
    assert r.status_code == 200
    assert r.json()["content"] == "Updated content"
test("PUT /api/documents/:id updates content", update_document)

def delete_document():
    r = c.post("/api/documents", json={"title": "Delete Me"})
    did = r.json()["id"]
    r2 = c.delete(f"/api/documents/{did}")
    assert r2.status_code == 200
test("DELETE /api/documents/:id removes doc", delete_document)

# ── 3. Math tool (direct import test) ──
def math_tool_imports():
    import sys as _sys
    _sys.path.insert(0, "/opt/data/cerebro/backend")
    from tools.math_tool import MathTool
    mt = MathTool()
    assert mt.name == "math_solve"
test("MathTool imports and has correct name", math_tool_imports)

def math_tool_integral():
    import sys as _sys
    _sys.path.insert(0, "/opt/data/cerebro/backend")
    from tools.math_tool import MathTool
    mt = MathTool()
    import asyncio
    result = asyncio.run(mt.execute(expression="integrate(x**2, x)"))
    assert "x**3" in result or "x^3" in result or "3" in result
    print(f"    Integral result: {result[:100]}")
test("MathTool solves integral", math_tool_integral)

def math_tool_derivative():
    import sys as _sys
    _sys.path.insert(0, "/opt/data/cerebro/backend")
    from tools.math_tool import MathTool
    mt = MathTool()
    import asyncio
    result = asyncio.run(mt.execute(expression="diff(sin(x), x)"))
    assert "cos" in result
    print(f"    Derivative result: {result[:100]}")
test("MathTool solves derivative", math_tool_derivative)

# ── 4. Tools registry ──
def tools_registry():
    import sys as _sys
    _sys.path.insert(0, "/opt/data/cerebro/backend")
    from tools.registry import get_all_tools
    names = [t.name for t in get_all_tools()]
    assert "math_solve" in names
    assert "dispatch_opencode" in names
    print(f"    Tools: {names}")
test("Tools registry includes math_solve and dispatch_opencode", tools_registry)

# ── 5. Scheduled tasks API ──
def scheduled_tasks_empty():
    r = c.get("/api/scheduled-tasks")
    assert r.status_code == 200
    assert r.json() == []
test("GET /api/scheduled-tasks returns empty", scheduled_tasks_empty)

def create_scheduled_task():
    r = c.post("/api/scheduled-tasks", json={
        "name": "Test Task", "prompt": "Say hi", "schedule": "0 9 * * *"
    })
    assert r.status_code == 200
    d = r.json()
    assert d["name"] == "Test Task"
    global TASK_ID
    TASK_ID = d["id"]
test("POST /api/scheduled-tasks creates task", create_scheduled_task)

def create_task_no_name():
    r = c.post("/api/scheduled-tasks", json={"name": "", "prompt": "", "schedule": ""})
    assert r.status_code == 400
test("POST /api/scheduled-tasks empty fields 400", create_task_no_name)

def delete_scheduled_task():
    r = c.delete(f"/api/scheduled-tasks/{TASK_ID}")
    assert r.status_code == 200
test("DELETE /api/scheduled-tasks/:id removes task", delete_scheduled_task)

# ── 6. Research endpoint ──
def research_no_key():
    r = c.post("/api/research", json={"query": "test"})
    assert r.status_code == 400
test("POST /api/research without key returns 400", research_no_key)

def research_empty_query():
    r = c.post("/api/research", json={"query": ""}, headers={"X-Api-Key": "test"})
    assert r.status_code == 400
test("POST /api/research empty query returns 400", research_empty_query)

# ── 7. OpenCode dispatch tool ──
def opencode_tool_imports():
    import sys as _sys
    _sys.path.insert(0, "/opt/data/cerebro/backend")
    from tools.opencode_tool import OpenCodeTool
    ot = OpenCodeTool()
    assert ot.name == "dispatch_opencode"
test("OpenCodeTool imports and has correct name", opencode_tool_imports)

# ── Print results ──
print(f"\n=== New Features Tests: {passed} passed, {failed} failed ===")
sys.exit(0 if failed == 0 else 1)
