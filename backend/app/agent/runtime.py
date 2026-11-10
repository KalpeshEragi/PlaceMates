"""Owns the compiled graph and its Postgres checkpointer (one connection: one user at a time)."""

from functools import lru_cache

import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg.rows import dict_row

from app.agent.graph import build_graph
from app.config import settings


@lru_cache
def get_graph():
    url = settings.sqlalchemy_url.replace("postgresql+psycopg://", "postgresql://")
    conn = psycopg.connect(url, autocommit=True, prepare_threshold=0, row_factory=dict_row)
    saver = PostgresSaver(conn)
    saver.setup()  # creates the checkpoint tables if missing
    return build_graph(saver)


def config(thread_id: str) -> dict:
    # recursion_limit is a safety net against a buggy loop.
    return {"configurable": {"thread_id": thread_id}, "recursion_limit": 200}


def pending_screen(thread_id: str) -> dict | None:
    """The screen the graph is paused on (topics / question / summary), or None if it ended."""
    snapshot = get_graph().get_state(config(thread_id))
    for task in snapshot.tasks:
        for intr in task.interrupts:
            return intr.value
    return None


def state_values(thread_id: str) -> dict:
    return get_graph().get_state(config(thread_id)).values
