import os
import re
import uuid
import queue
import shutil
import logging
import threading
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from config import Config, RENDERS_DIR
from app.models.database import get_standalone_db

logger = logging.getLogger(__name__)

class RenderService:
    _job_queue = queue.Queue()
    _active_processes: dict[str, subprocess.Popen] = {}
    _worker_thread = None
    _lock = threading.Lock()
    _ass_filter_supported = None

    @classmethod
    def has_ass_filter(cls) -> bool:
        if cls._ass_filter_supported is not None:
            return cls._ass_filter_supported
        try:
            res = subprocess.run([Config.FFMPEG_BINARY, "-filters"], capture_output=True, text=True, timeout=5)
            cls._ass_filter_supported = bool(re.search(r"\b(ass|subtitles)\b", res.stdout))
        except Exception as e:
            logger.warning("Error checking FFmpeg filters: %s", e)
            cls._ass_filter_supported = False
        return cls._ass_filter_supported

    @classmethod
    def start_worker(cls):
        with cls._lock:
            if cls._worker_thread is None or not cls._worker_thread.is_alive():
                cls._worker_thread = threading.Thread(target=cls._worker_loop, daemon=True)
                cls._worker_thread.start()
                logger.info("Background video render worker started.")

    @classmethod
    def queue_render(cls, project_data: dict, user_id: int, resolution: str = "1080p", fps: int = 30) -> str:
        cls.start_worker()
        job_id = str(uuid.uuid4())
        db = get_standalone_db()
        try:
            db.execute("""
                INSERT INTO render_jobs (id, project_id, user_id, status, progress, output_resolution, fps)
                VALUES (?, ?, ?, 'pending', 0, ?, ?)
            """, (job_id, project_data["id"], user_id, resolution, fps))
            db.commit()
        finally:
            db.close()

        cls._job_queue.put({
            "job_id": job_id,
            "project_data": project_data,
            "user_id": user_id,
            "resolution": resolution,
            "fps": fps
        })
        return job_id

    @classmethod
    def cancel_job(cls, job_id: str) -> bool:
        with cls._lock:
            proc = cls._active_processes.get(job_id)
            if proc:
                try:
                    proc.terminate()
                    logger.info("Terminated render process for job %s", job_id)
                except Exception as e:
                    logger.error("Error terminating process: %s", e)

        db = get_standalone_db()
        try:
            db.execute("UPDATE render_jobs SET status = 'cancelled', updated_at = ? WHERE id = ?", (datetime.now(timezone.utc), job_id))
            db.commit()
            return True
        finally:
            db.close()

    @classmethod
    def _worker_loop(cls):
        while True:
            try:
                task = cls._job_queue.get()
                cls._execute_render_task(task)
                cls._job_queue.task_done()
            except Exception as e:
                logger.exception("Unexpected error in render worker loop: %s", e)

    @classmethod
    def _update_job_status(cls, job_id: str, status: str, progress: int = 0, output_file: str = None, error_msg: str = None):
        db = get_standalone_db()
        try:
            now = datetime.now(timezone.utc)
            completed_at = now if status in ("completed", "failed", "cancelled") else None
            db.execute("""
                UPDATE render_jobs
                SET status = ?, progress = ?, output_file = COALESCE(?, output_file),
                    error_message = ?, updated_at = ?, completed_at = COALESCE(?, completed_at)
                WHERE id = ?
            """, (status, progress, output_file, error_msg, now, completed_at, job_id))
            db.commit()
        finally:
            db.close()

    @classmethod
    def _color_to_ass(cls, hex_or_rgba: str, default: str = "&H00FFFFFF") -> str:
        """Converts web hex/rgba colors to ASS format &HAABBGGRR."""
        if not hex_or_rgba:
            return default
        hex_clean = hex_or_rgba.strip().lstrip("#")
        if len(hex_clean) == 6:
            r = hex_clean[0:2]
            g = hex_clean[2:4]
            b = hex_clean[4:6]
            return f"&H00{b.upper()}{g.upper()}{r.upper()}"
        elif len(hex_clean) == 8:
            r = hex_clean[0:2]
            g = hex_clean[2:4]
            b = hex_clean[4:6]
            a = hex_clean[6:8]
            return f"&H{a.upper()}{b.upper()}{g.upper()}{r.upper()}"
        return default

    @classmethod
    def _sec_to_ass_time(cls, seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int(round((seconds - int(seconds)) * 100))
        if cs >= 100:
            cs = 99
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    @classmethod
    def generate_ass_subtitles(cls, lyrics_data: list[dict], template: dict, width: int, height: int, output_path: Path):
        template_id = template.get("template_id", "cinematic")
        font_size = int(template.get("font_size", 48) * (height / 1080.0))
        primary_color = cls._color_to_ass(template.get("text_color", "#FFFFFF"), "&H00FFFFFF")
        secondary_color = cls._color_to_ass(template.get("highlight_color", "#00F2FE"), "&H00FEF200")
        outline_color = cls._color_to_ass(template.get("outline_color", "#000000"), "&H00000000")
        shadow_color = cls._color_to_ass(template.get("shadow_color", "#000000"), "&H80000000")

        # Alignment: 2 = Bottom-Center, 5 = Middle-Center, 8 = Top-Center
        pos_y = float(template.get("position_y", 78))
        alignment = 2 if pos_y > 60 else (5 if pos_y > 40 else 8)
        margin_v = int(height * (1.0 - (pos_y / 100.0))) if pos_y > 60 else int(height * (pos_y / 100.0))
        margin_v = max(30, margin_v)

        # Style specifics per template
        font_name = "Arial"
        outline_w = int(template.get("outline_width", 2))
        shadow_w = 3

        if template_id in ("midnight_cinema", "cinematic"):
            primary_color = cls._color_to_ass(template.get("text_color", "#F1EFEA"), "&H00EAEFF1")
            outline_color = cls._color_to_ass(template.get("outline_color", "#090909"), "&H00090909")
            shadow_color = cls._color_to_ass(template.get("shadow_color", "rgba(0,0,0,0.85)"), "&H80000000")
            outline_w = int(template.get("outline_width", 2))
            shadow_w = 4
        elif template_id == "soft_focus":
            primary_color = cls._color_to_ass(template.get("text_color", "#FFFDF7"), "&H00F7FDFF")
            outline_w = 0
            shadow_w = 6
            shadow_color = cls._color_to_ass(template.get("glow_color", "#FFF8E6"), "&H80E6F8FF")
        elif template_id == "editorial_serif":
            primary_color = cls._color_to_ass(template.get("text_color", "#F1EFEA"), "&H00EAEFF1")
            outline_w = int(template.get("outline_width", 1))
            shadow_w = 2
        elif template_id in ("kinetic_type", "kinetic"):
            outline_w = int(template.get("outline_width", 3))
            shadow_w = 4
            primary_color = cls._color_to_ass(template.get("text_color", "#FFFFFF"), "&H00FFFFFF")
        elif template_id in ("dream_sequence", "dreamy", "aesthetic"):
            outline_w = int(template.get("outline_width", 0))
            shadow_w = 5
            shadow_color = cls._color_to_ass(template.get("glow_color", "#A994FF"), "&H80FF94A9")
        elif template_id in ("minimal_verse", "minimal"):
            outline_w = 0
            shadow_w = 1
        elif template_id in ("karaoke_highlight", "karaoke"):
            primary_color = cls._color_to_ass(template.get("highlight_color", "#A994FF"), "&H00FF94A9")
            secondary_color = cls._color_to_ass(template.get("text_color", "#8E8C99"), "&H00998C8E")
            outline_w = int(template.get("outline_width", 2))
            shadow_w = 2
        elif template_id == "neon":
            primary_color = "&H00FFFFFF"
            outline_color = cls._color_to_ass(template.get("glow_color", "#00F2FE"), "&H00FEF200")
            outline_w = 5
            shadow_w = 8

        ass_content = f"""[Script Info]
Title: LyricStudio Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_color},{secondary_color},{outline_color},{shadow_color},-1,0,0,0,100,100,2,0,1,{outline_w},{shadow_w},{alignment},50,50,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        anim_type = template.get("animation_type", "")
        events = []
        for line in lyrics_data:
            start_t = cls._sec_to_ass_time(line.get("start", 0.0))
            end_t = cls._sec_to_ass_time(line.get("end", 3.0))
            raw_text = line.get("text", "")
            words = line.get("words", [])

            if (template_id in ("karaoke_highlight", "karaoke") or anim_type == "word-highlight") and words:
                # Karaoke timing tags: {\k<duration_in_cs>}word
                k_text_parts = []
                for w in words:
                    w_dur_sec = max(0.1, w.get("end", w.get("start", 0) + 0.3) - w.get("start", 0))
                    cs = int(round(w_dur_sec * 100))
                    k_text_parts.append(f"{{\\k{cs}}}{w.get('word', '')}")
                line_text = " ".join(k_text_parts)
            elif template_id in ("minimal_verse", "minimal") or anim_type == "fade-darkness":
                line_text = f"{{\\fad(250,250)}}{raw_text}"
            elif template_id == "soft_focus" or anim_type == "blur-focus":
                line_text = f"{{\\blur6\\t(0,350,\\blur0)\\fad(280,240)}}{raw_text}"
            elif template_id == "editorial_serif":
                line_text = f"{{\\fsp2\\fad(280,260)}}{raw_text}"
            elif template_id == "neon":
                line_text = f"{{\\blur4\\fscx102\\fscy102}}{raw_text}"
            elif template_id in ("midnight_cinema", "cinematic") or anim_type == "cinematic-rise":
                line_text = f"{{\\fad(300,300)\\fsp3}}{raw_text}"
            elif template_id in ("dream_sequence", "dreamy", "aesthetic"):
                line_text = f"{{\\fad(350,350)\\blur2\\fsp2}}{raw_text}"
            elif template_id in ("kinetic_type", "kinetic") or anim_type == "beat-pulse":
                line_text = f"{{\\t(0,180,\\fscx112\\fscy112)\\t(180,350,\\fscx100\\fscy100)\\fad(150,150)}}{raw_text}"
            elif anim_type == "tracking-reveal":
                line_text = f"{{\\fsp0\\t(0,350,\\fsp4)\\fad(250,200)}}{raw_text}"
            elif anim_type == "scale-drift":
                line_text = f"{{\\t(0,300,\\fscx105\\fscy105)\\fad(250,200)}}{raw_text}"
            else:
                line_text = f"{{\\fad(200,200)}}{raw_text}"

            events.append(f"Dialogue: 0,{start_t},{end_t},Default,,0,0,0,,{line_text}")

        ass_content += "\n".join(events) + "\n"
        output_path.write_text(ass_content, encoding="utf-8")

    @classmethod
    def generate_pillow_overlay_stream(cls, lyrics_data: list[dict], template: dict, width: int, height: int, temp_dir: Path, total_duration: float) -> Path:
        """
        Creates crisp, high-definition transparent PNG frames for each lyric segment using Pillow
        and generates an FFmpeg concat demuxer file for seamless, 100% reliable overlay rendering.
        """
        from PIL import Image, ImageDraw, ImageFont, ImageFilter

        # 1. Blank transparent baseline frame
        blank_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        blank_path = temp_dir / "blank.png"
        blank_img.save(blank_path, format="PNG")

        # Resolve typography
        font_family = str(template.get("font_family", "sans-serif")).lower()
        font_size = max(18, int(template.get("font_size", 48) * (height / 1080.0)))
        font_weight = str(template.get("font_weight", "bold")).lower()
        template_id = str(template.get("template_id", "cinematic")).lower()

        candidate_paths = []
        if "serif" in font_family or template_id in ("editorial_serif", "midnight_cinema", "cinematic"):
            candidate_paths = [
                "/System/Library/Fonts/Supplemental/Georgia.ttf",
                "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
                "/System/Library/Fonts/Times.ttc"
            ]
        elif "mono" in font_family or template_id in ("retro_arcade", "retro"):
            candidate_paths = [
                "/System/Library/Fonts/Supplemental/Courier New.ttf",
                "/System/Library/Fonts/Monaco.ttf",
                "/System/Library/Fonts/Menlo.ttc"
            ]
        else:
            candidate_paths = [
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if ("bold" in font_weight or "700" in font_weight or "800" in font_weight) else "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/System/Library/Fonts/Helvetica.ttc",
                "/System/Library/Fonts/Supplemental/Trebuchet MS.ttf",
                "/System/Library/Fonts/SFCompact.ttf"
            ]

        selected_font = next((p for p in candidate_paths if Path(p).exists()), None)
        try:
            if selected_font:
                font = ImageFont.truetype(selected_font, font_size)
            else:
                font = ImageFont.load_default(size=font_size)
        except Exception:
            font = ImageFont.load_default()

        # Parse styling colors
        text_color_hex = template.get("text_color", "#F1EFEA")
        highlight_color_hex = template.get("highlight_color", "#A994FF")
        glow_color_hex = template.get("glow_color", "#A994FF")

        pos_y_pct = float(template.get("position_y", 76)) / 100.0
        pos_y = int(height * pos_y_pct)
        pos_x_pct = float(template.get("position_x", 50)) / 100.0
        pos_x = int(width * pos_x_pct)

        text_align = template.get("text_align", "center")
        anchor = "mm" if text_align == "center" else ("lm" if text_align == "left" else "rm")
        if text_align == "left":
            pos_x = int(width * 0.12)
        elif text_align == "right":
            pos_x = int(width * 0.88)

        def hex_to_rgba(h, alpha=255):
            if not h:
                return (255, 255, 255, alpha)
            clean = str(h).strip().lstrip("#")
            if len(clean) == 6:
                return (int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16), alpha)
            elif len(clean) == 8:
                return (int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16), int(clean[6:8], 16))
            return (255, 255, 255, alpha)

        text_rgba = hex_to_rgba(text_color_hex, 255)
        glow_rgba = hex_to_rgba(glow_color_hex, 210)
        outline_rgba = hex_to_rgba(template.get("outline_color", "#090909"), 240)
        outline_w = max(0, int(template.get("outline_width", 2) * (height / 1080.0)))

        valid_lines = [l for l in lyrics_data if l.get("text", "").strip()]
        valid_lines.sort(key=lambda x: float(x.get("start", 0.0)))

        slides_info = []
        current_time = 0.0

        for idx, line in enumerate(valid_lines):
            l_start = max(0.0, float(line.get("start", 0.0)))
            l_end = max(l_start + 0.3, float(line.get("end", l_start + 3.0)))
            if l_end > total_duration:
                l_end = total_duration

            if l_start > current_time + 0.04:
                gap = l_start - current_time
                slides_info.append(("blank.png", round(gap, 3)))
                current_time = l_start

            line_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(line_img)
            raw_text = line.get("text", "").strip()

            # Atmospheric or neon glow layer
            if template_id in ("neon_night", "neon", "dream_sequence", "dreamy", "soft_focus", "atmospheric"):
                glow_canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                g_draw = ImageDraw.Draw(glow_canvas)
                g_stroke = max(3, int(6 * (height / 1080.0)))
                g_draw.text((pos_x, pos_y), raw_text, font=font, fill=glow_rgba, anchor=anchor, stroke_width=g_stroke, stroke_fill=glow_rgba)
                blur_radius = max(3, int(14 * (height / 1080.0)))
                glow_canvas = glow_canvas.filter(ImageFilter.GaussianBlur(blur_radius))
                line_img = Image.alpha_composite(line_img, glow_canvas)
                draw = ImageDraw.Draw(line_img)

            # Drop shadow
            shadow_off = max(2, int(4 * (height / 1080.0)))
            draw.text((pos_x + shadow_off, pos_y + shadow_off), raw_text, font=font, fill=(0, 0, 0, 200), anchor=anchor)

            # Outline and primary text
            if outline_w > 0:
                draw.text((pos_x, pos_y), raw_text, font=font, fill=text_rgba, anchor=anchor, stroke_width=outline_w, stroke_fill=outline_rgba)
            else:
                draw.text((pos_x, pos_y), raw_text, font=font, fill=text_rgba, anchor=anchor)

            line_filename = f"lyric_{idx:03d}.png"
            line_img.save(temp_dir / line_filename, format="PNG")

            dur = max(0.1, round(l_end - l_start, 3))
            slides_info.append((line_filename, dur))
            current_time = l_end

        # Trailing silence
        if current_time < total_duration:
            trailing = max(0.1, round(total_duration - current_time, 3))
            slides_info.append(("blank.png", trailing))

        if not slides_info:
            slides_info.append(("blank.png", max(1.0, round(total_duration, 3))))

        concat_path = temp_dir / "lyrics_concat.txt"
        concat_lines = []
        for fname, dur in slides_info:
            concat_lines.append(f"file '{fname}'")
            concat_lines.append(f"duration {dur}")
        concat_lines.append(f"file '{slides_info[-1][0]}'")

        concat_path.write_text("\n".join(concat_lines) + "\n", encoding="utf-8")
        return concat_path

    @classmethod
    def _execute_render_task(cls, task: dict):
        job_id = task["job_id"]
        project = task["project_data"]
        resolution_str = task["resolution"]
        fps = task["fps"]

        cls._update_job_status(job_id, "rendering", 5)

        temp_dir = RENDERS_DIR / f"job_{job_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        out_filename = f"{project['id']}_{resolution_str}_{int(datetime.now(timezone.utc).timestamp())}.mp4"
        final_output_path = RENDERS_DIR / out_filename

        try:
            # Determine dimensions
            aspect_ratio = project.get("aspect_ratio", "16:9")
            from app.services.project_service import ProjectService
            width, height = ProjectService.get_resolution_dimensions(aspect_ratio, resolution_str)

            # Audio track
            audio_asset = project.get("audio_asset")
            if not audio_asset or not Path(audio_asset.get("file_path", "")).exists():
                raise ValueError("Valid audio asset is required to render video.")
            
            audio_file = audio_asset.get("file_path")
            total_duration = float(audio_asset.get("duration", 10.0))
            if total_duration <= 0:
                total_duration = 30.0

            # Subtitle & Typography Strategy
            template = project.get("template_data", {})
            lyrics = project.get("lyrics_data", [])
            ass_path = temp_dir / "subtitles.ass"
            if cls.has_ass_filter():
                cls.generate_ass_subtitles(lyrics, template, width, height, ass_path)

            # Check if visualizer template is selected
            is_visualizer = template.get("template_id") == "visualizer"

            # Check for background image clips in timeline or project assets
            timeline = project.get("timeline_data", {})
            image_clips = []
            for track in timeline.get("tracks", []):
                if track.get("type") == "image":
                    image_clips.extend(track.get("clips", []))

            # Query asset file paths for image clips
            asset_paths = {}
            db = get_standalone_db()
            try:
                rows = db.execute("SELECT id, file_path FROM assets WHERE user_id = ?", (task["user_id"],)).fetchall()
                for r in rows:
                    asset_paths[r["id"]] = r["file_path"]
            finally:
                db.close()

            valid_image_clips = []
            for c in image_clips:
                aid = c.get("asset_id")
                if aid in asset_paths and Path(asset_paths[aid]).exists():
                    valid_image_clips.append((c, asset_paths[aid]))

            # Build FFmpeg command
            # Base video source: solid color background with slow zoom or color
            bg_color = template.get("background_color", "#0A0B10").lstrip("#")
            if len(bg_color) != 6:
                bg_color = "0A0B10"

            cmd = [
                Config.FFMPEG_BINARY,
                "-y",
                "-f", "lavfi",
                "-i", f"color=c=0x{bg_color}:s={width}x{height}:r={fps}:d={total_duration}",
                "-i", audio_file
            ]

            filter_complex_steps = []
            last_v = "[0:v]"

            # Add each image clip as an input and composite onto background
            bg_blur = int(template.get("bg_blur", 0))
            blur_filter = f",gblur=sigma={bg_blur}" if bg_blur > 0 else ""

            for idx, (clip, img_path) in enumerate(valid_image_clips):
                cmd.extend(["-loop", "1", "-t", str(total_duration), "-i", img_path])
                img_in_idx = 2 + idx
                c_start = max(0.0, float(clip.get("start", 0.0)))
                c_end = max(c_start + 0.1, float(clip.get("end", total_duration)))
                filter_complex_steps.append(
                    f"[{img_in_idx}:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}{blur_filter},setsar=1[img_crop_{idx}]"
                )
                filter_complex_steps.append(
                    f"{last_v}[img_crop_{idx}]overlay=0:0:enable='between(t,{c_start},{c_end})'[v_layer_{idx}]"
                )
                last_v = f"[v_layer_{idx}]"

            # Apply overlay dimming if image clips exist and opacity > 0
            overlay_op = float(template.get("overlay_opacity", 0.4))
            if valid_image_clips and overlay_op > 0:
                filter_complex_steps.append(
                    f"{last_v}drawbox=y=0:w={width}:h={height}:c=black@{overlay_op}:t=fill[v_dim]"
                )
                last_v = "[v_dim]"

            # Cinematic letterbox bars
            if template.get("template_id") in ("midnight_cinema", "cinematic") or template.get("show_letterbox", False):
                bar_h = int(height * 0.08)
                filter_complex_steps.append(
                    f"{last_v}drawbox=y=0:w={width}:h={bar_h}:c=black@1:t=fill,drawbox=y={height - bar_h}:w={width}:h={bar_h}:c=black@1:t=fill[v_cinema]"
                )
                last_v = "[v_cinema]"

            # Visualizer filter if template is dynamic visualizer or show_visualizer is true
            is_visualizer = template.get("template_id") == "visualizer" or template.get("show_visualizer", False)
            if is_visualizer:
                vis_color = template.get("visualizer_color", "#4FACFE").lstrip("#")
                if len(vis_color) != 6:
                    vis_color = "4FACFE"
                vis_h = int(height * 0.25)
                filter_complex_steps.append(
                    f"[1:a]showwaves=s={width}x{vis_h}:mode=line:colors=0x{vis_color}:scale=cbrt[wave];"
                    f"{last_v}[wave]overlay=0:{height - vis_h - 40}:format=auto[v_vis]"
                )
                last_v = "[v_vis]"

            # Apply Subtitles / Lyrics Overlay
            if cls.has_ass_filter():
                escaped_ass = str(ass_path).replace("\\", "/").replace(":", "\\:")
                filter_complex_steps.append(f"{last_v}ass={escaped_ass}[v_final]")
            else:
                concat_path = cls.generate_pillow_overlay_stream(lyrics, template, width, height, temp_dir, total_duration)
                concat_in_idx = 2 + len(valid_image_clips)
                cmd.extend(["-f", "concat", "-safe", "0", "-i", str(concat_path)])
                filter_complex_steps.append(f"{last_v}[{concat_in_idx}:v]overlay=0:0[v_final]")

            cmd.extend([
                "-filter_complex", ";".join(filter_complex_steps),
                "-map", "[v_final]",
                "-map", "1:a",
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "20",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                "-progress", "pipe:1",
                str(final_output_path)
            ])

            logger.info("Starting FFmpeg render with command: %s", " ".join(cmd))
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )

            with cls._lock:
                cls._active_processes[job_id] = proc

            # Monitor progress
            time_regex = re.compile(r"out_time_ms=(\d+)")
            progress_val = 10

            for line in proc.stdout:
                line = line.strip()
                m = time_regex.search(line)
                if m:
                    time_us = int(m.group(1))
                    curr_sec = time_us / 1000000.0
                    pct = min(98, max(5, int((curr_sec / total_duration) * 95)))
                    if pct > progress_val:
                        progress_val = pct
                        cls._update_job_status(job_id, "rendering", progress_val)

            proc.wait()

            with cls._lock:
                cls._active_processes.pop(job_id, None)

            if proc.returncode != 0:
                stderr_output = proc.stderr.read()
                raise RuntimeError(f"FFmpeg exited with error code {proc.returncode}: {stderr_output[-500:]}")

            cls._update_job_status(job_id, "completed", 100, output_file=out_filename)
            logger.info("Render job %s completed successfully: %s", job_id, final_output_path)

        except Exception as e:
            logger.exception("Render job %s failed: %s", job_id, e)
            cls._update_job_status(job_id, "failed", error_msg=str(e))
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
