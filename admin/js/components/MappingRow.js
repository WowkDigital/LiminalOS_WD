// MappingRow component to render SFX/BGM to context mapping settings safely
import { el, icon } from '../dom.js';

export class MappingRow {
    constructor(ctx, mapping, audioLibrary, currentSfxTab, onChangeFile, onChangeVolume, onChangeLoop) {
        this.ctx = ctx;
        this.mapping = mapping;
        this.audioLibrary = audioLibrary;
        this.currentSfxTab = currentSfxTab;
        this.onChangeFile = onChangeFile;
        this.onChangeVolume = onChangeVolume;
        this.onChangeLoop = onChangeLoop;
    }

    render() {
        const options = [
            el('option', { value: '' }, 'None / Procedural')
        ];

        this.audioLibrary.forEach(a => {
            const opt = el('option', { value: a.id }, a.filename);
            if (this.mapping.audio_file_id == a.id) {
                opt.setAttribute('selected', 'selected');
            }
            options.push(opt);
        });

        const select = el('select', {
            className: 'mapping-select',
            onChange: (e) => this.onChangeFile(this.currentSfxTab, this.ctx.id, e.target.value)
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
            onChange: (e) => this.onChangeVolume(this.currentSfxTab, this.ctx.id, e.target.value)
        });

        const loopCheck = el('input', {
            type: 'checkbox',
            onChange: (e) => this.onChangeLoop(this.currentSfxTab, this.ctx.id, e.target.checked)
        });
        if (this.mapping.loop) {
            loopCheck.setAttribute('checked', 'checked');
        }

        return el('div', { className: 'mapping-row' }, [
            el('div', { className: 'mapping-context' }, this.ctx.label),
            select,
            playBtn,
            el('div', { className: 'mapping-volume' }, [
                icon('volume-2'),
                range
            ]),
            el('div', { className: 'mapping-loop' }, [
                loopCheck
            ])
        ]);
    }
}
