# LyricStudio 🎵🎬

> Professional AI-Powered Animated Lyrics Video Creation Website. Inspired by IMG.LY's video editor workflow and customized for music creators.

---

## Quick Start

### 1. Launch the Studio Application
```bash
npm run dev
# or
.venv/bin/python wsgi.py --port 5001
```
The studio runs at **[http://127.0.0.1:5001](http://127.0.0.1:5001)**.

### 2. Default Owner Credentials
- **Username**: `admin`
- **Password**: `StudioAdmin_2026!`

### 3. Run Automated Tests
```bash
npm test
# or
.venv/bin/pytest -v
```

---

## Redesigned IMG.LY-Inspired Architecture & Visual Identity

LyricStudio has been redesigned with inspiration from [IMG.LY's CE.SDK Web Editor](https://github.com/imgly/starterkit-video-editor-ts-web), engineered specifically for animated lyrics video creation.

### Visual Identity (DESIGN.md)
- **Primary Accent**: VEED Coral Red (`#FF5454`) — used for primary actions, active tools, selected clips, playhead indicators, selection handles, and critical feedback.
- **Main Background & Canvas**: Pure Black (`#000000`) — immersive, high-contrast creative editing environment.
- **Text On Brand**: Soft Cream (`#FAFAF9`) — readable contrast on brand surfaces and dark panels.
- **Dark Surfaces**: (`#0C0A09`, `#141414`, `#1C1C1C`) with subtle hairlines (`#222222`, `#333333`).
- **Links & Navigation**: Muted Forest Green (`#3C6300`) — inline navigation and textual interactions.
- **Accent Lime**: (`#9FD356`) — tertiary button & tag accents.
- **Typography**: Geometric humanist Inter across all interface elements, strictly adhering to WCAG AAA contrast and $\ge$16px interface text.

### Workspace Layout
- **Top Toolbar**: Quick project title editing, save status indicator, undo/redo (`Ctrl+Z`/`Ctrl+Y`), aspect ratio selector (16:9, 9:16, 2.39:1 CinemaScope, 1:1, 4:5), preview quality (Full / 0.5x), and instant Export.
- **Left Creative Rail**: 8 dedicated tools:
  1. **Media**: Upload song audio, cover artwork, and video clips.
  2. **Lyrics**: Line-by-line timing, LRC/SRT subtitle import, and audio alignment.
  3. **Text**: Preset typography blocks (Hero Title, Kinetic Verse, Subtitle).
  4. **Backgrounds**: Artwork framing, solid/gradient canvas colors, and procedural themes.
  5. **Motion**: Ken Burns motion presets (Slow Zoom In, Slow Zoom Out, Static).
  6. **Effects**: Dimming, Gaussian blur, film grain, and glowing outlines.
  7. **Transitions**: Scene transitions (Crossfade, Wipe Left, Wipe Right, Zoom Pulse, Cyber Glitch, Rack Blur).
  8. **AI Studio**: Gemini 2.5 Flash Creative Director for automatic theme palettes, typography styling, and lyric alignment.
- **Central Preview Canvas**: Interactive HTML5 Canvas preview with direct click-and-drag positioning, bounding boxes, corner resize handles, magnetic snap guides, and playhead synchronization.
- **Right Inspector**: Real-time layer typography, font family, font size, tracking, alignment, color pickers, animation presets, and clip timing.
- **Bottom Multitrack Timeline**: Time ruler, Coral Red playhead needle, lyrics track with draggable/trimmable clips, media track, and high-resolution dual-color audio waveform.

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
