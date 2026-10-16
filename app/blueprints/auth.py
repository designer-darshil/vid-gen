import logging
from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify
from app.services.auth_service import AuthService
from app.services.supabase_service import SupabaseService
from app.models.database import get_db

logger = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/setup", methods=["GET", "POST"])
def setup():
    if not AuthService.is_setup_required():
        return redirect(url_for("auth.login"))

    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")

        if password != confirm:
            error = "Passwords do not match."
        else:
            success, msg = AuthService.register_owner(username, password)
            if success:
                _, _, user = AuthService.authenticate(username, password)
                if user:
                    session.permanent = True
                    session["user_id"] = user["id"]
                    session["username"] = user["username"]
                    try:
                        from app.utils.sample_seed import seed_sample_project
                        seed_sample_project(user["id"])
                    except Exception:
                        pass
                    return redirect(url_for("dashboard.index"))
            error = msg

    return render_template("setup.html", error=error)

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        return redirect(url_for("dashboard.index"))

    admin_configured = AuthService.is_admin_configured()
    supabase_configured = SupabaseService.is_configured()
    error = None
    success_msg = request.args.get("message")

    if request.method == "POST":
        if not admin_configured and not supabase_configured:
            error = "Administrator account is not configured. Please define ADMIN_USERNAME and ADMIN_PASSWORD in your .env file."
            return render_template("login.html", error=error, admin_configured=admin_configured, supabase_configured=supabase_configured), 400

        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        if not username or not password:
            error = "Both username and password are required."
            return render_template("login.html", error=error, admin_configured=admin_configured, supabase_configured=supabase_configured), 400

        success, msg, user = AuthService.authenticate(username, password)
        if success and user:
            session.permanent = True
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            return redirect(url_for("dashboard.index"))

        error = msg
        return render_template("login.html", error=error, admin_configured=admin_configured, supabase_configured=supabase_configured), 401

    return render_template("login.html", error=error, success_msg=success_msg, admin_configured=admin_configured, supabase_configured=supabase_configured)

@auth_bp.route("/signup", methods=["GET", "POST"])
def signup():
    if session.get("user_id"):
        return redirect(url_for("dashboard.index"))

    supabase_configured = SupabaseService.is_configured()
    if not supabase_configured:
        return render_template("signup.html", error="Supabase authentication is not yet configured. Please configure SUPABASE_URL and SUPABASE_ANON_KEY in .env.", supabase_configured=False)

    error = None
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        if not email or "@" not in email:
            error = "Please enter a valid email address."
        elif not password or len(password) < 6:
            error = "Password must be at least 6 characters."
        elif password != confirm_password:
            error = "Passwords do not match."
        else:
            redirect_url = url_for("auth.auth_callback", _external=True)
            res = SupabaseService.sign_up(email, password, redirect_url=redirect_url)
            if res.get("success"):
                if res.get("requires_verification"):
                    return render_template(
                        "verify_notice.html",
                        email=email,
                        title="Check your email",
                        message=f"We have sent a verification link to {email}. Please verify your email before logging in."
                    )
                else:
                    # User confirmed automatically
                    db = get_db()
                    local_user_id = SupabaseService.sync_user_to_db(res["user"], db)
                    if local_user_id:
                        session.permanent = True
                        session["user_id"] = local_user_id
                        session["username"] = email.split("@")[0]
                        return redirect(url_for("dashboard.index"))
                    return redirect(url_for("auth.login", message="Account created! You can now log in."))
            else:
                error = res.get("error", "Failed to create account.")

    return render_template("signup.html", error=error, supabase_configured=True)

@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if session.get("user_id"):
        return redirect(url_for("dashboard.index"))

    supabase_configured = SupabaseService.is_configured()
    if not supabase_configured:
        return render_template("forgot_password.html", error="Password reset requires Supabase Auth to be configured in .env.", supabase_configured=False)

    error = None
    success_msg = None

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        if not email or "@" not in email:
            error = "Please enter a valid email address."
        else:
            redirect_url = url_for("auth.reset_password", _external=True)
            res = SupabaseService.reset_password_for_email(email, redirect_url=redirect_url)
            if res.get("success"):
                success_msg = f"If an account exists for {email}, a password reset link has been sent. Please check your email."
            else:
                error = res.get("error", "Unable to send password reset email.")

    return render_template("forgot_password.html", error=error, success_msg=success_msg, supabase_configured=True)

@auth_bp.route("/reset-password", methods=["GET", "POST"])
def reset_password():
    token = request.args.get("token") or request.form.get("token") or session.get("recovery_token")
    error = None

    if request.method == "POST":
        new_password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        token = request.form.get("token") or session.get("recovery_token")

        if not new_password or len(new_password) < 6:
            error = "Password must be at least 6 characters."
        elif new_password != confirm:
            error = "Passwords do not match."
        elif not token:
            error = "Reset token is missing or has expired. Please request a new link."
        else:
            res = SupabaseService.update_password(token, new_password)
            if res.get("success"):
                session.pop("recovery_token", None)
                return redirect(url_for("auth.login", message="Your password has been successfully reset. Please log in with your new password."))
            else:
                error = res.get("error", "Failed to update password.")

    return render_template("reset_password.html", token=token, error=error)

@auth_bp.route("/auth/callback")
def auth_callback():
    """
    Handles redirect callbacks from Supabase email verification and password reset.
    Works with both server query params (PKCE code) and client-side hash fragments.
    """
    code = request.args.get("code")
    token_hash = request.args.get("token_hash")
    auth_type = request.args.get("type", "email")

    if code:
        client = SupabaseService.get_client()
        if client:
            try:
                res = client.auth.exchange_code_for_session({"auth_code": code})
                if res and res.session:
                    if auth_type == "recovery":
                        session["recovery_token"] = res.session.access_token
                        return redirect(url_for("auth.reset_password"))
                    
                    db = get_db()
                    local_user_id = SupabaseService.sync_user_to_db(res.user, db)
                    if local_user_id:
                        session.permanent = True
                        session["user_id"] = local_user_id
                        session["username"] = res.user.email.split("@")[0]
                        return redirect(url_for("dashboard.index"))
            except Exception as e:
                logger.warning("Code exchange failed: %s", e)

    # If hash fragment handling or direct landing is needed:
    return render_template("auth_callback.html")

@auth_bp.route("/api/auth/session", methods=["POST"])
def set_auth_session():
    """Endpoint for frontend JS to exchange a Supabase access token for a Flask session."""
    data = request.get_json(silent=True) or {}
    access_token = data.get("access_token")
    if not access_token:
        return jsonify({"success": False, "error": "Token missing"}), 400

    user = SupabaseService.get_user_from_token(access_token)
    if not user:
        return jsonify({"success": False, "error": "Invalid token"}), 401

    db = get_db()
    local_user_id = SupabaseService.sync_user_to_db(user, db)
    if not local_user_id:
        return jsonify({"success": False, "error": "Failed to map user"}), 500

    session.permanent = True
    session["user_id"] = local_user_id
    session["username"] = (user.email or "user").split("@")[0]
    return jsonify({"success": True, "redirect_url": url_for("dashboard.index")})

@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    return redirect(url_for("auth.login"))
