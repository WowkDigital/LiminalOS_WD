// MediaCard component to display uploaded graphics and usage tags
import { el } from '../dom.js';
import { getThumbPath } from '../ui.js';

export class MediaCard {
    constructor(item, onDelete, onOpenRoom, onOpenTransition) {
        this.item = item;
        this.onDelete = onDelete;
        this.onOpenRoom = onOpenRoom;
        this.onOpenTransition = onOpenTransition;
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
        if (isInteractable) tagsChildren.push(el('span', { className: 'tag context interactable' }, 'Interactable'));
        if (isRoom) tagsChildren.push(el('span', { className: 'tag context room' }, 'Location'));
        if (isTransition) tagsChildren.push(el('span', { className: 'tag context transition' }, 'Transition'));

        filteredTags.forEach(t => {
            tagsChildren.push(el('span', { className: 'tag' }, t));
        });

        // Thumbnail with preview overlay
        const imgSrc = `../${getThumbPath(this.item.filepath)}`;
        const fullSrc = `../${this.item.filepath}`;

        const previewOverlay = el('div', { className: 'media-preview-overlay' }, [
            el('span', { className: 'preview-icon' }, '⤢')
        ]);
        previewOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            window.openMediaLightbox(fullSrc, this.item.filename);
        });

        const deleteBtn = el('button', {
            className: 'btn-delete-small',
            title: 'Delete file',
            onClick: (e) => {
                e.stopPropagation();
                this.onDelete(this.item.id);
            }
        }, '×');

        const thumbDiv = el('div', { className: 'media-thumb' }, [
            el('img', { src: imgSrc, alt: this.item.filename }),
            previewOverlay,
            deleteBtn
        ]);

        // Action buttons for creating/editing records
        const actionBtns = [];

        if (isRoom && this.item.context_id) {
            actionBtns.push(el('button', {
                className: 'media-action-btn',
                title: `Edit room: ${this.item.context_id}`,
                onClick: () => this.onOpenRoom && this.onOpenRoom(this.item.context_id)
            }, '✎ Edit Room'));
        } else if (!isAssigned) {
            actionBtns.push(el('button', {
                className: 'media-action-btn',
                title: 'Create a new Room using this image',
                onClick: () => this.onOpenRoom && this.onOpenRoom(null, this.item.id)
            }, '+ New Room'));
        }

        if (isTransition && this.item.context_id) {
            actionBtns.push(el('button', {
                className: 'media-action-btn',
                title: `Edit transition: ${this.item.context_id}`,
                onClick: () => this.onOpenTransition && this.onOpenTransition(this.item.context_id)
            }, '✎ Edit Transition'));
        } else if (!isAssigned) {
            actionBtns.push(el('button', {
                className: 'media-action-btn',
                title: 'Create a new Transition using this image',
                onClick: () => this.onOpenTransition && this.onOpenTransition(null, this.item.id)
            }, '+ New Transition'));
        }

        return el('div', { className: 'media-card' }, [
            thumbDiv,
            el('div', { className: 'media-info' }, [
                el('div', { className: 'media-filename' }, this.item.filename),
                el('div', { className: 'small-dim usage-info' }, usageText),
                el('div', { className: 'media-tags' }, tagsChildren),
                actionBtns.length > 0 ? el('div', { className: 'media-actions' }, actionBtns) : null
            ].filter(Boolean))
        ]);
    }
}
