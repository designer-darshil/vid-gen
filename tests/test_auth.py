import pytest
from app import create_app
from app.services.auth_service import AuthService
from config import Config

@pytest.fixture
def test_app(tmp_path):
    test_db = tmp_path / "test_auth.db"
    
    class TestAuthConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
        ADMIN_USERNAME = "studio_admin"
        ADMIN_PASSWORD = "AdminPassword_2026!"

    app = create_app(TestAuthConfig)
    yield app

@pytest.fixture
def client(test_app):
    return test_app.test_client()

def test_admin_login_success(test_app, client):
    """Test successful login with configured environment credentials and session cookie establishment."""
    res = client.post("/login", data={
        "username": "studio_admin",
        "password": "AdminPassword_2026!"
    }, follow_redirects=False)

    assert res.status_code == 302
    assert res.headers["Location"].endswith("/dashboard")

    # Verify session cookie was set
    cookie_header = res.headers.get("Set-Cookie", "")
    assert "lyricstudio_session" in cookie_header
    assert "HttpOnly" in cookie_header
    assert "SameSite=Lax" in cookie_header

    # Verify authenticated access to dashboard
    dash_res = client.get("/dashboard")
    assert dash_res.status_code == 200
    assert b"Projects" in dash_res.data
    assert b"studio_admin" in dash_res.data

def test_admin_login_incorrect_credentials(test_app, client):
    """Test login failure on wrong username and wrong password."""
    # 1. Wrong password
    res = client.post("/login", data={
        "username": "studio_admin",
        "password": "wrong_password_attempt"
    })
    assert res.status_code == 401
    assert b"Invalid username or password" in res.data

    # 2. Wrong username
    res_user = client.post("/login", data={
        "username": "unauthorized_user",
        "password": "AdminPassword_2026!"
    })
    assert res_user.status_code == 401
    assert b"Invalid username or password" in res_user.data

    # 3. Missing fields
    res_empty = client.post("/login", data={"username": "", "password": ""})
    assert res_empty.status_code == 400
    assert b"Both username and password are required" in res_empty.data

def test_admin_missing_env_vars_fails_safely(tmp_path):
    """Test safe failure with clear setup message when admin env vars are missing (Requirement 10)."""
    test_db = tmp_path / "test_missing_env.db"

    class MissingEnvConfig(Config):
        TESTING = True
        DATABASE_PATH = str(test_db)
        WTF_CSRF_ENABLED = False
        ADMIN_USERNAME = ""
        ADMIN_PASSWORD = ""

    app = create_app(MissingEnvConfig)
    with app.test_client() as c:
        # GET /login renders clear setup notice
        get_res = c.get("/login")
        assert get_res.status_code == 200
        assert b"Configuration required" in get_res.data
        assert b"ADMIN_USERNAME" in get_res.data
        assert b"ADMIN_PASSWORD" in get_res.data

        # POST /login fails safely without accepting any default password
        post_res = c.post("/login", data={"username": "admin", "password": "password"})
        assert post_res.status_code == 400
        assert b"Administrator account is not configured" in post_res.data

def test_admin_rate_limiting_lockout(test_app, client):
    """Test brute-force protection locks out account after 5 failed attempts."""
    # Fail 5 times
    for _ in range(AuthService.MAX_FAILED_ATTEMPTS):
        res = client.post("/login", data={
            "username": "studio_admin",
            "password": "wrong_password"
        })
        assert res.status_code == 401

    # 6th attempt with correct password should still be blocked due to active lockout
    locked_res = client.post("/login", data={
        "username": "studio_admin",
        "password": "AdminPassword_2026!"
    })
    assert locked_res.status_code == 401
    assert b"temporarily locked" in locked_res.data

def test_logout_and_protected_routes(test_app, client):
    """Test logout clears session and protected routes redirect unauthenticated users."""
    # 1. Unauthenticated access to protected routes
    res = client.get("/dashboard")
    assert res.status_code == 302
    assert "/login" in res.headers["Location"]

    res_api = client.get("/api/projects/sample-id")
    assert res_api.status_code == 401

    res_editor = client.get("/editor/sample-id")
    assert res_editor.status_code == 302
    assert "/login" in res_editor.headers["Location"]

    # 2. Log in
    login_res = client.post("/login", data={
        "username": "studio_admin",
        "password": "AdminPassword_2026!"
    })
    assert login_res.status_code == 302

    # 3. Logged in dashboard access succeeds
    dash = client.get("/dashboard")
    assert dash.status_code == 200

    # 4. Log out
    logout_res = client.get("/logout")
    assert logout_res.status_code == 302
    assert "/login" in logout_res.headers["Location"]

    # 5. Accessing dashboard after logout redirects to login
    dash_post_logout = client.get("/dashboard")
    assert dash_post_logout.status_code == 302
    assert "/login" in dash_post_logout.headers["Location"]
