from unittest.mock import patch, MagicMock
from app import create_app
from config import Config
from app.services.supabase_service import SupabaseService
from app.models.database import get_db, init_db

def test_supabase_config_detection():
    class ValidConfig(Config):
        SUPABASE_URL = "https://example-test.supabase.co"
        SUPABASE_ANON_KEY = "dummy-anon-key"
    assert ValidConfig.is_supabase_configured() is True
    
    class IncompleteConfig(Config):
        SUPABASE_URL = ""
        SUPABASE_ANON_KEY = ""
    assert IncompleteConfig.is_supabase_configured() is False

def test_supabase_signup_email_verification(tmp_path):
    test_db = tmp_path / "test_supa_signup.db"
    
    class SupaConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
        ADMIN_USERNAME = "admin"
        ADMIN_PASSWORD = "AdminPassword_2026!"
        SUPABASE_URL = "https://example-test.supabase.co"
        SUPABASE_ANON_KEY = "dummy-anon-key"
        
    app = create_app(SupaConfig)
    init_db(app)
    
    with app.test_client() as client:
        mock_user = MagicMock()
        mock_user.id = "supa-user-12345"
        mock_user.email = "creator@example.com"
        
        with patch.object(SupabaseService, "sign_up", return_value={
            "success": True,
            "user": mock_user,
            "session": None,
            "requires_verification": True
        }):
            res = client.post("/signup", data={
                "email": "creator@example.com",
                "password": "Password123!",
                "confirm_password": "Password123!"
            })
            assert res.status_code == 200
            assert b"Check your email" in res.data
            assert b"creator@example.com" in res.data

def test_supabase_forgot_password(tmp_path):
    test_db = tmp_path / "test_supa_forgot.db"
    
    class SupaConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
        ADMIN_USERNAME = "admin"
        ADMIN_PASSWORD = "AdminPassword_2026!"
        SUPABASE_URL = "https://example-test.supabase.co"
        SUPABASE_ANON_KEY = "dummy-anon-key"

    app = create_app(SupaConfig)
    init_db(app)
    
    with app.test_client() as client:
        with patch.object(SupabaseService, "reset_password_for_email", return_value={"success": True}):
            res = client.post("/forgot-password", data={"email": "creator@example.com"})
            assert res.status_code == 200
            assert b"Check your email" in res.data
            assert b"password reset link has been sent" in res.data

def test_supabase_user_sync_and_private_storage(tmp_path):
    test_db = tmp_path / "test_supa_sync.db"
    
    class SupaConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
        ADMIN_USERNAME = "admin"
        ADMIN_PASSWORD = "AdminPassword_2026!"
        SUPABASE_URL = "https://example-test.supabase.co"
        SUPABASE_ANON_KEY = "dummy-anon-key"

    app = create_app(SupaConfig)
    init_db(app)
    
    with app.app_context():
        db = get_db()
        mock_user = MagicMock()
        mock_user.id = "uuid-test-9999"
        mock_user.email = "artist@example.com"
        
        # 1. First sync inserts new user
        uid1 = SupabaseService.sync_user_to_db(mock_user, db)
        assert uid1 is not None
        
        row1 = db.execute("SELECT * FROM users WHERE id = ?", (uid1,)).fetchone()
        assert row1["email"] == "artist@example.com"
        assert row1["supabase_uid"] == "uuid-test-9999"
        assert row1["role"] == "user"
        
        # 2. Re-sync returns existing user ID (no duplicate rows)
        uid2 = SupabaseService.sync_user_to_db(mock_user, db)
        assert uid1 == uid2
