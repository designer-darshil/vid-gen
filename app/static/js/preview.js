/**
 * LyricStudio Cinematic Composition Preview Engine
 * Author: LyricStudio Engineering
 * Renders real-time multi-layer canvas matching the FFmpeg export pipeline.
 * Direct canvas manipulation, safe-area guides, alignment snapping, all 7 templates, and real-time playback.
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
        this.duration = 30.0;

        this._animationFrame = null;
        this.isDraggingCanvas = false;
        this.isResizingText = false;
        this.selectedLayer = 'lyric'; // 'lyric', 'background', 'composition'
        this.snapGuideX = null;
        this.snapGuideY = null;
        this.textBounds = null;

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
        } else if (aspectRatio === '4:5') {
            this.width = 1080;
            this.height = 1350;
        } else if (aspectRatio === '2.39:1') {
            this.width = 2560;
            this.height = 1072;
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

        // Preload image assets into cache
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

        let dragStartX = 0;
        let dragStartY = 0;
        let initialPosX = 50;
        let initialPosY = 78;
        let initialFontSize = 48;

        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            const scaleX = this.width / rect.width;
            const scaleY = this.height / rect.height;
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY,
                relX: (clientX - rect.left) / rect.width,
                relY: (clientY - rect.top) / rect.height
            };
        };

        const isPointInHandle = (ptX, ptY, hX, hY, radius = 18) => {
            return Math.abs(ptX - hX) <= radius && Math.abs(ptY - hY) <= radius;
        };

        this.canvas.addEventListener('mousedown', (e) => {
            const coords = getCanvasCoords(e);
            initialPosX = this.templateConfig.position_x !== undefined ? this.templateConfig.position_x : 50;
            initialPosY = this.templateConfig.position_y !== undefined ? this.templateConfig.position_y : 78;
            initialFontSize = this.templateConfig.font_size || 48;
            dragStartX = coords.x;
            dragStartY = coords.y;

            // Check if user clicked on bottom-right resize handle
            if (this.textBounds) {
                const brX = this.textBounds.x + this.textBounds.w;
                const brY = this.textBounds.y + this.textBounds.h;
                if (isPointInHandle(coords.x, coords.y, brX, brY, 24)) {
                    this.isResizingText = true;
                    this.canvas.style.cursor = 'nwse-resize';
                    return;
                }
            }

            // Check if user clicked inside text box
            const textY = this.height * (initialPosY / 100);
            const textX = this.width * (initialPosX / 100);
            const approxHalfW = (this.textBounds ? this.textBounds.w / 2 : this.width * 0.35);
            const approxHalfH = (this.textBounds ? this.textBounds.h / 2 : 40);

            if (Math.abs(coords.x - textX) <= approxHalfW + 20 && Math.abs(coords.y - textY) <= approxHalfH + 20) {
                this.isDraggingCanvas = true;
                this.selectedLayer = 'lyric';
                this.canvas.style.cursor = 'grabbing';
                if (window.Editor && window.Editor.switchInspectorTab) {
                    window.Editor.switchInspectorTab('layer');
                }
            } else {
                // Clicked outside text: select background layer
                this.selectedLayer = 'background';
                if (window.Editor && window.Editor.switchInspectorTab) {
                    window.Editor.switchInspectorTab('background');
                }
            }
            this.renderFrame();
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDraggingCanvas && !this.isResizingText) return;
            const coords = getCanvasCoords(e);

            if (this.isResizingText) {
                const deltaX = coords.x - dragStartX;
                const newSize = Math.max(20, Math.min(130, Math.round(initialFontSize + (deltaX * 0.12))));
                this.templateConfig.font_size = newSize;
                const sizeInput = document.getElementById('prop-font-size');
                const sizeSlider = document.getElementById('prop-font-size-slider');
                if (sizeInput) sizeInput.value = newSize;
                if (sizeSlider) sizeSlider.value = newSize;
                this.renderFrame();
                return;
            }

            if (this.isDraggingCanvas) {
                let newX = Math.round(coords.relX * 100);
                let newY = Math.round(coords.relY * 100);

                // Magnetic Center Snapping (within 2.5% of center)
                if (Math.abs(newX - 50) <= 2.5) {
                    newX = 50;
                    this.snapGuideX = this.width / 2;
                } else {
                    this.snapGuideX = null;
                }

                if (Math.abs(newY - 50) <= 2.5) {
                    newY = 50;
                    this.snapGuideY = this.height / 2;
                } else {
                    this.snapGuideY = null;
                }

                newX = Math.max(10, Math.min(90, newX));
                newY = Math.max(15, Math.min(92, newY));

                this.templateConfig.position_x = newX;
                this.templateConfig.position_y = newY;

                // Sync Inspector Position Sliders
                const xSlider = document.getElementById('prop-position-x');
                const xBadge = document.getElementById('posx-val-badge');
                if (xSlider) xSlider.value = newX;
                if (xBadge) xBadge.textContent = `${newX}%`;

                const ySlider = document.getElementById('prop-position-y');
                const yBadge = document.getElementById('posy-val-badge');
                if (ySlider) ySlider.value = newY;
                if (yBadge) yBadge.textContent = `${newY}%`;

                this.renderFrame();
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDraggingCanvas || this.isResizingText) {
                this.isDraggingCanvas = false;
                this.isResizingText = false;
                this.snapGuideX = null;
                this.snapGuideY = null;
                if (this.canvas) this.canvas.style.cursor = 'crosshair';
                if (window.Editor) window.Editor.triggerAutosave();
                this.renderFrame();
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
        showToast(`Safe area guides ${this.showSafeArea ? 'shown' : 'hidden'}`, 'info');
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
        ctx.fillStyle = cfg.background_color || '#090909';
        ctx.fillRect(0, 0, w, h);

        // 2. Active Background Image Layer with Fit / Pan / Zoom / Blur / Rotation
        const activeImageClip = this.getActiveImageClip(this.currentTime);
        if (activeImageClip && this.imageCache.has(activeImageClip.asset_id)) {
            const img = this.imageCache.get(activeImageClip.asset_id);
            if (img && img.complete) {
                ctx.save();
                const clipProgress = (this.currentTime - activeImageClip.start) / Math.max(0.1, (activeImageClip.end - activeImageClip.start));

                // Ken Burns Motion
                let zoom = 1.0;
                const motion = cfg.bg_zoom || 'zoom-in';
                if (motion === 'zoom-in') {
                    zoom = 1.0 + (clipProgress * 0.08);
                } else if (motion === 'zoom-out') {
                    zoom = 1.08 - (clipProgress * 0.08);
                }

                const panX = (cfg.bg_pan_x || 0) * (w / 100);
                const panY = (cfg.bg_pan_y || 0) * (h / 100);
                const rotDeg = (cfg.bg_rotation || 0) * (Math.PI / 180);

                ctx.translate(w / 2 + panX, h / 2 + panY);
                ctx.rotate(rotDeg);
                ctx.scale(zoom, zoom);
                ctx.globalAlpha = activeImageClip.opacity !== undefined ? activeImageClip.opacity : 1.0;

                // Background blur filter
                if (cfg.bg_blur && cfg.bg_blur > 0) {
                    ctx.filter = `blur(${cfg.bg_blur}px)`;
                }

                const fitMode = cfg.bg_fit || 'cover';
                let drawW = w;
                let drawH = h;
                const imgRatio = img.width / img.height;
                const canvasRatio = w / h;

                if (fitMode === 'cover') {
                    if (imgRatio > canvasRatio) {
                        drawH = h;
                        drawW = h * imgRatio;
                    } else {
                        drawW = w;
                        drawH = w / imgRatio;
                    }
                } else if (fitMode === 'contain') {
                    if (imgRatio > canvasRatio) {
                        drawW = w;
                        drawH = w / imgRatio;
                    } else {
                        drawH = h;
                        drawW = h * imgRatio;
                    }
                } else {
                    // fill exact
                    drawW = w;
                    drawH = h;
                }

                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();

                // Dimming overlay
                const op = cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.4;
                if (op > 0) {
                    ctx.fillStyle = `rgba(9, 9, 9, ${op})`;
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
                grad.addColorStop(0, cfg.visualizer_color || '#A994FF');
                grad.addColorStop(1, '#D4CBFF');

                ctx.fillStyle = grad;
                ctx.fillRect(startX + i * barW + 2, baseY - barH, barW - 4, barH);
            }
            ctx.restore();
        }

        // 4. Letterbox Bars (if Midnight Cinema or effect enabled)
        if (cfg.template_id === 'midnight_cinema' || cfg.template_id === 'cinematic' || cfg.show_letterbox) {
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

            const templateId = cfg.template_id || 'midnight_cinema';
            const template = TEMPLATES[templateId] || TEMPLATES.midnight_cinema || TEMPLATES.cinematic;

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

            // Record text bounding box for direct canvas manipulation
            const posX = w * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
            const posY = h * ((cfg.position_y !== undefined ? cfg.position_y : 78) / 100);
            const fontSize = (cfg.font_size || 48) * (h / 1080);
            ctx.font = `${cfg.font_weight || '700'} ${fontSize}px ${cfg.font_family || "'Cinzel', serif"}`;
            const metrics = ctx.measureText(activeLine.text);
            const boxW = metrics.width + 40;
            const boxH = fontSize * 1.6;
            this.textBounds = {
                x: posX - boxW / 2,
                y: posY - boxH / 2,
                w: boxW,
                h: boxH
            };

            // Draw direct manipulation selection handles when selected
            if (this.selectedLayer === 'lyric') {
                ctx.save();
                ctx.strokeStyle = 'rgba(169, 148, 255, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 6]);
                ctx.strokeRect(this.textBounds.x, this.textBounds.y, this.textBounds.w, this.textBounds.h);

                // Corner resize handle (bottom-right)
                ctx.setLineDash([]);
                ctx.fillStyle = '#A994FF';
                const brX = this.textBounds.x + this.textBounds.w;
                const brY = this.textBounds.y + this.textBounds.h;
                ctx.beginPath();
                ctx.arc(brX, brY, 6, 0, Math.PI * 2);
                ctx.fill();

                // Center position anchor dot
                ctx.fillStyle = 'rgba(241, 239, 234, 0.9)';
                ctx.beginPath();
                ctx.arc(posX, posY, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }
        } else {
            this.textBounds = null;
        }

        // 6. Magnetic Snap Guide Lines
        if (this.snapGuideX !== null) {
            ctx.save();
            ctx.strokeStyle = '#A994FF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.snapGuideX, 0);
            ctx.lineTo(this.snapGuideX, h);
            ctx.stroke();
            ctx.restore();
        }
        if (this.snapGuideY !== null) {
            ctx.save();
            ctx.strokeStyle = '#A994FF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, this.snapGuideY);
            ctx.lineTo(w, this.snapGuideY);
            ctx.stroke();
            ctx.restore();
        }

        // 7. Safe Area Guides (Action 90% and Title 80%)
        if (this.showSafeArea) {
            ctx.save();
            // 90% Action Safe
            ctx.strokeStyle = 'rgba(169, 148, 255, 0.45)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);

            // 80% Title Safe
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
            ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);

            // Center Crosshair
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(w / 2 - 20, h / 2);
            ctx.lineTo(w / 2 + 20, h / 2);
            ctx.moveTo(w / 2, h / 2 - 20);
            ctx.lineTo(w / 2, h / 2 + 20);
            ctx.stroke();

            // Labels
            ctx.font = '500 18px "Geist", "Inter", sans-serif';
            ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
            ctx.fillText('80% Title Safe Area', w * 0.1 + 10, h * 0.1 + 24);
            ctx.fillStyle = 'rgba(169, 148, 255, 0.75)';
            ctx.fillText('90% Action Safe Area', w * 0.05 + 10, h * 0.05 + 24);

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
