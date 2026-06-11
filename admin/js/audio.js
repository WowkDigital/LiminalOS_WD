// SFX and BGM mappings logic
import { state } from './state.js';
import { showToast } from './ui.js';
import { getAudio, deleteAudio, saveAudioMapping, uploadMedia } from './api.js';

export async function fetchAudioData() {
    try {
        const data = await getAudio();
        state.audioLibrary = data.library || [];
        state.audioMappings = data.mappings || [];
        renderAudioLibrary();
        renderAudioMappings();
    } catch (e) {
        console.error(e);
        showToast('Failed to fetch audio data', 'error');
    }
}

export function switchSfxTab(tab) {
    state.currentSfxTab = tab;
    document.querySelectorAll('[data-sfx-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sfx-tab') === tab);
    });
    document.querySelectorAll('.sfx-tab-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== `sfx-tab-${tab}`);
    });
    renderAudioMappings();
}

export function renderAudioLibrary() {
    const list = document.getElementById('audio-items-list');
    const searchInput = document.getElementById('audio-search');
    if (!list || !searchInput) return;

    const search = searchInput.value.toLowerCase();
    list.innerHTML = '';

    const filtered = state.audioLibrary.filter(a => a.filename.toLowerCase().includes(search));
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

export async function handleAudioUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    showToast(`Digitizing ${files.length} audio samples...`, 'info');

    let successCount = 0;
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', state.currentSfxTab);
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
    const container = document.getElementById(`${state.currentSfxTab}-mapping-list`);
    if (!container) return;
    container.innerHTML = '';

    let contexts = [];
    if (state.currentSfxTab === 'bgm') {
        contexts = Object.keys(state.roomsData).map(id => ({ id, label: state.roomsData[id].name }));
    } else if (state.currentSfxTab === 'states') {
        Object.entries(state.allInteractables).forEach(([iid, data]) => {
            (data.states || []).forEach(s => {
                contexts.push({ id: `${iid}.${s.id}`, label: `${data.label} (${s.id})` });
            });
        });
    } else if (state.currentSfxTab === 'transitions') {
        const transSet = new Set();
        Object.values(state.transitionTypes).forEach(list => {
            list.forEach(t => {
                if (!transSet.has(t.id)) {
                    transSet.add(t.id);
                    contexts.push({ id: t.id, label: t.label });
                }
            });
        });
    } else if (state.currentSfxTab === 'ui') {
        contexts = [
            { id: 'btn_click', label: 'Button Click' },
            { id: 'view_transition', label: 'View Transition' },
            { id: 'view_arrival', label: 'View Arrival' },
            { id: 'glitch', label: 'Glitch Effect' }
        ];
    }

    contexts.forEach(ctx => {
        const mapping = state.audioMappings.find(m => m.mapping_type === state.currentSfxTab && m.context_id === ctx.id) || {};
        const row = document.createElement('div');
        row.className = 'mapping-row';

        const options = state.audioLibrary.map(a => `<option value="${a.id}" ${mapping.audio_file_id == a.id ? 'selected' : ''}>${a.filename}</option>`).join('');

        row.innerHTML = `
            <div class="mapping-context">${ctx.label}</div>
            <select class="mapping-select" onchange="window.updateMapping('${state.currentSfxTab}', '${ctx.id}', this.value)">
                <option value="">None / Procedural</option>
                ${options}
            </select>
            <div class="mapping-volume">
                <i data-lucide="volume-2"></i>
                <input type="range" min="0" max="1" step="0.1" value="${mapping.volume || 0.5}" onchange="window.updateMappingVolume('${state.currentSfxTab}', '${ctx.id}', this.value)">
            </div>
            <div class="mapping-loop">
                <input type="checkbox" ${mapping.loop ? 'checked' : ''} onchange="window.updateMappingLoop('${state.currentSfxTab}', '${ctx.id}', this.checked)">
            </div>
        `;
        container.appendChild(row);
    });
    if (window.lucide) lucide.createIcons();
}

// Global window event bindings for audio controls
window.previewAudio = (path) => {
    const audio = new Audio('../' + path);
    audio.play();
};

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

window.updateMapping = async (type, contextId, audioId) => {
    const mapping = { mapping_type: type, context_id: contextId, audio_file_id: audioId };
    const existing = state.audioMappings.find(m => m.mapping_type === type && m.context_id === contextId) || {};
    mapping.volume = existing.volume || 0.5;
    mapping.loop = existing.loop || 0;

    try {
        const result = await saveAudioMapping(mapping);
        if (result.success) {
            const data = await getAudio();
            state.audioMappings = data.mappings || [];
        }
    } catch (e) {
        showToast('Failed to save mapping', 'error');
    }
};

window.updateMappingVolume = async (type, contextId, volume) => {
    const existing = state.audioMappings.find(m => m.mapping_type === type && m.context_id === contextId);
    if (!existing) return;
    existing.volume = volume;
    await window.updateMapping(type, contextId, existing.audio_file_id);
};

window.updateMappingLoop = async (type, contextId, loop) => {
    const existing = state.audioMappings.find(m => m.mapping_type === type && m.context_id === contextId);
    if (!existing) return;
    existing.loop = loop ? 1 : 0;
    await window.updateMapping(type, contextId, existing.audio_file_id);
};
