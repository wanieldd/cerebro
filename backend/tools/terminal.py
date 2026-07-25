"""Tool: run shell commands in a subprocess."""

import asyncio

from tools.registry import Tool, register


class Terminal(Tool):
    name = "terminal"
    description = "Execute a shell command in a subprocess and return stdout/stderr. 30-second timeout. Use for system commands, file operations, git, etc."
    parameters = {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "The shell command to execute.",
            },
            "workdir": {
                "type": "string",
                "description": "Working directory for the command (optional).",
            },
        },
        "required": ["command"],
    }

    async def execute(self, command: str, workdir: str | None = None) -> str:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=workdir,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=30
            )
        except asyncio.TimeoutError:
            proc.kill()
            return "Command timed out after 30 seconds."

        out = stdout.decode("utf-8", errors="replace").strip()
        err = stderr.decode("utf-8", errors="replace").strip()
        result = ""
        if out:
            result += f"STDOUT:\n{out}\n"
        if err:
            result += f"STDERR:\n{err}\n"
        if proc.returncode != 0:
            result += f"Exit code: {proc.returncode}"
        return result.strip() or "(no output)"


register(Terminal())
