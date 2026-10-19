import os
import json
import pytest
from pathlib import Path
from PIL import Image

from app import create_app
from config import Config
from app.services.ai_director import (
    AIDirector,
    AIDirectorError,
    SCENE_SCHEMA_VERSION,
    VALID_ANIMATION_TYPES,
    VALID_BACKDROP_TYPES
)
from app.models.database import get_standalone_db


@pytest.fixture
def test_app(tmp_path):
    test_db = tmp_path / "test_director.db"

    class TestConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
        ADMIN_USERNAME = "admin"
        ADMIN_PASSWORD = "StudioAdmin_2026!"

    app = create_app(TestConfig)
    yield app


@pytest.fixture
def client(test_app):
    return test_app.test_client()


def test_stage_1_audio_ingestion_metadata(tmp_path):
    # Use existing sample audio from data/uploads if available, or generate a short dummy WAV
    audio_path = tmp_path / "test_tone.wav"
    # Generate 1-second sine wave using python wave module
    import wave
    import struct
    import math

    with wave.open(str(audio_path), "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(8000)
        for i in range(8000):
            value = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * 440.0 * i / 8000.0))
            data = struct.pack("<h", value)
            wav_file.writeframesraw(data)

    metadata = AIDirector.ingest_audio_metadata(str(audio_path))
    assert metadata["file_name"] == "test_tone.wav"
    assert metadata["duration"] >= 0.9
    assert metadata["sample_rate"] == 8000
    assert metadata["energy_mean"] > 0
    assert "tempo_bpm" in metadata


def test_stage_1_missing_audio_raises_error():
    with pytest.raises(AIDirectorError):
        AIDirector.ingest_audio_metadata("/non/existent/path/to/song.mp3")


def test_stage_2_lyric_transcription(tmp_path):
    # Test transcription fallback on synthetic audio
    audio_path = tmp_path / "test_speech.wav"
    import wave
    import struct
    with wave.open(str(audio_path), "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(8000)
        for i in range(16000):
            wav.writeframesraw(struct.pack("<h", 1000 if i % 20 < 10 else -1000))

    lyrics = AIDirector.transcribe_audio_lyrics(str(audio_path), duration=5.0)
    assert isinstance(lyrics, list)
    assert len(lyrics) > 0
    assert "start" in lyrics[0]
    assert "end" in lyrics[0]
    assert "text" in lyrics[0]


def test_stage_3_confidence_and_lyric_normalization():
    raw_lyrics = [
        {"start": 1.0, "end": 2.5, "text": "  hello world  "},
        {"start": 2.0, "end": 3.0, "text": "overlapping line"}  # starts before prev line ends
    ]
    cleaned = AIDirector.correct_and_score_lyrics(raw_lyrics, duration=10.0)
    assert len(cleaned) == 2
    # Casing normalized
    assert cleaned[0]["text"] == "Hello world"
    # No overlap
    assert cleaned[1]["start"] >= cleaned[0]["end"]
    # Words generated
    assert len(cleaned[0]["words"]) == 2
    assert "confidence" in cleaned[0]
    assert "needs_review" in cleaned[0]


def test_stage_4_mood_and_direction(test_app):
    with test_app.app_context():
        lyrics = [
            {"text": "Cruising through neon highway at midnight", "start": 0.0, "end": 4.0}
        ]
        audio_metadata = {"tempo_bpm": 130, "energy_mean": 0.28}
        direction = AIDirector.analyze_mood_and_direction("Neon Drive", lyrics, audio_metadata)

        assert "preset" in direction
        assert direction["highlight_color"] == "#B6FF3B"  # Brand Solar Lime
        assert direction["outline_color"] == "#0C1A2B"    # Brand Circuit Navy
        assert direction["energy_rating"] == "high"
        assert direction["beat_pulse"] is True


def test_stage_5_scene_plan_generation_and_validation():
    lyrics = [
        {"id": "l1", "text": "Verse one of the song", "start": 1.0, "end": 3.5},
        {"id": "l2", "text": "Verse two continuing the melody", "start": 4.0, "end": 6.8}
    ]
    mood = {
        "preset": "neon_night",
        "mood_name": "Neon Night",
        "font_family": "'Outfit', sans-serif",
        "font_size": 52,
        "font_weight": "700",
        "letter_spacing": 2.5,
        "text_color": "#F1EFEA",
        "highlight_color": "#B6FF3B",
        "glow_color": "rgba(182, 255, 59, 0.45)",
        "outline_color": "#0C1A2B",
        "outline_width": 2,
        "animation_type": "beat-pulse",
        "animation_duration": 0.45,
        "beat_pulse": True,
        "overlay_opacity": 0.35,
        "ken_burns": "zoom-in"
    }

    plan = AIDirector.generate_structured_scene_plan(
        song_title="Cyber Synth",
        lyrics=lyrics,
        mood_direction=mood,
        total_duration=10.0
    )

    assert plan["schema_version"] == SCENE_SCHEMA_VERSION
    assert len(plan["scenes"]) > 0

    first_scene = plan["scenes"][0]
    assert first_scene["scene_id"] == "scene_1"
    assert first_scene["start"] < first_scene["end"]
    assert first_scene["animation"]["type"] in VALID_ANIMATION_TYPES
    assert first_scene["backdrop"]["type"] in VALID_BACKDROP_TYPES
    assert first_scene["typography"]["highlight_color"] == "#B6FF3B"


def test_stage_5_schema_validation_catches_invalid_plans():
    # Test invalid schema version
    with pytest.raises(AIDirectorError, match="Unsupported schema version"):
        AIDirector.validate_scene_plan({"schema_version": "99.0", "scenes": []})

    # Test inverted start/end times
    invalid_timing_plan = {
        "schema_version": SCENE_SCHEMA_VERSION,
        "scenes": [
            {"scene_id": "bad", "start": 10.0, "end": 5.0}
        ]
    }
    with pytest.raises(AIDirectorError, match="invalid timing"):
        AIDirector.validate_scene_plan(invalid_timing_plan)


def test_stage_6_first_video_draft_creation(test_app, tmp_path):
    with test_app.app_context():
        from app.models.database import get_db
        db = get_db()
        db.execute("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'admin', 'dummy_hash')")

        # Create dummy audio asset on disk and in database
        audio_file = tmp_path / "sample_track.mp3"
        audio_file.write_bytes(b"\xFF\xFB\x90\x00" * 200)  # Dummy MP3 frame bytes

        db.execute("""
            INSERT INTO assets (id, user_id, asset_type, original_name, filename, file_path, file_size, mime_type, duration)
            VALUES ('test-asset-audio-1', 1, 'audio', 'sample_track.mp3', 'sample_track.mp3', ?, 800, 'audio/mpeg', 12.0)
        """, (str(audio_file),))
        db.commit()

        draft = AIDirector.create_first_video_draft(
            user_id=1,
            song_title="Neon Nights Master Draft",
            audio_asset_id="test-asset-audio-1",
            aspect_ratio="16:9",
            quality="1080p"
        )

        assert draft["success"] is True
        proj = draft["project"]
        assert proj["title"] == "Neon Nights Master Draft"
        assert proj["audio_asset_id"] == "test-asset-audio-1"
        assert len(proj["lyrics_data"]) > 0
        assert len(proj["timeline_data"]["tracks"]) >= 3
        assert draft["scene_plan"]["schema_version"] == SCENE_SCHEMA_VERSION


def test_stage_7_output_validation(tmp_path):
    # Non-existent file
    res = AIDirector.validate_video_output(str(tmp_path / "ghost.mp4"))
    assert res["valid"] is False
    assert "not found" in res["error"]

    # Zero-byte file
    empty_file = tmp_path / "empty.mp4"
    empty_file.write_bytes(b"")
    res = AIDirector.validate_video_output(str(empty_file))
    assert res["valid"] is False
    assert "empty" in res["error"]


def test_ai_create_draft_api_endpoint(client, test_app, tmp_path):
    # Ensure user exists
    with test_app.app_context():
        from app.models.database import get_db
        db = get_db()
        db.execute("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'admin', 'dummy_hash')")
        db.commit()

    with client.session_transaction() as sess:
        sess["user_id"] = 1
        sess["username"] = "admin"

    # Create dummy audio file for multipart upload
    import io
    audio_data = io.BytesIO(b"\xFF\xFB\x90\x00" * 400)
    data = {
        "title": "API Uploaded Track",
        "aspect_ratio": "16:9",
        "audio_file": (audio_data, "song.mp3")
    }

    res = client.post("/api/ai/create-draft", data=data, content_type="multipart/form-data")
    assert res.status_code == 201
    resp_json = res.get_json()
    assert resp_json["success"] is True
    assert "project" in resp_json
    assert "scene_plan" in resp_json
    assert "transcription_status" in resp_json
    assert f"/editor/{resp_json['project']['id']}" in resp_json["redirect_url"]


def test_user_provided_lyrics_flow(client, test_app, tmp_path):
    with test_app.app_context():
        from app.models.database import get_db
        db = get_db()
        db.execute("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'admin', 'dummy_hash')")
        db.commit()

    with client.session_transaction() as sess:
        sess["user_id"] = 1
        sess["username"] = "admin"

    import io
    audio_data = io.BytesIO(b"\xFF\xFB\x90\x00" * 400)
    real_lyrics = "Remember when we first met?\nYou said light my cigarette\nStrawberries and cigarettes always taste like you"
    data = {
        "title": "Strawberries Track",
        "aspect_ratio": "16:9",
        "audio_file": (audio_data, "strawberries.mp3"),
        "lyrics_text": real_lyrics
    }

    res = client.post("/api/ai/create-draft", data=data, content_type="multipart/form-data")
    assert res.status_code == 201
    resp_json = res.get_json()
    assert resp_json["success"] is True
    lyrics_data = resp_json["project"]["lyrics_data"]
    # Verify real user lyrics were used, not invented placeholders
    assert len(lyrics_data) == 3
    assert "Remember when we first met?" in lyrics_data[0]["text"]
    assert "Strawberries and cigarettes" in lyrics_data[2]["text"]
    assert "Vocal Phrase" not in lyrics_data[0]["text"]


def test_transcription_limitation_honest_reporting(tmp_path):
    import wave
    test_wav = tmp_path / "tone.wav"
    with wave.open(str(test_wav), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"\x00\x00" * 8000 * 2)

    lines = AIDirector.transcribe_audio_lyrics(str(test_wav), duration=2.0)
    assert len(lines) > 0
    # Must NEVER claim invented lines are transcribed
    for l in lines:
        assert "Vocal Phrase" not in l["text"]
        assert l["transcribed"] is False
        assert l["needs_review"] is True
