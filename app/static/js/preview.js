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
        this.selectedLayer = null; // null when unselected, 'lyric' when clicked
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

            // Check if user clicked on any corner resize handle (when lyric layer is selected)
            if (this.selectedLayer === 'lyric' && this.textBounds) {
                const b = this.textBounds;
                const handles = [
                    { x: b.x + b.w, y: b.y + b.h }, // bottom-right
                    { x: b.x, y: b.y + b.h },       // bottom-left
                    { x: b.x + b.w, y: b.y },       // top-right
                    { x: b.x, y: b.y }              // top-left
                ];
                const hit = handles.some(h => isPointInHandle(coords.x, coords.y, h.x, h.y, 22));
                if (hit) {
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

            if (Math.abs(coords.x - textX) <= approxHalfW + 15 && Math.abs(coords.y - textY) <= approxHalfH + 15) {
                this.isDraggingCanvas = true;
                this.selectedLayer = 'lyric';
                this.canvas.style.cursor = 'grabbing';
                if (window.Editor && window.Editor.switchInspectorTab) {
                    window.Editor.switchInspectorTab('layer');
                }
            } else {
                // Clicked outside text: deselect layer completely (removes selection rectangle)
                this.selectedLayer = null;
                this.canvas.style.cursor = 'default';
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

    drawCinematicFallbackBackground(ctx, w, h, time = 0) {
        ctx.save();

        // 1. Celestial Midnight Sky (Deep Obsidian to Twilight Lavender)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.72);
        skyGrad.addColorStop(0, '#050508');
        skyGrad.addColorStop(0.35, '#0a0911');
        skyGrad.addColorStop(0.65, '#13101e');
        skyGrad.addColorStop(0.88, '#1e1633');
        skyGrad.addColorStop(1, '#2c1e48');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h * 0.72);

        // 2. Distant Stars & Celestial Shimmer (deterministic pseudo-random)
        const starCount = 65;
        for (let i = 0; i < starCount; i++) {
            const starX = ((i * 137.5) % 1) * w;
            const starY = ((i * 269.3) % 0.65) * h;
            const size = (i % 3 === 0) ? 1.6 : 1.0;
            const twinkle = 0.35 + 0.55 * Math.sin(time * 1.8 + i);
            ctx.fillStyle = `rgba(241, 239, 234, ${twinkle})`;
            ctx.beginPath();
            ctx.arc(starX, starY, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Ambient Lavender Horizon Haze Nebula
        const nebulaX = w * 0.5;
        const nebulaY = h * 0.68;
        const nebulaGrad = ctx.createRadialGradient(nebulaX, nebulaY, 10, nebulaX, nebulaY, w * 0.48);
        nebulaGrad.addColorStop(0, 'rgba(169, 148, 255, 0.28)');
        nebulaGrad.addColorStop(0.35, 'rgba(142, 116, 235, 0.14)');
        nebulaGrad.addColorStop(0.7, 'rgba(110, 80, 190, 0.05)');
        nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebulaGrad;
        ctx.fillRect(0, h * 0.2, w, h * 0.6);

        // 4. Distant Mountain Ridge Layer 1 (Far silhouette)
        ctx.fillStyle = '#100d1a';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.68);
        const farPeaks = [
            [0.08, 0.62], [0.18, 0.65], [0.28, 0.59], [0.38, 0.64],
            [0.50, 0.57], [0.62, 0.63], [0.74, 0.58], [0.86, 0.65], [1.0, 0.61]
        ];
        farPeaks.forEach(([px, py]) => ctx.lineTo(px * w, py * h));
        ctx.lineTo(w, h * 0.72);
        ctx.lineTo(0, h * 0.72);
        ctx.closePath();
        ctx.fill();

        // 5. Midground Mountain Ridge Layer 2 (Sharp craggy peaks)
        ctx.fillStyle = '#0a0812';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.70);
        const midPeaks = [
            [0.05, 0.66], [0.14, 0.69], [0.24, 0.63], [0.34, 0.68],
            [0.46, 0.61], [0.58, 0.67], [0.69, 0.62], [0.82, 0.68], [0.93, 0.64], [1.0, 0.69]
        ];
        midPeaks.forEach(([px, py]) => ctx.lineTo(px * w, py * h));
        ctx.lineTo(w, h * 0.74);
        ctx.lineTo(0, h * 0.74);
        ctx.closePath();
        ctx.fill();

        // 6. Terrain Ground Plane (Dark Obsidian Valley)
        const groundGrad = ctx.createLinearGradient(0, h * 0.68, 0, h);
        groundGrad.addColorStop(0, '#09080e');
        groundGrad.addColorStop(0.3, '#07060a');
        groundGrad.addColorStop(1, '#040406');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, h * 0.68, w, h * 0.32);

        // 7. Distant Neon Horizon Beam
        const horizY = h * 0.68;
        const horizGlow = ctx.createLinearGradient(0, horizY - 14, 0, horizY + 14);
        horizGlow.addColorStop(0, 'rgba(169, 148, 255, 0)');
        horizGlow.addColorStop(0.5, 'rgba(169, 148, 255, 0.45)');
        horizGlow.addColorStop(1, 'rgba(169, 148, 255, 0)');
        ctx.fillStyle = horizGlow;
        ctx.fillRect(0, horizY - 14, w, 28);

        // Horizon fine neon line
        ctx.strokeStyle = 'rgba(212, 203, 255, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, horizY);
        ctx.lineTo(w, horizY);
        ctx.stroke();

        // 8. Atmospheric Ground Mist Ribbons (Gentle undulating wave drift)
        const mistWave = Math.sin(time * 0.6) * 12;
        const mistGrad = ctx.createLinearGradient(0, h * 0.67, 0, h * 0.85);
        mistGrad.addColorStop(0, 'rgba(169, 148, 255, 0.12)');
        mistGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.06)');
        mistGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = mistGrad;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.75 + mistWave);
        ctx.bezierCurveTo(w * 0.3, h * 0.70 - mistWave, w * 0.7, h * 0.80 + mistWave, w, h * 0.73 - mistWave);
        ctx.lineTo(w, h * 0.88);
        ctx.lineTo(0, h * 0.88);
        ctx.closePath();
        ctx.fill();

        // 9. Subtle 35mm Filmic Grain Texture
        ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
        const grainStep = 24;
        for (let gx = 0; gx < w; gx += grainStep) {
            for (let gy = 0; gy < h; gy += grainStep) {
                const grainSeed = (gx * 37 + gy * 79 + (time * 10 | 0)) % 100;
                if (grainSeed > 68) {
                    ctx.fillRect(gx + (grainSeed % 8), gy + ((grainSeed * 3) % 8), 1.5, 1.5);
                }
            }
        }

        // 10. Deep Filmic Corner Vignette
        const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.28, w * 0.5, h * 0.5, w * 0.76);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(0.7, 'rgba(4, 4, 6, 0.35)');
        vignette.addColorStop(1, 'rgba(2, 2, 4, 0.85)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);

        ctx.restore();
    }

    renderFrame() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const cfg = this.templateConfig;

        // 1. Background Rendering: Uploaded Media or Built-in Cinematic Procedural Fallback
        const activeImageClip = this.getActiveImageClip(this.currentTime);
        let hasRenderedImage = false;

        if (activeImageClip && this.imageCache.has(activeImageClip.asset_id)) {
            const img = this.imageCache.get(activeImageClip.asset_id);
            if (img && img.complete && img.naturalWidth > 0) {
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

                // Strict Proportional Scaling: NEVER stretch artwork
                const fitMode = cfg.bg_fit || 'cover';
                let drawW = w;
                let drawH = h;
                const imgRatio = img.naturalWidth / img.naturalHeight;
                const canvasRatio = w / h;

                if (fitMode === 'contain') {
                    if (imgRatio > canvasRatio) {
                        drawW = w;
                        drawH = w / imgRatio;
                    } else {
                        drawH = h;
                        drawW = h * imgRatio;
                    }
                } else {
                    // Default Proportional Cover
                    if (imgRatio > canvasRatio) {
                        drawH = h;
                        drawW = h * imgRatio;
                    } else {
                        drawW = w;
                        drawH = w / imgRatio;
                    }
                }

                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();

                // Dimming overlay
                const op = cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.38;
                if (op > 0) {
                    ctx.fillStyle = `rgba(8, 8, 12, ${op})`;
                    ctx.fillRect(0, 0, w, h);
                }
                hasRenderedImage = true;
            }
        }

        if (!hasRenderedImage) {
            // Built-in Cinematic Fallback: Dark midnight landscape, distant neon horizon, atmospheric haze, subtle film grain and restrained lavender light
            this.drawCinematicFallbackBackground(ctx, w, h, this.currentTime);

            // Optional custom background color tint if specified
            if (cfg.background_color && cfg.background_color !== '#090909') {
                ctx.save();
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = cfg.background_color;
                ctx.fillRect(0, 0, w, h);
                ctx.restore();
            }
        }

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

            // Draw direct manipulation selection handles ONLY when lyric layer is selected
            if (this.selectedLayer === 'lyric') {
                ctx.save();
                ctx.strokeStyle = '#A994FF';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([8, 6]);
                ctx.strokeRect(this.textBounds.x, this.textBounds.y, this.textBounds.w, this.textBounds.h);

                // Floating Layer Tag Badge above top-left
                ctx.setLineDash([]);
                const badgeText = "✦ Typography Layer • Drag to Move";
                ctx.font = '600 14px "Geist", "Inter", sans-serif';
                const tagW = ctx.measureText(badgeText).width + 20;
                const tagH = 26;
                const tagX = this.textBounds.x;
                const tagY = this.textBounds.y - tagH - 8;

                ctx.fillStyle = 'rgba(16, 16, 24, 0.94)';
                ctx.strokeStyle = 'rgba(169, 148, 255, 0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(tagX, tagY, tagW, tagH, 4) : ctx.rect(tagX, tagY, tagW, tagH);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#F1EFEA';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(badgeText, tagX + 10, tagY + tagH / 2);

                // 4 Tactile Corner Handles
                const b = this.textBounds;
                const corners = [
                    [b.x, b.y],                     // top-left
                    [b.x + b.w, b.y],               // top-right
                    [b.x, b.y + b.h],               // bottom-left
                    [b.x + b.w, b.y + b.h]          // bottom-right
                ];

                corners.forEach(([cx, cy]) => {
                    // Outer shadow
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(cx - 7, cy - 7, 14, 14);

                    // Inner handle
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(cx - 6, cy - 6, 12, 12);
                    ctx.strokeStyle = '#A994FF';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx - 6, cy - 6, 12, 12);
                });

                // Center position anchor dot
                ctx.fillStyle = '#A994FF';
                ctx.beginPath();
                ctx.arc(posX, posY, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.stroke();

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
        if (!this.lyrics || this.lyrics.length === 0) {
            // Sample composition fallback for empty projects
            return {
                start: 0,
                end: Math.max(10, this.duration),
                text: "Cruising under midnight cinema skies",
                words: [
                    { word: "Cruising", start: 0, end: 2.0 },
                    { word: "under", start: 2.0, end: 3.5 },
                    { word: "midnight", start: 3.5, end: 5.5 },
                    { word: "cinema", start: 5.5, end: 7.5 },
                    { word: "skies", start: 7.5, end: 10.0 }
                ]
            };
        }
        const active = this.lyrics.find(l => time >= l.start && time <= l.end);
        if (active) return active;
        if (!this.isPlaying && this.lyrics.length > 0) {
            if (time <= this.lyrics[0].start) {
                return this.lyrics[0];
            }
        }
        return null;
    }

    getActiveImageClip(time) {
        if (this.projectData && this.projectData.timeline_data) {
            const tracks = this.projectData.timeline_data.tracks || [];
            const imageTrack = tracks.find(t => t.type === 'image');
            if (imageTrack && imageTrack.clips && imageTrack.clips.length > 0) {
                const clip = imageTrack.clips.find(c => time >= c.start && time <= c.end);
                if (clip) return clip;
            }
        }
        // Fallback to project-level uploaded image asset if available
        if (this.projectData && this.projectData.assets) {
            const imgAsset = this.projectData.assets.find(a => a.asset_type === 'image');
            if (imgAsset) {
                return {
                    asset_id: imgAsset.id,
                    start: 0,
                    end: this.duration || 60,
                    opacity: 1.0
                };
            }
        }
        return null;
    }
}
