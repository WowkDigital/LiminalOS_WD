// Room Editor lifecycle and general logic
import { state } from '../state.js';
import { getCategoryIcon, getThumbPath, showToast } from '../ui.js';
import { fetchWorld, fetchMedia, saveRoom, assignMedia, deleteRoom } from '../api.js';
import { navigate } from '../router.js';
import { el, icon } from '../dom.js';
import { TextConfigRow } from '../components/TextConfigRow.js';
import { getTerminalDialogueTree, setTerminalDialogueTree } from '../terminal.js';
import { renderInteractablesCheckboxes } from './interactables.js';
import { setupRoomTerminalListeners, populateTerminalSection, getRoomTerminalDialogueData } from './terminal.js';
import { renderScenesSection, renderActiveSceneEditor, renderSceneHotspots } from './scenes.js';

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
                            onChange: () => {
                                syncTransitionsFromEditorRequirements();
                            }
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
    if (textsContainer) {
        textsContainer.innerHTML = '';
    }

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
        const roomDescInput = document.getElementById('room-desc');
        if (roomDescInput) roomDescInput.value = room.desc || '';
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
        
        const mediaPreview = document.getElementById('room-images-preview');
        if (mediaPreview) {
            renderRoomMediaPreview();
        }

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
                desc: room.desc || '',
                texts: room.texts || [],
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
        
        const imagesPreview = document.getElementById('room-images-preview');
        if (imagesPreview) imagesPreview.innerHTML = '';

        const delBtn = document.getElementById('btn-delete-room');
        if (delBtn) delBtn.classList.add('hidden');

        state.editorRequirements = { transitions: {}, interactables: {}, clickAreas: {}, interactableClickAreas: {} };

        renderInteractablesCheckboxes([]);
        const textsList = document.getElementById('texts-list');
        if (textsList) {
            textsList.innerHTML = '';
            addTextField();
        }
        refreshCategorySelectors(['universal']);

        state.editorScenes = [{
            id: 'new_room_default',
            is_default: true,
            bg_image: null,
            desc: '',
            texts: [],
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

    let roomDesc = null;
    let roomTexts = [];
    if (state.editorScenes && state.editorScenes.length > 0) {
        const defaultScene = state.editorScenes.find(s => s.is_default) || state.editorScenes[0];
        roomDesc = defaultScene.desc || null;
        roomTexts = defaultScene.texts || [];
    }

    const transitions = [];
    const transSeen = new Set();
    if (state.editorScenes) {
        state.editorScenes.forEach(scene => {
            (scene.hotspots || []).forEach(h => {
                if (h.type === 'tra' && !transSeen.has(h.target_id)) {
                    transSeen.add(h.target_id);
                    transitions.push({
                        category: h.target_id,
                        requirements: h.requirements || null,
                        area: h.area || null
                    });
                }
            });
        });
    }

    const roomId = state.currentEditId;
    const interactablesArr = roomId ? Object.entries(state.allInteractables)
        .filter(([id, data]) => data.room_id === roomId)
        .map(([iid, data]) => {
            let req = null;
            let area = null;
            if (state.editorScenes) {
                for (const scene of state.editorScenes) {
                    const h = (scene.hotspots || []).find(hs => hs.type === 'act' && hs.target_id === iid);
                    if (h) {
                        req = h.requirements || null;
                        area = h.area || null;
                        break;
                    }
                }
            }
            return { 
                id: iid, 
                requirements: req || state.editorRequirements.interactables[iid] || null,
                area: area || state.editorRequirements.interactableClickAreas?.[iid] || null
            };
        }) : [];

    return {
        name: formData.get('name'),
        desc: roomDesc,
        tags: (formData.get('tags') || '').split(',').map(s => s.trim()).filter(s => s),
        transitions,
        interactables: interactablesArr,
        texts: roomTexts,
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
        const roomDescInput = document.getElementById('room-desc');
        if (roomDescInput) roomDescInput.value = data.desc || '';
        document.getElementById('room-tags').value = (data.tags || []).join(', ');

        state.editorRequirements.transitions = {};
        state.editorRequirements.clickAreas = {};
        state.editorRequirements.interactableClickAreas = {};
        (data.transitions || []).forEach(t => {
            if (typeof t === 'object') {
                state.editorRequirements.transitions[t.category] = t.requirements;
                state.editorRequirements.clickAreas[t.category] = t.area || null;
            }
        });
        state.editorRequirements.interactables = {};
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
        if (textsContainer) {
            textsContainer.innerHTML = '';
            (data.texts || []).forEach(text => addTextField(text));
        }

        state.editorScenes = JSON.parse(JSON.stringify(data.scenes || []));
        if (state.editorScenes.length === 0) {
            const roomMedia = state.mediaLibrary.filter(
                m => m.context_type === 'room' && m.context_id === state.currentEditId
            );
            const defaultBg = roomMedia.length > 0 ? roomMedia[0].filepath : null;
            
            const legacyHotspots = [];
            (data.transitions || []).forEach(t => {
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
            
            (data.interactables || []).forEach(i => {
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
                id: `${state.currentEditId || 'new_room'}_default`,
                is_default: true,
                bg_image: defaultBg,
                desc: data.desc || '',
                texts: data.texts || [],
                interactable_desc: null,
                dialogue_id: null,
                requirements: null,
                hotspots: legacyHotspots,
                terminal_commands: []
            });
        }
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
            
            state.currentEditId = roomId;
            const targetHash = `editor?id=${encodeURIComponent(roomId)}`;
            if (window.location.hash !== '#' + targetHash) {
                window.location.hash = targetHash;
            }
            openEditor(roomId);
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

export function syncTransitionsFromEditorRequirements() {
    const scene = state.editorScenes?.find(s => s.id === state.selectedSceneId);
    if (!scene) return;

    const transitionsContainer = document.getElementById('transitions-container');
    if (!transitionsContainer) return;

    const checkedCats = Array.from(transitionsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

    scene.hotspots = scene.hotspots || [];
    const nonTraHotspots = scene.hotspots.filter(h => h.type !== 'tra');
    const updatedTraHotspots = checkedCats.map(cat => {
        const existing = scene.hotspots.find(h => h.type === 'tra' && h.target_id === cat);
        return {
            type: 'tra',
            target_id: cat,
            label: existing?.label || cat.toUpperCase(),
            area: state.editorRequirements.clickAreas?.[cat] || null,
            requirements: state.editorRequirements.transitions?.[cat] || null
        };
    });

    scene.hotspots = [...nonTraHotspots, ...updatedTraHotspots];

    renderSceneHotspots(scene);
    updateRoomExportArea();
}

export function syncEditorRequirementsFromActiveScene() {
    const scene = state.editorScenes?.find(s => s.id === state.selectedSceneId);
    if (!scene) return;

    state.editorRequirements.transitions = {};
    state.editorRequirements.clickAreas = {};

    const selectedCats = [];
    (scene.hotspots || []).forEach(h => {
        if (h.type === 'tra' && h.target_id) {
            selectedCats.push(h.target_id);
            if (h.requirements) {
                state.editorRequirements.transitions[h.target_id] = h.requirements;
            }
            if (h.area) {
                state.editorRequirements.clickAreas[h.target_id] = h.area;
            }
        }
    });

    refreshCategorySelectors(selectedCats);
}

// Bind to window for global access across files
window.syncTransitionsFromEditorRequirements = syncTransitionsFromEditorRequirements;
window.syncEditorRequirementsFromActiveScene = syncEditorRequirementsFromActiveScene;
