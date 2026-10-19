/**
 * LyricStudio Dashboard Logic
 */
let selectedAspect = '16:9';
let heroSelectedAspect = '16:9';
let heroAudioFile = null;
let heroArtworkFile = null;

// --- AI Creative Director Studio Hero Handlers ---

function selectHeroAspect(aspect) {
    heroSelectedAspect = aspect;
    document.querySelectorAll('.ai-aspect-chip').forEach(chip => {
        if (chip.getAttribute('data-aspect') === aspect) {
            chip.classList.add('selected');
        } else {
            chip.classList.remove('selected');
        }
    });
}

function handleHeroAudioSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setHeroAudioFile(file);
}

function setHeroAudioFile(file) {
    heroAudioFile = file;
    document.getElementById('hero-audio-empty').style.display = 'none';
    document.getElementById('hero-audio-filled').style.display = 'block';
    document.getElementById('hero-audio-name').textContent = file.name;
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    document.getElementById('hero-audio-size').textContent = `${mb} MB • Audio Track`;
    updateHeroGenerateButton();
}

function clearHeroAudio(e) {
    if (e) e.stopPropagation();
    heroAudioFile = null;
    document.getElementById('hero-audio-file').value = '';
    document.getElementById('hero-audio-filled').style.display = 'none';
    document.getElementById('hero-audio-empty').style.display = 'block';
    updateHeroGenerateButton();
}

function handleHeroArtworkSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setHeroArtworkFile(file);
}

function setHeroArtworkFile(file) {
    heroArtworkFile = file;
    document.getElementById('hero-artwork-empty').style.display = 'none';
    document.getElementById('hero-artwork-filled').style.display = 'block';
    document.getElementById('hero-artwork-name').textContent = file.name;
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    document.getElementById('hero-artwork-size').textContent = `${mb} MB • Cover Art`;
}

function clearHeroArtwork(e) {
    if (e) e.stopPropagation();
    heroArtworkFile = null;
    document.getElementById('hero-artwork-file').value = '';
    document.getElementById('hero-artwork-filled').style.display = 'none';
    document.getElementById('hero-artwork-empty').style.display = 'block';
}

function updateHeroGenerateButton() {
    const btn = document.getElementById('btn-hero-generate');
    if (btn) {
        btn.disabled = !heroAudioFile;
    }
}

// Drag & Drop Listeners
document.addEventListener('DOMContentLoaded', () => {
    const audioDrop = document.getElementById('hero-audio-dropzone');
    const artDrop = document.getElementById('hero-artwork-dropzone');

    if (audioDrop) {
        ['dragenter', 'dragover'].forEach(name => {
            audioDrop.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                audioDrop.classList.add('drag-active');
            });
        });
        ['dragleave', 'drop'].forEach(name => {
            audioDrop.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                audioDrop.classList.remove('drag-active');
            });
        });
        audioDrop.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                setHeroAudioFile(files[0]);
            }
        });
    }

    if (artDrop) {
        ['dragenter', 'dragover'].forEach(name => {
            artDrop.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                artDrop.classList.add('drag-active');
            });
        });
        ['dragleave', 'drop'].forEach(name => {
            artDrop.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                artDrop.classList.remove('drag-active');
            });
        });
        artDrop.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                setHeroArtworkFile(files[0]);
            }
        });
    }
});

async function startAIDraftGeneration() {
    if (!heroAudioFile) {
        showToast('Please select or drop an audio track first.', 'error');
        return;
    }

    const modal = document.getElementById('ai-progress-modal');
    if (modal) modal.style.display = 'flex';

    // Progressive step highlighter
    let currentStep = 1;
    const stepInterval = setInterval(() => {
        if (currentStep < 5) {
            const prevRow = document.getElementById(`step-row-${currentStep}`);
            if (prevRow) {
                prevRow.classList.remove('active');
                prevRow.classList.add('done');
                prevRow.querySelector('.ai-step-icon').innerHTML = '<i class="fa-solid fa-check"></i>';
            }
            currentStep++;
            const nextRow = document.getElementById(`step-row-${currentStep}`);
            if (nextRow) nextRow.classList.add('active');
        }
    }, 1800);

    try {
        const formData = new FormData();
        formData.append('audio_file', heroAudioFile);
        if (heroArtworkFile) {
            formData.append('artwork_file', heroArtworkFile);
        }
        formData.append('aspect_ratio', heroSelectedAspect);
        formData.append('title', heroAudioFile.name.replace(/\.[^/.]+$/, ''));

        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        const headers = {};
        if (csrfMeta && csrfMeta.content) {
            headers['X-CSRFToken'] = csrfMeta.content;
        }

        const res = await fetch('/api/ai/create-draft', {
            method: 'POST',
            body: formData,
            headers
        });

        clearInterval(stepInterval);

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Failed with HTTP ${res.status}`);
        }

        const data = await res.json();
        // Mark all steps complete
        for (let s = 1; s <= 6; s++) {
            const row = document.getElementById(`step-row-${s}`);
            if (row) {
                row.classList.remove('active');
                row.classList.add('done');
                row.querySelector('.ai-step-icon').innerHTML = '<i class="fa-solid fa-check"></i>';
            }
        }

        document.getElementById('ai-progress-status-text').textContent = 'Draft ready! Launching Creative Studio...';
        setTimeout(() => {
            window.location.href = data.redirect_url || `/editor/${data.project.id}`;
        }, 800);

    } catch (err) {
        clearInterval(stepInterval);
        if (modal) modal.style.display = 'none';
        showToast(err.message || 'AI Draft generation encountered an error.', 'error');
    }
}


function openNewProjectModal() {
    document.getElementById('proj-title').value = '';
    openModal('new-project-modal');
}

function selectAspect(el) {
    document.querySelectorAll('.aspect-tile').forEach(t => t.classList.remove('selected'));
    el.classList.add('selected');
    selectedAspect = el.getAttribute('data-aspect');
}

async function submitCreateProject() {
    const title = document.getElementById('proj-title').value.trim() || 'Untitled Lyric Video';
    const quality = document.getElementById('proj-quality').value;

    try {
        const res = await API.post('/api/projects', {
            title,
            aspect_ratio: selectedAspect,
            quality
        });
        if (res && res.project) {
            window.location.href = `/editor/${res.project.id}`;
        }
    } catch (err) {
        showToast(err.message || 'Failed to create project', 'error');
    }
}

async function duplicateProject(id) {
    try {
        showToast('Duplicating project...', 'info');
        const res = await API.post(`/api/projects/${id}/duplicate`);
        if (res && res.project) {
            showToast('Project duplicated successfully!', 'success');
            setTimeout(() => window.location.reload(), 600);
        }
    } catch (err) {
        showToast(err.message || 'Failed to duplicate project', 'error');
    }
}

async function renameProject(id, currentTitle) {
    const newTitle = prompt('Enter new project title:', currentTitle);
    if (!newTitle || newTitle.trim() === currentTitle) return;

    try {
        await API.put(`/api/projects/${id}`, { title: newTitle.trim() });
        showToast('Project renamed', 'success');
        setTimeout(() => window.location.reload(), 500);
    } catch (err) {
        showToast(err.message || 'Failed to rename project', 'error');
    }
}

async function deleteProject(id) {
    if (!confirm('Are you sure you want to permanently delete this project and all its media files?')) {
        return;
    }

    try {
        await API.delete(`/api/projects/${id}`);
        showToast('Project deleted', 'info');
        const card = document.getElementById(`project-card-${id}`);
        if (card) {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            card.style.transition = 'all 0.3s ease';
            setTimeout(() => card.remove(), 300);
        }
    } catch (err) {
        showToast(err.message || 'Failed to delete project', 'error');
    }
}

async function openDashboardAISettings() {
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
}

function togglePasswordVisibility(id) {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function testGeminiKey() {
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
}

async function saveGeminiKey() {
    const keyInput = document.getElementById('setting-gemini-key');
    const key = keyInput ? keyInput.value.trim() : '';

    try {
        showToast('Verifying and saving Gemini API key...', 'info');
        const res = await API.post('/api/settings/ai', { gemini_api_key: key });
        if (res && res.success) {
            showToast(res.message, 'success');
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
}
