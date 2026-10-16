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
