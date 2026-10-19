/**
 * LyricStudio Main Editor Application Controller
 * Orchestrates creative tool rail, drawer, canvas preview, contextual inspector, and timeline.
 * Author: LyricStudio Engineering
 */
const Editor = {
    project: null,
    autosaveTimer: null,
    renderPollTimer: null,
    activeDrawerTab: 'drawer-media',
    isDrawerOpen: true,

    init(projectData) {
        this.project = projectData;

        // Initialize sub-engines
        window.Preview = new PreviewEngine('preview-canvas', 'master-audio');
        window.Preview.setProject(this.project);

        window.Timeline = new TimelineEditor('editor-timeline');
        window.Timeline.init(this.project);

        SyncUI.init(this.project);

        this.setupCreativeRail();
        this.setupInspectorBindings();
        this.setupTemplateSelection();
        this.setupMediaUploads();
        this.setupHeaderActions();
        this.setupKeyboardShortcuts();
        this.checkAIStatus();
    },

    setupCreativeRail() {
        const railButtons = document.querySelectorAll('.rail-btn');
        const drawer = document.getElementById('rail-drawer');
        const drawerTitle = document.getElementById('drawer-title');

        railButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-target');
                const titleText = btn.querySelector('span')?.textContent || 'Creative Panel';

                if (this.activeDrawerTab === target && this.isDrawerOpen) {
                    // Clicking active button toggles/collapses drawer
                    this.toggleDrawer(false);
                    return;
                }

                railButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                document.querySelectorAll('.drawer-panel').forEach(p => p.classList.remove('active'));
                const panel = document.getElementById(target);
                if (panel) panel.classList.add('active');

                if (drawerTitle) drawerTitle.textContent = titleText;
                this.activeDrawerTab = target;
                this.toggleDrawer(true);
            });
        });
    },

    toggleDrawer(open) {
        const drawer = document.getElementById('rail-drawer');
        if (!drawer) return;
        this.isDrawerOpen = open;
        drawer.classList.toggle('collapsed', !open);

        if (!open) {
            document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
        } else {
            const currentBtn = document.querySelector(`.rail-btn[data-target="${this.activeDrawerTab}"]`);
            if (currentBtn) currentBtn.classList.add('active');
        }
    },

    toggleInspector(open) {
        const inspector = document.getElementById('studio-inspector');
        if (!inspector) return;
        if (open === undefined) {
            inspector.classList.toggle('collapsed');
        } else {
            inspector.classList.toggle('collapsed', !open);
        }
        const isCollapsed = inspector.classList.contains('collapsed');
        const toggleBtn = document.getElementById('btn-toggle-inspector');
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', !isCollapsed);
        }
    },

    switchInspectorTab(tabId) {
        this.toggleInspector(true);
        document.querySelectorAll('.inspector-tab').forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
        });
        document.querySelectorAll('.inspector-tab-panel').forEach(p => {
            p.classList.toggle('active', p.id === `itab-${tabId}`);
        });
    },

    setupTemplateSelection() {
        const currentId = (this.project.template_data && this.project.template_data.template_id) || 'midnight_cinema';
        document.querySelectorAll('.template-card').forEach(card => {
            const cardId = card.getAttribute('data-template-id');
            if (cardId === currentId || (cardId === 'midnight_cinema' && currentId === 'cinematic')) {
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
                    showToast(`Applied "${tObj.name}" signature template`, 'success');
                }
            });
        });
    },

    setMotionPreset(motionId) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.animation_type = motionId;

        document.querySelectorAll('.motion-preset-chip').forEach(chip => {
            chip.classList.toggle('active', chip.getAttribute('data-motion') === motionId);
        });

        const motionSelect = document.getElementById('prop-animation-type');
        if (motionSelect) motionSelect.value = motionId;

        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
        showToast(`Motion preset set to "${motionId}"`, 'info');
    },

    syncMotionDuration(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        this.project.template_data.animation_duration = num;
        const mainInput = document.getElementById('prop-animation-duration');
        if (mainInput) mainInput.value = num;
        window.Preview.templateConfig = this.project.template_data;
        this.triggerAutosave();
    },

    toggleBeatPulse(checked) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.beat_pulse = checked;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    updatePanX(val) {
        const num = parseInt(val);
        this.project.template_data.bg_pan_x = num;
        const badge = document.getElementById('panx-val-badge');
        if (badge) badge.textContent = `${num}%`;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    updatePanY(val) {
        const num = parseInt(val);
        this.project.template_data.bg_pan_y = num;
        const badge = document.getElementById('pany-val-badge');
        if (badge) badge.textContent = `${num}%`;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    addPresetText(type) {
        if (!this.project) return;
        const curTime = window.Preview ? window.Preview.currentTime : 0;
        if (type === 'title') {
            const newClip = {
                start: Math.round(curTime * 10) / 10,
                end: Math.round((curTime + 5.0) * 10) / 10,
                text: "✦ TITLE ANTHEM ✦",
                words: []
            };
            if (!this.project.lyrics_data) this.project.lyrics_data = [];
            this.project.lyrics_data.push(newClip);
            this.project.lyrics_data.sort((a, b) => a.start - b.start);
            if (window.Timeline) window.Timeline.renderTracks();
            if (window.Preview) {
                window.Preview.setProject(this.project);
                window.Preview.seek(newClip.start);
            }
            if (window.SyncUI) window.SyncUI.renderLinesList();
            this.triggerAutosave();
            showToast('Added Headline Layer at playhead', 'success');
        } else {
            if (window.SyncUI) {
                window.SyncUI.addNewLineAtPlayhead();
            }
        }
    },

    setTransitionStyle(style) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.transition_style = style;
        document.querySelectorAll('#drawer-transitions .motion-preset-chip').forEach(chip => {
            chip.classList.toggle('active', chip.getAttribute('data-transition') === style);
        });
        window.Preview.templateConfig = this.project.template_data;
        this.triggerAutosave();
        showToast(`Transition set to "${style}"`, 'info');
    },

    setTransitionDuration(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.transition_duration = num;
        window.Preview.templateConfig = this.project.template_data;
        this.triggerAutosave();
    },

    setTransitionEasing(val) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.transition_easing = val;
        window.Preview.templateConfig = this.project.template_data;
        this.triggerAutosave();
    },

    applyTransitionToAll() {
        const style = (this.project.template_data && this.project.template_data.transition_style) || 'crossfade';
        showToast(`Applied ${style} transition across all lyric line cuts!`, 'success');
        this.triggerAutosave();
    },

    updateRotation(val) {
        const num = parseInt(val);
        this.project.template_data.bg_rotation = num;
        const badge = document.getElementById('rotation-val-badge');
        if (badge) badge.textContent = `${num}°`;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isEditable = document.activeElement && document.activeElement.isContentEditable;
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (window.Preview) window.Preview.togglePlay();
            } else if (e.key === '?') {
                e.preventDefault();
                this.openShortcutsModal();
            } else if (e.key.toLowerCase() === 'l') {
                e.preventDefault();
                if (window.Preview) window.Preview.toggleLoop();
            }
        });
    },

    openShortcutsModal() {
        openModal('shortcuts-modal');
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
        const titleInput = document.getElementById('project-title-input');
        if (titleInput) {
            titleInput.value = this.project.title;
            titleInput.addEventListener('input', (e) => {
                this.project.title = e.target.value.trim() || 'Untitled Project';
                this.triggerAutosave();
            });
        }

        const aspectSelect = document.getElementById('aspect-select');
        if (aspectSelect) {
            aspectSelect.value = this.project.aspect_ratio || '16:9';
            aspectSelect.addEventListener('change', (e) => {
                const newAspect = e.target.value;
                this.project.aspect_ratio = newAspect;
                window.Preview.setDimensions(newAspect);
                const badge = document.getElementById('comp-aspect-badge');
                if (badge) badge.textContent = newAspect;
                this.triggerAutosave();
                showToast(`Format set to ${newAspect}`, 'info');
            });
        }
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

        // Placement
        bindInput('prop-position-y', 'position_y', parseInt, 'posy-val-badge', v => `${v}%`);
        bindInput('prop-position-x', 'position_x', parseInt, 'posx-val-badge', v => `${v}%`);

        // Background
        bindInput('prop-bg-color', 'background_color', v => v, 'bg-color-hex');
        bindInput('prop-bg-fit', 'bg_fit');
        bindInput('prop-overlay-opacity', 'overlay_opacity', parseFloat, 'overlay-val-badge', v => `${Math.round(v * 100)}%`);
        bindInput('prop-bg-blur', 'bg_blur', parseInt, 'blur-val-badge', v => `${v}px`);
        bindInput('prop-bg-zoom', 'bg_zoom');

        // Motion
        bindInput('prop-animation-type', 'animation_type');
        bindInput('prop-animation-duration', 'animation_duration', parseFloat);
        bindInput('prop-animation-direction', 'animation_direction');
        bindInput('prop-animation-easing', 'animation_easing');
        bindInput('prop-animation-intensity', 'animation_intensity');
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
        setVal('prop-letter-spacing-slider', cfg.letter_spacing || 3.0);
        setText('tracking-val-badge', `${cfg.letter_spacing || 3.0}px`);

        setVal('prop-text-color', cfg.text_color || '#F1EFEA');
        setText('text-color-hex', (cfg.text_color || '#F1EFEA').toUpperCase());

        setVal('prop-highlight-color', cfg.highlight_color || '#A994FF');
        setText('highlight-color-hex', (cfg.highlight_color || '#A994FF').toUpperCase());

        setVal('prop-outline-color', cfg.outline_color || '#090909');
        setText('outline-color-hex', (cfg.outline_color || '#090909').toUpperCase());

        setVal('prop-outline-width', cfg.outline_width !== undefined ? cfg.outline_width : 2);
        setText('outline-val-badge', `${cfg.outline_width !== undefined ? cfg.outline_width : 2}px`);

        setVal('prop-glow-color', cfg.glow_color || '#A994FF');
        setText('glow-color-hex', (cfg.glow_color || '#A994FF').toUpperCase());

        setVal('prop-glow-size', cfg.glow_size !== undefined ? cfg.glow_size : 18);
        setText('glow-val-badge', `${cfg.glow_size !== undefined ? cfg.glow_size : 18}px`);

        setVal('prop-position-y', cfg.position_y !== undefined ? cfg.position_y : 78);
        setText('posy-val-badge', `${cfg.position_y !== undefined ? cfg.position_y : 78}%`);

        setVal('prop-position-x', cfg.position_x !== undefined ? cfg.position_x : 50);
        setText('posx-val-badge', `${cfg.position_x !== undefined ? cfg.position_x : 50}%`);

        setVal('prop-bg-color', cfg.background_color || '#090909');
        setText('bg-color-hex', (cfg.background_color || '#090909').toUpperCase());

        setVal('prop-bg-fit', cfg.bg_fit || 'cover');
        setVal('prop-overlay-opacity', cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.4);
        setText('overlay-val-badge', `${Math.round((cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.4) * 100)}%`);

        setVal('prop-bg-blur', cfg.bg_blur !== undefined ? cfg.bg_blur : 0);
        setText('blur-val-badge', `${cfg.bg_blur !== undefined ? cfg.bg_blur : 0}px`);

        setVal('prop-bg-zoom', cfg.bg_zoom || 'zoom-in');
        setVal('prop-animation-type', cfg.animation_type || 'cinematic-rise');
        setVal('prop-animation-duration', cfg.animation_duration || 0.45);
        setVal('prop-animation-duration-ins', cfg.animation_duration || 0.45);
        setVal('prop-animation-direction', cfg.animation_direction || 'up');

        // Inspector-specific mirrored controls
        setVal('prop-font-family-ins', cfg.font_family);
        setVal('prop-font-size-slider-ins', cfg.font_size || 48);
        setText('ins-fontsize-badge', `${cfg.font_size || 48}pt`);
        setVal('prop-font-weight-ins', cfg.font_weight || '700');
        setVal('prop-letter-spacing-slider-ins', cfg.letter_spacing || 3.0);
        setText('tracking-val-badge-ins', `${cfg.letter_spacing || 3.0}px`);

        setVal('prop-bg-fit-ins', cfg.bg_fit || 'cover');
        setVal('prop-bg-zoom-ins', cfg.bg_zoom || 'zoom-in');
        setVal('prop-overlay-opacity-ins', cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.38);
        setText('overlay-val-badge-ins', `${Math.round((cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.38) * 100)}%`);
        setVal('prop-bg-blur-ins', cfg.bg_blur !== undefined ? cfg.bg_blur : 0);
        setText('blur-val-badge-ins', `${cfg.bg_blur !== undefined ? cfg.bg_blur : 0}px`);
        setVal('prop-bg-color-ins', cfg.background_color || '#0C1A2B');
        setText('bg-color-hex-ins', (cfg.background_color || '#0C1A2B').toUpperCase());

        setVal('prop-sync-offset', cfg.sync_offset_ms || 0);
        setText('sync-offset-badge', `${cfg.sync_offset_ms || 0} ms`);

        const letterboxToggle = document.getElementById('effect-letterbox-toggle');
        if (letterboxToggle) letterboxToggle.checked = Boolean(cfg.show_letterbox || cfg.template_id === 'midnight_cinema' || cfg.template_id === 'cinematic');

        const visToggle = document.getElementById('effect-visualizer-toggle');
        if (visToggle) visToggle.checked = Boolean(cfg.show_visualizer || cfg.template_id === 'visualizer');

        const beatPulseToggle = document.getElementById('effect-beat-pulse');
        if (beatPulseToggle) beatPulseToggle.checked = Boolean(cfg.beat_pulse !== false);
    },

    syncFontFamily(val) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.font_family = val;
        const d = document.getElementById('prop-font-family');
        if (d && d.value !== val) d.value = val;
        const ins = document.getElementById('prop-font-family-ins');
        if (ins && ins.value !== val) ins.value = val;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    syncFontWeight(val) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.font_weight = val;
        const d = document.getElementById('prop-font-weight');
        if (d && d.value !== val) d.value = val;
        const ins = document.getElementById('prop-font-weight-ins');
        if (ins && ins.value !== val) ins.value = val;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    syncBgFit(val) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.bg_fit = val;
        const d = document.getElementById('prop-bg-fit');
        if (d && d.value !== val) d.value = val;
        const ins = document.getElementById('prop-bg-fit-ins');
        if (ins && ins.value !== val) ins.value = val;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    syncBgZoom(val) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.bg_zoom = val;
        const d = document.getElementById('prop-bg-zoom');
        if (d && d.value !== val) d.value = val;
        const ins = document.getElementById('prop-bg-zoom-ins');
        if (ins && ins.value !== val) ins.value = val;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    syncOverlayOpacity(val) {
        if (!this.project || !this.project.template_data) return;
        const num = parseFloat(val);
        this.project.template_data.overlay_opacity = num;
        const d = document.getElementById('prop-overlay-opacity');
        if (d && d.value !== val) d.value = val;
        const ins = document.getElementById('prop-overlay-opacity-ins');
        if (ins && ins.value !== val) ins.value = val;
        const pct = `${Math.round(num * 100)}%`;
        const b1 = document.getElementById('overlay-val-badge');
        if (b1) b1.textContent = pct;
        const b2 = document.getElementById('overlay-val-badge-ins');
        if (b2) b2.textContent = pct;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    syncBgBlur(val) {
        if (!this.project || !this.project.template_data) return;
        const num = parseInt(val);
        this.project.template_data.bg_blur = num;
        const d = document.getElementById('prop-bg-blur');
        if (d && d.value !== val) d.value = val;
        const ins = document.getElementById('prop-bg-blur-ins');
        if (ins && ins.value !== val) ins.value = val;
        const txt = `${num}px`;
        const b1 = document.getElementById('blur-val-badge');
        if (b1) b1.textContent = txt;
        const b2 = document.getElementById('blur-val-badge-ins');
        if (b2) b2.textContent = txt;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    updateSyncOffset(val) {
        if (!this.project || !this.project.template_data) return;
        const num = parseInt(val);
        this.project.template_data.sync_offset_ms = num;
        const b = document.getElementById('sync-offset-badge');
        if (b) b.textContent = `${num > 0 ? '+' : ''}${num} ms`;
        this.triggerAutosave();
    },

    setBackgroundColor(hex) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.background_color = hex;
        const colorInput = document.getElementById('prop-bg-color');
        const hexLabel = document.getElementById('bg-color-hex');
        if (colorInput) colorInput.value = hex;
        if (hexLabel) hexLabel.textContent = hex.toUpperCase();
        const colorInputIns = document.getElementById('prop-bg-color-ins');
        const hexLabelIns = document.getElementById('bg-color-hex-ins');
        if (colorInputIns) colorInputIns.value = hex;
        if (hexLabelIns) hexLabelIns.textContent = hex.toUpperCase();
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

    toggleVisualizerEffect(checked) {
        if (!this.project || !this.project.template_data) return;
        this.project.template_data.show_visualizer = checked;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    updateFontSize(val) {
        if (!this.project || !this.project.template_data) return;
        const num = parseInt(val);
        this.project.template_data.font_size = num;
        const numInput = document.getElementById('prop-font-size');
        if (numInput && numInput.value !== String(num)) numInput.value = num;
        const slider = document.getElementById('prop-font-size-slider');
        if (slider && slider.value !== String(num)) slider.value = num;
        const insSlider = document.getElementById('prop-font-size-slider-ins');
        if (insSlider && insSlider.value !== String(num)) insSlider.value = num;
        const badge = document.getElementById('ins-fontsize-badge');
        if (badge) badge.textContent = `${num}pt`;
        window.Preview.templateConfig = this.project.template_data;
        window.Preview.renderFrame();
        this.triggerAutosave();
    },

    updateLetterSpacing(val) {
        if (!this.project || !this.project.template_data) return;
        const num = parseFloat(val);
        this.project.template_data.letter_spacing = num;
        const b1 = document.getElementById('tracking-val-badge');
        if (b1) b1.textContent = `${num}px`;
        const b2 = document.getElementById('tracking-val-badge-ins');
        if (b2) b2.textContent = `${num}px`;
        const s1 = document.getElementById('prop-letter-spacing-slider');
        if (s1 && s1.value !== String(num)) s1.value = num;
        const s2 = document.getElementById('prop-letter-spacing-slider-ins');
        if (s2 && s2.value !== String(num)) s2.value = num;
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
    },

    // --- AI Studio Controller ---
    currentAIProposal: null,

    async checkAIStatus() {
        try {
            const res = await API.get('/api/settings/ai');
            const dot = document.getElementById('ai-status-dot');
            const title = document.getElementById('ai-status-title');
            const subtitle = document.getElementById('ai-status-subtitle');
            const badge = document.getElementById('modal-gemini-badge');

            if (res && res.configured) {
                if (dot) dot.classList.add('active');
                if (title) title.textContent = 'Gemini 2.5 Flash: Active';
                if (subtitle) subtitle.textContent = 'Multimodal neural creative analysis ready';
                if (badge) {
                    badge.className = 'badge badge-success';
                    badge.textContent = 'Connected';
                }
            } else {
                if (dot) dot.classList.remove('active');
                if (title) title.textContent = 'Local Creative Mode';
                if (subtitle) subtitle.textContent = 'Click Setup to connect Gemini AI API';
                if (badge) {
                    badge.className = 'badge badge-warning';
                    badge.textContent = 'Key Required';
                }
            }
        } catch (e) {
            console.warn('AI status check error:', e);
        }
    },

    async openAISettingsModal() {
        openModal('ai-settings-modal');
        const feedback = document.getElementById('gemini-test-feedback');
        if (feedback) feedback.style.display = 'none';

        try {
            const res = await API.get('/api/settings/ai');
            const keyInput = document.getElementById('setting-gemini-key');
            if (keyInput && res && res.masked_key) {
                keyInput.placeholder = `Current Key: ${res.masked_key} (leave blank to keep)`;
            }
            const badge = document.getElementById('modal-gemini-badge');
            if (badge) {
                if (res && res.configured) {
                    badge.className = 'badge badge-success';
                    badge.textContent = 'Connected';
                } else {
                    badge.className = 'badge badge-warning';
                    badge.textContent = 'Key Required';
                }
            }
        } catch (e) {
            console.error('Failed to load AI settings:', e);
        }
    },

    togglePasswordVisibility(id) {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.type = inp.type === 'password' ? 'text' : 'password';
    },

    async testGeminiKey() {
        const keyInput = document.getElementById('setting-gemini-key');
        const key = keyInput ? keyInput.value.trim() : '';
        const feedback = document.getElementById('gemini-test-feedback');
        if (!feedback) return;

        feedback.style.display = 'block';
        feedback.style.color = 'var(--text-secondary)';
        feedback.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing connection to Gemini API...';

        try {
            const res = await API.post('/api/settings/ai', { test_only: true, gemini_api_key: key });
            if (res && res.success) {
                feedback.style.color = 'var(--color-success)';
                feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${res.message}`;
            } else {
                feedback.style.color = 'var(--color-error)';
                feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${res.error || 'Connection failed'}`;
            }
        } catch (err) {
            feedback.style.color = 'var(--color-error)';
            feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${err.message || 'Test failed'}`;
        }
    },

    async saveGeminiKey() {
        const keyInput = document.getElementById('setting-gemini-key');
        const key = keyInput ? keyInput.value.trim() : '';

        try {
            showToast('Verifying and saving Gemini API key...', 'info');
            const res = await API.post('/api/settings/ai', { gemini_api_key: key });
            if (res && res.success) {
                showToast(res.message, 'success');
                this.checkAIStatus();
                closeModal('ai-settings-modal');
            }
        } catch (err) {
            showToast(err.message || 'Failed to save key', 'error');
            const feedback = document.getElementById('gemini-test-feedback');
            if (feedback) {
                feedback.style.display = 'block';
                feedback.style.color = 'var(--color-error)';
                feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${err.message}`;
            }
        }
    },

    async runAIPropose() {
        const btn = document.getElementById('btn-run-ai-propose');
        const loader = document.getElementById('ai-loading-indicator');
        const results = document.getElementById('ai-proposal-results');

        if (btn) btn.disabled = true;
        if (loader) loader.style.display = 'block';
        if (results) results.style.display = 'none';

        try {
            const res = await API.post(`/api/projects/${this.project.id}/ai/propose`, {});
            if (res && res.success && res.proposal) {
                const prop = res.proposal;
                this.currentAIProposal = prop;

                // Populate UI
                const presetName = document.getElementById('ai-prop-preset-name');
                const providerTag = document.getElementById('ai-prop-provider');
                const rationale = document.getElementById('ai-prop-rationale');
                const colorText = document.getElementById('ai-color-text');
                const colorHighlight = document.getElementById('ai-color-highlight');
                const colorGlow = document.getElementById('ai-color-glow');
                const colorBg = document.getElementById('ai-color-bg');
                const specFont = document.getElementById('ai-spec-font');
                const specMotion = document.getElementById('ai-spec-motion');
                const specPos = document.getElementById('ai-spec-pos');
                const specLetterbox = document.getElementById('ai-spec-letterbox');

                if (presetName) presetName.textContent = prop.preset ? prop.preset.replace('_', ' ').toUpperCase() : 'Custom Style';
                if (providerTag) providerTag.textContent = prop.provider || 'AI Engine';
                if (rationale) rationale.textContent = prop.rationale || 'Art directed for melodic sync and visual depth.';

                if (colorText) colorText.style.background = prop.text_color || '#FFFFFF';
                if (colorHighlight) colorHighlight.style.background = prop.highlight_color || '#A994FF';
                if (colorGlow) colorGlow.style.background = prop.glow_color || '#4FACFE';
                if (colorBg) colorBg.style.background = prop.background_color || '#090909';

                if (specFont) specFont.textContent = (prop.font_family || 'Outfit').replace(/['"]/g, '').split(',')[0];
                if (specMotion) specMotion.textContent = (prop.animation_type || 'cinematic-rise').replace('-', ' ');
                if (specPos) specPos.textContent = `${prop.position_y || 76}% Y`;
                if (specLetterbox) specLetterbox.textContent = prop.preset === 'midnight_cinema' ? 'Enabled (2.39:1)' : 'Standard';

                // Scene changes
                const scenesList = document.getElementById('ai-scenes-list');
                if (scenesList && prop.scene_changes && prop.scene_changes.length > 0) {
                    scenesList.innerHTML = prop.scene_changes.map(sc => `
                        <div class="scene-chip">
                            <strong>${sc.start}s – ${sc.end}s:</strong> ${sc.description}
                        </div>
                    `).join('');
                }

                if (loader) loader.style.display = 'none';
                if (results) results.style.display = 'block';

                showToast('AI creative direction proposed!', 'success');
            }
        } catch (err) {
            showToast(err.message || 'Failed to generate proposal', 'error');
            if (loader) loader.style.display = 'none';
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    async applyCurrentAIProposal() {
        if (!this.currentAIProposal) return;
        try {
            showToast('Applying creative direction...', 'info');
            const res = await API.post(`/api/projects/${this.project.id}/ai/apply`, { proposal: this.currentAIProposal });
            if (res && res.success) {
                this.project.template_data = res.template_data;
                if (window.Preview) {
                    window.Preview.setProject(this.project);
                    window.Preview.render();
                }
                showToast('Creative direction applied to project canvas!', 'success');
            }
        } catch (err) {
            showToast(err.message || 'Failed to apply proposal', 'error');
        }
    },

    // --- Instant In-Browser Canvas Export ---
    async startClientSideCanvasExport() {
        if (!window.Preview || !this.project) return;
        closeModal('export-modal');
        showToast('Initiating browser canvas recording...', 'info');

        const canvas = window.Preview.canvas;
        const audio = document.getElementById('master-audio');
        const totalDuration = window.Preview.duration || 15.0;

        let stream;
        try {
            stream = canvas.captureStream(30);
            if (audio && audio.src && audio.captureStream) {
                const aStream = audio.captureStream();
                aStream.getAudioTracks().forEach(t => stream.addTrack(t));
            }
        } catch (e) {
            stream = canvas.captureStream(30);
        }

        const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
        const selectedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

        const recorder = new MediaRecorder(stream, { mimeType: selectedMime });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: selectedMime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
            a.download = `${(this.project.title || 'lyric_video').replace(/\s+/g, '_')}_instant.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Browser video export completed and downloaded!', 'success');
        };

        window.Preview.seek(0);
        recorder.start();
        window.Preview.play();

        const checkDone = setInterval(() => {
            if (window.Preview.currentTime >= totalDuration || !window.Preview.isPlaying) {
                clearInterval(checkDone);
                recorder.stop();
                window.Preview.pause();
            }
        }, 300);
    }
};
