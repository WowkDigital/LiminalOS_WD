// Taxonomy (Tags and Categories configuration) logic
import { state } from './state.js';
import { getCategoryColor, showToast } from './ui.js';
import { getTaxonomy, saveTaxonomyItem as apiSaveTaxonomyItem, deleteTaxonomyItem as apiDeleteTaxonomyItem, fetchWorld } from './api.js';

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
        const div = document.createElement('div');
        div.className = 'tax-item';
        const isTransCat = type === 'transition_category';
        const catColor = isTransCat ? getCategoryColor(label) : null;

        div.innerHTML = `
            <span class="${isTransCat ? 'accent' : ''}" style="${isTransCat ? `color: ${catColor} !important` : ''}">${label}</span>
            <div style="display:flex; align-items:center; gap:12px">
                <span class="tax-count" style="${isTransCat ? `border-color: ${catColor}; color: ${catColor}` : ''}">${count}</span>
                <button class="btn-remove-tiny" onclick="window.deleteTaxonomyItem('${type}', '${label}')" title="Remove definition">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            </div>
        `;
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
