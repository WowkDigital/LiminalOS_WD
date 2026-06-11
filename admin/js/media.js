// Media management and modal controller logic
import { state } from './state.js';
import { getThumbPath, showToast } from './ui.js';
import { fetchMedia, uploadMedia, assignMedia, deleteMedia as apiDeleteMedia, fetchWorld } from './api.js';
import { renderRoomMediaPreview } from './rooms.js';
import { renderTransMediaPreview } from './transitions.js';

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

        const thumb = document.createElement('div');
        thumb.className = `selectable-thumb ${isSelected ? 'selected' : ''}`;
        thumb.dataset.id = m.id;
        thumb.innerHTML = `<img src="../${getThumbPath(m.filepath)}">`;
        thumb.onclick = () => {
            if (state.mediaPickerCallback) {
                document.querySelectorAll('.selectable-thumb').forEach(t => t.classList.remove('selected'));
                thumb.classList.add('selected');
            } else {
                thumb.classList.toggle('selected');
            }
        };
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
