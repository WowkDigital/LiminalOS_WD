// Room rendering, integrity check, and editor logic
import { state } from './state.js';
import { getCategoryColor, getThumbPath, showToast } from './ui.js';
import { fetchWorld, fetchMedia, saveRoom, assignMedia } from './api.js';
import { navigate } from './router.js';

export function renderRoomsList() {
    const list = document.getElementById('rooms-list');
    if (!list) return;
    list.innerHTML = '';
    if (Object.keys(state.roomsData).length === 0) {
        list.innerHTML = '<div class="empty">No active zones detected. Initiate new sequence.</div>';
        return;
    }

    Object.entries(state.roomsData).forEach(([id, room]) => {
        const card = document.createElement('div');
        card.className = 'room-card';

        // Reachability logic
        const hasExits = (room.transitions || []).some(t => {
            const cat = typeof t === 'string' ? t : t.category;
            return state.transitionTypes[cat] && state.transitionTypes[cat].length > 0;
        });
        const canExit = hasExits && Object.keys(state.roomsData).length > 1;

        const canEnter = Object.entries(state.roomsData).some(([otherId, otherRoom]) => {
            if (otherId === id) return false;
            return (otherRoom.transitions || []).some(t => {
                const cat = typeof t === 'string' ? t : t.category;
                return state.transitionTypes[cat] && state.transitionTypes[cat].length > 0;
            });
        });

        const tagsHtml = (room.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');

        const roomImages = state.imageIndex.rooms[id] || [];
        const thumbUrl = roomImages.length > 0 ? `../${getThumbPath(roomImages[0])}` : null;
        const thumbHtml = thumbUrl ? `<div class="room-card-thumb"><img src="${thumbUrl}" alt=""></div>` : '<div class="room-card-thumb empty-thumb"><span>NO SIGNAL</span></div>';

        card.innerHTML = `
            ${thumbHtml}
            <div class="room-card-content">
                <div class="room-card-header">
                    <h3>${room.name} <span class="small-dim">${id}</span></h3>
                    <div class="reachability-indicators">
                        <span class="reach-icon ${canEnter ? 'active' : 'inactive'}" title="${canEnter ? 'Reachable' : 'Unreachable'}">
                            <i data-lucide="log-in"></i>
                        </span>
                        <span class="reach-icon ${canExit ? 'active' : 'inactive'}" title="${canExit ? 'Has Exits' : 'Dead End'}">
                            <i data-lucide="log-out"></i>
                        </span>
                    </div>
                </div>
                <p>${room.desc || 'No descriptions found.'}</p>
                <div class="room-stats">
                    <span>☍ ${(room.transitions || []).length}</span>
                    <span>◉ ${(room.interactables || []).length}</span>
                    <span>≡ ${(room.texts || []).length}</span>
                </div>
                <div class="room-meta">${tagsHtml}</div>
            </div>
        `;
        card.onclick = () => openEditor(id);
        list.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }

    checkWorldIntegrity();
}

export function checkWorldIntegrity() {
    const container = document.getElementById('world-integrity-status');
    if (!container) return;

    const rooms = Object.entries(state.roomsData);
    if (rooms.length === 0) {
        container.innerHTML = '';
        return;
    }

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

    let statusHtml = '';
    if (deadEnds.length === 0 && orphans.length === 0 && state.roomsData[startRoomId]) {
        statusHtml = `
            <div class="integrity-badge valid">
                <i data-lucide="check-circle"></i> Graph Connected
            </div>
            <div class="integrity-message">All nodes reachable via liminal paths.</div>
        `;
    } else {
        const isError = orphans.length > 0 || !state.roomsData[startRoomId];
        const badgeClass = isError ? 'error' : 'warning';
        const icon = isError ? 'alert-octagon' : 'alert-triangle';
        const label = isError ? 'Graph Fragmented' : 'World Instability';

        statusHtml = `
            <div class="integrity-badge ${badgeClass}">
                <i data-lucide="${icon}"></i> ${label}
            </div>
        `;

        if (!state.roomsData[startRoomId]) statusHtml += `<div class="integrity-message"><i data-lucide="x"></i> Missing 'lobby' sequence.</div>`;
        if (orphans.length > 0) statusHtml += `<div class="integrity-message"><i data-lucide="x"></i> ${orphans.length} unreachable zones.</div>`;
        if (deadEnds.length > 0) statusHtml += `<div class="integrity-message"><i data-lucide="alert-circle"></i> ${deadEnds.length} dead ends detected.</div>`;
    }

    container.innerHTML = statusHtml;
    if (window.lucide) lucide.createIcons();
}

export function renderRoomMediaPreview() {
    const container = document.getElementById('room-images-preview');
    if (!container) return;
    container.innerHTML = '';
    const roomMedia = state.mediaLibrary.filter(m => m.context_type === 'room' && m.context_id === state.currentEditId);
    roomMedia.forEach(m => {
        const thumb = document.createElement('div');
        thumb.className = 'preview-thumb';
        thumb.innerHTML = `
            <img src="../${getThumbPath(m.filepath)}">
            <div class="remove-overlay" onclick="event.stopPropagation(); window.unassignMediaItem(${m.id})">&times;</div>
        `;
        container.appendChild(thumb);
    });
    if (roomMedia.length === 0) container.innerHTML = '<div class="small-dim">No images assigned.</div>';
}

export function renderInteractablesCheckboxes(selectedItems) {
    const container = document.getElementById('interactables-checkbox-group');
    if (!container) return;
    container.innerHTML = '';
    if (Object.keys(state.allInteractables).length === 0) {
        container.innerHTML = '<small>No interactables defined in system.</small>';
        return;
    }

    const selectedIds = selectedItems.map(i => typeof i === 'string' ? i : i.id);

    Object.entries(state.allInteractables).forEach(([id, data]) => {
        const row = document.createElement('div');
        row.className = 'config-row';
        const isChecked = selectedIds.includes(id);
        const hasReq = !!state.editorRequirements.interactables[id];

        row.innerHTML = `
            <div class="inter-info">
                <span class="inter-label">${data.label || id}</span>
                <span class="inter-id">${id}</span>
            </div>
            <div class="config-row-actions">
                <button type="button" class="btn-cfg ${hasReq ? 'has-req' : ''}" onclick="window.openRequirementsModal('interactables', '${id}')" title="Configure requirements">
                    <i data-lucide="settings"></i>
                </button>
                <input type="checkbox" value="${id}" ${isChecked ? 'checked' : ''}>
            </div>
        `;
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
            const row = document.createElement('div');
            row.className = 'config-row';
            const isChecked = currentSelected.includes(cat);
            const hasReq = !!state.editorRequirements.transitions[cat];

            if (groupName === 'room-editor') {
                const catColor = getCategoryColor(cat);
                row.innerHTML = `
                    <div class="cat-info">
                        <span class="cat-label" style="color: ${catColor}">${cat === 'universal' ? 'Universal' : cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                        <span class="cat-id">category</span>
                    </div>
                    <div class="config-row-actions">
                        <button type="button" class="btn-cfg ${hasReq ? 'has-req' : ''}" onclick="window.openRequirementsModal('transitions', '${cat}')" title="Configure requirements">
                            <i data-lucide="settings"></i>
                        </button>
                        <input type="checkbox" value="${cat}" ${isChecked ? 'checked' : ''}>
                    </div>
                `;
            } else {
                const catColor = getCategoryColor(cat);
                const label = document.createElement('label');
                label.style.display = 'flex'; label.style.alignItems = 'center'; label.style.gap = '8px';
                label.style.color = catColor;
                label.innerHTML = `<input type="checkbox" value="${cat}" ${isChecked ? 'checked' : ''}> ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
                container.appendChild(label);
                return;
            }
            container.appendChild(row);
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
    if (!state.currentEditId || state.currentContext !== 'room') {
        document.getElementById('room-json-export').value = '';
        return;
    }
    const data = getRoomDataFromForm();
    document.getElementById('room-json-export').value = JSON.stringify(data, null, 4);
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
            // We need to re-fetch the world state
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

export function addTextField(item = {}) {
    const container = document.getElementById('texts-list');
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
// Attach unassignMediaItem globally for inline onclick execution
window.unassignMediaItem = async (id) => {
    if (confirm("Disconnect this image?")) {
        await assignMedia(id, 'none', 'none');
        const mData = await fetchMedia();
        state.mediaLibrary = mData;
        renderRoomMediaPreview();
    }
};
