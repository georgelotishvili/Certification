from __future__ import annotations

from sqlalchemy import text

from .database import engine


def safe_add(sql: str) -> None:
    try:
        with engine.begin() as conn:
            conn.execute(text(sql))
    except Exception:
        # Column probably already exists or SQLite limitation; ignore
        pass


def run() -> None:
    # SQLite: simple additive migration (idempotent via try/except)
    safe_add("ALTER TABLE sessions ADD COLUMN candidate_first_name VARCHAR(100)")
    safe_add("ALTER TABLE sessions ADD COLUMN candidate_last_name VARCHAR(100)")
    safe_add("ALTER TABLE sessions ADD COLUMN candidate_code VARCHAR(64)")
    safe_add("ALTER TABLE sessions ADD COLUMN block_stats TEXT")
    safe_add("ALTER TABLE sessions ADD COLUMN score_percent FLOAT DEFAULT 0.0")


if __name__ == "__main__":
    run()
    print("Migration executed (ignored if columns already existed).")


