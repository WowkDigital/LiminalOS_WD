// TextConfigRow component to edit localized dialogue and sanity thresholds safely
import { el, icon } from '../dom.js';

export class TextConfigRow {
    constructor(item = {}, onRemove) {
        this.item = item;
        this.onRemove = onRemove;
    }

    render() {
        const content = typeof this.item === 'string' ? this.item : (this.item.text || '');
        const sMin = this.item.sanity_min !== undefined ? this.item.sanity_min : 0;
        const sMax = this.item.sanity_max !== undefined ? this.item.sanity_max : 100;
        const dId = this.item.dialogue_id || '';

        const textInput = el('input', {
            type: 'text',
            className: 'text-content',
            value: content,
            placeholder: 'Atmospheric text line...',
            required: true
        });

        const removeBtn = el('button', {
            type: 'button',
            className: 'btn-remove btn-remove-compact',
            onClick: this.onRemove,
            title: 'Remove line'
        }, [icon('trash-2', { style: { width: '14px', height: '14px' } })]);

        const sanityMinInput = el('input', {
            type: 'number',
            className: 'text-smin',
            value: sMin,
            min: '0',
            max: '100',
            placeholder: 'Min'
        });

        const sanityMaxInput = el('input', {
            type: 'number',
            className: 'text-smax',
            value: sMax,
            min: '0',
            max: '100',
            placeholder: 'Max'
        });

        const dialogIdInput = el('input', {
            type: 'text',
            className: 'text-did',
            value: dId,
            placeholder: 'Dialogue ID'
        });

        const row = el('div', {
            className: 'text-config-row'
        }, [
            textInput,
            el('div', { className: 'text-config-param' }, [
                el('span', { className: 'param-prefix' }, 'S:'),
                sanityMinInput,
                el('span', { className: 'param-range-sep' }, '-'),
                sanityMaxInput
            ]),
            el('div', { className: 'text-config-param id-param' }, [
                el('span', { className: 'param-prefix' }, 'ID:'),
                dialogIdInput
            ]),
            removeBtn
        ]);

        return row;
    }
}
