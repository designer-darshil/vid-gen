import pytest
from app.services.sync_service import SyncService

def test_lrc_parsing():
    lrc_content = """[ti:Midnight Song]
[00:02.50]First line of the song
[00:06.00]Second line takes over
[00:10.25]Final fading whisper
"""
    lines = SyncService.parse_lrc(lrc_content)
    assert len(lines) == 3
    assert lines[0]["start"] == 2.5
    assert lines[0]["text"] == "First line of the song"
    assert lines[1]["start"] == 6.0
    assert len(lines[0]["words"]) == 5

def test_srt_parsing():
    srt_content = """1
00:00:01,500 --> 00:00:04,500
Dancing in the golden light

2
00:00:05,000 --> 00:00:09,000
Underneath the endless sky
"""
    lines = SyncService.parse_srt(srt_content)
    assert len(lines) == 2
    assert lines[0]["start"] == 1.5
    assert lines[0]["end"] == 4.5
    assert lines[0]["text"] == "Dancing in the golden light"
    assert len(lines[0]["words"]) == 5

def test_apply_offset():
    lyrics = [
        {"start": 2.0, "end": 5.0, "text": "Line one", "words": [{"word": "Line", "start": 2.0, "end": 3.0}]},
        {"start": 6.0, "end": 9.0, "text": "Line two", "words": [{"word": "Line", "start": 6.0, "end": 7.0}]}
    ]
    shifted = SyncService.apply_offset(lyrics, 0.5)
    assert shifted[0]["start"] == 2.5
    assert shifted[0]["end"] == 5.5
    assert shifted[0]["words"][0]["start"] == 2.5

    # Negative offset clamped to 0.0
    shifted_neg = SyncService.apply_offset(lyrics, -4.0)
    assert shifted_neg[0]["start"] == 0.0

def test_align_text_fallback():
    text = """First verse starts here
Chorus hits with full power
Outro fades gently into silence"""
    aligned = SyncService.align_text_to_audio(text, "", total_duration=30.0)
    assert len(aligned) == 3
    assert aligned[0]["start"] < aligned[1]["start"] < aligned[2]["start"]
    assert aligned[2]["end"] <= 30.0
    assert aligned[0]["estimated"] is True

def test_transcribe_vocals_fallback():
    lines = SyncService.transcribe_vocals("", duration=20.0)
    assert lines == []

    # Non-existent file fallback
    lines_missing = SyncService.transcribe_vocals("/non/existent/file.wav", duration=20.0)
    assert lines_missing == []
