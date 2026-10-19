import os
import sys
import time
import json
import wave
import struct
import math
import subprocess
from pathlib import Path
from app import create_app
from config import Config
from app.services.render_service import RenderService
from app.models.database import get_db

def test_full_journey():
    print("=== STARTING FULL END-TO-END JOURNEY TEST ===")
    class TestConfig(Config):
        WTF_CSRF_ENABLED = False

    app = create_app(TestConfig)
    client = app.test_client()

    # 1. Login
    print("\n[Stage 1] Authenticating as Admin...")
    login_resp = client.post("/login", data={
        "username": "admin",
        "password": "StudioAdmin_2026!"
    }, follow_redirects=True)
    assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
    print("✓ Successfully authenticated.")

    # 2. Prepare real audio file (3-second sine melody with sample frequency modulation)
    scratch_dir = Path("data/uploads/audio")
    scratch_dir.mkdir(parents=True, exist_ok=True)
    sample_audio = scratch_dir / "e2e_journey_song.wav"

    with wave.open(str(sample_audio), "w") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(44100)
        total_samples = 44100 * 3 # 3 seconds
        data = bytearray()
        for i in range(total_samples):
            t = i / 44100.0
            freq = 440.0 + 50.0 * math.sin(2 * math.pi * 2.0 * t)
            val = int(12000 * math.sin(2 * math.pi * freq * t))
            sample = struct.pack("<hh", val, val)
            data.extend(sample)
        wav.writeframes(data)
    print(f"✓ Real audio track created ({sample_audio.stat().st_size} bytes, 3.0s).")

    # 3. Upload song -> AI Create Draft (Audio Ingestion -> Transcription -> Direction -> Scene Plan -> Project)
    print("\n[Stage 2] Executing AI Creative Director draft generation (POST /api/ai/create-draft)...")
    with open(sample_audio, "rb") as af:
        resp = client.post(
            "/api/ai/create-draft",
            data={
                "title": "E2E Cyber Echoes",
                "aspect_ratio": "16:9",
                "audio_file": (af, "e2e_journey_song.wav")
            },
            content_type="multipart/form-data"
        )
    assert resp.status_code in (200, 201), f"create-draft failed: {resp.data}"
    draft_data = resp.get_json()
    assert draft_data["success"] is True, f"Response unsuccessful: {draft_data}"
    project_id = draft_data["project"]["id"]
    scenes = draft_data["scene_plan"]["scenes"]
    print(f"✓ AI Draft created successfully! Project ID: {project_id}")
    print(f"  Generated {len(scenes)} scenes conforming to schema v{draft_data.get('scene_plan', {}).get('schema_version', '1.0.0')}")
    assert len(scenes) > 0, "No scenes were generated"
    first_scene = scenes[0]
    print(f"  Scene 1 Typography: Font='{first_scene['typography']['font_family']}', "
          f"Highlight='{first_scene['typography']['highlight_color']}', "
          f"Animation='{first_scene['animation']['type']}'")

    # 4. Verify Project Ownership & Persistence in Database
    print("\n[Stage 3] Verifying project retrieval and scene schema persistence...")
    get_resp = client.get(f"/api/projects/{project_id}/scenes")
    assert get_resp.status_code == 200, f"Failed to get scenes: {get_resp.data}"
    retrieved_plan = get_resp.get_json().get("scene_plan", {})
    assert len(retrieved_plan.get("scenes", [])) == len(scenes)
    print(f"✓ Retrieved {len(retrieved_plan['scenes'])} scenes from API.")

    # 5. Scene Editing & Customization (User updates lyrics & timing)
    print("\n[Stage 4] Testing user scene editing and validation (PUT /api/projects/<id>/scenes)...")
    modified_scenes = list(scenes)
    if modified_scenes[0].get("lyrics"):
        modified_scenes[0]["lyrics"][0]["text"] = "Neon horizons glowing in the dark"
    modified_scenes[0]["typography"]["highlight_color"] = "#B6FF3B" # Brand Solar Lime
    modified_scenes[0]["animation"]["type"] = "cinematic-rise"

    put_resp = client.put(
        f"/api/projects/{project_id}/scenes",
        data=json.dumps({"scenes": modified_scenes}),
        content_type="application/json"
    )
    assert put_resp.status_code == 200, f"Failed to update scenes: {put_resp.data}"
    print("✓ Scene modifications validated and saved successfully.")

    # 6. Trigger Video Rendering Pipeline
    print("\n[Stage 5] Triggering FFmpeg deterministic video rendering (POST /api/projects/<id>/render)...")
    render_resp = client.post(
        f"/api/projects/{project_id}/render",
        data=json.dumps({"resolution": "720p", "fps": 30}),
        content_type="application/json"
    )
    assert render_resp.status_code == 200, f"Render trigger failed: {render_resp.data}"
    render_info = render_resp.get_json()
    job_id = render_info["job_id"]
    print(f"✓ Video rendering job enqueued: Job ID={job_id}")

    # 7. Poll Job Status to 100% Completion
    print("\n[Stage 6] Polling render job status...")
    max_wait = 45 # seconds
    start_time = time.time()
    final_job = None

    while time.time() - start_time < max_wait:
        poll_resp = client.get(f"/api/renders/{job_id}/status")
        assert poll_resp.status_code == 200, f"Status poll failed: {poll_resp.data}"
        job_body = poll_resp.get_json()
        job_stat = job_body.get("job", {})
        status = job_stat.get("status")
        progress = job_stat.get("progress", 0)
        print(f"  -> Job Status: {status} ({progress}%)")
        if status in ("completed", "failed"):
            final_job = job_stat
            break
        time.sleep(1.0)

    assert final_job is not None, "Render job timed out!"
    assert final_job["status"] == "completed", f"Render failed: {final_job.get('error_message')}"
    output_filename = final_job["output_file"]
    print(f"✓ Video rendering completed successfully! Output file: {output_filename}")

    # 8. Video Stream & Audio Stream Validation with ffprobe
    print("\n[Stage 7] Validating rendered MP4 container and streams with ffprobe...")
    rendered_file_path = Path("data/renders") / output_filename
    assert rendered_file_path.exists(), f"Rendered file does not exist: {rendered_file_path}"
    file_size = rendered_file_path.stat().st_size
    assert file_size > 5000, f"Rendered file suspiciously small: {file_size} bytes"
    print(f"✓ Rendered MP4 exists on disk. Size: {file_size:,} bytes")

    ffprobe_cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(rendered_file_path)
    ]
    probe_output = subprocess.check_output(ffprobe_cmd, text=True)
    probe_data = json.loads(probe_output)

    video_streams = [s for s in probe_data.get("streams", []) if s.get("codec_type") == "video"]
    audio_streams = [s for s in probe_data.get("streams", []) if s.get("codec_type") == "audio"]
    duration = float(probe_data.get("format", {}).get("duration", 0.0))

    assert len(video_streams) >= 1, "No video stream in rendered MP4!"
    assert len(audio_streams) >= 1, "No audio stream in rendered MP4!"
    assert duration > 1.5, f"Rendered video duration ({duration}s) too short!"

    print(f"✓ ffprobe verified:")
    print(f"  Video Codec: {video_streams[0].get('codec_name')} ({video_streams[0].get('width')}x{video_streams[0].get('height')})")
    print(f"  Audio Codec: {audio_streams[0].get('codec_name')} ({audio_streams[0].get('sample_rate')} Hz, {audio_streams[0].get('channels')} channels)")
    print(f"  Duration: {duration:.2f} seconds")

    # 9. Test media upload errors
    print("\n[Stage 8] Testing media upload error handling (disallowed extension)...")
    bad_upload_resp = client.post(
        "/api/ai/create-draft",
        data={
            "title": "Bad File Test",
            "audio_file": (b"Not an executable", "malicious_script.exe")
        },
        content_type="multipart/form-data"
    )
    assert bad_upload_resp.status_code == 400, "Disallowed file type was not rejected with 400!"
    print("✓ Disallowed file upload correctly rejected.")

    print("\n=== FULL END-TO-END JOURNEY TEST COMPLETED WITH 100% SUCCESS ===")

if __name__ == "__main__":
    test_full_journey()
