"""Convenience wrapper to expose the FastAPI app at module-level
so you can run `uvicorn main_api:app --reload --port 8000` from the `team_formation/` folder.
"""
from src.api import app

__all__ = ("app",)
