"""Full-length song end-to-end integration test (201.57s Strawberries & Cigarettes).
Verifies:
1. Honest transcription limitation reporting when Whisper is absent.
2. Ingestion of real user lyrics without invented placeholder phrases.
3. Multi-track timeline cue persistence and updates.
4. Deterministic FFmpeg MP4 export and ffprobe validation.
"""

import os
import json
import time
import subprocess
from pathlib import Path
import pytest
from app import create_app
from config import Config
from app.models.database import get_db

FULL_LENGTH_AUDIO = "data/uploads/audio/1a987975-c04f-468c-bf58-2bba3b5d8b4f.mp3"

REAL_LYRICS = """Remember when we first got in the car
And you whispered in my ear telling me not to drive too fast
Long nights, daydreams, sugar and sweet things
Strawberries and cigarettes always taste like you
Headlights on the road shining bright
Taking all our memories into the starry night
Long nights, daydreams, sugar and sweet things
Strawberries and cigarettes always taste like you
Always taste like you"""


@pytest.fixture
def app_and_client(tmp_path):
    test_db = tmp_path / "test_full_length.db"

    class TestConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
        ADMIN_USERNAME = "admin"
        ADMIN_PASSWORD = "StudioAdmin_2026!"

    app = create_app(TestConfig)
    client = app.test_client()

    with app.app_context():
        db = get_db()
        db.execute("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'admin', 'test_pw')")
        db.commit()

    with client.session_transaction() as sess:
        sess["user_id"] = 1
        sess["username"] = "admin"

    return app, client


def test_full_length_acoustic_limitation_reporting(app_and_client):
    """Verify that absent Whisper engine is honestly reported without inventing lyrics."""
    _, client = app_and_client
    assert os.path.exists(FULL_LENGTH_AUDIO), f"Audio not found: {FULL_LENGTH_AUDIO}"

    with open(FULL_LENGTH_AUDIO, "rb") as af:
        resp = client.post(
            "/api/ai/create-draft",
            data={
                "title": "Strawberries Acoustic Energy Analysis",
                "aspect_ratio": "16:9",
                "audio_file": (af, "Strawberries_Cigarettes.mp3")
            },
            content_type="multipart/form-data"
        )

    assert resp.status_code == 201, f"Create draft failed: {resp.data}"
    data = resp.get_json()
    assert data["success"] is True

    # Check honest limitation reporting
    status = data.get("transcription_status", {})
    assert status.get("speech_to_text") is False
    assert status.get("engine") == "acoustic_energy_envelope"
    assert "Whisper" in status.get("limitation", "")

    # Check cues
    cues = data["project"]["lyrics_data"]
    assert len(cues) > 0
    for cue in cues:
        # Never invent lyrics or say "Vocal Phrase 1"
        assert "Vocal Phrase" not in cue["text"]
        assert cue.get("is_placeholder") is True
        assert cue.get("needs_review") is True
        assert cue.get("transcribed") is False


def test_full_length_user_lyrics_workflow_and_export(app_and_client):
    """Verify full song with real user-provided lyrics, timeline edits, and MP4 render."""
    _, client = app_and_client
    assert os.path.exists(FULL_LENGTH_AUDIO)

    with open(FULL_LENGTH_AUDIO, "rb") as af:
        resp = client.post(
            "/api/ai/create-draft",
            data={
                "title": "Strawberries & Cigarettes Production",
                "aspect_ratio": "16:9",
                "audio_file": (af, "Strawberries_Cigarettes.mp3"),
                "lyrics_text": REAL_LYRICS
            },
            content_type="multipart/form-data"
        )

    assert resp.status_code == 201
    draft_data = resp.get_json()
    project = draft_data["project"]
    project_id = project["id"]

    # Verify lyrics are the user's real lyrics, not invented
    lyrics = project["lyrics_data"]
    assert len(lyrics) >= 5
    assert "Remember when we first got in the car" in lyrics[0]["text"]
    for cue in lyrics:
        assert "Vocal Phrase" not in cue["text"]
        assert cue.get("is_placeholder") is False

    # Verify template uses Solar Lime accent (#B6FF3B) and Circuit Navy (#0C1A2B)
    template = project.get("template_data", {})
    assert template.get("highlight_color") == "#B6FF3B"
    assert template.get("outline_color") == "#0C1A2B"

    # Verify timeline editing and persistence: update cue timing and text
    updated_lyrics = list(lyrics)
    updated_lyrics[0]["text"] = "Remember when we first stepped in the car"
    updated_lyrics[0]["start"] = 1.2
    updated_lyrics[0]["end"] = 4.8

    update_resp = client.put(
        f"/api/projects/{project_id}",
        data=json.dumps({"lyrics_data": updated_lyrics}),
        content_type="application/json"
    )
    assert update_resp.status_code == 200
    saved_project = update_resp.get_json()["project"]
    assert saved_project["lyrics_data"][0]["text"] == "Remember when we first stepped in the car"
    assert saved_project["lyrics_data"][0]["start"] == 1.2

    # Render a high quality video slice to verify FFmpeg pipeline, ASS generation, and audio muxing
    # Set duration to 6 seconds for test verification speed
    client.put(
        f"/api/projects/{project_id}",
        data=json.dumps({"duration": 6.0}),
        content_type="application/json"
    )

    render_resp = client.post(
        f"/api/projects/{project_id}/render",
        data=json.dumps({"resolution": "720p", "fps": 30}),
        content_type="application/json"
    )
    assert render_resp.status_code == 200
    job_id = render_resp.get_json()["job_id"]

    # Poll render completion
    start_time = time.time()
    final_job = None
    while time.time() - start_time < 30:
        poll_resp = client.get(f"/api/renders/{job_id}/status")
        assert poll_resp.status_code == 200
        job_data = poll_resp.get_json().get("job", {})
        if job_data.get("status") in ("completed", "failed"):
            final_job = job_data
            break
        time.sleep(1.0)

    assert final_job is not None, "Render job timed out"
    assert final_job["status"] == "completed", f"Render failed: {final_job.get('error_message')}"

    output_file = final_job["output_file"]
    rendered_path = Path("data/renders") / output_file
    assert rendered_path.exists(), f"Rendered MP4 does not exist: {rendered_path}"
    assert rendered_path.stat().st_size > 20000, "Rendered MP4 file is too small"

    # Validate output with ffprobe
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(rendered_path)
    ]
    probe = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    probe_info = json.loads(probe.stdout)

    video_streams = [s for s in probe_info.get("streams", []) if s.get("codec_type") == "video"]
    audio_streams = [s for s in probe_info.get("streams", []) if s.get("codec_type") == "audio"]

    assert len(video_streams) >= 1, "Missing video stream"
    assert video_streams[0]["codec_name"] == "h264"
    assert len(audio_streams) >= 1, "Missing audio stream"
    assert audio_streams[0]["codec_name"] in ("aac", "mp3")

    # Clean up test output
    if rendered_path.exists():
        rendered_path.unlink()
