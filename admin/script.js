document.addEventListener('DOMContentLoaded', () => {
    // Initialize static icons
    if (window.lucide) lucide.createIcons();

    // State
    let roomsData = {};
    let transitionTypes = {};
    let imageIndex = { rooms: {}, transitions: {} };
    let allInteractables = {}; // Store all available interactables from DB
    let mediaLibrary = [];
    let currentEditId = null;
    let currentContext = 'room'; // 'room', 'transition', or 'interactable'
    let selectedMediaIds = []; // Temp storage for modal selection
    let systemTaxonomy = []; // Global definitions
    let mediaPickerCallback = null; // Callback for single-file selection

    let editorRequirements = {
        transitions: {}, // category -> reqObj
        interactables: {} // interId -> reqObj
    };
    let currentReqTarget = null; // {type, id} 
    const reqModal = document.getElementById('req-modal');

    /**
     * Generate a procedural color for a category string
     */
    function getCategoryColor(category) {
        if (!category || category === 'universal') return '#eab308'; // Default accent

        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 85%, 65%)`;
    }

    // Elements
    const views = {
        dashboard: document.getElementById('view-dashboard'),
        editor: document.getElementById('view-editor'),
        media: document.getElementById('view-media'),
        interactables: document.getElementById('view-interactables'),
        interEditor: document.getElementById('view-interactable-editor'),
        transitions: document.getElementById('view-transitions'),
        transEditor: document.getElementById('view-transition-editor'),
        taxonomy: document.getElementById('view-taxonomy'),
        sfx: document.getElementById('view-sfx')
    };

    // Navigation - Hash Based
    window.addEventListener('hashchange', () => {
        const view = window.location.hash.replace('#', '') || 'dashboard';
        if (views[view] || ['editor', 'interEditor', 'transEditor'].includes(view)) {
            switchView(view);
        }
    });

    const navigate = (view) => window.location.hash = view;

    document.getElementById('btn-dashboard').addEventListener('click', () => navigate('dashboard'));
    document.getElementById('btn-media').addEventListener('click', () => navigate('media'));
    document.getElementById('btn-interactables').addEventListener('click', () => navigate('interactables'));
    document.getElementById('btn-transitions').addEventListener('click', () => navigate('transitions'));
    document.getElementById('btn-taxonomy').addEventListener('click', () => navigate('taxonomy'));
    document.getElementById('btn-sfx').addEventListener('click', () => navigate('sfx'));

    document.getElementById('btn-add-room').addEventListener('click', () => { navigate('editor'); openEditor(); });
    document.getElementById('btn-add-interactable').addEventListener('click', () => { navigate('interEditor'); openInteractableEditor(); });
    document.getElementById('btn-add-transition').addEventListener('click', () => { navigate('transEditor'); openTransitionEditor(); });

    document.getElementById('btn-cancel-edit').addEventListener('click', () => navigate('dashboard'));
    document.getElementById('btn-cancel-inter-edit').addEventListener('click', () => navigate('interactables'));
    document.getElementById('btn-cancel-trans-edit').addEventListener('click', () => navigate('transitions'));

    document.getElementById('btn-add-text').addEventListener('click', () => addTextField());
    document.getElementById('btn-add-state').addEventListener('click', () => addStateField());
    document.getElementById('btn-add-trans-text').addEventListener('click', () => addTransTextField());

    document.getElementById('btn-delete-interactable').addEventListener('click', deleteInteractable);
    document.getElementById('btn-delete-transition').addEventListener('click', deleteTransition);

    document.getElementById('btn-copy-room-json').addEventListener('click', () => {
        const area = document.getElementById('room-json-export');
        area.select();
        area.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(area.value);
        showToast('JSON copied to clipboard', 'success');
    });
    document.getElementById('btn-apply-room-json').addEventListener('click', applyRoomJSON);

    document.getElementById('btn-copy-trans-json').addEventListener('click', () => {
        const area = document.getElementById('trans-json-export');
        area.select();
        area.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(area.value);
        showToast('JSON copied to clipboard', 'success');
    });
    document.getElementById('btn-apply-trans-json').addEventListener('click', applyTransitionJSON);

    document.getElementById('btn-copy-inter-json').addEventListener('click', () => {
        const area = document.getElementById('inter-json-export');
        area.select();
        area.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(area.value);
        showToast('JSON copied to clipboard', 'success');
    });
    document.getElementById('btn-apply-inter-json').addEventListener('click', applyInteractableJSON);

    document.getElementById('btn-add-trans-tag').addEventListener('click', () => saveTaxonomyItem('transition_tag', 'new-trans-tag'));

    // Requirements Modal
    document.getElementById('btn-close-req-modal').addEventListener('click', () => reqModal.classList.add('hidden'));
    document.getElementById('btn-clear-req').addEventListener('click', clearRequirements);
    document.getElementById('btn-save-req').addEventListener('click', saveRequirementsToState);
    document.getElementById('req-interactable-id').addEventListener('change', (e) => updateReqStateDropdown(e.target.value));

    // Media Controls
    document.getElementById('media-filter-type').addEventListener('change', renderMediaLibrary);
    document.getElementById('media-upload-input').addEventListener('change', handleUpload);

    // SFX Engine
    document.getElementById('audio-upload-input').addEventListener('change', handleAudioUpload);
    document.getElementById('audio-search').addEventListener('input', renderAudioLibrary);
    document.querySelectorAll('[data-sfx-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-sfx-tab');
            switchSfxTab(tab);
        });
    });

    // JSON Import (Rooms)
    document.getElementById('json-import-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!Array.isArray(data)) throw new Error("JSON must be an array of objects.");
                showToast(`Importing ${data.length} records...`, 'info');
                const res = await fetch('api.php?action=import_rooms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rooms: data })
                });
                const result = await res.json();
                if (result.success) { showToast(`Import successful.`, 'success'); fetchWorld(); }
                else throw new Error(result.error || 'Import failed');
            } catch (err) { showToast('Import Failed: ' + err.message, 'error'); }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    // JSON Import (Transitions)
    document.getElementById('trans-import-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!Array.isArray(data)) throw new Error("JSON must be an array of objects.");
                showToast(`Importing ${data.length} transitions...`, 'info');
                const res = await fetch('api.php?action=import_transitions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transitions: data })
                });
                const result = await res.json();
                if (result.success) { showToast(`Transitions imported.`, 'success'); fetchWorld(); }
                else throw new Error(result.error);
            } catch (err) { showToast('Import Failed: ' + err.message, 'error'); }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    // JSON Import (ALL DATA)
    let pendingImportData = null;
    const importPreviewModal = document.getElementById('import-preview-modal');

    document.getElementById('all-import-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                pendingImportData = data;
                showToast(`Validating sync package...`, 'info');

                const res = await fetch('api.php?action=preview_import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const summary = await res.json();

                if (summary.error) throw new Error(summary.error);
                renderImportPreview(summary);
                importPreviewModal.classList.remove('hidden');

            } catch (err) { showToast('Validation Failed: ' + err.message, 'error'); }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    function renderImportPreview(summary) {
        const summaryCont = document.getElementById('import-summary');
        const detailsCont = document.getElementById('import-details');

        summaryCont.innerHTML = `
            <div class="summary-box">
                <span class="label">Rooms</span>
                <span class="value">${summary.rooms.create} NEW / ${summary.rooms.update} UPD</span>
            </div>
            <div class="summary-box">
                <span class="label">Transitions</span>
                <span class="value">${summary.transitions.create} NEW / ${summary.transitions.update} UPD</span>
            </div>
            <div class="summary-box">
                <span class="label">Objects</span>
                <span class="value">${summary.interactables.create} NEW / ${summary.interactables.update} UPD</span>
            </div>
            <div class="summary-box">
                <span class="label">Tags</span>
                <span class="value">${summary.taxonomy.new} NEW</span>
            </div>
        `;

        let detailsHtml = '<strong>Specific Changes:</strong><br>';
        const allDetails = [
            ...summary.rooms.details,
            ...summary.transitions.details,
            ...summary.interactables.details,
            ...summary.taxonomy.details
        ];

        if (allDetails.length === 0) detailsHtml += 'No changes detected. System is up to date.';
        else {
            allDetails.forEach(d => detailsHtml += `<div>${d}</div>`);
        }
        detailsCont.innerHTML = detailsHtml;
    }

    document.getElementById('btn-confirm-import').addEventListener('click', async () => {
        if (!pendingImportData) return;
        showToast('Executing system sync...', 'info');
        try {
            const res = await fetch('api.php?action=import_all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingImportData)
            });
            const result = await res.json();
            if (result.success) {
                showToast('System Synchronized.', 'success');
                importPreviewModal.classList.add('hidden');
                pendingImportData = null;
                fetchWorld();
            } else throw new Error(result.error);
        } catch (err) { showToast('Sync failed: ' + err.message, 'error'); }
    });

    document.getElementById('btn-cancel-import').addEventListener('click', () => {
        importPreviewModal.classList.add('hidden');
        pendingImportData = null;
    });

    document.getElementById('btn-close-import-modal').addEventListener('click', () => {
        importPreviewModal.classList.add('hidden');
        pendingImportData = null;
    });

    // JSON Export (ALL DATA)
    document.getElementById('btn-export-all').addEventListener('click', async () => {
        try {
            showToast('Generating system backup...', 'info');
            const res = await fetch('api.php?action=export_all');
            const data = await res.json();

            const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `liminal_world_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Backup downloaded.', 'success');
        } catch (err) {
            showToast('Export failed: ' + err.message, 'error');
        }
    });

    // Modal
    const modal = document.getElementById('media-modal');
    document.getElementById('btn-manage-room-media').addEventListener('click', () => { currentContext = 'room'; openMediaModal(); });
    document.getElementById('btn-manage-trans-media').addEventListener('click', () => { currentContext = 'transition'; openMediaModal(); });
    document.getElementById('btn-close-modal').addEventListener('click', () => { modal.classList.add('hidden'); mediaPickerCallback = null; });
    document.getElementById('btn-confirm-media').addEventListener('click', confirmMediaSelection);

    // Forms
    const roomForm = document.getElementById('room-form');
    if (roomForm) {
        roomForm.addEventListener('submit', handleRoomSubmit);
        roomForm.addEventListener('input', updateRoomExportArea);
        roomForm.addEventListener('change', updateRoomExportArea);
    }

    const interForm = document.getElementById('inter-form');
    if (interForm) {
        interForm.addEventListener('submit', handleInteractableSubmit);
        interForm.addEventListener('input', updateInteractableExportArea);
        interForm.addEventListener('change', updateInteractableExportArea);
    }

    const transForm = document.getElementById('trans-form');
    if (transForm) {
        transForm.addEventListener('submit', handleTransitionSubmit);
        transForm.addEventListener('input', updateTransitionExportArea);
        transForm.addEventListener('change', updateTransitionExportArea);
    }

    // Initial Load
    fetchWorld().then(() => {
        // Handle initial routing after data is load to ensure lists render correctly
        const initialView = window.location.hash.replace('#', '') || 'dashboard';
        switchView(initialView);
    });
    fetchMedia();

    // --- API Interactions ---

    async function fetchWorld() {
        const list = document.getElementById('rooms-list');
        if (list) list.innerHTML = '<div class="loading">Establishing data link...</div>';
        try {
            const res = await fetch('api.php');
            if (!res.ok) throw new Error('Failed to fetch data');
            const data = await res.json();
            roomsData = data.rooms;
            transitionTypes = data.transition_types || {};
            imageIndex = data.image_index || { rooms: {}, transitions: {} };
            allInteractables = data.interactables || {};
            systemTaxonomy = data.taxonomy || [];
            renderRoomsList();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
            if (list) list.innerHTML = '<div class="error">System Offline. Check PHP & SQLite.</div>';
        }
    }

    async function fetchMedia() {
        try {
            const res = await fetch('api.php?action=media');
            if (!res.ok) throw new Error('Failed to fetch media');
            mediaLibrary = await res.json();
            renderMediaLibrary();
            if (currentEditId) {
                if (views.editor.classList.contains('active')) renderRoomMediaPreview();
                if (views.transEditor.classList.contains('active')) renderTransMediaPreview();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleUpload(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        showToast(`Uploading ${files.length} items...`, 'info');

        let successCount = 0;
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'none');
            formData.append('context_id', 'none');
            formData.append('tags', 'uploaded');

            try {
                const res = await fetch('api.php?action=upload_media', {
                    method: 'POST',
                    body: formData
                });
                const result = await res.json();
                if (result.success) successCount++;
            } catch (err) {
                console.error(`Upload failed for ${file.name}:`, err);
            }
        }

        if (successCount > 0) {
            showToast(`Task Complete: ${successCount}/${files.length} digitized.`, 'success');
            fetchMedia();
        } else {
            showToast('All upload sequences failed.', 'error');
        }

        e.target.value = '';
    }

    async function assignMedia(mediaId, type, contextId) {
        try {
            const res = await fetch('api.php?action=assign_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ media_id: mediaId, type, context_id: contextId, tags: 'assigned' })
            });
            return await res.json();
        } catch (err) {
            console.error(err);
            return { success: false };
        }
    }

    // --- Rendering ---

    function renderRoomsList() {
        const list = document.getElementById('rooms-list');
        if (!list) return;
        list.innerHTML = '';
        if (Object.keys(roomsData).length === 0) {
            list.innerHTML = '<div class="empty">No active zones detected. Initiate new sequence.</div>';
            return;
        }

        Object.entries(roomsData).forEach(([id, room]) => {
            const card = document.createElement('div');
            card.className = 'room-card';

            // Reachability logic
            const hasExits = (room.transitions || []).some(t => {
                const cat = typeof t === 'string' ? t : t.category;
                return transitionTypes[cat] && transitionTypes[cat].length > 0;
            });
            const canExit = hasExits && Object.keys(roomsData).length > 1;

            const canEnter = Object.entries(roomsData).some(([otherId, otherRoom]) => {
                if (otherId === id) return false;
                return (otherRoom.transitions || []).some(t => {
                    const cat = typeof t === 'string' ? t : t.category;
                    return transitionTypes[cat] && transitionTypes[cat].length > 0;
                });
            });

            const tagsHtml = (room.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');

            const roomImages = imageIndex.rooms[id] || [];
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

        // Initialize Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }

        checkWorldIntegrity();
    }

    function checkWorldIntegrity() {
        const container = document.getElementById('world-integrity-status');
        if (!container) return;

        const rooms = Object.entries(roomsData);
        if (rooms.length === 0) {
            container.innerHTML = '';
            return;
        }

        const deadEnds = [];
        const orphans = [];
        const startRoomId = 'lobby';
        const visited = new Set();
        const queue = [startRoomId];

        // 1. Connectivity Check (from Lobby)
        if (roomsData[startRoomId]) {
            visited.add(startRoomId);
            while (queue.length > 0) {
                const currentId = queue.shift();
                const room = roomsData[currentId];
                const hasExits = (room.transitions || []).some(t => {
                    const cat = typeof t === 'string' ? t : t.category;
                    return transitionTypes[cat] && transitionTypes[cat].length > 0;
                });

                if (hasExits) {
                    // In this random model, ANY exit from ANY room can lead to ANY OTHER room
                    // So if current room has an exit, it can reach all rooms except itself
                    Object.keys(roomsData).forEach(id => {
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
                return transitionTypes[cat] && transitionTypes[cat].length > 0;
            });
            if (!hasExits && rooms.length > 1) {
                deadEnds.push(id);
            }

            if (!visited.has(id)) {
                orphans.push(id);
            }
        });

        let statusHtml = '';
        if (deadEnds.length === 0 && orphans.length === 0 && roomsData[startRoomId]) {
            statusHtml = `
                <div class="integrity-badge valid">
                    <i data-lucide="check-circle"></i> Graph Connected
                </div>
                <div class="integrity-message">All nodes reachable via liminal paths.</div>
            `;
        } else {
            const isError = orphans.length > 0 || !roomsData[startRoomId];
            const badgeClass = isError ? 'error' : 'warning';
            const icon = isError ? 'alert-octagon' : 'alert-triangle';
            const label = isError ? 'Graph Fragmented' : 'World Instability';

            statusHtml = `
                <div class="integrity-badge ${badgeClass}">
                    <i data-lucide="${icon}"></i> ${label}
                </div>
            `;

            if (!roomsData[startRoomId]) statusHtml += `<div class="integrity-message"><i data-lucide="x"></i> Missing 'lobby' sequence.</div>`;
            if (orphans.length > 0) statusHtml += `<div class="integrity-message"><i data-lucide="x"></i> ${orphans.length} unreachable zones.</div>`;
            if (deadEnds.length > 0) statusHtml += `<div class="integrity-message"><i data-lucide="alert-circle"></i> ${deadEnds.length} dead ends detected.</div>`;
        }

        container.innerHTML = statusHtml;
        if (window.lucide) lucide.createIcons();
    }

    function renderTransitionsList() {
        const list = document.getElementById('transitions-list');
        if (!list) return;
        list.innerHTML = '';

        let allTrans = [];
        Object.entries(transitionTypes).forEach(([cat, items]) => {
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

            const transImages = imageIndex.transitions[trans.id] || [];
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

    function renderInteractablesList() {
        const list = document.getElementById('interactables-list');
        if (!list) return;
        list.innerHTML = '';
        if (Object.keys(allInteractables).length === 0) {
            list.innerHTML = '<div class="empty">No interactables found. Define the first one.</div>';
            return;
        }

        Object.entries(allInteractables).forEach(([id, data]) => {
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

    function renderMediaLibrary() {
        const list = document.getElementById('media-list');
        if (!list) return;
        const search = document.getElementById('media-search').value.toLowerCase();
        const filter = document.getElementById('media-filter-type').value;

        list.innerHTML = '';

        const filtered = mediaLibrary.filter(item => {
            const matchesSearch = item.filename.toLowerCase().includes(search) ||
                item.tags.toLowerCase().includes(search) ||
                item.context_id.toLowerCase().includes(search);
            const matchesFilter = filter === 'all' || item.context_type === filter;
            return matchesSearch && matchesFilter;
        });

        if (filtered.length === 0) {
            list.innerHTML = '<div class="empty">No matching records in the library.</div>';
            return;
        }

        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = 'media-card';

            const usageText = item.context_type !== 'none'
                ? `Used in: ${item.context_type.charAt(0).toUpperCase() + item.context_type.slice(1)} (${item.context_id})`
                : 'Not assigned to any record';

            card.innerHTML = `
                <div class="media-thumb">
                    <img src="../${getThumbPath(item.filepath)}" alt="">
                    <button class="btn-delete-small" onclick="event.stopPropagation(); window.deleteMedia(${item.id})">&times;</button>
                </div>
                <div class="media-info">
                    <div class="media-filename">${item.filename}</div>
                    <div class="small-dim usage-info">${usageText}</div>
                    <div class="media-tags">
                        ${(() => {
                    let tags = item.tags.split(',').map(t => t.trim()).filter(t => t !== '');
                    let isInteractable = item.context_type === 'interactable';
                    let isRoom = item.context_type === 'room';
                    let isTransition = item.context_type === 'transition';

                    let isAssigned = tags.includes('assigned') || isInteractable || isRoom || isTransition;
                    tags = tags.filter(t => t !== 'assigned');

                    let html = '';
                    if (isAssigned) {
                        html += '<span class="tag assigned">assigned</span>';
                    }
                    if (isInteractable) html += '<span class="tag assigned">Interactable</span>';
                    if (isRoom) html += '<span class="tag assigned">Location</span>';
                    if (isTransition) html += '<span class="tag assigned">Transition</span>';

                    tags.forEach(t => {
                        html += `<span class="tag">${t}</span>`;
                    });
                    return html;
                })()}
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    }

    window.deleteMedia = async (id) => {
        if (!confirm("Permanently delete this file from storage?")) return;
        try {
            const res = await fetch('api.php?action=delete_media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const result = await res.json();
            if (result.success) {
                showToast('File erased.', 'success');
                fetchMedia();
            } else throw new Error(result.error);
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    };

    // --- Room Editor Logic ---

    function openEditor(id = null) {
        currentEditId = id;
        currentContext = 'room';
        switchView('editor');

        const title = document.getElementById('editor-title');
        const idInput = document.getElementById('room-id');
        const textsContainer = document.getElementById('texts-list');
        textsContainer.innerHTML = '';

        if (id) {
            const room = roomsData[id];
            title.innerText = `Edit: ${room.name}`;
            idInput.value = id;
            idInput.readOnly = true;

            document.getElementById('room-name').value = room.name || '';
            document.getElementById('room-desc').value = room.desc || '';
            document.getElementById('room-tags').value = (room.tags || []).join(', ');

            // Initialize editorRequirements
            editorRequirements.transitions = {};
            (room.transitions || []).forEach(t => {
                if (typeof t === 'object') editorRequirements.transitions[t.category] = t.requirements;
            });
            editorRequirements.interactables = {};
            (room.interactables || []).forEach(i => {
                if (typeof i === 'object') editorRequirements.interactables[i.id] = i.requirements;
            });

            const selectedCats = (room.transitions || []).map(t => typeof t === 'string' ? t : t.category);
            refreshCategorySelectors(selectedCats);
            renderInteractablesCheckboxes(room.interactables || []);

            (room.texts || []).forEach(text => addTextField(text));
            renderRoomMediaPreview();
        } else {
            title.innerText = "Define New Space";
            roomForm.reset();
            idInput.value = '';
            idInput.readOnly = false;
            document.getElementById('room-images-preview').innerHTML = '';

            // Reset editorRequirements
            editorRequirements = { transitions: {}, interactables: {} };

            renderInteractablesCheckboxes([]);
            addTextField();
            refreshCategorySelectors(['universal']);
        }

        updateRoomExportArea();
    }

    function getRoomDataFromForm() {
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
            return { category: cat, requirements: editorRequirements.transitions[cat] || null };
        });
        const interactablesArr = Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => {
            const iid = cb.value;
            return { id: iid, requirements: editorRequirements.interactables[iid] || null };
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

    function updateRoomExportArea() {
        if (!currentEditId || currentContext !== 'room') {
            document.getElementById('room-json-export').value = '';
            return;
        }
        const data = getRoomDataFromForm();
        document.getElementById('room-json-export').value = JSON.stringify(data, null, 4);
    }

    function applyRoomJSON() {
        const jsonStr = document.getElementById('room-json-import').value.trim();
        if (!jsonStr) return;
        try {
            const data = JSON.parse(jsonStr);
            // Basic validation
            if (typeof data !== 'object') throw new Error("Invalid structure");

            document.getElementById('room-name').value = data.name || '';
            document.getElementById('room-desc').value = data.desc || '';
            document.getElementById('room-tags').value = (data.tags || []).join(', ');

            // Requirements
            editorRequirements.transitions = {};
            (data.transitions || []).forEach(t => {
                if (typeof t === 'object') editorRequirements.transitions[t.category] = t.requirements;
            });
            editorRequirements.interactables = {};
            (data.interactables || []).forEach(i => {
                if (typeof i === 'object') editorRequirements.interactables[i.id] = i.requirements;
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

    function renderRoomMediaPreview() {
        const container = document.getElementById('room-images-preview');
        if (!container) return;
        container.innerHTML = '';
        const roomMedia = mediaLibrary.filter(m => m.context_type === 'room' && m.context_id === currentEditId);
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

    function renderInteractablesCheckboxes(selectedItems) {
        const container = document.getElementById('interactables-checkbox-group');
        if (!container) return;
        container.innerHTML = '';
        if (Object.keys(allInteractables).length === 0) {
            container.innerHTML = '<small>No interactables defined in system.</small>';
            return;
        }

        const selectedIds = selectedItems.map(i => typeof i === 'string' ? i : i.id);

        Object.entries(allInteractables).forEach(([id, data]) => {
            const row = document.createElement('div');
            row.className = 'config-row';
            const isChecked = selectedIds.includes(id);
            const hasReq = !!editorRequirements.interactables[id];

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

    window.unassignMediaItem = async (id) => {
        if (confirm("Disconnect this image?")) {
            await assignMedia(id, 'none', 'none');
            fetchMedia();
        }
    };

    function refreshCategorySelectors(selectedValues = null) {
        // Update Transition Editor's category checkboxes
        const transGroup = document.getElementById('trans-category-group');
        const categories = new Set(['universal']); // Default category

        // 1. Add categories from existing transitions in the world
        if (transitionTypes && typeof transitionTypes === 'object') {
            Object.keys(transitionTypes).forEach(cat => {
                if (cat && cat !== 'universal') categories.add(cat);
            });
        }

        // 2. Add categories from system taxonomy definitions (even if no transitions yet)
        if (Array.isArray(systemTaxonomy)) {
            systemTaxonomy.forEach(t => {
                const type = (t.type || '').trim();
                const label = (t.label || '').trim();
                if (type === 'transition_category' && label) {
                    categories.add(label);
                }
            });
        }

        // Helper to render checkboxes into a container
        const fillContainer = (container, groupName) => {
            if (!container) return;
            // Capture current selection if not provided
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
                const hasReq = !!editorRequirements.transitions[cat];

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
                    // Simple labels for context-less editor (like Transition Editor itself)
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

        // Also update Room editor's "Transition Type" checkboxes
        const roomTransGroup = document.getElementById('transitions-container');
        fillContainer(roomTransGroup, 'room-editor');
    }

    // --- Transitions Editor Logic ---

    function openTransitionEditor(id = null) {
        currentEditId = id;
        currentContext = 'transition';
        refreshCategorySelectors();
        switchView('transEditor');

        const title = document.getElementById('trans-editor-title');
        const idInput = document.getElementById('trans-id');
        const textsContainer = document.getElementById('trans-texts-list');
        const deleteBtn = document.getElementById('btn-delete-transition');

        textsContainer.innerHTML = '';

        if (id) {
            // Find transition in transitionTypes
            let trans = null;
            Object.values(transitionTypes).forEach(list => {
                const found = list.find(t => t.id === id);
                if (found) trans = found;
            });

            if (!trans) return;

            title.innerText = `Edit Transition: ${trans.label}`;
            idInput.value = id;
            idInput.readOnly = true;

            // Set categories checkboxes
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

    function getTransitionDataFromForm() {
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

    function updateTransitionExportArea() {
        if (!currentEditId || currentContext !== 'transition') {
            document.getElementById('trans-json-export').value = '';
            return;
        }
        const data = getTransitionDataFromForm();
        document.getElementById('trans-json-export').value = JSON.stringify(data, null, 4);
    }

    function applyTransitionJSON() {
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

    function renderTransMediaPreview() {
        const container = document.getElementById('trans-images-preview');
        if (!container) return;
        container.innerHTML = '';
        const transMedia = mediaLibrary.filter(m => m.context_type === 'transition' && m.context_id === currentEditId);
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

    async function handleTransitionSubmit(e) {
        e.preventDefault();
        const transId = document.getElementById('trans-id').value.trim();
        const transData = getTransitionDataFromForm();

        try {
            const res = await fetch('api.php?action=save_transition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: transId, transition: transData })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Liminal path secured.', 'success');
                fetchWorld();
                navigate('transitions');
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            showToast('Update failed: ' + err.message, 'error');
        }
    }

    async function deleteTransition() {
        if (!currentEditId) return;
        if (!confirm(`Delete transition '${currentEditId}'?`)) return;

        try {
            const res = await fetch('api.php?action=delete_transition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: currentEditId })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Path collapsed.', 'success');
                fetchWorld();
                navigate('transitions');
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    }

    // --- Interactables Management ---

    function openInteractableEditor(id = null) {
        currentEditId = id;
        currentContext = 'interactable';
        switchView('interEditor');

        const title = document.getElementById('inter-editor-title');
        const idInput = document.getElementById('inter-id');
        const labelInput = document.getElementById('inter-label');
        const statesContainer = document.getElementById('states-list');
        const deleteBtn = document.getElementById('btn-delete-interactable');

        statesContainer.innerHTML = '';

        if (id) {
            title.innerText = `Edit Object: ${allInteractables[id].label}`;
            idInput.value = id;
            idInput.readOnly = true;
            labelInput.value = allInteractables[id].label;
            if (deleteBtn) deleteBtn.classList.remove('hidden');

            (allInteractables[id].states || []).forEach(state => addStateField(state));
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

    function getInteractableDataFromForm() {
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

    function updateInteractableExportArea() {
        if (!currentEditId || currentContext !== 'interactable') {
            document.getElementById('inter-json-export').value = '';
            return;
        }
        const data = getInteractableDataFromForm();
        document.getElementById('inter-json-export').value = JSON.stringify(data, null, 4);
    }

    function applyInteractableJSON() {
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

    function addStateField(state = {}) {
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
                <input type="text" name="state_id[]" value="${state.id || ''}" placeholder="e.g. on" required>
            </div>
            <div class="form-group" style="margin-bottom: 10px">
                <label>Description</label>
                <textarea name="state_desc[]" rows="2" placeholder="...">${state.desc || ''}</textarea>
            </div>
            <div class="form-group" style="margin-bottom: 0">
                <label>Visual Asset</label>
                <div class="media-picker-row">
                    <input type="text" name="state_image[]" value="${state.image || ''}" placeholder="media/uploads/..." readonly>
                    <button type="button" class="btn-secondary" style="padding: 10px" onclick="window.pickStateImage(this)">Select from Library</button>
                </div>
                <div class="state-image-preview">
                    <img src="${state.image ? '../' + state.image : ''}" class="${state.image ? '' : 'hidden'}">
                    <div class="${state.image ? 'hidden' : 'no-image'}">No Asset Selected</div>
                </div>
            </div>
        `;
        container.appendChild(div);
    }

    window.pickStateImage = (btn) => {
        const row = btn.closest('.media-picker-row');
        const input = row.querySelector('input');
        const preview = row.nextElementSibling;
        const img = preview.querySelector('img');
        const placeholder = preview.querySelector('.no-image');

        mediaPickerCallback = (media) => {
            input.value = media.filepath;
            img.src = '../' + media.filepath;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };

        modal.classList.remove('hidden');
        document.querySelector('.modal-header h3').innerText = 'Select Asset';
        renderModalMediaList();
    };

    async function handleInteractableSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('inter-id').value.trim();
        const interactableData = getInteractableDataFromForm();

        try {
            const res = await fetch('api.php?action=save_interactable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id, interactable: interactableData })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Object saved.', 'success');
                fetchWorld();
                navigate('interactables');
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            showToast('Save failed: ' + err.message, 'error');
        }
    }

    async function deleteInteractable() {
        if (!currentEditId) return;
        if (!confirm(`Delete '${currentEditId}' forever?`)) return;
        try {
            const res = await fetch('api.php?action=delete_interactable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: currentEditId })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Purged.', 'success');
                fetchWorld();
                navigate('interactables');
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    }

    // --- Helpers ---

    function getThumbPath(path) {
        if (!path) return '';
        if (path.startsWith('media/uploads/')) {
            return path.replace('media/uploads/', 'media/images/thumbs/');
        }
        return path;
    }

    function addTextField(item = {}) {
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

    function addTransTextField(item = {}) {
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

    function openMediaModal() {
        if (!currentEditId) {
            // New record - check if ID input has value based on context
            let input = null;
            if (currentContext === 'room') input = document.getElementById('room-id');
            if (currentContext === 'transition') input = document.getElementById('trans-id');
            if (currentContext === 'interactable') input = document.getElementById('inter-id');

            if (input && input.value.trim()) {
                currentEditId = input.value.trim();
            }
        }

        if (!currentEditId) {
            showToast('Enter a Unique ID first to manage media for new records.', 'error');
            return;
        }
        modal.classList.remove('hidden');
        document.querySelector('.modal-header h3').innerText = 'Select Graphics';
        mediaPickerCallback = null;
        renderModalMediaList();
    }

    function renderModalMediaList() {
        const list = document.getElementById('modal-media-list');
        if (!list) return;
        list.innerHTML = '';
        mediaLibrary.forEach(m => {
            let isSelected = false;
            if (!mediaPickerCallback) {
                isSelected = m.context_type === currentContext && m.context_id === currentEditId;
            }

            const thumb = document.createElement('div');
            thumb.className = `selectable-thumb ${isSelected ? 'selected' : ''}`;
            thumb.dataset.id = m.id;
            thumb.innerHTML = `<img src="../${getThumbPath(m.filepath)}">`;
            thumb.onclick = () => {
                if (mediaPickerCallback) {
                    document.querySelectorAll('.selectable-thumb').forEach(t => t.classList.remove('selected'));
                    thumb.classList.add('selected');
                } else {
                    thumb.classList.toggle('selected');
                }
            };
            list.appendChild(thumb);
        });
    }

    async function fetchMedia() {
        try {
            const res = await fetch('api.php?action=media');
            if (!res.ok) throw new Error('Failed to fetch media');
            mediaLibrary = await res.json();
            renderMediaLibrary();

            // Refresh previews if in an editor
            if (currentEditId) {
                if (views.editor.classList.contains('active')) renderRoomMediaPreview();
                if (views.transEditor.classList.contains('active')) renderTransMediaPreview();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function confirmMediaSelection() {
        const thumbs = document.querySelectorAll('.selectable-thumb');
        const currentSelectedInUI = Array.from(thumbs).filter(t => t.classList.contains('selected')).map(t => parseInt(t.dataset.id));

        if (mediaPickerCallback) {
            if (currentSelectedInUI.length > 0) {
                const selectedMedia = mediaLibrary.find(m => m.id === currentSelectedInUI[0]);
                mediaPickerCallback(selectedMedia);
            }
            mediaPickerCallback = null;
            modal.classList.add('hidden');
            return;
        }

        const promises = [];
        mediaLibrary.forEach(m => {
            const isNowSelected = currentSelectedInUI.includes(m.id);
            const wasAssigned = m.context_type === currentContext && m.context_id === currentEditId;
            if (isNowSelected && !wasAssigned) promises.push(assignMedia(m.id, currentContext, currentEditId));
            else if (!isNowSelected && wasAssigned) promises.push(assignMedia(m.id, 'none', 'none'));
        });
        await Promise.all(promises);
        modal.classList.add('hidden');
        showToast('Media updated.', 'success');

        // Refresh both to sync dashboard thumbnails and editor previews
        await fetchWorld();
        await fetchMedia();
    }

    async function handleRoomSubmit(e) {
        e.preventDefault();
        const roomId = document.getElementById('room-id').value.trim();
        const roomData = getRoomDataFromForm();
        try {
            const res = await fetch('api.php?action=save_room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: roomId, room: roomData })
            });
            const result = await res.json();
            if (result.success) { showToast('Reality updated.', 'success'); fetchWorld(); navigate('dashboard'); }
            else throw new Error(result.error);
        } catch (err) { showToast('Update failed: ' + err.message, 'error'); }
    }

    function switchView(viewName) {
        // Toggle active/hidden classes on sections
        Object.values(views).forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('active');
            }
        });

        if (views[viewName]) {
            views[viewName].classList.remove('hidden');
            views[viewName].classList.add('active');
        }

        // Handle navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        let btnId = `btn-${viewName}`;
        if (viewName === 'editor') btnId = 'btn-add-room';
        if (viewName === 'interEditor') btnId = 'btn-interactables';
        if (viewName === 'transEditor') btnId = 'btn-transitions';
        const activeBtn = document.getElementById(btnId);
        if (activeBtn) activeBtn.classList.add('active');

        // Refresh data on entry
        if (viewName === 'dashboard') renderRoomsList();
        if (viewName === 'media') fetchMedia();
        if (viewName === 'interactables') renderInteractablesList();
        if (viewName === 'transitions') renderTransitionsList();
        if (viewName === 'taxonomy') fetchTaxonomy();
        if (viewName === 'sfx') fetchAudioData();
    }

    // --- Taxonomy Logic ---

    async function fetchTaxonomy() {
        try {
            const res = await fetch('api.php?action=get_taxonomy');
            const data = await res.json();

            // Critical: Sync local systemTaxonomy state from the detailed response
            const newTaxonomy = [];
            if (data.room_tags) Object.keys(data.room_tags).forEach(label => newTaxonomy.push({ type: 'room_tag', label }));
            if (data.transition_categories) Object.keys(data.transition_categories).forEach(label => newTaxonomy.push({ type: 'transition_category', label }));
            if (data.transition_tags) Object.keys(data.transition_tags).forEach(label => newTaxonomy.push({ type: 'transition_tag', label }));
            systemTaxonomy = newTaxonomy;

            renderTaxonomy(data);
        } catch (err) {
            showToast('Taxonomy sync failed.', 'error');
        }
    }

    function renderTaxonomy(data) {
        renderTaxList('list-room-tags', data.room_tags, 'room_tag');
        renderTaxList('list-transition-categories', data.transition_categories, 'transition_category');
        renderTaxList('list-transition-tags', data.transition_tags, 'transition_tag');
    }

    function renderTaxList(containerId, items, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        Object.entries(items).forEach(([label, count]) => {
            const div = document.createElement('div');
            div.className = 'tax-item';
            const isTransCat = type === 'transition_category';
            const catColor = isTransCat ? getCategoryColor(label) : null;

            div.innerHTML = `
                <span class="${isTransCat ? 'accent' : ''}" style="${isTransCat ? `color: ${catColor} !important` : ''}">${label}</span>
                <div style="display:flex; align-items:center; gap:12px">
                    <span class="tax-count" style="${isTransCat ? `border-color: ${catColor}; color: ${catColor}` : ''}">${count}</span>
                    <button class="btn-remove-tiny" onclick="window.deleteTaxonomyItem('${type}', '${label}')" title="Remove definition">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

        if (window.lucide) lucide.createIcons();
    }

    async function saveTaxonomyItem(type, inputId) {
        const input = document.getElementById(inputId);
        const label = input.value.trim().toLowerCase();
        if (!label) return;

        try {
            const res = await fetch('api.php?action=save_taxonomy_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, label })
            });
            const result = await res.json();
            if (result.success) {
                input.value = '';
                fetchTaxonomy();
                fetchWorld(); // Redraw world data to update global taxonomy
                showToast('Definition registered.', 'success');
            }
        } catch (err) {
            showToast('Failed to save definition.', 'error');
        }
    }

    window.deleteTaxonomyItem = async (type, label) => {
        if (!confirm(`Remove definition for '${label}'? This won't delete data from objects.`)) return;
        try {
            const res = await fetch('api.php?action=delete_taxonomy_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, label })
            });
            fetchTaxonomy();
            fetchWorld();
            showToast('Definition cleared.', 'info');
        } catch (err) {
            showToast('Purge failed.', 'error');
        }
    }

    // --- Requirements Logic ---
    window.openRequirementsModal = (type, id) => {
        currentReqTarget = { type, id };
        const reqs = editorRequirements[type][id] || {};

        document.getElementById('req-modal-title').innerText = `Conditions: ${id}`;

        // Populate interactable dependency options
        const sel = document.getElementById('req-interactable-id');
        sel.innerHTML = '<option value="">None</option>';
        Object.entries(allInteractables).forEach(([iid, data]) => {
            const opt = document.createElement('option');
            opt.value = iid;
            opt.innerText = data.label || iid;
            sel.appendChild(opt);
        });

        sel.value = reqs.interactable_id || '';
        document.getElementById('req-sanity-min').value = reqs.sanity_min !== undefined ? reqs.sanity_min : 0;
        document.getElementById('req-sanity-max').value = reqs.sanity_max !== undefined ? reqs.sanity_max : 100;

        updateReqStateDropdown(reqs.interactable_id, reqs.state_id);
        reqModal.classList.remove('hidden');
    };

    function updateReqStateDropdown(interId, selectedStateId = null) {
        const group = document.getElementById('req-state-group');
        const sel = document.getElementById('req-state-id');

        if (!interId || !allInteractables[interId]) {
            group.classList.add('hidden');
            return;
        }

        sel.innerHTML = '';
        (allInteractables[interId].states || []).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.innerText = `${s.id} (${s.desc.substring(0, 20)}...)`;
            sel.appendChild(opt);
        });

        if (selectedStateId) sel.value = selectedStateId;
        group.classList.remove('hidden');
    }

    function clearRequirements() {
        if (!currentReqTarget) return;
        delete editorRequirements[currentReqTarget.type][currentReqTarget.id];
        reqModal.classList.add('hidden');
        refreshCategorySelectors();
        renderInteractablesCheckboxes(Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => cb.value));
    }

    function saveRequirementsToState() {
        if (!currentReqTarget) return;

        const interId = document.getElementById('req-interactable-id').value;
        const stateId = document.getElementById('req-state-id').value;
        const sMin = parseInt(document.getElementById('req-sanity-min').value);
        const sMax = parseInt(document.getElementById('req-sanity-max').value);

        const reqObj = {};
        if (interId) {
            reqObj.interactable_id = interId;
            reqObj.state_id = stateId;
        }
        if (sMin > 0) reqObj.sanity_min = sMin;
        if (sMax < 100) reqObj.sanity_max = sMax;

        if (Object.keys(reqObj).length > 0) {
            editorRequirements[currentReqTarget.type][currentReqTarget.id] = reqObj;
        } else {
            delete editorRequirements[currentReqTarget.type][currentReqTarget.id];
        }

        reqModal.classList.add('hidden');
        showToast('Conditions applied to draft.', 'success');

        // Refresh UI to show which items have requirements
        refreshCategorySelectors();
        renderInteractablesCheckboxes(Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => cb.value));
    }

    function showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
    }
    // --- SFX Engine Logic ---
    let audioLibrary = [];
    let audioMappings = [];
    let currentSfxTab = 'bgm';

    async function fetchAudioData() {
        try {
            const res = await fetch('api.php?action=get_audio');
            const data = await res.json();
            audioLibrary = data.library || [];
            audioMappings = data.mappings || [];
            renderAudioLibrary();
            renderAudioMappings();
        } catch (e) {
            console.error(e);
            showToast('Failed to fetch audio data', 'error');
        }
    }

    function switchSfxTab(tab) {
        currentSfxTab = tab;
        document.querySelectorAll('[data-sfx-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-sfx-tab') === tab);
        });
        document.querySelectorAll('.sfx-tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== `sfx-tab-${tab}`);
        });
        renderAudioMappings();
    }

    function renderAudioLibrary() {
        const list = document.getElementById('audio-items-list');
        const searchInput = document.getElementById('audio-search');
        if (!list || !searchInput) return;

        const search = searchInput.value.toLowerCase();
        list.innerHTML = '';

        const filtered = audioLibrary.filter(a => a.filename.toLowerCase().includes(search));
        filtered.forEach(a => {
            const item = document.createElement('div');
            item.className = 'audio-item';
            item.innerHTML = `
                <button class="audio-play-btn" onclick="window.previewAudio('${a.filepath}')">
                    <i data-lucide="play"></i>
                </button>
                <div class="audio-info">
                    <span class="audio-name">${a.filename}</span>
                    <span class="audio-meta">${a.category || 'sfx'}</span>
                </div>
                <button class="btn-remove-tiny audio-delete-btn" onclick="window.deleteAudioItem(${a.id})">
                    <i data-lucide="trash-2"></i>
                </button>
            `;
            list.appendChild(item);
        });
        if (window.lucide) lucide.createIcons();
    }

    window.previewAudio = (path) => {
        const audio = new Audio('../' + path);
        audio.play();
    };

    window.deleteAudioItem = async (id) => {
        if (!confirm("Delete this audio asset?")) return;
        try {
            const res = await fetch('api.php?action=delete_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Audio deleted', 'success');
                fetchAudioData();
            } else throw new Error(result.error);
        } catch (e) {
            showToast('Delete failed: ' + e.message, 'error');
        }
    };

    async function handleAudioUpload(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        showToast(`Digitizing ${files.length} audio samples...`, 'info');

        let successCount = 0;
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('category', currentSfxTab);
            try {
                const res = await fetch('api.php?action=upload_media', { method: 'POST', body: formData });
                const result = await res.json();
                if (result.success) successCount++;
                else console.error(`Upload failed for ${file.name}:`, result.error);
            } catch (err) {
                console.error(`Fetch error for ${file.name}:`, err);
            }
        }

        if (successCount > 0) {
            showToast(`Task Complete: ${successCount}/${files.length} audio assets indexed.`, 'success');
            fetchAudioData();
        } else {
            showToast('Audio ingest sequence failed.', 'error');
        }
        e.target.value = '';
    }

    function renderAudioMappings() {
        const container = document.getElementById(`${currentSfxTab}-mapping-list`);
        if (!container) return;
        container.innerHTML = '';

        let contexts = [];
        if (currentSfxTab === 'bgm') {
            contexts = Object.keys(roomsData).map(id => ({ id, label: roomsData[id].name }));
        } else if (currentSfxTab === 'states') {
            Object.entries(allInteractables).forEach(([iid, data]) => {
                (data.states || []).forEach(s => {
                    contexts.push({ id: `${iid}.${s.id}`, label: `${data.label} (${s.id})` });
                });
            });
        } else if (currentSfxTab === 'transitions') {
            // Get all unique transitions from the world data
            const transSet = new Set();
            Object.values(transitionTypes).forEach(list => {
                list.forEach(t => {
                    if (!transSet.has(t.id)) {
                        transSet.add(t.id);
                        contexts.push({ id: t.id, label: t.label });
                    }
                });
            });
        } else if (currentSfxTab === 'ui') {
            contexts = [
                { id: 'btn_click', label: 'Button Click' },
                { id: 'view_transition', label: 'View Transition' },
                { id: 'view_arrival', label: 'View Arrival' },
                { id: 'glitch', label: 'Glitch Effect' }
            ];
        }

        contexts.forEach(ctx => {
            const mapping = audioMappings.find(m => m.mapping_type === currentSfxTab && m.context_id === ctx.id) || {};
            const row = document.createElement('div');
            row.className = 'mapping-row';

            const options = audioLibrary.map(a => `<option value="${a.id}" ${mapping.audio_file_id == a.id ? 'selected' : ''}>${a.filename}</option>`).join('');

            row.innerHTML = `
                <div class="mapping-context">${ctx.label}</div>
                <select class="mapping-select" onchange="window.updateMapping('${currentSfxTab}', '${ctx.id}', this.value)">
                    <option value="">None / Procedural</option>
                    ${options}
                </select>
                <div class="mapping-volume">
                    <i data-lucide="volume-2"></i>
                    <input type="range" min="0" max="1" step="0.1" value="${mapping.volume || 0.5}" onchange="window.updateMappingVolume('${currentSfxTab}', '${ctx.id}', this.value)">
                </div>
                <div class="mapping-loop">
                    <input type="checkbox" ${mapping.loop ? 'checked' : ''} onchange="window.updateMappingLoop('${currentSfxTab}', '${ctx.id}', this.checked)">
                </div>
            `;
            container.appendChild(row);
        });
        if (window.lucide) lucide.createIcons();
    }

    window.updateMapping = async (type, contextId, audioId) => {
        const mapping = { mapping_type: type, context_id: contextId, audio_file_id: audioId };
        const existing = audioMappings.find(m => m.mapping_type === type && m.context_id === contextId) || {};
        mapping.volume = existing.volume || 0.5;
        mapping.loop = existing.loop || 0;

        try {
            const res = await fetch('api.php?action=save_audio_mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mapping })
            });
            const result = await res.json();
            if (result.success) {
                // Refresh local mappings
                const mRes = await fetch('api.php?action=get_audio');
                const mData = await mRes.json();
                audioMappings = mData.mappings || [];
            }
        } catch (e) {
            showToast('Failed to save mapping', 'error');
        }
    };

    window.updateMappingVolume = async (type, contextId, volume) => {
        const existing = audioMappings.find(m => m.mapping_type === type && m.context_id === contextId);
        if (!existing) return;
        existing.volume = volume;
        await window.updateMapping(type, contextId, existing.audio_file_id);
    };

    window.updateMappingLoop = async (type, contextId, loop) => {
        const existing = audioMappings.find(m => m.mapping_type === type && m.context_id === contextId);
        if (!existing) return;
        existing.loop = loop ? 1 : 0;
        await window.updateMapping(type, contextId, existing.audio_file_id);
    };
});

