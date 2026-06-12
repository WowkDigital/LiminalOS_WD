// Reusable SearchBox component for LiminalOS Admin Panel
import { el, icon } from '../dom.js';

export class SearchBox {
    /**
     * @param {Object} options
     * @param {string} [options.placeholder='Search...'] - Placeholder text
     * @param {function(string)} options.onSearch - Callback function called on search input changes
     * @param {string} [options.initialValue=''] - Initial value of search input
     * @param {string} [options.className=''] - Additional CSS classes for the container
     */
    constructor(options = {}) {
        this.placeholder = options.placeholder || 'Search...';
        this.onSearch = options.onSearch || (() => {});
        this.initialValue = options.initialValue || '';
        this.className = options.className || '';
        this.inputEl = null;
        this.clearBtn = null;
        this.containerEl = null;
    }

    render() {
        this.inputEl = el('input', {
            type: 'text',
            className: 'search-input',
            placeholder: this.placeholder,
            value: this.initialValue,
            onInput: (e) => this.handleInput(e.target.value),
            onKeyDown: (e) => {
                if (e.key === 'Escape') {
                    this.clear();
                }
            }
        });

        this.clearBtn = el('button', {
            type: 'button',
            className: `search-clear-btn ${this.initialValue ? '' : 'hidden'}`,
            title: 'Clear search',
            onClick: () => this.clear()
        }, [icon('x', { style: { width: '14px', height: '14px' } })]);

        const searchIcon = el('span', { className: 'search-icon-wrap' }, [
            icon('search', { style: { width: '16px', height: '16px' } })
        ]);

        this.containerEl = el('div', {
            className: `search-box-container ${this.className}`
        }, [
            searchIcon,
            this.inputEl,
            this.clearBtn
        ]);

        // Trigger Lucide icons creation if available
        setTimeout(() => {
            if (window.lucide) {
                window.lucide.createIcons({
                    attrs: {
                        'stroke-width': 2
                    }
                });
            }
        }, 0);

        return this.containerEl;
    }

    handleInput(value) {
        if (value) {
            this.clearBtn.classList.remove('hidden');
        } else {
            this.clearBtn.classList.add('hidden');
        }
        this.onSearch(value.toLowerCase().trim());
    }

    getValue() {
        return this.inputEl ? this.inputEl.value.trim() : '';
    }

    setValue(val) {
        if (this.inputEl) {
            this.inputEl.value = val;
            this.handleInput(val);
        }
    }

    clear() {
        if (this.inputEl) {
            this.inputEl.value = '';
            this.handleInput('');
            this.inputEl.focus();
        }
    }
}
