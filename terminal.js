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
    history: [], // Stores last few commands/responses as objects { text, type }
    dialogueTree: {},
    activeChoices: [], // Currently shown options
    cmdHistory: [],
    cmdHistoryIndex: -1,
    availableCommands: ['HELP', 'CLEAR', 'CLS', 'RESET', 'MAP', 'SANITY', 'DIAGNOSTICS', 'SYS', 'SCAN', 'PING', 'GO', 'MOVE', 'ACT', 'USE'],
    currentLogType: '', // Current response log type ('success', 'error', 'warning', 'info', '')

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
        this.cmdHistory = [];
        this.cmdHistoryIndex = -1;

        this.terminalInputEl.addEventListener('keydown', (e) => {
            // Play keypress sound
            if (window.game && window.game.audio) {
                window.game.audio.playUiSound('keypress');
            }

            // Low sanity typing glitch
            if (window.game && window.game.state && window.game.state.sanity < 40 && Math.random() < 0.08) {
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    const glitches = "!@#$%^&*()_+-=[]{}|;':\",./<>?/\\░▒▓█";
                    const randChar = glitches[Math.floor(Math.random() * glitches.length)];
                    const start = this.terminalInputEl.selectionStart;
                    const end = this.terminalInputEl.selectionEnd;
                    const val = this.terminalInputEl.value;
                    this.terminalInputEl.value = val.substring(0, start) + randChar + val.substring(end);
                    this.terminalInputEl.selectionStart = this.terminalInputEl.selectionEnd = start + 1;
                    return;
                }
            }

            if (e.key === 'Enter') {
                const val = this.terminalInputEl.value.trim();
                if (val) {
                    this.handleInput(val);
                    if (this.cmdHistory.length === 0 || this.cmdHistory[this.cmdHistory.length - 1] !== val) {
                        this.cmdHistory.push(val);
                    }
                    this.cmdHistoryIndex = this.cmdHistory.length;
                }
                this.terminalInputEl.value = "";
            } else if (e.key === 'Escape') {
                this.blurInput();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.cmdHistory.length > 0) {
                    if (this.cmdHistoryIndex > 0) {
                        this.cmdHistoryIndex--;
                    } else {
                        this.cmdHistoryIndex = 0;
                    }
                    this.terminalInputEl.value = this.cmdHistory[this.cmdHistoryIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.cmdHistory.length > 0) {
                    if (this.cmdHistoryIndex < this.cmdHistory.length - 1) {
                        this.cmdHistoryIndex++;
                        this.terminalInputEl.value = this.cmdHistory[this.cmdHistoryIndex];
                    } else {
                        this.cmdHistoryIndex = this.cmdHistory.length;
                        this.terminalInputEl.value = "";
                    }
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                const val = this.terminalInputEl.value.trim().toUpperCase();
                if (val) {
                    const matches = this.availableCommands.filter(c => c.startsWith(val));
                    if (matches.length === 1) {
                        this.terminalInputEl.value = matches[0] + " ";
                    } else if (matches.length > 1) {
                        this.typeResponse("SUGGESTIONS: " + matches.join(', '), null, 'info');
                        if (window.game && window.game.audio) {
                            window.game.audio.playUiSound('click');
                        }
                    }
                }
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

        // Initial welcome
        this.typeResponse("TERMINAL INITIALIZED. CLICK TO ENTER COMMANDS.", null, 'success');
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
        if (prevText) this.addToHistory(prevText, this.currentLogType);

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

        // Play feedback sounds
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };

        // 4. Otherwise, parse standard terminal commands:
        if (cmd === 'HELP' || cmd === '?') {
            playSuccess();
            this.typeResponse("COMMANDS: HELP, GO [EXIT], ACT [ITEM] [STATE], MAP, SANITY, DIAGNOSTICS, SCAN, CLEAR, RESET", null, 'info');
        } else if (cmd === 'CLEAR' || cmd === 'CLS') {
            this.history = [];
            this.renderHistory();
            this.typeResponse("TERMINAL HISTORY CLEARED.", null, 'success');
            playSuccess();
        } else if (cmd === 'RESET') {
            if (confirm("REBOOT SYSTEM? ALL SESSION DATA WILL BE WIPED.")) {
                localStorage.removeItem('backrooms_session');
                window.location.hash = '';
                location.reload();
            }
        } else if (cmd === 'MAP') {
            const mapPanel = document.getElementById('map-panel');
            if (mapPanel && window.game && window.game.mapGraph) {
                mapPanel.classList.toggle('collapsed');
                if (!mapPanel.classList.contains('collapsed')) {
                    window.game.mapGraph.update();
                    this.typeResponse("MAP INTERFACE ACTIVATED.", null, 'success');
                } else {
                    this.typeResponse("MAP INTERFACE DEACTIVATED.", null, 'warning');
                }
                playSuccess();
            } else {
                this.typeResponse("MAP SYSTEM OFFLINE.", null, 'error');
                playError();
            }
        } else if (cmd === 'SANITY') {
            const sanity = window.game ? window.game.state.sanity : 100;
            const barWidth = Math.round(sanity / 10);
            const bar = "[" + "=".repeat(barWidth) + " ".repeat(10 - barWidth) + "]";
            let level = "STABLE";
            let type = 'success';
            if (sanity < 30) {
                level = "CRITICAL";
                type = 'error';
                playError();
            } else if (sanity < 60) {
                level = "UNSTABLE";
                type = 'warning';
                playError();
            } else {
                playSuccess();
            }

            this.typeResponse(`SANITY STATUS: ${bar} ${Math.floor(sanity)}% | LEVEL: ${level}`, null, type);
        } else if (cmd === 'DIAGNOSTICS' || cmd === 'SYS') {
            if (window.game) {
                playSuccess();
                const sanity = window.game.state.sanity;
                const loc = window.game.getCurrentLocation();
                const explored = window.game.state.visitedRooms.length;
                const total = Object.keys(window.game.world.rooms).length;
                const seedHash = Math.abs(window.game.state.currentRoom.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)) % 10000;
                
                const stats = [
                    "SYSTEM DIAGNOSTICS:",
                    ` - POSITION: ${loc.getName().toUpperCase()}`,
                    ` - VECTOR MATRIX SEED: CMD-0x${seedHash.toString(16).toUpperCase()}`,
                    ` - SANITY LEVEL: ${Math.floor(sanity)}%`,
                    ` - MAPPED AREA: ${explored}/${total} SECTORS REGISTERED`,
                    ` - LOGIC MATRIX LOAD: ${(100 - sanity).toFixed(1)}%`,
                    "SYSTEM INTEGRITY: STABLE"
                ].join("\n");
                
                this.typeResponse(stats, null, 'info');
            } else {
                this.typeResponse("DIAGNOSTICS SERVICE OFFLINE.", null, 'error');
                playError();
            }
        } else if (cmd === 'SCAN' || cmd === 'PING') {
            if (window.game) {
                playSuccess();
                const exits = window.game.getCurrentLocation().getActions();
                if (exits.length === 0) {
                    this.typeResponse("SCANNING SENSORS... NO EXIT VECTORS DETECTED IN THIS VECTOR FIELD.", null, 'warning');
                } else {
                    let lines = ["SCANNING LOCAL SPACE MANIFOLD...", "EXITS DETECTED:"];
                    exits.forEach(e => {
                        const status = e.isUnknown ? "UNKNOWN" : "VISITED";
                        const recommend = e.isRecommended ? " ⭐ [RECOMMENDED]" : "";
                        lines.push(` - ${e.label.toUpperCase()} -> [${status}]${recommend}`);
                    });
                    this.typeResponse(lines.join("\n"), null, 'info');
                }
            } else {
                this.typeResponse("ENVIRONMENTAL SCANNER OFFLINE.", null, 'error');
                playError();
            }
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
                    playSuccess();
                    this.typeResponse(`INITIATING SPACE VECTOR SHIFT TO: ${found.label.toUpperCase()}...`, null, 'success');
                    setTimeout(() => {
                        window.game.handleAction('tra', found.id, found.extra);
                    }, 500);
                } else {
                    this.typeResponse(`PATH ERROR: TRANSITION DIRECTIVE '${exitLabel}' BLOCKED OR INVALID.`, null, 'error');
                    playError();
                }
            } else {
                this.typeResponse("NAVIGATION ENGINE OFFLINE.", null, 'error');
                playError();
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
                            playSuccess();
                            this.typeResponse(`COMMAND EXECUTED: ${foundInteractable.label.toUpperCase()} STATE -> ${stateSearch}`, null, 'success');
                            setTimeout(() => {
                                window.game.handleAction('act', foundInterId, stateIdx);
                            }, 500);
                        } else {
                            const statesStr = foundInteractable.states.map(s => (s.label || s.id).toUpperCase()).join(', ');
                            this.typeResponse(`STATE ERROR: VALID STATES FOR ${foundInteractable.label.toUpperCase()}: ${statesStr}`, null, 'warning');
                            playError();
                        }
                    } else {
                        // Cycle if no state specified
                        playSuccess();
                        this.typeResponse(`CYCLING CONTROL MATRIX FOR: ${foundInteractable.label.toUpperCase()}`, null, 'success');
                        setTimeout(() => {
                            window.game.handleAction('act', foundInterId, null);
                        }, 500);
                    }
                } else {
                    this.typeResponse(`OBJECT ERROR: TARGET '${interSearch}' NOT IDENTIFIED IN LOCAL VIEW.`, null, 'error');
                    playError();
                }
            } else {
                this.typeResponse("CONTROL SYSTEM OFFLINE.", null, 'error');
                playError();
            }
        } else {
            // Invalid command / fallback
            this.typeResponse(`SYNTAX ERROR: COMMAND '${cmd}' NOT FOUND. TYPE 'HELP' FOR DETAILS.`, null, 'error');
            playError();
        }
    },

    addToHistory(text, type = '') {
        this.history.push({ text, type });
        if (this.history.length > 25) {
            this.history.shift();
        }
        this.renderHistory();
    },

    renderHistory() {
        if (!this.terminalHistoryEl) return;
        this.terminalHistoryEl.innerHTML = "";
        this.history.forEach(lineObj => {
            const div = document.createElement('div');
            const type = (typeof lineObj === 'string') ? '' : lineObj.type;
            const text = (typeof lineObj === 'string') ? lineObj : lineObj.text;
            div.className = 'terminal-history-line' + (type ? ' log-' + type : '');
            div.innerText = text;
            this.terminalHistoryEl.appendChild(div);
        });
        this.terminalHistoryEl.scrollTop = this.terminalHistoryEl.scrollHeight;
    },

    typeResponse(text, callback, logType = '') {
        this.currentLogType = logType;
        this.terminalTextEl.className = logType ? 'log-' + logType : '';
        
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
