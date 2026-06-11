// Room rendering, integrity check, and editor logic using ES6 Components
import { state } from './state.js';
import { getCategoryColor, getThumbPath, showToast, getCategoryIcon } from './ui.js';
import { fetchWorld, fetchMedia, saveRoom, assignMedia, deleteRoom } from './api.js';
import { navigate } from './router.js';
import { el, icon } from './dom.js';
import { RoomCard } from './components/RoomCard.js';
import { TextConfigRow } from './components/TextConfigRow.js';

export function renderRoomsList() {
    const list = document.getElementById('rooms-list');
    if (!list) return;
    list.innerHTML = '';
    if (Object.keys(state.roomsData).length === 0) {
        list.appendChild(el('div', { className: 'empty' }, 'No active zones detected. Initiate new sequence.'));
        return;
    }

    Object.entries(state.roomsData).forEach(([id, room]) => {
        // Calculate reachability
        const canEnter = Object.entries(state.roomsData).some(([otherId, otherRoom]) => {
            if (otherId === id) return false;
            return (otherRoom.transitions || []).some(t => {
                const cat = typeof t === 'string' ? t : t.category;
                return state.transitionTypes[cat] && state.transitionTypes[cat].length > 0;
            });
        });
        room.canEnter = canEnter;

        const cardComponent = new RoomCard(
            id, 
            room, 
            state.transitionTypes, 
            state.imageIndex, 
            Object.keys(state.roomsData).length, 
            openEditor
        );
        list.appendChild(cardComponent.render());
    });

    if (window.lucide) {
        lucide.createIcons();
    }

    checkWorldIntegrity();
}

export function checkWorldIntegrity() {
    const container = document.getElementById('world-integrity-status');
    if (!container) return;
    container.innerHTML = '';

    const rooms = Object.entries(state.roomsData);
    if (rooms.length === 0) return;

    const deadEnds = [];
    const orphans = [];
    const startRoomId = 'lobby';
    const visited = new Set();
    const queue = [startRoomId];

    if (state.roomsData[startRoomId]) {
        visited.add(startRoomId);
        while (queue.length > 0) {
            const currentId = queue.shift();
            const room = state.roomsData[currentId];
            const hasExits = (room.transitions || []).some(t => {
                const cat = typeof t === 'string' ? t : t.category;
                return state.transitionTypes[cat] && state.transitionTypes[cat].length > 0;
            });

            if (hasExits) {
                Object.keys(state.roomsData).forEach(id => {
                    if (id !== currentId && !visited.has(id)) {
                        visited.add(id);
                        queue.push(id);
                    }
                });
            }
        }
    }

    rooms.forEach(([id, room]) => {
        const hasExits = (room.transitions || []).some(t => {
            const cat = typeof t === 'string' ? t : t.category;
            return state.transitionTypes[cat] && state.transitionTypes[cat].length > 0;
        });
        if (!hasExits && rooms.length > 1) {
            deadEnds.push(id);
        }

        if (!visited.has(id)) {
            orphans.push(id);
        }
    });

    let statusEl;
    if (deadEnds.length === 0 && orphans.length === 0 && state.roomsData[startRoomId]) {
        statusEl = el('div', {}, [
            el('div', { className: 'integrity-badge valid' }, [
                icon('check-circle'),
                ' Graph Connected'
            ]),
            el('div', { className: 'integrity-message' }, 'All nodes reachable via liminal paths.')
        ]);
    } else {
        const isError = orphans.length > 0 || !state.roomsData[startRoomId];
        const badgeClass = isError ? 'error' : 'warning';
        const iconName = isError ? 'alert-octagon' : 'alert-triangle';
        const label = isError ? 'Graph Fragmented' : 'World Instability';

        const items = [
            el('div', { className: `integrity-badge ${badgeClass}` }, [
                icon(iconName),
                ` ${label}`
            ])
        ];

        if (!state.roomsData[startRoomId]) {
            items.push(el('div', { className: 'integrity-message' }, [icon('x'), " Missing 'lobby' sequence."]));
        }
        if (orphans.length > 0) {
            items.push(el('div', { className: 'integrity-message' }, [icon('x'), ` ${orphans.length} unreachable zones.`]));
        }
        if (deadEnds.length > 0) {
            items.push(el('div', { className: 'integrity-message' }, [icon('alert-circle'), ` ${deadEnds.length} dead ends detected.`]));
        }

        statusEl = el('div', {}, items);
    }

    container.appendChild(statusEl);
    if (window.lucide) lucide.createIcons();
}

export function renderRoomMediaPreview() {
    const container = document.getElementById('room-images-preview');
    if (!container) return;
    container.innerHTML = '';
    const roomMedia = state.mediaLibrary.filter(m => m.context_type === 'room' && m.context_id === state.currentEditId);
    
    roomMedia.forEach(m => {
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

    if (roomMedia.length === 0) {
        container.appendChild(el('div', { className: 'small-dim' }, 'No images assigned.'));
    }
}

export function renderInteractablesCheckboxes(selectedItems) {
    const container = document.getElementById('interactables-checkbox-group');
    if (!container) return;
    container.innerHTML = '';
    if (Object.keys(state.allInteractables).length === 0) {
        container.appendChild(el('small', {}, 'No interactables defined in system.'));
        return;
    }

    const selectedIds = selectedItems.map(i => typeof i === 'string' ? i : i.id);

    Object.entries(state.allInteractables).forEach(([id, data]) => {
        const isChecked = selectedIds.includes(id);
        const hasReq = !!state.editorRequirements.interactables[id];

        const row = el('div', { className: 'config-row' }, [
            el('div', { className: 'inter-info' }, [
                el('span', { className: 'inter-label' }, data.label || id),
                el('span', { className: 'inter-id' }, id)
            ]),
            el('div', { className: 'config-row-actions' }, [
                el('button', {
                    type: 'button',
                    className: `btn-cfg ${hasReq ? 'has-req' : ''}`,
                    onClick: () => window.openRequirementsModal('interactables', id),
                    title: 'Configure requirements'
                }, [icon('settings')]),
                el('input', {
                    type: 'checkbox',
                    value: id,
                    checked: isChecked
                })
            ])
        ]);
        container.appendChild(row);
    });
    if (window.lucide) lucide.createIcons();
}

export function refreshCategorySelectors(selectedValues = null) {
    const transGroup = document.getElementById('trans-category-group');
    const categories = new Set(['universal']);

    if (state.transitionTypes && typeof state.transitionTypes === 'object') {
        Object.keys(state.transitionTypes).forEach(cat => {
            if (cat && cat !== 'universal') categories.add(cat);
        });
    }

    if (Array.isArray(state.systemTaxonomy)) {
        state.systemTaxonomy.forEach(t => {
            const type = (t.type || '').trim();
            const label = (t.label || '').trim();
            if (type === 'transition_category' && label) {
                categories.add(label);
            }
        });
    }

    const fillContainer = (container, groupName) => {
        if (!container) return;
        const currentSelected = selectedValues || Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
        container.innerHTML = '';

        Array.from(categories).sort((a, b) => {
            if (a === 'universal') return -1;
            if (b === 'universal') return 1;
            return a.localeCompare(b);
        }).forEach(cat => {
            if (!cat) return;
            const isChecked = currentSelected.includes(cat);
            const hasReq = !!state.editorRequirements.transitions[cat];

            if (groupName === 'room-editor') {
                const row = el('div', { className: 'config-row' }, [
                    el('div', { className: 'cat-info-row' }, [
                        icon(getCategoryIcon(cat), { style: { width: '16px', height: '16px', color: 'var(--accent-primary)' } }),
                        el('span', { 
                            className: 'cat-label'
                        }, cat === 'universal' ? 'Universal' : cat.charAt(0).toUpperCase() + cat.slice(1))
                    ]),
                    el('div', { className: 'config-row-actions' }, [
                        el('button', {
                            type: 'button',
                            className: `btn-cfg ${hasReq ? 'has-req' : ''}`,
                            onClick: () => window.openRequirementsModal('transitions', cat),
                            title: 'Configure requirements'
                        }, [icon('settings')]),
                        el('input', {
                            type: 'checkbox',
                            value: cat,
                            checked: isChecked
                        })
                    ])
                ]);
                container.appendChild(row);
            } else {
                const label = el('label', {
                    style: { display: 'flex', alignItems: 'center', gap: '8px' }
                }, [
                    el('input', {
                        type: 'checkbox',
                        value: cat,
                        checked: isChecked
                    }),
                    icon(getCategoryIcon(cat), { style: { width: '14px', height: '14px', color: 'var(--accent-primary)' } }),
                    cat.charAt(0).toUpperCase() + cat.slice(1)
                ]);
                container.appendChild(label);
            }
        });
        if (window.lucide) lucide.createIcons();
    };

    fillContainer(transGroup, 'trans-editor');
    const roomTransGroup = document.getElementById('transitions-container');
    fillContainer(roomTransGroup, 'room-editor');
}

export function openEditor(id = null) {
    state.currentEditId = id;
    state.currentContext = 'room';
    navigate('editor');

    const title = document.getElementById('editor-title');
    const idInput = document.getElementById('room-id');
    const textsContainer = document.getElementById('texts-list');
    textsContainer.innerHTML = '';

    const roomForm = document.getElementById('room-form');

    if (id) {
        const room = state.roomsData[id];
        title.innerText = `Edit: ${room.name}`;
        idInput.value = id;
        idInput.readOnly = true;

        const delBtn = document.getElementById('btn-delete-room');
        if (delBtn) delBtn.classList.remove('hidden');

        document.getElementById('room-name').value = room.name || '';
        document.getElementById('room-desc').value = room.desc || '';
        document.getElementById('room-tags').value = (room.tags || []).join(', ');

        state.editorRequirements.transitions = {};
        (room.transitions || []).forEach(t => {
            if (typeof t === 'object') state.editorRequirements.transitions[t.category] = t.requirements;
        });
        state.editorRequirements.interactables = {};
        (room.interactables || []).forEach(i => {
            if (typeof i === 'object') state.editorRequirements.interactables[i.id] = i.requirements;
        });

        const selectedCats = (room.transitions || []).map(t => typeof t === 'string' ? t : t.category);
        refreshCategorySelectors(selectedCats);
        renderInteractablesCheckboxes(room.interactables || []);

        (room.texts || []).forEach(text => addTextField(text));
        renderRoomMediaPreview();
    } else {
        title.innerText = "Define New Space";
        if (roomForm) roomForm.reset();
        idInput.value = '';
        idInput.readOnly = false;
        document.getElementById('room-images-preview').innerHTML = '';

        const delBtn = document.getElementById('btn-delete-room');
        if (delBtn) delBtn.classList.add('hidden');

        state.editorRequirements = { transitions: {}, interactables: {} };

        renderInteractablesCheckboxes([]);
        addTextField();
        refreshCategorySelectors(['universal']);
    }

    updateRoomExportArea();
}

export function getRoomDataFromForm() {
    const roomForm = document.getElementById('room-form');
    const formData = new FormData(roomForm);
    const textRows = document.querySelectorAll('#texts-list .text-config-row');
    const texts = Array.from(textRows).map(row => ({
        text: row.querySelector('.text-content').value.trim(),
        sanity_min: parseInt(row.querySelector('.text-smin').value) || 0,
        sanity_max: parseInt(row.querySelector('.text-smax').value) || 100,
        dialogue_id: row.querySelector('.text-did').value.trim() || null
    })).filter(t => t.text);

    const transitions = Array.from(document.querySelectorAll('#transitions-container input:checked')).map(cb => {
        const cat = cb.value;
        return { category: cat, requirements: state.editorRequirements.transitions[cat] || null };
    });
    const interactablesArr = Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => {
        const iid = cb.value;
        return { id: iid, requirements: state.editorRequirements.interactables[iid] || null };
    });

    return {
        name: formData.get('name'),
        desc: formData.get('desc'),
        tags: (formData.get('tags') || '').split(',').map(s => s.trim()).filter(s => s),
        transitions,
        interactables: interactablesArr,
        texts
    };
}

export function updateRoomExportArea() {
    const exportArea = document.getElementById('room-json-export');
    if (!exportArea) return;
    if (!state.currentEditId || state.currentContext !== 'room') {
        exportArea.value = '';
        return;
    }
    const data = getRoomDataFromForm();
    exportArea.value = JSON.stringify(data, null, 4);
}

export function applyRoomJSON() {
    const jsonStr = document.getElementById('room-json-import').value.trim();
    if (!jsonStr) return;
    try {
        const data = JSON.parse(jsonStr);
        if (typeof data !== 'object') throw new Error("Invalid structure");

        document.getElementById('room-name').value = data.name || '';
        document.getElementById('room-desc').value = data.desc || '';
        document.getElementById('room-tags').value = (data.tags || []).join(', ');

        state.editorRequirements.transitions = {};
        (data.transitions || []).forEach(t => {
            if (typeof t === 'object') state.editorRequirements.transitions[t.category] = t.requirements;
        });
        state.editorRequirements.interactables = {};
        (data.interactables || []).forEach(i => {
            if (typeof i === 'object') state.editorRequirements.interactables[i.id] = i.requirements;
        });

        const selectedCats = (data.transitions || []).map(t => typeof t === 'string' ? t : t.category);
        refreshCategorySelectors(selectedCats);
        renderInteractablesCheckboxes(data.interactables || []);

        const textsContainer = document.getElementById('texts-list');
        textsContainer.innerHTML = '';
        (data.texts || []).forEach(text => addTextField(text));

        showToast('JSON data applied to form. Remember to save.', 'info');
    } catch (e) {
        showToast('Invalid JSON: ' + e.message, 'error');
    }
}

export async function handleRoomSubmit(e) {
    e.preventDefault();
    const roomId = document.getElementById('room-id').value.trim();
    const roomData = getRoomDataFromForm();
    try {
        const result = await saveRoom(roomId, roomData);
        if (result.success) {
            showToast('Reality updated.', 'success');
            const syncRes = await fetchWorld();
            state.roomsData = syncRes.rooms;
            state.transitionTypes = syncRes.transition_types || {};
            state.imageIndex = syncRes.image_index || { rooms: {}, transitions: {} };
            state.allInteractables = syncRes.interactables || {};
            state.systemTaxonomy = syncRes.taxonomy || [];
            navigate('dashboard');
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast('Update failed: ' + err.message, 'error');
    }
}

export async function handleDeleteRoom() {
    if (!state.currentEditId) return;
    if (!confirm(`Are you sure you want to completely delete room "${state.currentEditId}"? This cannot be undone.`)) {
        return;
    }

    try {
        const result = await deleteRoom(state.currentEditId);
        if (result.success) {
            showToast('Room deleted from reality.', 'success');
            const syncRes = await fetchWorld();
            state.roomsData = syncRes.rooms;
            state.transitionTypes = syncRes.transition_types || {};
            state.imageIndex = syncRes.image_index || { rooms: {}, transitions: {} };
            state.allInteractables = syncRes.interactables || {};
            state.systemTaxonomy = syncRes.taxonomy || [];
            navigate('dashboard');
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast('Deletion failed: ' + err.message, 'error');
    }
}

export function addTextField(item = {}) {
    const container = document.getElementById('texts-list');
    if (!container) return;

    const rowComponent = new TextConfigRow(item);
    const rendered = rowComponent.render();

    const removeBtn = rendered.querySelector('.btn-remove');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            rendered.remove();
            updateRoomExportArea();
        });
    }

    // Capture changes to update exported JSON dynamically
    rendered.addEventListener('input', updateRoomExportArea);

    container.appendChild(rendered);
    if (window.lucide) lucide.createIcons();
    updateRoomExportArea();
}

// Attach unassignMediaItem globally for inline onclick execution
window.unassignMediaItem = async (id) => {
    if (confirm("Disconnect this image?")) {
        await assignMedia(id, 'none', 'none');
        const mData = await fetchMedia();
        state.mediaLibrary = mData;
        renderRoomMediaPreview();
    }
};
