# Cerebro

Your AI assistant with tools and memory -- runs locally on your machine.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/wanieldd/cerebro.git
cd cerebro

# 2. Install backend deps
cd backend && uv sync && cd ..

# 3. Install frontend deps
cd frontend && npm install && npm run build && cd ..

# 4. Start
cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 3333
```

Then open **http://localhost:3333** in your browser.

## Requirements

- Python 3.10+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- OpenRouter API key (free: https://openrouter.ai/keys)

## Features

- **Streaming chat** with markdown rendering
- **Tools** -- Python execution, terminal, file operations, web search
- **Persistent memory** -- AI remembers facts across conversations
- **Vision model support** -- paste images into chat
- **Account system** -- local signup/login with SHA-256 passwords
- **Model browser** -- search and select from all OpenRouter models
- **Conversations** -- folders, search, auto-title
- **Dark theme** -- pale dark blue, easy on the eyes

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 4
- **Backend:** FastAPI (Python), SQLite
- **LLM:** OpenRouter API (OpenAI-compatible)

## License

MIT