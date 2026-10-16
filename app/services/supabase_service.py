import logging
from typing import Optional, Dict, Any
from config import Config

logger = logging.getLogger(__name__)

class SupabaseService:
    _anon_client = None
    _service_client = None

    @classmethod
    def get_config_val(cls, key: str, fallback: str = "") -> str:
        try:
            from flask import current_app
            if current_app:
                val = current_app.config.get(key)
                if val:
                    return str(val).strip()
        except Exception:
            pass
        return str(getattr(Config, key, fallback) or fallback).strip()

    @classmethod
    def is_configured(cls) -> bool:
        url = cls.get_config_val("SUPABASE_URL")
        key = cls.get_config_val("SUPABASE_ANON_KEY")
        return bool(url and key)

    @classmethod
    def get_client(cls):
        """Returns the public anon client for authentication flows."""
        if not cls.is_configured():
            return None
        url = cls.get_config_val("SUPABASE_URL")
        key = cls.get_config_val("SUPABASE_ANON_KEY")
        if cls._anon_client is None:
            try:
                from supabase import create_client
                cls._anon_client = create_client(url, key)
            except Exception as e:
                logger.error("Failed to initialize Supabase anon client: %s", e)
                return None
        return cls._anon_client

    @classmethod
    def get_service_client(cls):
        """Returns the privileged service-role client (strictly backend-only, never exposed)."""
        url = cls.get_config_val("SUPABASE_URL")
        key = cls.get_config_val("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            return None
        if cls._service_client is None:
            try:
                from supabase import create_client
                cls._service_client = create_client(url, key)
            except Exception as e:
                logger.error("Failed to initialize Supabase service client: %s", e)
                return None
        return cls._service_client

    @classmethod
    def sign_up(cls, email: str, password: str, redirect_url: Optional[str] = None) -> Dict[str, Any]:
        """Signs up a user using Supabase Auth with email verification."""
        client = cls.get_client()
        if not client:
            return {"success": False, "error": "Supabase Auth is not configured on this server."}
        
        try:
            options = {}
            if redirect_url:
                options["email_redirect_to"] = redirect_url
            
            res = client.auth.sign_up({
                "email": email,
                "password": password,
                "options": options
            })
            
            user = res.user
            session = res.session
            
            # If session is None, it means email confirmation is required
            requires_verification = session is None
            
            return {
                "success": True,
                "user": user,
                "session": session,
                "requires_verification": requires_verification
            }
        except Exception as e:
            err_msg = str(e)
            logger.warning("Supabase sign_up error for %s: %s", email, err_msg)
            return {"success": False, "error": err_msg}

    @classmethod
    def sign_in_with_password(cls, email: str, password: str) -> Dict[str, Any]:
        """Authenticates user with email and password via Supabase Auth."""
        client = cls.get_client()
        if not client:
            return {"success": False, "error": "Supabase Auth is not configured on this server."}
        
        try:
            res = client.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            return {
                "success": True,
                "user": res.user,
                "session": res.session
            }
        except Exception as e:
            err_msg = str(e)
            logger.warning("Supabase sign_in error for %s: %s", email, err_msg)
            return {"success": False, "error": err_msg}

    @classmethod
    def reset_password_for_email(cls, email: str, redirect_url: Optional[str] = None) -> Dict[str, Any]:
        """Triggers a password recovery email via Supabase Auth."""
        client = cls.get_client()
        if not client:
            return {"success": False, "error": "Supabase Auth is not configured on this server."}
        
        try:
            options = {}
            if redirect_url:
                options["redirect_to"] = redirect_url
            client.auth.reset_password_for_email(email, options)
            return {"success": True}
        except Exception as e:
            err_msg = str(e)
            logger.warning("Supabase reset_password error for %s: %s", email, err_msg)
            return {"success": False, "error": err_msg}

    @classmethod
    def update_password(cls, access_token: str, new_password: str) -> Dict[str, Any]:
        """Updates user password using the recovery session access token."""
        if not Config.SUPABASE_URL or not Config.SUPABASE_ANON_KEY:
            return {"success": False, "error": "Supabase Auth is not configured."}
        try:
            from supabase import create_client
            # Create a client and set auth session
            temp_client = create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)
            temp_client.auth.set_session(access_token, "")
            res = temp_client.auth.update_user({"password": new_password})
            return {"success": True, "user": res.user}
        except Exception as e:
            err_msg = str(e)
            logger.warning("Supabase update_password error: %s", err_msg)
            return {"success": False, "error": err_msg}

    @classmethod
    def get_user_from_token(cls, access_token: str):
        """Validates an access token and returns user information."""
        client = cls.get_client()
        if not client or not access_token:
            return None
        try:
            res = client.auth.get_user(access_token)
            return res.user if res else None
        except Exception as e:
            logger.warning("Failed to validate Supabase user token: %s", e)
            return None

    @classmethod
    def sync_user_to_db(cls, supabase_user, db) -> Optional[int]:
        """
        Maps a Supabase user into the local SQLite database.
        Ensures each user gets their private user_id for projects, assets, and storage.
        """
        if not supabase_user:
            return None
            
        uid = str(supabase_user.id)
        email = supabase_user.email or ""
        username = email.split("@")[0] if email else f"user_{uid[:8]}"

        # Check by supabase_uid
        cursor = db.execute("SELECT id FROM users WHERE supabase_uid = ?", (uid,))
        row = cursor.fetchone()
        if row:
            db.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (row["id"],))
            db.commit()
            return row["id"]

        # Check by email
        cursor = db.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            db.execute(
                "UPDATE users SET supabase_uid = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?",
                (uid, row["id"])
            )
            db.commit()
            return row["id"]

        # Ensure unique username
        base_username = username
        counter = 1
        while True:
            cursor = db.execute("SELECT id FROM users WHERE username = ?", (username,))
            if not cursor.fetchone():
                break
            username = f"{base_username}_{counter}"
            counter += 1

        # Insert new user with managed marker
        db.execute(
            """
            INSERT INTO users (username, password_hash, email, supabase_uid, role, last_login)
            VALUES (?, ?, ?, ?, 'user', CURRENT_TIMESTAMP)
            """,
            (username, "SUPABASE_MANAGED_AUTH", email, uid)
        )
        db.commit()
        cursor = db.execute("SELECT id FROM users WHERE supabase_uid = ?", (uid,))
        new_row = cursor.fetchone()
        return new_row["id"] if new_row else None
