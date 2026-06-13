// Room rendering, integrity check, and editor logic using ES6 Components
import { state } from './state.js';
import { getCategoryColor, getThumbPath, showToast, getCategoryIcon } from './ui.js';
import { fetchWorld, fetchMedia, saveRoom, assignMedia, deleteRoom } from './api.js';
import { navigate } from './router.js';
import { el, icon } from './dom.js';
import { RoomCard } from './components/RoomCard.js';
import { TextConfigRow } from './components/TextConfigRow.js';
import { getTerminalDialogueTree, setTerminalDialogueTree, createOptionCard, createEffectRow } from './terminal.js';
import { SearchBox } from './components/SearchBox.js';

let dashboardSearchBox = null;

export function renderRoomsList() {
    const searchContainer = document.getElementById('dashboard-search-container');
    if (searchContainer && !searchContainer.querySelector('.search-box-container')) {
        searchContainer.innerHTML = '';
        dashboardSearchBox = new SearchBox({
            placeholder: 'Search rooms by name, ID, desc or tags...',
            initialValue: state.dashboardSearchQuery || '',
            onSearch: (query) => {
                state.dashboardSearchQuery = query;
                filterAndRenderRooms();
            }
        });
        searchContainer.appendChild(dashboardSearchBox.render());
    }

    filterAndRenderRooms();
}

export function filterAndRenderRooms() {
    const list = document.getElementById('rooms-list');
    if (!list) return;
    list.innerHTML = '';
    if (Object.keys(state.roomsData).length === 0) {
        list.appendChild(el('div', { className: 'empty' }, 'No active zones detected. Initiate new sequence.'));
        return;
    }

    const query = (state.dashboardSearchQuery || '').toLowerCase().trim();

    const filteredRooms = Object.entries(state.roomsData).filter(([id, room]) => {
        if (!query) return true;
        const matchesId = id.toLowerCase().includes(query);
        const matchesName = (room.name || '').toLowerCase().includes(query);
        const matchesDesc = (room.desc || '').toLowerCase().includes(query);
        const matchesTags = (room.tags || []).some(tag => tag.toLowerCase().includes(query));
        return matchesId || matchesName || matchesDesc || matchesTags;
    });

    if (filteredRooms.length === 0) {
        list.appendChild(el('div', { className: 'empty' }, 'No matching spaces found.'));
        return;
    }

    filteredRooms.forEach(([id, room]) => {
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
        let currentSelected = selectedValues || Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);

        // Auto-check any category that has a configured click area to ensure it saves!
        if (groupName === 'room-editor' && state.editorRequirements?.clickAreas) {
            Object.keys(state.editorRequirements.clickAreas).forEach(cat => {
                if (state.editorRequirements.clickAreas[cat] && !currentSelected.includes(cat)) {
                    currentSelected.push(cat);
                }
            });
        }

        container.innerHTML = '';

        const catsToRender = new Set(categories);
        if (groupName === 'room-editor') {
            catsToRender.add('default');
        }

        Array.from(catsToRender).sort((a, b) => {
            if (a === 'universal') return -1;
            if (b === 'universal') return 1;
            if (a === 'default') return 1;
            if (b === 'default') return -1;
            return a.localeCompare(b);
        }).forEach(cat => {
            if (!cat) return;
            const isChecked = currentSelected.includes(cat);
            const hasReq = !!state.editorRequirements.transitions[cat];

            if (groupName === 'room-editor') {
                const hasArea = !!state.editorRequirements.clickAreas?.[cat];
                const row = el('div', { className: 'config-row' }, [
                    el('div', { className: 'cat-info-row' }, [
                        icon(getCategoryIcon(cat), { style: { width: '16px', height: '16px', color: 'var(--accent-primary)' } }),
                        el('span', { 
                            className: 'cat-label'
                        }, cat === 'universal' ? 'Universal' : (cat === 'default' ? 'Default transit area' : cat.charAt(0).toUpperCase() + cat.slice(1)))
                    ]),
                    el('div', { className: 'config-row-actions' }, [
                        el('button', {
                            type: 'button',
                            className: `btn-cfg btn-area ${hasArea ? 'has-area' : ''}`,
                            onClick: () => window.openClickAreaModal(cat),
                            title: 'Configure click area',
                            style: { marginRight: '6px' }
                        }, [icon('maximize')]),
                        cat !== 'default' ? el('button', {
                            type: 'button',
                            className: `btn-cfg ${hasReq ? 'has-req' : ''}`,
                            onClick: () => window.openRequirementsModal('transitions', cat),
                            title: 'Configure requirements',
                            style: { marginRight: '6px' }
                        }, [icon('settings')]) : null,
                        el('input', {
                            type: 'checkbox',
                            value: cat,
                            checked: isChecked
                        })
                    ].filter(Boolean))
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

    // Reset active tab to General
    const firstTabBtn = document.querySelector('[data-room-tab="room-tab-general"]');
    if (firstTabBtn) {
        document.querySelectorAll('[data-room-tab]').forEach(b => b.classList.remove('active'));
        firstTabBtn.classList.add('active');
        document.querySelectorAll('.room-tab-content').forEach(p => p.classList.add('hidden'));
        const targetPanel = document.getElementById('room-tab-general');
        if (targetPanel) targetPanel.classList.remove('hidden');
    }

    // Initialize terminal listeners
    setupRoomTerminalListeners();

    // Fetch terminal dialogues if they are empty
    const tree = getTerminalDialogueTree();
    if (!tree || Object.keys(tree).length === 0) {
        fetch('api.php?action=get_terminal_dialogue')
            .then(res => res.json())
            .then(dialogues => {
                setTerminalDialogueTree(dialogues);
                populateTerminalSection(id);
            });
    } else {
        populateTerminalSection(id);
    }

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
        state.editorRequirements.clickAreas = {};
        (room.transitions || []).forEach(t => {
            if (typeof t === 'object') {
                state.editorRequirements.transitions[t.category] = t.requirements;
                state.editorRequirements.clickAreas[t.category] = t.area || null;
            }
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

        state.editorRequirements = { transitions: {}, interactables: {}, clickAreas: {} };

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
        return {
            category: cat,
            requirements: state.editorRequirements.transitions[cat] || null,
            area: state.editorRequirements.clickAreas?.[cat] || null
        };
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
        state.editorRequirements.clickAreas = {};
        (data.transitions || []).forEach(t => {
            if (typeof t === 'object') {
                state.editorRequirements.transitions[t.category] = t.requirements;
                state.editorRequirements.clickAreas[t.category] = t.area || null;
            }
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
        // If coming from a draft temp ID, migrate any media assignments to the real ID
        if (state.currentEditId && state.currentEditId.startsWith('draft_') && state.currentEditId !== roomId) {
            const draftMedia = state.mediaLibrary.filter(
                m => m.context_type === 'room' && m.context_id === state.currentEditId
            );
            for (const m of draftMedia) {
                await assignMedia(m.id, 'room', roomId);
            }
            if (draftMedia.length > 0) {
                const mData = await fetchMedia();
                state.mediaLibrary = mData;
            }
        }

        const result = await saveRoom(roomId, roomData);
        if (result.success) {
            // Save terminal dialogue tree if needed
            const tree = getTerminalDialogueTree();
            const nodeKey = "ROOM_" + roomId.toUpperCase();
            const enabled = document.getElementById('room-terminal-enabled').checked;
            
            // Handle renaming / cleanup
            if (state.currentEditId && state.currentEditId !== roomId) {
                const oldNodeKey = "ROOM_" + state.currentEditId.toUpperCase();
                delete tree[oldNodeKey];
            }
            
            if (enabled) {
                const terminalData = getRoomTerminalDialogueData();
                if (terminalData) {
                    tree[nodeKey] = terminalData;
                }
            } else {
                delete tree[nodeKey];
            }
            
            await fetch('api.php?action=save_terminal_dialogue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dialogue: tree })
            });

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
            // Cleanup terminal dialogue
            const tree = getTerminalDialogueTree();
            const nodeKey = "ROOM_" + state.currentEditId.toUpperCase();
            if (tree[nodeKey]) {
                delete tree[nodeKey];
                await fetch('api.php?action=save_terminal_dialogue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dialogue: tree })
                });
            }

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

let terminalListenersAttached = false;
export function setupRoomTerminalListeners() {
    if (terminalListenersAttached) return;
    terminalListenersAttached = true;

    const checkbox = document.getElementById('room-terminal-enabled');
    const configDiv = document.getElementById('room-terminal-config');
    const addOptBtn = document.getElementById('btn-add-room-terminal-option');
    const optionsList = document.getElementById('room-terminal-options-list');

    if (checkbox && configDiv) {
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                configDiv.classList.remove('hidden');
            } else {
                configDiv.classList.add('hidden');
            }
            updateRoomExportArea();
        });
    }

    if (addOptBtn && optionsList) {
        addOptBtn.addEventListener('click', () => {
            const newIndex = optionsList.children.length;
            const newOpt = { label: 'NEW OPTION', next: '' };
            const tree = getTerminalDialogueTree();
            const card = createOptionCard(newOpt, newIndex, tree);
            optionsList.appendChild(card);
            
            // Listen for input to update JSON area
            card.addEventListener('input', updateRoomExportArea);
            if (window.lucide) window.lucide.createIcons();
            updateRoomExportArea();
        });
    }

    const termText = document.getElementById('room-terminal-text');
    if (termText) {
        termText.addEventListener('input', updateRoomExportArea);
    }
}

export function populateTerminalSection(id) {
    const checkbox = document.getElementById('room-terminal-enabled');
    const configDiv = document.getElementById('room-terminal-config');
    const textInput = document.getElementById('room-terminal-text');
    const optionsList = document.getElementById('room-terminal-options-list');
    
    if (!checkbox || !configDiv || !textInput || !optionsList) return;
    
    optionsList.innerHTML = '';
    
    if (id) {
        const nodeKey = "ROOM_" + id.toUpperCase();
        const tree = getTerminalDialogueTree();
        const node = tree[nodeKey];
        
        if (node) {
            checkbox.checked = true;
            configDiv.classList.remove('hidden');
            textInput.value = node.text || '';
            
            const options = node.options || [];
            options.forEach((opt, index) => {
                const card = createOptionCard(opt, index, tree);
                optionsList.appendChild(card);
                card.addEventListener('input', updateRoomExportArea);
            });
        } else {
            checkbox.checked = false;
            configDiv.classList.add('hidden');
            textInput.value = '';
        }
    } else {
        checkbox.checked = false;
        configDiv.classList.add('hidden');
        textInput.value = '';
    }
    
    if (window.lucide) window.lucide.createIcons();
    updateRoomExportArea();
}

export function getRoomTerminalDialogueData() {
    const enabled = document.getElementById('room-terminal-enabled').checked;
    if (!enabled) return null;
    
    const nodeText = document.getElementById('room-terminal-text').value;
    const optionCards = document.querySelectorAll('#room-terminal-options-list .terminal-option-card');
    const options = [];
    
    optionCards.forEach(card => {
        const label = card.querySelector('.opt-label-input').value.trim();
        
        let next = '';
        const nextSelect = card.querySelector('.opt-next-select');
        if (nextSelect.value === '_custom_') {
            next = card.querySelector('.opt-next-custom').value.trim();
        } else {
            next = nextSelect.value;
        }
        
        const opt = { label, next };
        
        // Requirements
        const requirements = {};
        
        const sMin = card.querySelector('.opt-req-sanity-min').value;
        if (sMin !== '') requirements.sanity_min = parseInt(sMin);
        
        const sMax = card.querySelector('.opt-req-sanity-max').value;
        if (sMax !== '') requirements.sanity_max = parseInt(sMax);
        
        const itemVal = card.querySelector('.opt-req-item-id').value;
        if (itemVal === 'custom') {
            const customItem = card.querySelector('.opt-req-item-custom').value.trim();
            if (customItem) {
                requirements.has_item = customItem;
            }
        } else if (itemVal) {
            requirements.has_item = itemVal;
        }
        
        const itemCount = card.querySelector('.opt-req-item-count').value;
        if (itemCount !== '') requirements.item_count = parseInt(itemCount);
        
        const interId = card.querySelector('.opt-req-inter-id').value;
        if (interId) {
            requirements.interactable_id = interId;
            const interState = card.querySelector('.opt-req-inter-state').value;
            if (interState !== '') {
                requirements.state_id = parseInt(interState);
            }
        }
        
        if (Object.keys(requirements).length > 0) {
            opt.requirements = requirements;
        }
        
        // Effects
        const effects = [];
        const effRows = card.querySelectorAll('.effect-config-row');
        effRows.forEach(row => {
            const type = row.querySelector('.eff-type-select').value;
            const eff = { type };
            
            if (type === 'sfx') {
                eff.value = row.querySelector('.eff-sfx-val').value;
            }
            else if (type === 'sanity') {
                eff.value = parseInt(row.querySelector('.eff-sanity-val').value) || 0;
            }
            else if (type === 'item') {
                eff.item = row.querySelector('.eff-item-id').value.trim();
                eff.amount = parseInt(row.querySelector('.eff-item-amt').value) || 1;
            }
            else if (type === 'act') {
                eff.id = row.querySelector('.eff-inter-id').value;
                eff.state = parseInt(row.querySelector('.eff-inter-state').value) || 1;
            }
            else if (type === 'move') {
                eff.room = row.querySelector('.eff-room-id').value;
            }
            
            effects.push(eff);
        });
        
        if (effects.length > 0) {
            opt.effects = effects;
        }
        
        options.push(opt);
    });
    
    return {
        text: nodeText,
        options: options
    };
}

let isDrawing = false;
let startX = 0;
let startY = 0;
let currentRect = { x: 0, y: 0, w: 0, h: 0 };
let drawingListenersBound = false;

function setupClickAreaDrawing() {
    if (drawingListenersBound) return;
    
    const overlay = document.getElementById('click-area-drawing-overlay');
    const selectionBox = document.getElementById('click-area-selection-box');
    const coordDisplay = document.getElementById('click-area-box-coords');
    
    if (!overlay || !selectionBox || !coordDisplay) return;
    
    const inputLeft = document.getElementById('click-area-left');
    const inputTop = document.getElementById('click-area-top');
    const inputWidth = document.getElementById('click-area-width');
    const inputHeight = document.getElementById('click-area-height');
    
    function getMousePos(e) {
        const rect = overlay.getBoundingClientRect();
        const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
        const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
        return {
            x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
            y: Math.max(0, Math.min(rect.height, clientY - rect.top))
        };
    }
    
    function updateSelectionBoxDOM() {
        selectionBox.style.left = currentRect.x + 'px';
        selectionBox.style.top = currentRect.y + 'px';
        selectionBox.style.width = currentRect.w + 'px';
        selectionBox.style.height = currentRect.h + 'px';
        selectionBox.style.display = 'block';
        
        const overlayWidth = overlay.offsetWidth || 1;
        const overlayHeight = overlay.offsetHeight || 1;
        const leftPct = ((currentRect.x / overlayWidth) * 100).toFixed(0);
        const topPct = ((currentRect.y / overlayHeight) * 100).toFixed(0);
        const widthPct = ((currentRect.w / overlayWidth) * 100).toFixed(0);
        const heightPct = ((currentRect.h / overlayHeight) * 100).toFixed(0);
        coordDisplay.textContent = `${leftPct}%,${topPct}% (${widthPct}%x${heightPct}%)`;
    }
    
    function startDrawing(e) {
        if (e.target !== overlay && e.target !== selectionBox) return;
        
        isDrawing = true;
        const pos = getMousePos(e);
        startX = pos.x;
        startY = pos.y;
        
        currentRect = { x: startX, y: startY, w: 0, h: 0 };
        updateSelectionBoxDOM();
        
        document.addEventListener('mousemove', draw);
        document.addEventListener('mouseup', stopDrawing);
        document.addEventListener('touchmove', draw, { passive: false });
        document.addEventListener('touchend', stopDrawing);
    }
    
    function draw(e) {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();
        
        const pos = getMousePos(e);
        
        const x = Math.min(startX, pos.x);
        const y = Math.min(startY, pos.y);
        const w = Math.abs(startX - pos.x);
        const h = Math.abs(startY - pos.y);
        
        currentRect = { x, y, w, h };
        updateSelectionBoxDOM();
    }
    
    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        
        document.removeEventListener('mousemove', draw);
        document.removeEventListener('mouseup', stopDrawing);
        document.removeEventListener('touchmove', draw);
        document.removeEventListener('touchend', stopDrawing);
        
        const overlayWidth = overlay.offsetWidth;
        const overlayHeight = overlay.offsetHeight;
        if (overlayWidth > 0 && overlayHeight > 0) {
            inputLeft.value = ((currentRect.x / overlayWidth) * 100).toFixed(1);
            inputTop.value = ((currentRect.y / overlayHeight) * 100).toFixed(1);
            inputWidth.value = ((currentRect.w / overlayWidth) * 100).toFixed(1);
            inputHeight.value = ((currentRect.h / overlayHeight) * 100).toFixed(1);
            
            updateRoomExportArea();
        }
    }
    
    overlay.addEventListener('mousedown', startDrawing);
    overlay.addEventListener('touchstart', startDrawing, { passive: true });
    
    [inputLeft, inputTop, inputWidth, inputHeight].forEach(input => {
        input.addEventListener('input', () => {
            const overlayWidth = overlay.offsetWidth;
            const overlayHeight = overlay.offsetHeight;
            if (overlayWidth > 0 && overlayHeight > 0) {
                const x = (parseFloat(inputLeft.value) || 0) / 100 * overlayWidth;
                const y = (parseFloat(inputTop.value) || 0) / 100 * overlayHeight;
                const w = (parseFloat(inputWidth.value) || 0) / 100 * overlayWidth;
                const h = (parseFloat(inputHeight.value) || 0) / 100 * overlayHeight;
                currentRect = { x, y, w, h };
                updateSelectionBoxDOM();
                updateRoomExportArea();
            }
        });
    });
    
    document.getElementById('btn-close-click-area-modal').addEventListener('click', () => {
        document.getElementById('click-area-modal').classList.add('hidden');
    });
    
    document.getElementById('btn-clear-click-area').addEventListener('click', () => {
        if (!state.currentClickAreaCategory) return;
        delete state.editorRequirements.clickAreas[state.currentClickAreaCategory];
        document.getElementById('click-area-modal').classList.add('hidden');
        showToast('Click area cleared.', 'info');
        refreshCategorySelectors();
        updateRoomExportArea();
    });
    
    document.getElementById('btn-save-click-area').addEventListener('click', () => {
        if (!state.currentClickAreaCategory) return;
        
        const left = parseFloat(inputLeft.value);
        const top = parseFloat(inputTop.value);
        const width = parseFloat(inputWidth.value);
        const height = parseFloat(inputHeight.value);
        
        if (isNaN(left) || isNaN(top) || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
            showToast('Please draw a valid area or fill the dimensions.', 'warning');
            return;
        }
        
        state.editorRequirements.clickAreas[state.currentClickAreaCategory] = {
            shapes: [
                {
                    type: 'rect',
                    coords: {
                        x: left,
                        y: top,
                        width: width,
                        height: height
                    }
                }
            ]
        };
        
        document.getElementById('click-area-modal').classList.add('hidden');
        showToast('Click area defined.', 'success');
        refreshCategorySelectors();
        updateRoomExportArea();
    });
    
    drawingListenersBound = true;
}

window.openClickAreaModal = (category) => {
    const roomId = state.currentEditId;
    if (!roomId) {
        showToast('Please save the room first.', 'error');
        return;
    }
    
    const roomMedia = state.mediaLibrary.filter(
        m => m.context_type === 'room' && m.context_id === roomId
    );
    
    if (roomMedia.length === 0) {
        showToast('Please assign an image to this room first in the Graphics tab.', 'warning');
        return;
    }
    
    const modal = document.getElementById('click-area-modal');
    const title = document.getElementById('click-area-modal-title');
    const img = document.getElementById('click-area-target-img');
    const overlay = document.getElementById('click-area-drawing-overlay');
    const selectionBox = document.getElementById('click-area-selection-box');
    
    title.innerText = `Configure Click Area: ${category.toUpperCase()}`;
    state.currentClickAreaCategory = category;
    
    img.src = `../${roomMedia[0].filepath}`;
    
    selectionBox.style.display = 'none';
    document.getElementById('click-area-left').value = '';
    document.getElementById('click-area-top').value = '';
    document.getElementById('click-area-width').value = '';
    document.getElementById('click-area-height').value = '';
    
    modal.classList.remove('hidden');
    setupClickAreaDrawing();
    
    img.onload = () => {
        overlay.style.width = img.offsetWidth + 'px';
        overlay.style.height = img.offsetHeight + 'px';
        overlay.style.left = img.offsetLeft + 'px';
        overlay.style.top = img.offsetTop + 'px';
        
        const existingArea = state.editorRequirements.clickAreas?.[category];
        if (existingArea) {
            let coords = null;
            if (existingArea.shapes && existingArea.shapes[0]) {
                coords = existingArea.shapes[0].coords;
            } else if (existingArea.coords) {
                coords = existingArea.coords;
            }
            
            if (coords) {
                const left = parseFloat(coords.x !== undefined ? coords.x : coords.left);
                const top = parseFloat(coords.y !== undefined ? coords.y : coords.top);
                const width = parseFloat(coords.width !== undefined ? coords.width : coords.w);
                const height = parseFloat(coords.height !== undefined ? coords.height : coords.h);
                
                document.getElementById('click-area-left').value = left;
                document.getElementById('click-area-top').value = top;
                document.getElementById('click-area-width').value = width;
                document.getElementById('click-area-height').value = height;
                
                const ow = overlay.offsetWidth;
                const oh = overlay.offsetHeight;
                
                selectionBox.style.left = ((left / 100) * ow) + 'px';
                selectionBox.style.top = ((top / 100) * oh) + 'px';
                selectionBox.style.width = ((width / 100) * ow) + 'px';
                selectionBox.style.height = ((height / 100) * oh) + 'px';
                selectionBox.style.display = 'block';
                
                document.getElementById('click-area-box-coords').textContent = `${left.toFixed(0)}%,${top.toFixed(0)}% (${width.toFixed(0)}%x${height.toFixed(0)}%)`;
            }
        }
    };
};

window.addEventListener('resize', () => {
    const modal = document.getElementById('click-area-modal');
    if (modal && !modal.classList.contains('hidden')) {
        const img = document.getElementById('click-area-target-img');
        const overlay = document.getElementById('click-area-drawing-overlay');
        const selectionBox = document.getElementById('click-area-selection-box');
        
        if (img && overlay && img.offsetWidth > 0) {
            overlay.style.width = img.offsetWidth + 'px';
            overlay.style.height = img.offsetHeight + 'px';
            overlay.style.left = img.offsetLeft + 'px';
            overlay.style.top = img.offsetTop + 'px';
            
            const leftVal = parseFloat(document.getElementById('click-area-left').value);
            const topVal = parseFloat(document.getElementById('click-area-top').value);
            const wVal = parseFloat(document.getElementById('click-area-width').value);
            const hVal = parseFloat(document.getElementById('click-area-height').value);
            
            if (!isNaN(leftVal) && !isNaN(topVal) && !isNaN(wVal) && !isNaN(hVal)) {
                selectionBox.style.left = ((leftVal / 100) * img.offsetWidth) + 'px';
                selectionBox.style.top = ((topVal / 100) * img.offsetHeight) + 'px';
                selectionBox.style.width = ((wVal / 100) * img.offsetWidth) + 'px';
                selectionBox.style.height = ((hVal / 100) * img.offsetHeight) + 'px';
            }
        }
    }
});
