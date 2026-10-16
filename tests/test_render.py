import pytest
from pathlib import Path
from app.services.render_service import RenderService

def test_ass_subtitle_generation(tmp_path):
    lyrics = [
        {
            "start": 1.0,
            "end": 4.0,
            "text": "Living on a prayer",
            "words": [
                {"word": "Living", "start": 1.0, "end": 1.8},
                {"word": "on", "start": 1.8, "end": 2.2},
                {"word": "a", "start": 2.2, "end": 2.6},
                {"word": "prayer", "start": 2.6, "end": 4.0}
            ]
        }
    ]

    # 1. Test Karaoke template ASS generation with \k tags
    karaoke_template = {
        "template_id": "karaoke",
        "font_size": 48,
        "text_color": "#FFFFFF",
        "highlight_color": "#00F2FE",
        "position_y": 75
    }
    ass_file = tmp_path / "karaoke.ass"
    RenderService.generate_ass_subtitles(lyrics, karaoke_template, 1920, 1080, ass_file)
    
    assert ass_file.exists()
    content = ass_file.read_text(encoding="utf-8")
    assert "[Script Info]" in content
    assert "PlayResX: 1920" in content
    assert "PlayResY: 1080" in content
    assert "\\k" in content  # Karaoke timing tags present

    # 2. Test Neon template ASS generation
    neon_template = {
        "template_id": "neon",
        "font_size": 52,
        "glow_color": "#00F2FE",
        "position_y": 78
    }
    neon_file = tmp_path / "neon.ass"
    RenderService.generate_ass_subtitles(lyrics, neon_template, 1920, 1080, neon_file)
    neon_content = neon_file.read_text(encoding="utf-8")
    assert "\\blur" in neon_content or "Default" in neon_content

    # 3. Test Cinematic template ASS generation
    cinematic_template = {
        "template_id": "cinematic",
        "font_size": 46,
        "text_color": "#FFFFFF",
        "position_y": 78
    }
    cine_file = tmp_path / "cinematic.ass"
    RenderService.generate_ass_subtitles(lyrics, cinematic_template, 1920, 1080, cine_file)
    cine_content = cine_file.read_text(encoding="utf-8")
    assert "\\fad" in cine_content

    # 4. Test Aesthetic/Dreamy template ASS generation
    aesthetic_template = {
        "template_id": "dreamy",
        "font_size": 44,
        "text_color": "#FFFFFF",
        "position_y": 75,
        "glow_color": "#C4B5FD"
    }
    aes_file = tmp_path / "dreamy.ass"
    RenderService.generate_ass_subtitles(lyrics, aesthetic_template, 1920, 1080, aes_file)
    aes_content = aes_file.read_text(encoding="utf-8")
    assert "Dialogue:" in aes_content
    assert "\\fad" in aes_content

    # 5. Test Kinetic template ASS generation
    kinetic_template = {
        "template_id": "kinetic",
        "font_size": 54,
        "text_color": "#FFFFFF",
        "position_y": 72
    }
    kin_file = tmp_path / "kinetic.ass"
    RenderService.generate_ass_subtitles(lyrics, kinetic_template, 1920, 1080, kin_file)
    kin_content = kin_file.read_text(encoding="utf-8")
    assert "\\t(" in kin_content or "\\fscx" in kin_content

def test_color_to_ass_conversion():
    # #FFFFFF -> &H00FFFFFF
    white = RenderService._color_to_ass("#FFFFFF")
    assert white == "&H00FFFFFF"

    # #00F2FE (R=00, G=F2, B=FE) in ASS &HAABBGGRR -> &H00FEF200
    cyan = RenderService._color_to_ass("#00F2FE")
    assert cyan == "&H00FEF200"
