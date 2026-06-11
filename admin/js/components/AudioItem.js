// AudioItem component to display library tracks with preview and delete buttons
import { el, icon } from '../dom.js';

export class AudioItem {
    constructor(a, onPreview, onDelete) {
        this.a = a;
        this.onPreview = onPreview;
        this.onDelete = onDelete;
    }

    render() {
        return el('div', { className: 'audio-item' }, [
            el('button', {
                className: 'audio-play-btn',
                onClick: () => this.onPreview(this.a.filepath)
            }, [icon('play')]),
            el('div', { className: 'audio-info' }, [
                el('span', { className: 'audio-name' }, this.a.filename),
                el('span', { className: 'audio-meta' }, this.a.category || 'sfx')
            ]),
            el('button', {
                className: 'btn-remove-tiny audio-delete-btn',
                onClick: () => this.onDelete(this.a.id)
            }, [icon('trash-2')])
        ]);
    }
}
