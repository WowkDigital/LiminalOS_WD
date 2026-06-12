// Transition rendering and editor logic using ES6 Components
import { state } from './state.js';
import { getThumbPath, showToast } from './ui.js';
import { fetchWorld, fetchMedia, saveTransition, deleteTransition as apiDeleteTransition, assignMedia } from './api.js';
import { navigate } from './router.js';
import { refreshCategorySelectors } from './rooms.js';
import { el } from './dom.js';
import { TransitionCard } from './components/TransitionCard.js';
import { TextConfigRow } from './components/TextConfigRow.js';

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
        list.appendChild(el('div', { className: 'empty' }, 'No expansion overlays found. Define the first one.'));
        return;
    }

    allTrans.forEach(trans => {
        const cardComponent = new TransitionCard(trans, state.imageIndex, openTransitionEditor);
        list.appendChild(cardComponent.render());
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
    const exportArea = document.getElementById('trans-json-export');
    if (!exportArea) return;
    if (!state.currentEditId || state.currentContext !== 'transition') {
        exportArea.value = '';
        return;
    }
    const data = getTransitionDataFromForm();
    exportArea.value = JSON.stringify(data, null, 4);
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
        const thumb = el('div', { className: 'preview-thumb' }, [
            el('img', { src: `../${getThumbPath(m.filepath)}` }),
            el('div', {
                className: 'remove-overlay',
                onClick: (e) => {
                    e.stopPropagation();
                    window.unassignMediaItem(m.id);
                }
            }, '×')
        ]);
        container.appendChild(thumb);
    });

    if (transMedia.length === 0) {
        container.appendChild(el('div', { className: 'small-dim' }, 'No visuals assigned.'));
    }
}

export async function handleTransitionSubmit(e) {
    e.preventDefault();
    const transId = document.getElementById('trans-id').value.trim();
    const transData = getTransitionDataFromForm();

    try {
        // If coming from a draft temp ID, migrate any media assignments to the real ID
        if (state.currentEditId && state.currentEditId.startsWith('draft_') && state.currentEditId !== transId) {
            const draftMedia = state.mediaLibrary.filter(
                m => m.context_type === 'transition' && m.context_id === state.currentEditId
            );
            for (const m of draftMedia) {
                await assignMedia(m.id, 'transition', transId);
            }
            if (draftMedia.length > 0) {
                const mData = await fetchMedia();
                state.mediaLibrary = mData;
            }
        }

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

    const rowComponent = new TextConfigRow(item);
    const rendered = rowComponent.render();

    const removeBtn = rendered.querySelector('.btn-remove');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            rendered.remove();
            updateTransitionExportArea();
        });
    }

    rendered.addEventListener('input', updateTransitionExportArea);

    container.appendChild(rendered);
    if (window.lucide) lucide.createIcons();
    updateTransitionExportArea();
}
