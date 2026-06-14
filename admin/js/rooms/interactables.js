// Room-interactable checkboxes and management logic
import { state } from '../state.js';
import { fetchWorld, deleteInteractable } from '../api.js';
import { showToast } from '../ui.js';
import { el, icon } from '../dom.js';
import { updateRoomExportArea } from './editor.js';

export function renderInteractablesCheckboxes(selectedItems) {
    const container = document.getElementById('interactables-checkbox-group');
    if (!container) return;
    container.innerHTML = '';

    const roomId = state.currentEditId;
    const roomInteractables = Object.entries(state.allInteractables).filter(([id, data]) => {
        return data.room_id === roomId;
    });

    if (roomInteractables.length === 0) {
        container.appendChild(el('small', { style: { display: 'block', marginBottom: '10px', color: 'var(--text-muted)' } }, 'No interactables defined for this room.'));
    } else {
        roomInteractables.forEach(([id, data]) => {
            const hasReq = !!state.editorRequirements.interactables[id];
            const hasArea = !!state.editorRequirements.interactableClickAreas?.[id];

            const row = el('div', { className: 'config-row' }, [
                el('div', { className: 'inter-info' }, [
                    el('span', { className: 'inter-label' }, data.label || id),
                    el('span', { className: 'inter-id' }, id)
                ]),
                el('div', { className: 'config-row-actions' }, [
                    el('button', {
                        type: 'button',
                        className: 'btn-cfg btn-edit',
                        onClick: () => window.editRoomInteractable(id),
                        title: 'Edit Object',
                        style: { marginRight: '6px' }
                    }, [icon('edit-3')]),
                    el('button', {
                        type: 'button',
                        className: `btn-cfg btn-area ${hasArea ? 'has-area' : ''}`,
                        onClick: () => window.openClickAreaModal(id, 'interactable'),
                        title: 'Configure click area',
                        style: { marginRight: '6px' }
                    }, [icon('maximize')]),
                    el('button', {
                        type: 'button',
                        className: `btn-cfg ${hasReq ? 'has-req' : ''}`,
                        onClick: () => window.openRequirementsModal('interactables', id),
                        title: 'Configure requirements',
                        style: { marginRight: '6px' }
                    }, [icon('settings')]),
                    el('button', {
                        type: 'button',
                        className: 'btn-cfg btn-danger btn-delete',
                        onClick: () => window.deleteRoomInteractable(id),
                        title: 'Delete Object'
                    }, [icon('trash-2')])
                ])
            ]);
            container.appendChild(row);
        });
    }

    if (roomId) {
        const createBtn = el('button', {
            type: 'button',
            className: 'btn-small btn-primary-outline',
            onClick: () => window.createRoomInteractable(roomId),
            style: { marginTop: '10px' }
        }, '+ Create Object for Room');
        container.appendChild(createBtn);
    } else {
        container.appendChild(el('small', { style: { display: 'block', marginTop: '10px', color: 'var(--text-muted)' } }, 'Save the room first to define objects for it.'));
    }

    if (window.lucide) lucide.createIcons();
}

window.editRoomInteractable = (id) => {
    state.backToRoom = state.currentEditId;
    if (window.openInteractableEditor) {
        window.openInteractableEditor(id);
    }
};

window.createRoomInteractable = (roomId) => {
    state.backToRoom = roomId;
    state.prefilledRoomId = roomId;
    if (window.openInteractableEditor) {
        window.openInteractableEditor(null);
    }
};

window.deleteRoomInteractable = async (id) => {
    if (!confirm(`Are you sure you want to delete the object '${id}'? This will completely remove it from the system.`)) return;
    try {
        const result = await deleteInteractable(id);
        if (result.success) {
            showToast('Object deleted.', 'success');
            const syncRes = await fetchWorld();
            state.roomsData = syncRes.rooms;
            state.allInteractables = syncRes.interactables || {};
            
            // Clean up state
            if (state.editorRequirements && state.editorRequirements.interactables) {
                delete state.editorRequirements.interactables[id];
                delete state.editorRequirements.interactableClickAreas[id];
            }
            
            renderInteractablesCheckboxes([]);
            updateRoomExportArea();
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
};
