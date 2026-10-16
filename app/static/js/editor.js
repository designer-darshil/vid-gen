/**
 * LyricStudio Main Editor Application Controller
 * Handles panels, templates, live inspector syncing, media uploads, and export rendering.
 */
const Editor = {
    project: null,
    autosaveTimer: null,
    renderPollTimer: null,

    init(projectData) {
        this.project = projectData;

        // Initialize sub-engines
        window.Preview = new PreviewEngine('preview-canvas', 'master-audio');
        window.Preview.setProject(this.project);

        window.Timeline = new TimelineEditor('editor-timeline');
        window.Timeline.init(this.project);

        SyncUI.init(this.project);

        this.setupSidebarTabs();
        this.setupInspectorBindings();
        this.setupTemplateSelection();
        this.setupMediaUploads();
        this.setupHeaderActions();
        this.setupKeyboardShortcuts();
    },

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isEditable = document.activeElement && document.activeElement.isContentEditable;
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) {
                return;
            }

            // Space: Play / Pause
            if (e.code === 'Space') {
                e.preventDefault();
                if (window.Preview) window.Preview.togglePlay();
            }
            // Ctrl/Cmd + Z: Undo
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (window.Timeline) window.Timeline.undo();
            }
            // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
            else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
                     ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
                e.preventDefault();
                if (window.Timeline) window.Timeline.redo();
            }
            // S: Split clip at playhead
            else if (e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (window.Timeline) window.Timeline.splitSelectedClip();
            }
            // Delete / Backspace: Delete selected clip
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (window.Timeline) window.Timeline.deleteSelectedClip();
            }
        });
    },

    addImageClipToTimeline(assetId, assetName) {
        if (!this.project) return;
        if (!this.project.timeline_data) {
            this.project.timeline_data = { tracks: [] };
        }
        let imgTrack = (this.project.timeline_data.tracks || []).find(t => t.type === 'image');
        if (!imgTrack) {
            imgTrack = { id: 'track-images', type: 'image', name: 'Images & B-Roll', clips: [] };
            this.project.timeline_data.tracks.push(imgTrack);
        }
        if (!imgTrack.clips) imgTrack.clips = [];

        const startTime = window.Preview ? (window.Preview.currentTime || 0.0) : 0.0;
        const totalDur = (this.project.audio_asset && this.project.audio_asset.duration) ? this.project.audio_asset.duration : 60.0;
        const endTime = Math.min(totalDur, startTime + 8.0);

        const newClip = {
            id: 'clip_' + Date.now(),
            asset_id: assetId,
            title: assetName,
            start: Math.round(startTime * 100) / 100,
            end: Math.round(endTime * 100) / 100,
            opacity: 1.0
        };
        imgTrack.clips.push(newClip);

        // Preload into Preview image cache
        if (window.Preview && !window.Preview.imageCache.has(assetId)) {
            const img = new Image();
            img.src = `/api/assets/${assetId}/file`;
            window.Preview.imageCache.set(assetId, img);
        }

        if (window.Timeline) window.Timeline.renderTracks();
        if (window.Preview) window.Preview.renderFrame();
        this.triggerAutosave();
        showToast(`Added "${assetName}" to timeline`, 'success');
    },

    triggerAutosave() {
        const dot = document.getElementById('autosave-dot');
        const text = document.getElementById('autosave-text');
        if (dot) dot.classList.add('saving');
        if (text) text.textContent = 'Saving...';

        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(async () => {
            try {
                await API.put(`/api/projects/${this.project.id}`, {
                    title: this.project.title,
                    aspect_ratio: this.project.aspect_ratio,
                    width: this.project.width,
                    height: this.project.height,
                    fps: this.project.fps,
                    lyrics_data: this.project.lyrics_data,
                    timeline_data: this.project.timeline_data,
                    template_data: this.project.template_data
                });
                if (dot) dot.classList.remove('saving');
                if (text) text.textContent = 'Saved';
            } catch (err) {
                console.error('Autosave failed:', err);
                if (text) text.textContent = 'Save failed';
            }
        }, 1200);
    },

    setupHeaderActions() {
        // Project title rename
        const titleInput = document.getElementById('project-title-input');
        if (titleInput) {
            titleInput.value = this.project.title;
            titleInput.addEventListener('input', (e) => {
                this.project.title = e.target.value.trim() || 'Untitled Project';
                this.triggerAutosave();
            });
        }

        // Aspect ratio selector
        const aspectSelect = document.getElementById('aspect-select');
        if (aspectSelect) {
            aspectSelect.value = this.project.aspect_ratio || '16:9';
            aspectSelect.addEventListener('change', (e) => {
                const newAspect = e.target.value;
                this.project.aspect_ratio = newAspect;
                window.Preview.setDimensions(newAspect);
                this.triggerAutosave();
                showToast(`Canvas format switched to ${newAspect}`, 'info');
            });
        }

        // Preview quality selector
        const qualitySelect = document.getElementById('preview-quality-select');
        if (qualitySelect) {
            qualitySelect.addEventListener('change', (e) => {
                showToast(`Preview resolution set to ${e.target.value}`, 'info');
            });
        }
    },

    setupSidebarTabs() {
        document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.panel-section').forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const target = btn.getAttribute('data-target');
                const panel = document.getElementById(target);
                if (panel) panel.classList.add('active');
            });
        });
    },

    setupTemplateSelection() {
        const currentId = (this.project.template_data && this.project.template_data.template_id) || 'cinematic';
        document.querySelectorAll('.template-card').forEach(card => {
            if (card.getAttribute('data-template-id') === currentId) {
                card.classList.add('active');
            }
            card.addEventListener('click', () => {
                document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                const tId = card.getAttribute('data-template-id');
                const tObj = TEMPLATES[tId];
                if (tObj) {
                    this.project.template_data = { ...this.project.template_data, ...tObj.defaults, template_id: tId };
                    window.Preview.templateConfig = this.project.template_data;
                    this.populateInspectorInputs();
                    window.Preview.renderFrame();
                    this.triggerAutosave();
                    showToast(`Switched to "${tObj.name}" style`, 'success');
                }
            });
        });
    },

    setupInspectorBindings() {
        this.populateInspectorInputs();

        const bindInput = (id, key, parser = (v) => v, badgeId = null, badgeFormatter = (v) => v) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', (e) => {
                const val = parser(e.target.value);
                this.project.template_data[key] = val;
                if (badgeId) {
                    const badge = document.getElementById(badgeId);
                    if (badge) badge.textContent = badgeFormatter(val);
                }
                window.Preview.templateConfig = this.project.template_data;
                window.Preview.renderFrame();
                this.triggerAutosave();
            });
        };

        // Typography
        bindInput('prop-font-family', 'font_family');
        bindInput('prop-font-size', 'font_size', parseInt);
        bindInput('prop-font-weight', 'font_weight');
        bindInput('prop-letter-spacing-slider', 'letter_spacing', parseFloat, 'tracking-val-badge', v => `${v}px`);
        
        // Colors
        bindInput('prop-text-color', 'text_color', v => v, 'text-color-hex');
        bindInput('prop-highlight-color', 'highlight_color', v => v, 'highlight-color-hex');
        bindInput('prop-outline-color', 'outline_color', v => v, 'outline-color-hex');
        bindInput('prop-outline-width', 'outline_width', parseInt, 'outline-val-badge', v => `${v}px`);
        bindInput('prop-glow-color', 'glow_color', v => v, 'glow-color-hex');
        bindInput('prop-glow-size', 'glow_size', parseInt, 'glow-val-badge', v => `${v}px`);
        bindInput('prop-visualizer-color', 'visualizer_color', v => v, 'vis-color-hex');

        // Placement
        bindInput('prop-position-y', 'position_y', parseInt, 'posy-val-badge', v => `${v}%`);
        bindInput('prop-position-x', 'position_x', parseInt, 'posx-val-badge', v => `${v}%`);

        // Background Atmosphere
        bindInput('prop-bg-color', 'background_color', v => v, 'bg-color-hex');
        bindInput('prop-overlay-opacity', 'overlay_opacity', parseFloat, 'overlay-val-badge', v => `${Math.round(v * 100)}%`);
        bindInput('prop-bg-blur', 'bg_blur', parseInt, 'blur-val-badge', v => `${v}px`);
        bindInput('prop-bg-zoom', 'bg_zoom');

        // Motion & Transitions
        bindInput('prop-animation-type', 'animation_type');
        bindInput('prop-animation-duration', 'animation_duration', parseFloat);
    },

    populateInspectorInputs() {
        const cfg = this.project.template_data || {};
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined) el.value = val;
        };
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el && text !== undefined) el.textContent = text;
        };

        setVal('prop-font-family', cfg.font_family);
        setVal('prop-font-size', cfg.font_size);
        setVal('prop-font-size-slider', cfg.font_size);
        setVal('prop-font-weight', cfg.font_weight || '700');
        setVal('prop-letter-spacing-slider', cfg.letter_spacing || 2.0);
        setText('tracking-val-badge', `${cfg.letter_spacing || 2.0}px`);

        setVal('prop-text-color', cfg.text_color || '#FFFFFF');
        setText('text-color-hex', (cfg.text_color || '#FFFFFF').toUpperCase());

        setVal('prop-highlight-color', cfg.highlight_color || '#A78BFA');
        setText('highlight-color-hex', (cfg.highlight_color || '#A78BFA').toUpperCase());

        setVal('prop-outline-color', cfg.outline_color || '#000000');
        setText('outline-color-hex', (cfg.outline_color || '#000000').toUpperCase());

        setVal('prop-outline-width', cfg.outline_width !== undefined ? cfg.outline_width : 2);
        setText('outline-val-badge', `${cfg.outline_width !== undefined ? cfg.outline_width : 2}px`);

        setVal('prop-glow-color', cfg.glow_color || '#8B5CF6');
        setText('glow-color-hex', (cfg.glow_color || '#8B5CF6').toUpperCase());

        setVal('prop-glow-size', cfg.glow_size !== undefined ? cfg.glow_size : 18);
        setText('glow-val-badge', `${cfg.glow_size !== undefined ? cfg.glow_size : 18}px`);

        setVal('prop-visualizer-color', cfg.visualizer_color || '#8B5CF6');
        setText('vis-color-hex', (cfg.visualizer_color || '#8B5CF6').toUpperCase());

        setVal('prop-position-y', cfg.position_y !== undefined ? cfg.position_y : 75);
        setText('posy-val-badge', `${cfg.position_y !== undefined ? cfg.position_y : 75}%`);

        setVal('prop-position-x', cfg.position_x !== undefined ? cfg.position_x : 50);
        setText('posx-val-badge', `${cfg.position_x !== undefined ? cfg.position_x : 50}%`);

        setVal('prop-bg-color', cfg.background_color || '#08090D');
        setText('bg-color-hex', (cfg.background_color || '#08090D').toUpperCase());

        setVal('prop-overlay-opacity', cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.4);
        setText('overlay-val-badge', `${Math.round((cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.4) * 100)}%`);

        setVal('prop-bg-blur', cfg.bg_blur !== undefined ? cfg.bg_blur : 0);
        setText('blur-val-badge', `${cfg.bg_blur !== undefined ? cfg.bg_blur : 0}px`);

        setVal('prop-bg-zoom', cfg.bg_zoom || 'zoom-in');
        setVal('prop-animation-type', cfg.animation_type || 'fade-slide');
        setVal('prop-animation-duration', cfg.animation_duration || 0.35);

        // Effect checkboxes
        const visToggle = document.getElementById('effect-visualizer-toggle');
        if (visToggle) visToggle.checked = Boolean(cfg.show_visualizer || cfg.template_id === 'visualizer');

        const letterboxToggle = document.getElementById('effect-letterbox-toggle');
        if (letterboxToggle) letterboxToggle.checked = Boolean(cfg.show_letterbox || cfg.template_id === 'cinematic');
    },

    setBackgroundColor(hex) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.background_color = hex;
        const colorInput = document.getElementById('prop-bg-color');
        const hexLabel = document.getElementById('bg-color-hex');
        if (colorInput) colorInput.value = hex;
        if (hexLabel) hexLabel.textContent = hex.toUpperCase();
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    toggleVisualizerEffect(checked) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.show_visualizer = checked;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    toggleLetterboxEffect(checked) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.show_letterbox = checked;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    toggleGlowEffect(checked) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.glow_size = checked ? 18 : 0;
        const glowSlider = document.getElementById('prop-glow-size');
        const glowBadge = document.getElementById('glow-val-badge');
        if (glowSlider) glowSlider.value = this.project.template_data.glow_size;
        if (glowBadge) glowBadge.textContent = `${this.project.template_data.glow_size}px`;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    updateFontSize(val) {
        if (!this.project || !this.project.template_data) return;
        const num = parseInt(val);
        this.project.template_data.font_size = num;
        const numInput = document.getElementById('prop-font-size');
        if (numInput) numInput.value = num;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    updateLetterSpacing(val) {
        if (!this.project || !this.project.template_data) return;
        const num = parseFloat(val);
        this.project.template_data.letter_spacing = num;
        const badge = document.getElementById('tracking-val-badge');
        if (badge) badge.textContent = `${num}px`;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    setTextAlign(align) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.text_align = align;
        document.querySelectorAll('.seg-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-align') === align);
        });
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    setMasterVolume(val) {
        const num = parseFloat(val);
        if (window.Preview && window.Preview.audio) {
            window.Preview.audio.volume = num;
        }
        const badge = document.getElementById('volume-val-badge');
        if (badge) badge.textContent = `${Math.round(num * 100)}%`;
    },

    setupMediaUploads() {
        const setupDropzone = (dropzoneId, inputId, assetType) => {
            const dz = document.getElementById(dropzoneId);
            const input = document.getElementById(inputId);
            if (!dz || !input) return;

            dz.addEventListener('click', () => input.click());

            dz.addEventListener('dragover', (e) => {
                e.preventDefault();
                dz.classList.add('dragover');
            });
            dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
            dz.addEventListener('drop', (e) => {
                e.preventDefault();
                dz.classList.remove('dragover');
                if (e.dataTransfer.files.length) {
                    this.uploadFile(e.dataTransfer.files[0], assetType);
                }
            });

            input.addEventListener('change', () => {
                if (input.files.length) {
                    this.uploadFile(input.files[0], assetType);
                }
            });
        };

        setupDropzone('dropzone-audio', 'input-audio-file', 'audio');
        setupDropzone('dropzone-image', 'input-image-file', 'image');
    },

    async uploadFile(file, assetType) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('asset_type', assetType);

        try {
            showToast(`Uploading ${file.name}...`, 'info');
            const res = await API.upload(`/api/projects/${this.project.id}/upload`, formData);
            if (res && res.asset) {
                showToast(`${file.name} uploaded successfully!`, 'success');
                setTimeout(() => window.location.reload(), 600);
            }
        } catch (err) {
            showToast(err.message || 'Upload failed', 'error');
        }
    },

    openExportModal() {
        openModal('export-modal');
    },

    async startVideoRender() {
        const resolution = document.getElementById('render-resolution-select').value;
        const fps = parseInt(document.getElementById('render-fps-select').value);

        try {
            showToast('Dispatching video render task...', 'info');
            const res = await API.post(`/api/projects/${this.project.id}/render`, { resolution, fps });
            if (res && res.job_id) {
                this.monitorRenderProgress(res.job_id);
            }
        } catch (err) {
            showToast(err.message || 'Render failed to start', 'error');
        }
    },

    monitorRenderProgress(jobId) {
        const modalBody = document.getElementById('render-status-body');
        openModal('render-status-modal');
        closeModal('export-modal');

        if (this.renderPollTimer) clearInterval(this.renderPollTimer);

        this.renderPollTimer = setInterval(async () => {
            try {
                const res = await API.get(`/api/renders/${jobId}/status`);
                if (!res || !res.job) return;

                const job = res.job;
                const pct = job.progress || 0;

                modalBody.innerHTML = `
                    <div style="text-align: center; padding: 24px;">
                        <i class="fa-solid fa-compact-disc fa-spin" style="font-size: 38px; color: var(--accent-primary); margin-bottom: 16px;"></i>
                        <h4 style="margin-bottom: 8px; font-size: 18px; font-weight: 600;">Encoding video (${pct}%)</h4>
                        <p style="font-size: 16px; color: var(--text-secondary); margin-bottom: 20px;">
                            Compositing typography, visual effects, and audio at ${job.output_resolution} • ${job.fps} FPS
                        </p>
                        <div style="background: var(--surface-elevated); border: 1px solid var(--border-subtle); height: 10px; border-radius: 5px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%); width: ${pct}%; height: 100%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                `;

                if (job.status === 'completed') {
                    clearInterval(this.renderPollTimer);
                    modalBody.innerHTML = `
                        <div style="text-align: center; padding: 24px;">
                            <i class="fa-solid fa-circle-check" style="font-size: 42px; color: var(--color-success); margin-bottom: 16px;"></i>
                            <h3 style="margin-bottom: 8px; font-size: 20px; font-weight: 600;">Render Complete!</h3>
                            <p style="font-size: 16px; color: var(--text-secondary); margin-bottom: 24px;">
                                Your animated music video composition has been rendered in MP4 format.
                            </p>
                            <a href="${job.download_url}" class="btn btn-primary btn-export" download>
                                <i class="fa-solid fa-download"></i> Download Video (MP4)
                            </a>
                        </div>
                    `;
                } else if (job.status === 'failed') {
                    clearInterval(this.renderPollTimer);
                    modalBody.innerHTML = `
                        <div style="text-align: center; padding: 24px;">
                            <i class="fa-solid fa-triangle-exclamation" style="font-size: 42px; color: var(--color-error); margin-bottom: 16px;"></i>
                            <h4 style="margin-bottom: 8px; font-size: 18px; font-weight: 600;">Render Encountered Error</h4>
                            <p style="font-size: 16px; color: var(--color-error);">${job.error_message || 'Rendering failed'}</p>
                        </div>
                    `;
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 1500);
    }
};
