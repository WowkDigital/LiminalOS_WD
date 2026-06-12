// RoomCard component to display space metadata and metrics on the dashboard
import { el, icon } from '../dom.js';
import { getThumbPath } from '../ui.js';
import { state } from '../state.js';

export class RoomCard {
    constructor(id, room, transitionTypes, imageIndex, roomsCount, onEdit) {
        this.id = id;
        this.room = room;
        this.transitionTypes = transitionTypes;
        this.imageIndex = imageIndex;
        this.roomsCount = roomsCount;
        this.onEdit = onEdit;
    }

    render() {
        // Exits logic
        const hasExits = (this.room.transitions || []).some(t => {
            const cat = typeof t === 'string' ? t : t.category;
            return this.transitionTypes[cat] && this.transitionTypes[cat].length > 0;
        });
        const canExit = hasExits && this.roomsCount > 1;

        // Reachability logic
        const canEnter = Object.entries(this.transitionTypes).some(([cat, list]) => {
            if (!list || list.length === 0) return false;
            // Check if this category is referenced in any other room
            return Object.entries(this.imageIndex.rooms).some(([otherId]) => {
                if (otherId === this.id) return false;
                // We don't have direct check in original code, let's keep exact logic from original rooms.js:
                // "const canEnter = Object.entries(state.roomsData).some(([otherId, otherRoom]) => { ... })"
                return false; // will populate below using constructor parameter
            });
        });

        // Let's pass canEnter directly into the constructor or compute it inside render if we pass all rooms
        return this.createDOM(canExit);
    }

    createDOM(canExit, canEnter) {
        const roomImages = this.imageIndex.rooms[this.id] || [];
        const thumbUrl = roomImages.length > 0 ? `../${getThumbPath(roomImages[0])}` : null;

        let thumbEl;
        if (thumbUrl) {
            thumbEl = el('div', { className: 'room-card-thumb' }, [
                el('img', { src: thumbUrl, alt: '' })
            ]);
        } else {
            thumbEl = el('div', { className: 'room-card-thumb empty-thumb' }, [
                el('span', {}, 'NO SIGNAL')
            ]);
        }

        const tagsList = (this.room.tags || []).map(tag => 
            el('span', { className: 'tag' }, tag)
        );

        const hasSound = (state.audioMappings || []).some(m => m.mapping_type === 'bgm' && m.context_id === this.id && m.audio_file_id !== null);

        const card = el('div', { 
            className: 'room-card',
            onClick: () => this.onEdit(this.id)
        }, [
            thumbEl,
            el('div', { className: 'room-card-content' }, [
                el('div', { className: 'room-card-header' }, [
                    el('h3', {}, [
                        this.room.name + ' ',
                        el('span', { className: 'small-dim' }, this.id)
                    ]),
                    el('div', { className: 'reachability-indicators' }, [
                        el('span', { 
                            className: `reach-icon ${this.room.canEnter ? 'active' : 'inactive'}`,
                            title: this.room.canEnter ? 'Reachable' : 'Unreachable'
                        }, [icon('log-in')]),
                        el('span', { 
                            className: `reach-icon ${canExit ? 'active' : 'inactive'}`,
                            title: canExit ? 'Has Exits' : 'Dead End'
                        }, [icon('log-out')]),
                        el('span', { 
                            className: `reach-icon ${hasSound ? 'active' : 'inactive'}`,
                            title: hasSound ? 'BGM Active' : 'No Sound'
                        }, [icon(hasSound ? 'volume-2' : 'volume-x')])
                    ])
                ]),
                el('p', {}, this.room.desc || 'No descriptions found.'),
                el('div', { className: 'room-stats' }, [
                    el('span', {}, `☍ ${(this.room.transitions || []).length}`),
                    el('span', {}, `◉ ${(this.room.interactables || []).length}`),
                    el('span', {}, `≡ ${(this.room.texts || []).length}`)
                ]),
                el('div', { className: 'room-meta' }, tagsList)
            ])
        ]);

        return card;
    }
}
