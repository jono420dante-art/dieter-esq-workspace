"""Pluggable studio agents (lyrics lint, future SEO/director agents, etc.)."""

from .registry import list_agents, run_agent

__all__ = ["list_agents", "run_agent"]
