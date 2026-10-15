# LyricStudio 🎵🎬

> A private, personal full-stack animated lyrics video creation website built with Python 3.13, Flask, FFmpeg, HTML5 Canvas, and modern modular JavaScript.

---

## Quick Start

### 1. Start the Studio Application

Using `npm`:
```bash
npm run dev
```

Or directly using Python in the virtual environment:
```bash
.venv/bin/python wsgi.py
```

The application will be running at **[http://127.0.0.1:5001](http://127.0.0.1:5001)** (or `http://localhost:5001`).

### 2. Run Automated Tests
```bash
npm test
# or
.venv/bin/pytest -v
```

---

## Key Features

1. **Private Owner Security**:
   - First-run `/setup` owner creation with secure password hashing (`scrypt`).
   - Brute-force rate limiting (5 failed attempts locks for 10 minutes).
   - Strict session isolation: only the authenticated owner can access media and projects.

2. **Song Audio & Lyrics Upload**:
   - Audio formats: **MP3, WAV, M4A, AAC, FLAC, OGG** with automatic duration and metadata parsing.
   - High-resolution timeline waveform generated via FFmpeg PCM decoding (800 normalized amplitude peaks).
   - Lyrics input: **LRC** (line and word timestamps), **SRT** subtitle files, plain **TXT**, and direct text entry.

3. **Audio-to-Lyrics Synchronization**:
   - **Auto-Align**: Audio energy envelope and onset syllable forced-alignment engine using FFmpeg and NumPy RMS energy clustering.
   - **Auto-Transcribe**: Direct vocal burst detection and syllable segmentation for songs without lyrics.
   - Interactive line-by-line timing correction, click-to-seek, and global millisecond offset calibration.

4. **Interactive Multitrack Timeline**:
   - Three dedicated tracks: **Lyrics**, **Images / B-Roll**, and **Audio Waveform**.
   - Dual left/right resize handles for frame-accurate clip trimming.
   - Clip dragging, splitting at playhead (`S`), deleting (`Del` / `Backspace`).
   - Undo/Redo history stack (`Ctrl+Z` / `Ctrl+Y`) and debounced autosave.
   - Zoom control slider (30 to 250 px/second).

5. **6 Animated Lyric Templates**:
   - **Cinematic Typography**: Letterbox bars, subtle scale drift, wide tracking, and deep filmic drop shadow.
   - **Neon Glow**: Pulsing electric cyber tubes with multi-stage chromatic outer bloom and glowing stroke.
   - **Minimal Typography**: Crisp Swiss typography with clean geometry and smooth slide fades.
   - **Karaoke Word Highlighting**: Live syllable-by-syllable highlight wiping synchronized to audio.
   - **Aesthetic Image Lyrics**: Frosted glass card typography floating over atmospheric visual B-roll.
   - **Dynamic Music Visualizer**: Reactive audio equalizer spectrum bars pulsing rhythmically beneath the lyrics.

6. **Custom Background Images & Motion**:
   - Multi-image timeline lane with center-crop cover fitting.
   - Ken Burns motion engine (Slow Zoom In, Slow Zoom Out, Static).
   - Atmospheric controls: overlay dimming (0-1.0) and Gaussian blur (0-25px).

7. **Multi-Resolution Video Rendering**:
   - Export profiles: **720p, 1080p, 1440p, and 4K (3840x2160 or 2160x3840 for 9:16)**.
   - Aspect ratios: **16:9 Landscape**, **9:16 Vertical (Shorts/Reels/TikTok)**, **1:1 Square**.
   - Configurable frame rates: **24, 30, and 60 FPS**.
   - Background multi-threaded rendering queue with live progress percentage (0-100%), error reporting, and direct MP4 download.

8. **Zero-Config Sample Project**:
   - Pre-seeded with "Midnight Drive" (synthesized melodic chord audio, 1080p cyberpunk horizon graphic, and synchronized neon lyrics).

---

## Project Structure

```text
lyrics-video-generator/
├── app/
│   ├── blueprints/
│   │   ├── auth.py          # Owner setup, login, logout, session management
│   │   ├── dashboard.py     # Studio dashboard and project manager
│   │   ├── editor.py        # Studio composition editor
│   │   └── api.py           # REST endpoints for projects, assets, sync, and renders
│   ├── models/
│   │   └── database.py      # SQLite connection pool with WAL mode & datetime adapters
│   ├── services/
│   │   ├── auth_service.py     # Password hashing, lockout security
│   │   ├── project_service.py  # Project CRUD, aspect ratio sizing
│   │   ├── storage_service.py  # Path traversal safety, quotas, upload validation
│   │   ├── sync_service.py     # LRC/SRT parsing, forced alignment, vocal transcription
│   │   └── render_service.py   # Multi-threaded background FFmpeg rendering engine
│   ├── static/
│   │   ├── css/             # Dark-themed studio styling (auth, dashboard, editor, timeline)
│   │   └── js/              # Modular JS (api, editor, preview, sync, templates, timeline)
│   ├── templates/           # Jinja2 HTML5 studio templates
│   └── utils/
│       ├── sample_seed.py   # Built-in sample song and graphic generator
│       └── security.py      # Auth decorators
├── data/                    # SQLite database, uploaded assets, renders
├── tests/                   # Automated pytest suite (15 unit and e2e tests)
├── config.py                # App configuration, directories, and limits
├── package.json             # Dev scripts (npm run dev, npm test)
├── pytest.ini               # Pytest configuration
├── requirements.txt         # Python dependencies
└── wsgi.py                  # WSGI / development entrypoint
```
# vid-gen
# vid-gen
