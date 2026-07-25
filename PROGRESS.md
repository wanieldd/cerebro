# Cerebro — AI Chat App Progress Tracker

> **Last updated:** 2026-07-25  
> **App name:** Cerebro  
> **Tech stack:** React 19 + TypeScript + Vite 6 + FastAPI + Tailwind CSS 4  
> **Auth / API:** OpenRouter (bring-your-own-key)  
> **Data:** localStorage (frontend) + SQLite (backend: conversations, messages, prompts, memories, users, sessions)  
> **Port:** `localhost:3333`  
> **Tunnel (Serveo):** `launch.py` with `start_new_session=True`

---

## Table of Contents
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Design System](#design-system)
- [Feature Status](#feature-status)
- [Known Issues](#known-issues)
- [Recent Changes](#recent-changes)
- [Build & Deploy](#build--deploy)
- [Next Steps](#next-steps)

---

## Project Structure

```
cerebro/
├── PROGRESS.md
├── launch.py
├── scripts/
│   ├── recolor.py
│   └── start_tunnel.py
├── archive/
│   └── BUILD.md.old
├── .hermes/plans/
├── backend/
│   ├── main.py              # FastAPI — all routes + auth
│   ├── agent.py             # LLM agent loop with auto-memory
│   ├── config.py
│   ├── database.py          # SQLite + users/sessions tables
│   ├── llm_client.py
│   ├── tests/test_v2.py
│   ├── tools/               # memory_save/recall/list, web_search, file_ops, terminal, python_executor
│   └── data/                # hermes_ui.db + uploads/
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Auth guard, sidebar, routing
│   │   ├── main.tsx
│   │   ├── types.ts
│   │   ├── index.css            # Pale dark blue theme (was warm mustard)
│   │   ├── api/client.ts        # REST + SSE + auth API
│   │   └── components/
│   │       ├── ChatView.tsx
│   │       ├── ChatInput.tsx     # Paste images/files, thumbnails
│   │       ├── MessageBubble.tsx
│   │       ├── Settings.tsx      # 7 sections incl. Account, Image Model
│   │       ├── ModelSelector.tsx # Extracted from Settings
│   │       ├── OnboardingWizard.tsx  # 5-step onboarding
│   │       ├── SignIn.tsx
│   │       ├── MemoryManager.tsx
│   │       ├── PromptLibrary.tsx
│   │       └── ToolCallDisplay.tsx
│   ├── dist/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
```

---

## Architecture Overview

```
User → React App → FastAPI → OpenRouter
                      ↓
                 SQLite DB (conversations, messages, memories, users, sessions)
```

### Key Decisions

| Decision | Reason |
|---|---|
| React 19 + early returns guard | Auth state routing; all hooks must be before guard to avoid error #310 |
| FastAPI + SQLite | Streaming SSE, simple persistence |
| SHA-256 password hashing | No bcrypt dep needed for local app |
| BYO OpenRouter key | No auth server needed |
| Tailwind v4 @theme | All colors via CSS variables, cascades everywhere |
| `launch.py` with `start_new_session=True` | Server survives background-process cleanup |

### localStorage Keys

| Key | Purpose |
|---|---|
| `hermes_ui_api_key` | OpenRouter API key |
| `hermes_ui_model` | Default text model |
| `cerebro_image_model` | Vision/image reading model (blank = use text model) |
| `cerebro_session_token` | Auth session token |
| `cerebro_font_size` | sm/md/lg |
| `cerebro_compact` | Compact layout toggle |
| `cerebro_auto_title` | Auto-title conversations |
| `cerebro_auto_memory` | Auto-save memories |
| `cerebro_system_prompt` | Custom system prompt |
| `chat_reasoning` | Reasoning effort |

---

## Design System

### Pale Dark Blue Theme (`index.css` @theme)

| Variable | Value | Usage |
|---|---|---|
| `--color-mustard` | `#5c8db8` | Primary accent — buttons, focus rings, active states |
| `--color-mustard-dark` | `#3d6a91` | Blockquote borders |
| `--color-mustard-light` | `#8ab8db` | Hover states, inline code |
| `--color-warm-bg` | `#151a23` | Main background |
| `--color-warm-surface` | `#1c2330` | Cards, sidebar, sections |
| `--color-warm-elevated` | `#252d3d` | Hovered items, code blocks |
| `--color-warm-bubble` | `#2f384a` | User message bubble |
| `--color-warm-border` | `#364052` | Borders, dividers |
| `--color-warm-text` | `#d4dae4` | Primary text |
| `--color-warm-muted` | `#8793a6` | Secondary text |
| `--color-warm-danger` | `#c45a5a` | Error/danger |
| `--color-warm-code` | `#252d3d` | Code block bg |
| `--font-serif` | `Georgia, "Times New Roman", serif` | Assistant messages |
| `--font-sans` | `system-ui, -apple-system, sans-serif` | UI text |
| `--font-mono` | `JetBrains Mono, Fira Code, monospace` | Code blocks |

### Design Inspirations
- **Claude:** No-bubble assistant text (serif, flowing), user in rounded pills, paste-with-preview
- **Open WebUI:** First-run admin account creation, session-based auth
- **ChatGPT:** Collapsible settings sections, streaming cursor
- Theme originally warm mustard (`#d4a017`); shifted to pale dark blue (`#5c8db8`) by changing CSS variables only

---

## Feature Status

### ✅ Done

- [x] Streaming chat (SSE)
- [x] Conversations (CRUD, folders, search, auto-title)
- [x] Messages (edit & resubmit, copy, delete)
- [x] Settings (7 sections: API, Text Model, Image Model, Appearance, Behavior, System Prompt, Account, Data)
- [x] Account system (signup, signin, signout, change password, session tokens)
- [x] 5-step onboarding wizard (Create Account → API Key → Text Model → Vision Model → Welcome)
- [x] Model selector with search/browse and manual ID input (extracted to `ModelSelector.tsx`)
- [x] Vision/image model (separate from text model; blank = fallback to text model)
- [x] Cross-navigation between signup/signin screens ("Already have an account?" / "Create one")
- [x] Auto-memory (LLM prompted to use memory_save tool; manual add/delete in Memories panel)
- [x] Paste images/files (Ctrl+V → thumbnail previews above input, like Claude; multi-file)
- [x] Font size toggle, compact mode
- [x] Web search tool, reasoning effort selector
- [x] Prompt library, file upload
- [x] Pale dark blue theme (full Tailwind v4 @theme)
- [x] Model search focus fix (modelFilter localized to ModelSelector)
- [x] Hook ordering fix (all useCallback + useEffect before early returns to prevent error #310)
- [x] Stop generation button (square/stop appears during streaming, AbortController wired)
- [x] Delete confirmation dialog (ConfirmDialog modal with backdrop blur)
- [x] API key sidebar warning stays reactive (state synced to localStorage)
- [x] Sidebar branding (Cerebro wordmark: icon + serif title)
- [x] Welcome empty state with suggested prompt chips (5 built-in + custom prompts)
- [x] User bubble polish (rounded-2xl, px-5 py-3, pill shape)
- [x] Message timestamps (11px tabular-nums at 60% opacity)
- [x] GitHub repo created: https://github.com/wanieldd/cerebro
- [x] Port changed to 3333 (won't conflict with Hermes on 8000)

### ❌ Not Yet Done
- [ ] Resubmit race condition
- [ ] Compact mode wiring
- [ ] Mobile responsive
- [ ] Vision model actually wired (base_url + multimodal content partially done, still needs llm_client.py image handling)
- [ ] Toast/notification system
- [ ] Manual model input debounce
- [ ] CSS variables still named --color-mustard despite being blue

---

## Known Issues

1. **Server killed by background process cleanup** — Use `launch.py` (start_new_session=True), not `background=true`
2. **Tunnel URLs change on restart** — Add SSH key to Serveo for stable URLs
3. **Manual model input saves on every keystroke** — Should debounce

---

## Recent Changes

### 2026-07-25 — Stop generation + delete confirm + UI polish (major session)
- **Files:** `App.tsx`, `ChatView.tsx`, `ChatInput.tsx`, `client.ts`, `MessageBubble.tsx`, `ConfirmDialog.tsx` (new), `agent.py`, `main.py`, `.gitignore`, `README.md`
- Stop generation: AbortController wired through App→ChatView→ChatInput. Send button becomes red square during streaming
- Delete confirmation: ConfirmDialog modal with backdrop blur, cancel/delete buttons
- API key reactivity: converted `apiKey` to state synced with localStorage. Sidebar warning updates after leaving Settings
- Sidebar branding: Cerebro wordmark (icon + serif title) at top of sidebar above search bar
- Welcome empty state: 5 suggested prompt chips with icons instead of bare text
- User bubble: rounded-2xl (16px pill), px-5 py-3, softer
- Timestamps: 11px tabular-nums at 60% opacity (was 10px 50%)
- Vision model partially wired: base_url flows from main.py → agent.py. Still needs multimodal content construction in llm_client.py
- Port changed to 3333 across all files (launch.py, agent.py, main.py, test_v2.py, start_tunnel.py, PROGRESS.md)
- GitHub repo: https://github.com/wanieldd/cerebro — .gitignore, README.md with setup instructions, initial commit pushed
- Confirmed all changes build clean (zero TS errors, zero lint warnings)

### 2026-07-25 — Auto-memory system prompt
- **Files:** `backend/agent.py`
- Added system message when `auto_memory` enabled: instructs LLM to use `memory_save` tool

### 2026-07-25 — Pale dark blue color scheme
- **Files:** `frontend/src/index.css`
- Shifted all CSS variables from warm mustard to pale dark blue
- Selection color and scrollbar hover updated to match

### 2026-07-25 — Paste images/files with thumbnails
- **Files:** `frontend/src/components/ChatInput.tsx`
- `onPaste` handler extracts clipboard images/files
- Small thumbnail previews above input with X remove button
- Blobs uploaded on send; multi-file supported

### 2026-07-25 — Vision model (image reading)
- **Files:** `Settings.tsx`, `OnboardingWizard.tsx`, `App.tsx`, `client.ts`, `main.py`, `agent.py`
- New localStorage key: `cerebro_image_model`
- Settings: Image Model section with ModelSelector
- Onboarding: Step 3 added (5 steps total)
- Backend: `X-Image-Model` header flows to agent

### 2026-07-25 — ModelSelector extraction
- **Files:** `ModelSelector.tsx` (new), `Settings.tsx`, `OnboardingWizard.tsx`
- Extracted from Settings to shared component
- Used in both Settings and Onboarding

### 2026-07-25 — Auth onboarding + hook order fix
- **Files:** `database.py`, `main.py`, `App.tsx`, `client.ts`, `OnboardingWizard.tsx`, `SignIn.tsx`
- Users/sessions tables, SHA-256 passwords
- 4→5 step onboarding with model selection
- Cross-navigation between signup/signin
- **Critical:** All hooks moved before early returns to fix React error #310

---

## Build & Deploy

```bash
# Build frontend
cd /opt/data/cerebro/frontend && npm run build

# Full start (server + tunnel, survives process cleanup)
python3 /opt/data/cerebro/launch.py

# Server only
cd /opt/data/cerebro/backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Next Steps

1. Use vision model for actual image reading (backend currently receives header but doesn't act on it)
2. Wire compact mode layout changes
3. Mobile responsive polish
4. Fix resubmit race condition
5. Debounce manual model input save-to-localStorage
6. Add keyboard shortcuts (Cmd+K model, Ctrl+Enter send)