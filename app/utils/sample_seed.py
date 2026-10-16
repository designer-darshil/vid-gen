import subprocess
from pathlib import Path
from PIL import Image, ImageDraw
from config import BASE_DIR, Config
from app.models.database import get_db
from app.services.storage_service import StorageService
from app.services.project_service import ProjectService
from app.services.sync_service import SyncService

SAMPLE_DIR = BASE_DIR / "sample_data"
SAMPLE_AUDIO_DIR = SAMPLE_DIR / "audio"
SAMPLE_IMAGES_DIR = SAMPLE_DIR / "images"
SAMPLE_LYRICS_DIR = SAMPLE_DIR / "lyrics"

for d in [SAMPLE_DIR, SAMPLE_AUDIO_DIR, SAMPLE_IMAGES_DIR, SAMPLE_LYRICS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

def generate_sample_assets():
    audio_path = SAMPLE_AUDIO_DIR / "midnight_drive.mp3"
    if not audio_path.exists():
        # Synthesize 15-second melodic synth chord using FFmpeg
        cmd = [
            Config.FFMPEG_BINARY,
            "-y",
            "-f", "lavfi",
            "-i", "sine=frequency=220:duration=15",
            "-af", "volume=0.4,tremolo=f=4:d=0.5,aphaser",
            str(audio_path)
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    image_path = SAMPLE_IMAGES_DIR / "neon_horizon.png"
    if not image_path.exists():
        # Create a 1920x1080 atmospheric cyberpunk horizon image
        img = Image.new("RGB", (1920, 1080), color=(10, 12, 20))
        draw = ImageDraw.Draw(img)
        # Draw gradient sky
        for y in range(1080):
            r = int(12 + (y / 1080.0) * 35)
            g = int(14 + (y / 1080.0) * 20)
            b = int(28 + (y / 1080.0) * 55)
            draw.line([(0, y), (1920, y)], fill=(r, g, b))
        # Draw glowing sun circle
        draw.ellipse([860, 380, 1060, 580], fill=(255, 0, 128), outline=(0, 242, 254), width=4)
        img.save(str(image_path), format="PNG")

    lrc_path = SAMPLE_LYRICS_DIR / "midnight_drive.lrc"
    if not lrc_path.exists():
        lrc_path.write_text("""[ti:Midnight Drive]
[ar:LyricStudio Sample]
[00:01.00]Cruising under neon city skies
[00:04.50]Electric reflections in your eyes
[00:08.20]Lost in the rhythm of the night
[00:11.80]Chasing the everlasting light
""", encoding="utf-8")

    srt_path = SAMPLE_LYRICS_DIR / "midnight_drive.srt"
    if not srt_path.exists():
        srt_path.write_text("""1
00:00:01,000 --> 00:00:04,200
Cruising under neon city skies

2
00:00:04,500 --> 00:00:07,800
Electric reflections in your eyes

3
00:00:08,200 --> 00:00:11,500
Lost in the rhythm of the night

4
00:00:11,800 --> 00:00:14,800
Chasing the everlasting light
""", encoding="utf-8")

    txt_path = SAMPLE_LYRICS_DIR / "midnight_drive.txt"
    if not txt_path.exists():
        txt_path.write_text("""Cruising under neon city skies
Electric reflections in your eyes
Lost in the rhythm of the night
Chasing the everlasting light
""", encoding="utf-8")

def seed_sample_project(user_id: int) -> dict:
    generate_sample_assets()
    db = get_db()
    existing = db.execute("SELECT id FROM projects WHERE user_id = ? LIMIT 1", (user_id,)).fetchone()
    if existing:
        return ProjectService.get_project(existing["id"], user_id)

    # Create Demo Project
    project = ProjectService.create_project(user_id, "Midnight Drive — Official Lyrics", "16:9", "1080p")
    project_id = project["id"]

    # Upload audio
    audio_path = SAMPLE_AUDIO_DIR / "midnight_drive.mp3"
    class DummyUpload:
        def __init__(self, path):
            self.filename = path.name
            self.path = path
        def save(self, dest):
            import shutil
            shutil.copy(self.path, dest)

    audio_asset = StorageService.save_uploaded_file(DummyUpload(audio_path), user_id, project_id, "audio")
    
    # Upload image
    img_path = SAMPLE_IMAGES_DIR / "neon_horizon.png"
    img_asset = StorageService.save_uploaded_file(DummyUpload(img_path), user_id, project_id, "image")

    # Parse sample LRC lyrics
    lrc_content = (SAMPLE_LYRICS_DIR / "midnight_drive.lrc").read_text(encoding="utf-8")
    lyrics_lines = SyncService.parse_lrc(lrc_content)

    # Build image clip in timeline
    timeline = {
        "zoom": 80,
        "tracks": [
            {"id": "track-lyrics", "name": "Lyrics", "type": "lyrics", "locked": False, "muted": False, "clips": []},
            {
                "id": "track-images", "name": "Images & B-Roll", "type": "image", "locked": False, "muted": False,
                "clips": [
                    {
                        "id": "clip-img-1",
                        "asset_id": img_asset["id"],
                        "title": img_asset["original_name"],
                        "start": 0.0,
                        "end": 15.0,
                        "opacity": 0.95
                    }
                ]
            },
            {"id": "track-audio", "name": "Audio", "type": "audio", "locked": False, "muted": False, "clips": []}
        ]
    }

    # Set Neon template
    template = dict(project["template_data"])
    template["template_id"] = "neon"
    template["font_family"] = "'Outfit', 'Inter', sans-serif"
    template["text_color"] = "#FFFFFF"
    template["glow_color"] = "#00F2FE"
    template["outline_color"] = "#00F2FE"
    template["outline_width"] = 3
    template["font_size"] = 54
    template["position_y"] = 75

    ProjectService.update_project(project_id, user_id, {
        "audio_asset_id": audio_asset["id"],
        "duration": 15.0,
        "lyrics_data": lyrics_lines,
        "timeline_data": timeline,
        "template_data": template
    })

    return ProjectService.get_project(project_id, user_id)
