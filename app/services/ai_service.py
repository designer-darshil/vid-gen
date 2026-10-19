import os
import re
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from config import Config
from app.models.database import get_standalone_db

logger = logging.getLogger(__name__)

class AIService:
    @classmethod
    def get_gemini_key(cls) -> str:
        """Retrieves Gemini API key from database settings (user-configured) or environment."""
        try:
            db = get_standalone_db()
            row = db.execute("SELECT value FROM settings WHERE key = 'gemini_api_key'").fetchone()
            db.close()
            if row is not None:
                return (row["value"] or "").strip()
        except Exception as e:
            logger.warning("Could not read gemini_api_key from settings: %s", e)

        env_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if env_key:
            return env_key
        return ""

    @classmethod
    def set_gemini_key(cls, key: str):
        """Saves Gemini API key to database settings."""
        db = get_standalone_db()
        try:
            db.execute("""
                INSERT INTO settings (key, value, updated_at)
                VALUES ('gemini_api_key', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            """, (key.strip(),))
            db.commit()
        finally:
            db.close()

    @classmethod
    def is_configured(cls) -> bool:
        return bool(cls.get_gemini_key())

    @classmethod
    def test_connection(cls, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Tests connectivity to Google Gemini API."""
        key = api_key or cls.get_gemini_key()
        if not key:
            return {"success": False, "error": "No Gemini API key provided."}

        try:
            from google import genai
            client = genai.Client(api_key=key)
            # Lightweight test prompt
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents="Reply with: OK"
            )
            return {"success": True, "message": "Successfully connected to Gemini 2.5 Flash API!"}
        except Exception as e:
            err_msg = str(e)
            logger.warning("Gemini connection test failed: %s", err_msg)
            return {"success": False, "error": f"Gemini API connection failed: {err_msg}"}

    @classmethod
    def extract_artwork_colors(cls, image_path: str) -> Dict[str, Any]:
        """
        Uses Pillow to extract dominant color palette, brightness, and tone
        from background artwork to inform creative proposals.
        """
        try:
            from PIL import Image
            img = Image.open(image_path).convert("RGB")
            # Resize for fast color quantizing
            thumb = img.resize((150, 150))
            colors = thumb.getcolors(maxcolors=22500)
            if not colors:
                return {"dominant": "#090909", "palette": ["#090909", "#171717", "#A994FF"], "is_dark": True}

            # Sort by frequency
            sorted_colors = sorted(colors, key=lambda x: x[0], reverse=True)
            top_rgbs = [c[1] for c in sorted_colors[:8]]

            def rgb_to_hex(rgb):
                return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

            dominant_hex = rgb_to_hex(top_rgbs[0])
            palette_hex = [rgb_to_hex(rgb) for rgb in top_rgbs]

            # Calculate brightness of dominant
            r, g, b = top_rgbs[0]
            brightness = (r * 299 + g * 587 + b * 114) / 1000

            return {
                "dominant": dominant_hex,
                "palette": palette_hex,
                "is_dark": brightness < 128
            }
        except Exception as e:
            logger.warning("Failed to extract artwork colors: %s", e)
            return {"dominant": "#090909", "palette": ["#090909", "#171717", "#A994FF"], "is_dark": True}

    @classmethod
    def propose_creative_direction(
        cls,
        song_title: str,
        lyrics_text: str,
        artwork_path: Optional[str] = None,
        audio_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Automatically proposes typography, color palettes, composition, animation styles,
        and scene changes based on the song and artwork.
        """
        api_key = cls.get_gemini_key()
        artwork_info = cls.extract_artwork_colors(artwork_path) if artwork_path and Path(artwork_path).exists() else None

        # 1. Real Gemini AI if API Key is configured
        if api_key:
            try:
                from google import genai
                client = genai.Client(api_key=api_key)

                system_instruction = (
                    "You are LyricStudio's elite Creative Director & Motion Typography Designer. "
                    "Analyze the given song title, lyric excerpts, and artwork color profile. "
                    "Propose a cohesive cinematic visual styling package formatted strictly as a single JSON object. "
                    "Valid presets: 'neon_night', 'dream_sequence', 'midnight_cinema', 'retro_wave', 'soft_focus', 'minimal_verse', 'karaoke_highlight'. "
                    "Valid animation_type: 'cinematic-rise', 'blur-focus', 'tracking-reveal', 'fade-darkness', 'beat-pulse', 'scale-drift', 'word-highlight', 'typewriter'. "
                    "Return JSON with keys: preset, rationale, font_family, font_size, font_weight, letter_spacing, "
                    "text_color, highlight_color, glow_color, background_color, outline_color, outline_width, "
                    "position_y, text_align, animation_type, animation_duration, overlay_opacity, bg_blur, ken_burns, scene_changes."
                )

                prompt_parts = [
                    f"Song Title: {song_title or 'Untitled Song'}\n",
                    f"Lyrics Sample:\n{lyrics_text[:1200] if lyrics_text else 'Ambient instrumental / vocal track'}\n"
                ]
                if artwork_info:
                    prompt_parts.append(f"Artwork Dominant Color: {artwork_info['dominant']}, Palette: {', '.join(artwork_info['palette'][:4])}\n")

                prompt_parts.append("\nRespond with ONLY valid JSON (no markdown formatting, no code blocks):")

                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents="".join(prompt_parts),
                    config={"system_instruction": system_instruction}
                )

                raw_text = response.text.strip()
                # Clean any markdown code blocks
                if raw_text.startswith("```"):
                    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
                    raw_text = re.sub(r"\s*```$", "", raw_text)

                proposal = json.loads(raw_text)
                proposal["configured"] = True
                proposal["provider"] = "Gemini 2.5 Flash"
                return {"success": True, "proposal": proposal}

            except Exception as e:
                logger.warning("Gemini creative proposal failed, falling back to heuristic: %s", e)
                # Fall through to local heuristic with explanation

        # 2. Local Intelligent Heuristic Proposal (when no API key or on error)
        local_proposal = cls._generate_heuristic_proposal(song_title, lyrics_text, artwork_info)
        local_proposal["configured"] = bool(api_key)
        local_proposal["provider"] = "Local Creative Engine"
        local_proposal["notice"] = (
            "Generated using local acoustic and artwork color analysis. "
            "To unlock multimodal Gemini 2.5 Flash AI creative direction, enter your API key in AI Settings."
        )
        return {"success": True, "proposal": local_proposal}

    @classmethod
    def _generate_heuristic_proposal(
        cls,
        song_title: str,
        lyrics_text: str,
        artwork_info: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generates a high-quality aesthetic styling proposal based on lyric tone & artwork."""
        lyrics_lower = (lyrics_text + " " + song_title).lower()

        # Mood detection
        is_neon = any(w in lyrics_lower for w in ["neon", "night", "city", "drive", "club", "lights", "speed", "cyber", "glow"])
        is_dreamy = any(w in lyrics_lower for w in ["dream", "moon", "star", "floating", "sky", "cloud", "ocean", "sleep", "angel", "soft"])
        is_retro = any(w in lyrics_lower for w in ["retro", "80s", "synth", "arcade", "tape", "rewind", "yesterday", "vintage", "disco"])
        is_minimal = any(w in lyrics_lower for w in ["quiet", "alone", "space", "pure", "white", "simple", "still", "truth", "words"])
        is_karaoke = any(w in lyrics_lower for w in ["sing", "singing", "chorus", "rhyme", "vocal"])

        # Determine preset
        if is_neon:
            preset = "neon_night"
            font_family = "'Inter', sans-serif"
            font_size = 52
            font_weight = "700"
            letter_spacing = 2.0
            text_color = "#F5F8FA"
            highlight_color = "#B6FF3B"
            glow_color = "#B6FF3B"
            bg_color = artwork_info["dominant"] if (artwork_info and artwork_info["is_dark"]) else "#0C1A2B"
            outline_color = "#08121E"
            outline_width = 2
            anim_type = "beat-pulse"
            rationale = "High-energy Solar Lime on Circuit Navy canvas typography with reactive stroke pulse and vivid glow."
        elif is_dreamy:
            preset = "dream_sequence"
            font_family = "'Inter', sans-serif"
            font_size = 46
            font_weight = "600"
            letter_spacing = 2.5
            text_color = "#F5F8FA"
            highlight_color = "#B6FF3B"
            glow_color = "#F5F8FA"
            bg_color = artwork_info["dominant"] if (artwork_info and artwork_info["is_dark"]) else "#0C1A2B"
            outline_color = "#040810"
            outline_width = 0
            anim_type = "fade-darkness"
            rationale = "Soft cream radiance with ambient sinusoidal floating wave and Circuit Navy canvas depth."
        elif is_retro:
            preset = "retro_wave"
            font_family = "'JetBrains Mono', 'Courier New', monospace"
            font_size = 44
            font_weight = "700"
            letter_spacing = 2.0
            text_color = "#F5F8FA"
            highlight_color = "#B6FF3B"
            glow_color = "#38BDF8"
            bg_color = "#0C1A2B"
            outline_color = "#040810"
            outline_width = 2
            anim_type = "typewriter"
            rationale = "Geometric mono terminal typography with vibrant Solar Lime accents and rhythmic type-on pacing."
        elif is_minimal:
            preset = "minimal_verse"
            font_family = "'Inter', sans-serif"
            font_size = 42
            font_weight = "500"
            letter_spacing = 1.5
            text_color = "#F5F8FA"
            highlight_color = "#B6FF3B"
            glow_color = "transparent"
            bg_color = "#0C1A2B"
            outline_color = "#040810"
            outline_width = 0
            anim_type = "fade-darkness"
            rationale = "Clean geometric clarity with Circuit Navy negative space and sliding upward emergence."
        elif is_karaoke:
            preset = "karaoke_highlight"
            font_family = "'Inter', sans-serif"
            font_size = 48
            font_weight = "600"
            letter_spacing = 1.5
            text_color = "rgba(245, 248, 250, 0.45)"
            highlight_color = "#B6FF3B"
            glow_color = "rgba(182, 255, 59, 0.7)"
            bg_color = "#0C1A2B"
            outline_color = "#040810"
            outline_width = 2
            anim_type = "word-highlight"
            rationale = "Progressive syllable wipe in energetic Solar Lime tracking vocal delivery rhythm."
        else: # Default cinematic
            preset = "midnight_cinema"
            font_family = "'Inter', sans-serif"
            font_size = 50
            font_weight = "600"
            letter_spacing = 3.0
            text_color = "#F5F8FA"
            highlight_color = "#B6FF3B"
            glow_color = "#F5F8FA"
            bg_color = artwork_info["dominant"] if (artwork_info and artwork_info["is_dark"]) else "#0C1A2B"
            outline_color = "#040810"
            outline_width = 2
            anim_type = "cinematic-rise"
            rationale = "Classic widescreen letterbox, high-contrast typography on Circuit Navy, and slow majestic camera rise."

        return {
            "preset": preset,
            "rationale": rationale,
            "font_family": font_family,
            "font_size": font_size,
            "font_weight": font_weight,
            "letter_spacing": letter_spacing,
            "text_color": text_color,
            "highlight_color": highlight_color,
            "glow_color": glow_color,
            "background_color": bg_color,
            "outline_color": outline_color,
            "outline_width": outline_width,
            "position_y": 76,
            "text_align": "center",
            "animation_type": anim_type,
            "animation_duration": 0.45,
            "overlay_opacity": 0.4,
            "bg_blur": 0,
            "ken_burns": "zoom-in",
            "scene_changes": [
                {"start": 0.0, "end": 10.0, "description": "Atmospheric intro with subtle camera zoom-in"},
                {"start": 10.0, "end": 25.0, "description": "Lyrical build with prominent glowing typography"},
                {"start": 25.0, "end": 45.0, "description": "Chorus peak with reactive kinetic rhythm"}
            ]
        }
