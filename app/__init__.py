import logging
from flask import Flask
from flask_wtf.csrf import CSRFProtect
from config import Config
from app.models.database import close_db, init_db
from app.services.render_service import RenderService

csrf = CSRFProtect()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Logging setup
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )

    # Setup CSRF
    csrf.init_app(app)

    # DB teardown
    app.teardown_appcontext(close_db)

    # Initialize Database Schema & Sync Default Admin
    with app.app_context():
        init_db(app)
        # Automatically sync administrator account from environment if configured
        # (In testing mode, only sync if AUTO_SYNC_ADMIN is explicitly enabled)
        if not app.config.get("TESTING", False) or app.config.get("AUTO_SYNC_ADMIN", False):
            from app.services.auth_service import AuthService
            if AuthService.is_admin_configured():
                AuthService.sync_admin_user()

    # Register Blueprints
    from app.blueprints.auth import auth_bp
    from app.blueprints.dashboard import dashboard_bp
    from app.blueprints.editor import editor_bp
    from app.blueprints.api import api_bp

    csrf.exempt(api_bp)

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(editor_bp)
    app.register_blueprint(api_bp)

    # Template filters
    @app.template_filter("format_date")
    def format_date_filter(val):
        if not val:
            return "Just now"
        if hasattr(val, "strftime"):
            return val.strftime("%b %d, %Y")
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(str(val).replace(" ", "T"))
            return dt.strftime("%b %d, %Y")
        except Exception:
            return str(val)[:10]

    @app.template_filter("rjust")
    def rjust_filter(val, width, fillchar=" "):
        return str(val).rjust(int(width), fillchar)

    # Health check endpoint
    @app.route("/health")
    def health():
        return {"status": "healthy", "service": "LyricStudio"}, 200

    # Start background render worker
    RenderService.start_worker()

    return app
