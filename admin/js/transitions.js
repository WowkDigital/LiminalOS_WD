// Transition rendering and editor logic
import { state } from './state.js';
import { getCategoryColor, getThumbPath, showToast } from './ui.js';
import { fetchWorld, fetchMedia, saveTransition, deleteTransition as apiDeleteTransition } from './api.js';
import { navigate } from './router.js';
import { refreshCategorySelectors } from './rooms.js';

export function renderTransitionsList() {
    const list = document.getElementById('transitions-list');
    if (!list) return;
    list.innerHTML = '';

    let allTrans = [];
    Object.entries(state.transitionTypes).forEach(([cat, items]) => {
        items.forEach(item => {
            allTrans.push({ ...item, cat });
        });
    });

    if (allTrans.length === 0) {
        list.innerHTML = '<div class="empty">No expansion overlays found. Define the first one.</div>';
        return;
    }

    allTrans.forEach(trans => {
        const card = document.createElement('div');
        card.className = 'room-card';

        const transImages = state.imageIndex.transitions[trans.id] || [];
        const thumbUrl = transImages.length > 0 ? `../${getThumbPath(transImages[0])}` : null;
        const thumbHtml = thumbUrl ? `<div class="room-card-thumb"><img src="${thumbUrl}" alt=""></div>` : '<div class="room-card-thumb empty-thumb"><span>NO DATA</span></div>';

        const catColor = getCategoryColor(trans.cat);

        card.innerHTML = `
            ${thumbHtml}
            <div class="room-card-content">
                <h3>${trans.label} <span class="small-dim">${trans.id}</span></h3>
                <p>Category: <strong style="color: ${catColor}">${trans.cat}</strong></p>
                <div class="room-meta">
                    ${(trans.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `;
        card.onclick = () => openTransitionEditor(trans.id);
        list.appendChild(card);
    });
}

export function openTransitionEditor(id = null) {
    state.currentEditId = id;
    state.currentContext = 'transition';
    refreshCategorySelectors();
    navigate('transEditor');

    const title = document.getElementById('trans-editor-title');
    const idInput = document.getElementById('trans-id');
    const textsContainer = document.getElementById('trans-texts-list');
    const deleteBtn = document.getElementById('btn-delete-transition');
    const transForm = document.getElementById('trans-form');

    textsContainer.innerHTML = '';

    if (id) {
        let trans = null;
        Object.values(state.transitionTypes).forEach(list => {
            const found = list.find(t => t.id === id);
            if (found) trans = found;
        });

        if (!trans) return;

        title.innerText = `Edit Transition: ${trans.label}`;
        idInput.value = id;
        idInput.readOnly = true;

        const transCats = trans.categories || [trans.category || trans.cat];
        refreshCategorySelectors(transCats);

        document.getElementById('trans-label').value = trans.label;
        document.getElementById('trans-desc').value = trans.desc;
        document.getElementById('trans-tags').value = (trans.tags || []).join(', ');
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        (trans.texts || []).forEach(text => addTransTextField(text));
        renderTransMediaPreview();
    } else {
        title.innerText = "Define New Transition";
        if (transForm) transForm.reset();
        idInput.value = '';
        idInput.readOnly = false;
        if (deleteBtn) deleteBtn.classList.add('hidden');
        addTransTextField();
        refreshCategorySelectors(['universal']);
    }

    updateTransitionExportArea();
}

export function getTransitionDataFromForm() {
    const transForm = document.getElementById('trans-form');
    const formData = new FormData(transForm);
    const textRows = document.querySelectorAll('#trans-texts-list .text-config-row');
    const texts = Array.from(textRows).map(row => ({
        text: row.querySelector('.text-content').value.trim(),
        sanity_min: parseInt(row.querySelector('.text-smin').value) || 0,
        sanity_max: parseInt(row.querySelector('.text-smax').value) || 100,
        dialogue_id: row.querySelector('.text-did').value.trim() || null
    })).filter(t => t.text);

    const categories = Array.from(document.querySelectorAll('#trans-category-group input:checked')).map(cb => cb.value);
    return {
        categories: categories,
        label: formData.get('label'),
        desc: formData.get('desc'),
        tags: (formData.get('tags') || '').split(',').map(s => s.trim()).filter(s => s),
        texts: texts
    };
}

export function updateTransitionExportArea() {
    if (!state.currentEditId || state.currentContext !== 'transition') {
        document.getElementById('trans-json-export').value = '';
        return;
    }
    const data = getTransitionDataFromForm();
    document.getElementById('trans-json-export').value = JSON.stringify(data, null, 4);
}

export function applyTransitionJSON() {
    const jsonStr = document.getElementById('trans-json-import').value.trim();
    if (!jsonStr) return;
    try {
        const data = JSON.parse(jsonStr);
        if (typeof data !== 'object') throw new Error("Invalid structure");

        const transCats = data.categories || [data.category || data.cat];
        refreshCategorySelectors(transCats);

        document.getElementById('trans-label').value = data.label || '';
        document.getElementById('trans-desc').value = data.desc || '';
        document.getElementById('trans-tags').value = (data.tags || []).join(', ');

        const textsContainer = document.getElementById('trans-texts-list');
        textsContainer.innerHTML = '';
        (data.texts || []).forEach(text => addTransTextField(text));

        showToast('JSON data applied to form. Remember to save.', 'info');
    } catch (e) {
        showToast('Invalid JSON: ' + e.message, 'error');
    }
}

export function renderTransMediaPreview() {
    const container = document.getElementById('trans-images-preview');
    if (!container) return;
    container.innerHTML = '';
    const transMedia = state.mediaLibrary.filter(m => m.context_type === 'transition' && m.context_id === state.currentEditId);
    transMedia.forEach(m => {
        const thumb = document.createElement('div');
        thumb.className = 'preview-thumb';
        thumb.innerHTML = `
            <img src="../${getThumbPath(m.filepath)}">
            <div class="remove-overlay" onclick="event.stopPropagation(); window.unassignMediaItem(${m.id})">&times;</div>
        `;
        container.appendChild(thumb);
    });
    if (transMedia.length === 0) container.innerHTML = '<div class="small-dim">No visuals assigned.</div>';
}

export async function handleTransitionSubmit(e) {
    e.preventDefault();
    const transId = document.getElementById('trans-id').value.trim();
    const transData = getTransitionDataFromForm();

    try {
        const result = await saveTransition(transId, transData);
        if (result.success) {
            showToast('Liminal path secured.', 'success');
            const syncRes = await fetchWorld();
            state.roomsData = syncRes.rooms;
            state.transitionTypes = syncRes.transition_types || {};
            state.imageIndex = syncRes.image_index || { rooms: {}, transitions: {} };
            state.allInteractables = syncRes.interactables || {};
            state.systemTaxonomy = syncRes.taxonomy || [];
            navigate('transitions');
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast('Update failed: ' + err.message, 'error');
    }
}

export async function handleDeleteTransition() {
    if (!state.currentEditId) return;
    if (!confirm(`Delete transition '${state.currentEditId}'?`)) return;

    try {
        const result = await apiDeleteTransition(state.currentEditId);
        if (result.success) {
            showToast('Path collapsed.', 'success');
            const syncRes = await fetchWorld();
            state.roomsData = syncRes.rooms;
            state.transitionTypes = syncRes.transition_types || {};
            state.imageIndex = syncRes.image_index || { rooms: {}, transitions: {} };
            state.allInteractables = syncRes.interactables || {};
            state.systemTaxonomy = syncRes.taxonomy || [];
            navigate('transitions');
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

export function addTransTextField(item = {}) {
    const container = document.getElementById('trans-texts-list');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'text-config-row';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '5px';
    div.style.padding = '10px';
    div.style.border = '1px solid #333';
    div.style.marginBottom = '10px';
    div.style.background = 'rgba(255,255,255,0.05)';

    const content = typeof item === 'string' ? item : (item.text || '');
    const sMin = item.sanity_min !== undefined ? item.sanity_min : 0;
    const sMax = item.sanity_max !== undefined ? item.sanity_max : 100;
    const dId = item.dialogue_id || '';

    div.innerHTML = `
        <div style="display:flex; gap:10px; align-items: center;">
            <input type="text" class="text-content" value="${content}" placeholder="Atmospheric line..." style="flex-grow:1">
            <button type="button" class="btn-remove" onclick="this.closest('.text-config-row').remove()">X</button>
        </div>
        <div style="display:flex; gap:10px; font-size: 0.8em; color: #aaa; margin-top: 5px;">
            <div style="flex:1">
                Sanity Min: <input type="number" class="text-smin" value="${sMin}" min="0" max="100" style="width: 100%; background:rgba(0,0,0,0.5); border: 1px solid #555; color: #fff; padding: 4px; border-radius: 4px;">
            </div>
            <div style="flex:1">
                Sanity Max: <input type="number" class="text-smax" value="${sMax}" min="0" max="100" style="width: 100%; background:rgba(0,0,0,0.5); border: 1px solid #555; color: #fff; padding: 4px; border-radius: 4px;">
            </div>
            <div style="flex:2">
                Dialog ID: <input type="text" class="text-did" value="${dId}" placeholder="None" style="width: 100%; background:rgba(0,0,0,0.5); border: 1px solid #555; color: #fff; padding: 4px; border-radius: 4px;">
            </div>
        </div>
    `;
    container.appendChild(div);
}
