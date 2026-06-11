// TextConfigRow component to edit localized dialogue and sanity thresholds safely
import { el } from '../dom.js';

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
            placeholder: 'Atmospheric line...',
            style: { flexGrow: '1' }
        });

        const removeBtn = el('button', {
            type: 'button',
            className: 'btn-remove',
            onClick: this.onRemove
        }, 'X');

        const sanityMinInput = el('input', {
            type: 'number',
            className: 'text-smin',
            value: sMin,
            min: '0',
            max: '100',
            style: {
                width: '100%',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid #555',
                color: '#fff',
                padding: '4px',
                borderRadius: '4px'
            }
        });

        const sanityMaxInput = el('input', {
            type: 'number',
            className: 'text-smax',
            value: sMax,
            min: '0',
            max: '100',
            style: {
                width: '100%',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid #555',
                color: '#fff',
                padding: '4px',
                borderRadius: '4px'
            }
        });

        const dialogIdInput = el('input', {
            type: 'text',
            className: 'text-did',
            value: dId,
            placeholder: 'None',
            style: {
                width: '100%',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid #555',
                color: '#fff',
                padding: '4px',
                borderRadius: '4px'
            }
        });

        return el('div', {
            className: 'text-config-row',
            style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                padding: '10px',
                border: '1px solid #333',
                marginBottom: '10px',
                background: 'rgba(255,255,255,0.05)'
            }
        }, [
            el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, [
                textInput,
                removeBtn
            ]),
            el('div', {
                style: {
                    display: 'flex',
                    gap: '10px',
                    fontSize: '0.8em',
                    color: '#aaa',
                    marginTop: '5px'
                }
            }, [
                el('div', { style: { flex: '1' } }, [
                    'Sanity Min: ',
                    sanityMinInput
                ]),
                el('div', { style: { flex: '1' } }, [
                    'Sanity Max: ',
                    sanityMaxInput
                ]),
                el('div', { style: { flex: '2' } }, [
                    'Dialog ID: ',
                    dialogIdInput
                ])
            ])
        ]);
    }
}
