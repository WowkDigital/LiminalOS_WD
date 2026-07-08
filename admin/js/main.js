// Main entry point and event handlers orchestration for LiminalOS Admin Panel
import { state } from './state.js';
import { 
    fetchWorld, 
    fetchMedia, 
    importRooms, 
    importTransitions, 
    previewImport, 
    importAll, 
    exportAll,
    getAudio
} from './api.js';
import { switchView, navigate } from './router.js';
import { showToast } from './ui.js';
import { 
    renderRoomsList, 
    openEditor, 
    addTextField, 
    applyRoomJSON, 
    handleRoomSubmit, 
    handleDeleteRoom,
    updateRoomExportArea 
} from './rooms.js';
import { 
    renderTransitionsList, 
    openTransitionEditor, 
    addTransTextField, 
    applyTransitionJSON, 
    handleTransitionSubmit, 
    handleDeleteTransition, 
    updateTransitionExportArea 
} from './transitions.js';
import { 
    renderInteractablesList, 
    openInteractableEditor, 
    addStateField, 
    applyInteractableJSON, 
    handleInteractableSubmit, 
    handleDeleteInteractable, 
    updateInteractableExportArea 
} from './interactables.js';
import { 
    renderMediaLibrary, 
    openMediaModal, 
    confirmMediaSelection, 
    handleUpload,
    renderMediaTagChips
} from './media.js';
import { 
    fetchTaxonomy, 
    saveTaxonomyItem 
} from './taxonomy.js';
import { 
    fetchAudioData, 
    switchSfxTab, 
    handleAudioUpload, 
    renderAudioLibrary 
} from './audio.js';
import { 
    updateReqStateDropdown, 
    clearRequirements, 
    saveRequirementsToState 
} from './requirements.js';
import { runDiagnosticsSuite } from './tests.js';
import { fetchTerminalDialogues } from './terminal.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize static icons
    if (window.lucide) lucide.createIcons();

    // Map views to their rendering routines
    const renderCallbacks = {
        dashboard: renderRoomsList,
        media: () => {
            fetchMedia().then(m => {
                state.mediaLibrary = m;
                state.activeMediaTagFilter = state.activeMediaTagFilter || 'all';
                renderMediaTagChips();
                renderMediaLibrary();
            });
        },
        interactables: renderInteractablesList,
        transitions: renderTransitionsList,
        taxonomy: fetchTaxonomy,
        sfx: fetchAudioData,
        tests: () => {},
        terminal: fetchTerminalDialogues,
        editor: () => {
            const hash = window.location.hash.replace('#', '');
            const parts = hash.split('?');
            let id = null;
            if (parts[1]) {
                parts[1].split('&').forEach(pair => {
                    const [k, v] = pair.split('=');
                    if (k === 'id') id = decodeURIComponent(v);
                });
            }
            if (state.currentEditId !== id || state.currentContext !== 'room') {
                openEditor(id);
            }
        }
    };

    const validViews = [
        'dashboard', 'media', 'interactables', 'transitions', 
        'taxonomy', 'sfx', 'editor', 'interEditor', 'transEditor', 'tests',
        'terminal'
    ];

    // Navigation - Hash Based
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        const view = hash.split('?')[0];
        if (validViews.includes(view)) {
            switchView(view, renderCallbacks);
        }
    });

    // Sidebar navigation bindings
    document.getElementById('btn-dashboard').addEventListener('click', () => navigate('dashboard'));
    document.getElementById('btn-media').addEventListener('click', () => navigate('media'));
    document.getElementById('btn-interactables').addEventListener('click', () => navigate('interactables'));
    document.getElementById('btn-transitions').addEventListener('click', () => navigate('transitions'));
    document.getElementById('btn-taxonomy').addEventListener('click', () => navigate('taxonomy'));
    document.getElementById('btn-sfx').addEventListener('click', () => navigate('sfx'));
    document.getElementById('btn-tests').addEventListener('click', () => navigate('tests'));
    document.getElementById('btn-terminal').addEventListener('click', () => navigate('terminal'));

    // Create New Record bindings
    document.getElementById('btn-add-room').addEventListener('click', () => navigate('editor'));
    document.getElementById('btn-add-interactable').addEventListener('click', () => { navigate('interEditor'); openInteractableEditor(); });
    document.getElementById('btn-add-transition').addEventListener('click', () => { navigate('transEditor'); openTransitionEditor(); });

    // Cancel edit bindings
    document.getElementById('btn-cancel-edit').addEventListener('click', () => navigate('dashboard'));
    document.getElementById('btn-cancel-inter-edit').addEventListener('click', () => {
        if (state.backToRoom) {
            const backRoom = state.backToRoom;
            state.backToRoom = null;
            state.prefilledRoomId = null;
            navigate(`editor?id=${encodeURIComponent(backRoom)}`);
        } else {
            navigate('interactables');
        }
    });
    document.getElementById('btn-cancel-trans-edit').addEventListener('click', () => navigate('transitions'));

    // Dynamic fields add bindings
    const addTextBtn = document.getElementById('btn-add-text');
    if (addTextBtn) addTextBtn.addEventListener('click', () => addTextField());
    
    const addStateBtn = document.getElementById('btn-add-state');
    if (addStateBtn) addStateBtn.addEventListener('click', () => addStateField());
    
    const addTransTextBtn = document.getElementById('btn-add-trans-text');
    if (addTransTextBtn) addTransTextBtn.addEventListener('click', () => addTransTextField());

    // Delete bindings
    document.getElementById('btn-delete-room').addEventListener('click', handleDeleteRoom);
    document.getElementById('btn-delete-interactable').addEventListener('click', handleDeleteInteractable);
    document.getElementById('btn-delete-transition').addEventListener('click', handleDeleteTransition);

    // Room Editor Tabs replaced with accordions — no tab switcher needed


    // Diagnostics bindings
    document.getElementById('btn-run-tests').addEventListener('click', runDiagnosticsSuite);

    // JSON export/copy helper bindings
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

    // JSON tab switching logic
    document.querySelectorAll('.json-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.closest('.json-control-section');
            if (!section) return;
            const targetId = btn.getAttribute('data-target');
            
            // Toggle active state on buttons
            section.querySelectorAll('.json-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle visible panels
            section.querySelectorAll('.json-tab-panel').forEach(p => p.classList.add('hidden'));
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) targetPanel.classList.remove('hidden');
        });
    });

    // Taxonomy bindings
    document.getElementById('btn-add-room-tag').addEventListener('click', () => saveTaxonomyItem('room_tag', 'new-room-tag'));
    document.getElementById('btn-add-trans-cat').addEventListener('click', () => saveTaxonomyItem('transition_category', 'new-trans-cat'));
    document.getElementById('btn-add-trans-tag').addEventListener('click', () => saveTaxonomyItem('transition_tag', 'new-trans-tag'));

    // Requirements Modal bindings
    const reqModal = document.getElementById('req-modal');
    document.getElementById('btn-close-req-modal').addEventListener('click', () => reqModal.classList.add('hidden'));
    document.getElementById('btn-clear-req').addEventListener('click', clearRequirements);
    document.getElementById('btn-save-req').addEventListener('click', saveRequirementsToState);
    document.getElementById('req-interactable-id').addEventListener('change', (e) => updateReqStateDropdown(e.target.value));

    // Media Filter & Upload bindings
    document.getElementById('media-filter-type').addEventListener('change', renderMediaLibrary);
    document.getElementById('media-upload-input').addEventListener('change', handleUpload);

    // SFX upload & search bindings
    document.getElementById('audio-upload-input').addEventListener('change', handleAudioUpload);
    document.querySelectorAll('[data-sfx-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-sfx-tab');
            switchSfxTab(tab);
        });
    });

    // JSON Single Import (Rooms) bindings
    document.getElementById('json-import-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!Array.isArray(data)) throw new Error("JSON must be an array of objects.");
                showToast(`Importing ${data.length} records...`, 'info');
                const result = await importRooms(data);
                if (result.success) {
                    showToast(`Import successful.`, 'success');
                    await syncWorldData();
                } else throw new Error(result.error || 'Import failed');
            } catch (err) {
                showToast('Import Failed: ' + err.message, 'error');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    // JSON Single Import (Transitions) bindings
    document.getElementById('trans-import-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!Array.isArray(data)) throw new Error("JSON must be an array of objects.");
                showToast(`Importing ${data.length} transitions...`, 'info');
                const result = await importTransitions(data);
                if (result.success) {
                    showToast(`Transitions imported.`, 'success');
                    await syncWorldData();
                } else throw new Error(result.error);
            } catch (err) {
                showToast('Import Failed: ' + err.message, 'error');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    // JSON Backup Sync & Import Preview modal bindings
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

                const summary = await previewImport(data);
                if (summary.error) throw new Error(summary.error);

                renderImportPreview(summary);
                importPreviewModal.classList.remove('hidden');
            } catch (err) {
                showToast('Validation Failed: ' + err.message, 'error');
            }
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
            const result = await importAll(pendingImportData);
            if (result.success) {
                showToast('System Synchronized.', 'success');
                importPreviewModal.classList.add('hidden');
                pendingImportData = null;
                await syncWorldData();
            } else throw new Error(result.error);
        } catch (err) {
            showToast('Sync failed: ' + err.message, 'error');
        }
    });

    document.getElementById('btn-cancel-import').addEventListener('click', () => {
        importPreviewModal.classList.add('hidden');
        pendingImportData = null;
    });

    document.getElementById('btn-close-import-modal').addEventListener('click', () => {
        importPreviewModal.classList.add('hidden');
        pendingImportData = null;
    });

    // Backup Generation (Export ALL)
    document.getElementById('btn-export-all').addEventListener('click', async () => {
        try {
            showToast('Generating system backup...', 'info');
            const data = await exportAll();

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

    // Expose media modal globally
    window.openMediaModal = openMediaModal;

    // Media Modal bindings
    const manageRoomMediaBtn = document.getElementById('btn-manage-room-media');
    if (manageRoomMediaBtn) manageRoomMediaBtn.addEventListener('click', () => { state.currentContext = 'room'; openMediaModal(); });
    
    const manageTransMediaBtn = document.getElementById('btn-manage-trans-media');
    if (manageTransMediaBtn) manageTransMediaBtn.addEventListener('click', () => { state.currentContext = 'transition'; openMediaModal(); });
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('media-modal').classList.add('hidden');
        state.mediaPickerCallback = null;
    });
    document.getElementById('btn-confirm-media').addEventListener('click', confirmMediaSelection);

    // Form inputs and validation bindings (realtime export JSON reflection)
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

    // Main sync world wrapper
    async function syncWorldData() {
        const list = document.getElementById('rooms-list');
        if (list) list.innerHTML = '<div class="loading">Establishing data link...</div>';
        try {
            const data = await fetchWorld();
            state.roomsData = data.rooms;
            state.transitionTypes = data.transition_types || {};
            state.imageIndex = data.image_index || { rooms: {}, transitions: {} };
            state.allInteractables = data.interactables || {};
            state.systemTaxonomy = data.taxonomy || [];
            
            try {
                const audioData = await getAudio();
                state.audioLibrary = audioData.library || [];
                state.audioMappings = audioData.mappings || [];
            } catch (ae) {
                console.warn("Failed to fetch audio mappings", ae);
            }
            
            // Re-render based on active hash
            const currentView = (window.location.hash.replace('#', '') || 'dashboard').split('?')[0];
            switchView(currentView, renderCallbacks);
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
            if (list) list.innerHTML = '<div class="error">System Offline. Check PHP & SQLite.</div>';
        }
    }

    // Perform initial synchronization
    syncWorldData().then(async () => {
        const mData = await fetchMedia();
        state.mediaLibrary = mData;

        // Final routing initialization
        const initialView = (window.location.hash.replace('#', '') || 'dashboard').split('?')[0];
        switchView(initialView, renderCallbacks);
    });
});
