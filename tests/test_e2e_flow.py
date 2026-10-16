import pytest
from app import create_app
from config import Config
from app.models.database import get_db

@pytest.fixture
def test_client(tmp_path):
    test_db = tmp_path / "e2e_flow.db"
    class TestConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
        ADMIN_USERNAME = "admin"
        ADMIN_PASSWORD = "StudioAdmin_2026!"
    app = create_app(TestConfig)
    with app.test_client() as client:
        yield client

def test_health_check(test_client):
    res = test_client.get("/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "healthy"
    assert data["service"] == "LyricStudio"

def test_full_owner_and_project_flow(test_client):
    # 1. First visit root redirects unauthenticated visitors to /login
    res = test_client.get("/", follow_redirects=True)
    assert res.status_code == 200
    assert b"Sign in" in res.data

    # 2. Administrator logs in with environment credentials
    res = test_client.post("/login", data={
        "username": "admin",
        "password": "StudioAdmin_2026!"
    }, follow_redirects=True)
    assert res.status_code == 200
    assert b"Projects" in res.data

    # 3. Create new project via API
    res = test_client.post("/api/projects", json={
        "title": "Neon Nights - Single",
        "aspect_ratio": "16:9",
        "quality": "1080p"
    })
    assert res.status_code == 201
    proj_data = res.get_json()["project"]
    proj_id = proj_data["id"]

    # 4. Open project editor page
    res = test_client.get(f"/editor/{proj_id}")
    assert res.status_code == 200
    assert b"Neon Nights - Single" in res.data
    assert b"preview-canvas" in res.data

    # 5. Sync LRC lyrics
    lrc = """[00:01.00]Glow in the dark
[00:04.00]Riding till the morning light
"""
    res = test_client.post(f"/api/projects/{proj_id}/sync", json={
        "text": lrc,
        "format": "lrc"
    })
    assert res.status_code == 200
    lyrics = res.get_json()["lyrics"]
    assert len(lyrics) == 2

    # 6. Apply timing offset
    res = test_client.post(f"/api/projects/{proj_id}/sync/offset", json={"offset": 0.5})
    assert res.status_code == 200
    offset_lyrics = res.get_json()["lyrics"]
    assert offset_lyrics[0]["start"] == 1.5

    # 7. Update template styling
    res = test_client.put(f"/api/projects/{proj_id}", json={
        "template_data": {
            "template_id": "neon",
            "glow_color": "#FF007F",
            "font_size": 52
        }
    })
    assert res.status_code == 200

    # 8. Update to Dreamy and Kinetic templates
    res = test_client.put(f"/api/projects/{proj_id}", json={
        "template_data": {
            "template_id": "dreamy",
            "glow_color": "#C4B5FD",
            "font_size": 48
        }
    })
    assert res.status_code == 200
    res = test_client.put(f"/api/projects/{proj_id}", json={
        "template_data": {
            "template_id": "kinetic",
            "font_size": 56
        }
    })
    assert res.status_code == 200

def test_api_csrf_exemption(tmp_path):
    test_db = tmp_path / "csrf_test.db"
    class CsrfConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = True  # Enable CSRF like production
    app = create_app(CsrfConfig)
    with app.test_client() as client:
        with app.app_context():
            from app.services.auth_service import AuthService
            AuthService.register_owner("csrf_tester", "production_password_123")

        with client.session_transaction() as sess:
            sess["user_id"] = 1
            sess["username"] = "csrf_tester"

        # Call API project creation (should succeed because api_bp is exempt)
        res = client.post("/api/projects", json={
            "title": "CSRF Project",
            "aspect_ratio": "16:9",
            "quality": "1080p"
        })
        assert res.status_code == 201
        assert res.get_json()["success"] is True

def test_sync_with_attached_audio(test_client, tmp_path):
    # Setup owner session
    from app.services.auth_service import AuthService
    import io

    with test_client.application.app_context():
        AuthService.register_owner("audio_owner", "password_123456")

    with test_client.session_transaction() as sess:
        sess["user_id"] = 1
        sess["username"] = "audio_owner"

    # Create project
    res = test_client.post("/api/projects", json={"title": "Audio Sync Project"})
    assert res.status_code == 201
    proj_id = res.get_json()["project"]["id"]

    # Create dummy wav audio
    wav_header = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    data = {
        "file": (io.BytesIO(wav_header), "beat.wav"),
        "asset_type": "audio"
    }
    upload_res = test_client.post(f"/api/projects/{proj_id}/upload", data=data, content_type="multipart/form-data")
    assert upload_res.status_code == 201

    # Call sync endpoint - must not raise KeyError: 'file_path'
    sync_res = test_client.post(f"/api/projects/{proj_id}/sync", json={
        "text": "Line 1 in the beat\nLine 2 in the rhythm",
        "format": "plain"
    })
    assert sync_res.status_code == 200
    lyrics = sync_res.get_json()["lyrics"]
    assert len(lyrics) == 2

def test_design_system_page(test_client):
    res = test_client.get("/design-system")
    assert res.status_code == 200
    assert b"LyricStudio Design System" in res.data
    assert b"Foundations" in res.data
    assert b"Typography Scale" in res.data
    assert b"Color Palette" in res.data
    assert b"Accessibility" in res.data


