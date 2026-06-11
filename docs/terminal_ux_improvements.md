# Terminal UX/UI Redesign — LiminalOS v5

## Summary of Changes

### 🎨 Visual Redesign

| Feature | Before | After |
|---------|--------|-------|
| **Layout** | Single-line bar with embedded text+input | Structured panel with header, output, input, options sections |
| **Collapsed state** | Plain text line with `>` prompt | Header bar with status dot, title "TERMINAL v2.0", and shortcut hint |
| **Border radius** | 6px (sharp) | 12px (rounded, `--radius-md`) |
| **Background** | `rgba(10,10,10,0.6)` | `rgba(8,8,12,0.75)` with stronger glass effect |
| **Shadow** | Basic soft shadow | Multi-layer shadow with inset highlight |
| **Expand animation** | `max-height` transition | Smooth `max-height: 42px → 70vh` with `cubic-bezier` easing |

### 📋 Terminal Header
- **Status indicator** — Animated dot (🟢 STANDBY → 🟡 ACTIVE → 🔵 PROCESSING → 🔴 ERROR)
- **Title** — "TERMINAL v2.0" centered
- **Hint** — "` / CLICK" shortcut hint (fades when expanded)

### 🖱️ Click/Interaction Improvements

| Interaction | Before | After |
|-------------|--------|-------|
| **Header click** | — | Toggles terminal open/close |
| **Body click (collapsed)** | Expand + focus | Expand terminal |
| **Body click (expanded)** | — | Focus input field |
| **Option click** | Basic handler | Ripple effect animation + delayed selection |
| **Option hover** | Simple color change | Slide-right animation, arrow reveal, badge highlight, sound feedback |
| **Outside click** | Collapse | Collapse + reset state |
| **Keyboard `\`` key** | — | Global terminal toggle shortcut |

### 📝 Information Display

- **Separate output area** — System responses always visible below history, never hidden when typing
- **Structured command output** — Box-drawing characters for HELP, SANITY, DIAGNOSTICS, SCAN
- **Icon-prefixed history** — Each history line has a contextual icon (▸ for user input, ⊟ for system output)
- **User input lines** — Distinguished with amber left-border and bold styling
- **Color-coded messages** — Success (green), Error (red), Warning (amber), Info (blue)
- **History fade-in animation** — New lines slide up smoothly

### 🔘 Option Buttons Redesign

Each option now shows:
```
[1] ◈ STATUS CHECK                    ›
[2] ◉ SCAN ENVIRONMENT                ›
[3] ▤ QUERY ARCHIVE                   ›
```

- **Number key badge** — Clear keyboard shortcut indicator
- **Contextual icon** — Auto-selected based on label (←, ◉, ⚡, →, etc.)
- **Arrow indicator** — Reveals on hover
- **"AVAILABLE ACTIONS" separator** — Subtle labeled divider line
- **Ripple effect** — Material-design-style click feedback
- **Hover sound** — Plays keypress sound on hover

### ⌨️ Command Output Formatting

**HELP** — Box-drawn table:
```
╔══════════════════════════════════════╗
║       TERMINAL COMMAND REFERENCE      ║
╠══════════════════════════════════════╣
║  HELP      — Show this reference      ║
║  GO [EXIT] — Move to an exit           ║
...
╚══════════════════════════════════════╝
```

**SANITY** — Graphical bar:
```
┌─ SANITY REPORT ─────────────────┐
│  LEVEL:  95%
│  STATUS: STABLE
│  ▐████████████████████░░░░▌
└─────────────────────────────────┘
```

**DIAGNOSTICS** — Structured report with dot leaders

**SCAN** — Exit list with status icons (◆ NEW / ◇ KNOWN)

## Files Modified

```diff:terminal.js
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
===
/**
 * TERMINAL INTERACTION SYSTEM (MODERNIZED v2)
 * Handles simulated terminal input/output, interactive typing prompt, and choices.
 * Enhanced UX: Better click targets, structured output, animated options, keyboard nav.
 */

const TerminalSystem = {
    isTyping: false,
    terminalTextEl: null,
    terminalContainer: null,
    terminalHistoryEl: null,
    terminalInputEl: null,
    terminalOptionsEl: null,
    terminalHeaderEl: null,
    currentState: "INITIAL",
    history: [], // Stores last few commands/responses as objects { text, type, icon }
    dialogueTree: {},
    activeChoices: [], // Currently shown options
    cmdHistory: [],
    cmdHistoryIndex: -1,
    availableCommands: ['HELP', 'CLEAR', 'CLS', 'RESET', 'MAP', 'SANITY', 'DIAGNOSTICS', 'SYS', 'SCAN', 'PING', 'GO', 'MOVE', 'ACT', 'USE'],
    currentLogType: '', // Current response log type ('success', 'error', 'warning', 'info', '')
    selectedOptionIndex: -1, // For keyboard navigation of options

    async init() {
        this.terminalTextEl = document.getElementById('terminal-text');
        this.terminalContainer = document.getElementById('terminal-line-container');
        this.terminalHistoryEl = document.getElementById('terminal-history');
        this.terminalInputEl = document.getElementById('terminal-input');
        this.terminalOptionsEl = document.getElementById('terminal-options-list');
        this.terminalHeaderEl = document.getElementById('terminal-header');

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

        this.terminalContainer.addEventListener('click', (e) => {
            if (e.target.closest('.terminal-option-item')) return; // let option click handle itself
            if (e.target === this.terminalInputEl) return; // clicking input is fine
            e.stopPropagation();

            // Header click = always toggle
            if (e.target.closest('.terminal-header')) {
                this.toggleTerminal();
                return;
            }

            // If collapsed, expand
            if (!this.terminalContainer.classList.contains('expanded')) {
                this.expandTerminal();
            } else {
                // Clicking inside expanded body → focus input
                this.terminalInputEl.focus();
            }
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
                this.collapseTerminal();
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
                        this.typeResponse("AUTOCOMPLETE: " + matches.join(' · '), null, 'info', '◈');
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
                this.collapseTerminal();
            }
        });

        // Listen for interactions with other elements (buttons, etc.) to hide choices
        document.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' && !e.target.closest('#terminal-line-container')) {
                this.collapseTerminal();
            }
        });

        // Global keyboard shortcut: backtick (`) to toggle terminal
        document.addEventListener('keydown', (e) => {
            if (e.key === '`' && !e.target.closest('input') && !e.target.closest('textarea')) {
                e.preventDefault();
                this.toggleTerminal();
            }
        });

        // Initial welcome
        this.typeResponse("TERMINAL READY — CLICK TO INTERACT OR TYPE COMMANDS", null, 'success', '✓');
        this.updateHeaderStatus('online');
    },

    toggleTerminal() {
        if (this.terminalContainer.classList.contains('expanded')) {
            this.collapseTerminal();
        } else {
            this.expandTerminal();
        }
    },

    expandTerminal() {
        if (this.isTyping) return;
        this.terminalContainer.classList.add('focused');
        this.terminalContainer.classList.add('expanded');
        this.terminalInputEl.focus();
        this.showActiveDialogueOptions();
        this.updateHeaderStatus('active');
    },

    collapseTerminal() {
        this.terminalContainer.classList.remove('focused');
        this.terminalContainer.classList.remove('expanded');
        this.terminalInputEl.blur();
        this.selectedOptionIndex = -1;
        this.updateHeaderStatus('online');
    },

    // Legacy aliases for compatibility
    focusInput() { this.expandTerminal(); },
    blurInput() { this.collapseTerminal(); },

    updateHeaderStatus(status) {
        if (!this.terminalHeaderEl) return;
        const statusDot = this.terminalHeaderEl.querySelector('.terminal-status-dot');
        const statusText = this.terminalHeaderEl.querySelector('.terminal-status-text');
        if (statusDot) {
            statusDot.className = 'terminal-status-dot status-' + status;
        }
        if (statusText) {
            const labels = { online: 'STANDBY', active: 'ACTIVE', busy: 'PROCESSING', error: 'ERROR' };
            statusText.textContent = labels[status] || 'UNKNOWN';
        }
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
        this.selectedOptionIndex = -1;

        if (!options || options.length === 0) {
            return;
        }

        // Add separator label
        const separator = document.createElement('div');
        separator.className = 'terminal-options-label';
        separator.innerHTML = `<span class="options-label-line"></span><span class="options-label-text">AVAILABLE ACTIONS</span><span class="options-label-line"></span>`;
        this.terminalOptionsEl.appendChild(separator);

        options.forEach((opt, index) => {
            const item = document.createElement('div');
            item.className = 'terminal-option-item';
            item.setAttribute('data-index', index);
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');

            // Determine icon based on option label
            const icon = this._getOptionIcon(opt.label);

            item.innerHTML = `
                <span class="opt-key">${index + 1}</span>
                <span class="opt-icon">${icon}</span>
                <span class="opt-label">${opt.label.toUpperCase()}</span>
                <span class="opt-arrow">›</span>
            `;

            // Click handler with ripple effect
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this._createRipple(item, e);
                setTimeout(() => this.selectChoice(opt), 150);
            });

            // Keyboard handler
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectChoice(opt);
                }
            });

            // Hover sound
            item.addEventListener('mouseenter', () => {
                if (window.game && window.game.audio) {
                    window.game.audio.playUiSound('keypress');
                }
            });

            this.terminalOptionsEl.appendChild(item);
        });
    },

    _getOptionIcon(label) {
        const lbl = label.toUpperCase();
        if (lbl.includes('BACK') || lbl.includes('RETURN')) return '←';
        if (lbl.includes('SCAN') || lbl.includes('ANALYZE') || lbl.includes('VIEW') || lbl.includes('READ')) return '◉';
        if (lbl.includes('STATUS') || lbl.includes('DIAGNOSTICS')) return '◈';
        if (lbl.includes('RESTART') || lbl.includes('REBOOT')) return '↺';
        if (lbl.includes('EXIT') || lbl.includes('EVACUATE') || lbl.includes('ESCAPE')) return '⬡';
        if (lbl.includes('CONTINUE') || lbl.includes('NEXT')) return '→';
        if (lbl.includes('OVERRIDE') || lbl.includes('FORCED')) return '⚡';
        if (lbl.includes('DECODE') || lbl.includes('TRACE')) return '⟁';
        if (lbl.includes('RECORD') || lbl.includes('SAVE') || lbl.includes('LOG')) return '◆';
        if (lbl.includes('QUERY') || lbl.includes('ARCHIVE') || lbl.includes('FRAGMENT')) return '▤';
        if (lbl.includes('DRINK') || lbl.includes('PLAYBACK') || lbl.includes('ATTEMPT')) return '▶';
        if (lbl.includes('STABILIZE') || lbl.includes('GATHER')) return '◇';
        if (lbl.includes('DELETE') || lbl.includes('STOP')) return '✕';
        if (lbl.includes('WANDER') || lbl.includes('SHOUT') || lbl.includes('SIT')) return '◌';
        if (lbl.includes('INCREASE') || lbl.includes('VOLUME')) return '▲';
        if (lbl.includes('MORE') || lbl.includes('DETAIL')) return '⊕';
        if (lbl.includes('FINISH')) return '✓';
        return '▸';
    },

    _createRipple(element, event) {
        const ripple = document.createElement('span');
        ripple.className = 'option-ripple';
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    },

    selectChoice(option) {
        // Add current prompt response to history
        const prevText = this.terminalTextEl.innerText;
        if (prevText) this.addToHistory(prevText, this.currentLogType, '⊟');

        // Add selected option label to history with user-input styling
        this.addToHistory("» " + option.label.toUpperCase(), 'user-input', '▸');
        this.terminalTextEl.innerText = "";

        this.currentState = option.next;
        this.updateHeaderStatus('busy');
        const nextState = this.dialogueTree[this.currentState];
        if (nextState) {
            this.typeResponse(nextState.text, () => {
                this.showActiveDialogueOptions();
                this.updateHeaderStatus('active');
            });
        }
    },

    handleInput(inputVal) {
        const rawCmd = inputVal.trim();
        const cmd = rawCmd.toUpperCase();

        // Save previous output to history before overwriting
        const prevText = this.terminalTextEl.innerText;
        if (prevText) this.addToHistory(prevText, this.currentLogType, '⊟');
        this.terminalTextEl.innerText = "";

        // 1. Add current command to history with user-input styling
        this.addToHistory("» " + rawCmd, 'user-input', '▸');

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
            const helpLines = [
                "╔══════════════════════════════════════╗",
                "║       TERMINAL COMMAND REFERENCE      ║",
                "╠══════════════════════════════════════╣",
                "║  HELP      — Show this reference      ║",
                "║  GO [EXIT] — Move to an exit           ║",
                "║  ACT [OBJ] — Interact with object      ║",
                "║  SCAN      — Scan for exits            ║",
                "║  MAP       — Toggle map view           ║",
                "║  SANITY    — Check sanity status       ║",
                "║  SYS       — System diagnostics        ║",
                "║  CLEAR     — Clear terminal history    ║",
                "║  RESET     — Reboot system             ║",
                "╠══════════════════════════════════════╣",
                "║  TIP: Click options or type numbers    ║",
                "║  KEYS: ↑↓ History · Tab Autocomplete   ║",
                "╚══════════════════════════════════════╝"
            ];
            this.typeResponse(helpLines.join("\n"), null, 'info', '?');
        } else if (cmd === 'CLEAR' || cmd === 'CLS') {
            this.history = [];
            this.renderHistory();
            this.typeResponse("TERMINAL HISTORY CLEARED.", null, 'success', '✓');
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
                    this.typeResponse("MAP INTERFACE ACTIVATED.", null, 'success', '◈');
                } else {
                    this.typeResponse("MAP INTERFACE DEACTIVATED.", null, 'warning', '◈');
                }
                playSuccess();
            } else {
                this.typeResponse("MAP SYSTEM OFFLINE.", null, 'error', '✕');
                playError();
            }
        } else if (cmd === 'SANITY') {
            const sanity = window.game ? window.game.state.sanity : 100;
            const barLen = 20;
            const filled = Math.round(sanity / 100 * barLen);
            const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
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

            const sanityReport = [
                "┌─ SANITY REPORT ─────────────────┐",
                `│  LEVEL:  ${Math.floor(sanity)}%`,
                `│  STATUS: ${level}`,
                `│  ▐${bar}▌`,
                "└─────────────────────────────────┘"
            ].join("\n");
            this.typeResponse(sanityReport, null, type, '◈');
        } else if (cmd === 'DIAGNOSTICS' || cmd === 'SYS') {
            if (window.game) {
                playSuccess();
                const sanity = window.game.state.sanity;
                const loc = window.game.getCurrentLocation();
                const explored = window.game.state.visitedRooms.length;
                const total = Object.keys(window.game.world.rooms).length;
                const seedHash = Math.abs(window.game.state.currentRoom.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)) % 10000;
                
                const stats = [
                    "┌─ SYSTEM DIAGNOSTICS ─────────────┐",
                    `│  POSITION .... ${loc.getName().toUpperCase()}`,
                    `│  SEED ....... CMD-0x${seedHash.toString(16).toUpperCase()}`,
                    `│  SANITY ..... ${Math.floor(sanity)}%`,
                    `│  MAPPED ..... ${explored}/${total} SECTORS`,
                    `│  CPU LOAD ... ${(100 - sanity).toFixed(1)}%`,
                    `│  INTEGRITY .. STABLE`,
                    "└──────────────────────────────────┘"
                ].join("\n");
                
                this.typeResponse(stats, null, 'info', '◈');
            } else {
                this.typeResponse("DIAGNOSTICS SERVICE OFFLINE.", null, 'error', '✕');
                playError();
            }
        } else if (cmd === 'SCAN' || cmd === 'PING') {
            if (window.game) {
                playSuccess();
                const exits = window.game.getCurrentLocation().getActions();
                if (exits.length === 0) {
                    this.typeResponse("SCAN COMPLETE — NO EXIT VECTORS DETECTED.", null, 'warning', '◉');
                } else {
                    let lines = ["┌─ ENVIRONMENT SCAN ───────────────┐"];
                    exits.forEach((e, i) => {
                        const status = e.isUnknown ? "NEW" : "KNOWN";
                        const recommend = e.isRecommended ? " ★" : "";
                        const statusIcon = e.isUnknown ? "◆" : "◇";
                        lines.push(`│  ${statusIcon} ${e.label.toUpperCase()} [${status}]${recommend}`);
                    });
                    lines.push("└──────────────────────────────────┘");
                    this.typeResponse(lines.join("\n"), null, 'info', '◉');
                }
            } else {
                this.typeResponse("SCANNER OFFLINE.", null, 'error', '✕');
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
                    this.typeResponse(`NAVIGATING → ${found.label.toUpperCase()}...`, null, 'success', '→');
                    setTimeout(() => {
                        window.game.handleAction('tra', found.id, found.extra);
                    }, 500);
                } else {
                    this.typeResponse(`PATH ERROR: '${exitLabel}' NOT FOUND.`, null, 'error', '✕');
                    playError();
                }
            } else {
                this.typeResponse("NAVIGATION ENGINE OFFLINE.", null, 'error', '✕');
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
                            this.typeResponse(`EXECUTING: ${foundInteractable.label.toUpperCase()} → ${stateSearch}`, null, 'success', '⚡');
                            setTimeout(() => {
                                window.game.handleAction('act', foundInterId, stateIdx);
                            }, 500);
                        } else {
                            const statesStr = foundInteractable.states.map(s => (s.label || s.id).toUpperCase()).join(' · ');
                            this.typeResponse(`VALID STATES FOR ${foundInteractable.label.toUpperCase()}: ${statesStr}`, null, 'warning', '?');
                            playError();
                        }
                    } else {
                        // Cycle if no state specified
                        playSuccess();
                        this.typeResponse(`CYCLING: ${foundInteractable.label.toUpperCase()}`, null, 'success', '↺');
                        setTimeout(() => {
                            window.game.handleAction('act', foundInterId, null);
                        }, 500);
                    }
                } else {
                    this.typeResponse(`TARGET '${interSearch}' NOT FOUND.`, null, 'error', '✕');
                    playError();
                }
            } else {
                this.typeResponse("CONTROL SYSTEM OFFLINE.", null, 'error', '✕');
                playError();
            }
        } else {
            // Invalid command / fallback
            this.typeResponse(`UNKNOWN: '${cmd}' — TYPE 'HELP' FOR COMMANDS.`, null, 'error', '✕');
            playError();
        }
    },

    addToHistory(text, type = '', icon = '') {
        this.history.push({ text, type, icon });
        if (this.history.length > 30) {
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
            const icon = (typeof lineObj === 'string') ? '' : (lineObj.icon || '');
            div.className = 'terminal-history-line' + (type ? ' log-' + type : '');
            
            if (icon) {
                div.innerHTML = `<span class="history-icon">${icon}</span><span class="history-text">${this._escapeHtml(text)}</span>`;
            } else {
                div.innerHTML = `<span class="history-text">${this._escapeHtml(text)}</span>`;
            }
            
            this.terminalHistoryEl.appendChild(div);
        });
        // Smooth scroll to bottom
        requestAnimationFrame(() => {
            this.terminalHistoryEl.scrollTop = this.terminalHistoryEl.scrollHeight;
        });
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    typeResponse(text, callback, logType = '', icon = '') {
        this.currentLogType = logType;
        this.terminalTextEl.className = 'terminal-response-text' + (logType ? ' log-' + logType : '');
        this.updateHeaderStatus('busy');
        
        if (window.game) {
            // Forward typing animation to the game to use its glitchy visual typing animation
            window.game.typeTerminalText(text, () => {
                this.updateHeaderStatus(this.terminalContainer.classList.contains('expanded') ? 'active' : 'online');
                if (callback) callback();
            });
        } else {
            // Fallback typing animation
            this.isTyping = true;
            this.terminalTextEl.innerText = "";
            let i = 0;
            const type = () => {
                if (i < text.length) {
                    this.terminalTextEl.innerText = text.substring(0, i + 1) + "█";
                    i++;
                    setTimeout(type, 18);
                } else {
                    this.terminalTextEl.innerText = text;
                    this.isTyping = false;
                    this.updateHeaderStatus(this.terminalContainer.classList.contains('expanded') ? 'active' : 'online');
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
```
```diff:index.html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>LIMINAL OS - Backrooms Explorer</title>
    <meta name="description" content="A vanilla JS adventure game set in the Backrooms. Survive the liminal space.">
    <meta name="theme-color" content="#0a0a0a">
    <link rel="stylesheet" href="style.css">
    <script src="https://unpkg.com/lucide@latest"></script>
</head>

<body>
    <div id="app-container">

        <!-- Fullscreen Background Image -->
        <div id="scene-bg">
            <img id="room-image-blur" src="" alt="">
            <img id="room-image" src="" alt="Room View">
            <div id="scene-vignette"></div>
            <div id="scene-noise"></div>
        </div>

        <!-- CRT Scanline overlay -->
        <div id="crt-overlay"></div>

        <!-- Top HUD Bar -->
        <header id="hud-bar">
            <div class="hud-left">
                <div class="hud-group" id="sanity-group">
                    <button id="sanity-minus" class="hud-badge hud-badge-btn debug-btn"
                        aria-label="Decrease Sanity">-</button>
                    <span class="hud-icon"><i data-lucide="brain"></i></span>
                    <div class="sanity-bar">
                        <div id="sanity-fill"></div>
                    </div>
                    <span id="sanity-value" class="hud-number">100%</span>
                    <button id="sanity-plus" class="hud-badge hud-badge-btn debug-btn"
                        aria-label="Increase Sanity">+</button>
                </div>
            </div>
            <div class="hud-center">
                <span class="hud-logo">LIMINAL<span class="hud-logo-dim">OS</span></span>
            </div>
            <div class="hud-right">
                <span class="hud-badge">
                    <span class="hud-icon"><i data-lucide="eye"></i></span>
                    <span id="discovered-value">0/0</span>
                </span>
                <button id="settings-btn" class="hud-badge hud-badge-btn" aria-label="Settings">
                    <i data-lucide="settings"></i>
                </button>
                <button id="reset-btn" class="hud-badge hud-badge-btn" aria-label="Reset">
                    <i data-lucide="rotate-ccw"></i>
                </button>
            </div>
        </header>

        <!-- Dynamic Terminal Line -->
        <div id="terminal-line-container">
            <div id="terminal-history"></div>
            <div class="terminal-current-line" id="terminal-active-line">
                <span id="terminal-prompt">></span>
                <span id="terminal-text"></span>
                <input type="text" id="terminal-input" autocomplete="off" spellcheck="false" placeholder="TYPE COMMAND OR CLICK TO EXPLORE...">
            </div>
            <div id="terminal-options-list"></div>
        </div>

        <!-- Settings Panel Dropdown -->
        <div id="settings-panel" class="settings-panel hidden">
            <div class="settings-title">// SYSTEM CONFIG</div>
            <div class="control-group">
                <label for="master-vol">MASTER VOL</label>
                <input type="range" id="master-vol" min="0" max="1" step="0.01" value="1.0">
            </div>
            <div class="control-group">
                <label for="ambient-vol">AMBIENT VOL</label>
                <input type="range" id="ambient-vol" min="0" max="1" step="0.01" value="0.0">
            </div>
            <div class="control-group">
                <label for="sfx-vol">SFX VOL</label>
                <input type="range" id="sfx-vol" min="0" max="1" step="0.01" value="0.5">
            </div>
        </div>

        <!-- Main Content - layered over the image -->
        <main id="game-viewport">
            <div id="narrative-panel">
                <h1 id="room-title">INITIALIZING...</h1>
                <div id="room-subtitle"></div>
                <p id="room-desc"></p>
                <p id="interactable-desc" class="interactable-desc"></p>
            </div>
        </main>

        <!-- Actions Area - sticky bottom -->
        <section id="actions-container">
            <!-- Buttons injected by JS -->
        </section>

        <!-- Map Panel -->
        <div id="map-panel" class="map-panel collapsed">
            <button id="map-toggle-btn" class="map-toggle-btn">MAP</button>
            <div class="map-content" id="map-content">
                <svg id="map-svg" width="100%" height="100%"></svg>
                <div class="map-legend">
                    <div class="map-legend-item">
                        <div class="map-legend-dot map-legend-dot--current"></div>
                        <span>YOU ARE HERE</span>
                    </div>
                    <div class="map-legend-item">
                        <div class="map-legend-dot map-legend-dot--visited"></div>
                        <span>VISITED</span>
                    </div>
                    <div class="map-legend-item">
                        <div class="map-legend-dot map-legend-dot--unknown"></div>
                        <span>UNKNOWN</span>
                    </div>
                </div>
            </div>
        </div>

    </div>

    <svg style="display: none;">
        <defs>
            <filter id="glitch-filter">
                <feTurbulence type="fractalNoise" baseFrequency="0.05 0.5" numOctaves="1" result="noise" seed="0"
                    id="glitch-turbulence">
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"
                    id="glitch-displacement" />

                <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" id="glitch-color" />
            </filter>
        </defs>
    </svg>

    <script src="audio.js"></script>
    <script src="terminal.js"></script>
    <script src="mapgen.js"></script>
    <script src="app.js"></script>
    <script>
        lucide.createIcons();
    </script>
</body>

</html>
===
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>LIMINAL OS - Backrooms Explorer</title>
    <meta name="description" content="A vanilla JS adventure game set in the Backrooms. Survive the liminal space.">
    <meta name="theme-color" content="#0a0a0a">
    <link rel="stylesheet" href="style.css">
    <script src="https://unpkg.com/lucide@latest"></script>
</head>

<body>
    <div id="app-container">

        <!-- Fullscreen Background Image -->
        <div id="scene-bg">
            <img id="room-image-blur" src="" alt="">
            <img id="room-image" src="" alt="Room View">
            <div id="scene-vignette"></div>
            <div id="scene-noise"></div>
        </div>

        <!-- CRT Scanline overlay -->
        <div id="crt-overlay"></div>

        <!-- Top HUD Bar -->
        <header id="hud-bar">
            <div class="hud-left">
                <div class="hud-group" id="sanity-group">
                    <button id="sanity-minus" class="hud-badge hud-badge-btn debug-btn"
                        aria-label="Decrease Sanity">-</button>
                    <span class="hud-icon"><i data-lucide="brain"></i></span>
                    <div class="sanity-bar">
                        <div id="sanity-fill"></div>
                    </div>
                    <span id="sanity-value" class="hud-number">100%</span>
                    <button id="sanity-plus" class="hud-badge hud-badge-btn debug-btn"
                        aria-label="Increase Sanity">+</button>
                </div>
            </div>
            <div class="hud-center">
                <span class="hud-logo">LIMINAL<span class="hud-logo-dim">OS</span></span>
            </div>
            <div class="hud-right">
                <span class="hud-badge">
                    <span class="hud-icon"><i data-lucide="eye"></i></span>
                    <span id="discovered-value">0/0</span>
                </span>
                <button id="settings-btn" class="hud-badge hud-badge-btn" aria-label="Settings">
                    <i data-lucide="settings"></i>
                </button>
                <button id="reset-btn" class="hud-badge hud-badge-btn" aria-label="Reset">
                    <i data-lucide="rotate-ccw"></i>
                </button>
            </div>
        </header>

        <!-- Dynamic Terminal Line -->
        <div id="terminal-line-container">
            <div class="terminal-header" id="terminal-header">
                <div class="terminal-header-left">
                    <span class="terminal-status-dot status-online"></span>
                    <span class="terminal-status-text">STANDBY</span>
                </div>
                <span class="terminal-header-title">TERMINAL v2.0</span>
                <span class="terminal-header-hint">` / CLICK</span>
            </div>
            <div id="terminal-history"></div>
            <div class="terminal-output-line" id="terminal-output-line">
                <span class="output-prompt">▸</span>
                <span id="terminal-text"></span>
            </div>
            <div class="terminal-input-line" id="terminal-active-line">
                <span id="terminal-prompt">›</span>
                <input type="text" id="terminal-input" autocomplete="off" spellcheck="false" placeholder="type command...">
            </div>
            <div id="terminal-options-list"></div>
        </div>

        <!-- Settings Panel Dropdown -->
        <div id="settings-panel" class="settings-panel hidden">
            <div class="settings-title">// SYSTEM CONFIG</div>
            <div class="control-group">
                <label for="master-vol">MASTER VOL</label>
                <input type="range" id="master-vol" min="0" max="1" step="0.01" value="1.0">
            </div>
            <div class="control-group">
                <label for="ambient-vol">AMBIENT VOL</label>
                <input type="range" id="ambient-vol" min="0" max="1" step="0.01" value="0.0">
            </div>
            <div class="control-group">
                <label for="sfx-vol">SFX VOL</label>
                <input type="range" id="sfx-vol" min="0" max="1" step="0.01" value="0.5">
            </div>
        </div>

        <!-- Main Content - layered over the image -->
        <main id="game-viewport">
            <div id="narrative-panel">
                <h1 id="room-title">INITIALIZING...</h1>
                <div id="room-subtitle"></div>
                <p id="room-desc"></p>
                <p id="interactable-desc" class="interactable-desc"></p>
            </div>
        </main>

        <!-- Actions Area - sticky bottom -->
        <section id="actions-container">
            <!-- Buttons injected by JS -->
        </section>

        <!-- Map Panel -->
        <div id="map-panel" class="map-panel collapsed">
            <button id="map-toggle-btn" class="map-toggle-btn">MAP</button>
            <div class="map-content" id="map-content">
                <svg id="map-svg" width="100%" height="100%"></svg>
                <div class="map-legend">
                    <div class="map-legend-item">
                        <div class="map-legend-dot map-legend-dot--current"></div>
                        <span>YOU ARE HERE</span>
                    </div>
                    <div class="map-legend-item">
                        <div class="map-legend-dot map-legend-dot--visited"></div>
                        <span>VISITED</span>
                    </div>
                    <div class="map-legend-item">
                        <div class="map-legend-dot map-legend-dot--unknown"></div>
                        <span>UNKNOWN</span>
                    </div>
                </div>
            </div>
        </div>

    </div>

    <svg style="display: none;">
        <defs>
            <filter id="glitch-filter">
                <feTurbulence type="fractalNoise" baseFrequency="0.05 0.5" numOctaves="1" result="noise" seed="0"
                    id="glitch-turbulence">
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"
                    id="glitch-displacement" />

                <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" id="glitch-color" />
            </filter>
        </defs>
    </svg>

    <script src="audio.js"></script>
    <script src="terminal.js"></script>
    <script src="mapgen.js"></script>
    <script src="app.js"></script>
    <script>
        lucide.createIcons();
    </script>
</body>

</html>
```
```diff:style.css
/* LiminalOS Client Style - Premium Dark Redesign */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

/* ============================
   DESIGN TOKENS (Style Guide)
   ============================ */
:root {
    --bg-core: #050505;
    --bg-grad-start: #0f1014;
    --bg-grad-end: #000000;

    /* Glassmorphism */
    --glass-panel: rgba(255, 255, 255, 0.03);
    --glass-border: rgba(255, 255, 255, 0.08);
    --glass-highlight: rgba(255, 255, 255, 0.05);
    --glass-heavy: rgba(10, 10, 10, 0.85);
    --glass-light: rgba(255, 255, 255, 0.02);

    /* Text Colors */
    --text-main: #f0f0f0;
    --text-secondary: #9ca3af;
    --text-muted: #525252;

    /* Accents (Amber / Gold) */
    --accent-primary: #eab308;        /* Amber 500 */
    --accent-glow: rgba(234, 179, 8, 0.25);
    --accent-dim: #854d0e;
    --amber: #eab308;

    /* Statuses / States */
    --success: #10b981;
    --error: #ef4444;

    /* Typography */
    --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
    --font-mono: 'Space Mono', monospace;

    /* Borders & Radius */
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 24px;

    /* Transitions & Shadows */
    --transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    --shadow-soft: 0 4px 20px -2px rgba(0, 0, 0, 0.5);
    --shadow-card: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3);

    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-top: env(safe-area-inset-top, 0px);
    --bg-margin: 0px;
}

/* ============================
   RESET & BASE
   ============================ */
*,
*::before,
*::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
}

html,
body {
    height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
}

body {
    background-color: var(--bg-core);
    background-image: 
        radial-gradient(circle at 15% 50%, rgba(30, 30, 35, 0.4) 0%, transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(20, 20, 25, 0.4) 0%, transparent 25%);
    color: var(--text-main);
    font-family: var(--font-sans);
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    touch-action: manipulation;
}

/* ============================
   APP CONTAINER
   ============================ */
#app-container {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1;
}

/* ============================
   SCENE BACKGROUND (fullscreen image)
   ============================ */
#scene-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background: var(--bg-core);
}

/* Blurred background layer */
#scene-bg img#room-image-blur {
    position: absolute;
    inset: -20px;
    width: calc(100% + 40px);
    height: calc(100% + 40px);
    object-fit: cover;
    filter: blur(20px) brightness(0.25) saturate(0.8);
    opacity: 1;
    z-index: 0;
    transition: opacity 0.6s ease;
}

/* Sharp foreground layer */
#scene-bg img#room-image {
    position: absolute;
    top: var(--bg-margin, 0px);
    bottom: var(--bg-margin, 0px);
    left: 0;
    right: 0;
    width: 100%;
    height: calc(100% - (2 * var(--bg-margin, 0px)));
    object-fit: contain;
    z-index: 1;
    filter: brightness(0.55) contrast(1.15) saturate(0.7);
    transition: opacity 0.6s ease;
    will-change: transform, opacity;
    transform: translateZ(0);
}

#scene-bg img.fade-out {
    opacity: 0;
}

/* Vignette */
#scene-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.8) 100%);
    pointer-events: none;
    will-change: opacity;
}

/* Noise texture */
#scene-noise {
    position: absolute;
    inset: 0;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
}

/* ============================
   CRT OVERLAY
   ============================ */
#crt-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    pointer-events: none;
    background:
        repeating-linear-gradient(0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.05) 2px,
            rgba(0, 0, 0, 0.05) 4px);
}

#crt-overlay::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent, rgba(234, 179, 8, 0.02), transparent);
    height: 120px;
    animation: scanline 8s linear infinite;
}

@keyframes scanline {
    0% {
        transform: translateY(-120px);
    }
    100% {
        transform: translateY(100vh);
    }
}

/* ============================
   TERMINAL LINE
   ============================ */
#terminal-line-container {
    position: relative;
    z-index: 50;
    margin: 0.5rem 1rem;
    padding: 0.5rem 1rem;
    background: rgba(10, 10, 10, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 0;
    pointer-events: auto;
    cursor: pointer;
    box-shadow: var(--shadow-soft);
    transition: all var(--transition-fast);
    overflow: hidden;
}

#terminal-line-container:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.15);
}

#terminal-line-container.focused {
    background: rgba(10, 10, 10, 0.85);
    border-color: var(--accent-primary) !important;
    box-shadow: 0 0 15px rgba(234, 179, 8, 0.15) !important;
}

#terminal-line-container.focused #terminal-prompt {
    color: var(--accent-primary);
    text-shadow: 0 0 8px var(--accent-primary);
}

#terminal-line-container.interactive-prompt #terminal-prompt {
    color: var(--accent-primary);
    text-shadow: 0 0 8px var(--accent-primary);
    animation: terminal-blink 1s step-end infinite;
}

@keyframes terminal-blink {
    50% {
        opacity: 0;
    }
}

#terminal-line-container.expanded {
    padding-top: 0.6rem;
    gap: 0.2rem;
}

#terminal-prompt {
    color: var(--text-muted);
    font-weight: bold;
}

#terminal-history {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, opacity 0.3s ease;
}

#terminal-line-container.expanded #terminal-history {
    max-height: 10rem;
    opacity: 1;
    overflow-y: auto;
    padding-right: 4px;
}

#terminal-history::-webkit-scrollbar {
    width: 4px;
}
#terminal-history::-webkit-scrollbar-track {
    background: transparent;
}
#terminal-history::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
}

.terminal-history-line {
    opacity: 0.85;
    font-size: 0.72rem;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--text-secondary);
    margin-bottom: 0.3rem;
    line-height: 1.3;
}

/* Colors for system response logs */
.terminal-history-line.log-success, #terminal-text.log-success {
    color: var(--success);
}
.terminal-history-line.log-error, #terminal-text.log-error {
    color: var(--error);
}
.terminal-history-line.log-warning, #terminal-text.log-warning {
    color: var(--accent-primary);
}
.terminal-history-line.log-info, #terminal-text.log-info {
    color: #38bdf8;
}

.terminal-current-line {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
}

#terminal-text {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--text-main);
    line-height: 1.3;
}

#terminal-input {
    display: none;
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-main);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 0;
    margin: 0;
    caret-color: var(--accent-primary);
}

#terminal-line-container.focused #terminal-text {
    display: none;
}

#terminal-line-container.focused #terminal-input {
    display: block;
}

/* Options list inside terminal */
#terminal-options-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease;
}

#terminal-line-container.expanded #terminal-options-list {
    max-height: 12rem;
    opacity: 1;
    margin-top: 0.5rem;
    padding-top: 0.4rem;
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
}

.terminal-option-item {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem 0.6rem;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid transparent;
}

.terminal-option-item:hover {
    background: rgba(234, 179, 8, 0.05);
    border-color: rgba(234, 179, 8, 0.15);
    color: var(--accent-primary);
    padding-left: 0.8rem;
    box-shadow: 0 0 8px rgba(234, 179, 8, 0.05);
}

.terminal-option-item::before {
    content: "◈";
    color: var(--accent-primary);
    opacity: 0.5;
}

/* ============================
   HUD BAR (top)
   ============================ */
#hud-bar {
    position: relative;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 1.5rem;
    background: rgba(10, 10, 10, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--glass-border);
    gap: 0.5rem;
    flex-shrink: 0;
}

.hud-left,
.hud-center,
.hud-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.hud-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
}

.hud-logo {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.05em;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 6px;
}

.hud-logo::before {
    content: '';
    display: block;
    width: 6px;
    height: 6px;
    background: var(--accent-primary);
    box-shadow: 0 0 8px var(--accent-primary);
    border-radius: 50%;
}

.hud-logo-dim {
    color: var(--text-muted);
    font-weight: 400;
}

.hud-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.hud-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.hud-icon svg,
.hud-badge svg,
.hud-badge-btn svg {
    width: 14px;
    height: 14px;
    stroke-width: 2px;
    display: inline-block;
    vertical-align: middle;
}

.hud-number {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-main);
    font-weight: 500;
}

.hud-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    padding: 0 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-secondary);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    background: var(--glass-panel);
    line-height: 1;
    transition: var(--transition-fast);
    gap: 0.3rem;
}

/* Badge-style buttons */
.hud-badge-btn {
    cursor: pointer;
    background: var(--glass-panel);
    border: 1px solid var(--glass-border);
}

.hud-badge-btn:hover {
    transform: none !important;
    background: var(--glass-highlight);
    border-color: var(--accent-primary);
    color: var(--text-main);
    box-shadow: 0 0 10px rgba(234, 179, 8, 0.15);
}

.hud-badge-btn:active {
    transform: scale(0.95);
}

/* Sanity Bar */
.sanity-bar {
    width: 80px;
    height: 6px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--glass-border);
}

#sanity-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--error), var(--accent-primary), var(--success));
    border-radius: var(--radius-sm);
    transition: width 0.5s var(--transition-fast);
}

.debug-btn {
    min-width: 28px;
    height: 28px;
    font-size: 0.8rem;
    opacity: 0.5;
    padding: 0;
}

.debug-btn:hover {
    opacity: 1;
}

/* ============================
   SETTINGS PANEL
   ============================ */
.settings-panel {
    position: absolute;
    top: calc(2.8rem + var(--safe-top));
    right: 1.5rem;
    z-index: 120;
    background: rgba(10, 10, 10, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: var(--shadow-card);
    transition: opacity var(--transition-fast), transform var(--transition-fast);
    min-width: 240px;
}

.settings-panel.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-8px) scale(0.97);
}

.settings-title {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    border-bottom: 1px solid var(--glass-border);
    padding-bottom: 0.5rem;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.control-group label {
    font-family: var(--font-sans);
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
}

/* Range Input */
input[type=range] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    outline: none;
}

input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 8px;
    background: var(--accent-primary);
    border-radius: 2px;
    cursor: pointer;
    box-shadow: 0 0 8px var(--accent-primary);
    transition: var(--transition-fast);
}

input[type=range]::-webkit-slider-thumb:hover {
    background: #facc15;
    box-shadow: 0 0 12px var(--accent-primary);
}

input[type=range]::-moz-range-thumb {
    height: 16px;
    width: 8px;
    background: var(--accent-primary);
    border: none;
    border-radius: 2px;
    cursor: pointer;
}

/* ============================
   GAME VIEWPORT (narrative)
   ============================ */
#game-viewport {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-start;
    position: relative;
    z-index: 5;
    min-height: 0;
    overflow: hidden;
}

/* Narrative Panel */
#narrative-panel {
    background: rgba(10, 10, 10, 0.75);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 1rem 1.25rem;
    margin-left: 2rem;
    margin-bottom: 1rem;
    max-width: 440px;
    box-shadow: var(--shadow-card);
    position: relative;
}

#room-title {
    font-family: var(--font-mono);
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-main);
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
    margin-bottom: 0.15rem;
    line-height: 1.2;
    text-transform: uppercase;
}

#room-subtitle {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    color: var(--accent-primary);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    opacity: 0.9;
    font-weight: 600;
}

#room-desc {
    font-family: var(--font-sans);
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--text-secondary);
    max-height: 22vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--glass-border) transparent;
}

.interactable-desc {
    margin-top: 0.6rem;
    font-family: var(--font-sans);
    font-size: 0.85rem;
    color: var(--accent-primary);
    opacity: 0.95;
    font-style: italic;
    line-height: 1.4;
    padding-left: 0.75rem;
    border-left: 2px solid var(--accent-primary);
}

/* ============================
   ACTIONS CONTAINER
   ============================ */
#actions-container {
    position: relative;
    z-index: 10;
    padding: 0.6rem 2rem;
    padding-bottom: calc(0.6rem + var(--safe-bottom));
    background: rgba(10, 10, 10, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    border-top: 1px solid var(--glass-border);
    flex-shrink: 0;
}

/* ============================
   BUTTONS
   ============================ */
button {
    appearance: none;
    -webkit-appearance: none;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--glass-border);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.03em;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    flex: 0 1 auto;
    min-width: 100px;
    position: relative;
    overflow: hidden;
    white-space: normal;
    text-align: center;
    line-height: 1.2;
    height: auto;
    min-height: 2.3rem;
}

button::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: var(--accent-primary);
    transform: scaleY(0);
    transform-origin: top;
    transition: transform var(--transition-fast);
    z-index: 2;
}

button:hover::before {
    transform: scaleY(1);
}

button:hover {
    border-color: var(--accent-primary);
    color: var(--text-main);
    background: rgba(234, 179, 8, 0.03);
    box-shadow: 0 4px 15px rgba(234, 179, 8, 0.08);
    transform: translateY(-2px);
}

button:active {
    transform: translateY(0px) scale(0.98);
}

/* Interaction groups & buttons */
.interaction-group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    width: 100%;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.8rem;
    margin-bottom: 0.1rem;
}

.interaction-group-label {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-right: 0.4rem;
}

button.interaction-btn {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--glass-border);
    color: var(--text-secondary);
    font-size: 0.75rem;
    padding: 0.25rem 0.75rem;
    min-height: auto;
    min-width: 70px;
    flex: 0 1 auto;
    justify-content: center;
    text-align: center;
    border-radius: 3px;
}

button.interaction-btn.active {
    background: rgba(239, 68, 68, 0.15) !important;
    border-color: var(--error) !important;
    color: #fff !important;
    opacity: 1;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.2) !important;
}

button.interaction-btn.active::before {
    transform: scaleY(1);
    background: var(--error);
}

button.interaction-btn:hover {
    border-color: var(--error) !important;
    background: rgba(239, 68, 68, 0.05);
    color: var(--text-main);
    opacity: 1;
}

button.interaction-btn.active:hover {
    border-color: #ff6666 !important;
    background: rgba(239, 68, 68, 0.25) !important;
}

button.interaction-btn:active {
    transform: scale(0.97);
}

/* Exit buttons */
button.exit-btn {
    flex: 0 1 auto;
    min-width: 130px;
    display: inline-flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
}

/* Continue button */
button.continue-btn {
    flex: 1 1 100%;
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: rgba(234, 179, 8, 0.02);
    font-size: 0.95rem;
    padding: 1rem;
}

button.continue-btn::before {
    background: var(--accent-primary);
}

button.continue-btn:hover {
    border-color: var(--accent-primary);
    box-shadow: 0 4px 15px rgba(234, 179, 8, 0.15);
    color: #fff;
}

/* Custom Category Colors */
button.custom-category-btn:hover {
    border-color: var(--btn-color) !important;
    box-shadow: 0 4px 15px var(--btn-glow) !important;
    color: #fff !important;
    background: rgba(255, 255, 255, 0.04) !important;
}

/* ============================
   EXIT BUTTON – BADGES (NEW / EXPLORE)
   ============================ */
.exit-label {
    display: block;
    line-height: 1.2;
}

.exit-icon-badges {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    pointer-events: none;
}

.exit-icon-badges svg {
    width: 12px;
    height: 12px;
    stroke-width: 2.5px;
    animation: exitIconPulse 2s ease-in-out infinite;
}

.exit-icon-new {
    color: var(--accent-primary);
    filter: drop-shadow(0 0 4px var(--accent-glow));
}

.exit-icon-recommend {
    color: var(--success);
    filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.3));
    animation-delay: 0.5s !important;
}

@keyframes exitIconPulse {
    0%, 100% {
        opacity: 0.6;
        transform: scale(0.95);
    }
    50% {
        opacity: 1;
        transform: scale(1.05);
    }
}

/* ============================
   MAP PANEL
   ============================ */
.map-panel {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 300px;
    height: 70vh;
    background: rgba(10, 10, 10, 0.85);
    border: 1px solid var(--glass-border);
    border-right: none;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    z-index: 90;
    transition: transform var(--transition-fast);
    display: flex;
    flex-direction: row;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: var(--shadow-card);
}

.map-panel.collapsed {
    transform: translate(300px, -50%);
}

.map-toggle-btn {
    position: absolute;
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(10, 10, 10, 0.85);
    border: 1px solid var(--glass-border);
    border-right: none;
    color: var(--text-secondary);
    padding: 1.5rem 0.6rem;
    cursor: pointer;
    font-family: var(--font-mono);
    letter-spacing: 2px;
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    writing-mode: vertical-rl;
    text-orientation: upright;
    font-weight: 700;
    transition: var(--transition-fast);
}

.map-toggle-btn:hover {
    transform: translateY(-50%) !important;
    background: var(--glass-highlight);
    color: var(--accent-primary);
    border-color: var(--accent-primary);
}

#map-svg text {
    paint-order: stroke fill;
    stroke: #0a0a0a;
    stroke-width: 3px;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.map-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    min-height: 0;
}

#map-svg {
    flex: 1;
    width: 100%;
    min-height: 0;
    display: block;
}

/* Legenda mapy */
.map-legend {
    flex-shrink: 0;
    padding: 0.6rem 0.8rem;
    border-top: 1px solid var(--glass-border);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-secondary);
}

.map-legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
}

.map-legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.map-legend-dot--current {
    background: #ffffff;
    box-shadow: 0 0 6px #ffffff;
}

.map-legend-dot--visited {
    background: var(--success);
    box-shadow: 0 0 6px var(--success);
}

.map-legend-dot--unknown {
    background: var(--text-muted);
    border: 1px solid var(--text-secondary);
}

/* Progress bar for auto-transition buttons */
.btn-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: var(--accent-primary);
    width: 0;
    pointer-events: none;
    box-shadow: 0 0 8px var(--accent-primary);
}

.btn-progress.animate {
    animation: btnProgressFill 11s linear forwards;
}

@keyframes btnProgressFill {
    from {
        width: 0%;
    }
    to {
        width: 100%;
    }
}

/* ============================
   SCROLLBAR
   ============================ */
::-webkit-scrollbar {
    width: 4px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: var(--glass-border);
    border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
}

/* ============================
   GLITCH FLASH
   ============================ */
.glitch-flash {
    animation: glitchFlash 0.08s steps(2) 2;
}

@keyframes glitchFlash {
    0% {
        filter: hue-rotate(0deg) brightness(1);
    }
    25% {
        filter: hue-rotate(90deg) brightness(1.5);
    }
    50% {
        filter: hue-rotate(-30deg) brightness(0.8);
    }
    100% {
        filter: hue-rotate(0deg) brightness(1);
    }
}

/* ============================
   GLITCH ARTIFACTS
   ============================ */
.glitch-slice {
    position: absolute;
    background: inherit;
    background-color: rgba(234, 179, 8, 0.15);
    mix-blend-mode: color-dodge;
    pointer-events: none;
    z-index: 2;
    overflow: hidden;
}

.glitch-slice::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(234, 179, 8, 0.25), transparent);
    animation: glitchMove 0.2s linear infinite;
}

@keyframes glitchMove {
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(100%);
    }
}

#scene-bg {
    transition: transform 0.1s ease-out;
}

/* ============================
   RESPONSIVE – TABLETS
   ============================ */
@media (min-width: 600px) and (max-width: 1024px) {
    #room-title {
        font-size: 1.8rem;
    }

    #room-desc {
        font-size: 1.1rem;
    }

    #actions-container {
        padding: 1.25rem 2rem;
    }

    button {
        padding: 0.8rem 1.5rem;
        font-size: 0.9rem;
    }

    #narrative-panel {
        padding: 3rem 2rem 1.2rem;
    }
}

/* ============================
   RESPONSIVE – DESKTOP
   ============================ */
@media (min-width: 1025px) {
    #app-container {
        max-width: 100%;
    }

    #hud-bar {
        padding: 0.5rem 3rem;
    }

    .sanity-bar {
        width: 100px;
    }

    #narrative-panel {
        padding: 1rem 1.25rem;
        max-width: 440px;
    }

    #room-title {
        font-size: 1.3rem;
    }

    #room-desc {
        font-size: 0.95rem;
    }

    #actions-container {
        padding: 0.6rem 3rem;
        max-width: 100%;
    }

    button {
        padding: 0.45rem 0.9rem;
        font-size: 0.78rem;
    }

    button.exit-btn {
        flex: 0 1 auto;
        min-width: 130px;
    }
}

/* ============================
   RESPONSIVE – SMALL PHONES
   ============================ */
@media (max-width: 380px) {
    #hud-bar {
        padding: 0.4rem 0.6rem;
        gap: 0.3rem;
    }

    #terminal-line-container {
        margin: 0.3rem 0.6rem;
        font-size: 0.7rem;
        padding: 0.25rem 0.5rem;
    }

    .hud-logo {
        font-size: 0.9rem;
        letter-spacing: -0.05em;
    }

    .sanity-bar {
        width: 50px;
    }

    .hud-badge {
        font-size: 0.75rem;
        padding: 0.15rem 0.35rem;
    }

    .hud-btn {
        width: 28px;
        height: 28px;
        font-size: 0.9rem;
    }

    #room-title {
        font-size: 1.4rem;
    }

    #room-desc {
        font-size: 0.95rem;
    }

    .interactable-desc {
        font-size: 0.9rem;
    }

    #narrative-panel {
        padding: 2rem 1rem 0.8rem;
    }

    #actions-container {
        padding: 0.6rem 0.8rem;
        gap: 0.4rem;
    }

    button {
        padding: 0.6rem 0.8rem;
        font-size: 0.8rem;
    }
}

/* ============================
   LANDSCAPE PHONE
   ============================ */
@media (max-height: 500px) and (orientation: landscape) {
    #hud-bar {
        padding: 0.3rem 1rem;
    }

    .hud-logo {
        display: none;
    }

    #narrative-panel {
        padding: 1.5rem 1.5rem 0.6rem;
    }

    #room-title {
        font-size: 1.3rem;
        margin-bottom: 0.3rem;
    }

    #room-desc {
        font-size: 0.95rem;
        max-height: 15vh;
    }

    .interactable-desc {
        font-size: 0.85rem;
    }
}

/* ============================
   MOBILE UI FIXES – PORTRAIT
   ============================ */
@media (max-width: 600px) and (orientation: portrait) {
    /* 1. HUD Optimized Grid Layout */
    #hud-bar {
        display: grid;
        grid-template-areas:
            "center center center"
            "left gap right";
        grid-template-columns: auto 1fr auto;
        gap: 0.5rem;
        padding: 0.6rem 0.8rem;
        padding-top: calc(0.5rem + var(--safe-top));
        height: auto;
        background: rgba(10, 10, 10, 0.98);
        border-bottom: 1px solid var(--glass-border);
    }

    .hud-center {
        grid-area: center;
        position: static;
        transform: none;
        width: 100%;
        justify-content: center;
        padding-bottom: 0.4rem;
        border-bottom: 1px solid var(--glass-border);
        margin-bottom: 0.2rem;
    }

    .hud-left {
        grid-area: left;
        justify-content: flex-start;
    }

    .hud-right {
        grid-area: right;
        justify-content: flex-end;
    }

    .hud-logo {
        font-size: 0.95rem;
    }

    .sanity-bar {
        width: 45px;
    }

    #sanity-value {
        font-size: 0.75rem;
    }

    .hud-badge {
        font-size: 0.75rem;
        padding: 0.15rem 0.4rem;
    }

    .hud-btn {
        width: 32px;
        height: 20px;
        font-size: 0.9rem;
    }

    /* 2. Better Background Scaling (Solid Bottom Bar) */
    #scene-bg {
        height: 70%;
        bottom: auto;
        border-bottom: 1px solid var(--glass-border);
    }

    #app-container {
        justify-content: flex-end;
    }

    #game-viewport {
        flex: 1;
        margin-bottom: 0;
        z-index: 5;
        justify-content: flex-end;
    }

    #actions-container {
        height: 30%;
        width: 100%;
        background: var(--bg-core);
        backdrop-filter: none;
        border-top: 1px solid var(--glass-border);
        overflow-y: auto;
        align-content: center;
        padding-bottom: max(1rem, var(--safe-bottom));
        z-index: 20;
    }

    #narrative-panel {
        max-height: 40vh;
        overflow-y: auto;
        background: rgba(10, 10, 10, 0.9);
        border-radius: var(--radius-md) var(--radius-md) 0 0;
        border-bottom: none;
        margin: 0;
        max-width: 100%;
        width: 100%;
    }
}

/* ============================
   ACCESSIBILITY – reduce motion
   ============================ */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }

    #scene-bg img {
        animation: none;
    }
}
===
/* LiminalOS Client Style - Premium Dark Redesign */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

/* ============================
   DESIGN TOKENS (Style Guide)
   ============================ */
:root {
    --bg-core: #050505;
    --bg-grad-start: #0f1014;
    --bg-grad-end: #000000;

    /* Glassmorphism */
    --glass-panel: rgba(255, 255, 255, 0.03);
    --glass-border: rgba(255, 255, 255, 0.08);
    --glass-highlight: rgba(255, 255, 255, 0.05);
    --glass-heavy: rgba(10, 10, 10, 0.85);
    --glass-light: rgba(255, 255, 255, 0.02);

    /* Text Colors */
    --text-main: #f0f0f0;
    --text-secondary: #9ca3af;
    --text-muted: #525252;

    /* Accents (Amber / Gold) */
    --accent-primary: #eab308;        /* Amber 500 */
    --accent-glow: rgba(234, 179, 8, 0.25);
    --accent-dim: #854d0e;
    --amber: #eab308;

    /* Statuses / States */
    --success: #10b981;
    --error: #ef4444;

    /* Typography */
    --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
    --font-mono: 'Space Mono', monospace;

    /* Borders & Radius */
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 24px;

    /* Transitions & Shadows */
    --transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    --shadow-soft: 0 4px 20px -2px rgba(0, 0, 0, 0.5);
    --shadow-card: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3);

    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-top: env(safe-area-inset-top, 0px);
    --bg-margin: 0px;
}

/* ============================
   RESET & BASE
   ============================ */
*,
*::before,
*::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
}

html,
body {
    height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
}

body {
    background-color: var(--bg-core);
    background-image: 
        radial-gradient(circle at 15% 50%, rgba(30, 30, 35, 0.4) 0%, transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(20, 20, 25, 0.4) 0%, transparent 25%);
    color: var(--text-main);
    font-family: var(--font-sans);
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    touch-action: manipulation;
}

/* ============================
   APP CONTAINER
   ============================ */
#app-container {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1;
}

/* ============================
   SCENE BACKGROUND (fullscreen image)
   ============================ */
#scene-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background: var(--bg-core);
}

/* Blurred background layer */
#scene-bg img#room-image-blur {
    position: absolute;
    inset: -20px;
    width: calc(100% + 40px);
    height: calc(100% + 40px);
    object-fit: cover;
    filter: blur(20px) brightness(0.25) saturate(0.8);
    opacity: 1;
    z-index: 0;
    transition: opacity 0.6s ease;
}

/* Sharp foreground layer */
#scene-bg img#room-image {
    position: absolute;
    top: var(--bg-margin, 0px);
    bottom: var(--bg-margin, 0px);
    left: 0;
    right: 0;
    width: 100%;
    height: calc(100% - (2 * var(--bg-margin, 0px)));
    object-fit: contain;
    z-index: 1;
    filter: brightness(0.55) contrast(1.15) saturate(0.7);
    transition: opacity 0.6s ease;
    will-change: transform, opacity;
    transform: translateZ(0);
}

#scene-bg img.fade-out {
    opacity: 0;
}

/* Vignette */
#scene-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.8) 100%);
    pointer-events: none;
    will-change: opacity;
}

/* Noise texture */
#scene-noise {
    position: absolute;
    inset: 0;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
}

/* ============================
   CRT OVERLAY
   ============================ */
#crt-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    pointer-events: none;
    background:
        repeating-linear-gradient(0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.05) 2px,
            rgba(0, 0, 0, 0.05) 4px);
}

#crt-overlay::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent, rgba(234, 179, 8, 0.02), transparent);
    height: 120px;
    animation: scanline 8s linear infinite;
}

@keyframes scanline {
    0% {
        transform: translateY(-120px);
    }
    100% {
        transform: translateY(100vh);
    }
}

/* ============================
   TERMINAL LINE (v2 REDESIGN)
   ============================ */
#terminal-line-container {
    position: relative;
    z-index: 50;
    margin: 0.5rem 1rem;
    background: rgba(8, 8, 12, 0.75);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 0;
    pointer-events: auto;
    cursor: pointer;
    box-shadow:
        0 4px 24px -4px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    max-height: 42px; /* Collapsed: just header */
}

#terminal-line-container:hover {
    background: rgba(12, 12, 18, 0.85);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow:
        0 6px 28px -4px rgba(0, 0, 0, 0.7),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

#terminal-line-container.expanded {
    max-height: 70vh;
    cursor: default;
    border-color: rgba(234, 179, 8, 0.2);
    background: rgba(6, 6, 10, 0.92);
    box-shadow:
        0 8px 40px -4px rgba(0, 0, 0, 0.8),
        0 0 20px rgba(234, 179, 8, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

#terminal-line-container.focused {
    border-color: rgba(234, 179, 8, 0.3) !important;
}

/* ---- Terminal Header ---- */
.terminal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.85rem;
    border-bottom: 1px solid transparent;
    gap: 0.5rem;
    user-select: none;
    flex-shrink: 0;
    min-height: 40px;
    transition: border-color 0.3s ease;
}

#terminal-line-container.expanded .terminal-header {
    border-bottom-color: rgba(255, 255, 255, 0.06);
    padding-bottom: 0.5rem;
}

.terminal-header-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
}

.terminal-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    transition: all 0.3s ease;
    flex-shrink: 0;
}

.terminal-status-dot.status-online {
    background: var(--success);
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.terminal-status-dot.status-active {
    background: var(--accent-primary);
    box-shadow: 0 0 8px rgba(234, 179, 8, 0.5);
    animation: statusPulse 2s ease-in-out infinite;
}

.terminal-status-dot.status-busy {
    background: #38bdf8;
    box-shadow: 0 0 6px rgba(56, 189, 248, 0.5);
    animation: statusPulse 0.8s ease-in-out infinite;
}

.terminal-status-dot.status-error {
    background: var(--error);
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
}

@keyframes statusPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
}

.terminal-status-text {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
}

.terminal-header-title {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--text-muted);
    letter-spacing: 0.06em;
    font-weight: 700;
    opacity: 0.6;
}

.terminal-header-hint {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    color: var(--text-muted);
    opacity: 0.4;
    letter-spacing: 0.03em;
    transition: opacity 0.3s ease;
}

#terminal-line-container.expanded .terminal-header-hint {
    opacity: 0;
}

/* ---- Prompt Styling ---- */
#terminal-prompt {
    color: var(--text-muted);
    font-weight: bold;
    font-size: 0.9rem;
    line-height: 1;
    transition: color 0.2s ease, text-shadow 0.2s ease;
}

#terminal-line-container.focused #terminal-prompt {
    color: var(--accent-primary);
    text-shadow: 0 0 10px rgba(234, 179, 8, 0.4);
}

#terminal-line-container.interactive-prompt #terminal-prompt {
    color: var(--accent-primary);
    text-shadow: 0 0 8px var(--accent-primary);
    animation: terminal-blink 1s step-end infinite;
}

@keyframes terminal-blink {
    50% {
        opacity: 0;
    }
}

/* ---- History ---- */
#terminal-history {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.35s ease, opacity 0.3s ease;
    padding: 0 0.85rem;
}

#terminal-line-container.expanded #terminal-history {
    max-height: 14rem;
    opacity: 1;
    overflow-y: auto;
    padding-top: 0.4rem;
    padding-bottom: 0.3rem;
}

#terminal-history::-webkit-scrollbar {
    width: 3px;
}
#terminal-history::-webkit-scrollbar-track {
    background: transparent;
}
#terminal-history::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
}

.terminal-history-line {
    opacity: 0.8;
    font-size: 0.72rem;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
    line-height: 1.4;
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.15rem 0;
    animation: historyFadeIn 0.2s ease;
}

@keyframes historyFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 0.8; transform: translateY(0); }
}

.history-icon {
    flex-shrink: 0;
    font-size: 0.65rem;
    opacity: 0.6;
    width: 1rem;
    text-align: center;
    line-height: 1.5;
}

.history-text {
    flex: 1;
    min-width: 0;
}

/* Colors for system response logs */
.terminal-history-line.log-success, #terminal-text.log-success, .terminal-response-text.log-success {
    color: var(--success);
}
.terminal-history-line.log-error, #terminal-text.log-error, .terminal-response-text.log-error {
    color: var(--error);
}
.terminal-history-line.log-warning, #terminal-text.log-warning, .terminal-response-text.log-warning {
    color: var(--accent-primary);
}
.terminal-history-line.log-info, #terminal-text.log-info, .terminal-response-text.log-info {
    color: #38bdf8;
}

/* User input lines */
.terminal-history-line.log-user-input {
    color: var(--text-main);
    opacity: 1;
    font-weight: 500;
    border-left: 2px solid rgba(234, 179, 8, 0.25);
    padding-left: 0.5rem;
    margin-left: -0.15rem;
}

/* ---- Output Line (system responses) ---- */
.terminal-output-line {
    display: none;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    min-height: 0;
}

#terminal-line-container.expanded .terminal-output-line {
    display: flex;
}

.output-prompt {
    color: var(--accent-primary);
    font-size: 0.7rem;
    opacity: 0.5;
    line-height: 1.5;
    flex-shrink: 0;
}

#terminal-text {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-main);
    line-height: 1.4;
    font-size: 0.75rem;
}

#terminal-text:empty + .output-prompt,
.terminal-output-line:has(#terminal-text:empty) {
    min-height: 0;
    padding-top: 0;
    padding-bottom: 0;
}

/* ---- Input Line (user typing) ---- */
.terminal-input-line {
    display: none;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
}

#terminal-line-container.expanded .terminal-input-line {
    display: flex;
}

#terminal-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-main);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    padding: 0;
    margin: 0;
    caret-color: var(--accent-primary);
}


/* ---- Options List ---- */
#terminal-options-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.35s ease, opacity 0.3s ease;
    padding: 0 0.6rem;
}

#terminal-line-container.expanded #terminal-options-list {
    max-height: 20rem;
    opacity: 1;
    padding-bottom: 0.6rem;
}

/* Options separator label */
.terminal-options-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.25rem 0.35rem;
    user-select: none;
}

.options-label-text {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    color: var(--text-muted);
    white-space: nowrap;
    opacity: 0.7;
}

.options-label-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
}

/* Individual option items */
.terminal-option-item {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.55rem 0.65rem;
    border-radius: var(--radius-sm);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 0.55rem;
    background: transparent;
    border: 1px solid transparent;
    position: relative;
    overflow: hidden;
    margin-bottom: 2px;
}

.terminal-option-item:hover {
    background: rgba(234, 179, 8, 0.06);
    border-color: rgba(234, 179, 8, 0.12);
    color: var(--accent-primary);
    padding-left: 0.85rem;
    box-shadow: 0 2px 12px rgba(234, 179, 8, 0.06);
}

.terminal-option-item:active {
    transform: scale(0.98);
    background: rgba(234, 179, 8, 0.12);
}

/* Option number key badge */
.opt-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--text-muted);
    flex-shrink: 0;
    transition: all 0.2s ease;
}

.terminal-option-item:hover .opt-key {
    background: rgba(234, 179, 8, 0.12);
    border-color: rgba(234, 179, 8, 0.3);
    color: var(--accent-primary);
}

/* Option icon */
.opt-icon {
    font-size: 0.65rem;
    opacity: 0.5;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
    transition: opacity 0.2s ease;
}

.terminal-option-item:hover .opt-icon {
    opacity: 0.9;
    color: var(--accent-primary);
}

/* Option label */
.opt-label {
    flex: 1;
    letter-spacing: 0.02em;
    font-weight: 500;
}

/* Option arrow */
.opt-arrow {
    font-size: 0.9rem;
    opacity: 0;
    transform: translateX(-6px);
    transition: all 0.2s ease;
    color: var(--accent-primary);
}

.terminal-option-item:hover .opt-arrow {
    opacity: 0.7;
    transform: translateX(0);
}

/* Ripple effect */
.option-ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(234, 179, 8, 0.15);
    transform: scale(0);
    animation: rippleAnim 0.6s ease-out forwards;
    pointer-events: none;
    width: 120px;
    height: 120px;
    margin-left: -60px;
    margin-top: -60px;
}

@keyframes rippleAnim {
    0% { transform: scale(0); opacity: 1; }
    100% { transform: scale(3); opacity: 0; }
}

/* Collapsed state: hide everything except header */
#terminal-line-container:not(.expanded) .terminal-output-line {
    display: none;
}

#terminal-line-container:not(.expanded) .terminal-input-line {
    display: none;
}

#terminal-line-container:not(.expanded) #terminal-history {
    display: none;
}

#terminal-line-container:not(.expanded) #terminal-options-list {
    display: none;
}

/* ============================
   HUD BAR (top)
   ============================ */
#hud-bar {
    position: relative;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 1.5rem;
    background: rgba(10, 10, 10, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--glass-border);
    gap: 0.5rem;
    flex-shrink: 0;
}

.hud-left,
.hud-center,
.hud-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.hud-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
}

.hud-logo {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.05em;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 6px;
}

.hud-logo::before {
    content: '';
    display: block;
    width: 6px;
    height: 6px;
    background: var(--accent-primary);
    box-shadow: 0 0 8px var(--accent-primary);
    border-radius: 50%;
}

.hud-logo-dim {
    color: var(--text-muted);
    font-weight: 400;
}

.hud-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.hud-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.hud-icon svg,
.hud-badge svg,
.hud-badge-btn svg {
    width: 14px;
    height: 14px;
    stroke-width: 2px;
    display: inline-block;
    vertical-align: middle;
}

.hud-number {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-main);
    font-weight: 500;
}

.hud-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    padding: 0 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-secondary);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    background: var(--glass-panel);
    line-height: 1;
    transition: var(--transition-fast);
    gap: 0.3rem;
}

/* Badge-style buttons */
.hud-badge-btn {
    cursor: pointer;
    background: var(--glass-panel);
    border: 1px solid var(--glass-border);
}

.hud-badge-btn:hover {
    transform: none !important;
    background: var(--glass-highlight);
    border-color: var(--accent-primary);
    color: var(--text-main);
    box-shadow: 0 0 10px rgba(234, 179, 8, 0.15);
}

.hud-badge-btn:active {
    transform: scale(0.95);
}

/* Sanity Bar */
.sanity-bar {
    width: 80px;
    height: 6px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--glass-border);
}

#sanity-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--error), var(--accent-primary), var(--success));
    border-radius: var(--radius-sm);
    transition: width 0.5s var(--transition-fast);
}

.debug-btn {
    min-width: 28px;
    height: 28px;
    font-size: 0.8rem;
    opacity: 0.5;
    padding: 0;
}

.debug-btn:hover {
    opacity: 1;
}

/* ============================
   SETTINGS PANEL
   ============================ */
.settings-panel {
    position: absolute;
    top: calc(2.8rem + var(--safe-top));
    right: 1.5rem;
    z-index: 120;
    background: rgba(10, 10, 10, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: var(--shadow-card);
    transition: opacity var(--transition-fast), transform var(--transition-fast);
    min-width: 240px;
}

.settings-panel.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-8px) scale(0.97);
}

.settings-title {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    border-bottom: 1px solid var(--glass-border);
    padding-bottom: 0.5rem;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.control-group label {
    font-family: var(--font-sans);
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
}

/* Range Input */
input[type=range] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    outline: none;
}

input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 8px;
    background: var(--accent-primary);
    border-radius: 2px;
    cursor: pointer;
    box-shadow: 0 0 8px var(--accent-primary);
    transition: var(--transition-fast);
}

input[type=range]::-webkit-slider-thumb:hover {
    background: #facc15;
    box-shadow: 0 0 12px var(--accent-primary);
}

input[type=range]::-moz-range-thumb {
    height: 16px;
    width: 8px;
    background: var(--accent-primary);
    border: none;
    border-radius: 2px;
    cursor: pointer;
}

/* ============================
   GAME VIEWPORT (narrative)
   ============================ */
#game-viewport {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-start;
    position: relative;
    z-index: 5;
    min-height: 0;
    overflow: hidden;
}

/* Narrative Panel */
#narrative-panel {
    background: rgba(10, 10, 10, 0.75);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 1rem 1.25rem;
    margin-left: 2rem;
    margin-bottom: 1rem;
    max-width: 440px;
    box-shadow: var(--shadow-card);
    position: relative;
}

#room-title {
    font-family: var(--font-mono);
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-main);
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
    margin-bottom: 0.15rem;
    line-height: 1.2;
    text-transform: uppercase;
}

#room-subtitle {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    color: var(--accent-primary);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    opacity: 0.9;
    font-weight: 600;
}

#room-desc {
    font-family: var(--font-sans);
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--text-secondary);
    max-height: 22vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--glass-border) transparent;
}

.interactable-desc {
    margin-top: 0.6rem;
    font-family: var(--font-sans);
    font-size: 0.85rem;
    color: var(--accent-primary);
    opacity: 0.95;
    font-style: italic;
    line-height: 1.4;
    padding-left: 0.75rem;
    border-left: 2px solid var(--accent-primary);
}

/* ============================
   ACTIONS CONTAINER
   ============================ */
#actions-container {
    position: relative;
    z-index: 10;
    padding: 0.6rem 2rem;
    padding-bottom: calc(0.6rem + var(--safe-bottom));
    background: rgba(10, 10, 10, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    border-top: 1px solid var(--glass-border);
    flex-shrink: 0;
}

/* ============================
   BUTTONS
   ============================ */
button {
    appearance: none;
    -webkit-appearance: none;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--glass-border);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.03em;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    flex: 0 1 auto;
    min-width: 100px;
    position: relative;
    overflow: hidden;
    white-space: normal;
    text-align: center;
    line-height: 1.2;
    height: auto;
    min-height: 2.3rem;
}

button::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: var(--accent-primary);
    transform: scaleY(0);
    transform-origin: top;
    transition: transform var(--transition-fast);
    z-index: 2;
}

button:hover::before {
    transform: scaleY(1);
}

button:hover {
    border-color: var(--accent-primary);
    color: var(--text-main);
    background: rgba(234, 179, 8, 0.03);
    box-shadow: 0 4px 15px rgba(234, 179, 8, 0.08);
    transform: translateY(-2px);
}

button:active {
    transform: translateY(0px) scale(0.98);
}

/* Interaction groups & buttons */
.interaction-group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    width: 100%;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.8rem;
    margin-bottom: 0.1rem;
}

.interaction-group-label {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-right: 0.4rem;
}

button.interaction-btn {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--glass-border);
    color: var(--text-secondary);
    font-size: 0.75rem;
    padding: 0.25rem 0.75rem;
    min-height: auto;
    min-width: 70px;
    flex: 0 1 auto;
    justify-content: center;
    text-align: center;
    border-radius: 3px;
}

button.interaction-btn.active {
    background: rgba(239, 68, 68, 0.15) !important;
    border-color: var(--error) !important;
    color: #fff !important;
    opacity: 1;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.2) !important;
}

button.interaction-btn.active::before {
    transform: scaleY(1);
    background: var(--error);
}

button.interaction-btn:hover {
    border-color: var(--error) !important;
    background: rgba(239, 68, 68, 0.05);
    color: var(--text-main);
    opacity: 1;
}

button.interaction-btn.active:hover {
    border-color: #ff6666 !important;
    background: rgba(239, 68, 68, 0.25) !important;
}

button.interaction-btn:active {
    transform: scale(0.97);
}

/* Exit buttons */
button.exit-btn {
    flex: 0 1 auto;
    min-width: 130px;
    display: inline-flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
}

/* Continue button */
button.continue-btn {
    flex: 1 1 100%;
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: rgba(234, 179, 8, 0.02);
    font-size: 0.95rem;
    padding: 1rem;
}

button.continue-btn::before {
    background: var(--accent-primary);
}

button.continue-btn:hover {
    border-color: var(--accent-primary);
    box-shadow: 0 4px 15px rgba(234, 179, 8, 0.15);
    color: #fff;
}

/* Custom Category Colors */
button.custom-category-btn:hover {
    border-color: var(--btn-color) !important;
    box-shadow: 0 4px 15px var(--btn-glow) !important;
    color: #fff !important;
    background: rgba(255, 255, 255, 0.04) !important;
}

/* ============================
   EXIT BUTTON – BADGES (NEW / EXPLORE)
   ============================ */
.exit-label {
    display: block;
    line-height: 1.2;
}

.exit-icon-badges {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    pointer-events: none;
}

.exit-icon-badges svg {
    width: 12px;
    height: 12px;
    stroke-width: 2.5px;
    animation: exitIconPulse 2s ease-in-out infinite;
}

.exit-icon-new {
    color: var(--accent-primary);
    filter: drop-shadow(0 0 4px var(--accent-glow));
}

.exit-icon-recommend {
    color: var(--success);
    filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.3));
    animation-delay: 0.5s !important;
}

@keyframes exitIconPulse {
    0%, 100% {
        opacity: 0.6;
        transform: scale(0.95);
    }
    50% {
        opacity: 1;
        transform: scale(1.05);
    }
}

/* ============================
   MAP PANEL
   ============================ */
.map-panel {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 300px;
    height: 70vh;
    background: rgba(10, 10, 10, 0.85);
    border: 1px solid var(--glass-border);
    border-right: none;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    z-index: 90;
    transition: transform var(--transition-fast);
    display: flex;
    flex-direction: row;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: var(--shadow-card);
}

.map-panel.collapsed {
    transform: translate(300px, -50%);
}

.map-toggle-btn {
    position: absolute;
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(10, 10, 10, 0.85);
    border: 1px solid var(--glass-border);
    border-right: none;
    color: var(--text-secondary);
    padding: 1.5rem 0.6rem;
    cursor: pointer;
    font-family: var(--font-mono);
    letter-spacing: 2px;
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    writing-mode: vertical-rl;
    text-orientation: upright;
    font-weight: 700;
    transition: var(--transition-fast);
}

.map-toggle-btn:hover {
    transform: translateY(-50%) !important;
    background: var(--glass-highlight);
    color: var(--accent-primary);
    border-color: var(--accent-primary);
}

#map-svg text {
    paint-order: stroke fill;
    stroke: #0a0a0a;
    stroke-width: 3px;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.map-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    min-height: 0;
}

#map-svg {
    flex: 1;
    width: 100%;
    min-height: 0;
    display: block;
}

/* Legenda mapy */
.map-legend {
    flex-shrink: 0;
    padding: 0.6rem 0.8rem;
    border-top: 1px solid var(--glass-border);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-secondary);
}

.map-legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
}

.map-legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.map-legend-dot--current {
    background: #ffffff;
    box-shadow: 0 0 6px #ffffff;
}

.map-legend-dot--visited {
    background: var(--success);
    box-shadow: 0 0 6px var(--success);
}

.map-legend-dot--unknown {
    background: var(--text-muted);
    border: 1px solid var(--text-secondary);
}

/* Progress bar for auto-transition buttons */
.btn-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: var(--accent-primary);
    width: 0;
    pointer-events: none;
    box-shadow: 0 0 8px var(--accent-primary);
}

.btn-progress.animate {
    animation: btnProgressFill 11s linear forwards;
}

@keyframes btnProgressFill {
    from {
        width: 0%;
    }
    to {
        width: 100%;
    }
}

/* ============================
   SCROLLBAR
   ============================ */
::-webkit-scrollbar {
    width: 4px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: var(--glass-border);
    border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
}

/* ============================
   GLITCH FLASH
   ============================ */
.glitch-flash {
    animation: glitchFlash 0.08s steps(2) 2;
}

@keyframes glitchFlash {
    0% {
        filter: hue-rotate(0deg) brightness(1);
    }
    25% {
        filter: hue-rotate(90deg) brightness(1.5);
    }
    50% {
        filter: hue-rotate(-30deg) brightness(0.8);
    }
    100% {
        filter: hue-rotate(0deg) brightness(1);
    }
}

/* ============================
   GLITCH ARTIFACTS
   ============================ */
.glitch-slice {
    position: absolute;
    background: inherit;
    background-color: rgba(234, 179, 8, 0.15);
    mix-blend-mode: color-dodge;
    pointer-events: none;
    z-index: 2;
    overflow: hidden;
}

.glitch-slice::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(234, 179, 8, 0.25), transparent);
    animation: glitchMove 0.2s linear infinite;
}

@keyframes glitchMove {
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(100%);
    }
}

#scene-bg {
    transition: transform 0.1s ease-out;
}

/* ============================
   RESPONSIVE – TABLETS
   ============================ */
@media (min-width: 600px) and (max-width: 1024px) {
    #room-title {
        font-size: 1.8rem;
    }

    #room-desc {
        font-size: 1.1rem;
    }

    #actions-container {
        padding: 1.25rem 2rem;
    }

    button {
        padding: 0.8rem 1.5rem;
        font-size: 0.9rem;
    }

    #narrative-panel {
        padding: 3rem 2rem 1.2rem;
    }
}

/* ============================
   RESPONSIVE – DESKTOP
   ============================ */
@media (min-width: 1025px) {
    #app-container {
        max-width: 100%;
    }

    #hud-bar {
        padding: 0.5rem 3rem;
    }

    .sanity-bar {
        width: 100px;
    }

    #narrative-panel {
        padding: 1rem 1.25rem;
        max-width: 440px;
    }

    #room-title {
        font-size: 1.3rem;
    }

    #room-desc {
        font-size: 0.95rem;
    }

    #actions-container {
        padding: 0.6rem 3rem;
        max-width: 100%;
    }

    button {
        padding: 0.45rem 0.9rem;
        font-size: 0.78rem;
    }

    button.exit-btn {
        flex: 0 1 auto;
        min-width: 130px;
    }
}

/* ============================
   RESPONSIVE – SMALL PHONES
   ============================ */
@media (max-width: 380px) {
    #hud-bar {
        padding: 0.4rem 0.6rem;
        gap: 0.3rem;
    }

    #terminal-line-container {
        margin: 0.3rem 0.6rem;
        font-size: 0.7rem;
    }

    .hud-logo {
        font-size: 0.9rem;
        letter-spacing: -0.05em;
    }

    .sanity-bar {
        width: 50px;
    }

    .hud-badge {
        font-size: 0.75rem;
        padding: 0.15rem 0.35rem;
    }

    .hud-btn {
        width: 28px;
        height: 28px;
        font-size: 0.9rem;
    }

    #room-title {
        font-size: 1.4rem;
    }

    #room-desc {
        font-size: 0.95rem;
    }

    .interactable-desc {
        font-size: 0.9rem;
    }

    #narrative-panel {
        padding: 2rem 1rem 0.8rem;
    }

    #actions-container {
        padding: 0.6rem 0.8rem;
        gap: 0.4rem;
    }

    button {
        padding: 0.6rem 0.8rem;
        font-size: 0.8rem;
    }
}

/* ============================
   LANDSCAPE PHONE
   ============================ */
@media (max-height: 500px) and (orientation: landscape) {
    #hud-bar {
        padding: 0.3rem 1rem;
    }

    .hud-logo {
        display: none;
    }

    #narrative-panel {
        padding: 1.5rem 1.5rem 0.6rem;
    }

    #room-title {
        font-size: 1.3rem;
        margin-bottom: 0.3rem;
    }

    #room-desc {
        font-size: 0.95rem;
        max-height: 15vh;
    }

    .interactable-desc {
        font-size: 0.85rem;
    }
}

/* ============================
   MOBILE UI FIXES – PORTRAIT
   ============================ */
@media (max-width: 600px) and (orientation: portrait) {
    /* 1. HUD Optimized Grid Layout */
    #hud-bar {
        display: grid;
        grid-template-areas:
            "center center center"
            "left gap right";
        grid-template-columns: auto 1fr auto;
        gap: 0.5rem;
        padding: 0.6rem 0.8rem;
        padding-top: calc(0.5rem + var(--safe-top));
        height: auto;
        background: rgba(10, 10, 10, 0.98);
        border-bottom: 1px solid var(--glass-border);
    }

    .hud-center {
        grid-area: center;
        position: static;
        transform: none;
        width: 100%;
        justify-content: center;
        padding-bottom: 0.4rem;
        border-bottom: 1px solid var(--glass-border);
        margin-bottom: 0.2rem;
    }

    .hud-left {
        grid-area: left;
        justify-content: flex-start;
    }

    .hud-right {
        grid-area: right;
        justify-content: flex-end;
    }

    .hud-logo {
        font-size: 0.95rem;
    }

    .sanity-bar {
        width: 45px;
    }

    #sanity-value {
        font-size: 0.75rem;
    }

    .hud-badge {
        font-size: 0.75rem;
        padding: 0.15rem 0.4rem;
    }

    .hud-btn {
        width: 32px;
        height: 20px;
        font-size: 0.9rem;
    }

    /* 2. Better Background Scaling (Solid Bottom Bar) */
    #scene-bg {
        height: 70%;
        bottom: auto;
        border-bottom: 1px solid var(--glass-border);
    }

    #app-container {
        justify-content: flex-end;
    }

    #game-viewport {
        flex: 1;
        margin-bottom: 0;
        z-index: 5;
        justify-content: flex-end;
    }

    #actions-container {
        height: 30%;
        width: 100%;
        background: var(--bg-core);
        backdrop-filter: none;
        border-top: 1px solid var(--glass-border);
        overflow-y: auto;
        align-content: center;
        padding-bottom: max(1rem, var(--safe-bottom));
        z-index: 20;
    }

    #narrative-panel {
        max-height: 40vh;
        overflow-y: auto;
        background: rgba(10, 10, 10, 0.9);
        border-radius: var(--radius-md) var(--radius-md) 0 0;
        border-bottom: none;
        margin: 0;
        max-width: 100%;
        width: 100%;
    }
}

/* ============================
   ACCESSIBILITY – reduce motion
   ============================ */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }

    #scene-bg img {
        animation: none;
    }
}
```
