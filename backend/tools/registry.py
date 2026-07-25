"""Tool registry — define, collect, and serve tool definitions to the LLM."""

import inspect
from typing import Any


class Tool:
    """Base class for a tool an LLM can call."""

    name: str = ""
    description: str = ""
    parameters: dict = {}

    async def execute(self, **kwargs) -> str:
        raise NotImplementedError


_registry: dict[str, Tool] = {}


def register(tool: Tool) -> None:
    _registry[tool.name] = tool


def get_tool(name: str) -> Tool | None:
    return _registry.get(name)


def get_all_tools() -> list[Tool]:
    return list(_registry.values())


def get_openai_tool_defs() -> list[dict]:
    """Return tool definitions in OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            },
        }
        for t in _registry.values()
    ]


async def execute_tool(name: str, args: dict) -> str:
    tool = get_tool(name)
    if tool is None:
        return f"Error: unknown tool '{name}'"
    try:
        return await tool.execute(**args)
    except Exception as e:
        return f"Error executing {name}: {e}"
