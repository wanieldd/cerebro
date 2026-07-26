"""Tool to dispatch coding tasks to OpenCode CLI."""
import subprocess, tempfile, os
from tools.registry import Tool, register

class OpenCodeTool(Tool):
    name = "dispatch_opencode"
    description = "Dispatch a complex coding task to OpenCode CLI. Use for multi-file implementations, refactoring, or code review that requires an autonomous agent."
    parameters = {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "The detailed coding task prompt for OpenCode"
            },
            "workdir": {
                "type": "string",
                "description": "Working directory (default: /opt/data/cerebro)",
                "default": "/opt/data/cerebro"
            }
        },
        "required": ["prompt"]
    }

    async def execute(self, prompt: str, workdir: str = "/opt/data/cerebro") -> str:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, prefix='opencode_') as f:
            f.write(prompt)
            spec_path = f.name

        try:
            result = subprocess.run(
                ["opencode", "run", f"Read the spec file and implement everything specified. After implementing, run any build commands specified and fix errors.",
                 "--model", "openrouter/deepseek/deepseek-v4-flash", "-f", spec_path],
                cwd=workdir,
                capture_output=True,
                text=True,
                timeout=300,
                env={**os.environ, "HOME": os.path.expanduser("~")},
            )
            output = result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout
            errors = result.stderr[-500:] if result.stderr else ""
            return f"Exit code: {result.returncode}\n\nOutput:\n{output}\n\nErrors:\n{errors}"
        except subprocess.TimeoutExpired:
            return "Error: OpenCode timed out after 300 seconds"
        except FileNotFoundError:
            return "Error: opencode CLI not found. Install with: npm i -g opencode-ai@latest"
        except Exception as e:
            return f"Error dispatching OpenCode: {e}"
        finally:
            try:
                os.unlink(spec_path)
            except:
                pass

register(OpenCodeTool())
