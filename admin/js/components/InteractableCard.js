// InteractableCard component to display object entities in the interactive overview
import { el } from '../dom.js';
import { getThumbPath } from '../ui.js';

export class InteractableCard {
    constructor(id, data, onClick) {
        this.id = id;
        this.data = data;
        this.onClick = onClick;
    }

    render() {
        const thumbUrl = this.data.states && this.data.states[0] && this.data.states[0].image 
            ? `../${getThumbPath(this.data.states[0].image)}` 
            : null;
        
        let thumbEl;
        if (thumbUrl) {
            thumbEl = el('div', { className: 'room-card-thumb' }, [
                el('img', { src: thumbUrl, alt: '' })
            ]);
        } else {
            thumbEl = el('div', { className: 'room-card-thumb empty-thumb' }, [
                el('span', {}, 'NO IMAGE')
            ]);
        }

        return el('div', {
            className: 'room-card',
            onClick: () => this.onClick(this.id)
        }, [
            thumbEl,
            el('div', { className: 'room-card-content' }, [
                el('h3', {}, [
                    this.data.label + ' ',
                    el('span', { className: 'small-dim' }, this.id)
                ]),
                el('p', {}, `${this.data.states ? this.data.states.length : 0} states defined.`)
            ])
        ]);
    }
}
