/**
 * TERMINAL INTERACTION SYSTEM (PROTOTYPE)
 * Handles simulated terminal input/output and choices.
 */

const TerminalSystem = {
    isTyping: false,
    terminalTextEl: null,
    terminalContainer: null,
    terminalHistoryEl: null,
    currentState: "INITIAL",
    history: [], // Stores last 3 messages
    dialogueTree: {},

    async init() {
        this.terminalTextEl = document.getElementById('terminal-text');
        this.terminalContainer = document.getElementById('terminal-line-container');
        this.terminalHistoryEl = document.getElementById('terminal-history');

        if (!this.terminalContainer || !this.terminalTextEl) return;

        // Load dialogue tree from JSON
        try {
            const response = await fetch('terminal_dialogue.json');
            this.dialogueTree = await response.json();
        } catch (err) {
            console.error("Failed to load terminal dialogue:", err);
            this.dialogueTree = { "INITIAL": { text: "SYSTEM ERROR: DIALOGUE DATA MISSING.", options: [] } };
        }

        // Enable clicks on the terminal container
        this.terminalContainer.style.pointerEvents = 'auto';
        this.terminalContainer.style.cursor = 'pointer';

        this.terminalContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isTyping) return;

            // Prioritize interaction with the currently displayed Atmospheric Text if it has a linked dialogue
            if (window.game && window.game.state && window.game.state.activeAtmosphericText) {
                const atm = window.game.state.activeAtmosphericText;
                // If it's an object with dialogue_id and that ID exists in our loaded tree
                if (atm && typeof atm === 'object' && atm.dialogue_id) {
                    if (this.dialogueTree[atm.dialogue_id]) {
                        this.currentState = atm.dialogue_id;
                        this.showChoices(this.currentState);
                        return;
                    } else {
                        console.warn(`Terminal Dialogue ID ${atm.dialogue_id} not found in tree.`);
                    }
                }
            }

            this.showChoices(this.currentState);
        });

        // Hide menu if clicked anywhere else
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.terminal-choice-menu') && !e.target.closest('#terminal-line-container')) {
                this.hideChoices();
            }
        });

        // Listen for interactions with other elements (buttons, etc.)
        document.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('terminal-choice-btn')) {
                this.hideChoices();
            }
        });

        // Close on reset
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.hideChoices();
                this.currentState = "INITIAL";
                this.history = [];
                this.renderHistory();
            });
        }

        // Initial welcome
        this.typeResponse("TERMINAL INITIALIZED. CLICK TO INTERACT.");
    },

    setExpanded(isExpanded) {
        if (isExpanded) {
            this.terminalContainer.classList.add('expanded');
        } else {
            // Only collapse if not typing and no menu is shown
            const menu = document.getElementById('terminal-choice-menu');
            if (!this.isTyping && !menu) {
                this.terminalContainer.classList.remove('expanded');
            }
        }
    },

    hideChoices() {
        const existingMenu = document.getElementById('terminal-choice-menu');
        if (existingMenu) existingMenu.remove();
        this.setExpanded(false);
    },

    showChoices(stateId = "INITIAL") {
        this.setExpanded(true);
        const state = this.dialogueTree[stateId] || this.dialogueTree["INITIAL"];

        // Remove existing choice menu if any
        const existingMenu = document.getElementById('terminal-choice-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'terminal-choice-menu';
        menu.className = 'terminal-choice-menu';

        if (state.options) {
            state.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'terminal-choice-btn';
                btn.innerText = opt.label;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    this.handleChoice(opt);
                    menu.remove();
                };
                menu.appendChild(btn);
            });
        }

        // Add to body near the terminal or as an overlay
        document.body.appendChild(menu);

        // Position relative to terminal container (below it)
        const rect = this.terminalContainer.getBoundingClientRect();
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.left = rect.left + 'px';
        menu.style.width = rect.width + 'px';
    },

    handleChoice(option) {
        // Move current system message to history before showing choice
        const prevResponse = this.terminalTextEl.innerText;
        if (prevResponse) this.addToHistory(prevResponse);

        // Add the choice to history before showing response
        this.addToHistory("> " + option.label);
        this.terminalTextEl.innerText = ""; // Clear current line for typing

        setTimeout(() => {
            this.currentState = option.next;
            const nextState = this.dialogueTree[this.currentState];
            if (nextState) {
                this.typeResponse(nextState.text, () => {
                    // Auto-show choices for a smoother "conversation" feel
                    setTimeout(() => {
                        this.showChoices(this.currentState);
                    }, 300);
                });
            }
        }, 500);
    },

    addToHistory(text) {
        this.history.push(text);
        if (this.history.length > 2) { // max 2 history lines + 1 current typing line = 3 total
            this.history.shift();
        }
        this.renderHistory();
    },

    renderHistory() {
        if (!this.terminalHistoryEl) return;
        this.terminalHistoryEl.innerHTML = "";
        this.history.forEach(line => {
            const div = document.createElement('div');
            div.className = 'terminal-history-line';
            div.innerText = line;
            this.terminalHistoryEl.appendChild(div);
        });
    },

    typeResponse(text, callback) {
        this.isTyping = true;
        this.setExpanded(true);
        this.terminalTextEl.innerText = "";
        let i = 0;

        const type = () => {
            if (i < text.length) {
                this.terminalTextEl.innerText = text.substring(0, i + 1) + "_";
                i++;
                setTimeout(type, 30);
            } else {
                this.terminalTextEl.innerText = text;
                this.isTyping = false;

                // After typing complete, move this message to history if next is planned
                // (Actually, we'll move it when the NEXT message starts typing)

                if (callback) {
                    callback();
                } else {
                    // If no callback (no menu/next message), collapse after a breather
                    setTimeout(() => this.setExpanded(false), 2000);
                }
            }
        };
        type();
    }
};

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
    TerminalSystem.init();
});
