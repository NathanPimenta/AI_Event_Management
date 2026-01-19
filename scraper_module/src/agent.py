"""Agent runner with compatibility for multiple LangChain versions.

This module attempts to use the modern `initialize_agent` API when available,
falls back to the legacy `create_react_agent` + `AgentExecutor` if present,
and provides a minimal deterministic fallback orchestrator if neither helper
is available in the installed LangChain package.

The fallback orchestrator uses the existing tools (search -> navigate -> extract)
to perform a best-effort scrape for a given goal.
"""

from typing import Any, Optional
import json
import re

from . import tools

# --- Feature-detect available LangChain APIs ---
_AGENT_API: Optional[str] = None
try:
    # preferred modern API
    from langchain.agents import initialize_agent, AgentType
    _AGENT_API = "initialize"
except Exception:
    try:
        # legacy React helper
        from langchain.agents import create_react_agent
        from langchain.agents.agent import AgentExecutor
        _AGENT_API = "react"
    except Exception:
        _AGENT_API = None

# LLM import: prefer langchain_ollama if available, otherwise use community binding
try:
    from langchain_ollama import OllamaLLM
    _LLM_CLASS = OllamaLLM
except Exception:
    try:
        from langchain_community.llms import Ollama
        _LLM_CLASS = Ollama
    except Exception:
        _LLM_CLASS = None

# Prompt retrieval: hub may not exist in some installs
try:
    from langchain import hub
    _HUB_AVAILABLE = True
except Exception:
    _HUB_AVAILABLE = False

# PromptTemplate: support both modern langchain and langchain_core installs, else provide a tiny fallback
try:
    from langchain.prompts import PromptTemplate
except Exception:
    try:
        from langchain_core.prompts import PromptTemplate
    except Exception:
        class PromptTemplate:
            def __init__(self, input_variables, template: str):
                self.input_variables = input_variables
                self.template = template
            def format(self, **kwargs):
                return self.template.format(**kwargs)



def _extract_first_url(text: str) -> Optional[str]:
    m = re.search(r"https?://[\w./?&=%-]+", text)
    return m.group(0) if m else None


def _call_tool(tool_obj, *args, **kwargs):
    """Invoke a tool that may be a plain function or a LangChain StructuredTool.

    Supports synchronous .run or asynchronous .arun via asyncio.run.
    """
    # Plain callable (regular Python function)
    if callable(tool_obj):
        return tool_obj(*args, **kwargs)

    # LangChain StructuredTool with .run
    if hasattr(tool_obj, "run"):
        return tool_obj.run(*args, **kwargs)

    # LangChain StructuredTool with .arun (async)
    if hasattr(tool_obj, "arun"):
        import asyncio
        return asyncio.run(tool_obj.arun(*args, **kwargs))

    raise TypeError(f"Tool {tool_obj!r} is not callable and has no .run/.arun")


def run_scraper_agent(goal: str, initial_url: Optional[str] = None) -> Any:
    """Run the scraper agent for a high-level `goal`.

    Returns parsed JSON data or raw text if JSON parsing fails.
    """
    print(f"🤖 Initializing Scraper Agent with goal: '{goal}'")

    if _LLM_CLASS is None:
        raise RuntimeError("No compatible LLM class found (tried langchain_ollama and langchain_community.llms.Ollama). Please install one of them.")

    llm = _LLM_CLASS(model="llama3:8b")

    agent_tools = [
        tools.search_the_web,
        tools.navigate_to_url,
        tools.extract_structured_data,
    ]

    # Attempt to get a prompt from hub, fall back to a simple instruction template
    if _HUB_AVAILABLE:
        try:
            prompt = hub.pull("hwchase17/react")
        except Exception:
            prompt = PromptTemplate(input_variables=["input"], template="You are a ReAct-style agent. Use the available tools to accomplish: {input}")
    else:
        prompt = PromptTemplate(input_variables=["input"], template="You are a ReAct-style agent. Use the available tools to accomplish: {input}")

    # Strategy: prefer the modern initialize_agent API, else legacy react helper,
    # else run a deterministic fallback orchestrator using available tools.
    final_result = None
    try:
        if _AGENT_API == "initialize":
            print("Using modern initialize_agent API")
            agent_executor = initialize_agent(
                agent_tools,
                llm,
                agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
                verbose=True,
            )
            result_text = agent_executor.run(goal)

        elif _AGENT_API == "react":
            print("Using legacy create_react_agent API")
            agent = create_react_agent(llm, agent_tools, prompt)
            agent_executor = AgentExecutor(
                agent=agent,
                tools=agent_tools,
                verbose=True,
                handle_parsing_errors=True,
            )
            result = agent_executor.invoke({"input": goal})
            result_text = result.get("output") if isinstance(result, dict) else str(result)

        else:
            # Minimal deterministic fallback: search -> navigate -> extract
            print("No agent helper API available; running deterministic fallback sequence")

            # If an `initial_url` was provided, prefer it (useful for bypassing search)
            url = initial_url

            if not url:
                try:
                    search_out = _call_tool(tools.search_the_web, goal)
                    url = _extract_first_url(search_out)
                except Exception as e:
                    print(f"Search tool failed ({e}); falling back to LLM heuristics to suggest a URL")

            if not url:
                # If search doesn't return a URL, try some common heuristics in the text
                # Fall back to asking the LLM for a likely URL (best-effort)
                try:
                    candidate = llm.predict(goal) if hasattr(llm, 'predict') else llm.generate(goal)
                    url = _extract_first_url(str(candidate))
                except Exception:
                    url = None

            if not url:
                raise RuntimeError("Fallback sequence could not determine a target URL from search results (install ddgs to enable DuckDuckGo search or provide a direct URL or call the /scrape/ endpoint with `url` set)")

            try:
                nav_summary = _call_tool(tools.navigate_to_url, url)
            except Exception as e:
                raise RuntimeError(
                    "Browser navigation failed. Ensure Chrome/Chromium is installed and available in PATH, or run in an environment with a graphical browser. "
                    f"Original error: {e}"
                )

            # Attempt to extract speakers (common category); user can adapt category as needed
            try:
                extracted = _call_tool(tools.extract_structured_data, "speakers")
            except Exception as e:
                raise RuntimeError(f"Structured extraction failed: {e}")

            result_text = extracted

        # Try parse JSON, otherwise return raw text
        try:
            final_result = json.loads(result_text)
        except Exception:
            print("Agent finished, but output was not valid JSON; returning raw text.")
            final_result = result_text

    except Exception as e:
        print(f"An error occurred during agent execution: {e}")
        raise

    finally:
        tools.close_driver()

    return final_result