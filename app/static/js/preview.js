/**
 * LyricStudio Live Composition Preview Engine
 * Renders multi-layer canvas matching the video export pipeline.
 * Supports direct canvas dragging, safe areas, all 7 templates, and real-time playback.
 */
class PreviewEngine {
    constructor(canvasId, audioId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.audio = document.getElementById(audioId);

        this.width = 1920;
        this.height = 1080;
        this.aspectRatio = '16:9';
        this.showSafeArea = false;
        this.isLooping = false;

        this.projectData = null;
        this.templateConfig = {};
        this.lyrics = [];
        this.imageCache = new Map();

        this.isPlaying = false;
        this.currentTime = 0.0;
        this.duration = 0.0;

        this._animationFrame = null;
        this.isDraggingCanvas = false;

        this.setupAudioListeners();
        this.setupCanvasInteractions();
    }

    setDimensions(aspectRatio) {
        this.aspectRatio = aspectRatio;
        if (aspectRatio === '9:16') {
            this.width = 1080;
            this.height = 1920;
        } else if (aspectRatio === '1:1') {
            this.width = 1080;
            this.height = 1080;
        } else {
            this.width = 1920;
            this.height = 1080;
        }
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        const vp = this.canvas.parentElement;
        if (vp) {
            vp.style.aspectRatio = aspectRatio.replace(':', ' / ');
        }

        const tag = document.getElementById('canvas-tag');
        if (tag) {
            tag.textContent = `${this.width} × ${this.height} (${aspectRatio})`;
        }

        this.renderFrame();
    }

    setProject(project) {
        this.projectData = project;
        this.templateConfig = project.template_data || {};
        this.lyrics = project.lyrics_data || [];
        this.setDimensions(project.aspect_ratio || '16:9');

        // Preload image assets
        if (project.assets) {
            project.assets.forEach(a => {
                if (a.asset_type === 'image' && !this.imageCache.has(a.id)) {
                    const img = new Image();
                    img.src = `/api/assets/${a.id}/file`;
                    this.imageCache.set(a.id, img);
                }
            });
        }

        if (project.audio_asset && this.audio) {
            this.audio.src = `/api/assets/${project.audio_asset.id}/file`;
            this.duration = project.audio_asset.duration || 30.0;
        } else {
            this.duration = project.duration || 30.0;
        }

        this.renderFrame();
        this.updateTimeDisplay();
    }

    setupAudioListeners() {
        if (!this.audio) return;

        this.audio.addEventListener('timeupdate', () => {
            this.currentTime = this.audio.currentTime;
            this.renderFrame();
            if (window.Timeline) {
                window.Timeline.updatePlayhead(this.currentTime);
            }
            if (window.SyncUI) {
                window.SyncUI.highlightActiveLine(this.currentTime);
            }
            this.updateTimeDisplay();
        });

        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            const icon = document.getElementById('play-pause-icon');
            if (icon) {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            }
            this.startLoop();
        });

        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            const icon = document.getElementById('play-pause-icon');
            if (icon) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
            this.stopLoop();
        });

        this.audio.addEventListener('ended', () => {
            if (this.isLooping) {
                this.seek(0);
                this.audio.play();
            } else {
                this.isPlaying = false;
                const icon = document.getElementById('play-pause-icon');
                if (icon) {
                    icon.classList.remove('fa-pause');
                    icon.classList.add('fa-play');
                }
                this.stopLoop();
            }
        });
    }

    setupCanvasInteractions() {
        if (!this.canvas) return;

        const updatePositionFromEvent = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

            const relX = (clientX - rect.left) / rect.width;
            const relY = (clientY - rect.top) / rect.height;

            const posY = Math.max(15, Math.min(92, Math.round(relY * 100)));
            const posX = Math.max(10, Math.min(90, Math.round(relX * 100)));

            this.templateConfig.position_y = posY;
            this.templateConfig.position_x = posX;

            // Sync with Inspector inputs
            const ySlider = document.getElementById('prop-position-y');
            const yBadge = document.getElementById('posy-val-badge');
            if (ySlider) ySlider.value = posY;
            if (yBadge) yBadge.textContent = `${posY}%`;

            const xSlider = document.getElementById('prop-position-x');
            const xBadge = document.getElementById('posx-val-badge');
            if (xSlider) xSlider.value = posX;
            if (xBadge) xBadge.textContent = `${posX}%`;

            this.renderFrame();
        };

        this.canvas.addEventListener('mousedown', (e) => {
            this.isDraggingCanvas = true;
            this.canvas.style.cursor = 'grabbing';
            updatePositionFromEvent(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDraggingCanvas) {
                updatePositionFromEvent(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDraggingCanvas) {
                this.isDraggingCanvas = false;
                if (this.canvas) this.canvas.style.cursor = 'crosshair';
                if (window.Editor) window.Editor.triggerAutosave();
            }
        });
    }

    seek(time) {
        this.currentTime = Math.max(0, Math.min(this.duration, time));
        if (this.audio) {
            this.audio.currentTime = this.currentTime;
        }
        this.renderFrame();
        this.updateTimeDisplay();
        if (window.Timeline) {
            window.Timeline.updatePlayhead(this.currentTime);
        }
    }

    togglePlay() {
        if (!this.audio || !this.audio.src) return;
        if (this.audio.paused) {
            this.audio.play();
        } else {
            this.audio.pause();
        }
    }

    toggleSafeArea() {
        this.showSafeArea = !this.showSafeArea;
        const btn = document.getElementById('btn-toggle-safe-area');
        if (btn) {
            btn.classList.toggle('active', this.showSafeArea);
        }
        this.renderFrame();
        showToast(`Safe area guides ${this.showSafeArea ? 'enabled' : 'hidden'}`, 'info');
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;
        const btn = document.getElementById('btn-toggle-loop');
        if (btn) {
            btn.classList.toggle('active', this.isLooping);
        }
        showToast(`Loop playback ${this.isLooping ? 'ON' : 'OFF'}`, 'info');
    }

    startLoop() {
        const loop = () => {
            if (this.isPlaying) {
                this.currentTime = this.audio.currentTime;
                this.renderFrame();
                if (window.Timeline) window.Timeline.updatePlayhead(this.currentTime);
                this._animationFrame = requestAnimationFrame(loop);
            }
        };
        this._animationFrame = requestAnimationFrame(loop);
    }

    stopLoop() {
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }
    }

    updateTimeDisplay() {
        const el = document.getElementById('timecode-display');
        if (!el) return;
        const curM = Math.floor(this.currentTime / 60);
        const curS = Math.floor(this.currentTime % 60);
        const curMs = Math.floor((this.currentTime % 1) * 100);

        const durM = Math.floor(this.duration / 60);
        const durS = Math.floor(this.duration % 60);
        const durMs = Math.floor((this.duration % 1) * 100);

        el.textContent = `${curM.toString().padStart(2, '0')}:${curS.toString().padStart(2, '0')}.${curMs.toString().padStart(2, '0')} / ${durM.toString().padStart(2, '0')}:${durS.toString().padStart(2, '0')}.${durMs.toString().padStart(2, '0')}`;
    }

    renderFrame() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const cfg = this.templateConfig;

        // 1. Solid Canvas Background
        ctx.fillStyle = cfg.background_color || '#08090D';
        ctx.fillRect(0, 0, w, h);

        // 2. Active Image Layer (Ken Burns slow zoom/pan + blur)
        const activeImageClip = this.getActiveImageClip(this.currentTime);
        if (activeImageClip && this.imageCache.has(activeImageClip.asset_id)) {
            const img = this.imageCache.get(activeImageClip.asset_id);
            if (img && img.complete) {
                ctx.save();
                const clipProgress = (this.currentTime - activeImageClip.start) / Math.max(0.1, (activeImageClip.end - activeImageClip.start));
                
                let zoom = 1.0;
                const motion = cfg.bg_zoom || 'zoom-in';
                if (motion === 'zoom-in') {
                    zoom = 1.0 + (clipProgress * 0.08);
                } else if (motion === 'zoom-out') {
                    zoom = 1.08 - (clipProgress * 0.08);
                }

                ctx.translate(w / 2, h / 2);
                ctx.scale(zoom, zoom);
                ctx.globalAlpha = activeImageClip.opacity !== undefined ? activeImageClip.opacity : 1.0;

                // Background blur filter
                if (cfg.bg_blur && cfg.bg_blur > 0) {
                    ctx.filter = `blur(${cfg.bg_blur}px)`;
                }

                const imgRatio = img.width / img.height;
                const canvasRatio = w / h;
                let drawW, drawH;
                if (imgRatio > canvasRatio) {
                    drawH = h;
                    drawW = h * imgRatio;
                } else {
                    drawW = w;
                    drawH = w / imgRatio;
                }
                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();

                // Darken overlay
                const op = cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.4;
                if (op > 0) {
                    ctx.fillStyle = `rgba(0, 0, 0, ${op})`;
                    ctx.fillRect(0, 0, w, h);
                }
            }
        }

        // 3. Audio Visualizer Spectrum (if visualizer template or effect enabled)
        if (cfg.template_id === 'visualizer' || cfg.show_visualizer) {
            const numBars = 48;
            const barW = (w * 0.72) / numBars;
            const startX = (w - (numBars * barW)) / 2;
            const baseY = h * 0.88;

            ctx.save();
            for (let i = 0; i < numBars; i++) {
                const freq = Math.sin(this.currentTime * 8 + i * 0.4) * Math.cos(this.currentTime * 4 - i * 0.2);
                const barH = Math.max(4, Math.abs(freq) * (h * 0.16));

                const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
                grad.addColorStop(0, cfg.visualizer_color || '#8B5CF6');
                grad.addColorStop(1, '#A78BFA');

                ctx.fillStyle = grad;
                ctx.fillRect(startX + i * barW + 2, baseY - barH, barW - 4, barH);
            }
            ctx.restore();
        }

        // 4. Cinematic Letterbox Bars
        if (cfg.template_id === 'cinematic' || cfg.show_letterbox) {
            const barH = h * 0.08;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, barH);
            ctx.fillRect(0, h - barH, w, barH);
        }

        // 5. Active Lyric Line Render
        const activeLine = this.getActiveLyricLine(this.currentTime);
        if (activeLine) {
            const lineDuration = Math.max(0.1, activeLine.end - activeLine.start);
            const lineProgress = Math.max(0, Math.min(1, (this.currentTime - activeLine.start) / lineDuration));

            const templateId = cfg.template_id || 'cinematic';
            const template = TEMPLATES[templateId] || TEMPLATES.cinematic;

            template.render(
                ctx,
                activeLine.text,
                activeLine.words || [],
                lineProgress,
                w,
                h,
                cfg,
                this.currentTime,
                activeLine.start,
                activeLine.end
            );
        }

        // 6. Safe Area Guides (Action 90% and Title 80%)
        if (this.showSafeArea) {
            ctx.save();
            // 90% Action Safe
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);

            // 80% Title Safe
            ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
            ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);

            // Labels
            ctx.font = '500 18px "Inter", sans-serif';
            ctx.fillStyle = 'rgba(0, 242, 254, 0.7)';
            ctx.fillText('80% Title Safe Area', w * 0.1 + 8, h * 0.1 + 24);
            ctx.fillStyle = 'rgba(139, 92, 246, 0.7)';
            ctx.fillText('90% Action Safe', w * 0.05 + 8, h * 0.05 + 24);

            ctx.restore();
        }
    }

    getActiveLyricLine(time) {
        return this.lyrics.find(l => time >= l.start && time <= l.end);
    }

    getActiveImageClip(time) {
        if (!this.projectData || !this.projectData.timeline_data) return null;
        const tracks = this.projectData.timeline_data.tracks || [];
        const imageTrack = tracks.find(t => t.type === 'image');
        if (!imageTrack || !imageTrack.clips) return null;
        return imageTrack.clips.find(c => time >= c.start && time <= c.end);
    }
}
