from flask import Blueprint, render_template, session, abort
from app.utils.security import login_required
from app.services.project_service import ProjectService

editor_bp = Blueprint("editor", __name__)

@editor_bp.route("/editor/<project_id>")
@login_required
def open_editor(project_id: str):
    from flask import request
    user_id = session["user_id"]
    project = ProjectService.get_project(project_id, user_id)
    if not project:
        abort(404, "Project not found")

    if request.args.get("legacy") == "1":
        return render_template(
            "editor_legacy.html",
            project=project,
            username=session.get("username", "Owner")
        )

    return render_template(
        "editor.html",
        project=project,
        username=session.get("username", "Owner")
    )

