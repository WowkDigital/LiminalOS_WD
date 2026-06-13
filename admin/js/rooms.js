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
            (roomId) => navigate(`editor?id=${encodeURIComponent(roomId)}`)
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

    let selectedIds = selectedItems.map(i => typeof i === 'string' ? i : i.id);

    // Auto-check any interactable that has a configured click area to ensure it saves!
    if (state.editorRequirements?.interactableClickAreas) {
        Object.keys(state.editorRequirements.interactableClickAreas).forEach(id => {
            if (state.editorRequirements.interactableClickAreas[id] && !selectedIds.includes(id)) {
                selectedIds.push(id);
            }
        });
    }

    Object.entries(state.allInteractables).forEach(([id, data]) => {
        const isChecked = selectedIds.includes(id);
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
                el('input', {
                    type: 'checkbox',
                    value: id,
                    checked: isChecked,
                    onChange: () => updateRoomExportArea()
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
                            checked: isChecked,
                            onChange: () => updateRoomExportArea()
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
    const targetHash = id ? `editor?id=${encodeURIComponent(id)}` : 'editor';
    if (window.location.hash !== '#' + targetHash) {
        navigate(targetHash);
    }

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
        state.editorRequirements.interactableClickAreas = {};
        (room.transitions || []).forEach(t => {
            if (typeof t === 'object') {
                state.editorRequirements.transitions[t.category] = t.requirements;
                state.editorRequirements.clickAreas[t.category] = t.area || null;
            }
        });
        state.editorRequirements.interactables = {};
        (room.interactables || []).forEach(i => {
            if (typeof i === 'object' && i !== null) {
                state.editorRequirements.interactables[i.id] = i.requirements;
                state.editorRequirements.interactableClickAreas[i.id] = i.area || null;
            } else if (typeof i === 'string') {
                state.editorRequirements.interactables[i] = null;
                state.editorRequirements.interactableClickAreas[i] = null;
            }
        });

        const selectedCats = (room.transitions || []).map(t => typeof t === 'string' ? t : t.category);
        refreshCategorySelectors(selectedCats);
        renderInteractablesCheckboxes(room.interactables || []);

        (room.texts || []).forEach(text => addTextField(text));
        renderRoomMediaPreview();

        state.editorScenes = JSON.parse(JSON.stringify(room.scenes || []));
        if (state.editorScenes.length === 0) {
            // Generate a default scene from legacy data
            const roomMedia = state.mediaLibrary.filter(
                m => m.context_type === 'room' && m.context_id === id
            );
            const defaultBg = roomMedia.length > 0 ? roomMedia[0].filepath : null;
            
            const legacyHotspots = [];
            (room.transitions || []).forEach(t => {
                const cat = typeof t === 'string' ? t : t.category;
                const req = typeof t === 'object' ? t.requirements : null;
                const area = typeof t === 'object' ? t.area : null;
                legacyHotspots.push({
                    type: 'tra',
                    target_id: cat,
                    label: cat.toUpperCase(),
                    area,
                    requirements: req
                });
            });
            
            (room.interactables || []).forEach(i => {
                const iid = typeof i === 'object' ? i.id : i;
                const req = typeof i === 'object' ? i.requirements : null;
                const area = typeof i === 'object' ? i.area : null;
                legacyHotspots.push({
                    type: 'act',
                    target_id: iid,
                    label: iid.toUpperCase(),
                    area,
                    requirements: req
                });
            });

            state.editorScenes.push({
                id: `${id}_default`,
                is_default: true,
                bg_image: defaultBg,
                interactable_desc: null,
                dialogue_id: null,
                requirements: null,
                hotspots: legacyHotspots,
                terminal_commands: []
            });
        }
        state.selectedSceneId = state.editorScenes[0]?.id || null;
    } else {
        title.innerText = "Define New Space";
        if (roomForm) roomForm.reset();
        idInput.value = '';
        idInput.readOnly = false;
        document.getElementById('room-images-preview').innerHTML = '';

        const delBtn = document.getElementById('btn-delete-room');
        if (delBtn) delBtn.classList.add('hidden');

        state.editorRequirements = { transitions: {}, interactables: {}, clickAreas: {}, interactableClickAreas: {} };

        renderInteractablesCheckboxes([]);
        addTextField();
        refreshCategorySelectors(['universal']);

        state.editorScenes = [{
            id: 'new_room_default',
            is_default: true,
            bg_image: null,
            interactable_desc: null,
            dialogue_id: null,
            requirements: null,
            hotspots: [],
            terminal_commands: []
        }];
        state.selectedSceneId = 'new_room_default';
    }

    const addSceneBtn = document.getElementById('btn-add-scene');
    if (addSceneBtn) {
        addSceneBtn.onclick = () => {
            const newId = `scene_${Date.now()}`;
            state.editorScenes = state.editorScenes || [];
            const newScene = {
                id: newId,
                is_default: state.editorScenes.length === 0,
                bg_image: null,
                interactable_desc: null,
                dialogue_id: null,
                requirements: null,
                hotspots: [],
                terminal_commands: []
            };
            state.editorScenes.push(newScene);
            state.selectedSceneId = newId;
            renderScenesSection();
            renderActiveSceneEditor();
            updateRoomExportArea();
        };
    }

    renderScenesSection();
    renderActiveSceneEditor();
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
        return { 
            id: iid, 
            requirements: state.editorRequirements.interactables[iid] || null,
            area: state.editorRequirements.interactableClickAreas?.[iid] || null
        };
    });

    return {
        name: formData.get('name'),
        desc: formData.get('desc'),
        tags: (formData.get('tags') || '').split(',').map(s => s.trim()).filter(s => s),
        transitions,
        interactables: interactablesArr,
        texts,
        scenes: state.editorScenes || []
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
        state.editorRequirements.interactableClickAreas = {};
        (data.interactables || []).forEach(i => {
            if (typeof i === 'object' && i !== null) {
                state.editorRequirements.interactables[i.id] = i.requirements;
                state.editorRequirements.interactableClickAreas[i.id] = i.area || null;
            } else if (typeof i === 'string') {
                state.editorRequirements.interactables[i] = null;
                state.editorRequirements.interactableClickAreas[i] = null;
            }
        });

        const selectedCats = (data.transitions || []).map(t => typeof t === 'string' ? t : t.category);
        refreshCategorySelectors(selectedCats);
        renderInteractablesCheckboxes(data.interactables || []);

        const textsContainer = document.getElementById('texts-list');
        textsContainer.innerHTML = '';
        (data.texts || []).forEach(text => addTextField(text));

        state.editorScenes = data.scenes || [];
        state.selectedSceneId = state.editorScenes[0]?.id || null;
        renderScenesSection();
        renderActiveSceneEditor();

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
        if (window.onSaveSceneClickArea) {
            window.onSaveSceneClickArea(null);
            window.onSaveSceneClickArea = null;
            document.getElementById('click-area-modal').classList.add('hidden');
            showToast('Hotspot click area cleared.', 'info');
            return;
        }
        if (!state.currentClickAreaCategory) return;
        
        if (state.currentClickAreaType === 'interactable') {
            delete state.editorRequirements.interactableClickAreas[state.currentClickAreaCategory];
            showToast('Interactable click area cleared.', 'info');
            const currentSelected = Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => cb.value);
            renderInteractablesCheckboxes(currentSelected);
        } else {
            delete state.editorRequirements.clickAreas[state.currentClickAreaCategory];
            showToast('Click area cleared.', 'info');
            refreshCategorySelectors();
        }
        
        document.getElementById('click-area-modal').classList.add('hidden');
        updateRoomExportArea();
    });
    
    document.getElementById('btn-save-click-area').addEventListener('click', () => {
        const left = parseFloat(inputLeft.value);
        const top = parseFloat(inputTop.value);
        const width = parseFloat(inputWidth.value);
        const height = parseFloat(inputHeight.value);
        
        if (isNaN(left) || isNaN(top) || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
            showToast('Please draw a valid area or fill the dimensions.', 'warning');
            return;
        }
        
        const areaObj = {
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

        if (window.onSaveSceneClickArea) {
            window.onSaveSceneClickArea(areaObj);
            window.onSaveSceneClickArea = null;
            document.getElementById('click-area-modal').classList.add('hidden');
            showToast('Hotspot click area defined.', 'success');
            return;
        }
        
        if (!state.currentClickAreaCategory) return;
        
        if (state.currentClickAreaType === 'interactable') {
            state.editorRequirements.interactableClickAreas[state.currentClickAreaCategory] = areaObj;
            showToast('Interactable click area defined.', 'success');
            const currentSelected = Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => cb.value);
            renderInteractablesCheckboxes(currentSelected);
        } else {
            state.editorRequirements.clickAreas[state.currentClickAreaCategory] = areaObj;
            showToast('Click area defined.', 'success');
            refreshCategorySelectors();
        }
        
        document.getElementById('click-area-modal').classList.add('hidden');
        updateRoomExportArea();
    });
    
    drawingListenersBound = true;
}

window.openClickAreaModal = (category, type = 'transition') => {
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
    
    state.currentClickAreaType = type;
    state.currentClickAreaCategory = category;
    
    if (type === 'interactable') {
        title.innerText = `Configure Click Area: ${category.toUpperCase()} (Interactable)`;
    } else {
        title.innerText = `Configure Click Area: ${category.toUpperCase()}`;
    }
    
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
        
        const existingArea = type === 'interactable'
            ? state.editorRequirements.interactableClickAreas?.[category]
            : state.editorRequirements.clickAreas?.[category];
            
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

export function renderScenesSection() {
    const selector = document.getElementById('scene-selector-dropdown');
    if (!selector) return;
    selector.innerHTML = '';

    if (!state.editorScenes) {
        state.editorScenes = [];
    }

    state.editorScenes.forEach(scene => {
        const opt = document.createElement('option');
        opt.value = scene.id;
        
        const hCount = (scene.hotspots || []).length;
        const cCount = (scene.terminal_commands || []).length;
        const rCount = scene.requirements ? Object.keys(scene.requirements).length : 0;
        const defaultIndicator = scene.is_default ? ' [DEFAULT]' : '';
        
        opt.textContent = `${scene.id}${defaultIndicator} (${hCount} Hotspot${hCount === 1 ? '' : 's'} | ${cCount} Cmd${cCount === 1 ? '' : 's'} | ${rCount} Req)`;
        if (state.selectedSceneId === scene.id) {
            opt.selected = true;
        }
        selector.appendChild(opt);
    });

    selector.onchange = (e) => {
        state.selectedSceneId = e.target.value;
        renderActiveSceneEditor();
    };
}

export function renderActiveSceneEditor() {
    const editorPanel = document.getElementById('active-scene-editor');
    if (!editorPanel) return;

    const scene = state.editorScenes.find(s => s.id === state.selectedSceneId);
    if (!scene) {
        editorPanel.innerHTML = `
            <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #888;">
                <i data-lucide="image" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
                <span>Select a scene from the left sidebar or create a new one to edit its sub-scene states.</span>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    editorPanel.innerHTML = `
        <div class="scene-editor-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--glass-border); padding-bottom: 8px;">
                <h3 style="margin: 0; font-size: 1.2rem; color: #fff;">Edit Scene: <span style="color: var(--color-primary);">${scene.id}</span></h3>
                <button type="button" id="btn-delete-scene" class="btn-small danger" style="padding: 4px 10px; border-radius: var(--radius-sm);">Delete Scene</button>
            </div>

            <div class="form-row-stacked" style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-weight: 600; margin-bottom: 6px; display: block;">Scene ID</label>
                    <input type="text" id="edit-scene-id" value="${scene.id}" placeholder="e.g. lobby_dark" required style="width: 100%;">
                    <small style="color: #888;">Must be unique within this room.</small>
                </div>
                <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 0.5rem; margin-bottom: 0;">
                    <label class="checkbox-container" style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="edit-scene-default" ${scene.is_default ? 'checked' : ''}>
                        <span class="checkbox-label" style="font-weight: 600;">Default Scene</span>
                    </label>
                </div>
            </div>

            <div class="form-section scene-graphics-section" style="border: 1px solid var(--glass-border); padding: 1rem; border-radius: var(--radius-sm); background: rgba(0,0,0,0.15);">
                <label style="font-weight: 600; margin-bottom: 8px; display: block;">Scene Background Image</label>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <div id="scene-bg-preview-container" style="width: 120px; height: 80px; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                        ${scene.bg_image 
                            ? `<img src="../${scene.bg_image}" style="width: 100%; height: 100%; object-fit: cover;" />` 
                            : `<i data-lucide="image" style="width: 24px; height: 24px; opacity: 0.3;"></i>`}
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                        <span id="scene-bg-path-label" style="font-size: 0.8rem; color: #aaa; word-break: break-all; font-family: var(--font-mono);">${scene.bg_image || 'No image selected'}</span>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" id="btn-select-scene-bg" class="btn-secondary btn-small">Choose Image</button>
                            <button type="button" id="btn-clear-scene-bg" class="btn-small danger">Remove</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="form-row-stacked" style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-weight: 600; margin-bottom: 6px; display: block;">Dialogue Node ID</label>
                    <select id="edit-scene-dialogue-id" style="width: 100%;">
                        <!-- Will be populated dynamically -->
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-weight: 600; margin-bottom: 6px; display: block;">Interactable Description</label>
                    <textarea id="edit-scene-interactable-desc" rows="2" placeholder="CRT description for this specific scene state..." style="width: 100%;">${scene.interactable_desc || ''}</textarea>
                </div>
            </div>

            <!-- Requirements Editor Section -->
            <div class="form-section" style="background: rgba(0,0,0,0.15); padding: 1rem; border-radius: var(--radius-sm); border: 1px dashed var(--glass-border);">
                <h4 style="margin: 0 0 12px 0; border-bottom: 1px dashed var(--glass-border); padding-bottom: 6px; font-size: 0.95rem; color: var(--color-primary);">Scene Entry Requirements</h4>
                <div id="scene-requirements-container" style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Requirements config -->
                </div>
            </div>

            <!-- Hotspots Section -->
            <div class="form-section" style="background: rgba(0,0,0,0.15); padding: 1rem; border-radius: var(--radius-sm); border: 1px dashed var(--glass-border);">
                <h4 style="margin: 0 0 12px 0; border-bottom: 1px dashed var(--glass-border); padding-bottom: 6px; font-size: 0.95rem; color: var(--color-primary);">Hotspots & Click Areas</h4>
                <div id="scene-hotspots-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1rem;">
                    <!-- list of hotspots -->
                </div>
                <button type="button" id="btn-add-scene-hotspot" class="btn-secondary btn-small">+ Add Hotspot</button>
            </div>

            <!-- Custom Terminal Commands Section -->
            <div class="form-section" style="background: rgba(0,0,0,0.15); padding: 1rem; border-radius: var(--radius-sm); border: 1px dashed var(--glass-border);">
                <h4 style="margin: 0 0 12px 0; border-bottom: 1px dashed var(--glass-border); padding-bottom: 6px; font-size: 0.95rem; color: var(--color-primary);">Custom Terminal Commands</h4>
                <div id="scene-commands-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1rem;">
                    <!-- list of custom commands -->
                </div>
                <button type="button" id="btn-add-scene-command" class="btn-secondary btn-small">+ Add Custom Command</button>
            </div>

        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Bind event handlers
    const idInput = document.getElementById('edit-scene-id');
    const defaultCheck = document.getElementById('edit-scene-default');
    const descTextarea = document.getElementById('edit-scene-interactable-desc');
    const dialogueSelect = document.getElementById('edit-scene-dialogue-id');
    
    // Populate Dialogue dropdown
    const dialogueTree = getTerminalDialogueTree() || {};
    dialogueSelect.innerHTML = '<option value="">-- None / Default --</option>';
    Object.keys(dialogueTree).sort().forEach(nodeId => {
        const opt = document.createElement('option');
        opt.value = nodeId;
        opt.textContent = nodeId;
        if (nodeId === scene.dialogue_id) {
            opt.selected = true;
        }
        dialogueSelect.appendChild(opt);
    });

    // Handle updates
    idInput.addEventListener('input', () => {
        const val = idInput.value.trim();
        if (val && val !== scene.id) {
            // Check uniqueness
            const exists = state.editorScenes.some(s => s.id === val);
            if (!exists) {
                scene.id = val;
                state.selectedSceneId = val;
                renderScenesSection();
                updateRoomExportArea();
            }
        }
    });

    defaultCheck.addEventListener('change', () => {
        if (defaultCheck.checked) {
            state.editorScenes.forEach(s => s.is_default = false);
            scene.is_default = true;
        } else {
            scene.is_default = false;
        }
        renderScenesSection();
        renderActiveSceneEditor();
        updateRoomExportArea();
    });

    descTextarea.addEventListener('input', () => {
        scene.interactable_desc = descTextarea.value.trim() || null;
        updateRoomExportArea();
    });

    dialogueSelect.addEventListener('change', () => {
        scene.dialogue_id = dialogueSelect.value || null;
        updateRoomExportArea();
    });

    // Delete scene
    document.getElementById('btn-delete-scene').onclick = () => {
        if (confirm(`Are you sure you want to delete scene "${scene.id}"?`)) {
            state.editorScenes = state.editorScenes.filter(s => s.id !== scene.id);
            state.selectedSceneId = state.editorScenes[0]?.id || null;
            renderScenesSection();
            renderActiveSceneEditor();
            updateRoomExportArea();
        }
    };

    // Choose Background Image
    document.getElementById('btn-select-scene-bg').onclick = () => {
        state.currentContext = 'room'; // Keep context room so we see room media
        state.mediaPickerCallback = (selectedMedia) => {
            scene.bg_image = selectedMedia.filepath;
            renderActiveSceneEditor();
            updateRoomExportArea();
        };
        openMediaModal();
    };

    // Clear Background Image
    document.getElementById('btn-clear-scene-bg').onclick = () => {
        scene.bg_image = null;
        renderActiveSceneEditor();
        updateRoomExportArea();
    };

    // Render Sub-components
    renderSceneRequirements(scene);
    renderSceneHotspots(scene);
    renderSceneCommands(scene);
}

export function renderSceneRequirements(scene) {
    const container = document.getElementById('scene-requirements-container');
    if (!container) return;
    container.innerHTML = '';

    scene.requirements = scene.requirements || {};

    // Sanity requirement
    const sanityRow = document.createElement('div');
    sanityRow.style.cssText = 'display: flex; gap: 1rem; align-items: center;';
    
    const sMin = scene.requirements.sanity_min !== undefined ? scene.requirements.sanity_min : 0;
    const sMax = scene.requirements.sanity_max !== undefined ? scene.requirements.sanity_max : 100;

    sanityRow.innerHTML = `
        <span style="font-size: 0.85rem; min-width: 100px;">Sanity Range:</span>
        <input type="number" class="scene-sanity-min" value="${sMin}" min="0" max="100" style="width: 70px;" placeholder="Min" />
        <span>to</span>
        <input type="number" class="scene-sanity-max" value="${sMax}" min="0" max="100" style="width: 70px;" placeholder="Max" />
    `;

    const minInput = sanityRow.querySelector('.scene-sanity-min');
    const maxInput = sanityRow.querySelector('.scene-sanity-max');
    
    const updateSanity = () => {
        const minVal = parseInt(minInput.value);
        const maxVal = parseInt(maxInput.value);
        if (minVal === 0 && maxVal === 100) {
            delete scene.requirements.sanity_min;
            delete scene.requirements.sanity_max;
        } else {
            scene.requirements.sanity_min = minVal;
            scene.requirements.sanity_max = maxVal;
        }
        updateRoomExportArea();
        renderScenesSection();
    };

    minInput.addEventListener('input', updateSanity);
    maxInput.addEventListener('input', updateSanity);

    container.appendChild(sanityRow);

    // Items requirement
    const itemsRow = document.createElement('div');
    itemsRow.style.cssText = 'display: flex; gap: 1rem; align-items: center; margin-top: 8px;';
    const currentItems = (scene.requirements.items || []).join(', ');
    itemsRow.innerHTML = `
        <span style="font-size: 0.85rem; min-width: 100px;">Required Items:</span>
        <input type="text" class="scene-items-input" value="${currentItems}" placeholder="key_card, screwdriver (comma separated)" style="flex: 1;" />
    `;
    const itemsInput = itemsRow.querySelector('.scene-items-input');
    itemsInput.addEventListener('input', () => {
        const val = itemsInput.value.trim();
        if (val) {
            scene.requirements.items = val.split(',').map(s => s.trim()).filter(s => s);
        } else {
            delete scene.requirements.items;
        }
        updateRoomExportArea();
        renderScenesSection();
    });
    container.appendChild(itemsRow);

    // World States requirement
    const statesRow = document.createElement('div');
    statesRow.style.cssText = 'display: flex; gap: 1rem; align-items: center; margin-top: 8px;';
    
    const currentStates = [];
    if (scene.requirements.worldStates) {
        for (const k in scene.requirements.worldStates) {
            currentStates.push(`${k}:${scene.requirements.worldStates[k]}`);
        }
    }

    statesRow.innerHTML = `
        <span style="font-size: 0.85rem; min-width: 100px;">World States:</span>
        <input type="text" class="scene-states-input" value="${currentStates.join(', ')}" placeholder="generator_active:1, console_power:0" style="flex: 1;" />
    `;
    const statesInput = statesRow.querySelector('.scene-states-input');
    statesInput.addEventListener('input', () => {
        const val = statesInput.value.trim();
        if (val) {
            const states = {};
            val.split(',').forEach(pair => {
                const parts = pair.split(':');
                if (parts[0]) {
                    const k = parts[0].trim();
                    const v = parseInt(parts[1] !== undefined ? parts[1].trim() : '1');
                    states[k] = isNaN(v) ? 1 : v;
                }
            });
            scene.requirements.worldStates = states;
        } else {
            delete scene.requirements.worldStates;
        }
        updateRoomExportArea();
        renderScenesSection();
    });
    container.appendChild(statesRow);
}
export function renderSceneHotspots(scene) {
    const list = document.getElementById('scene-hotspots-list');
    if (!list) return;
    list.innerHTML = '';

    scene.hotspots = scene.hotspots || [];

    if (scene.hotspots.length === 0) {
        list.innerHTML = '<span style="font-size: 0.85rem; color: #666; font-style: italic;">No hotspots defined.</span>';
    } else {
        scene.hotspots.forEach((h, idx) => {
            const card = document.createElement('div');
            card.className = 'hotspot-config-card';
            card.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                background: rgba(0,0,0,0.25);
                padding: 1.25rem;
                border-radius: var(--radius-md);
                border: 1px solid var(--glass-border);
                position: relative;
                margin-bottom: 0.75rem;
            `;

            // Card Header
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px; margin-bottom: 4px;';
            
            const titleSpan = document.createElement('span');
            titleSpan.style.cssText = 'font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-primary);';
            titleSpan.textContent = `Hotspot #${idx + 1} (${h.type === 'tra' ? 'Transition' : 'Interactable'})`;
            
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-remove btn-remove-compact';
            delBtn.style.cssText = 'padding: 4px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); width: 28px; height: 28px;';
            delBtn.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--error);"></i>';
            delBtn.onclick = () => {
                scene.hotspots = scene.hotspots.filter((_, i) => i !== idx);
                renderSceneHotspots(scene);
                updateRoomExportArea();
            };

            header.appendChild(titleSpan);
            header.appendChild(delBtn);
            card.appendChild(header);

            // 1. Trigger Type
            const typeGroup = document.createElement('div');
            typeGroup.className = 'form-group compact';
            typeGroup.style.margin = '0';
            const typeLabel = document.createElement('label');
            typeLabel.textContent = 'Trigger Action Type';
            typeLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const typeSel = document.createElement('select');
            typeSel.style.width = '100%';
            typeSel.innerHTML = `
                <option value="tra" ${h.type === 'tra' ? 'selected' : ''}>Transition</option>
                <option value="act" ${h.type === 'act' ? 'selected' : ''}>Interactable</option>
            `;
            typeGroup.appendChild(typeLabel);
            typeGroup.appendChild(typeSel);
            card.appendChild(typeGroup);

            // 2. Destination/Target ID
            const targetGroup = document.createElement('div');
            targetGroup.className = 'form-group compact';
            targetGroup.style.margin = '0';
            const targetLabel = document.createElement('label');
            targetLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const targetEl = document.createElement('select');
            targetEl.style.width = '100%';
            
            const updateTargetOptions = () => {
                targetEl.innerHTML = '';
                if (typeSel.value === 'tra') {
                    targetLabel.textContent = 'Transition Destination Category';
                    const transitionsList = state.transitionTypes || {};
                    Object.keys(transitionsList).forEach(cat => {
                        const opt = document.createElement('option');
                        opt.value = cat;
                        opt.textContent = cat.toUpperCase();
                        if (cat === h.target_id) opt.selected = true;
                        targetEl.appendChild(opt);
                    });
                    if (targetEl.options.length === 0) {
                        const opt = document.createElement('option');
                        opt.value = h.target_id || 'universal';
                        opt.textContent = (h.target_id || 'universal').toUpperCase();
                        opt.selected = true;
                        targetEl.appendChild(opt);
                    }
                } else {
                    targetLabel.textContent = 'Interactable Object';
                    const interactablesList = state.allInteractables || {};
                    Object.keys(interactablesList).forEach(iid => {
                        const opt = document.createElement('option');
                        opt.value = iid;
                        opt.textContent = (interactablesList[iid].label || iid).toUpperCase();
                        if (iid === h.target_id) opt.selected = true;
                        targetEl.appendChild(opt);
                    });
                }
            };
            
            updateTargetOptions();
            targetGroup.appendChild(targetLabel);
            targetGroup.appendChild(targetEl);
            card.appendChild(targetGroup);

            typeSel.addEventListener('change', () => {
                h.type = typeSel.value;
                updateTargetOptions();
                h.target_id = targetEl.value;
                titleSpan.textContent = `Hotspot #${idx + 1} (${h.type === 'tra' ? 'Transition' : 'Interactable'})`;
                updateRoomExportArea();
            });

            targetEl.addEventListener('change', () => {
                h.target_id = targetEl.value;
                updateRoomExportArea();
            });

            // 3. Hover Label
            const labelGroup = document.createElement('div');
            labelGroup.className = 'form-group compact';
            labelGroup.style.margin = '0';
            const labelLabel = document.createElement('label');
            labelLabel.textContent = 'Active Hotspot Hover Label';
            labelLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.placeholder = 'Label (e.g. Open Box)';
            labelInput.value = h.label || '';
            labelInput.addEventListener('input', () => {
                h.label = labelInput.value.trim() || null;
                updateRoomExportArea();
            });
            labelGroup.appendChild(labelLabel);
            labelGroup.appendChild(labelInput);
            card.appendChild(labelGroup);

            // 4. Coordinates button
            const coordGroup = document.createElement('div');
            coordGroup.className = 'form-group compact';
            coordGroup.style.margin = '0';
            const coordLabel = document.createElement('label');
            coordLabel.textContent = 'Hotspot Click Boundary';
            coordLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const coordBtn = document.createElement('button');
            coordBtn.type = 'button';
            coordBtn.className = 'btn-small btn-secondary';
            coordBtn.style.width = '100%';
            coordBtn.style.height = '42px';
            
            const updateCoordBtnLabel = () => {
                if (h.area) {
                    coordBtn.textContent = 'Edit Boundary Coordinates';
                    coordBtn.classList.remove('btn-secondary');
                    coordBtn.style.borderColor = '#22c55e';
                    coordBtn.style.color = '#22c55e';
                    coordBtn.style.background = 'rgba(34, 197, 94, 0.1)';
                } else {
                    coordBtn.textContent = 'Draw Bounding Box';
                    coordBtn.classList.add('btn-secondary');
                    coordBtn.style.borderColor = '';
                    coordBtn.style.color = '';
                    coordBtn.style.background = '';
                }
            };
            
            updateCoordBtnLabel();

            coordBtn.onclick = () => {
                window.onSaveSceneClickArea = (areaObj) => {
                    h.area = areaObj;
                    updateCoordBtnLabel();
                    updateRoomExportArea();
                };
                let bgUrl = null;
                if (scene.bg_image) {
                    bgUrl = `../${scene.bg_image}`;
                } else {
                    const roomMedia = state.mediaLibrary.filter(
                        m => m.context_type === 'room' && m.context_id === state.currentEditId
                    );
                    if (roomMedia.length > 0) {
                        bgUrl = `../${roomMedia[0].filepath}`;
                    }
                }
                state.editorRequirements.interactableClickAreas = state.editorRequirements.interactableClickAreas || {};
                state.editorRequirements.interactableClickAreas[h.target_id] = h.area || null;
                window.openClickAreaModal(h.target_id, 'interactable', bgUrl);
            };

            coordGroup.appendChild(coordLabel);
            coordGroup.appendChild(coordBtn);
            card.appendChild(coordGroup);

            // 5. Requirements input
            const reqGroup = document.createElement('div');
            reqGroup.className = 'form-group compact';
            reqGroup.style.margin = '0';
            const reqLabel = document.createElement('label');
            reqLabel.textContent = 'Active Conditions / Requirements';
            reqLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const reqInput = document.createElement('input');
            reqInput.type = 'text';
            reqInput.placeholder = 'e.g. smin:30, item:key_card';
            
            const currentReqText = [];
            if (h.requirements) {
                if (h.requirements.sanity_min !== undefined) currentReqText.push(`smin:${h.requirements.sanity_min}`);
                if (h.requirements.sanity_max !== undefined) currentReqText.push(`smax:${h.requirements.sanity_max}`);
                if (h.requirements.items) h.requirements.items.forEach(i => currentReqText.push(`item:${i}`));
                if (h.requirements.worldStates) {
                    for (const k in h.requirements.worldStates) {
                        currentReqText.push(`state:${k}:${h.requirements.worldStates[k]}`);
                    }
                }
            }
            
            reqInput.value = currentReqText.join(', ');
            reqInput.addEventListener('input', () => {
                const val = reqInput.value.trim();
                if (val) {
                    const reqObj = {};
                    val.split(',').forEach(term => {
                        const parts = term.split(':');
                        const type = parts[0]?.trim();
                        if (type === 'smin') reqObj.sanity_min = parseInt(parts[1]);
                        else if (type === 'smax') reqObj.sanity_max = parseInt(parts[1]);
                        else if (type === 'item') {
                            reqObj.items = reqObj.items || [];
                            reqObj.items.push(parts[1].trim());
                        } else if (type === 'state') {
                            reqObj.worldStates = reqObj.worldStates || {};
                            reqObj.worldStates[parts[1].trim()] = parseInt(parts[2] !== undefined ? parts[2].trim() : '1');
                        }
                    });
                    h.requirements = reqObj;
                } else {
                    h.requirements = null;
                }
                updateRoomExportArea();
            });

            reqGroup.appendChild(reqLabel);
            reqGroup.appendChild(reqInput);
            card.appendChild(reqGroup);

            list.appendChild(card);
        });
    }

    if (window.lucide) window.lucide.createIcons();

    document.getElementById('btn-add-scene-hotspot').onclick = () => {
        scene.hotspots.push({
            type: 'tra',
            target_id: '',
            label: '',
            area: null,
            requirements: null
        });
        renderSceneHotspots(scene);
        updateRoomExportArea();
    };
}

export function renderSceneCommands(scene) {
    const list = document.getElementById('scene-commands-list');
    if (!list) return;
    list.innerHTML = '';

    scene.terminal_commands = scene.terminal_commands || [];

    if (scene.terminal_commands.length === 0) {
        list.innerHTML = '<span style="font-size: 0.85rem; color: #666; font-style: italic;">No custom terminal commands defined.</span>';
    } else {
        scene.terminal_commands.forEach((c, idx) => {
            const card = document.createElement('div');
            card.className = 'command-config-card';
            card.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                background: rgba(0,0,0,0.25);
                padding: 1.25rem;
                border-radius: var(--radius-md);
                border: 1px solid var(--glass-border);
                position: relative;
                margin-bottom: 0.75rem;
            `;

            // Card Header
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px; margin-bottom: 4px;';
            
            const titleSpan = document.createElement('span');
            titleSpan.style.cssText = 'font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-primary);';
            titleSpan.textContent = `Command #${idx + 1}`;
            
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-remove btn-remove-compact';
            delBtn.style.cssText = 'padding: 4px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); width: 28px; height: 28px;';
            delBtn.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--error);"></i>';
            delBtn.onclick = () => {
                scene.terminal_commands = scene.terminal_commands.filter((_, i) => i !== idx);
                renderSceneCommands(scene);
                updateRoomExportArea();
            };

            header.appendChild(titleSpan);
            header.appendChild(delBtn);
            card.appendChild(header);

            // 1. Trigger phrase
            const triggerGroup = document.createElement('div');
            triggerGroup.className = 'form-group compact';
            triggerGroup.style.margin = '0';
            const triggerLabel = document.createElement('label');
            triggerLabel.textContent = 'Command Trigger Word/Phrase';
            triggerLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const triggerInput = document.createElement('input');
            triggerInput.type = 'text';
            triggerInput.placeholder = 'Trigger (e.g. read paper)';
            triggerInput.value = c.trigger || '';
            triggerInput.style.width = '100%';
            
            triggerInput.addEventListener('input', () => {
                c.trigger = triggerInput.value.trim();
                updateRoomExportArea();
            });
            triggerGroup.appendChild(triggerLabel);
            triggerGroup.appendChild(triggerInput);
            card.appendChild(triggerGroup);

            // 2. Success response text
            const successGroup = document.createElement('div');
            successGroup.className = 'form-group compact';
            successGroup.style.margin = '0';
            const successLabel = document.createElement('label');
            successLabel.textContent = 'Terminal Response / Success Text';
            successLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const successInput = document.createElement('input');
            successInput.type = 'text';
            successInput.placeholder = 'Success text displayed on terminal...';
            successInput.value = c.success_text || '';
            successInput.style.width = '100%';
            
            successInput.addEventListener('input', () => {
                c.success_text = successInput.value.trim() || null;
                updateRoomExportArea();
            });
            successGroup.appendChild(successLabel);
            successGroup.appendChild(successInput);
            card.appendChild(successGroup);

            // 3. Effects (JSON)
            const effectsGroup = document.createElement('div');
            effectsGroup.className = 'form-group compact';
            effectsGroup.style.margin = '0';
            const effectsLabel = document.createElement('label');
            effectsLabel.textContent = 'Trigger Action Effects (JSON)';
            effectsLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const effectsInput = document.createElement('input');
            effectsInput.type = 'text';
            effectsInput.placeholder = '[{"type":"sfx","value":"paper_rustle"}]';
            effectsInput.value = JSON.stringify(c.effects || []);
            effectsInput.style.cssText = 'width: 100%; font-family: var(--font-mono); font-size: 0.8rem;';
            
            effectsInput.addEventListener('input', () => {
                try {
                    const parsed = JSON.parse(effectsInput.value);
                    c.effects = parsed;
                    effectsInput.style.borderColor = '';
                } catch (e) {
                    effectsInput.style.borderColor = '#ef4444';
                }
                updateRoomExportArea();
            });
            effectsGroup.appendChild(effectsLabel);
            effectsGroup.appendChild(effectsInput);
            card.appendChild(effectsGroup);

            list.appendChild(card);
        });
    }

    if (window.lucide) window.lucide.createIcons();

    document.getElementById('btn-add-scene-command').onclick = () => {
        scene.terminal_commands.push({
            trigger: '',
            effects: [],
            success_text: ''
        });
        renderSceneCommands(scene);
        updateRoomExportArea();
    };
}
