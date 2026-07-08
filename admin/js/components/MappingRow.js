// MappingRow component to render SFX/BGM to context mapping settings safely
import { el, icon } from '../dom.js';

export class MappingRow {
    constructor(ctx, mapping, audioLibrary, currentSfxTab, isModified, onChange, onSave) {
        this.ctx = ctx;
        this.mapping = mapping;
        this.audioLibrary = audioLibrary;
        this.currentSfxTab = currentSfxTab;
        this.isModified = isModified;
        this.onChange = onChange;
        this.onSave = onSave;
    }

    render() {
        const options = [
            el('option', { value: '' }, 'None / Procedural')
        ];

        this.audioLibrary.forEach(a => {
            const opt = el('option', { value: a.id, selected: this.mapping.audio_file_id == a.id }, a.filename);
            options.push(opt);
        });

        const select = el('select', {
            className: 'mapping-select',
            onChange: (e) => this.onChange(this.currentSfxTab, this.ctx.id, 'audio_file_id', e.target.value)
        }, options);

        // Preview button next to dropdown
        const selectedAudio = this.audioLibrary.find(a => a.id == this.mapping.audio_file_id);
        let playBtn;
        if (selectedAudio) {
            playBtn = el('button', {
                className: 'audio-play-btn',
                'data-audio-id': selectedAudio.id,
                onClick: () => window.previewAudio(selectedAudio.id, selectedAudio.filepath),
                style: 'flex-shrink: 0;'
            }, [icon('play')]);
        } else {
            // Empty placeholder to keep grid layout aligned
            playBtn = el('div', { style: 'width: 32px; height: 32px; flex-shrink: 0;' });
        }

        const range = el('input', {
            type: 'range',
            min: '0',
            max: '1',
            step: '0.1',
            value: this.mapping.volume !== undefined ? this.mapping.volume : '0.5',
            onChange: (e) => this.onChange(this.currentSfxTab, this.ctx.id, 'volume', e.target.value)
        });

        const loopCheck = el('input', {
            type: 'checkbox',
            checked: !!this.mapping.loop,
            onChange: (e) => this.onChange(this.currentSfxTab, this.ctx.id, 'loop', e.target.checked),
            title: 'Loop sound (repeat infinitely)'
        });

        const saveBtn = el('button', {
            className: `mapping-save-btn${this.isModified ? ' unsaved' : ''}`,
            disabled: !this.isModified,
            onClick: () => {
                if (this.isModified) this.onSave(this.currentSfxTab, this.ctx.id);
            },
            title: this.isModified ? 'Save changes to this mapping' : 'No changes'
        }, [icon('save')]);

        const loopLabel = el('label', {
            className: 'mapping-loop',
            style: 'display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; margin: 0;'
        }, [
            loopCheck,
            el('span', { style: 'font-size: 0.75rem; color: var(--text-secondary);' }, 'Loop')
        ]);

        return el('div', { className: `mapping-row${this.isModified ? ' modified' : ''}` }, [
            el('div', { className: 'mapping-context' }, this.ctx.label),
            select,
            playBtn,
            el('div', { className: 'mapping-volume' }, [
                icon('volume-2'),
                range
            ]),
            loopLabel,
            saveBtn
        ]);
    }
}
