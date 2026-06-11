// Taxonomy (Tags and Categories configuration) logic using ES6 Components
import { state } from './state.js';
import { getCategoryColor, showToast } from './ui.js';
import { getTaxonomy, saveTaxonomyItem as apiSaveTaxonomyItem, deleteTaxonomyItem as apiDeleteTaxonomyItem, fetchWorld } from './api.js';
import { el, icon } from './dom.js';

export async function fetchTaxonomy() {
    try {
        const data = await getTaxonomy();

        const newTaxonomy = [];
        if (data.room_tags) Object.keys(data.room_tags).forEach(label => newTaxonomy.push({ type: 'room_tag', label }));
        if (data.transition_categories) Object.keys(data.transition_categories).forEach(label => newTaxonomy.push({ type: 'transition_category', label }));
        if (data.transition_tags) Object.keys(data.transition_tags).forEach(label => newTaxonomy.push({ type: 'transition_tag', label }));
        state.systemTaxonomy = newTaxonomy;

        renderTaxonomy(data);
    } catch (err) {
        showToast('Taxonomy sync failed.', 'error');
    }
}

export function renderTaxonomy(data) {
    renderTaxList('list-room-tags', data.room_tags, 'room_tag');
    renderTaxList('list-transition-categories', data.transition_categories, 'transition_category');
    renderTaxList('list-transition-tags', data.transition_tags, 'transition_tag');
}

export function renderTaxList(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    Object.entries(items).forEach(([label, count]) => {
        const isTransCat = type === 'transition_category';
        const catColor = isTransCat ? getCategoryColor(label) : null;

        const div = el('div', { className: 'tax-item' }, [
            el('span', {
                className: isTransCat ? 'accent' : '',
                style: isTransCat ? { color: `${catColor}` } : {}
            }, label),
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
                el('span', {
                    className: 'tax-count',
                    style: isTransCat ? { borderColor: catColor, color: catColor } : {}
                }, String(count)),
                el('button', {
                    className: 'btn-remove-tiny',
                    title: 'Remove definition',
                    onClick: () => window.deleteTaxonomyItem(type, label)
                }, [icon('trash-2')])
            ])
        ]);
        container.appendChild(div);
    });

    if (window.lucide) lucide.createIcons();
}

export async function saveTaxonomyItem(type, inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const label = input.value.trim().toLowerCase();
    if (!label) return;

    try {
        const result = await apiSaveTaxonomyItem(type, label);
        if (result.success) {
            input.value = '';
            await fetchTaxonomy();
            const syncRes = await fetchWorld();
            state.roomsData = syncRes.rooms;
            state.transitionTypes = syncRes.transition_types || {};
            state.imageIndex = syncRes.image_index || { rooms: {}, transitions: {} };
            state.allInteractables = syncRes.interactables || {};
            state.systemTaxonomy = syncRes.taxonomy || [];
            showToast('Definition registered.', 'success');
        }
    } catch (err) {
        showToast('Failed to save definition.', 'error');
    }
}

// Bind deleteTaxonomyItem globally
window.deleteTaxonomyItem = async (type, label) => {
    if (!confirm(`Remove definition for '${label}'? This won't delete data from objects.`)) return;
    try {
        await apiDeleteTaxonomyItem(type, label);
        await fetchTaxonomy();
        const syncRes = await fetchWorld();
        state.roomsData = syncRes.rooms;
        state.transitionTypes = syncRes.transition_types || {};
        state.imageIndex = syncRes.image_index || { rooms: {}, transitions: {} };
        state.allInteractables = syncRes.interactables || {};
        state.systemTaxonomy = syncRes.taxonomy || [];
        showToast('Definition cleared.', 'info');
    } catch (err) {
        showToast('Purge failed.', 'error');
    }
};
