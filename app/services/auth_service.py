from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from flask import session
from app.models.database import get_db
from config import Config

class AuthService:
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_MINUTES = 10

    @staticmethod
    def get_admin_credentials() -> tuple[str, str]:
        """Safely retrieves administrator credentials from environment / config."""
        try:
            from flask import current_app
            if current_app:
                u = current_app.config.get("ADMIN_USERNAME", Config.ADMIN_USERNAME) or ""
                p = current_app.config.get("ADMIN_PASSWORD", Config.ADMIN_PASSWORD) or ""
                return u.strip(), p
        except Exception:
            pass
        return Config.ADMIN_USERNAME.strip(), Config.ADMIN_PASSWORD

    @staticmethod
    def is_admin_configured() -> bool:
        """Returns True only when both ADMIN_USERNAME and ADMIN_PASSWORD are set."""
        u, p = AuthService.get_admin_credentials()
        return bool(u and p)

    @staticmethod
    def is_setup_required() -> bool:
        """Helper to determine if setup or configuration is required."""
        if AuthService.is_admin_configured():
            return False
        db = get_db()
        count = db.execute("SELECT COUNT(*) as cnt FROM users").fetchone()["cnt"]
        return count == 0

    @staticmethod
    def sync_admin_user() -> dict | None:
        """
        Synchronizes the default administrator account from environment variables
        into the SQLite users table, preserving all existing project references.
        """
        if not AuthService.is_admin_configured():
            return None

        username, password = AuthService.get_admin_credentials()
        db = get_db()
        hashed = generate_password_hash(password, method="scrypt")

        # 1. Check if user with this username already exists
        user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if user:
            # Update password hash if needed
            if not check_password_hash(user["password_hash"], password):
                db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hashed, user["id"]))
                db.commit()
                user = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            return dict(user)

        # 2. Check if an existing single user exists (e.g. from previous setup/database seed).
        # We update that user's credentials to maintain ownership of all existing projects.
        existing_users = db.execute("SELECT * FROM users ORDER BY id ASC").fetchall()
        if len(existing_users) == 1:
            existing = existing_users[0]
            db.execute(
                "UPDATE users SET username = ?, password_hash = ? WHERE id = ?",
                (username, hashed, existing["id"])
            )
            db.commit()
            updated = db.execute("SELECT * FROM users WHERE id = ?", (existing["id"],)).fetchone()
            return dict(updated)

        # 3. Otherwise, insert a new administrator user record
        cursor = db.cursor()
        now = datetime.now(timezone.utc)
        cursor.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (username, hashed, now)
        )
        db.commit()
        new_user = db.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(new_user)

    @staticmethod
    def authenticate(username: str, password: str) -> tuple[bool, str, dict | None]:
        """
        Securely verifies administrator credentials against scrypt hash and rate-limiting rules.
        Never logs or exposes credentials.
        """
        username = (username or "").strip()
        password = password or ""

        if not username or not password:
            return False, "Username and password are required.", None

        # 1. If admin credentials match, verify via admin flow
        admin_u, _ = AuthService.get_admin_credentials()
        if admin_u and username.lower() == admin_u.lower():
            AuthService.sync_admin_user()

        db = get_db()
        user = db.execute("SELECT * FROM users WHERE username = ? OR email = ?", (username, username)).fetchone()
        
        # 2. If user not found in local DB or has Supabase managed auth, check Supabase Auth if configured
        from app.services.supabase_service import SupabaseService
        if SupabaseService.is_configured() and ("@" in username or not user or user["password_hash"] == "SUPABASE_MANAGED_AUTH"):
            supa_res = SupabaseService.sign_in_with_password(username, password)
            if supa_res.get("success"):
                local_user_id = SupabaseService.sync_user_to_db(supa_res["user"], db)
                if local_user_id:
                    user_record = db.execute("SELECT id, username, email, created_at, last_login FROM users WHERE id = ?", (local_user_id,)).fetchone()
                    return True, "Login successful.", dict(user_record)

        if not user:
            if not AuthService.is_admin_configured() and not SupabaseService.is_configured():
                return False, "Authentication is not configured. Please define ADMIN_USERNAME and ADMIN_PASSWORD or Supabase keys in .env.", None
            return False, "Invalid username or password.", None

        return AuthService._verify_password_and_lockout(user, password)

    @staticmethod
    def _verify_password_and_lockout(user, password: str) -> tuple[bool, str, dict | None]:
        db = get_db()
        now = datetime.now(timezone.utc)

        # Check account lockout status
        if user["locked_until"]:
            locked_until = user["locked_until"]
            if isinstance(locked_until, str):
                try:
                    locked_until = datetime.fromisoformat(locked_until)
                except Exception:
                    locked_until = None
            if locked_until and now < locked_until:
                diff = int((locked_until - now).total_seconds() / 60) + 1
                return False, f"Account temporarily locked due to failed attempts. Try again in {diff} minute(s).", None

        # Secure password comparison using scrypt hash
        if not check_password_hash(user["password_hash"], password):
            failed = (user["failed_attempts"] or 0) + 1
            locked_until = None
            if failed >= AuthService.MAX_FAILED_ATTEMPTS:
                locked_until = now + timedelta(minutes=AuthService.LOCKOUT_MINUTES)
            db.execute(
                "UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?",
                (failed, locked_until, user["id"])
            )
            db.commit()
            return False, "Invalid username or password.", None

        # Reset failed attempts and update last login timestamp on success
        db.execute(
            "UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = ? WHERE id = ?",
            (now, user["id"])
        )
        db.commit()

        user_data = {
            "id": user["id"],
            "username": user["username"],
            "created_at": user["created_at"],
            "last_login": now.isoformat()
        }
        return True, "Login successful.", user_data

    @staticmethod
    def get_current_user():
        user_id = session.get("user_id")
        if not user_id:
            return None
        db = get_db()
        return db.execute("SELECT id, username, created_at, last_login FROM users WHERE id = ?", (user_id,)).fetchone()

    @staticmethod
    def register_owner(username: str, password: str) -> tuple[bool, str]:
        """Helper for test fixtures and initial setup testing."""
        if not username or len(username.strip()) < 3:
            return False, "Username must be at least 3 characters."
        if not password or len(password) < 6:
            return False, "Password must be at least 6 characters."

        db = get_db()
        existing = db.execute("SELECT id FROM users LIMIT 1").fetchone()
        if existing:
            return False, "Owner account already initialized. Please log in."

        hashed = generate_password_hash(password, method="scrypt")
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (username.strip(), hashed, datetime.now(timezone.utc))
        )
        db.commit()
        return True, "Owner account created successfully."
