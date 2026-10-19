import json
from pathlib import Path
from flask import Blueprint, request, jsonify, session, send_file, Response, abort
from app.utils.security import login_required
from app.services.project_service import ProjectService
from app.services.storage_service import StorageService
from app.services.sync_service import SyncService
from app.services.render_service import RenderService
from app.services.ai_service import AIService
from app.models.database import get_db
from config import RENDERS_DIR

api_bp = Blueprint("api", __name__, url_prefix="/api")

# --- Projects ---

@api_bp.route("/projects", methods=["GET", "POST"])
@login_required
def handle_projects():
    user_id = session["user_id"]
    if request.method == "GET":
        projects = ProjectService.list_projects(user_id)
        return jsonify({"success": True, "projects": projects})

    data = request.get_json() or {}
    title = data.get("title", "New Lyric Project")
    aspect_ratio = data.get("aspect_ratio", "16:9")
    quality = data.get("quality", "1080p")
    template_id = data.get("template_id", "midnight_cinema")

    project = ProjectService.create_project(user_id, title, aspect_ratio, quality)
    if template_id and template_id != "midnight_cinema":
        ProjectService.update_project(project["id"], user_id, {"template_id": template_id})
        project["template_id"] = template_id
    if "lyrics" in data and isinstance(data["lyrics"], list):
        ProjectService.update_project(project["id"], user_id, {"lyrics_data": data["lyrics"]})
        project["lyrics"] = data["lyrics"]
    return jsonify({"success": True, "project": project}), 201

@api_bp.route("/projects/<project_id>", methods=["GET"])
@login_required
def get_project(project_id: str):
    user_id = session["user_id"]
    project = ProjectService.get_project(project_id, user_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    return jsonify({"success": True, "project": project})

@api_bp.route("/projects/<project_id>", methods=["PUT"])
@login_required
def update_project(project_id: str):
    user_id = session["user_id"]
    data = request.get_json() or {}
    success = ProjectService.update_project(project_id, user_id, data)
    if not success:
        return jsonify({"error": "Failed to update project"}), 400
    return jsonify({"success": True, "message": "Project saved successfully"})

@api_bp.route("/projects/<project_id>/duplicate", methods=["POST"])
@login_required
def duplicate_project(project_id: str):
    user_id = session["user_id"]
    new_proj = ProjectService.duplicate_project(project_id, user_id)
    if not new_proj:
        return jsonify({"error": "Failed to duplicate project"}), 404
    return jsonify({"success": True, "project": new_proj})

@api_bp.route("/projects/<project_id>", methods=["DELETE"])
@login_required
def delete_project(project_id: str):
    user_id = session["user_id"]
    success = ProjectService.delete_project(project_id, user_id)
    if not success:
        return jsonify({"error": "Failed to delete project"}), 404
    return jsonify({"success": True, "message": "Project deleted successfully"})

# --- Assets & Uploads ---

@api_bp.route("/projects/<project_id>/upload", methods=["POST"])
@login_required
def upload_asset(project_id: str):
    user_id = session["user_id"]
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    asset_type = request.form.get("asset_type", "image")

    try:
        asset_info = StorageService.save_uploaded_file(file, user_id, project_id, asset_type)
        
        # If this is audio, automatically link as audio_asset_id if none set
        if asset_type == "audio":
            db = get_db()
            proj = db.execute("SELECT audio_asset_id FROM projects WHERE id = ?", (project_id,)).fetchone()
            if proj and not proj["audio_asset_id"]:
                db.execute("UPDATE projects SET audio_asset_id = ?, duration = ? WHERE id = ?", 
                           (asset_info["id"], asset_info["duration"], project_id))
                db.commit()

        return jsonify({"success": True, "asset": asset_info}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except PermissionError as pe:
        return jsonify({"error": str(pe)}), 403
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@api_bp.route("/assets/<asset_id>/file", methods=["GET"])
@login_required
def get_asset_file(asset_id: str):
    user_id = session["user_id"]
    db = get_db()
    asset = db.execute("SELECT file_path, mime_type, original_name FROM assets WHERE id = ? AND user_id = ?", (asset_id, user_id)).fetchone()
    if not asset:
        abort(404, "Asset not found")

    file_path = Path(asset["file_path"])
    if not file_path.exists():
        abort(404, "File missing on server")

    return send_file(
        str(file_path),
        mimetype=asset["mime_type"],
        as_attachment=False,
        download_name=asset["original_name"]
    )

@api_bp.route("/assets/<asset_id>/waveform", methods=["GET"])
@login_required
def get_waveform(asset_id: str):
    user_id = session["user_id"]
    db = get_db()
    asset = db.execute("SELECT file_path, asset_type FROM assets WHERE id = ? AND user_id = ?", (asset_id, user_id)).fetchone()
    if not asset or asset["asset_type"] != "audio":
        return jsonify({"error": "Audio asset not found"}), 404

    peaks = SyncService.extract_waveform_peaks(asset["file_path"], num_peaks=800)
    return jsonify({"success": True, "peaks": peaks})

@api_bp.route("/assets/<asset_id>", methods=["DELETE"])
@login_required
def delete_asset(asset_id: str):
    user_id = session["user_id"]
    success = StorageService.delete_asset(asset_id, user_id)
    if not success:
        return jsonify({"error": "Asset not found"}), 404
    return jsonify({"success": True, "message": "Asset deleted successfully"})

# --- Lyrics & Synchronization ---

@api_bp.route("/projects/<project_id>/sync", methods=["POST"])
@login_required
def sync_lyrics(project_id: str):
    user_id = session["user_id"]
    data = request.get_json() or {}
    lyrics_text = data.get("text", "")
    format_type = data.get("format", "auto")  # auto, lrc, srt, plain

    project = ProjectService.get_project(project_id, user_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    audio_asset = project.get("audio_asset")
    audio_path = audio_asset.get("file_path") if audio_asset else None
    duration = float(audio_asset.get("duration", 30.0)) if audio_asset else 30.0

    lines = []
    # Auto detect format
    if format_type == "auto":
        if re_match := SyncService.parse_lrc(lyrics_text):
            lines = re_match
        elif re_srt := SyncService.parse_srt(lyrics_text):
            lines = re_srt
        else:
            format_type = "plain"

    if not lines and format_type == "lrc":
        lines = SyncService.parse_lrc(lyrics_text)
    elif not lines and format_type == "srt":
        lines = SyncService.parse_srt(lyrics_text)

    # If plain text or parsed lines were empty
    if not lines and lyrics_text.strip():
        if audio_path and Path(audio_path).exists():
            lines = SyncService.align_text_to_audio(lyrics_text, audio_path, duration)
        else:
            # Fallback estimation
            lines = SyncService.align_text_to_audio(lyrics_text, "", duration)

    # Save to project
    ProjectService.update_project(project_id, user_id, {"lyrics_data": lines})

    return jsonify({"success": True, "lyrics": lines})

@api_bp.route("/projects/<project_id>/sync/offset", methods=["POST"])
@login_required
def apply_offset(project_id: str):
    user_id = session["user_id"]
    data = request.get_json() or {}
    offset = float(data.get("offset", 0.0))

    project = ProjectService.get_project(project_id, user_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    current_lyrics = project.get("lyrics_data", [])
    adjusted = SyncService.apply_offset(current_lyrics, offset)
    ProjectService.update_project(project_id, user_id, {"lyrics_data": adjusted})

    return jsonify({"success": True, "lyrics": adjusted})

@api_bp.route("/projects/<project_id>/transcribe", methods=["POST"])
@login_required
def transcribe_lyrics(project_id: str):
    user_id = session["user_id"]
    project = ProjectService.get_project(project_id, user_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    audio_asset = project.get("audio_asset")
    if not audio_asset or not Path(audio_asset.get("file_path", "")).exists():
        return jsonify({"error": "Please upload a song audio file before transcribing vocals."}), 400

    duration = float(audio_asset.get("duration", 30.0))
    lines = SyncService.transcribe_vocals(audio_asset.get("file_path", ""), duration)

    ProjectService.update_project(project_id, user_id, {"lyrics_data": lines})
    return jsonify({"success": True, "lyrics": lines})

# --- AI Creative Director & Settings ---

@api_bp.route("/settings/ai", methods=["GET"])
@login_required
def get_ai_settings():
    is_conf = AIService.is_configured()
    key = AIService.get_gemini_key()
    masked_key = (key[:4] + "..." + key[-4:]) if len(key) >= 8 else ("Set" if key else "")
    return jsonify({
        "success": True,
        "configured": is_conf,
        "masked_key": masked_key,
        "provider": "Google Gemini (gemini-2.5-flash)"
    })

@api_bp.route("/settings/ai", methods=["POST"])
@login_required
def save_ai_settings():
    data = request.get_json() or {}
    key = data.get("gemini_api_key", "").strip()
    test_only = data.get("test_only", False)

    if test_only:
        test_res = AIService.test_connection(key)
        return jsonify(test_res)

    if key:
        test_res = AIService.test_connection(key)
        if not test_res.get("success"):
            return jsonify({"success": False, "error": f"Invalid API Key: {test_res.get('error')}"}), 400
        AIService.set_gemini_key(key)
        return jsonify({"success": True, "message": "Gemini API key saved and verified successfully!"})
    else:
        AIService.set_gemini_key("")
        return jsonify({"success": True, "message": "Gemini API key removed."})

@api_bp.route("/projects/<project_id>/ai/propose", methods=["POST"])
@login_required
def ai_propose_styles(project_id: str):
    user_id = session["user_id"]
    project = ProjectService.get_project(project_id, user_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # Extract lyrics text
    lyrics_data = project.get("lyrics_data", [])
    lyrics_text = "\n".join([l.get("text", "") for l in lyrics_data if l.get("text")])

    # Find background artwork if available
    artwork_path = None
    assets = project.get("assets", [])
    for a in assets:
        if a.get("asset_type") == "image":
            fp = a.get("file_path")
            if fp and Path(fp).exists():
                artwork_path = fp
                break

    audio_path = None
    if project.get("audio_asset"):
        audio_path = project["audio_asset"].get("file_path")

    result = AIService.propose_creative_direction(
        song_title=project.get("title", ""),
        lyrics_text=lyrics_text,
        artwork_path=artwork_path,
        audio_path=audio_path
    )
    return jsonify(result)

@api_bp.route("/projects/<project_id>/ai/apply", methods=["POST"])
@login_required
def ai_apply_proposal(project_id: str):
    user_id = session["user_id"]
    data = request.get_json() or {}
    proposal = data.get("proposal", {})
    if not proposal:
        return jsonify({"error": "No proposal data provided"}), 400

    project = ProjectService.get_project(project_id, user_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # Merge proposal into project template_data
    current_template = project.get("template_data", {})
    updated_template = dict(current_template)
    
    mapping_keys = [
        "preset", "template_id", "font_family", "font_size", "font_weight", "letter_spacing",
        "text_color", "highlight_color", "glow_color", "background_color", "outline_color",
        "outline_width", "position_y", "text_align", "animation_type", "animation_duration",
        "overlay_opacity", "bg_blur", "ken_burns"
    ]
    for k in mapping_keys:
        if k in proposal:
            updated_template[k] = proposal[k]
    if "preset" in proposal:
        updated_template["template_id"] = proposal["preset"]
        updated_template["preset"] = proposal["preset"]

    ProjectService.update_project(project_id, user_id, {"template_data": updated_template})
    return jsonify({"success": True, "template_data": updated_template})

# --- Rendering ---

@api_bp.route("/projects/<project_id>/render", methods=["POST"])
@login_required
def trigger_render(project_id: str):
    user_id = session["user_id"]
    data = request.get_json() or {}
    resolution = data.get("resolution", "1080p")
    fps = int(data.get("fps", 30))

    project = ProjectService.get_project(project_id, user_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    if not project.get("audio_asset"):
        return jsonify({"error": "Please upload an audio track before rendering."}), 400

    job_id = RenderService.queue_render(project, user_id, resolution=resolution, fps=fps)
    return jsonify({"success": True, "job_id": job_id})

@api_bp.route("/renders/<job_id>/status", methods=["GET"])
@login_required
def get_render_status(job_id: str):
    user_id = session["user_id"]
    db = get_db()
    row = db.execute("""
        SELECT id, project_id, status, progress, output_resolution, fps, output_file, error_message, created_at, completed_at
        FROM render_jobs WHERE id = ? AND user_id = ?
    """, (job_id, user_id)).fetchone()

    if not row:
        return jsonify({"error": "Render job not found"}), 404

    data = dict(row)
    data["download_url"] = f"/api/renders/{job_id}/download" if data["output_file"] else None
    return jsonify({"success": True, "job": data})

@api_bp.route("/renders/<job_id>/cancel", methods=["POST"])
@login_required
def cancel_render(job_id: str):
    user_id = session["user_id"]
    db = get_db()
    row = db.execute("SELECT id FROM render_jobs WHERE id = ? AND user_id = ?", (job_id, user_id)).fetchone()
    if not row:
        return jsonify({"error": "Render job not found"}), 404

    success = RenderService.cancel_job(job_id)
    return jsonify({"success": success})

@api_bp.route("/renders/<job_id>/download", methods=["GET"])
@login_required
def download_render(job_id: str):
    user_id = session["user_id"]
    db = get_db()
    row = db.execute("SELECT output_file FROM render_jobs WHERE id = ? AND user_id = ?", (job_id, user_id)).fetchone()
    if not row or not row["output_file"]:
        abort(404, "Rendered video file not found")

    file_path = RENDERS_DIR / row["output_file"]
    if not file_path.exists():
        abort(404, "Rendered file missing from disk")

    return send_file(
        str(file_path),
        mimetype="video/mp4",
        as_attachment=True,
        download_name=row["output_file"]
    )
