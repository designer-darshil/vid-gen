import pytest
from app import create_app
from app.services.auth_service import AuthService
from app.services.project_service import ProjectService
from config import Config

@pytest.fixture
def app(tmp_path):
    test_db = tmp_path / "test_proj.db"
    class TestConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
    return create_app(TestConfig)

def test_project_crud_and_aspect_ratios(app):
    with app.app_context():
        AuthService.register_owner("creator", "pass12345")
        _, _, user = AuthService.authenticate("creator", "pass12345")
        user_id = user["id"]

        # Create project in 16:9
        p = ProjectService.create_project(user_id, "Test YouTube Video", "16:9", "1080p")
        assert p["id"] is not None
        assert p["width"] == 1920
        assert p["height"] == 1080

        # Create project in 9:16 Shorts
        p_shorts = ProjectService.create_project(user_id, "Test Reel", "9:16", "1080p")
        assert p_shorts["width"] == 1080
        assert p_shorts["height"] == 1920

        # Update / Autosave
        ProjectService.update_project(p["id"], user_id, {
            "title": "Renamed Lyric Video",
            "duration": 45.5,
            "lyrics_data": [{"start": 1.0, "end": 4.0, "text": "Hello world"}]
        })

        updated = ProjectService.get_project(p["id"], user_id)
        assert updated["title"] == "Renamed Lyric Video"
        assert updated["duration"] == 45.5
        assert len(updated["lyrics_data"]) == 1

        # Duplicate project
        copied = ProjectService.duplicate_project(p["id"], user_id)
        assert copied["id"] != p["id"]
        assert "Copy" in copied["title"]

        # List projects
        all_projs = ProjectService.list_projects(user_id)
        assert len(all_projs) == 3

        # Delete project
        del_ok = ProjectService.delete_project(p["id"], user_id)
        assert del_ok is True
        assert ProjectService.get_project(p["id"], user_id) is None
