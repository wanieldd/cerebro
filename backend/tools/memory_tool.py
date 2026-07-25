"""Tool: memory save/recall/list — persistent key-value storage."""

import database as db

from tools.registry import Tool, register


class MemorySave(Tool):
    name = "memory_save"
    description = "Save a fact to persistent memory. Use this to remember information across conversations (user preferences, facts learned, important details)."
    parameters = {
        "type": "object",
        "properties": {
            "key": {
                "type": "string",
                "description": "A short descriptive key for the memory (e.g. 'user-name', 'project-structure').",
            },
            "content": {
                "type": "string",
                "description": "The content to remember.",
            },
        },
        "required": ["key", "content"],
    }

    async def execute(self, key: str, content: str) -> str:
        result = await db.add_memory(key, content)
        return f"Saved memory '{key}': {content[:100]}{'...' if len(content) > 100 else ''}"


register(MemorySave())


class MemoryRecall(Tool):
    name = "memory_recall"
    description = "Recall a specific fact from persistent memory by its key."
    parameters = {
        "type": "object",
        "properties": {
            "key": {
                "type": "string",
                "description": "The memory key to look up.",
            },
        },
        "required": ["key"],
    }

    async def execute(self, key: str) -> str:
        result = await db.get_memory(key)
        if result:
            return f"{result['key']}: {result['content']}"
        return f"No memory found for key '{key}'."


register(MemoryRecall())


class MemoryList(Tool):
    name = "memory_list"
    description = "List all saved memories with their keys."
    parameters = {
        "type": "object",
        "properties": {},
        "required": [],
    }

    async def execute(self) -> str:
        memories = await db.get_all_memories()
        if not memories:
            return "No memories saved yet."
        lines = [f"{m['key']}: {m['content'][:80]}{'...' if len(m['content']) > 80 else ''}" for m in memories]
        return "Memories:\n" + "\n".join(lines)


register(MemoryList())
