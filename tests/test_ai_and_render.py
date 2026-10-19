import os
import json
import pytest
from pathlib import Path
from PIL import Image
from app import create_app
from config import Config
from app.services.ai_service import AIService
from app.services.render_service import RenderService
from app.services.project_service import ProjectService
from app.models.database import get_standalone_db

@pytest.fixture
def test_app(tmp_path):
    test_db = tmp_path / "test_ai.db"
    
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

def test_ai_settings_and_db_persistence(test_app):
    with test_app.app_context():
        # Ensure setting key can be saved and read
        AIService.set_gemini_key("test_gemini_key_12345")
        assert AIService.get_gemini_key() == "test_gemini_key_12345"
        assert AIService.is_configured() is True
        
        # Clear key
        AIService.set_gemini_key("")
        assert AIService.get_gemini_key() == ""
        assert AIService.is_configured() is False

def test_artwork_color_extraction(tmp_path):
    # Create a test vibrant PNG image
    img = Image.new("RGB", (100, 100), color=(169, 148, 255))
    img_path = tmp_path / "test_artwork.png"
    img.save(img_path)

    res = AIService.extract_artwork_colors(str(img_path))
    assert "dominant" in res
    assert "palette" in res
    assert res["dominant"].lower() == "#a994ff"

def test_heuristic_creative_proposals():
    # Neon keywords
    neon_res = AIService.propose_creative_direction("City Lights", "Cruising under neon glow through the midnight drive")
    assert neon_res["success"] is True
    assert neon_res["proposal"]["preset"] == "neon_night"
    assert "beat-pulse" in neon_res["proposal"]["animation_type"]

    # Dreamy keywords
    dream_res = AIService.propose_creative_direction("Celestial", "Floating through starry skies in a dream")
    assert dream_res["success"] is True
    assert dream_res["proposal"]["preset"] == "dream_sequence"

    # Retro keywords
    retro_res = AIService.propose_creative_direction("Arcade 1984", "Rewind the vintage tape to the 80s synth")
    assert retro_res["success"] is True
    assert retro_res["proposal"]["preset"] == "retro_wave"

    # Minimal keywords
    min_res = AIService.propose_creative_direction("Silence", "Quiet empty space and pure truth")
    assert min_res["success"] is True
    assert min_res["proposal"]["preset"] == "minimal_verse"

def test_pillow_overlay_stream_generation(tmp_path):
    lyrics = [
        {"start": 1.0, "end": 3.5, "text": "First test line of lyrics"},
        {"start": 4.0, "end": 6.5, "text": "Second synchronized verse"}
    ]
    template = {
        "template_id": "neon_night",
        "font_size": 48,
        "text_color": "#FFFFFF",
        "highlight_color": "#00F2FE",
        "glow_color": "#4FACFE",
        "position_y": 75
    }
    concat_path = RenderService.generate_pillow_overlay_stream(lyrics, template, 640, 360, tmp_path, 8.0)
    assert concat_path.exists()
    content = concat_path.read_text()
    assert "file 'blank.png'" in content
    assert "file 'lyric_000.png'" in content
    assert "file 'lyric_001.png'" in content
    assert (tmp_path / "blank.png").exists()
    assert (tmp_path / "lyric_000.png").exists()
    assert (tmp_path / "lyric_001.png").exists()

def test_ai_api_endpoints(client, test_app):
    # Ensure user exists in test db
    with test_app.app_context():
        from app.models.database import get_db
        db = get_db()
        db.execute("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'admin', 'dummy_hash')")
        db.commit()

    # 1. Login as owner
    with client.session_transaction() as sess:
        sess["user_id"] = 1
        sess["username"] = "admin"

    # 2. Get AI settings
    res = client.get("/api/settings/ai")
    assert res.status_code == 200
    data = res.get_json()
    assert "configured" in data
    assert "provider" in data

    # 3. Create a test project
    proj_res = client.post("/api/projects", json={"title": "AI Test Studio", "aspect_ratio": "16:9"})
    assert proj_res.status_code == 201
    proj_id = proj_res.get_json()["project"]["id"]

    # 4. Propose styles via endpoint
    prop_res = client.post(f"/api/projects/{proj_id}/ai/propose")
    assert prop_res.status_code == 200
    prop_data = prop_res.get_json()
    assert prop_data["success"] is True
    assert "proposal" in prop_data

    # 5. Apply proposal
    apply_res = client.post(f"/api/projects/{proj_id}/ai/apply", json={"proposal": prop_data["proposal"]})
    assert apply_res.status_code == 200
    assert apply_res.get_json()["success"] is True
