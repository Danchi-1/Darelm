import os
import sys
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__))))

from sqlalchemy import text
from app.db.session import engine

def drop_all():
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        conn.commit()
        print("Dropped tables successfully.")

if __name__ == "__main__":
    drop_all()
