import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Automatically load environment variables from .env file
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
AUDIO_DIR = UPLOAD_DIR / "audio"
IMAGES_DIR = UPLOAD_DIR / "images"
LYRICS_DIR = UPLOAD_DIR / "lyrics"
RENDERS_DIR = DATA_DIR / "renders"
THUMBNAILS_DIR = DATA_DIR / "thumbnails"

for directory in [DATA_DIR, UPLOAD_DIR, AUDIO_DIR, IMAGES_DIR, LYRICS_DIR, RENDERS_DIR, THUMBNAILS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

SECRET_KEY_FILE = DATA_DIR / ".secret_key"
if not SECRET_KEY_FILE.exists():
    SECRET_KEY_FILE.write_text(secrets.token_hex(32))
DEFAULT_SECRET_KEY = SECRET_KEY_FILE.read_text().strip()

class Config:
    SECRET_KEY = os.environ.get("LYRICSTUDIO_SECRET_KEY", DEFAULT_SECRET_KEY)
    DATABASE_PATH = os.environ.get("LYRICSTUDIO_DB_PATH", str(DATA_DIR / "lyricstudio.db"))
    
    # Session cookie security
    SESSION_COOKIE_NAME = "lyricstudio_session"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("LYRICSTUDIO_SECURE_COOKIE", "false").lower() == "true"
    PERMANENT_SESSION_LIFETIME = 86400 * 7  # 7 days
    
    # File limits
    MAX_CONTENT_LENGTH = 150 * 1024 * 1024  # 150 MB max upload
    ALLOWED_AUDIO_EXTENSIONS = {"mp3", "wav", "m4a", "aac", "flac", "ogg"}
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
    ALLOWED_LYRICS_EXTENSIONS = {"txt", "srt", "lrc"}
    
    # Storage quotas
    MAX_STORAGE_PER_USER_MB = int(os.environ.get("MAX_STORAGE_PER_USER_MB", 5000))  # 5GB
    
    # Default administrator credentials (from environment variables only - no hardcoded defaults)
    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "").strip()
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

    # Video render configurations
    FFMPEG_BINARY = os.environ.get("FFMPEG_BINARY", "ffmpeg")
    FFPROBE_BINARY = os.environ.get("FFPROBE_BINARY", "ffprobe")
    MAX_CONCURRENT_RENDERS = 2

    # Supabase Configuration
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", os.environ.get("SUPABASE_KEY", "")).strip()
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    @classmethod
    def is_admin_configured(cls) -> bool:
        """Returns True only when both ADMIN_USERNAME and ADMIN_PASSWORD are set."""
        return bool(cls.ADMIN_USERNAME and cls.ADMIN_PASSWORD)

    @classmethod
    def is_supabase_configured(cls) -> bool:
        """Returns True when SUPABASE_URL and SUPABASE_ANON_KEY are provided."""
        return bool(cls.SUPABASE_URL and cls.SUPABASE_ANON_KEY)
