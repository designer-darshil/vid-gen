/**
 * LyricStudio Core API Client & UI Utilities
 */
const API = {
    async request(url, options = {}) {
        options.headers = options.headers || {};
        
        // Include CSRF token if meta tag is present
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta && csrfMeta.content) {
            options.headers['X-CSRFToken'] = csrfMeta.content;
        }

        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        try {
            const res = await fetch(url, options);
            if (res.status === 401) {
                window.location.href = '/login';
                return null;
            }
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || `HTTP error ${res.status}`);
            }
            return data;
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    },

    get(url) {
        return this.request(url, { method: 'GET' });
    },

    post(url, body) {
        return this.request(url, { method: 'POST', body });
    },

    put(url, body) {
        return this.request(url, { method: 'PUT', body });
    },

    delete(url) {
        return this.request(url, { method: 'DELETE' });
    },

    async upload(url, formData) {
        return this.request(url, { method: 'POST', body: formData });
    }
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-triangle';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}
