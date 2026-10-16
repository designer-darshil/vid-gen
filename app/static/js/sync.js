/**
 * LyricStudio Lyrics Synchronization & Timing UI
 */
const SyncUI = {
    project: null,

    init(project) {
        this.project = project;
        this.renderLinesList();
    },

    renderLinesList() {
        const list = document.getElementById('sync-lines-list');
        if (!list) return;

        list.innerHTML = '';
        const lyrics = this.project.lyrics_data || [];

        lyrics.forEach((line, idx) => {
            const card = document.createElement('div');
            card.className = 'sync-line-card';
            card.id = `sync-line-${idx}`;

            const mS = Math.floor(line.start / 60);
            const sS = Math.floor(line.start % 60);
            const msS = Math.floor((line.start % 1) * 10);

            const mE = Math.floor(line.end / 60);
            const sE = Math.floor(line.end % 60);
            const msE = Math.floor((line.end % 1) * 10);

            card.innerHTML = `
                <div class="sync-line-time">
                    <span>${mS}:${sS.toString().padStart(2, '0')}.${msS} → ${mE}:${sE.toString().padStart(2, '0')}.${msE}</span>
                    <button class="btn-icon" onclick="event.stopPropagation(); SyncUI.deleteLine(${idx})" title="Delete Line">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="sync-line-text" contenteditable="true" onblur="SyncUI.editLineText(${idx}, this.textContent)">
                    ${line.text}
                </div>
            `;

            card.addEventListener('click', () => {
                if (window.Preview) window.Preview.seek(line.start);
            });

            list.appendChild(card);
        });
    },

    highlightActiveLine(currentTime) {
        const lyrics = this.project ? (this.project.lyrics_data || []) : [];
        lyrics.forEach((line, idx) => {
            const card = document.getElementById(`sync-line-${idx}`);
            if (!card) return;
            if (currentTime >= line.start && currentTime <= line.end) {
                card.classList.add('current');
            } else {
                card.classList.remove('current');
            }
        });
    },

    async runAutoSync() {
        const text = document.getElementById('lyrics-input-area').value.trim();
        if (!text) {
            showToast('Please paste or upload lyrics text first', 'info');
            return;
        }

        try {
            showToast('Analyzing audio energy and aligning syllables...', 'info');
            const res = await API.post(`/api/projects/${this.project.id}/sync`, { text, format: 'auto' });
            if (res && res.lyrics) {
                this.project.lyrics_data = res.lyrics;
                this.renderLinesList();
                if (window.Timeline) window.Timeline.renderTracks();
                if (window.Preview) window.Preview.renderFrame();
                showToast('Lyrics synchronized with audio!', 'success');
            }
        } catch (err) {
            showToast(err.message || 'Synchronization failed', 'error');
        }
    },

    async runAutoTranscribe() {
        if (!this.project.audio_asset) {
            showToast('Please upload a song audio file in Media tab first', 'info');
            return;
        }

        try {
            showToast('Detecting vocal envelopes and transcribing phrases...', 'info');
            const res = await API.post(`/api/projects/${this.project.id}/transcribe`);
            if (res && res.lyrics) {
                this.project.lyrics_data = res.lyrics;
                this.renderLinesList();
                if (window.Timeline) window.Timeline.renderTracks();
                if (window.Preview) window.Preview.renderFrame();
                showToast('Vocals transcribed with timestamps!', 'success');
            }
        } catch (err) {
            showToast(err.message || 'Transcription failed', 'error');
        }
    },

    async applySyncOffset() {
        const offsetVal = parseFloat(document.getElementById('sync-offset-input').value) || 0.0;
        if (offsetVal === 0) return;

        try {
            const res = await API.post(`/api/projects/${this.project.id}/sync/offset`, { offset: offsetVal });
            if (res && res.lyrics) {
                this.project.lyrics_data = res.lyrics;
                this.renderLinesList();
                if (window.Timeline) window.Timeline.renderTracks();
                if (window.Preview) window.Preview.renderFrame();
                showToast(`Applied ${offsetVal > 0 ? '+' : ''}${offsetVal}s timing offset`, 'success');
            }
        } catch (err) {
            showToast(err.message || 'Failed to adjust offset', 'error');
        }
    },

    editLineText(idx, newText) {
        if (!this.project || !this.project.lyrics_data[idx]) return;
        this.project.lyrics_data[idx].text = newText.trim();
        if (window.Timeline) window.Timeline.renderTracks();
        if (window.Preview) window.Preview.renderFrame();
        if (window.Editor) window.Editor.triggerAutosave();
    },

    deleteLine(idx) {
        if (!this.project || !this.project.lyrics_data) return;
        this.project.lyrics_data.splice(idx, 1);
        this.renderLinesList();
        if (window.Timeline) window.Timeline.renderTracks();
        if (window.Preview) window.Preview.renderFrame();
        if (window.Editor) window.Editor.triggerAutosave();
        showToast('Line removed', 'info');
    },

    addNewLineAtPlayhead() {
        if (window.Timeline) {
            window.Timeline.addLyricAtPlayhead();
        }
    }
};
