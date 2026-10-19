import sqlite3
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from flask import g
from config import Config

logger = logging.getLogger(__name__)

# Register modern Python 3.12+ sqlite3 adapters to avoid deprecation warnings
sqlite3.register_adapter(datetime, lambda dt: dt.isoformat())
def _parse_timestamp(b: bytes) -> datetime:
    try:
        val = b.decode("utf-8")
        return datetime.fromisoformat(val)
    except Exception:
        try:
            return datetime.strptime(b.decode("utf-8"), "%Y-%m-%d %H:%M:%S")
        except Exception:
            return datetime.now(timezone.utc)
sqlite3.register_converter("TIMESTAMP", _parse_timestamp)

def get_db():
    if "db" not in g:
        from flask import current_app
        try:
            db_path = current_app.config.get("DATABASE_PATH", Config.DATABASE_PATH)
        except Exception:
            db_path = Config.DATABASE_PATH
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        g.db = sqlite3.connect(
            db_path,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
            timeout=30.0
        )
        g.db.row_factory = sqlite3.Row
        # Enable WAL mode for high concurrency
        g.db.execute("PRAGMA journal_mode=WAL;")
        g.db.execute("PRAGMA foreign_keys=ON;")
    return g.db

def get_standalone_db():
    """For background threads or standalone tasks where flask g context does not exist."""
    db_path = Config.DATABASE_PATH
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(
        db_path,
        detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
        timeout=30.0
    )
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL;")
    db.execute("PRAGMA foreign_keys=ON;")
    return db

def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db(app=None):
    db_path = Config.DATABASE_PATH if not app else app.config.get("DATABASE_PATH", Config.DATABASE_PATH)
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL;")
    cursor = conn.cursor()
    
    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT UNIQUE,
        supabase_uid TEXT UNIQUE,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP
    );
    """)

    # Safe migration for existing databases
    cursor.execute("PRAGMA table_info(users);")
    existing_columns = {row[1] for row in cursor.fetchall()}
    if "email" not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT;")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);")
    if "supabase_uid" not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN supabase_uid TEXT;")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);")
    if "role" not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';")

    # Projects table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        aspect_ratio TEXT DEFAULT '16:9',
        width INTEGER DEFAULT 1920,
        height INTEGER DEFAULT 1080,
        fps INTEGER DEFAULT 30,
        duration REAL DEFAULT 0.0,
        audio_asset_id TEXT,
        lyrics_data TEXT DEFAULT '[]',
        timeline_data TEXT DEFAULT '{}',
        template_data TEXT DEFAULT '{}',
        scene_data TEXT DEFAULT '[]',
        thumbnail_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    cursor.execute("PRAGMA table_info(projects);")
    existing_proj_cols = {row[1] for row in cursor.fetchall()}
    if "scene_data" not in existing_proj_cols:
        cursor.execute("ALTER TABLE projects ADD COLUMN scene_data TEXT DEFAULT '[]';")

    # Assets table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        user_id INTEGER NOT NULL,
        asset_type TEXT NOT NULL,
        original_name TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT,
        duration REAL DEFAULT 0.0,
        metadata_json TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Render jobs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS render_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        output_resolution TEXT DEFAULT '1080p',
        fps INTEGER DEFAULT 30,
        output_format TEXT DEFAULT 'mp4',
        output_file TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Settings table for API keys and configurations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()
    logger.info("Database initialized successfully at %s", db_path)
