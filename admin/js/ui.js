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
 * Map transition category names to appropriate Lucide icons
 */
export function getCategoryIcon(category) {
    const cat = (category || '').toLowerCase().trim();
    
    // Primary taxonomy categories
    if (cat === 'universal') return 'infinity';
    if (cat === 'formal') return 'briefcase';
    if (cat === 'aquatic') return 'waves';
    if (cat === 'concrete') return 'layers';
    if (cat === 'technology') return 'cpu';
    if (cat === 'noclip') return 'ghost';
    
    // Subcategory / description keywords helper matches
    if (cat.includes('elevator') || cat.includes('lift')) return 'chevrons-up-down';
    if (cat.includes('stair') || cat.includes('escalator')) return 'stairs';
    if (cat.includes('door')) return 'door-open';
    if (cat.includes('gate') || cat.includes('portal') || cat.includes('rift')) return 'sparkles';
    if (cat.includes('hallway') || cat.includes('corridor') || cat.includes('passage') || cat.includes('hall')) return 'route';
    if (cat.includes('ladder')) return 'chevrons-up';
    if (cat.includes('window')) return 'eye';
    if (cat.includes('vent') || cat.includes('shaft')) return 'wind';
    if (cat.includes('tunnel')) return 'aperture';
    if (cat.includes('secret') || cat.includes('hidden')) return 'eye-off';
    
    return 'route'; // Default path connection icon
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
