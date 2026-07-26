# Cerebro 🧠

**Self-hosted AI chat app with tools, memory, and multi-model support.**

Streaming chat, web search, Python execution, file operations, auto-memory, conversation export, dark theme — all in one clean package. Bring your own OpenRouter key and you're set.

![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

| | |
|---|---|
| 💬 **Streaming Chat** | Real-time SSE streaming with stop, edit, resubmit, regenerate |
| 🛠️ **Built-in Tools** | Web search, Python execution, file ops, terminal, memory |
| 🧠 **Auto-Memory** | AI remembers facts about you across conversations |
| 🔑 **BYO Key** | Any OpenRouter-compatible model. Text + vision model support |
| 📁 **File Support** | Paste images, drag & drop files, upload documents |
| 📤 **Export** | Download conversations as JSON or Markdown |
| 🎨 **Dark Theme** | Pale dark blue design, adjustable font size, compact mode |
| 📱 **Responsive** | Works on desktop and mobile |
| 🗂️ **Conversations** | CRUD, folders, search, auto-title, inline rename |
| 📝 **Prompt Presets** | Save and load system prompt presets |
| 📦 **One-Command Install** | Single curl command to install. Built-in update |

---

## 🚀 Quick Start

### One-Command Install
```bash
curl -fsSL https://raw.githubusercontent.com/wanieldd/cerebro/main/install.sh | bash
```

### Or Manual Setup
```bash
# Clone
git clone https://github.com/wanieldd/cerebro.git
cd cerebro

# Backend
cd backend
uv sync

# Frontend
cd ../frontend
npm install
npm run build

# Start
cd ../backend
uv run uvicorn main:app --host 0.0.0.0 --port 3333
```

Open **http://localhost:3333** in your browser.

### Docker
```bash
docker build -t cerebro .
docker run -p 3333:3333 cerebro
```

---

## 🔄 Updating

```bash
./cerebro-update
```

Or manually:
```bash
git pull
cd frontend && npm install && npm run build
# Restart the server
```

---

## 📖 Usage

1. Open the app at `http://localhost:3333`
2. Create an account (first-run setup)
3. Enter your **OpenRouter API key** in Settings
4. Select a model and start chatting

### Settings
- **API Key** – Your OpenRouter API key
- **Default Model** – Select your preferred text model
- **Image Model** – Separate model for vision tasks
- **Appearance** – Font size (sm/md/lg) and compact mode
- **Behavior** – Auto-title, auto-memory toggles
- **Custom Instructions** – System prompt override with saved presets
- **Account** – Change password, sign out

---

## 🏗️ Architecture

```
Frontend (React 19 + Vite + Tailwind v4)
    ↓  REST + SSE
Backend (FastAPI + SQLite)
    ↓  OpenRouter API
LLM Providers
```

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 4, react-markdown, react-syntax-highlighter
- **Backend:** FastAPI, SQLite (aiosqlite), httpx, Uvicorn
- **Auth:** Local accounts with SHA-256, session tokens with 30-day TTL

---

## 🧪 Running Tests

```bash
cd backend
uv run python tests/test_v2.py          # Core API tests
uv run python tests/test_comprehensive.py  # Full endpoint coverage
uv run python tests/test_new_features.py   # Projects, documents, tasks
uv run python tests/test_live_chat.py      # Live streaming + tools
```

---

## 🐳 Deployment

### Docker
```bash
docker build -t cerebro .
docker run -d -p 3333:3333 --name cerebro cerebro
```

### Tailscale Tunnel (for remote access)
The included `launch.py` starts the server and an SSH tunnel via Serveo:
```bash
python3 launch.py
```

---

## 📁 Project Structure

```
cerebro/
├── backend/
│   ├── main.py          # FastAPI routes + auth
│   ├── agent.py         # LLM agent loop
│   ├── database.py      # SQLite layer
│   ├── llm_client.py    # OpenRouter client
│   ├── tools/           # Tool implementations
│   └── tests/           # Test suite
├── frontend/
│   ├── src/             # React app
│   └── dist/            # Built output
├── website/             # Public landing page
├── install.sh           # One-command installer
├── Dockerfile           # Container build
├── launch.py            # Server + tunnel launcher
└── PROGRESS.md          # Development tracker
```

---

## 📄 License

MIT

---

## 🔗 Links

- **GitHub:** https://github.com/wanieldd/cerebro
- **Website:** https://wanieldd.github.io/cerebro
- **Issues:** https://github.com/wanieldd/cerebro/issues
