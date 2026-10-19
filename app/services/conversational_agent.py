"""Conversational Editing Agent for LyricStudio.
Translates natural language user instructions into validated, atomic project mutations
inspired by the OpusClip AI Producer workflow.

Features:
- Connects directly to persistent project data in SQLite.
- Preserves unrelated project properties while applying targeted modifications.
- Supports undo/redo via project state snapshots.
- Works with Google Gemini API when configured, with a comprehensive, deterministic
  local natural language rule-based parsing engine fallback.
"""

import os
import re
import json
import uuid
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.models.database import get_db, get_standalone_db
from app.services.project_service import ProjectService
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

VALID_ANIMATION_TYPES = {
    "cinematic-rise",
    "blur-focus",
    "tracking-reveal",
    "fade-darkness",
    "beat-pulse",
    "scale-drift",
    "word-highlight",
    "typewriter"
}

VALID_FONTS = {
    "playfair": "'Playfair Display', serif",
    "cinzel": "'Cinzel', serif",
    "fraunces": "'Fraunces', serif",
    "garamond": "'Cormorant Garamond', serif",
    "inter": "'Inter', sans-serif",
    "geist": "'Geist', sans-serif",
    "outfit": "'Outfit', sans-serif",
    "space": "'Space Grotesk', sans-serif",
    "syne": "'Syne', sans-serif",
    "mono": "'JetBrains Mono', monospace"
}


class ConversationalAgent:

    @classmethod
    def get_chat_history(cls, project_id: str, user_id: int) -> List[Dict[str, Any]]:
        """Retrieves persistent chat conversation history for a project."""
        db = cls._get_connection()
        try:
            rows = db.execute("""
                SELECT id, role, message, summary, applied_changes, created_at
                FROM project_chat_messages
                WHERE project_id = ? AND user_id = ?
                ORDER BY created_at ASC
            """, (project_id, user_id)).fetchall()

            history = []
            for r in rows:
                item = dict(r)
                if isinstance(item.get("applied_changes"), str):
                    try:
                        item["applied_changes"] = json.loads(item["applied_changes"])
                    except Exception:
                        item["applied_changes"] = []
                history.append(item)
            return history
        finally:
            cls._close_connection(db)

    @classmethod
    def chat(
        cls,
        project_id: str,
        user_id: int,
        message: str,
        current_time: float = 0.0
    ) -> Dict[str, Any]:
        """
        Main entry point for conversational edits.
        Parses intent, applies validated project changes, and returns an explanatory summary.
        """
        clean_msg = message.strip()
        if not clean_msg:
            return {"success": False, "error": "Message cannot be empty."}

        project = ProjectService.get_project(project_id, user_id)
        if not project:
            return {"success": False, "error": "Project not found."}

        # 1. Record incoming user message
        cls._record_chat_message(project_id, user_id, "user", clean_msg)

        # 2. Check for explicit undo requests
        if re.search(r"\b(undo|revert|step\s*back|undo\s*last\s*change|take\s*that\s*back)\b", clean_msg, re.IGNORECASE):
            return cls.undo_last_change(project_id, user_id)

        # 3. Save pre-edit snapshot for reliable undo
        cls._save_snapshot(project_id, user_id, project, f"Before: '{clean_msg[:40]}'")

        # 4. Determine edits using Gemini or local heuristic parser
        edit_plan = cls._determine_edits(clean_msg, project, current_time)

        # 5. Apply validated edits to project
        applied_changes = []
        project_updates: Dict[str, Any] = {}

        # A. Template updates
        if "template" in edit_plan and edit_plan["template"]:
            current_template = dict(project.get("template_data") or {})
            template_diff = cls._apply_template_edits(current_template, edit_plan["template"])
            if template_diff["changed"]:
                project_updates["template_data"] = template_diff["new_template"]
                applied_changes.extend(template_diff["changes"])

        # B. Scene updates
        if "scene" in edit_plan and edit_plan["scene"]:
            scene_diff = cls._apply_scene_edits(project, edit_plan["scene"], current_time)
            if scene_diff["changed"]:
                project_updates["scene_data"] = scene_diff["new_scenes"]
                applied_changes.extend(scene_diff["changes"])

        # C. General project updates (e.g. title, aspect ratio)
        if "project" in edit_plan and edit_plan["project"]:
            for k, val in edit_plan["project"].items():
                if k in ("title", "aspect_ratio", "fps") and project.get(k) != val:
                    applied_changes.append({
                        "field": k,
                        "old_value": project.get(k),
                        "new_value": val,
                        "description": f"Updated {k} to {val}"
                    })
                    project_updates[k] = val

        # 6. Persist updates
        if project_updates:
            ProjectService.update_project(project_id, user_id, project_updates)

        # 7. Generate user-facing response summary
        summary = edit_plan.get("summary")
        if not summary:
            if applied_changes:
                summary = "Applied changes: " + "; ".join(c["description"] for c in applied_changes) + "."
            else:
                summary = "I reviewed your project and current settings, but no modifications were necessary for that request."

        # 8. Record assistant response in chat history
        cls._record_chat_message(project_id, user_id, "assistant", summary, summary=summary, applied_changes=applied_changes)

        updated_project = ProjectService.get_project(project_id, user_id)
        return {
            "success": True,
            "action": "edit",
            "summary": summary,
            "applied_changes": applied_changes,
            "project": updated_project,
            "can_undo": True
        }

    @classmethod
    def undo_last_change(cls, project_id: str, user_id: int) -> Dict[str, Any]:
        """Restores the most recent project snapshot from undo history."""
        db = cls._get_connection()
        try:
            snapshot = db.execute("""
                SELECT id, snapshot_data, description, created_at
                FROM project_snapshots
                WHERE project_id = ? AND user_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            """, (project_id, user_id)).fetchone()

            if not snapshot:
                msg = "No previous changes available to undo."
                cls._record_chat_message(project_id, user_id, "assistant", msg)
                return {
                    "success": False,
                    "action": "undo",
                    "error": msg,
                    "summary": msg,
                    "project": ProjectService.get_project(project_id, user_id),
                    "can_undo": False
                }

            # Parse snapshot data
            data = json.loads(snapshot["snapshot_data"])

            # Restore project fields
            restore_updates = {
                "title": data.get("title"),
                "aspect_ratio": data.get("aspect_ratio"),
                "duration": data.get("duration"),
                "lyrics_data": data.get("lyrics_data", []),
                "timeline_data": data.get("timeline_data", {}),
                "template_data": data.get("template_data", {}),
                "scene_data": data.get("scene_data", [])
            }
            ProjectService.update_project(project_id, user_id, restore_updates)

            # Delete the restored snapshot so subsequent undo steps back further
            db.execute("DELETE FROM project_snapshots WHERE id = ?", (snapshot["id"],))
            db.commit()

            summary = f"Undid the last change ({snapshot['description'] or 'Restored previous state'})."
            cls._record_chat_message(project_id, user_id, "assistant", summary, summary=summary)

            restored_project = ProjectService.get_project(project_id, user_id)
            return {
                "success": True,
                "action": "undo",
                "summary": summary,
                "applied_changes": [{"field": "state", "description": "Reverted project state to previous snapshot"}],
                "project": restored_project,
                "can_undo": True
            }
        finally:
            cls._close_connection(db)

    # =========================================================================
    # INTENT PARSING & DETERMINISTIC EDIT ENGINE
    # =========================================================================

    @classmethod
    def _determine_edits(cls, message: str, project: Dict[str, Any], current_time: float) -> Dict[str, Any]:
        """
        Translates natural language command to structured edit plan.
        Tries Gemini if configured; falls back to local comprehensive regex/heuristic parser.
        """
        api_key = AIService.get_gemini_key()
        if api_key:
            try:
                plan = cls._call_gemini_editor(message, project, current_time, api_key)
                if plan:
                    return plan
            except Exception as e:
                logger.warning("Gemini conversational edit failed, falling back to local heuristic: %s", e)

        return cls._parse_heuristic_intent(message, project, current_time)

    @classmethod
    def _call_gemini_editor(
        cls,
        message: str,
        project: Dict[str, Any],
        current_time: float,
        api_key: str
    ) -> Optional[Dict[str, Any]]:
        """Invokes Gemini structured output to parse editing intent."""
        from google import genai
        client = genai.Client(
            api_key=api_key,
            http_options={"timeout": 6000, "retry_options": {"attempts": 1}}
        )

        template = project.get("template_data") or {}
        system_instruction = (
            "You are LyricStudio's autonomous AI Video Editor Agent. "
            "A user is giving you conversational directions to modify an animated music lyric video project. "
            "Translate the instruction into atomic, valid project modifications. "
            "Valid font families: 'Playfair Display', serif; 'Cinzel', serif; 'Fraunces', serif; "
            "'Cormorant Garamond', serif; 'Inter', sans-serif; 'Outfit', sans-serif; 'Space Grotesk', sans-serif; 'JetBrains Mono', monospace. "
            "Valid animation_type: 'cinematic-rise', 'blur-focus', 'tracking-reveal', 'fade-darkness', 'beat-pulse', 'scale-drift', 'word-highlight', 'typewriter'. "
            "Valid colors: hex strings like #B6FF3B (Solar Lime accent), #0C1A2B (Circuit Navy), #F1EFEA, etc. "
            "Return ONLY a JSON object with: "
            "{ \"summary\": \"Friendly 1-2 sentence explanation of changes\", "
            "  \"template\": { key: new_value }, "
            "  \"scene\": { \"transition\": \"...\", \"zoom\": ... }, "
            "  \"project\": { ... } }"
        )

        prompt = (
            f"Current Project Context:\n"
            f"- Title: {project.get('title')}\n"
            f"- Current Playhead: {current_time:.2f}s\n"
            f"- Template Settings: {json.dumps(template)}\n\n"
            f"User Edit Request: \"{message}\"\n\n"
            f"Return ONLY valid JSON:"
        )

        models = [os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"), "gemini-2.5-flash", "gemini-1.5-flash"]
        for m in models:
            try:
                resp = client.models.generate_content(
                    model=m,
                    contents=prompt,
                    config={"system_instruction": system_instruction}
                )
                raw = resp.text.strip()
                if raw.startswith("```"):
                    raw = re.sub(r"^```(?:json)?\s*", "", raw)
                    raw = re.sub(r"\s*```$", "", raw)
                data = json.loads(raw)
                if isinstance(data, dict):
                    return data
            except Exception:
                continue

        return None

    @classmethod
    def _parse_heuristic_intent(cls, message: str, project: Dict[str, Any], current_time: float) -> Dict[str, Any]:
        """
        Deterministic, rule-based natural language parser supporting all reference commands
        and creative modifications when Gemini is offline or unavailable.
        """
        m = message.lower()
        t_updates: Dict[str, Any] = {}
        s_updates: Dict[str, Any] = {}
        p_updates: Dict[str, Any] = {}
        explanations = []

        cfg = project.get("template_data") or {}

        # 1. "Make the video more cinematic and atmospheric"
        if re.search(r"\b(cinematic|atmospheric|film look|movie look)\b", m):
            t_updates["font_family"] = "'Cinzel', serif"
            t_updates["animation_type"] = "cinematic-rise"
            t_updates["position_y"] = 80
            t_updates["overlay_opacity"] = 0.45
            t_updates["bg_blur"] = 8
            t_updates["letter_spacing"] = 3.0
            t_updates["outline_color"] = "#0C1A2B"
            t_updates["highlight_color"] = "#B6FF3B"
            explanations.append("Applied cinematic styling: Switched to Cinzel editorial serif, atmospheric overlay dimming (45%), soft blur (8px), and slow cinematic rising motion")

        # 2. "Highlight each word in sync with the vocals"
        if re.search(r"\b(highlight each word|word by word|word-by-word|karaoke|sing along)\b", m):
            t_updates["animation_type"] = "word-highlight"
            t_updates["highlight_color"] = "#B6FF3B"
            t_updates["glow_color"] = "#B6FF3B"
            t_updates["glow_size"] = 22
            explanations.append("Enabled word-by-word singing highlights in sync with vocal audio using Solar Lime (#B6FF3B) glow bloom")

        # 3. "Make the chorus more energetic" / "more energy" / "punchy"
        if re.search(r"\b(energetic|energy|punchy|upbeat|fast|pulse)\b", m):
            t_updates["animation_type"] = "beat-pulse"
            t_updates["beat_pulse"] = True
            t_updates["font_weight"] = "800"
            t_updates["outline_width"] = 3
            t_updates["glow_size"] = 24
            explanations.append("Increased motion energy: Enabled beat-reactive pulse animation, bold font weight, and reinforced outlines")

        # 4. "Use slower camera motion during the verse" / "slow motion" / "gentle drift"
        if re.search(r"\b(slower|slow motion|gentle|smooth drift|slow camera)\b", m):
            t_updates["animation_duration"] = 0.85
            t_updates["ken_burns"] = True
            t_updates["bg_pan_speed"] = 0.5
            explanations.append("Slowed transition timing to 0.85s and engaged smooth, gentle camera drift")

        # 5. Position adjustments: "Move the lyrics lower / higher / center"
        if re.search(r"\b(lower|bottom|down)\b", m) and re.search(r"\b(lyric|lyrics|text|subtitle)\b", m):
            curr_y = int(cfg.get("position_y", 78))
            new_y = min(90, curr_y + 8)
            t_updates["position_y"] = new_y
            explanations.append(f"Moved lyric placement lower to {new_y}% from top")
        elif re.search(r"\b(higher|top|up)\b", m) and re.search(r"\b(lyric|lyrics|text|subtitle)\b", m):
            curr_y = int(cfg.get("position_y", 78))
            new_y = max(25, curr_y - 8)
            t_updates["position_y"] = new_y
            explanations.append(f"Moved lyric placement higher to {new_y}% from top")
        elif re.search(r"\b(center|middle)\b", m) and re.search(r"\b(position|placement)\b", m):
            t_updates["position_y"] = 50
            t_updates["text_align"] = "center"
            explanations.append("Centered lyrics vertically (50%) and horizontally")

        # 6. Size adjustments: "Make them larger / smaller"
        if re.search(r"\b(larger|bigger|increase size|huge)\b", m) and re.search(r"\b(text|lyrics?|font|size|them|words?)\b", m):
            curr_size = int(cfg.get("font_size", 48))
            new_size = min(120, curr_size + 14)
            t_updates["font_size"] = new_size
            explanations.append(f"Enlarged font size to {new_size}pt")
        elif re.search(r"\b(smaller|decrease size|tiny)\b", m) and re.search(r"\b(text|lyrics?|font|size|them|words?)\b", m):
            curr_size = int(cfg.get("font_size", 48))
            new_size = max(24, curr_size - 10)
            t_updates["font_size"] = new_size
            explanations.append(f"Reduced font size to {new_size}pt")

        # 7. Alignment: left, right, center
        if re.search(r"\balign left\b", m) or re.search(r"\bleft align\b", m):
            t_updates["text_align"] = "left"
            explanations.append("Set text alignment to left")
        elif re.search(r"\balign right\b", m) or re.search(r"\bright align\b", m):
            t_updates["text_align"] = "right"
            explanations.append("Set text alignment to right")

        # 8. Color changes
        if re.search(r"\b(lime|solar lime|neon green)\b", m):
            t_updates["highlight_color"] = "#B6FF3B"
            t_updates["glow_color"] = "#B6FF3B"
            explanations.append("Updated accent and highlight color to Solar Lime (#B6FF3B)")
        elif re.search(r"\b(gold|yellow|amber)\b", m):
            t_updates["highlight_color"] = "#FACC15"
            t_updates["glow_color"] = "#FACC15"
            explanations.append("Updated highlight color to Warm Gold (#FACC15)")
        elif re.search(r"\b(cyan|sky|blue)\b", m):
            t_updates["highlight_color"] = "#38BDF8"
            t_updates["glow_color"] = "#38BDF8"
            explanations.append("Updated highlight color to Neon Cyan (#38BDF8)")
        elif re.search(r"\b(purple|violet|magenta)\b", m):
            t_updates["highlight_color"] = "#C084FC"
            t_updates["glow_color"] = "#C084FC"
            explanations.append("Updated highlight color to Electric Violet (#C084FC)")

        # 9. Font family changes
        for font_key, font_val in VALID_FONTS.items():
            if re.search(rf"\b{font_key}\b", m):
                t_updates["font_family"] = font_val
                font_label = font_val.split(",")[0].replace("'", "")
                explanations.append(f"Changed typography font to {font_label}")
                break

        # 10. Blur and dimming
        if re.search(r"\b(more blur|blur background|soften background)\b", m):
            t_updates["bg_blur"] = min(25, int(cfg.get("bg_blur", 0)) + 6)
            explanations.append(f"Increased background blur to {t_updates['bg_blur']}px")
        if re.search(r"\b(darker|dim background|more dark)\b", m):
            t_updates["overlay_opacity"] = min(0.85, float(cfg.get("overlay_opacity", 0.38)) + 0.15)
            explanations.append(f"Darkened background overlay to {int(t_updates['overlay_opacity'] * 100)}%")

        # 11. "Change the visuals for this scene" / "scene visuals"
        if re.search(r"\b(visuals for this scene|change visuals|scene visual|backdrop)\b", m):
            s_updates["action"] = "rotate_visual"
            s_updates["timestamp"] = current_time
            explanations.append("Updated visual styling and atmosphere for the current scene")

        summary = " ".join(explanations) if explanations else "Processed request."
        return {
            "summary": summary,
            "template": t_updates,
            "scene": s_updates,
            "project": p_updates
        }

    # =========================================================================
    # ATOMIC DIFF & MUTATION APPLICATION
    # =========================================================================

    @classmethod
    def _apply_template_edits(cls, current_template: Dict[str, Any], edits: Dict[str, Any]) -> Dict[str, Any]:
        """Validates and applies template modifications, capturing exact changes."""
        changes = []
        new_template = dict(current_template)

        for key, val in edits.items():
            old_val = current_template.get(key)
            if old_val == val:
                continue

            # Bounds & validations
            if key == "font_size":
                val = max(16, min(140, int(val)))
            elif key in ("position_y", "position_x"):
                val = max(10, min(92, int(val)))
            elif key == "overlay_opacity":
                val = round(max(0.0, min(0.9, float(val))), 2)
            elif key == "bg_blur":
                val = max(0, min(30, int(val)))
            elif key == "animation_duration":
                val = round(max(0.1, min(2.5, float(val))), 2)
            elif key == "animation_type" and val not in VALID_ANIMATION_TYPES:
                continue

            new_template[key] = val
            changes.append({
                "field": f"template.{key}",
                "old_value": old_val,
                "new_value": val,
                "description": f"Updated {key.replace('_', ' ')}: '{old_val}' → '{val}'"
            })

        return {
            "changed": len(changes) > 0,
            "new_template": new_template,
            "changes": changes
        }

    @classmethod
    def _apply_scene_edits(cls, project: Dict[str, Any], edits: Dict[str, Any], current_time: float) -> Dict[str, Any]:
        """Applies targeted modifications to structured scenes."""
        scenes = list(project.get("scene_data") or [])
        if not scenes:
            return {"changed": False, "new_scenes": [], "changes": []}

        changes = []
        # Find active scene at current playhead
        active_idx = 0
        for i, sc in enumerate(scenes):
            if sc.get("start", 0) <= current_time <= sc.get("end", 9999):
                active_idx = i
                break

        target_scene = dict(scenes[active_idx])
        if edits.get("action") == "rotate_visual":
            # Cycle atmosphere preset
            presets = ["neon_night", "midnight_cinema", "dream_sequence", "retro_wave"]
            curr_p = target_scene.get("atmosphere", {}).get("preset", "midnight_cinema")
            next_p = presets[(presets.index(curr_p) + 1) % len(presets)] if curr_p in presets else "neon_night"

            target_scene["atmosphere"] = target_scene.get("atmosphere") or {}
            target_scene["atmosphere"]["preset"] = next_p
            scenes[active_idx] = target_scene

            changes.append({
                "field": f"scene_{active_idx}.atmosphere",
                "old_value": curr_p,
                "new_value": next_p,
                "description": f"Shifted Scene {active_idx + 1} visual atmosphere to '{next_p}'"
            })

        return {
            "changed": len(changes) > 0,
            "new_scenes": scenes,
            "changes": changes
        }

    # =========================================================================
    # SNAPSHOT & HISTORY HELPERS
    # =========================================================================

    @classmethod
    def _save_snapshot(cls, project_id: str, user_id: int, project: Dict[str, Any], description: str):
        """Stores a snapshot of the project state to enable multi-step undo."""
        db = cls._get_connection()
        try:
            snapshot_id = str(uuid.uuid4())
            snapshot_content = json.dumps({
                "title": project.get("title"),
                "aspect_ratio": project.get("aspect_ratio"),
                "duration": project.get("duration"),
                "lyrics_data": project.get("lyrics_data"),
                "timeline_data": project.get("timeline_data"),
                "template_data": project.get("template_data"),
                "scene_data": project.get("scene_data")
            })

            db.execute("""
                INSERT INTO project_snapshots (id, project_id, user_id, snapshot_data, description)
                VALUES (?, ?, ?, ?, ?)
            """, (snapshot_id, project_id, user_id, snapshot_content, description))

            # Maintain maximum 15 snapshots per project to limit DB growth
            db.execute("""
                DELETE FROM project_snapshots
                WHERE project_id = ? AND id NOT IN (
                    SELECT id FROM project_snapshots
                    WHERE project_id = ?
                    ORDER BY created_at DESC
                    LIMIT 15
                )
            """, (project_id, project_id))
            db.commit()
        finally:
            cls._close_connection(db)

    @classmethod
    def _record_chat_message(
        cls,
        project_id: str,
        user_id: int,
        role: str,
        message: str,
        summary: str = "",
        applied_changes: Optional[List[Dict[str, Any]]] = None
    ):
        """Persists a chat exchange message."""
        db = cls._get_connection()
        try:
            msg_id = str(uuid.uuid4())
            changes_json = json.dumps(applied_changes or [])
            db.execute("""
                INSERT INTO project_chat_messages (id, project_id, user_id, role, message, summary, applied_changes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (msg_id, project_id, user_id, role, message, summary, changes_json))
            db.commit()
        finally:
            cls._close_connection(db)

    @classmethod
    def _get_connection(cls):
        try:
            from flask import has_app_context
            if has_app_context():
                return get_db()
        except Exception:
            pass
        return get_standalone_db()

    @classmethod
    def _close_connection(cls, db):
        try:
            from flask import has_app_context
            if has_app_context():
                return
        except Exception:
            pass
        try:
            db.close()
        except Exception:
            pass
