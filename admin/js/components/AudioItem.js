// AudioItem component to display library tracks with preview, duration, inline renaming, and delete buttons
import { el, icon } from '../dom.js';

export class AudioItem {
    constructor(a, onPreview, onDelete, onRename) {
        this.a = a;
        this.onPreview = onPreview;
        this.onDelete = onDelete;
        this.onRename = onRename;
        this.isEditing = false;
        this.container = null;
    }

    render() {
        const container = el('div', { 
            className: 'audio-item',
            id: `audio-item-${this.a.id}`
        });

        this.container = container;
        this.renderContent();
        return container;
    }

    renderContent() {
        const container = this.container;
        container.innerHTML = '';

        if (this.isEditing) {
            const input = el('input', {
                type: 'text',
                className: 'audio-rename-input',
                value: this.a.filename,
                style: 'flex: 1; padding: 4px 8px; font-size: 0.85rem; height: 32px;'
            });

            const btnSave = el('button', {
                className: 'btn-cfg',
                style: 'width: 32px; height: 32px; color: var(--success); border-color: rgba(16, 185, 129, 0.3); padding: 0; display: flex; align-items: center; justify-content: center;',
                onClick: async () => {
                    const newName = input.value.trim();
                    if (newName && newName !== this.a.filename) {
                        const success = await this.onRename(this.a.id, newName);
                        if (success) {
                            this.a.filename = newName;
                        }
                    }
                    this.isEditing = false;
                    this.renderContent();
                }
            }, [icon('check')]);

            const btnCancel = el('button', {
                className: 'btn-cfg',
                style: 'width: 32px; height: 32px; color: var(--error); border-color: rgba(239, 68, 68, 0.3); padding: 0; display: flex; align-items: center; justify-content: center;',
                onClick: () => {
                    this.isEditing = false;
                    this.renderContent();
                }
            }, [icon('x')]);

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') btnSave.click();
                if (e.key === 'Escape') btnCancel.click();
            });

            container.appendChild(input);
            container.appendChild(btnSave);
            container.appendChild(btnCancel);
            
            setTimeout(() => input.focus(), 50);
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Standard Content
        const playBtn = el('button', {
            className: 'audio-play-btn',
            'data-audio-id': this.a.id,
            onClick: () => this.onPreview(this.a.id, this.a.filepath)
        }, [icon('play')]);

        const durationSpan = el('span', { 
            className: 'audio-duration',
            'data-audio-id': this.a.id
        }, '0.0s');
        
        // Fetch duration on load
        const audio = new Audio('../' + this.a.filepath);
        audio.preload = 'metadata';
        audio.addEventListener('loadedmetadata', () => {
            let seconds = audio.duration;
            if (!isNaN(seconds) && isFinite(seconds)) {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                const ms = Math.floor((seconds % 1) * 10);
                let text = '';
                if (mins > 0) {
                    text = `${mins}:${secs.toString().padStart(2, '0')}`;
                } else {
                    text = `${secs}.${ms}s`;
                }
                durationSpan.textContent = text;
                durationSpan.dataset.originalDuration = text;
            }
        });

        const infoDiv = el('div', { className: 'audio-info' }, [
            el('span', { className: 'audio-name' }, this.a.filename),
            el('div', { style: 'display: flex; gap: 10px; align-items: center;' }, [
                el('span', { className: 'audio-meta' }, this.a.category || 'sfx'),
                durationSpan
            ])
        ]);

        const renameBtn = el('button', {
            className: 'btn-remove-tiny audio-rename-btn',
            style: 'margin-left: auto; color: var(--text-muted);',
            onClick: () => {
                this.isEditing = true;
                this.renderContent();
            }
        }, [icon('pencil')]);

        const deleteBtn = el('button', {
            className: 'btn-remove-tiny audio-delete-btn',
            style: 'color: var(--error); opacity: 0.7;',
            onClick: () => this.onDelete(this.a.id)
        }, [icon('trash-2')]);

        container.appendChild(playBtn);
        container.appendChild(infoDiv);
        container.appendChild(renameBtn);
        container.appendChild(deleteBtn);
        
        if (window.lucide) lucide.createIcons();
    }
}
