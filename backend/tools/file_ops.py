"""Tool: read, write, and search files."""

import os
import re
from pathlib import Path

from tools.registry import Tool, register


BASE_PATH = Path(os.path.expanduser("~")).resolve()


def _safe_resolve(path: str) -> Path | None:
    """Resolve path and ensure it's within BASE_PATH."""
    p = Path(path)
    if not p.is_absolute():
        p = BASE_PATH / p
    p = p.resolve()
    try:
        p.relative_to(BASE_PATH)
        return p
    except ValueError:
        return None


class ReadFile(Tool):
    name = "read_file"
    description = "Read a file's contents. Returns the file text with line numbers."
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Absolute or relative path to the file."},
        },
        "required": ["path"],
    }

    async def execute(self, path: str) -> str:
        resolved = _safe_resolve(path)
        if not resolved:
            return f"Error: path '{path}' is outside the allowed directory."
        if not resolved.exists():
            return f"Error: file not found: {resolved}"
        try:
            text = resolved.read_text("utf-8")
            lines = text.splitlines()
            numbered = "\n".join(f"{i+1:4d}|{l}" for i, l in enumerate(lines))
            return numbered
        except Exception as e:
            return f"Error reading file: {e}"


register(ReadFile())


class WriteFile(Tool):
    name = "write_file"
    description = "Write content to a file (overwrites existing content). Creates parent directories automatically."
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Absolute or relative path to the file."},
            "content": {"type": "string", "description": "Full content to write."},
        },
        "required": ["path", "content"],
    }

    async def execute(self, path: str, content: str) -> str:
        resolved = _safe_resolve(path)
        if not resolved:
            return f"Error: path '{path}' is outside the allowed directory."
        try:
            resolved.parent.mkdir(parents=True, exist_ok=True)
            resolved.write_text(content, "utf-8")
            return f"Written {len(content)} bytes to {resolved}"
        except Exception as e:
            return f"Error writing file: {e}"


register(WriteFile())


class SearchFiles(Tool):
    name = "search_files"
    description = "Search for files by name pattern (glob) or search file contents by regex."
    parameters = {
        "type": "object",
        "properties": {
            "pattern": {"type": "string", "description": "Glob pattern for file names or regex for content search."},
            "target": {
                "type": "string",
                "enum": ["files", "content"],
                "description": "'files' = find files by name glob, 'content' = search inside files.",
            },
            "path": {
                "type": "string",
                "description": "Directory to search in (default: home).",
            },
            "file_glob": {
                "type": "string",
                "description": "File filter for content search, e.g. '*.py'.",
            },
        },
        "required": ["pattern"],
    }

    async def execute(self, pattern: str, target: str = "files", path: str = "", file_glob: str = "") -> str:
        base = _safe_resolve(path) if path else BASE_PATH
        if not base:
            return f"Error: path '{path}' is outside the allowed directory."
        if target == "files":
            matches = list(base.glob(pattern))
            if not matches:
                return f"No files matching '{pattern}' in {base}"
            return "\n".join(str(m.relative_to(BASE_PATH)) for m in sorted(matches)[:50])
        else:
            results = []
            files = list(base.rglob(file_glob)) if file_glob else [base]
            for f in files:
                if f.is_file():
                    try:
                        text = f.read_text("utf-8", errors="replace")
                        for i, line in enumerate(text.splitlines(), 1):
                            if re.search(pattern, line):
                                rel = f.relative_to(BASE_PATH)
                                results.append(f"{rel}:{i}:{line.strip()[:200]}")
                    except Exception:
                        pass
            if not results:
                return f"No matches for '{pattern}'"
            return "\n".join(results[:50])


register(SearchFiles())
