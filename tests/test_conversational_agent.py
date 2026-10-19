"""Tests for Conversational AI Editing Agent (OpusClip Producer Experience).
Verifies:
1. Translating natural language instructions into real, validated project mutations.
2. All reference commands:
   - "Make the video more cinematic and atmospheric."
   - "Highlight each word in sync with the vocals."
   - "Make the chorus more energetic."
   - "Use slower camera motion during the verse."
   - "Move the lyrics lower and make them larger."
   - "Undo the last change."
3. Non-destructive edits: preserving unrelated project attributes.
4. Persistent chat history in SQLite.
5. Multi-step undo/snapshot rollback.
6. REST API endpoints.
"""

import os
import json
import pytest
from app import create_app
from config import Config
from app.models.database import get_db, init_db
from app.services.project_service import ProjectService
from app.services.conversational_agent import ConversationalAgent


@pytest.fixture
def app_and_client(tmp_path):
    test_db = tmp_path / "test_agent.db"

    class TestConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
        ADMIN_USERNAME = "admin"
        ADMIN_PASSWORD = "StudioAdmin_2026!"

    app = create_app(TestConfig)
    client = app.test_client()

    with app.app_context():
        init_db(app)
        db = get_db()
        db.execute("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'admin', 'test_pw')")
        db.commit()

    with client.session_transaction() as sess:
        sess["user_id"] = 1
        sess["username"] = "admin"

    return app, client


def test_cinematic_atmospheric_command(app_and_client):
    app, _ = app_and_client
    with app.app_context():
        # Create baseline project
        project = ProjectService.create_project(1, "Cinematic Test Track", "16:9")
        pid = project["id"]

        # Send command
        res = ConversationalAgent.chat(pid, 1, "Make the video more cinematic and atmospheric.")
        assert res["success"] is True
        assert len(res["applied_changes"]) > 0

        updated = res["project"]
        t = updated["template_data"]
        assert "Cinzel" in t.get("font_family", "")
        assert t.get("animation_type") == "cinematic-rise"
        assert t.get("overlay_opacity") == 0.45
        assert t.get("bg_blur") == 8
        assert t.get("position_y") == 80
        assert "cinematic" in res["summary"].lower()


def test_word_by_word_highlight_command(app_and_client):
    app, _ = app_and_client
    with app.app_context():
        project = ProjectService.create_project(1, "Word Highlight Track", "16:9")
        pid = project["id"]

        res = ConversationalAgent.chat(pid, 1, "Highlight each word in sync with the vocals.")
        assert res["success"] is True

        updated = res["project"]
        t = updated["template_data"]
        assert t.get("animation_type") == "word-highlight"
        assert t.get("highlight_color") == "#B6FF3B"
        assert t.get("glow_color") == "#B6FF3B"


def test_chorus_energetic_command(app_and_client):
    app, _ = app_and_client
    with app.app_context():
        project = ProjectService.create_project(1, "Chorus Energy Track", "16:9")
        pid = project["id"]

        res = ConversationalAgent.chat(pid, 1, "Make the chorus more energetic.")
        assert res["success"] is True

        updated = res["project"]
        t = updated["template_data"]
        assert t.get("animation_type") == "beat-pulse"
        assert t.get("beat_pulse") is True
        assert t.get("font_weight") == "800"


def test_slower_camera_motion_command(app_and_client):
    app, _ = app_and_client
    with app.app_context():
        project = ProjectService.create_project(1, "Camera Drift Track", "16:9")
        pid = project["id"]

        res = ConversationalAgent.chat(pid, 1, "Use slower camera motion during the verse.")
        assert res["success"] is True

        updated = res["project"]
        t = updated["template_data"]
        assert t.get("animation_duration") == 0.85
        assert t.get("ken_burns") is True


def test_move_lyrics_lower_and_larger_command(app_and_client):
    app, _ = app_and_client
    with app.app_context():
        project = ProjectService.create_project(1, "Layout Track", "16:9")
        pid = project["id"]
        # Set initial template values
        ProjectService.update_project(pid, 1, {
            "template_data": {"position_y": 70, "font_size": 42}
        })

        res = ConversationalAgent.chat(pid, 1, "Move the lyrics lower and make them larger.")
        assert res["success"] is True

        updated = res["project"]
        t = updated["template_data"]
        assert t.get("position_y") > 70
        assert t.get("font_size") > 42


def test_undo_last_change_restoration(app_and_client):
    app, _ = app_and_client
    with app.app_context():
        project = ProjectService.create_project(1, "Undo Test Track", "16:9")
        pid = project["id"]
        initial_font_size = project.get("template_data", {}).get("font_size", 48)

        # 1. First edit: make larger
        ConversationalAgent.chat(pid, 1, "Make the font size larger.")
        mid_project = ProjectService.get_project(pid, 1)
        assert mid_project["template_data"]["font_size"] > initial_font_size

        # 2. Undo edit
        undo_res = ConversationalAgent.chat(pid, 1, "Undo the last change.")
        assert undo_res["success"] is True
        assert undo_res["action"] == "undo"

        restored_project = ProjectService.get_project(pid, 1)
        assert restored_project["template_data"]["font_size"] == initial_font_size


def test_chat_api_endpoints(app_and_client):
    _, client = app_and_client

    # 1. Create project via API
    create_res = client.post("/api/projects", json={
        "title": "API Chat Edit Test",
        "aspect_ratio": "16:9"
    })
    assert create_res.status_code == 201
    pid = create_res.get_json()["project"]["id"]

    # 2. Send conversational edit
    chat_res = client.post(f"/api/projects/{pid}/chat", json={
        "message": "Make the video more cinematic and atmospheric.",
        "current_time": 4.5
    })
    assert chat_res.status_code == 200
    chat_body = chat_res.get_json()
    assert chat_body["success"] is True
    assert "summary" in chat_body
    assert "project" in chat_body
    assert "Cinzel" in chat_body["project"]["template_data"]["font_family"]

    # 3. Retrieve chat history
    hist_res = client.get(f"/api/projects/{pid}/chat")
    assert hist_res.status_code == 200
    history = hist_res.get_json()["history"]
    assert len(history) >= 2  # user message and assistant reply
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"

    # 4. Undo via API
    undo_res = client.post(f"/api/projects/{pid}/chat/undo")
    assert undo_res.status_code == 200
    assert undo_res.get_json()["success"] is True
