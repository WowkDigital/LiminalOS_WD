// StateConfigRow component to manage object state models
import { el } from '../dom.js';

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
            required: true
        });

        const descTextarea = el('textarea', {
            name: 'state_desc[]',
            rows: '2',
            placeholder: '...'
        });
        descTextarea.textContent = this.item.desc || '';

        const imageInput = el('input', {
            type: 'text',
            name: 'state_image[]',
            value: this.item.image || '',
            placeholder: 'media/uploads/...',
            readOnly: true
        });

        const previewImg = el('img', {
            src: this.item.image ? '../' + this.item.image : '',
            className: this.item.image ? '' : 'hidden'
        });

        const noImagePlaceholder = el('div', {
            className: this.item.image ? 'hidden' : 'no-image'
        }, 'No Asset Selected');

        const selectBtn = el('button', {
            type: 'button',
            className: 'btn-secondary',
            style: { padding: '10px' },
            onClick: () => this.onSelectImage(imageInput, previewImg, noImagePlaceholder)
        }, 'Select from Library');

        return el('div', {
            className: 'form-section',
            style: { marginBottom: '1rem' }
        }, [
            el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' } }, [
                el('strong', {}, 'State Configuration'),
                el('button', {
                    type: 'button',
                    className: 'btn-remove',
                    style: { width: 'auto', height: 'auto', padding: '4px 8px' },
                    onClick: this.onRemove
                }, 'Remove State')
            ]),
            el('div', { className: 'form-group', style: { marginBottom: '10px' } }, [
                el('label', {}, 'State ID'),
                idInput
            ]),
            el('div', { className: 'form-group', style: { marginBottom: '10px' } }, [
                el('label', {}, 'Description'),
                descTextarea
            ]),
            el('div', { className: 'form-group', style: { marginBottom: '0' } }, [
                el('label', {}, 'Visual Asset'),
                el('div', { className: 'media-picker-row' }, [
                    imageInput,
                    selectBtn
                ]),
                el('div', { className: 'state-image-preview' }, [
                    previewImg,
                    noImagePlaceholder
                ])
            ])
        ]);
    }
}
