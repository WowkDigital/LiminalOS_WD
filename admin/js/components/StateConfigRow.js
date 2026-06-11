// StateConfigRow component to manage object state models
import { el, icon } from '../dom.js';

export class StateConfigRow {
    constructor(item = {}, onRemove, onSelectImage) {
        this.item = item;
        this.onRemove = onRemove;
        this.onSelectImage = onSelectImage;
    }

    render() {
        const idInput = el('input', {
            type: 'text',
            name: 'state_id[]',
            value: this.item.id || '',
            placeholder: 'e.g. on',
            required: true,
            style: { padding: '8px 12px', fontSize: '0.9rem' }
        });

        const descTextarea = el('textarea', {
            name: 'state_desc[]',
            rows: '2',
            placeholder: 'State description...',
            style: { padding: '8px 12px', fontSize: '0.9rem', minHeight: '60px', resize: 'vertical' }
        });
        descTextarea.textContent = this.item.desc || '';

        const imageInput = el('input', {
            type: 'text',
            name: 'state_image[]',
            value: this.item.image || '',
            placeholder: 'No asset selected...',
            readOnly: true,
            style: { padding: '8px 12px', fontSize: '0.85rem', flex: '1' }
        });

        const previewImg = el('img', {
            src: this.item.image ? '../' + this.item.image : '',
            className: this.item.image ? '' : 'hidden',
            style: { maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }
        });

        const noImagePlaceholder = el('div', {
            className: this.item.image ? 'hidden' : 'no-image',
            style: { fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }
        }, 'No Asset');

        const selectBtn = el('button', {
            type: 'button',
            className: 'btn-secondary',
            style: { padding: '8px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap' },
            onClick: () => this.onSelectImage(imageInput, previewImg, noImagePlaceholder)
        }, 'Pick Image');

        return el('div', {
            className: 'state-config-card'
        }, [
            el('div', { className: 'state-card-header' }, [
                el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
                    icon('sliders', { style: { width: '14px', height: '14px', color: 'var(--accent-primary)' } }),
                    el('span', { style: { fontWeight: '600', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' } }, 'STATE CONFIG')
                ]),
                el('button', {
                    type: 'button',
                    className: 'btn-remove btn-remove-compact',
                    onClick: this.onRemove,
                    title: 'Remove state'
                }, [icon('trash-2', { style: { width: '14px', height: '14px' } })])
            ]),
            
            el('div', { className: 'state-card-body' }, [
                el('div', { className: 'state-card-fields' }, [
                    el('div', { className: 'form-group compact' }, [
                        el('label', { className: 'compact-label' }, 'State ID'),
                        idInput
                    ]),
                    el('div', { className: 'form-group compact' }, [
                        el('label', { className: 'compact-label' }, 'Description'),
                        descTextarea
                    ])
                ]),
                el('div', { className: 'state-card-media' }, [
                    el('label', { className: 'compact-label' }, 'Visual Asset'),
                    el('div', { className: 'media-picker-row-compact' }, [
                        imageInput,
                        selectBtn
                    ]),
                    el('div', { className: 'state-image-preview-compact' }, [
                        previewImg,
                        noImagePlaceholder
                    ])
                ])
            ])
        ]);
    }
}
