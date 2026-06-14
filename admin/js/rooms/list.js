// Rooms list rendering and integrity logic
import { state } from '../state.js';
import { getThumbPath, showToast, getCategoryIcon } from '../ui.js';
import { navigate } from '../router.js';
import { el, icon } from '../dom.js';
import { RoomCard } from '../components/RoomCard.js';
import { SearchBox } from '../components/SearchBox.js';

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
