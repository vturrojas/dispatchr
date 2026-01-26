# Ensures models are registered on Base.metadata when app imports app.db
from app.db.models import Job  # noqa: F401
