"""Agent loop: orchestrates LLM calls + tool execution with SSE streaming."""

import json
import logging

import httpx

import database as db
from config import settings
from llm_client import LLMClient, build_messages
from tools.registry import get_openai_tool_defs, execute_tool

logger = logging.getLogger(__name__)


async def stream_agent(
    conversation_id: str,
    user_message: str,
    api_key: str,
    model: str | None = None,
    image_model: str | None = None,
    base_url: str = "http://localhost:3333",
    reasoning_effort: str | None = None,
    scope: str | None = None,
    auto_title: bool | None = None,
    auto_memory: bool | None = None,
    system_prompt: str | None = None,
):
    """Process a user message, yielding SSE event dicts as JSON lines.

    Each yield is a dict that gets serialized to JSON and written as a line.
    """
    client = LLMClient(api_key)

    # 1. Save user message
    await db.add_message(conversation_id, "user", user_message)

    # 2. Load conversation history
    history = await db.get_messages(conversation_id)

    # 3. Load memories as context (unless disabled)
    memory_context = ""
    if auto_memory is not False:
        memories = await db.get_all_memories()
        if memories:
            memory_context = "\n".join(
                f"- {m['key']}: {m['content']}" for m in memories
            )

    # 4. Build messages array
    if system_prompt:
        # Override default system prompt
        from llm_client import SYSTEM_PROMPT as DEFAULT_PROMPT
        messages = build_messages(history, memory_context)
        messages[0]["content"] = system_prompt
    else:
        messages = build_messages(history, memory_context)
    tool_defs = get_openai_tool_defs()

    # Filter tools based on scope: only expose web_search when explicitly enabled
    if scope != 'web':
        tool_defs = [t for t in tool_defs if t["function"]["name"] != "web_search"]

    # Add web search instruction as a system message if scope='web'
    if scope == 'web':
        messages.insert(1, {
            "role": "system",
            "content": "[Web search is enabled] The user has requested you use the web_search tool to find current information. Use it to answer their question.",
        })


    # Auto-memory: instruct LLM to save facts about the user
    if auto_memory is not False:
        messages.insert(1, {
            "role": "system",
            "content": "When the user shares information about themselves (name, preferences, projects, habits, etc.), use the memory_save tool to remember it. This persists across conversations.",
        })

    # Map reasoning effort to system prompt instruction
    if reasoning_effort == 'low':
        messages.insert(1, {
            "role": "system",
            "content": "Be concise and direct. Give short, quick responses. Don't overthink or add unnecessary detail.",
        })
    elif reasoning_effort == 'high':
        messages.insert(1, {
            "role": "system",
            "content": "Think step by step. Be thorough and detailed in your reasoning. Consider multiple angles before responding.",
        })

    # Track whether we auto-titled
    auto_titled = False

    # 5. Agent loop
    for iteration in range(settings.max_tool_iterations):
        full_content = ""
        tool_calls_result = []

        # Stream from LLM
        async for event in client.stream_chat(
            messages,
            tools=tool_defs if tool_defs else None,
            model=model,
        ):
            if event["type"] == "token":
                full_content += event["content"]
                yield {"type": "token", "content": event["content"]}

            elif event["type"] == "tool_call":
                tool_calls_result.append(event)
                yield {
                    "type": "tool_call",
                    "id": event["id"],
                    "name": event["name"],
                    "arguments": event["arguments"],
                }

            elif event["type"] == "done":
                if event["finish_reason"] == "tool_calls":
                    # Execute tools, then loop back
                    assistant_tc = []
                    for tc in tool_calls_result:
                        assistant_tc.append({
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": tc["arguments"],
                            },
                        })

                    # Save assistant message with tool calls
                    await db.add_message(
                        conversation_id,
                        "assistant",
                        full_content,
                        tool_calls=assistant_tc,
                    )

                    # Execute each tool call
                    for tc in tool_calls_result:
                        try:
                            args = json.loads(tc["arguments"])
                        except json.JSONDecodeError:
                            args = {}

                        logger.info("Executing tool: %s(%s)", tc["name"], args)
                        result = await execute_tool(tc["name"], args)

                        # Add tool result to messages for next LLM call
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": result,
                        })

                        # Save to DB
                        await db.add_message(conversation_id, "tool", result)

                        yield {
                            "type": "tool_result",
                            "id": tc["id"],
                            "name": tc["name"],
                            "content": result,
                        }

                    # Auto-title on first assistant response (if enabled)
                    if not auto_titled and auto_title is not False:
                        conv = await db.get_conversation(conversation_id)
                        if conv and conv["title"] == "New Chat":
                            title = user_message[:60]
                            if len(user_message) > 60:
                                title += "..."
                            await db.update_conversation_title(conversation_id, title)
                        auto_titled = True

                    # Continue loop for next LLM call
                    break  # breaks for-event loop, continues for-iteration loop

                else:
                    # Done with a content response — save and return
                    await db.add_message(conversation_id, "assistant", full_content)

                    # Auto-title on first exchange (if enabled)
                    if not auto_titled and auto_title is not False:
                        conv = await db.get_conversation(conversation_id)
                        if conv and conv["title"] == "New Chat":
                            title = user_message[:60]
                            if len(user_message) > 60:
                                title += "..."
                            await db.update_conversation_title(conversation_id, title)
                        auto_titled = True

                    yield {"type": "done", "content": full_content}
                    return

            elif event["type"] == "error":
                yield {"type": "error", "content": event["content"]}
                return

        else:
            # No tool calls, no done event (shouldn't happen, but safety)
            if full_content:
                await db.add_message(conversation_id, "assistant", full_content)
                yield {"type": "done", "content": full_content}
            return

        # If we broke out of the for-event loop due to tool_calls, continue the for-iteration loop
        continue

    # Max iterations reached
    fallback = "I've reached the maximum number of tool calls. Please try a more specific request."
    await db.add_message(conversation_id, "assistant", fallback)
    yield {"type": "done", "content": fallback}
