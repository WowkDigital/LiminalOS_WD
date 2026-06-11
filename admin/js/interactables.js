// Interactables rendering and editor logic
import { state } from './state.js';
import { getThumbPath, showToast } from './ui.js';
import { fetchWorld, saveInteractable, deleteInteractable as apiDeleteInteractable } from './api.js';
import { navigate } from './router.js';
import { renderModalMediaList } from './media.js';

export function renderInteractablesList() {
    const list = document.getElementById('interactables-list');
    if (!list) return;
    list.innerHTML = '';
    if (Object.keys(state.allInteractables).length === 0) {
        list.innerHTML = '<div class="empty">No interactables found. Define the first one.</div>';
        return;
    }

    Object.entries(state.allInteractables).forEach(([id, data]) => {
        const card = document.createElement('div');
        card.className = 'room-card';

        const thumbUrl = data.states && data.states[0] && data.states[0].image ? `../${getThumbPath(data.states[0].image)}` : null;
        const thumbHtml = thumbUrl ? `<div class="room-card-thumb"><img src="${thumbUrl}" alt=""></div>` : '<div class="room-card-thumb empty-thumb"><span>NO IMAGE</span></div>';

        card.innerHTML = `
            ${thumbHtml}
            <div class="room-card-content">
                <h3>${data.label} <span class="small-dim">${id}</span></h3>
                <p>${data.states ? data.states.length : 0} states defined.</p>
            </div>
        `;
        card.onclick = () => openInteractableEditor(id);
        list.appendChild(card);
    });
}

export function openInteractableEditor(id = null) {
    state.currentEditId = id;
    state.currentContext = 'interactable';
    navigate('interEditor');

    const title = document.getElementById('inter-editor-title');
    const idInput = document.getElementById('inter-id');
    const labelInput = document.getElementById('inter-label');
    const statesContainer = document.getElementById('states-list');
    const deleteBtn = document.getElementById('btn-delete-interactable');
    const interForm = document.getElementById('inter-form');

    statesContainer.innerHTML = '';

    if (id) {
        title.innerText = `Edit Object: ${state.allInteractables[id].label}`;
        idInput.value = id;
        idInput.readOnly = true;
        labelInput.value = state.allInteractables[id].label;
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        (state.allInteractables[id].states || []).forEach(state => addStateField(state));
    } else {
        title.innerText = "Define New Object";
        if (interForm) interForm.reset();
        idInput.value = '';
        idInput.readOnly = false;
        if (deleteBtn) deleteBtn.classList.add('hidden');
        addStateField({ id: 'default', desc: 'Default state description' });
    }

    updateInteractableExportArea();
}

export function getInteractableDataFromForm() {
    const interForm = document.getElementById('inter-form');
    const formData = new FormData(interForm);
    const sIds = Array.from(document.querySelectorAll('input[name="state_id[]"]')).map(i => i.value);
    const sDescs = Array.from(document.querySelectorAll('textarea[name="state_desc[]"]')).map(i => i.value);
    const sImages = Array.from(document.querySelectorAll('input[name="state_image[]"]')).map(i => i.value);
    const states = sIds.map((sid, idx) => ({ id: sid, desc: sDescs[idx], image: sImages[idx] }));

    return {
        label: formData.get('label').trim(),
        states: states
    };
}

export function updateInteractableExportArea() {
    if (!state.currentEditId || state.currentContext !== 'interactable') {
        document.getElementById('inter-json-export').value = '';
        return;
    }
    const data = getInteractableDataFromForm();
    document.getElementById('inter-json-export').value = JSON.stringify(data, null, 4);
}

export function applyInteractableJSON() {
    const jsonStr = document.getElementById('inter-json-import').value.trim();
    if (!jsonStr) return;
    try {
        const data = JSON.parse(jsonStr);
        if (typeof data !== 'object') throw new Error("Invalid structure");

        document.getElementById('inter-label').value = data.label || '';

        const statesContainer = document.getElementById('states-list');
        statesContainer.innerHTML = '';
        (data.states || []).forEach(state => addStateField(state));

        showToast('JSON data applied to form. Remember to save.', 'info');
        updateInteractableExportArea();
    } catch (e) {
        showToast('Invalid JSON: ' + e.message, 'error');
    }
}

export function addStateField(item = {}) {
    const container = document.getElementById('states-list');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'form-section';
    div.style.marginBottom = '1rem';
    div.innerHTML = `
        <div style="display:flex; justify-content: space-between; margin-bottom: 0.5rem">
            <strong>State Configuration</strong>
            <button type="button" class="btn-remove" style="width:auto; height:auto; padding: 4px 8px" onclick="this.closest('.form-section').remove()">Remove State</button>
        </div>
        <div class="form-group" style="margin-bottom: 10px">
            <label>State ID</label>
            <input type="text" name="state_id[]" value="${item.id || ''}" placeholder="e.g. on" required>
        </div>
        <div class="form-group" style="margin-bottom: 10px">
            <label>Description</label>
            <textarea name="state_desc[]" rows="2" placeholder="...">${item.desc || ''}</textarea>
        </div>
        <div class="form-group" style="margin-bottom: 0">
            <label>Visual Asset</label>
            <div class="media-picker-row">
                <input type="text" name="state_image[]" value="${item.image || ''}" placeholder="media/uploads/..." readonly>
                <button type="button" class="btn-secondary" style="padding: 10px" onclick="window.pickStateImage(this)">Select from Library</button>
            </div>
            <div class="state-image-preview">
                <img src="${item.image ? '../' + item.image : ''}" class="${item.image ? '' : 'hidden'}">
                <div class="${item.image ? 'hidden' : 'no-image'}">No Asset Selected</div>
            </div>
        </div>
    `;
    container.appendChild(div);
}

export async function handleInteractableSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('inter-id').value.trim();
    const interactableData = getInteractableDataFromForm();

    try {
        const result = await saveInteractable(id, interactableData);
        if (result.success) {
            showToast('Object saved.', 'success');
            const syncRes = await fetchWorld();
            state.roomsData = syncRes.rooms;
            state.transitionTypes = syncRes.transition_types || {};
            state.imageIndex = syncRes.image_index || { rooms: {}, transitions: {} };
            state.allInteractables = syncRes.interactables || {};
            state.systemTaxonomy = syncRes.taxonomy || [];
            navigate('interactables');
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    }
}

export async function handleDeleteInteractable() {
    if (!state.currentEditId) return;
    if (!confirm(`Delete '${state.currentEditId}' forever?`)) return;
    try {
        const result = await apiDeleteInteractable(state.currentEditId);
        if (result.success) {
            showToast('Purged.', 'success');
            const syncRes = await fetchWorld();
            state.roomsData = syncRes.rooms;
            state.transitionTypes = syncRes.transition_types || {};
            state.imageIndex = syncRes.image_index || { rooms: {}, transitions: {} };
            state.allInteractables = syncRes.interactables || {};
            state.systemTaxonomy = syncRes.taxonomy || [];
            navigate('interactables');
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

// Bind pickStateImage on window for dynamic HTML buttons
window.pickStateImage = (btn) => {
    const row = btn.closest('.media-picker-row');
    const input = row.querySelector('input');
    const preview = row.nextElementSibling;
    const img = preview.querySelector('img');
    const placeholder = preview.querySelector('.no-image');

    state.mediaPickerCallback = (media) => {
        input.value = media.filepath;
        img.src = '../' + media.filepath;
        img.classList.remove('hidden');
        placeholder.classList.add('hidden');
    };

    const modal = document.getElementById('media-modal');
    modal.classList.remove('hidden');
    document.querySelector('.modal-header h3').innerText = 'Select Asset';
    renderModalMediaList();
};
