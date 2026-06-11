// General UI Helper utilities for the LiminalOS Admin Panel

/**
 * Generate a procedural color for a category string
 */
export function getCategoryColor(category) {
    if (!category || category === 'universal') return '#eab308'; // Default accent

    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 85%, 65%)`;
}

/**
 * Get the path to a thumbnail image
 */
export function getThumbPath(path) {
    if (!path) return '';
    if (path.startsWith('media/uploads/')) {
        return path.replace('media/uploads/', 'media/images/thumbs/');
    }
    return path;
}

/**
 * Display a temporary toast notification in the UI
 */
export function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}
