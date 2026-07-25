"""Configuration and settings."""

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Settings:
    default_model: str = "openrouter/openai/gpt-4o-mini"
    db_path: str = str(Path(__file__).parent / "data" / "hermes_ui.db")
    static_dir: str = str(Path(__file__).parent.parent / "frontend" / "dist")
    max_tool_iterations: int = 10
    cors_origins: list[str] = field(default_factory=lambda: ["*"])


settings = Settings()
DB_DIR = Path(settings.db_path).parent
os.makedirs(str(DB_DIR), exist_ok=True)
