"""LLM client for OpenRouter (OpenAI-compatible API)."""

import json

import httpx

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

SYSTEM_PROMPT = """You are Hermes, an AI assistant created by Nous Research. You are the user-facing chat assistant, not an API endpoint.

You operate with access to tools and persistent memory.

**Core directives:**
- Be helpful, direct, and honest. Use Markdown formatting in your responses.
- Never repeat the user's question back to them — answer it directly.
- When uncertain, say so. Do not fabricate answers.
- Be concise. Avoid unnecessary hedging, disclaimers, or boilerplate unless the situation genuinely calls for it.
- Match the user's language and tone. If they write casually, you write casually.

**Memory system:**
- You have persistent memory across conversations via the `memory_save`, `memory_recall`, and `memory_list` tools.
- When you learn personal information about the user, important facts, or preferences, proactively save them using `memory_save`.
- Before answering questions about the user's preferences, history, or personal context, check `memory_recall` first.
- This memory persists across all conversations — it's how the user's AI remembers them.

**Tools available to you:**
1. `python_execute` — Run Python code in a sandboxed subprocess (30s timeout). Use for calculations, data analysis, prototyping.
2. `terminal` — Execute shell commands. Use for system operations, file management, git.
3. `read_file` / `write_file` / `search_files` — Read, write, and search files on the filesystem.
4. `web_search` — Search the web via DuckDuckGo. Use when you need current information, news, or facts outside your training data.
5. `memory_save` / `memory_recall` / `memory_list` — Persist and retrieve facts across conversations.

When using tools, briefly explain what you're doing and why. After executing a tool, incorporate the results naturally into your response.

**Response style:**
- Use Markdown: **bold**, `code`, ```blocks```, lists, headings as appropriate.
- For code: use fenced code blocks with language tags.
- For math: LaTeX is supported.
- Be conversational but efficient. Prefer the shortest correct answer.
- Use headings and structure for complex explanations, not for simple answers."""


class LLMClient:
    def __init__(self, api_key: str, base_url: str = OPENROUTER_BASE):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/cerebro-app",
            "X-Title": "Cerebro",
        }

    async def chat_completion(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
    ) -> dict:
        """Call the OpenRouter chat completions endpoint (non-streaming)."""
        body = {
            "model": model or "openrouter/openai/gpt-4o-mini",
            "messages": messages,
            "stream": False,
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()

    async def stream_chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
    ):
        """Stream a chat completion, yielding event dicts.

        Events:
          {'type': 'token', 'content': 'Hello'}
          {'type': 'tool_call', 'id': '...', 'name': '...', 'arguments': '{...}'}
          {'type': 'done', 'finish_reason': 'stop'|'tool_calls'|'length'}
          {'type': 'error', 'content': '...'}
        """
        body = {
            "model": model or "openrouter/openai/gpt-4o-mini",
            "messages": messages,
            "stream": True,
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=300) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=body,
                ) as resp:
                    resp.raise_for_status()
                    # Accumulate tool calls across chunks
                    tool_call_acc: dict[int, dict] = {}

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        payload = line[6:].strip()
                        if payload == "[DONE]":
                            continue

                        try:
                            chunk = json.loads(payload)
                        except json.JSONDecodeError:
                            continue

                        choices = chunk.get("choices", [])
                        if not choices:
                            continue

                        delta = choices[0].get("delta", {})
                        finish_reason = choices[0].get("finish_reason")

                        # Content tokens
                        content = delta.get("content")
                        if content:
                            yield {"type": "token", "content": content}

                        # Tool call deltas
                        tc_deltas = delta.get("tool_calls")
                        if tc_deltas:
                            for tc in tc_deltas:
                                idx = tc.get("index", 0)
                                if idx not in tool_call_acc:
                                    tool_call_acc[idx] = {
                                        "id": tc.get("id", ""),
                                        "type": tc.get("type", "function"),
                                        "function": {
                                            "name": "",
                                            "arguments": "",
                                        },
                                    }
                                acc = tool_call_acc[idx]
                                fn = tc.get("function", {})
                                if tc.get("id"):
                                    acc["id"] = tc["id"]
                                if tc.get("type"):
                                    acc["type"] = tc["type"]
                                if fn.get("name"):
                                    acc["function"]["name"] += fn["name"]
                                if fn.get("arguments"):
                                    acc["function"]["arguments"] += fn["arguments"]

                        # Finish
                        if finish_reason:
                            # Emit accumulated tool calls if any
                            for idx in sorted(tool_call_acc.keys()):
                                tc = tool_call_acc[idx]
                                yield {
                                    "type": "tool_call",
                                    "id": tc["id"],
                                    "name": tc["function"]["name"],
                                    "arguments": tc["function"]["arguments"],
                                }
                            yield {"type": "done", "finish_reason": finish_reason}
                            return

            except httpx.HTTPStatusError as e:
                # Read the response body first since we're in streaming mode
                try:
                    err_body = await e.response.aread()
                    err_text = err_body.decode("utf-8", errors="replace")[:300]
                except Exception:
                    err_text = str(e)
                yield {
                    "type": "error",
                    "content": f"API error ({e.response.status_code}): {err_text}",
                }
            except Exception as e:
                yield {"type": "error", "content": f"Request failed: {e}"}

    async def validate_key(self) -> bool:
        """Check if the API key is valid by listing models."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.base_url}/models",
                    headers=self.headers,
                )
            return resp.status_code == 200
        except Exception:
            return False


def build_messages(
    history: list[dict], memory_context: str | None = None
) -> list[dict]:
    """Build the messages array for the LLM call."""
    msgs = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    if memory_context:
        msgs[0]["content"] += "\n\n---\n## Persisted memories\n" + memory_context

    # Build a clean message list, handling tool messages
    for m in history:
        role = m["role"]
        content = m["content"] or ""

        if role == "tool":
            # Tool role messages need content
            msgs.append({"role": "tool", "content": content})
        else:
            msg: dict = {"role": role, "content": content}
            if m.get("tool_calls"):
                msg["tool_calls"] = [
                    {
                        "id": tc.get("id", ""),
                        "type": "function",
                        "function": {
                            "name": tc["function"]["name"],
                            "arguments": tc["function"]["arguments"],
                        },
                    }
                    for tc in m["tool_calls"]
                ]
            msgs.append(msg)

    return msgs
