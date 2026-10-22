import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

url = os.getenv("DATABASE_URL", "")
# Neon/Render fournissent postgresql:// : on impose le pilote psycopg2
for prefixe in ("postgres://", "postgresql://"):
    if url.startswith(prefixe):
        url = "postgresql+psycopg2://" + url[len(prefixe):]
        break

engine = create_engine(
    url,
    connect_args={"options": "-csearch_path=assurance"},
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()