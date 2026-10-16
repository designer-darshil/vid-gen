import pytest
from pathlib import Path
from app.services.storage_service import StorageService

def test_file_validation_allowed_extensions():
    valid, ext = StorageService.validate_file("song.mp3", "audio")
    assert valid is True
    assert ext == "mp3"

    valid, ext = StorageService.validate_file("backdrop.webp", "image")
    assert valid is True
    assert ext == "webp"

    valid, ext = StorageService.validate_file("subtitles.srt", "lyrics")
    assert valid is True
    assert ext == "srt"

def test_file_validation_disallowed_extensions():
    valid, err = StorageService.validate_file("malicious.exe", "audio")
    assert valid is False
    assert "Unsupported" in err

    valid, err = StorageService.validate_file("script.sh", "image")
    assert valid is False

    valid, err = StorageService.validate_file("no_extension", "lyrics")
    assert valid is False

def test_path_traversal_detection(tmp_path):
    base_dir = tmp_path / "uploads"
    base_dir.mkdir()

    safe_target = base_dir / "safe_file.png"
    assert StorageService.is_safe_path(safe_target, base_dir) is True

    unsafe_target = base_dir / ".." / "system.db"
    assert StorageService.is_safe_path(unsafe_target, base_dir) is False
