// MediaCard component to display uploaded graphics and usage tags
import { el } from '../dom.js';
import { getThumbPath } from '../ui.js';

export class MediaCard {
    constructor(item, onDelete) {
        this.item = item;
        this.onDelete = onDelete;
    }

    render() {
        const usageText = this.item.context_type !== 'none'
            ? `Used in: ${this.item.context_type.charAt(0).toUpperCase() + this.item.context_type.slice(1)} (${this.item.context_id})`
            : 'Not assigned to any record';

        const tags = this.item.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        const isInteractable = this.item.context_type === 'interactable';
        const isRoom = this.item.context_type === 'room';
        const isTransition = this.item.context_type === 'transition';

        const isAssigned = tags.includes('assigned') || isInteractable || isRoom || isTransition;
        const filteredTags = tags.filter(t => t !== 'assigned');

        const tagsChildren = [];
        if (isAssigned) {
            tagsChildren.push(el('span', { className: 'tag assigned' }, 'assigned'));
        }
        if (isInteractable) tagsChildren.push(el('span', { className: 'tag assigned' }, 'Interactable'));
        if (isRoom) tagsChildren.push(el('span', { className: 'tag assigned' }, 'Location'));
        if (isTransition) tagsChildren.push(el('span', { className: 'tag assigned' }, 'Transition'));

        filteredTags.forEach(t => {
            tagsChildren.push(el('span', { className: 'tag' }, t));
        });

        return el('div', { className: 'media-card' }, [
            el('div', { className: 'media-thumb' }, [
                el('img', { src: `../${getThumbPath(this.item.filepath)}`, alt: '' }),
                el('button', {
                    className: 'btn-delete-small',
                    onClick: (e) => {
                        e.stopPropagation();
                        this.onDelete(this.item.id);
                    }
                }, '×')
            ]),
            el('div', { className: 'media-info' }, [
                el('div', { className: 'media-filename' }, this.item.filename),
                el('div', { className: 'small-dim usage-info' }, usageText),
                el('div', { className: 'media-tags' }, tagsChildren)
            ])
        ]);
    }
}
