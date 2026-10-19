import uuid
import json
import logging
from datetime import datetime, timezone
from app.models.database import get_db
from app.services.sync_service import SyncService
from config import Config

logger = logging.getLogger(__name__)

DEFAULT_TEMPLATE_CONFIG = {
    "template_id": "midnight_cinema",  # midnight_cinema, soft_focus, editorial_serif, kinetic_type, dream_sequence, minimal_verse, karaoke_highlight
    "font_family": "'Cinzel', 'Playfair Display', serif",
    "font_size": 56,
    "font_weight": "700",
    "letter_spacing": 3.0,
    "line_height": 1.3,
    "text_color": "#F1EFEA",
    "secondary_color": "#A09EA9",
    "highlight_color": "#B6FF3B",
    "outline_color": "#0C1A2B",
    "outline_width": 2,
    "shadow_color": "rgba(0, 0, 0, 0.85)",
    "shadow_blur": 16,
    "glow_color": "rgba(182, 255, 59, 0.45)",
    "glow_size": 20,
    "text_align": "center",
    "position_y": 74,  # percentage from top
    "position_x": 50,  # percentage from left
    "animation_type": "cinematic-rise",  # fade-darkness, blur-focus, cinematic-rise, tracking-reveal, typewriter, word-highlight, scale-drift, beat-pulse
    "animation_duration": 0.45,
    "animation_delay": 0.0,
    "animation_easing": "cubic-bezier(0.16, 1, 0.3, 1)",
    "animation_direction": "up",
    "animation_intensity": "medium",
    "beat_pulse": True,
    "background_color": "#090909",
    "overlay_opacity": 0.4,
    "bg_blur": 0,
    "bg_zoom": "zoom-in",
    "bg_fit": "cover",
    "bg_pan_x": 0,
    "bg_pan_y": 0,
    "bg_rotation": 0,
    "show_letterbox": True,
    "show_visualizer": False,
    "visualizer_style": "bars",
    "visualizer_color": "#A994FF"
}

DEFAULT_TIMELINE_CONFIG = {
    "zoom": 100,  # pixels per second
    "tracks": [
        {"id": "track-lyrics", "name": "Lyrics", "type": "lyrics", "locked": False, "muted": False, "clips": []},
        {"id": "track-images", "name": "Images & B-Roll", "type": "image", "locked": False, "muted": False, "clips": []},
        {"id": "track-effects", "name": "Visual Effects", "type": "effect", "locked": False, "muted": False, "clips": []},
        {"id": "track-audio", "name": "Audio", "type": "audio", "locked": False, "muted": False, "clips": []}
    ]
}

class ProjectService:
    @staticmethod
    def get_resolution_dimensions(aspect_ratio: str, quality: str = "1080p") -> tuple[int, int]:
        resolutions = {
            "16:9": {
                "720p": (1280, 720),
                "1080p": (1920, 1080),
                "1440p": (2560, 1440),
                "4K": (3840, 2160)
            },
            "9:16": {
                "720p": (720, 1280),
                "1080p": (1080, 1920),
                "1440p": (1440, 2560),
                "4K": (2160, 3840)
            },
            "1:1": {
                "720p": (720, 720),
                "1080p": (1080, 1080),
                "1440p": (1440, 1440),
                "4K": (2160, 2160)
            }
        }
        res_map = resolutions.get(aspect_ratio, resolutions["16:9"])
        return res_map.get(quality, (1920, 1080))

    @staticmethod
    def create_project(user_id: int, title: str, aspect_ratio: str = "16:9", quality: str = "1080p") -> dict:
        project_id = str(uuid.uuid4())
        width, height = ProjectService.get_resolution_dimensions(aspect_ratio, quality)
        now = datetime.now(timezone.utc)

        db = get_db()
        db.execute("""
            INSERT INTO projects (
                id, user_id, title, aspect_ratio, width, height, fps,
                lyrics_data, timeline_data, template_data, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            project_id, user_id, title.strip() or "Untitled Project",
            aspect_ratio, width, height, 30,
            json.dumps([]),
            json.dumps(DEFAULT_TIMELINE_CONFIG),
            json.dumps(DEFAULT_TEMPLATE_CONFIG),
            now, now
        ))
        db.commit()

        return ProjectService.get_project(project_id, user_id)

    @staticmethod
    def get_project(project_id: str, user_id: int) -> dict | None:
        db = get_db()
        row = db.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id)).fetchone()
        if not row:
            return None

        project = dict(row)
        project["lyrics_data"] = json.loads(project["lyrics_data"] or "[]")
        project["timeline_data"] = json.loads(project["timeline_data"] or "{}")
        project["template_data"] = json.loads(project["template_data"] or "{}")
        project["scene_data"] = json.loads(project.get("scene_data") or "[]")

        # Fetch linked assets
        asset_rows = db.execute("""
            SELECT id, asset_type, original_name, filename, file_path, file_size, mime_type, duration, metadata_json, created_at
            FROM assets WHERE project_id = ?
            ORDER BY created_at ASC
        """, (project_id,)).fetchall()

        assets = []
        audio_asset = None
        for a in asset_rows:
            adict = dict(a)
            adict["metadata"] = json.loads(adict["metadata_json"] or "{}")
            adict["url"] = f"/api/assets/{adict['id']}/file"
            assets.append(adict)
            if adict["id"] == project.get("audio_asset_id") or adict["asset_type"] == "audio":
                if not audio_asset:
                    audio_asset = adict

        project["assets"] = assets
        project["audio_asset"] = audio_asset
        return project

    @staticmethod
    def list_projects(user_id: int) -> list[dict]:
        db = get_db()
        rows = db.execute("""
            SELECT id, title, description, aspect_ratio, width, height, fps, duration,
                   thumbnail_path, created_at, updated_at
            FROM projects WHERE user_id = ?
            ORDER BY updated_at DESC
        """, (user_id,)).fetchall()
        
        projects = []
        for r in rows:
            p = dict(r)
            # Count assets
            asset_count = db.execute("SELECT COUNT(*) as cnt FROM assets WHERE project_id = ?", (p["id"],)).fetchone()["cnt"]
            p["asset_count"] = asset_count
            projects.append(p)
        return projects

    @staticmethod
    def update_project(project_id: str, user_id: int, updates: dict) -> bool:
        allowed_keys = {
            "title", "description", "aspect_ratio", "width", "height", "fps", "duration",
            "audio_asset_id", "lyrics_data", "timeline_data", "template_data", "scene_data", "thumbnail_path"
        }
        filtered = {}
        for k, v in updates.items():
            if k in allowed_keys:
                if k in ("lyrics_data", "timeline_data", "template_data", "scene_data") and not isinstance(v, str):
                    filtered[k] = json.dumps(v)
                else:
                    filtered[k] = v

        if not filtered:
            return True

        filtered["updated_at"] = datetime.now(timezone.utc)
        set_clauses = [f"{k} = ?" for k in filtered.keys()]
        values = list(filtered.values()) + [project_id, user_id]

        db = get_db()
        db.execute(f"UPDATE projects SET {', '.join(set_clauses)} WHERE id = ? AND user_id = ?", values)
        db.commit()
        return True

    @staticmethod
    def duplicate_project(project_id: str, user_id: int) -> dict | None:
        source = ProjectService.get_project(project_id, user_id)
        if not source:
            return None

        new_title = f"{source['title']} (Copy)"
        new_project = ProjectService.create_project(user_id, new_title, source["aspect_ratio"])
        
        ProjectService.update_project(new_project["id"], user_id, {
            "description": source.get("description", ""),
            "width": source["width"],
            "height": source["height"],
            "fps": source["fps"],
            "duration": source["duration"],
            "audio_asset_id": source["audio_asset_id"],
            "lyrics_data": source["lyrics_data"],
            "timeline_data": source["timeline_data"],
            "template_data": source["template_data"]
        })
        return ProjectService.get_project(new_project["id"], user_id)

    @staticmethod
    def delete_project(project_id: str, user_id: int) -> bool:
        db = get_db()
        # Delete project assets
        assets = db.execute("SELECT id, file_path FROM assets WHERE project_id = ? AND user_id = ?", (project_id, user_id)).fetchall()
        for a in assets:
            try:
                from pathlib import Path
                p = Path(a["file_path"])
                if p.exists():
                    p.unlink(missing_ok=True)
            except Exception:
                pass
        
        db.execute("DELETE FROM assets WHERE project_id = ? AND user_id = ?", (project_id, user_id))
        db.execute("DELETE FROM render_jobs WHERE project_id = ? AND user_id = ?", (project_id, user_id))
        db.execute("DELETE FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id))
        db.commit()
        return True
