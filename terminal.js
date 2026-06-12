/**
 * TERMINAL INTERACTION SYSTEM (MODERNIZED v2)
 * Handles simulated terminal input/output, interactive typing prompt, and choices.
 * Enhanced UX: Better click targets, structured output, animated options, keyboard nav.
 */

/**
 * Dynamicznie generuje zglitchowany tekst z możliwością dostosowania parametrów.
 * 
 * @param {string} text - Tekst wejściowy do zniekształcenia.
 * @param {Object} options - Parametry konfiguracyjne.
 * @param {number} [options.percentage=25] - Jaki procent znaków ma zostać zniekształcony (0 - 100).
 * @param {number} [options.strength=1] - Jak mocny ma być glitch (wpływa na zalgo lub powtórzenia).
 * @param {string[]} [options.effects=['replace']] - Aktywne efekty (replace, zalgo, case, stutter, leet, binary, delete).
 * @returns {string} Zglitchowany tekst.
 */
function generateGlitchText(text, options = {}) {
    if (!text) return "";

    const percentage = options.percentage !== undefined ? options.percentage : 25;
    const strength = options.strength !== undefined ? options.strength : 1;
    const effects = options.effects && options.effects.length > 0 ? options.effects : ['replace'];

    const glitchChars = "░▒▓█▄▌▐▀☠☣⚡☢⚠◈◇⬡⟁✕◌!?@#$%^&*()_+-=[]{}|;':\",./<>?\\";
    const leetMap = {
        'A': '4', 'a': '4',
        'E': '3', 'e': '3',
        'I': '1', 'i': '1',
        'O': '0', 'o': '0',
        'S': '5', 's': '5',
        'T': '7', 't': '7',
        'G': '6', 'g': '6',
        'B': '8', 'b': '8',
        'Z': '2', 'z': '2'
    };

    const zalgoUp = ["\u030d", "\u030e", "\u0304", "\u0305", "\u033f", "\u0311", "\u0306", "\u0310", "\u0352", "\u0357", "\u030a", "\u0317", "\u032c", "\u0329", "\u0315", "\u031a", "\u0309", "\u0303", "\u0300", "\u0301", "\u0302", "\u030c", "\u0307", "\u0308", "\u030b", "\u030f", "\u0312", "\u0313", "\u0314", "\u031b", "\u031c", "\u031d", "\u031e", "\u031f", "\u0320", "\u0324", "\u0330", "\u0334", "\u0335", "\u0336", "\u0337", "\u0338", "\u0339", "\u033a", "\u033b", "\u033c", "\u0345", "\u034e", "\u0347", "\u0348", "\u0349", "\u034a", "\u034b", "\u034c", "\u034d", "\u0350", "\u0351", "\u035b"];
    const zalgoDown = ["\u0316", "\u0317", "\u0318", "\u0319", "\u031c", "\u031d", "\u031e", "\u031f", "\u0320", "\u0324", "\u0325", "\u0326", "\u0327", "\u0328", "\u032d", "\u032e", "\u0331", "\u0332", "\u0333", "\u0339", "\u033a", "\u033b", "\u033c", "\u0345", "\u0347", "\u0348", "\u0349", "\u034a", "\u034b", "\u034c", "\u034d", "\u034e", "\u0353", "\u0354", "\u0355", "\u0356", "\u0359", "\u035a", "\u032a", "\u032b", "\u032c"];
    const zalgoMid = ["\u0315", "\u0321", "\u0322", "\u0327", "\u0328", "\u0334", "\u0335", "\u0336", "\u0337", "\u0338", "\u035c", "\u035d", "\u035e", "\u035f", "\u0360", "\u0362", "\u0332", "\u0344"];
    const zalgoAll = [...zalgoUp, ...zalgoDown, ...zalgoMid];

    let output = "";

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '\n') {
            output += '\n';
            continue;
        }

        if (Math.random() * 100 >= percentage) {
            output += char;
            continue;
        }

        const effect = effects[Math.floor(Math.random() * effects.length)];

        switch (effect) {
            case 'replace':
                output += glitchChars[Math.floor(Math.random() * glitchChars.length)];
                break;

            case 'zalgo':
                let zalgoChar = char;
                const count = Math.max(1, Math.min(15, Math.floor(strength * 3)));
                for (let j = 0; j < count; j++) {
                    zalgoChar += zalgoAll[Math.floor(Math.random() * zalgoAll.length)];
                }
                output += zalgoChar;
                break;

            case 'case':
                output += (char === char.toUpperCase()) ? char.toLowerCase() : char.toUpperCase();
                break;

            case 'stutter':
                const stutterTimes = Math.max(1, Math.min(5, Math.floor(strength)));
                let stuttered = "";
                for (let j = 0; j < stutterTimes; j++) {
                    stuttered += char + "-";
                }
                stuttered += char;
                output += stuttered;
                break;

            case 'leet':
                output += leetMap[char] || char;
                break;

            case 'binary':
                output += Math.random() < 0.5 ? '0' : '1';
                break;

            case 'delete':
                break;

            default:
                output += char;
                break;
        }
    }

    return output;
}

window.generateGlitchText = generateGlitchText;

/* === CLI COMMAND PATTERN === */

class TerminalCommandRegistry {
    constructor(terminal) {
        this.terminal = terminal;
        this.commands = new Map();
    }

    register(cmd) {
        cmd.names.forEach(name => {
            this.commands.set(name.toUpperCase(), cmd);
        });
    }

    execute(cmdName, args, inputVal) {
        const cmd = this.commands.get(cmdName.toUpperCase());
        if (cmd) {
            cmd.execute(this.terminal, args, inputVal);
            return true;
        }
        return false;
    }
}

class HelpCommand {
    constructor() {
        this.names = ['HELP', '?'];
    }
    execute(ts) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        playSuccess();
        const helpLines = [
            "+----------------------------------------+",
            "|     TERMINAL COMMAND REFERENCE          |",
            "+----------------------------------------+",
            "|  HELP      - Show this reference        |",
            "|  INVENTORY - List inventory items       |",
            "|  DRINK     - Consume Almond Water       |",
            "|  GO [EXIT] - Move to an exit            |",
            "|  ACT [OBJ] - Interact with object       |",
            "|  SCAN      - Scan for exits             |",
            "|  MAP       - Toggle map view            |",
            "|  SANITY    - Check sanity status        |",
            "|  SYS       - System diagnostics         |",
            "|  CLEAR     - Clear terminal history     |",
            "|  RESET     - Reboot system              |",
            "+----------------------------------------+",
            "|  TIP: Click options or type numbers     |",
            "|  KEYS: Up/Dn History - Tab Autocomplete |",
            "+----------------------------------------+"
        ];
        ts.typeResponse(helpLines.join("\n"), null, 'info', '?');
    }
}

class ClearCommand {
    constructor() {
        this.names = ['CLEAR', 'CLS'];
    }
    execute(ts) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        ts.history = [];
        ts.renderHistory();
        ts.typeResponse("TERMINAL HISTORY CLEARED.", null, 'success', '✓');
        playSuccess();
    }
}

class ResetCommand {
    constructor() {
        this.names = ['RESET'];
    }
    execute(ts) {
        if (confirm("REBOOT SYSTEM? ALL SESSION DATA WILL BE WIPED.")) {
            localStorage.removeItem('backrooms_session');
            window.location.hash = '';
            location.reload();
        }
    }
}

class InventoryCommand {
    constructor() {
        this.names = ['INVENTORY', 'INV'];
    }
    execute(ts) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };
        if (window.game) {
            playSuccess();
            const inv = window.game.state.inventory || {};
            const items = Object.entries(inv).filter(([_, count]) => count > 0);
            if (items.length === 0) {
                ts.typeResponse("INVENTORY IS EMPTY.", null, 'warning', '◆');
            } else {
                let lines = ["┌─ CURRENT INVENTORY ──────────────┐"];
                items.forEach(([item, count]) => {
                    lines.push(`│  ◆ ${item.replace('_', ' ').toUpperCase()}: x${count}`);
                });
                lines.push("└──────────────────────────────────┘");
                ts.typeResponse(lines.join("\n"), null, 'info', '◆');
            }
        } else {
            ts.typeResponse("INVENTORY SYSTEM OFFLINE.", null, 'error', '✕');
            playError();
        }
    }
}

class DrinkCommand {
    constructor() {
        this.names = ['DRINK'];
    }
    execute(ts, args, inputVal) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };
        if (window.game) {
            const parts = inputVal.trim().toUpperCase().split(' ');
            const itemArg = parts.length > 1 ? parts.slice(1).join('_').toLowerCase() : 'almond_water';
            const inv = window.game.state.inventory || {};
            
            if (inv[itemArg] && inv[itemArg] > 0) {
                if (itemArg === 'almond_water') {
                    inv[itemArg]--;
                    window.game.state.sanity = Math.min(100, window.game.state.sanity + 25);
                    window.game.saveSession();
                    window.game.render();
                    playSuccess();
                    ts.typeResponse("YOU DRANK ALMOND WATER. SANITY RESTORED (+25%).", null, 'success', '▶');
                } else {
                    ts.typeResponse(`ITEM '${itemArg.replace('_', ' ').toUpperCase()}' IS NOT CONSUMABLE.`, null, 'warning', '✕');
                    playError();
                }
            } else {
                ts.typeResponse(`YOU DO NOT HAVE ANY '${itemArg.replace('_', ' ').toUpperCase()}'.`, null, 'error', '✕');
                playError();
            }
        } else {
            ts.typeResponse("INVENTORY SYSTEM OFFLINE.", null, 'error', '✕');
            playError();
        }
    }
}

class MapCommand {
    constructor() {
        this.names = ['MAP'];
    }
    execute(ts) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };
        const mapPanel = document.getElementById('map-panel');
        if (mapPanel && window.game && window.game.mapGraph) {
            mapPanel.classList.toggle('collapsed');
            if (!mapPanel.classList.contains('collapsed')) {
                window.game.mapGraph.update();
                ts.typeResponse("MAP INTERFACE ACTIVATED.", null, 'success', '◈');
            } else {
                ts.typeResponse("MAP INTERFACE DEACTIVATED.", null, 'warning', '◈');
            }
            playSuccess();
        } else {
            ts.typeResponse("MAP SYSTEM OFFLINE.", null, 'error', '✕');
            playError();
        }
    }
}

class SanityCommand {
    constructor() {
        this.names = ['SANITY'];
    }
    execute(ts) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };
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
        ts.typeResponse(sanityReport, null, type, '◈');
    }
}

class DiagnosticsCommand {
    constructor() {
        this.names = ['DIAGNOSTICS', 'SYS'];
    }
    execute(ts) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };
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
            
            ts.typeResponse(stats, null, 'info', '◈');
        } else {
            ts.typeResponse("DIAGNOSTICS SERVICE OFFLINE.", null, 'error', '✕');
            playError();
        }
    }
}

class ScanCommand {
    constructor() {
        this.names = ['SCAN', 'PING'];
    }
    execute(ts) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };
        if (window.game) {
            playSuccess();
            const exits = window.game.getCurrentLocation().getActions();
            if (exits.length === 0) {
                ts.typeResponse("SCAN COMPLETE — NO EXIT VECTORS DETECTED.", null, 'warning', '◉');
            } else {
                let lines = ["┌─ ENVIRONMENT SCAN ───────────────┐"];
                exits.forEach((e, i) => {
                    const status = e.isUnknown ? "NEW" : "KNOWN";
                    const recommend = e.isRecommended ? " ★" : "";
                    const statusIcon = e.isUnknown ? "◆" : "◇";
                    lines.push(`│  ${statusIcon} ${e.label.toUpperCase()} [${status}]${recommend}`);
                });
                lines.push("└──────────────────────────────────┘");
                ts.typeResponse(lines.join("\n"), null, 'info', '◉');
            }
        } else {
            ts.typeResponse("SCANNER OFFLINE.", null, 'error', '✕');
            playError();
        }
    }
}

class GoCommand {
    constructor() {
        this.names = ['GO', 'MOVE'];
    }
    execute(ts, args, inputVal) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };
        const cmdUpper = inputVal.trim().toUpperCase();
        const spaceIdx = cmdUpper.indexOf(' ');
        const exitLabel = spaceIdx !== -1 ? inputVal.trim().substring(spaceIdx).trim().toUpperCase() : '';
        
        if (!exitLabel) {
            ts.typeResponse("USAGE: GO [EXIT_NAME_OR_ROOM_NAME]", null, 'warning', '✕');
            playError();
            return;
        }

        if (window.game) {
            const exits = window.game.getCurrentLocation().getActions();
            const found = exits.find(e => 
                e.label.toUpperCase().includes(exitLabel) || 
                (e.extra && window.game.world.rooms[e.extra] && window.game.world.rooms[e.extra].name.toUpperCase().includes(exitLabel))
            );
            if (found) {
                playSuccess();
                ts.typeResponse(`NAVIGATING → ${found.label.toUpperCase()}...`, null, 'success', '→');
                setTimeout(() => {
                    window.game.handleAction('tra', found.id, found.extra);
                }, 500);
            } else {
                ts.typeResponse(`PATH ERROR: '${exitLabel}' NOT FOUND.`, null, 'error', '✕');
                playError();
            }
        } else {
            ts.typeResponse("NAVIGATION ENGINE OFFLINE.", null, 'error', '✕');
            playError();
        }
    }
}

class ActCommand {
    constructor() {
        this.names = ['ACT', 'USE'];
    }
    execute(ts, args, inputVal) {
        const playSuccess = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('success'); };
        const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };
        const cmdUpper = inputVal.trim().toUpperCase();
        const spaceIdx = cmdUpper.indexOf(' ');
        const rawParams = spaceIdx !== -1 ? inputVal.trim().substring(spaceIdx).trim() : '';
        
        if (!rawParams) {
            ts.typeResponse("USAGE: ACT [OBJECT_NAME] [STATE_NAME]", null, 'warning', '✕');
            playError();
            return;
        }

        const params = rawParams.split(' ');
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
                        ts.typeResponse(`EXECUTING: ${foundInteractable.label.toUpperCase()} → ${stateSearch}`, null, 'success', '⚡');
                        setTimeout(() => {
                            window.game.handleAction('act', foundInterId, stateIdx);
                        }, 500);
                    } else {
                        const statesStr = foundInteractable.states.map(s => (s.label || s.id).toUpperCase()).join(' · ');
                        ts.typeResponse(`VALID STATES FOR ${foundInteractable.label.toUpperCase()}: ${statesStr}`, null, 'warning', '?');
                        playError();
                    }
                } else {
                    playSuccess();
                    ts.typeResponse(`CYCLING: ${foundInteractable.label.toUpperCase()}`, null, 'success', '↺');
                    setTimeout(() => {
                        window.game.handleAction('act', foundInterId, null);
                    }, 500);
                }
            } else {
                const inv = window.game.state.inventory || {};
                const itemKey = interSearch.toLowerCase().replace(' ', '_');
                if (inv[itemKey] !== undefined && inv[itemKey] > 0) {
                    playSuccess();
                    ts.typeResponse(`ITEM '${interSearch}' IS IN YOUR INVENTORY (x${inv[itemKey]}). USE IT ON A ROOM OBJECT OR TYPE A SPECIFIC ACTION.`, null, 'info', '◆');
                } else {
                    ts.typeResponse(`TARGET '${interSearch}' NOT FOUND.`, null, 'error', '✕');
                    playError();
                }
            }
        } else {
            ts.typeResponse("CONTROL SYSTEM OFFLINE.", null, 'error', '✕');
            playError();
        }
    }
}

const TerminalSystem = {
    isTyping: false,
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
    availableCommands: ['HELP', 'CLEAR', 'CLS', 'RESET', 'MAP', 'SANITY', 'DIAGNOSTICS', 'SYS', 'SCAN', 'PING', 'GO', 'MOVE', 'ACT', 'USE', 'INVENTORY', 'INV', 'DRINK'],
    currentLogType: '', // Current response log type ('success', 'error', 'warning', 'info', '')
    selectedOptionIndex: -1, // For keyboard navigation of options

    async init() {
        this.terminalContainer = document.getElementById('terminal-line-container');
        this.terminalHistoryEl = document.getElementById('terminal-history');
        this.terminalInputEl = document.getElementById('terminal-input');
        this.terminalOptionsEl = document.getElementById('terminal-options-list');
        this.terminalHeaderEl = document.getElementById('terminal-header');

        if (!this.terminalContainer || !this.terminalInputEl || !this.terminalOptionsEl) return;

        // Load dialogue tree from JSON
        try {
            const response = await fetch('terminal_dialogue.json');
            this.dialogueTree = await response.json();
        } catch (err) {
            console.error("Failed to load terminal dialogue:", err);
            this.dialogueTree = { "INITIAL": { text: "SYSTEM ERROR: DIALOGUE DATA MISSING.", options: [] } };
        }

        // Setup command registry
        this.commandRegistry = new TerminalCommandRegistry(this);
        this.commandRegistry.register(new HelpCommand());
        this.commandRegistry.register(new ClearCommand());
        this.commandRegistry.register(new ResetCommand());
        this.commandRegistry.register(new InventoryCommand());
        this.commandRegistry.register(new DrinkCommand());
        this.commandRegistry.register(new MapCommand());
        this.commandRegistry.register(new SanityCommand());
        this.commandRegistry.register(new DiagnosticsCommand());
        this.commandRegistry.register(new ScanCommand());
        this.commandRegistry.register(new GoCommand());
        this.commandRegistry.register(new ActCommand());

        this.availableCommands = Array.from(this.commandRegistry.commands.keys());

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
                } else if (this.activeChoices.length > 0 && this.selectedOptionIndex !== -1) {
                    const picked = this.activeChoices[this.selectedOptionIndex];
                    this.selectChoice(picked);
                }
                this.terminalInputEl.value = "";
            } else if (e.key === 'Escape') {
                this.collapseTerminal();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.activeChoices.length > 0) {
                    if (this.selectedOptionIndex > 0) {
                        this.selectedOptionIndex--;
                    } else {
                        this.selectedOptionIndex = this.activeChoices.length - 1;
                    }
                    this.updateSelectedOptionHighlight();
                } else if (this.cmdHistory.length > 0) {
                    if (this.cmdHistoryIndex > 0) {
                        this.cmdHistoryIndex--;
                    } else {
                        this.cmdHistoryIndex = 0;
                    }
                    this.terminalInputEl.value = this.cmdHistory[this.cmdHistoryIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.activeChoices.length > 0) {
                    if (this.selectedOptionIndex < this.activeChoices.length - 1) {
                        this.selectedOptionIndex++;
                    } else {
                        this.selectedOptionIndex = 0;
                    }
                    this.updateSelectedOptionHighlight();
                } else if (this.cmdHistory.length > 0) {
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

            // Reset selected option index on typing other keys
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter' && e.key !== 'Tab' && e.key !== 'Escape') {
                this.selectedOptionIndex = -1;
                this.updateSelectedOptionHighlight();
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

    isInteractionAvailable() {
        if (!window.game || !window.game.world) return false;
        
        // 1. Check if the active atmospheric text has a dialogue
        if (window.game.state && window.game.state.activeAtmosphericText) {
            const atm = window.game.state.activeAtmosphericText;
            if (atm && typeof atm === 'object' && atm.dialogue_id && this.dialogueTree[atm.dialogue_id]) {
                return true;
            }
        }
        
        // 2. Check if the current room has a room-specific dialogue node
        if (window.game.state && window.game.state.currentRoom) {
            const roomDialogueId = "ROOM_" + window.game.state.currentRoom.toUpperCase();
            if (this.dialogueTree[roomDialogueId]) {
                return true;
            }
        }

        // 3. If the current terminal state is not INITIAL
        if (this.currentState !== "INITIAL") {
            return true;
        }
        
        return false;
    },

    updateHeaderStatus(status) {
        if (!this.terminalHeaderEl) return;
        const statusDot = this.terminalHeaderEl.querySelector('.terminal-status-dot');
        const statusText = this.terminalHeaderEl.querySelector('.terminal-status-text');
        if (statusDot) {
            let className = 'terminal-status-dot status-' + status;
            if (this.isInteractionAvailable()) {
                className += ' status-blink';
            }
            statusDot.className = className;
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

        // Check if there is a room-specific dialogue node as fallback if stateId is INITIAL
        if (stateId === "INITIAL" && window.game && window.game.state && window.game.state.currentRoom) {
            const roomDialogueId = "ROOM_" + window.game.state.currentRoom.toUpperCase();
            if (this.dialogueTree[roomDialogueId]) {
                stateId = roomDialogueId;
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

        // Filter options based on requirements (allowing sanity-gated options to remain visible as glitched)
        const processedOptions = [];
        options.forEach(opt => {
            let failedSanity = false;
            let sanityRequiredText = "";
            let keep = true;

            if (opt.requirements && window.game) {
                // Check non-sanity requirements using central logic in app.js
                const nonSanityReqs = { ...opt.requirements };
                delete nonSanityReqs.sanity_min;
                delete nonSanityReqs.sanity_max;
                
                const otherMet = window.game.checkRequirements(nonSanityReqs);

                if (!otherMet) {
                    keep = false;
                } else {
                    // Check sanity requirements
                    let sanityMet = true;
                    if (opt.requirements.sanity_min !== undefined && window.game.state.sanity < parseInt(opt.requirements.sanity_min)) {
                        sanityMet = false;
                        sanityRequiredText = `MIN SANITY ${opt.requirements.sanity_min}%`;
                    }
                    if (opt.requirements.sanity_max !== undefined && window.game.state.sanity > parseInt(opt.requirements.sanity_max)) {
                        sanityMet = false;
                        sanityRequiredText = `MAX SANITY ${opt.requirements.sanity_max}%`;
                    }
                    if (!sanityMet) {
                        failedSanity = true;
                    }
                }
            }

            if (keep) {
                processedOptions.push({
                    ...opt,
                    failedSanity,
                    sanityRequiredText
                });
            }
        });

        this.activeChoices = processedOptions;

        if (processedOptions.length === 0) {
            return;
        }

        // Add separator label
        const separator = document.createElement('div');
        separator.className = 'terminal-options-label';
        separator.innerHTML = `<span class="options-label-line"></span><span class="options-label-text">AVAILABLE ACTIONS</span><span class="options-label-line"></span>`;
        this.terminalOptionsEl.appendChild(separator);

        processedOptions.forEach((opt, index) => {
            const item = document.createElement('div');
            item.className = 'terminal-option-item';
            if (opt.failedSanity) {
                item.className += ' opt-failed-sanity';
            }
            item.setAttribute('data-index', index);
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');

            // Determine icon based on option label
            const icon = this._getOptionIcon(opt.label);

            let displayLabel = opt.label.toUpperCase();
            if (opt.failedSanity) {
                displayLabel = this._glitchText(displayLabel);
            }

            item.innerHTML = `
                <span class="opt-key">${index + 1}</span>
                <span class="opt-icon">${icon}</span>
                <span class="opt-label">${displayLabel}</span>
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
        this.updateSelectedOptionHighlight();
    },

    _glitchText(text) {
        return window.generateGlitchText(text, {
            percentage: 30,
            strength: 2,
            effects: ['replace', 'case', 'zalgo']
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

    updateSelectedOptionHighlight() {
        if (!this.terminalOptionsEl) return;
        const items = this.terminalOptionsEl.querySelectorAll('.terminal-option-item');
        items.forEach((item, index) => {
            if (index === this.selectedOptionIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    },

    selectChoice(option) {
        this.selectedOptionIndex = -1;
        this.updateSelectedOptionHighlight();

        // If option failed sanity check, show feedback and warning text, play error sound, and return
        if (option.failedSanity) {
            if (window.game && window.game.audio) {
                window.game.audio.playUiSound('error');
            }
            let displayLabel = option.label.toUpperCase();
            this.addToHistory("» " + displayLabel, 'user-input', '▸');
            this.typeResponse(`ERROR: SANITY DEVIATION DETECTED. REQUIRED: ${option.sanityRequiredText}`, null, 'error', '✕');
            return;
        }

        // Add selected option label to history with user-input styling
        this.addToHistory("» " + option.label.toUpperCase(), 'user-input', '▸');

        // Execute side effects if they are defined on the choice
        if (option.effects && window.game) {
            window.game.processEffects(option.effects);
        }

        this.currentState = option.next;
        this.updateHeaderStatus('busy');
        const nextState = this.dialogueTree[this.currentState];
        if (nextState) {
            // Execute side effects if they are defined on the dialogue state itself
            if (nextState.effects && window.game) {
                window.game.processEffects(nextState.effects);
            }

            this.typeResponse(nextState.text, () => {
                this.showActiveDialogueOptions();
                this.updateHeaderStatus('active');
            });
        }
    },

    handleInput(inputVal) {
        const rawCmd = inputVal.trim();
        const cmd = rawCmd.toUpperCase();

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

        // 4. Otherwise, parse standard terminal commands:
        const spaceIdx = cmd.indexOf(' ');
        const baseCmd = spaceIdx !== -1 ? cmd.substring(0, spaceIdx) : cmd;
        const args = spaceIdx !== -1 ? rawCmd.substring(spaceIdx).trim().split(' ') : [];

        const executed = this.commandRegistry.execute(baseCmd, args, rawCmd);
        if (!executed) {
            const playError = () => { if (window.game && window.game.audio) window.game.audio.playUiSound('error'); };
            this.typeResponse(`UNKNOWN: '${cmd}' — TYPE 'HELP' FOR COMMANDS.`, null, 'error', '✕');
            playError();
        }
    },

    addToHistory(text, type = '', icon = '') {
        const formattedText = this.formatText(text);
        const lineObj = { text: formattedText, type, icon };
        this.history.push(lineObj);
        
        if (this.terminalHistoryEl) {
            this.appendHistoryLine(lineObj);
            
            if (this.history.length > 30) {
                this.history.shift();
                if (this.terminalHistoryEl.firstElementChild) {
                    this.terminalHistoryEl.firstElementChild.remove();
                }
            }
            // Smooth scroll to bottom
            requestAnimationFrame(() => {
                this.terminalHistoryEl.scrollTop = this.terminalHistoryEl.scrollHeight;
            });
        }
    },

    appendHistoryLine(lineObj) {
        if (!this.terminalHistoryEl) return;
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
    },

    renderHistory() {
        if (!this.terminalHistoryEl) return;
        this.terminalHistoryEl.innerHTML = "";
        this.history.forEach(lineObj => {
            this.appendHistoryLine(lineObj);
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

    formatText(text) {
        if (!text) return "";
        let formatted = text;
        if (window.game) {
            formatted = formatted.replace(/{SANITY}/gi, Math.floor(window.game.state.sanity) + "%");
            
            const loc = window.game.getCurrentLocation();
            if (loc) {
                formatted = formatted.replace(/{ROOM}/gi, loc.getName().toUpperCase());
            }
            
            if (window.game.state.visitedRooms) {
                formatted = formatted.replace(/{VISITED}/gi, window.game.state.visitedRooms.length);
            }
            
            if (window.game.world && window.game.world.rooms) {
                const totalRooms = Object.keys(window.game.world.rooms).length;
                formatted = formatted.replace(/{TOTAL}/gi, totalRooms);
            }
            
            if (window.game.state.currentRoom) {
                const seedHash = Math.abs(window.game.state.currentRoom.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)) % 10000;
                formatted = formatted.replace(/{SEED}/gi, "0x" + seedHash.toString(16).toUpperCase());
            }

            // Inventory replacement
            if (window.game.state.inventory) {
                const invLines = Object.entries(window.game.state.inventory)
                    .filter(([_, count]) => count > 0)
                    .map(([item, count]) => ` - ${item.replace('_', ' ').toUpperCase()}: x${count}`)
                    .join('\n');
                formatted = formatted.replace(/{INVENTORY}/gi, invLines || "(INVENTORY EMPTY)");
            } else {
                formatted = formatted.replace(/{INVENTORY}/gi, "(INVENTORY EMPTY)");
            }
        }
        return formatted;
    },

    typeResponse(text, callback, logType = '', icon = '') {
        this.currentLogType = logType;
        this.updateHeaderStatus('busy');
        
        const formattedText = this.formatText(text);

        const lineObj = { text: "", type: logType, icon: icon };
        this.history.push(lineObj);
        
        let textSpan = null;
        if (this.terminalHistoryEl) {
            this.appendHistoryLine(lineObj);
            const lastLine = this.terminalHistoryEl.lastElementChild;
            if (lastLine) {
                textSpan = lastLine.querySelector('.history-text');
            }
            
            if (this.history.length > 30) {
                this.history.shift();
                if (this.terminalHistoryEl.firstElementChild) {
                    this.terminalHistoryEl.firstElementChild.remove();
                }
            }
            requestAnimationFrame(() => {
                this.terminalHistoryEl.scrollTop = this.terminalHistoryEl.scrollHeight;
            });
        }

        if (window.game) {
            window.game.typeTerminalText(formattedText, () => {
                this.updateHeaderStatus(this.terminalContainer.classList.contains('expanded') ? 'active' : 'online');
                lineObj.text = formattedText;
                if (callback) callback();
            }, textSpan);
        } else {
            // Fallback typing animation
            this.isTyping = true;
            let i = 0;
            const type = () => {
                if (i < formattedText.length) {
                    if (textSpan) textSpan.innerText = formattedText.substring(0, i + 1) + "█";
                    i++;
                    setTimeout(type, 8);
                } else {
                    if (textSpan) textSpan.innerText = formattedText;
                    lineObj.text = formattedText;
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
