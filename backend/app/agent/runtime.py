"""Owns the compiled graph and its Postgres checkpointer (one connection: one user at a time)."""

from functools import lru_cache

import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg.rows import dict_row

from app.agent.graph import build_graph
from app.config import settings


@lru_cache
def get_graph():
    url = settings.database_url.replace("postgresql+psycopg://", "postgresql://")
    conn = psycopg.connect(url, autocommit=True, prepare_threshold=0, row_factory=dict_row)
    saver = PostgresSaver(conn)
    saver.setup()  # creates the checkpoint tables if missing
    return build_graph(saver)


def config(thread_id: str) -> dict:
    # recursion_limit is a safety net on top of the planner's 20-question cap.
    return {"configurable": {"thread_id": thread_id}, "recursion_limit": 60}


def pending_questions(thread_id: str) -> list[dict] | None:
    snapshot = get_graph().get_state(config(thread_id))
    for task in snapshot.tasks:
        for intr in task.interrupts:
            return intr.value["questions"]
    return None
