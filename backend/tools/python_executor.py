"""Tool: run Python code in a subprocess."""

import asyncio
import sys

from tools.registry import Tool, register


class PythonExecutor(Tool):
    name = "python_execute"
    description = "Execute Python code in a subprocess and return stdout/stderr. The code runs with a 30-second timeout."
    parameters = {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "The Python code to execute.",
            }
        },
        "required": ["code"],
    }

    async def execute(self, code: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-c",
            code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=30
            )
        except asyncio.TimeoutError:
            proc.kill()
            return "Execution timed out after 30 seconds."

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


register(PythonExecutor())
