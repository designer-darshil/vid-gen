/**
 * LyricStudio Multitrack Interactive Timeline
 * Handles tracks, draggable clips, resizing, audio waveform, magnetic snapping, scrubbing, and undo/redo.
 */
class TimelineEditor {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scrollArea = document.getElementById('timeline-scroll-area');
        this.ruler = document.getElementById('timeline-ruler');
        this.playhead = document.getElementById('timeline-playhead');
        this.waveformCanvas = document.getElementById('waveform-canvas');

        this.pixelsPerSecond = 80;
        this.duration = 60.0;
        this.currentTime = 0.0;
        this.isScrubbing = false;
        this.isSnapEnabled = true;
        this.snapThreshold = 10; // pixels

        this.project = null;
        this.selectedClip = null;
        this.undoStack = [];
        this.redoStack = [];
        this.peaks = null;

        this.setupEventListeners();
    }

    init(project) {
        this.project = project;
        this.duration = (project.audio_asset && project.audio_asset.duration) ? project.audio_asset.duration : (project.duration || 60.0);
        this.updateDimensions();
        this.renderRuler();
        this.renderTracks();
        this.loadWaveform();
    }

    pushUndoState() {
        if (!this.project) return;
        const state = JSON.stringify({
            timeline_data: this.project.timeline_data,
            lyrics_data: this.project.lyrics_data
        });
        this.undoStack.push(state);
        if (this.undoStack.length > 30) this.undoStack.shift();
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const current = JSON.stringify({
            timeline_data: this.project.timeline_data,
            lyrics_data: this.project.lyrics_data
        });
        this.redoStack.push(current);

        const prev = JSON.parse(this.undoStack.pop());
        this.project.timeline_data = prev.timeline_data;
        this.project.lyrics_data = prev.lyrics_data;

        this.renderTracks();
        if (window.Preview) window.Preview.setProject(this.project);
        if (window.SyncUI) window.SyncUI.renderLinesList();
        if (window.Editor) window.Editor.triggerAutosave();
        showToast('Undo', 'info');
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const current = JSON.stringify({
            timeline_data: this.project.timeline_data,
            lyrics_data: this.project.lyrics_data
        });
        this.undoStack.push(current);

        const next = JSON.parse(this.redoStack.pop());
        this.project.timeline_data = next.timeline_data;
        this.project.lyrics_data = next.lyrics_data;

        this.renderTracks();
        if (window.Preview) window.Preview.setProject(this.project);
        if (window.SyncUI) window.SyncUI.renderLinesList();
        if (window.Editor) window.Editor.triggerAutosave();
        showToast('Redo', 'info');
    }

    setZoom(val) {
        this.pixelsPerSecond = Math.max(30, Math.min(300, parseInt(val)));
        const slider = document.getElementById('timeline-zoom-slider');
        if (slider) slider.value = this.pixelsPerSecond;

        this.updateDimensions();
        this.renderRuler();
        this.renderTracks();
        this.updatePlayhead(this.currentTime);
        this.drawWaveform();
    }

    zoomStep(delta) {
        this.setZoom(this.pixelsPerSecond + delta);
    }

    toggleSnap() {
        this.isSnapEnabled = !this.isSnapEnabled;
        const btn = document.getElementById('btn-snap-toggle');
        if (btn) {
            btn.classList.toggle('active', this.isSnapEnabled);
        }
        showToast(`Timeline magnetic snap ${this.isSnapEnabled ? 'enabled' : 'disabled'}`, 'info');
    }

    updateDimensions() {
        const totalW = Math.max(window.innerWidth - 140, this.duration * this.pixelsPerSecond + 200);
        const wrapper = document.getElementById('timeline-tracks-wrapper');
        if (wrapper) wrapper.style.width = `${totalW}px`;
        if (this.ruler) this.ruler.style.width = `${totalW}px`;
    }

    renderRuler() {
        if (!this.ruler) return;
        this.ruler.innerHTML = '';
        const stepSec = this.pixelsPerSecond > 120 ? 1 : (this.pixelsPerSecond > 60 ? 2 : 5);

        for (let t = 0; t <= this.duration + 5; t += stepSec) {
            const mark = document.createElement('div');
            mark.className = 'ruler-mark';
            mark.style.left = `${t * this.pixelsPerSecond}px`;
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            mark.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            this.ruler.appendChild(mark);
        }
    }

    renderTracks() {
        const lyricsLane = document.getElementById('lane-lyrics');
        const imagesLane = document.getElementById('lane-images');

        if (lyricsLane) lyricsLane.innerHTML = '';
        if (imagesLane) imagesLane.innerHTML = '';

        // 1. Render Lyrics Clips
        if (lyricsLane && this.project && this.project.lyrics_data) {
            this.project.lyrics_data.forEach((line, idx) => {
                const clip = this.createClipElement(line, 'lyrics', idx);
                lyricsLane.appendChild(clip);
            });
        }

        // 2. Render Image & B-Roll clips
        if (imagesLane && this.project && this.project.timeline_data) {
            const imgTrack = (this.project.timeline_data.tracks || []).find(t => t.type === 'image');
            if (imgTrack && imgTrack.clips) {
                imgTrack.clips.forEach((c, idx) => {
                    const clip = this.createClipElement(c, 'images', idx);
                    imagesLane.appendChild(clip);
                });
            }
        }

        this.highlightActiveClips(this.currentTime);
    }

    createClipElement(item, trackType, index) {
        const clip = document.createElement('div');
        clip.className = `timeline-clip clip-${trackType}`;
        clip.setAttribute('data-index', index);
        clip.setAttribute('data-track', trackType);

        const leftPx = item.start * this.pixelsPerSecond;
        const widthPx = Math.max(16, (item.end - item.start) * this.pixelsPerSecond);

        clip.style.left = `${leftPx}px`;
        clip.style.width = `${widthPx}px`;
        clip.textContent = item.text || item.title || `${trackType} clip`;

        // Left Resize Handle
        const handleL = document.createElement('div');
        handleL.className = 'clip-handle-l';
        handleL.addEventListener('mousedown', (e) => this.startResizeClip(e, item, clip, 'left', trackType));
        clip.appendChild(handleL);

        // Right Resize Handle
        const handleR = document.createElement('div');
        handleR.className = 'clip-handle-r';
        handleR.addEventListener('mousedown', (e) => this.startResizeClip(e, item, clip, 'right', trackType));
        clip.appendChild(handleR);

        // Clip Drag & Selection
        clip.addEventListener('mousedown', (e) => {
            if (e.target === handleL || e.target === handleR) return;
            this.selectClip(clip, item, trackType);
            this.startDragClip(e, item, clip, trackType);
        });

        return clip;
    }

    selectClip(clipEl, itemData, trackType) {
        document.querySelectorAll('.timeline-clip').forEach(c => c.classList.remove('selected'));
        clipEl.classList.add('selected');
        this.selectedClip = { element: clipEl, data: itemData, trackType };

        const badge = document.getElementById('inspector-element-badge');
        if (badge) {
            const label = trackType === 'lyrics' ? `Lyric Line` : `Image Clip`;
            badge.textContent = label;
        }

        // Seek preview to start of clip
        if (window.Preview) {
            window.Preview.seek(itemData.start);
        }
    }

    getSnapTargets(excludeItem) {
        if (!this.isSnapEnabled) return [];
        const targets = [this.currentTime];

        // Add all other clip boundaries
        if (this.project && this.project.lyrics_data) {
            this.project.lyrics_data.forEach(l => {
                if (l !== excludeItem) {
                    targets.push(l.start);
                    targets.push(l.end);
                }
            });
        }
        if (this.project && this.project.timeline_data) {
            (this.project.timeline_data.tracks || []).forEach(t => {
                (t.clips || []).forEach(c => {
                    if (c !== excludeItem) {
                        targets.push(c.start);
                        targets.push(c.end);
                    }
                });
            });
        }
        return targets;
    }

    applySnap(targetSec, snapTargets) {
        if (!this.isSnapEnabled || !snapTargets.length) return targetSec;
        const snapThresholdSec = this.snapThreshold / this.pixelsPerSecond;

        for (const snapPoint of snapTargets) {
            if (Math.abs(targetSec - snapPoint) <= snapThresholdSec) {
                return snapPoint;
            }
        }
        return targetSec;
    }

    startDragClip(e, item, clipEl, trackType) {
        e.stopPropagation();
        this.pushUndoState();

        const startMouseX = e.clientX;
        const initialStart = item.start;
        const duration = item.end - item.start;
        const snapTargets = this.getSnapTargets(item);

        const onMouseMove = (moveEvt) => {
            const deltaX = moveEvt.clientX - startMouseX;
            const deltaSec = deltaX / this.pixelsPerSecond;
            let rawStart = Math.max(0, initialStart + deltaSec);

            // Apply snap to start or end
            let snappedStart = this.applySnap(rawStart, snapTargets);
            if (snappedStart === rawStart) {
                const snappedEnd = this.applySnap(rawStart + duration, snapTargets);
                if (snappedEnd !== rawStart + duration) {
                    snappedStart = Math.max(0, snappedEnd - duration);
                }
            }

            item.start = Math.round(snappedStart * 100) / 100;
            item.end = Math.round((snappedStart + duration) * 100) / 100;

            clipEl.style.left = `${item.start * this.pixelsPerSecond}px`;
            if (window.Preview) window.Preview.renderFrame();
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (window.SyncUI) window.SyncUI.renderLinesList();
            if (window.Editor) window.Editor.triggerAutosave();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    startResizeClip(e, item, clipEl, side, trackType) {
        e.stopPropagation();
        this.pushUndoState();

        const startMouseX = e.clientX;
        const initialStart = item.start;
        const initialEnd = item.end;
        const snapTargets = this.getSnapTargets(item);

        const onMouseMove = (moveEvt) => {
            const deltaX = moveEvt.clientX - startMouseX;
            const deltaSec = deltaX / this.pixelsPerSecond;

            if (side === 'left') {
                let rawStart = Math.max(0, Math.min(initialEnd - 0.2, initialStart + deltaSec));
                const snappedStart = this.applySnap(rawStart, snapTargets);
                item.start = Math.round(snappedStart * 100) / 100;
                clipEl.style.left = `${item.start * this.pixelsPerSecond}px`;
                clipEl.style.width = `${(item.end - item.start) * this.pixelsPerSecond}px`;
            } else {
                let rawEnd = Math.max(item.start + 0.2, initialEnd + deltaSec);
                const snappedEnd = this.applySnap(rawEnd, snapTargets);
                item.end = Math.round(snappedEnd * 100) / 100;
                clipEl.style.width = `${(item.end - item.start) * this.pixelsPerSecond}px`;
            }
            if (window.Preview) window.Preview.renderFrame();
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (window.SyncUI) window.SyncUI.renderLinesList();
            if (window.Editor) window.Editor.triggerAutosave();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    addLyricAtPlayhead() {
        if (!this.project) return;
        if (!this.project.lyrics_data) this.project.lyrics_data = [];

        this.pushUndoState();
        const start = Math.round(this.currentTime * 100) / 100;
        const end = Math.min(this.duration, Math.round((start + 3.0) * 100) / 100);

        const newLine = {
            start: start,
            end: end,
            text: "New Lyric Phrase",
            words: []
        };

        this.project.lyrics_data.push(newLine);
        this.project.lyrics_data.sort((a, b) => a.start - b.start);

        this.renderTracks();
        if (window.SyncUI) window.SyncUI.renderLinesList();
        if (window.Preview) window.Preview.renderFrame();
        if (window.Editor) window.Editor.triggerAutosave();
        showToast('Added lyric phrase at playhead', 'success');
    }

    splitSelectedClip() {
        if (!this.selectedClip) {
            showToast('Select a clip first to split', 'info');
            return;
        }
        const { data, trackType } = this.selectedClip;
        if (this.currentTime <= data.start || this.currentTime >= data.end) {
            showToast('Place playhead inside the clip to split', 'info');
            return;
        }

        this.pushUndoState();
        const oldEnd = data.end;
        data.end = Math.round(this.currentTime * 100) / 100;

        if (trackType === 'lyrics') {
            const newLine = {
                start: Math.round(this.currentTime * 100) / 100,
                end: oldEnd,
                text: `${data.text} (split)`,
                words: []
            };
            this.project.lyrics_data.push(newLine);
            this.project.lyrics_data.sort((a, b) => a.start - b.start);
        } else if (trackType === 'images') {
            const imgTrack = (this.project.timeline_data.tracks || []).find(t => t.type === 'image');
            if (imgTrack && imgTrack.clips) {
                const newClip = {
                    ...data,
                    id: 'clip_' + Date.now(),
                    start: Math.round(this.currentTime * 100) / 100,
                    end: oldEnd
                };
                imgTrack.clips.push(newClip);
            }
        }

        this.renderTracks();
        if (window.SyncUI) window.SyncUI.renderLinesList();
        if (window.Editor) window.Editor.triggerAutosave();
        showToast('Clip split successfully', 'success');
    }

    deleteSelectedClip() {
        if (!this.selectedClip) return;
        const { data, trackType } = this.selectedClip;

        this.pushUndoState();
        if (trackType === 'lyrics') {
            this.project.lyrics_data = this.project.lyrics_data.filter(l => l !== data);
        } else if (trackType === 'images') {
            const track = (this.project.timeline_data.tracks || []).find(t => t.type === 'image');
            if (track) track.clips = track.clips.filter(c => c !== data);
        }

        this.selectedClip = null;
        this.renderTracks();
        if (window.SyncUI) window.SyncUI.renderLinesList();
        if (window.Preview) window.Preview.renderFrame();
        if (window.Editor) window.Editor.triggerAutosave();
        showToast('Clip deleted', 'info');
    }

    async loadWaveform() {
        if (!this.project || !this.project.audio_asset) return;
        try {
            const res = await API.get(`/api/assets/${this.project.audio_asset.id}/waveform`);
            if (res && res.peaks) {
                this.peaks = res.peaks;
                this.drawWaveform();
            }
        } catch (err) {
            console.warn('Could not load waveform:', err);
        }
    }

    drawWaveform() {
        if (!this.waveformCanvas || !this.peaks) return;
        const totalW = this.duration * this.pixelsPerSecond;
        this.waveformCanvas.width = totalW;
        this.waveformCanvas.height = 42;
        this.waveformCanvas.style.width = `${totalW}px`;

        const ctx = this.waveformCanvas.getContext('2d');
        ctx.clearRect(0, 0, totalW, 42);

        const step = totalW / this.peaks.length;
        const grad = ctx.createLinearGradient(0, 0, 0, 42);
        grad.addColorStop(0, '#10B981');
        grad.addColorStop(1, '#059669');
        ctx.fillStyle = grad;

        for (let i = 0; i < this.peaks.length; i++) {
            const peak = this.peaks[i];
            const barH = Math.max(3, peak * 36);
            const x = i * step;
            const y = (42 - barH) / 2;
            ctx.fillRect(x, y, Math.max(1, step - 0.5), barH);
        }
    }

    updatePlayhead(time) {
        this.currentTime = time;
        if (this.playhead) {
            this.playhead.style.left = `${time * this.pixelsPerSecond}px`;
        }
        this.highlightActiveClips(time);
    }

    highlightActiveClips(time) {
        document.querySelectorAll('.clip-lyrics').forEach(clipEl => {
            const idx = parseInt(clipEl.getAttribute('data-index'));
            const line = this.project && this.project.lyrics_data && this.project.lyrics_data[idx];
            if (line && time >= line.start && time <= line.end) {
                clipEl.classList.add('active-playback');
            } else {
                clipEl.classList.remove('active-playback');
            }
        });
    }

    setupEventListeners() {
        // Scrubbing on Time Ruler
        if (this.ruler) {
            const handleRulerScrub = (e) => {
                const rect = this.ruler.getBoundingClientRect();
                const scrollLeft = this.scrollArea.scrollLeft;
                const clickX = e.clientX - rect.left + scrollLeft;
                const newTime = Math.max(0, Math.min(this.duration, clickX / this.pixelsPerSecond));
                if (window.Preview) window.Preview.seek(newTime);
            };

            this.ruler.addEventListener('mousedown', (e) => {
                this.isScrubbing = true;
                handleRulerScrub(e);
            });

            window.addEventListener('mousemove', (e) => {
                if (this.isScrubbing) handleRulerScrub(e);
            });

            window.addEventListener('mouseup', () => {
                this.isScrubbing = false;
            });
        }

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isContentEditable = document.activeElement && document.activeElement.isContentEditable;
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || isContentEditable) return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (window.Preview) window.Preview.togglePlay();
            } else if (e.code === 'Delete' || e.code === 'Backspace') {
                e.preventDefault();
                this.deleteSelectedClip();
            } else if (e.code === 'KeyS') {
                e.preventDefault();
                this.splitSelectedClip();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) this.redo();
                else this.undo();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                if (window.Preview) window.Preview.seek(window.Preview.currentTime - (e.shiftKey ? 5 : 1));
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                if (window.Preview) window.Preview.seek(window.Preview.currentTime + (e.shiftKey ? 5 : 1));
            }
        });
    }
}
