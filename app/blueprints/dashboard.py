from flask import Blueprint, render_template, session, redirect, url_for
from app.utils.security import login_required
from app.services.project_service import ProjectService
from app.services.storage_service import StorageService
from config import Config

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/")
def root():
    if not session.get("user_id"):
        return redirect(url_for("auth.login"))
    return redirect(url_for("dashboard.index"))

@dashboard_bp.route("/dashboard")
@login_required
def index():
    user_id = session["user_id"]
    projects = ProjectService.list_projects(user_id)
    if not projects:
        try:
            from app.utils.sample_seed import seed_sample_project
            seed_sample_project(user_id)
            projects = ProjectService.list_projects(user_id)
        except Exception as e:
            pass

    storage_bytes = StorageService.get_user_storage_bytes(user_id)
    storage_mb = round(storage_bytes / (1024 * 1024), 1)
    max_storage_mb = Config.MAX_STORAGE_PER_USER_MB

    return render_template(
        "dashboard.html",
        username=session.get("username", "Owner"),
        projects=projects,
        storage_mb=storage_mb,
        max_storage_mb=max_storage_mb
    )

@dashboard_bp.route("/design-system")
def design_system():
    return render_template(
        "design_system.html",
        username=session.get("username", "Owner") if session.get("user_id") else None
    )

