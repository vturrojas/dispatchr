import os
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./dispatchr.db")

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
)

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
