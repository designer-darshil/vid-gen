import os
import uuid
import mimetypes
from pathlib import Path
from werkzeug.utils import secure_filename
from PIL import Image
import mutagen
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen.flac import FLAC
from mutagen.oggvorbis import OggVorbis
from config import Config, AUDIO_DIR, IMAGES_DIR, LYRICS_DIR, RENDERS_DIR
from app.models.database import get_db

class StorageService:
    @staticmethod
    def get_user_storage_bytes(user_id: int) -> int:
        db = get_db()
        row = db.execute("SELECT COALESCE(SUM(file_size), 0) as total FROM assets WHERE user_id = ?", (user_id,)).fetchone()
        return row["total"] if row else 0

    @staticmethod
    def check_quota(user_id: int, new_file_size: int) -> bool:
        current = StorageService.get_user_storage_bytes(user_id)
        max_bytes = Config.MAX_STORAGE_PER_USER_MB * 1024 * 1024
        return (current + new_file_size) <= max_bytes

    @staticmethod
    def is_safe_path(target_path: Path, base_dir: Path) -> bool:
        try:
            target = target_path.resolve()
            base = base_dir.resolve()
            return base in target.parents or target == base
        except Exception:
            return False

    @staticmethod
    def validate_file(filename: str, asset_type: str) -> tuple[bool, str]:
        if not filename or "." not in filename:
            return False, "Invalid filename or missing extension."
        ext = filename.rsplit(".", 1)[1].lower()
        if asset_type == "audio" and ext not in Config.ALLOWED_AUDIO_EXTENSIONS:
            return False, f"Unsupported audio extension: .{ext}. Allowed: {', '.join(Config.ALLOWED_AUDIO_EXTENSIONS)}"
        if asset_type == "image" and ext not in Config.ALLOWED_IMAGE_EXTENSIONS:
            return False, f"Unsupported image extension: .{ext}. Allowed: {', '.join(Config.ALLOWED_IMAGE_EXTENSIONS)}"
        if asset_type == "lyrics" and ext not in Config.ALLOWED_LYRICS_EXTENSIONS:
            return False, f"Unsupported lyrics extension: .{ext}. Allowed: {', '.join(Config.ALLOWED_LYRICS_EXTENSIONS)}"
        return True, ext

    @staticmethod
    def save_uploaded_file(file_storage, user_id: int, project_id: str, asset_type: str) -> dict:
        filename = secure_filename(file_storage.filename or "upload")
        valid, ext_or_err = StorageService.validate_file(filename, asset_type)
        if not valid:
            raise ValueError(ext_or_err)
        
        ext = ext_or_err
        asset_id = str(uuid.uuid4())
        unique_name = f"{asset_id}.{ext}"

        if asset_type == "audio":
            target_dir = AUDIO_DIR
        elif asset_type == "image":
            target_dir = IMAGES_DIR
        elif asset_type == "lyrics":
            target_dir = LYRICS_DIR
        else:
            raise ValueError(f"Unknown asset type: {asset_type}")

        target_path = target_dir / unique_name
        if not StorageService.is_safe_path(target_path, target_dir):
            raise PermissionError("Path traversal detected.")

        target_dir.mkdir(parents=True, exist_ok=True)
        file_storage.save(str(target_path))
        file_size = target_path.stat().st_size

        if not StorageService.check_quota(user_id, file_size):
            target_path.unlink(missing_ok=True)
            raise ValueError("Storage quota exceeded.")

        duration = 0.0
        meta = {}
        mime = mimetypes.guess_type(str(target_path))[0] or "application/octet-stream"

        if asset_type == "audio":
            try:
                audio = mutagen.File(str(target_path))
                if audio and audio.info:
                    duration = float(audio.info.length)
                    meta["sample_rate"] = getattr(audio.info, "sample_rate", 44100)
                    meta["channels"] = getattr(audio.info, "channels", 2)
                    meta["bitrate"] = getattr(audio.info, "bitrate", 0)
            except Exception as e:
                pass
        elif asset_type == "image":
            try:
                with Image.open(str(target_path)) as img:
                    meta["width"] = img.width
                    meta["height"] = img.height
                    meta["format"] = img.format
            except Exception as e:
                pass

        import json
        db = get_db()
        db.execute("""
            INSERT INTO assets (id, project_id, user_id, asset_type, original_name, filename, file_path, file_size, mime_type, duration, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            asset_id, project_id, user_id, asset_type, filename, unique_name,
            str(target_path), file_size, mime, duration, json.dumps(meta)
        ))
        db.commit()

        return {
            "id": asset_id,
            "project_id": project_id,
            "asset_type": asset_type,
            "original_name": filename,
            "filename": unique_name,
            "file_size": file_size,
            "duration": duration,
            "metadata": meta,
            "url": f"/api/assets/{asset_id}/file"
        }

    @staticmethod
    def delete_asset(asset_id: str, user_id: int) -> bool:
        db = get_db()
        row = db.execute("SELECT file_path FROM assets WHERE id = ? AND user_id = ?", (asset_id, user_id)).fetchone()
        if not row:
            return False
        
        path = Path(row["file_path"])
        if path.exists():
            path.unlink(missing_ok=True)
        
        db.execute("DELETE FROM assets WHERE id = ? AND user_id = ?", (asset_id, user_id))
        db.commit()
        return True
