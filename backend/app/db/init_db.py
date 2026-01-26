from sqlalchemy import text

import app.db  # noqa: F401
from app.db.session import engine


async def init_db() -> None:
    """
    Verify DB connectivity.

    Schema is managed by Alembic. This should not create or mutate tables.
    """
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
