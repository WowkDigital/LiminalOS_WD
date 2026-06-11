// Media management and modal controller logic using ES6 Components
import { state } from './state.js';
import { getThumbPath, showToast } from './ui.js';
import { fetchMedia, uploadMedia, assignMedia, deleteMedia as apiDeleteMedia, fetchWorld } from './api.js';
import { renderRoomMediaPreview } from './rooms.js';
import { renderTransMediaPreview } from './transitions.js';
import { el } from './dom.js';
import { MediaCard } from './components/MediaCard.js';

export function renderMediaLibrary() {
    const list = document.getElementById('media-list');
    if (!list) return;
    const search = document.getElementById('media-search').value.toLowerCase();
    const filter = document.getElementById('media-filter-type').value;

    list.innerHTML = '';

    const filtered = state.mediaLibrary.filter(item => {
        const matchesSearch = item.filename.toLowerCase().includes(search) ||
            item.tags.toLowerCase().includes(search) ||
            item.context_id.toLowerCase().includes(search);
        const matchesFilter = filter === 'all' || item.context_type === filter;
        return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
        list.appendChild(el('div', { className: 'empty' }, 'No matching records in the library.'));
        return;
    }

    filtered.forEach(item => {
        const cardComponent = new MediaCard(item, window.deleteMedia);
        list.appendChild(cardComponent.render());
    });
}

export function openMediaModal() {
    if (!state.currentEditId) {
        let input = null;
        if (state.currentContext === 'room') input = document.getElementById('room-id');
        if (state.currentContext === 'transition') input = document.getElementById('trans-id');
        if (state.currentContext === 'interactable') input = document.getElementById('inter-id');

        if (input && input.value.trim()) {
            state.currentEditId = input.value.trim();
        }
    }

    if (!state.currentEditId) {
        showToast('Enter a Unique ID first to manage media for new records.', 'error');
        return;
    }
    const modal = document.getElementById('media-modal');
    modal.classList.remove('hidden');
    document.querySelector('.modal-header h3').innerText = 'Select Graphics';
    state.mediaPickerCallback = null;
    renderModalMediaList();
}

export function renderModalMediaList() {
    const list = document.getElementById('modal-media-list');
    if (!list) return;
    list.innerHTML = '';
    state.mediaLibrary.forEach(m => {
        let isSelected = false;
        if (!state.mediaPickerCallback) {
            isSelected = m.context_type === state.currentContext && m.context_id === state.currentEditId;
        }

        const thumb = el('div', { 
            className: `selectable-thumb ${isSelected ? 'selected' : ''}`
        }, [
            el('img', { src: `../${getThumbPath(m.filepath)}` })
        ]);
        thumb.dataset.id = m.id;
        
        thumb.addEventListener('click', () => {
            if (state.mediaPickerCallback) {
                document.querySelectorAll('.selectable-thumb').forEach(t => t.classList.remove('selected'));
                thumb.classList.add('selected');
            } else {
                thumb.classList.toggle('selected');
            }
        });
        
        list.appendChild(thumb);
    });
}

export async function confirmMediaSelection() {
    const thumbs = document.querySelectorAll('.selectable-thumb');
    const currentSelectedInUI = Array.from(thumbs).filter(t => t.classList.contains('selected')).map(t => parseInt(t.dataset.id));

    if (state.mediaPickerCallback) {
        if (currentSelectedInUI.length > 0) {
            const selectedMedia = state.mediaLibrary.find(m => m.id === currentSelectedInUI[0]);
            state.mediaPickerCallback(selectedMedia);
        }
        state.mediaPickerCallback = null;
        document.getElementById('media-modal').classList.add('hidden');
        return;
    }

    const promises = [];
    state.mediaLibrary.forEach(m => {
        const isNowSelected = currentSelectedInUI.includes(m.id);
        const wasAssigned = m.context_type === state.currentContext && m.context_id === state.currentEditId;
        if (isNowSelected && !wasAssigned) promises.push(assignMedia(m.id, state.currentContext, state.currentEditId));
        else if (!isNowSelected && wasAssigned) promises.push(assignMedia(m.id, 'none', 'none'));
    });
    await Promise.all(promises);
    document.getElementById('media-modal').classList.add('hidden');
    showToast('Media updated.', 'success');

    const syncRes = await fetchWorld();
    state.roomsData = syncRes.rooms;
    state.transitionTypes = syncRes.transition_types || {};
    state.imageIndex = syncRes.image_index || { rooms: {}, transitions: {} };
    state.allInteractables = syncRes.interactables || {};
    state.systemTaxonomy = syncRes.taxonomy || [];

    const mRes = await fetchMedia();
    state.mediaLibrary = mRes;

    if (state.currentEditId) {
        const views = {
            editor: document.getElementById('view-editor'),
            transEditor: document.getElementById('view-transition-editor')
        };
        if (views.editor.classList.contains('active')) renderRoomMediaPreview();
        if (views.transEditor.classList.contains('active')) renderTransMediaPreview();
    }
}

export async function handleUpload(e) {
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
            const result = await uploadMedia(formData);
            if (result.success) successCount++;
        } catch (err) {
            console.error(`Upload failed for ${file.name}:`, err);
        }
    }

    if (successCount > 0) {
        showToast(`Task Complete: ${successCount}/${files.length} digitized.`, 'success');
        const mRes = await fetchMedia();
        state.mediaLibrary = mRes;
        renderMediaLibrary();
    } else {
        showToast('All upload sequences failed.', 'error');
    }

    e.target.value = '';
}

// Bind deleteMedia globally
window.deleteMedia = async (id) => {
    if (!confirm("Permanently delete this file from storage?")) return;
    try {
        const result = await apiDeleteMedia(id);
        if (result.success) {
            showToast('File erased.', 'success');
            const mRes = await fetchMedia();
            state.mediaLibrary = mRes;
            renderMediaLibrary();
        } else throw new Error(result.error);
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
};
