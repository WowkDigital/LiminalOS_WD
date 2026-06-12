// SFX and BGM mappings logic using ES6 Components
import { state } from './state.js';
import { showToast } from './ui.js';
import { getAudio, deleteAudio, renameAudio, saveAudioMapping, uploadMedia } from './api.js';
import { el } from './dom.js';
import { AudioItem } from './components/AudioItem.js';
import { MappingRow } from './components/MappingRow.js';
import { SearchBox } from './components/SearchBox.js';

let currentPreviewAudio = null;
let currentPreviewId = null;
let audioSearchBox = null;

export async function fetchAudioData() {
    try {
        const data = await getAudio();
        state.audioLibrary = data.library || [];
        state.audioMappings = data.mappings || [];
        renderAudioLibrary();
        renderAudioMappings();
        setupAccordionBehavior();
    } catch (e) {
        console.error(e);
        showToast('Failed to fetch audio data', 'error');
    }
}

export function switchSfxTab(tab) {
    // Legacy support: expand the corresponding accordion card
    const card = document.getElementById(`sfx-sec-${tab}`);
    if (card) {
        document.querySelectorAll('.sfx-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function setupAccordionBehavior() {
    document.querySelectorAll('.sfx-card.collapsible .sfx-card-header').forEach(header => {
        if (header.dataset.accordionBound) return;
        header.dataset.accordionBound = 'true';
        header.addEventListener('click', () => {
            const card = header.parentElement;
            card.classList.toggle('active');
        });
    });
}

export function renderAudioLibrary() {
    const list = document.getElementById('audio-items-list');
    if (!list) return;

    const searchContainer = document.getElementById('audio-search-container');
    if (searchContainer && !searchContainer.querySelector('.search-box-container')) {
        searchContainer.innerHTML = '';
        audioSearchBox = new SearchBox({
            placeholder: 'Search audio library...',
            initialValue: state.audioSearchQuery || '',
            onSearch: (query) => {
                state.audioSearchQuery = query;
                renderAudioLibrary();
            }
        });
        searchContainer.appendChild(audioSearchBox.render());
    }

    const search = (state.audioSearchQuery || '').toLowerCase();
    list.innerHTML = '';

    const filtered = state.audioLibrary.filter(a => a.filename.toLowerCase().includes(search));
    filtered.forEach(a => {
        const itemComponent = new AudioItem(
            a, 
            window.previewAudio, 
            window.deleteAudioItem,
            window.renameAudioItem
        );
        list.appendChild(itemComponent.render());
    });

    const counter = document.getElementById('library-count-meta');
    if (counter) {
        counter.textContent = `(${filtered.length} files)`;
    }

    if (window.lucide) lucide.createIcons();
}

export async function handleAudioUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    showToast(`Digitizing ${files.length} audio samples...`, 'info');

    let successCount = 0;
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'sfx');
        try {
            const result = await uploadMedia(formData);
            if (result.success) successCount++;
            else console.error(`Upload failed for ${file.name}:`, result.error);
        } catch (err) {
            console.error(`Fetch error for ${file.name}:`, err);
        }
    }

    if (successCount > 0) {
        showToast(`Task Complete: ${successCount}/${files.length} audio assets indexed.`, 'success');
        await fetchAudioData();
    } else {
        showToast('Audio ingest sequence failed.', 'error');
    }
    e.target.value = '';
}

export function renderAudioMappings() {
    const categories = ['bgm', 'states', 'transitions', 'ui'];
    categories.forEach(category => {
        const container = document.getElementById(`${category}-mapping-list`);
        if (!container) return;
        container.innerHTML = '';

        let contexts = [];
        if (category === 'bgm') {
            contexts = Object.keys(state.roomsData).map(id => ({ id, label: state.roomsData[id].name }));
        } else if (category === 'states') {
            Object.entries(state.allInteractables).forEach(([iid, data]) => {
                (data.states || []).forEach(s => {
                    contexts.push({ id: `${iid}.${s.id}`, label: `${data.label} (${s.id})` });
                });
            });
        } else if (category === 'transitions') {
            const transSet = new Set();
            Object.values(state.transitionTypes).forEach(list => {
                list.forEach(t => {
                    if (!transSet.has(t.id)) {
                        transSet.add(t.id);
                        contexts.push({ id: t.id, label: t.label });
                    }
                });
            });
        } else if (category === 'ui') {
            contexts = [
                { id: 'btn_click', label: 'Button Click' },
                { id: 'view_transition', label: 'View Transition' },
                { id: 'view_arrival', label: 'View Arrival' },
                { id: 'glitch', label: 'Glitch Effect' }
            ];
        }

        contexts.forEach(ctx => {
            const key = `${category}:${ctx.id}`;
            const pending = state.pendingAudioMappings && state.pendingAudioMappings[key];
            const isModified = !!pending;

            const mapping = state.audioMappings.find(m => m.mapping_type === category && m.context_id === ctx.id) || {};
            const activeMapping = isModified ? { ...mapping, ...pending } : mapping;

            const rowComponent = new MappingRow(
                ctx,
                activeMapping,
                state.audioLibrary,
                category,
                isModified,
                window.stageMappingChange,
                window.saveMappingRow
            );
            container.appendChild(rowComponent.render());
        });
    });
    if (window.lucide) lucide.createIcons();
}

// Global window event bindings for audio controls
export function stopPreview() {
    if (currentPreviewAudio) {
        currentPreviewAudio.pause();
        currentPreviewAudio = null;
    }
    
    // Reset all play buttons
    document.querySelectorAll('.audio-play-btn').forEach(btn => {
        btn.innerHTML = '';
        btn.appendChild(el('i', { 'data-lucide': 'play' }));
    });
    
    // Reset all duration spans
    document.querySelectorAll('.audio-duration').forEach(span => {
        if (span.dataset.originalDuration) {
            span.textContent = span.dataset.originalDuration;
        }
    });
    
    currentPreviewId = null;
    if (window.lucide) lucide.createIcons();
}

window.previewAudio = (id, path) => {
    if (currentPreviewId === id) {
        stopPreview();
        return;
    }

    stopPreview();

    const audio = new Audio('../' + path);
    currentPreviewAudio = audio;
    currentPreviewId = id;

    // Find all play buttons for this audio ID and change their icon to square
    document.querySelectorAll(`.audio-play-btn[data-audio-id="${id}"]`).forEach(btn => {
        btn.innerHTML = '';
        btn.appendChild(el('i', { 'data-lucide': 'square' }));
    });
    if (window.lucide) lucide.createIcons();

    audio.addEventListener('timeupdate', () => {
        const current = formatSecs(audio.currentTime);
        const duration = formatSecs(audio.duration || 0);
        
        // Find all duration spans for this audio ID and update them
        document.querySelectorAll(`.audio-duration[data-audio-id="${id}"]`).forEach(span => {
            span.textContent = `${current} / ${duration}`;
        });
    });

    audio.addEventListener('ended', () => {
        stopPreview();
    });

    audio.play().catch(err => {
        console.error("Audio playback error", err);
        showToast('Playback failed', 'error');
        stopPreview();
    });
};

function formatSecs(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0.0';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}.${ms}s`;
}

window.deleteAudioItem = async (id) => {
    if (!confirm("Delete this audio asset?")) return;
    try {
        const result = await deleteAudio(id);
        if (result.success) {
            showToast('Audio deleted', 'success');
            await fetchAudioData();
        } else throw new Error(result.error);
    } catch (e) {
        showToast('Delete failed: ' + e.message, 'error');
    }
};

window.renameAudioItem = async (id, newFilename) => {
    try {
        const result = await renameAudio(id, newFilename);
        if (result.success) {
            showToast('Audio renamed', 'success');
            await fetchAudioData();
            return true;
        } else {
            throw new Error(result.error || 'Rename operation failed');
        }
    } catch (e) {
        showToast('Rename failed: ' + e.message, 'error');
        return false;
    }
};

window.stageMappingChange = (category, contextId, field, value) => {
    if (!state.pendingAudioMappings) {
        state.pendingAudioMappings = {};
    }
    const key = `${category}:${contextId}`;
    if (!state.pendingAudioMappings[key]) {
        const existing = state.audioMappings.find(m => m.mapping_type === category && m.context_id === contextId) || {};
        state.pendingAudioMappings[key] = {
            mapping_type: category,
            context_id: contextId,
            audio_file_id: existing.audio_file_id !== undefined ? existing.audio_file_id : null,
            volume: existing.volume !== undefined ? existing.volume : 0.5,
            loop: existing.loop !== undefined ? existing.loop : 0
        };
    }

    const pending = state.pendingAudioMappings[key];
    if (field === 'audio_file_id') {
        pending.audio_file_id = value ? parseInt(value) : null;
    } else if (field === 'volume') {
        pending.volume = parseFloat(value);
    } else if (field === 'loop') {
        pending.loop = value ? 1 : 0;
    }

    // Compare with database state. If no difference, clear the pending entry
    const existing = state.audioMappings.find(m => m.mapping_type === category && m.context_id === contextId) || {};
    const dbAudioFileId = existing.audio_file_id !== undefined ? existing.audio_file_id : null;
    const dbVolume = existing.volume !== undefined ? existing.volume : 0.5;
    const dbLoop = existing.loop !== undefined ? existing.loop : 0;

    if (
        pending.audio_file_id == dbAudioFileId &&
        Math.abs(pending.volume - dbVolume) < 0.01 &&
        pending.loop == dbLoop
    ) {
        delete state.pendingAudioMappings[key];
    }

    renderAudioMappings();
};

window.saveMappingRow = async (category, contextId) => {
    const key = `${category}:${contextId}`;
    if (!state.pendingAudioMappings || !state.pendingAudioMappings[key]) return;

    const mapping = state.pendingAudioMappings[key];
    try {
        const result = await saveAudioMapping(mapping);
        if (result.success) {
            delete state.pendingAudioMappings[key];
            showToast('Mapping updated', 'success');
            const data = await getAudio();
            state.audioMappings = data.mappings || [];
            renderAudioMappings();
        } else {
            showToast('Failed to save mapping: ' + result.error, 'error');
        }
    } catch (e) {
        showToast('Failed to save mapping', 'error');
    }
};
