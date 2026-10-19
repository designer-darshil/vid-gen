/**
 * LyricStudio Dashboard Logic
 */
let selectedAspect = '16:9';

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
