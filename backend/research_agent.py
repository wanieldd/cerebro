"""Deep research agent -- multi-step web research that searches, reads, and synthesizes."""
import json, logging
import httpx
from llm_client import LLMClient

logger = logging.getLogger(__name__)

async def run_research(query: str, api_key: str, model: str = "openrouter/openai/gpt-4o-mini", depth: str = "quick"):
    """Run a multi-step research task, yielding SSE events."""
    client = LLMClient(api_key)

    yield {"type": "research_status", "content": f"Planning research: {query}"}

    # Step 1: Generate sub-questions
    plan_prompt = [
        {"role": "system", "content": "You are a research planner. Break down this query into 3-5 specific sub-questions. Return ONLY a JSON array of strings, no other text."},
        {"role": "user", "content": f"Research query: {query}\n\nDepth: {depth}\n\nReturn a JSON array of 3-5 specific search queries to answer this question."}
    ]

    plan_result = await client.chat_completion(plan_prompt, model=model)
    plan_text = plan_result["choices"][0]["message"]["content"]

    try:
        plan_text_clean = plan_text.strip()
        if plan_text_clean.startswith("```"):
            plan_text_clean = plan_text_clean.split("\n", 1)[1].rsplit("\n", 1)[0]
        sub_questions = json.loads(plan_text_clean)
        if not isinstance(sub_questions, list):
            sub_questions = [query]
    except:
        sub_questions = [query]

    yield {"type": "research_plan", "sub_questions": sub_questions}

    # Step 2: Search and read for each sub-question
    all_findings = []

    for i, sq in enumerate(sub_questions):
        yield {"type": "research_progress", "content": f"Researching ({i+1}/{len(sub_questions)}): {sq[:80]}"}

        try:
            async with httpx.AsyncClient(timeout=15) as hx:
                resp = await hx.get(
                    "https://html.duckduckgo.com/html/",
                    params={"q": sq},
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                import re
                urls = re.findall(r'uddg=([^&]+)', resp.text)[:3]
                from urllib.parse import unquote
                urls = [unquote(u) for u in urls]
        except:
            urls = []

        if urls:
            yield {"type": "research_sources", "question": sq, "urls": urls}

        findings = []
        for url in urls[:2]:
            try:
                async with httpx.AsyncClient(timeout=10) as hx:
                    r = await hx.get(url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True, timeout=10)
                    content = r.text[:3000]

                summary_prompt = [
                    {"role": "system", "content": "Summarize the key information relevant to the research question in 2-3 sentences."},
                    {"role": "user", "content": f"Question: {sq}\n\nSource content:\n{content[:2000]}"}
                ]
                summary_result = await client.chat_completion(summary_prompt, model=model)
                summary = summary_result["choices"][0]["message"]["content"]
                findings.append({"url": url, "summary": summary})
            except:
                pass

        all_findings.append({"question": sq, "findings": findings})

    # Step 3: Synthesize final report
    yield {"type": "research_synthesizing", "content": "Synthesizing findings into report..."}

    findings_text = json.dumps(all_findings, indent=2)
    report_prompt = [
        {"role": "system", "content": "You are a research analyst. Synthesize the following research findings into a comprehensive, well-structured markdown report."},
        {"role": "user", "content": f"Original query: {query}\n\nResearch findings:\n{findings_text}\n\nWrite a comprehensive markdown report with sections, key findings, and sources."}
    ]

    report_result = await client.chat_completion(report_prompt, model=model)
    report = report_result["choices"][0]["message"]["content"]

    yield {"type": "research_done", "report": report}
