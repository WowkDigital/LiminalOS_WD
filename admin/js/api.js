// API Client logic for the LiminalOS Admin Panel

export async function fetchWorld() {
    const res = await fetch('api.php');
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
}

export async function fetchMedia() {
    const res = await fetch('api.php?action=media');
    if (!res.ok) throw new Error('Failed to fetch media');
    return res.json();
}

export async function uploadMedia(formData) {
    const res = await fetch('api.php?action=upload_media', {
        method: 'POST',
        body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
}

export async function assignMedia(mediaId, type, contextId) {
    const res = await fetch('api.php?action=assign_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: mediaId, type, context_id: contextId, tags: 'assigned' })
    });
    if (!res.ok) throw new Error('Assign failed');
    return res.json();
}

export async function deleteMedia(id) {
    const res = await fetch('api.php?action=delete_media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error('Delete media failed');
    return res.json();
}

export async function importRooms(rooms) {
    const res = await fetch('api.php?action=import_rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms })
    });
    if (!res.ok) throw new Error('Rooms import failed');
    return res.json();
}

export async function importTransitions(transitions) {
    const res = await fetch('api.php?action=import_transitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transitions })
    });
    if (!res.ok) throw new Error('Transitions import failed');
    return res.json();
}

export async function previewImport(data) {
    const res = await fetch('api.php?action=preview_import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Import preview failed');
    return res.json();
}

export async function importAll(data) {
    const res = await fetch('api.php?action=import_all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Full import failed');
    return res.json();
}

export async function exportAll() {
    const res = await fetch('api.php?action=export_all');
    if (!res.ok) throw new Error('Export failed');
    return res.json();
}

export async function saveRoom(roomId, roomData) {
    const res = await fetch('api.php?action=save_room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: roomId, room: roomData })
    });
    if (!res.ok) throw new Error('Save room failed');
    return res.json();
}

export async function deleteRoom(id) {
    const res = await fetch('api.php?action=delete_room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error('Delete room failed');
    return res.json();
}

export async function saveTransition(transId, transData) {
    const res = await fetch('api.php?action=save_transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transId, transition: transData })
    });
    if (!res.ok) throw new Error('Save transition failed');
    return res.json();
}

export async function deleteTransition(id) {
    const res = await fetch('api.php?action=delete_transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error('Delete transition failed');
    return res.json();
}

export async function saveInteractable(id, interactableData) {
    const res = await fetch('api.php?action=save_interactable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, interactable: interactableData })
    });
    if (!res.ok) throw new Error('Save interactable failed');
    return res.json();
}

export async function deleteInteractable(id) {
    const res = await fetch('api.php?action=delete_interactable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error('Delete interactable failed');
    return res.json();
}

export async function getTaxonomy() {
    const res = await fetch('api.php?action=get_taxonomy');
    if (!res.ok) throw new Error('Get taxonomy failed');
    return res.json();
}

export async function saveTaxonomyItem(type, label) {
    const res = await fetch('api.php?action=save_taxonomy_item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, label })
    });
    if (!res.ok) throw new Error('Save taxonomy failed');
    return res.json();
}

export async function deleteTaxonomyItem(type, label) {
    const res = await fetch('api.php?action=delete_taxonomy_item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, label })
    });
    if (!res.ok) throw new Error('Delete taxonomy failed');
    return res.json();
}

export async function getAudio() {
    const res = await fetch('api.php?action=get_audio');
    if (!res.ok) throw new Error('Get audio data failed');
    return res.json();
}

export async function deleteAudio(id) {
    const res = await fetch('api.php?action=delete_audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error('Delete audio failed');
    return res.json();
}

export async function renameAudio(id, filename) {
    const res = await fetch('api.php?action=rename_audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, filename })
    });
    if (!res.ok) throw new Error('Rename audio failed');
    return res.json();
}

export async function saveAudioMapping(mapping) {
    const res = await fetch('api.php?action=save_audio_mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping })
    });
    if (!res.ok) throw new Error('Save audio mapping failed');
    return res.json();
}
