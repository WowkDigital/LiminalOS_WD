/**
 * TERMINAL INTERACTION SYSTEM (MODERNIZED)
 * Handles simulated terminal input/output, interactive typing prompt, and choices.
 */

const TerminalSystem = {
    isTyping: false,
    terminalTextEl: null,
    terminalContainer: null,
    terminalHistoryEl: null,
    terminalInputEl: null,
    terminalOptionsEl: null,
    currentState: "INITIAL",
    history: [], // Stores last few commands/responses
    dialogueTree: {},
    activeChoices: [], // Currently shown options

    async init() {
        this.terminalTextEl = document.getElementById('terminal-text');
        this.terminalContainer = document.getElementById('terminal-line-container');
        this.terminalHistoryEl = document.getElementById('terminal-history');
        this.terminalInputEl = document.getElementById('terminal-input');
        this.terminalOptionsEl = document.getElementById('terminal-options-list');

        if (!this.terminalContainer || !this.terminalTextEl || !this.terminalInputEl || !this.terminalOptionsEl) return;

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
        this.terminalContainer.style.cursor = 'text';

        this.terminalContainer.addEventListener('click', (e) => {
            if (e.target.closest('.terminal-option-item')) return; // let option click handle itself
            e.stopPropagation();
            this.focusInput();
        });

        // Setup input events
        this.terminalInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = this.terminalInputEl.value.trim();
                if (val) {
                    this.handleInput(val);
                }
                this.terminalInputEl.value = "";
            } else if (e.key === 'Escape') {
                this.blurInput();
            }
        });

        // Hide input/menu if clicked anywhere else
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#terminal-line-container')) {
                this.blurInput();
            }
        });

        // Listen for interactions with other elements (buttons, etc.) to hide choices
        document.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' && !e.target.closest('#terminal-line-container')) {
                this.blurInput();
            }
        });

        // Close on reset
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.currentState = "INITIAL";
                this.history = [];
                this.activeChoices = [];
                this.renderHistory();
                this.renderOptions([]);
                this.blurInput();
            });
        }

        // Initial welcome
        this.typeResponse("TERMINAL INITIALIZED. CLICK TO ENTER COMMANDS.");
    },

    focusInput() {
        if (this.isTyping) return;
        this.terminalContainer.classList.add('focused');
        this.terminalContainer.classList.add('expanded');
        this.terminalInputEl.focus();
        this.showActiveDialogueOptions();
    },

    blurInput() {
        this.terminalContainer.classList.remove('focused');
        // Only collapse if no active dialogue choices
        if (!this.activeChoices.length) {
            this.terminalContainer.classList.remove('expanded');
        }
        this.terminalInputEl.blur();
    },

    showActiveDialogueOptions() {
        let stateId = this.currentState;

        // Prioritize atmospheric text linked dialogue
        if (window.game && window.game.state && window.game.state.activeAtmosphericText) {
            const atm = window.game.state.activeAtmosphericText;
            if (atm && typeof atm === 'object' && atm.dialogue_id && this.dialogueTree[atm.dialogue_id]) {
                stateId = atm.dialogue_id;
            }
        }

        const state = this.dialogueTree[stateId] || this.dialogueTree["INITIAL"];
        this.activeChoices = state.options || [];
        this.renderOptions(this.activeChoices);
    },

    renderOptions(options) {
        this.terminalOptionsEl.innerHTML = "";
        if (!options || options.length === 0) {
            return;
        }

        options.forEach((opt, index) => {
            const item = document.createElement('div');
            item.className = 'terminal-option-item';
            item.innerHTML = `<span class="opt-num">[${index + 1}]</span> ${opt.label.toUpperCase()}`;
            item.onclick = (e) => {
                e.stopPropagation();
                this.selectChoice(opt);
            };
            this.terminalOptionsEl.appendChild(item);
        });
    },

    selectChoice(option) {
        // Add current prompt response to history
        const prevText = this.terminalTextEl.innerText;
        if (prevText) this.addToHistory(prevText);

        // Add selected option label to history
        this.addToHistory("> " + option.label.toUpperCase());
        this.terminalTextEl.innerText = "";

        this.currentState = option.next;
        const nextState = this.dialogueTree[this.currentState];
        if (nextState) {
            this.typeResponse(nextState.text, () => {
                this.showActiveDialogueOptions();
            });
        }
    },

    handleInput(inputVal) {
        const rawCmd = inputVal.trim();
        const cmd = rawCmd.toUpperCase();

        // 1. Add current command to history
        this.addToHistory("> " + rawCmd);

        // 2. If dialogue options are active and input is a number:
        const num = parseInt(cmd);
        if (!isNaN(num) && num > 0 && num <= this.activeChoices.length) {
            const picked = this.activeChoices[num - 1];
            this.selectChoice(picked);
            return;
        }

        // 3. Or if input matches option text directly:
        const matchedOption = this.activeChoices.find(opt => opt.label.toUpperCase() === cmd);
        if (matchedOption) {
            this.selectChoice(matchedOption);
            return;
        }

        // 4. Otherwise, parse standard terminal commands:
        if (cmd === 'HELP' || cmd === '?') {
            this.typeResponse("COMMANDS: HELP, GO [EXIT], ACT [ITEM] [STATE], MAP, SANITY, CLEAR, RESET");
        } else if (cmd === 'CLEAR' || cmd === 'CLS') {
            this.history = [];
            this.renderHistory();
            this.typeResponse("TERMINAL HISTORY CLEARED.");
        } else if (cmd === 'RESET') {
            if (confirm("REBOOT SYSTEM? ALL SESSION DATA WILL BE WIPED.")) {
                localStorage.removeItem('backrooms_session');
                location.reload();
            }
        } else if (cmd === 'MAP') {
            const mapPanel = document.getElementById('map-panel');
            if (mapPanel && window.game && window.game.mapGraph) {
                mapPanel.classList.toggle('collapsed');
                if (!mapPanel.classList.contains('collapsed')) {
                    window.game.mapGraph.update();
                    this.typeResponse("MAP INTERFACE ACTIVATED.");
                } else {
                    this.typeResponse("MAP INTERFACE DEACTIVATED.");
                }
            } else {
                this.typeResponse("MAP SYSTEM OFFLINE.");
            }
        } else if (cmd === 'SANITY') {
            const sanity = window.game ? window.game.state.sanity : 100;
            const barWidth = Math.round(sanity / 10);
            const bar = "[" + "=".repeat(barWidth) + " ".repeat(10 - barWidth) + "]";
            let level = "STABLE";
            if (sanity < 30) level = "CRITICAL";
            else if (sanity < 60) level = "UNSTABLE";

            this.typeResponse(`SANITY STATUS: ${bar} ${Math.floor(sanity)}% | LEVEL: ${level}`);
        } else if (cmd.startsWith('GO ') || cmd.startsWith('MOVE ')) {
            const exitLabel = rawCmd.substring(cmd.indexOf(' ')).trim().toUpperCase();
            if (window.game) {
                const exits = window.game.getCurrentLocation().getActions();
                // Match by exit label or room name
                const found = exits.find(e => 
                    e.label.toUpperCase().includes(exitLabel) || 
                    (e.extra && window.game.world.rooms[e.extra] && window.game.world.rooms[e.extra].name.toUpperCase().includes(exitLabel))
                );
                if (found) {
                    this.typeResponse(`INITIATING SPACE VECTOR SHIFT TO: ${found.label.toUpperCase()}...`);
                    setTimeout(() => {
                        window.game.handleAction('tra', found.id, found.extra);
                    }, 500);
                } else {
                    this.typeResponse(`PATH ERROR: TRANSITION DIRECTIVE '${exitLabel}' BLOCKED OR INVALID.`);
                }
            } else {
                this.typeResponse("NAVIGATION ENGINE OFFLINE.");
            }
        } else if (cmd.startsWith('ACT ') || cmd.startsWith('USE ')) {
            const params = rawCmd.substring(cmd.indexOf(' ')).trim().split(' ');
            const interSearch = params[0].toUpperCase();
            const stateSearch = params.slice(1).join(' ').toUpperCase();

            if (window.game) {
                const loc = window.game.getCurrentLocation();
                const interIds = loc.getInteractables();
                let foundInterId = null;
                let foundInteractable = null;

                for (const id of interIds) {
                    const item = window.game.world.interactables[id];
                    if (item && item.label.toUpperCase().includes(interSearch)) {
                        foundInterId = id;
                        foundInteractable = item;
                        break;
                    }
                }

                if (foundInteractable) {
                    if (stateSearch) {
                        const stateIdx = foundInteractable.states.findIndex(s => (s.label || s.id).toUpperCase().includes(stateSearch));
                        if (stateIdx !== -1) {
                            this.typeResponse(`COMMAND EXECUTED: ${foundInteractable.label.toUpperCase()} STATE -> ${stateSearch}`);
                            setTimeout(() => {
                                window.game.handleAction('act', foundInterId, stateIdx);
                            }, 500);
                        } else {
                            const statesStr = foundInteractable.states.map(s => (s.label || s.id).toUpperCase()).join(', ');
                            this.typeResponse(`STATE ERROR: VALID STATES FOR ${foundInteractable.label.toUpperCase()}: ${statesStr}`);
                        }
                    } else {
                        // Cycle if no state specified
                        this.typeResponse(`CYCLING CONTROL MATRIX FOR: ${foundInteractable.label.toUpperCase()}`);
                        setTimeout(() => {
                            window.game.handleAction('act', foundInterId, null);
                        }, 500);
                    }
                } else {
                    this.typeResponse(`OBJECT ERROR: TARGET '${interSearch}' NOT IDENTIFIED IN LOCAL VIEW.`);
                }
            } else {
                this.typeResponse("CONTROL SYSTEM OFFLINE.");
            }
        } else {
            // Invalid command / fallback
            this.typeResponse(`SYNTAX ERROR: COMMAND '${cmd}' NOT FOUND. TYPE 'HELP' FOR DETAILS.`);
        }
    },

    addToHistory(text) {
        this.history.push(text);
        if (this.history.length > 3) {
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
        this.terminalHistoryEl.scrollTop = this.terminalHistoryEl.scrollHeight;
    },

    typeResponse(text, callback) {
        if (window.game) {
            // Forward typing animation to the game to use its glitchy visual typing animation
            window.game.typeTerminalText(text, callback);
        } else {
            // Fallback typing animation
            this.isTyping = true;
            this.terminalTextEl.innerText = "";
            let i = 0;
            const type = () => {
                if (i < text.length) {
                    this.terminalTextEl.innerText = text.substring(0, i + 1) + "_";
                    i++;
                    setTimeout(type, 20);
                } else {
                    this.terminalTextEl.innerText = text;
                    this.isTyping = false;
                    if (callback) callback();
                }
            };
            type();
        }
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    TerminalSystem.init();
});
