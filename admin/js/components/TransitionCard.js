// TransitionCard component to display liminal paths in the transitions overview
import { el } from '../dom.js';
import { getCategoryColor, getThumbPath } from '../ui.js';

export class TransitionCard {
    constructor(trans, imageIndex, onClick) {
        this.trans = trans;
        this.imageIndex = imageIndex;
        this.onClick = onClick;
    }

    render() {
        const transImages = this.imageIndex.transitions[this.trans.id] || [];
        const thumbUrl = transImages.length > 0 ? `../${getThumbPath(transImages[0])}` : null;

        let thumbEl;
        if (thumbUrl) {
            thumbEl = el('div', { className: 'room-card-thumb' }, [
                el('img', { src: thumbUrl, alt: '' })
            ]);
        } else {
            thumbEl = el('div', { className: 'room-card-thumb empty-thumb' }, [
                el('span', {}, 'NO DATA')
            ]);
        }

        const catColor = getCategoryColor(this.trans.cat);

        return el('div', {
            className: 'room-card',
            onClick: () => this.onClick(this.trans.id)
        }, [
            thumbEl,
            el('div', { className: 'room-card-content' }, [
                el('h3', {}, [
                    this.trans.label + ' ',
                    el('span', { className: 'small-dim' }, this.trans.id)
                ]),
                el('p', {}, [
                    'Category: ',
                    el('strong', { style: { color: catColor } }, this.trans.cat)
                ]),
                el('div', { className: 'room-meta' }, 
                    (this.trans.tags || []).map(tag => el('span', { className: 'tag' }, tag))
                )
            ])
        ]);
    }
}
