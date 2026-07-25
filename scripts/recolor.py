"""Batch-replace Tailwind color classes in component files."""
import re, os

BASE = "/opt/data/cerebro/frontend/src/components"

REPLACEMENTS = [
    # Blues → Mustard
    ("bg-blue-600", "bg-mustard"),
    ("hover:bg-blue-500", "hover:opacity-90"),
    ("text-blue-400", "text-mustard"),
    ("hover:text-blue-400", "hover:text-mustard-light"),
    ("text-blue-300", "text-mustard-light"),
    ("border-blue-500/30", "border-mustard/30"),
    ("bg-blue-600/20", "bg-mustard/20"),
    ("focus:ring-blue-500", "focus:ring-mustard"),
    # Grays → Warm
    ("bg-gray-950/50", "bg-warm-bg"),
    ("bg-gray-950", "bg-warm-bg"),
    ("bg-gray-900/50", "bg-warm-surface"),
    ("bg-gray-900", "bg-warm-surface"),
    ("bg-gray-800", "bg-warm-elevated"),
    ("border-gray-800", "border-warm-border"),
    ("border-gray-700", "border-warm-border"),
    ("text-gray-100", "text-warm-text"),
    ("text-gray-200", "text-warm-text"),
    ("text-gray-300", "text-warm-text"),
    ("text-gray-400", "text-warm-muted"),
    ("text-gray-500", "text-warm-muted"),
    ("text-gray-600", "text-warm-muted"),
    ("placeholder-gray-500", "placeholder-warm-muted"),
    ("hover:bg-gray-800", "hover:bg-warm-elevated"),
    ("hover:bg-gray-700", "hover:bg-warm-elevated"),
    ("hover:text-red-400", "hover:text-warm-danger"),
]

files = ["ChatInput.tsx", "Settings.tsx", "ToolCallDisplay.tsx", "MemoryManager.tsx", "PromptLibrary.tsx"]

for fname in files:
    fpath = os.path.join(BASE, fname)
    with open(fpath) as f:
        content = f.read()
    
    changes = 0
    for old, new in REPLACEMENTS:
        if old in content:
            content = content.replace(old, new)
            changes += 1
    
    with open(fpath, "w") as f:
        f.write(content)
    
    print(f"{fname}: {changes} replacements")

print("Done!")
