// Interactables rendering and editor logic using ES6 Components
import { state } from './state.js';
import { showToast } from './ui.js';
import { fetchWorld, saveInteractable, deleteInteractable as apiDeleteInteractable, fetchMedia } from './api.js';
import { navigate } from './router.js';
import { renderModalMediaList } from './media.js';
import { el } from './dom.js';
import { InteractableCard } from './components/InteractableCard.js';
import { StateConfigRow } from './components/StateConfigRow.js';

export function renderInteractablesList() {
    const list = document.getElementById('interactables-list');
    if (!list) return;
    list.innerHTML = '';
    if (Object.keys(state.allInteractables).length === 0) {
        list.appendChild(el('div', { className: 'empty' }, 'No interactables found. Define the first one.'));
        return;
    }

    Object.entries(state.allInteractables).forEach(([id, data]) => {
        const cardComponent = new InteractableCard(id, data, openInteractableEditor);
        list.appendChild(cardComponent.render());
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

    // Populate room_id dropdown
    const roomSelect = document.getElementById('inter-room-id');
    if (roomSelect) {
        roomSelect.innerHTML = '';
        roomSelect.appendChild(el('option', { value: '' }, '-- Select Room --'));
        Object.entries(state.roomsData).forEach(([rId, rData]) => {
            roomSelect.appendChild(el('option', { value: rId }, rData.name || rId));
        });
    }

    if (id) {
        title.innerText = `Edit Object: ${state.allInteractables[id].label}`;
        idInput.value = id;
        idInput.readOnly = true;
        labelInput.value = state.allInteractables[id].label;
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        if (roomSelect) {
            roomSelect.value = state.allInteractables[id].room_id || '';
            roomSelect.disabled = false;
        }

        (state.allInteractables[id].states || []).forEach(state => addStateField(state));
    } else {
        title.innerText = "Define New Object";
        if (interForm) {
            interForm.reset();
        }
        idInput.value = '';
        idInput.readOnly = false;
        if (deleteBtn) deleteBtn.classList.add('hidden');

        if (roomSelect) {
            if (state.prefilledRoomId) {
                roomSelect.value = state.prefilledRoomId;
                roomSelect.disabled = true;
                idInput.value = state.prefilledRoomId + '_';
            } else {
                roomSelect.value = '';
                roomSelect.disabled = false;
            }
        }

        addStateField({ id: 'default', desc: 'Default state description' });
    }

    updateInteractableExportArea();
}
window.openInteractableEditor = openInteractableEditor;

export function getInteractableDataFromForm() {
    const interForm = document.getElementById('inter-form');
    const formData = new FormData(interForm);
    const sIds = Array.from(document.querySelectorAll('input[name="state_id[]"]')).map(i => i.value);
    const sDescs = Array.from(document.querySelectorAll('textarea[name="state_desc[]"]')).map(i => i.value);
    const sImages = Array.from(document.querySelectorAll('input[name="state_image[]"]')).map(i => i.value);
    const states = sIds.map((sid, idx) => ({ id: sid, desc: sDescs[idx], image: sImages[idx] }));

    const id = document.getElementById('inter-id')?.value.trim();
    const roomSelect = document.getElementById('inter-room-id');
    const roomId = roomSelect ? roomSelect.value : null;
    const existingReq = (id && state.allInteractables[id] && state.allInteractables[id].requirements) || null;

    return {
        label: formData.get('label').trim(),
        room_id: roomId || null,
        requirements: existingReq,
        states: states
    };
}

export function updateInteractableExportArea() {
    const exportArea = document.getElementById('inter-json-export');
    if (!exportArea) return;
    if (!state.currentEditId || state.currentContext !== 'interactable') {
        exportArea.value = '';
        return;
    }
    const data = getInteractableDataFromForm();
    exportArea.value = JSON.stringify(data, null, 4);
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

    const rowComponent = new StateConfigRow(
        item,
        null, // Handled below programmatically
        (imageInput, previewImg, noImagePlaceholder) => {
            state.mediaPickerCallback = (media) => {
                imageInput.value = media.filepath;
                previewImg.src = '../' + media.filepath;
                previewImg.classList.remove('hidden');
                noImagePlaceholder.classList.add('hidden');
                updateInteractableExportArea();
            };

            const modal = document.getElementById('media-modal');
            modal.classList.remove('hidden');
            document.querySelector('.modal-header h3').innerText = 'Select Asset';
            renderModalMediaList();
        }
    );

    const rendered = rowComponent.render();

    const removeBtn = rendered.querySelector('.btn-remove');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            rendered.remove();
            updateInteractableExportArea();
        });
    }

    rendered.addEventListener('input', updateInteractableExportArea);

    container.appendChild(rendered);
    if (window.lucide) lucide.createIcons();
    updateInteractableExportArea();
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
            
            const mRes = await fetchMedia();
            state.mediaLibrary = mRes;
            
            if (state.backToRoom) {
                const backRoom = state.backToRoom;
                state.backToRoom = null;
                state.prefilledRoomId = null;
                navigate(`editor?id=${encodeURIComponent(backRoom)}`);
            } else {
                navigate('interactables');
            }
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
            
            const mRes = await fetchMedia();
            state.mediaLibrary = mRes;
            
            if (state.backToRoom) {
                const backRoom = state.backToRoom;
                state.backToRoom = null;
                state.prefilledRoomId = null;
                navigate(`editor?id=${encodeURIComponent(backRoom)}`);
            } else {
                navigate('interactables');
            }
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}
