"""Tool: web search via DuckDuckGo (no API key needed)."""

import re

import httpx

from tools.registry import Tool, register


class WebSearch(Tool):
    name = "web_search"
    description = "Search the web using DuckDuckGo. Returns snippet-style results."
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query.",
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum number of results (default 5, max 10).",
            },
        },
        "required": ["query"],
    }

    async def execute(self, query: str, max_results: int = 5) -> str:
        max_results = min(max_results, 10)
        url = "https://html.duckduckgo.com/html/"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url, data={"q": query})
                resp.raise_for_status()
        except Exception as e:
            return f"Search failed: {e}"

        html = resp.text
        results = []

        # Find all result blocks
        result_blocks = re.findall(
            r'<div class="result[^"]*"[^>]*>.*?</div>\s*</div>\s*</div>',
            html,
            re.DOTALL,
        )

        for block in result_blocks:
            # Extract title
            title_m = re.search(
                r'<a[^>]*class="result__a"[^>]*>(.*?)</a>', block, re.DOTALL
            )
            # Extract snippet
            snippet_m = re.search(
                r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>', block, re.DOTALL
            )
            # Extract URL
            url_m = re.search(r'href="(https?://[^"]+)"', block)

            if title_m:
                title = re.sub(r"<[^>]+>", "", title_m.group(1)).strip()
                snippet = (
                    re.sub(r"<[^>]+>", "", snippet_m.group(1)).strip()
                    if snippet_m
                    else ""
                )
                link = url_m.group(1) if url_m else ""

                # Clean up HTML entities
                title = title.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                snippet = snippet.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                link = link.replace("&amp;", "&")

                results.append(f"[{title}]({link})\n{snippet}")

        if not results:
            # Fallback: try simpler extraction
            alt_blocks = re.findall(
                r'<a rel="nofollow"[^>]*class="result__a"[^>]*>(.*?)</a>',
                html,
                re.DOTALL,
            )
            if alt_blocks:
                for a in alt_blocks[:max_results]:
                    results.append(re.sub(r"<[^>]+>", "", a).strip())

        if not results:
            return "No results found."

        output = "\n\n".join(results[:max_results])
        return output


register(WebSearch())
