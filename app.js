/**
 * LIMINAL OS - Backrooms Game Engine (Vanilla JS)
 * Tag-based media resolution system
 */

/* === CONFIGURATION === */
// Set this to your external CDN/storage base URL (e.g. "https://cdn.liminalos.com/") to load graphics externally.
const CONFIG_MEDIA_BASE_URL = "";

/* === CORE LOCATION CLASSES === */

class Location {
    constructor(game, id) {
        this.game = game;
        this.id = id;
    }

    get isTransition() { return false; }

    getName() { return "UNKNOWN"; }
    getSubtitle() { return ""; }
    getDescription() { return ""; }
    getImage() { 
        return CONFIG_MEDIA_BASE_URL 
            ? `${CONFIG_MEDIA_BASE_URL.endsWith('/') ? CONFIG_MEDIA_BASE_URL : CONFIG_MEDIA_BASE_URL + '/'}media/uploads/fallback.png` 
            : "media/uploads/fallback.png"; 
    }

    getTerminalTexts() { return []; }

    // Returns array of interactable IDs (filtered by requirements)
    getInteractables() { return []; }

    // Returns actions (exits/continue buttons)
    getActions() { return []; }
}

class RoomLocation extends Location {
    constructor(game, id) {
        super(game, id);
        this.data = this.game.world.rooms[id] || {};

        // Transitions are now global and generated at start
    }

    get isTransition() { return false; }

    getName() {
        return this.data.name || "Unknown Room";
    }

    getSubtitle() {
        return "";
    }

    getDescription() {
        return this.data.desc || "No description.";
    }

    getTerminalTexts() {
        return this.data.texts || [];
    }

    getImage() {
        // Logic specific to Room Image resolution
        if (this.game.state.activeInteractableId) {
            const interId = this.game.state.activeInteractableId;
            const roomInteractables = this.data.interactables || [];

            // Check if interactable is effectively in this room
            const isInRoom = roomInteractables.some(item => {
                const id = typeof item === 'string' ? item : item.id;
                return id === interId;
            });

            if (isInRoom) {
                const interactable = this.game.world.interactables[interId];
                if (interactable) {
                    const stateIndex = this.game.state.worldStates[interId] || 0;
                    const state = interactable.states[stateIndex];
                    if (state && state.image) {
                        return this.game.resolveImagePath(state.image);
                    }
                }
            }
        }

        if (this.game.state.roomImages[this.id]) {
            return this.game.resolveImagePath(this.game.state.roomImages[this.id]);
        }

        const options = this.game.imageIndex.rooms[this.id] || [];
        if (options.length > 0) {
            const picked = options[Math.floor(Math.random() * options.length)];
            this.game.state.roomImages[this.id] = picked;
            return this.game.resolveImagePath(picked);
        }

        return this.game.resolveImagePath('rooms/lobby/default.png');
    }

    getInteractables() {
        return (this.data.interactables || []).filter(item => {
            const req = typeof item === 'string' ? null : item.requirements;
            return this.game.checkRequirements(req);
        }).map(item => typeof item === 'string' ? item : item.id);
    }

    getActions() {
        const stored = this.game.state.roomTransitions[this.id] || [];

        // Compute recommended exits using BFS pathfinding hint
        const recommended = (typeof getRecommendedExits === 'function')
            ? getRecommendedExits(this.game)
            : new Set();

        // Filter by requirements and transform to action objects
        return stored.filter(t => this.game.checkRequirements(t.requirements))
            .map(t => {
                const category = this.game.getTransitionCategory(t.id);
                const isUnknown = !this.game.state.visitedRooms.includes(t.target);
                const isRecommended = recommended.has(t.id);
                return {
                    type: 'tra',
                    label: t.label,
                    value: t.id,
                    extra: t.target,
                    id: t.id,
                    category,
                    isUnknown,
                    isRecommended   // true if taking this exit leads toward undiscovered rooms
                };
            });
    }
}

class TransitionLocation extends Location {
    constructor(game, context) {
        super(game, context.id);
        this.targetId = context.target;
        this.definition = null;

        // Resolve Definition
        for (const category in this.game.world.transition_types) {
            const t = this.game.world.transition_types[category].find(item => item.id === this.id);
            if (t) { this.definition = { ...t, category }; break; }
        }
    }

    get isTransition() { return true; }

    getName() {
        const targetRoom = this.game.world.rooms[this.targetId];
        return targetRoom ? targetRoom.name : "Unknown Room";
    }

    getSubtitle() {
        return this.definition ? `/// ${this.definition.category.toUpperCase()} ///` : "/// TRANSITION ///";
    }

    getDescription() {
        return this.definition ? this.definition.desc : "You are moving between locations...";
    }

    getTerminalTexts() {
        return this.definition ? (this.definition.texts || []) : [];
    }

    getImage() {
        if (this.game.state.transitionImages[this.id]) {
            return this.game.resolveImagePath(this.game.state.transitionImages[this.id]);
        }

        if (this.definition) {
            const category = this.definition.category;
            const options = this.game.imageIndex.transitions[this.id] || this.game.imageIndex.transitions[category] || [];
            if (options.length > 0) {
                const picked = options[Math.floor(Math.random() * options.length)];
                this.game.state.transitionImages[this.id] = picked;
                return this.game.resolveImagePath(picked);
            }
        }
        return this.game.resolveImagePath('rooms/lobby/default.png');
    }

    getInteractables() {
        // Now Transitions can have interactables too if defined in JSON!
        const items = this.definition && this.definition.interactables ? this.definition.interactables : [];
        return items.filter(item => {
            const req = typeof item === 'string' ? null : item.requirements;
            return this.game.checkRequirements(req);
        }).map(item => typeof item === 'string' ? item : item.id);
    }

    getActions() {
        return [{
            type: 'mov',
            label: "▸ Continue walking...",
            value: this.targetId,
            extra: null,
            category: this.definition ? this.definition.category : null
        }];
    }
}

class BackroomsGame {
    constructor() {
        this.world = null;
        this.audio = new AudioEngine();

        // Background display parameters
        this.bgMargin = 20; // Default margin in pixels (top and bottom)

        this.state = {
            currentRoom: 'lobby',
            sanity: 100,
            visitedRooms: ['lobby'],
            worldStates: {}, // Interactable states
            activeInteractableId: null,
            isTransitioning: false,
            transitionContext: null,
            roomImages: {},
            transitionImages: {},
            roomTransitions: {},
            bfsDepth: {},       // Głębokość BFS każdego pokoju od startu (dla układu mapy)
            inventory: {
                almond_water: 1 // Start with 1 Almond Water
            }
        };

        // DOM Elements
        this.elements = {
            sanityFill: document.getElementById('sanity-fill'),
            sanityValue: document.getElementById('sanity-value'),
            discoveredValue: document.getElementById('discovered-value'),
            roomTitle: document.getElementById('room-title'),
            roomSubtitle: document.getElementById('room-subtitle'),
            roomDesc: document.getElementById('room-desc'),
            interactableDesc: document.getElementById('interactable-desc'),
            roomImage: document.getElementById('room-image'),
            roomImageBlur: document.getElementById('room-image-blur'),
            actionsContainer: document.getElementById('actions-container'),
            appContainer: document.getElementById('app-container'),
            terminalText: document.getElementById('terminal-text'),
            glitchDisplacement: document.getElementById('glitch-displacement'),
            glitchColor: document.getElementById('glitch-color'),
            glitchTurbulence: document.getElementById('glitch-turbulence')
        };

        this.terminalTimeout = null;
        this.transitionTimeout = null;
        this.terminalGlitchChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?/\\";

        // Image index loaded from world_data/image_index.json at init
        this.imageIndex = { rooms: {}, transitions: {} };
        this.isInternalHashChange = false;

        // Glitch Effect Configuration
        this.glitchSettings = {
            threshold: 60,          // Sanity level where glitches start appearing (was 50)
            maxScale: 60,           // Max displacement scale (was 150)
            flickerChance: 0.08,    // Chance of frequency flicker (was 0.1)
            artifactChance: 0.03,   // Base chance of spawning a random glitch slice (was 0.1)
            jitterChance: 0.03,     // Chance of app container shaking (was 0.05)
            brightnessMod: 0.15,    // Max brightness reduction (was 0.2)
            contrastMod: 0.3,       // Max contrast increase (was 0.5)
            saturationMod: 0.4,     // Max saturation reduction (was 0.5)
            colorShiftChance: 0.4,  // Threshold of intensity when color shifting starts
            terminalChance: 0.15    // Chance of character glitching during typing
        };
    }

    async init() {
        try {
            // Load consolidated world data from SQLite API
            const res = await fetch('admin/api.php');
            if (!res.ok) throw new Error('Failed to fetch world data');

            const data = await res.json();

            this.world = {
                rooms: data.rooms,
                transition_types: data.transition_types,
                interactables: data.interactables
            };
            this.imageIndex = data.image_index;

            // Initialize interactable states
            Object.keys(this.world.interactables).forEach(interId => {
                const inter = this.world.interactables[interId];
                this.state.worldStates[interId] = inter.current_state_index || 0;
            });

            this.elements.resetBtn = document.getElementById('reset-btn');
            if (this.elements.resetBtn) {
                this.elements.resetBtn.addEventListener('click', () => {
                    localStorage.removeItem('backrooms_session');
                    window.location.hash = '';
                    location.reload();
                });
            }

            this.loadSession();

            // Wygeneruj mapę jeśli jej nie ma (nowa gra / reset) lub brakuje bfsDepth/mapPositions
            const needsRegen = !this.state.roomTransitions
                || Object.keys(this.state.roomTransitions).length < Object.keys(this.world.rooms).length
                || !this.state.bfsDepth
                || Object.keys(this.state.bfsDepth).length === 0
                || !this.state.mapPositions
                || Object.keys(this.state.mapPositions).length === 0;

            if (needsRegen) {
                this.generateGlobalMap();
                this.saveSession();
            }

            // Map module
            this.mapGraph = new MapGraph(this);

            // Settings Panel Controls
            this.elements.settingsBtn = document.getElementById('settings-btn');
            this.elements.settingsPanel = document.getElementById('settings-panel');
            this.elements.masterVol = document.getElementById('master-vol');
            this.elements.ambientVol = document.getElementById('ambient-vol');
            this.elements.sfxVol = document.getElementById('sfx-vol');

            this.elements.settingsBtn.onclick = (e) => {
                e.stopPropagation();
                this.elements.settingsPanel.classList.toggle('hidden');
            };

            this.elements.masterVol.oninput = (e) => {
                this.audio.setMasterVolume(e.target.value);
            };

            this.elements.ambientVol.oninput = (e) => {
                this.audio.setAmbientVolume(e.target.value);
            };

            this.elements.sfxVol.oninput = (e) => {
                this.audio.setSfxVolume(e.target.value);
            };

            document.addEventListener('click', () => {
                this.elements.settingsPanel.classList.add('hidden');
            });
            this.elements.settingsPanel.onclick = (e) => e.stopPropagation();

            // Collapsible Narrative Panel
            const panel = document.getElementById('narrative-panel');
            if (panel) {
                const narrativeCollapsed = localStorage.getItem('narrative_collapsed') === 'true';
                if (narrativeCollapsed) {
                    panel.classList.add('collapsed');
                }

                panel.addEventListener('click', (e) => {
                    const isCollapsed = panel.classList.contains('collapsed');
                    if (isCollapsed) {
                        panel.classList.remove('collapsed');
                        localStorage.setItem('narrative_collapsed', 'false');
                        this.audio.playUiSound('click');
                    } else {
                        // Collapse only if clicked on the title, subtitle, toggle button or panel background directly.
                        // Do not collapse if clicked inside descriptions/interactables.
                        const noCollapseElements = ['room-desc', 'interactable-desc'];
                        let target = e.target;
                        let shouldCollapse = true;
                        while (target && target !== panel) {
                            if (noCollapseElements.includes(target.id) || target.classList.contains('interaction-btn') || target.classList.contains('interaction-group')) {
                                shouldCollapse = false;
                                break;
                            }
                            target = target.parentElement;
                        }
                        if (shouldCollapse) {
                            panel.classList.add('collapsed');
                            localStorage.setItem('narrative_collapsed', 'true');
                            this.audio.playUiSound('click');
                        }
                    }
                });
            }

            // Sanity Debug Controls
            this.elements.sanityMinus = document.getElementById('sanity-minus');
            this.elements.sanityPlus = document.getElementById('sanity-plus');

            if (this.elements.sanityMinus) {
                this.elements.sanityMinus.onclick = (e) => {
                    e.stopPropagation();
                    this.state.sanity = Math.max(0, this.state.sanity - 5);
                    this.saveSession();
                    this.render();
                };
            }

            if (this.elements.sanityPlus) {
                this.elements.sanityPlus.onclick = (e) => {
                    e.stopPropagation();
                    this.state.sanity = Math.min(100, this.state.sanity + 5);
                    this.saveSession();
                    this.render();
                };
            }

            window.addEventListener('hashchange', () => this.checkHash());
            this.checkHash();
            this.render();
            this.startGlitchLoop();

            document.body.addEventListener('click', async () => {
                this.audio.init();
                this.audio.updateBgm(this.state.currentRoom);

                if (this.sfxManifest) {
                    await this.audio.loadSfxMapping(this.sfxManifest.effects);
                }

                this.syncEnvironmentSounds();
                const roomData = this.world.rooms[this.state.currentRoom];
                if (roomData && roomData.tags) {
                    this.playMatchingSfx(roomData.tags);
                }
            }, { once: true });

            console.log("LIMINAL OS: INITIALIZED VIA SQLITE");
        } catch (error) {
            console.error("Failed to load world:", error);
            this.elements.roomTitle.innerText = "CRITICAL ERROR";
            this.elements.roomDesc.innerText = "World data not found or server offline. " + error.message;
        }
    }

    /**
     * Play a random SFX that best matches the given tags.
     */
    playMatchingSfx(tags) {
        if (!this.sfxManifest || !this.sfxManifest.effects) return;

        const scored = this.sfxManifest.effects.map(effect => {
            const effectTags = effect.tags || [];
            const overlap = effectTags.filter(t => tags.includes(t)).length;
            return { effect, overlap };
        }).filter(s => s.overlap > 0);

        if (scored.length === 0) return;

        const maxScore = Math.max(...scored.map(s => s.overlap));
        const best = scored.filter(s => s.overlap === maxScore);

        const picked = best[Math.floor(Math.random() * best.length)];
        this.audio.playSfx(picked.effect.id);
    }

    syncEnvironmentSounds() {
        if (!this.audio.enabled) return;

        const loc = this.getCurrentLocation();
        const currentInteractables = loc.getInteractables() || []; // Returns IDs

        Object.keys(this.state.worldStates).forEach(id => {
            const isInLocation = currentInteractables.includes(id);

            // Play sound if interactable is present in current location (Room OR Transition)
            if (isInLocation) {
                const stateIndex = this.state.worldStates[id];
                const interactable = this.world.interactables[id];
                const stateObj = interactable?.states?.[stateIndex];
                const stateId = stateObj ? stateObj.id : null;
                this.audio.setEnvironmentSound(id, stateId);
            } else {
                this.audio.setEnvironmentSound(id, null);
            }
        });
    }

    loadSession() {
        const saved = localStorage.getItem('backrooms_session');
        if (saved) {
            const parsed = JSON.parse(saved);
            this.state = { ...this.state, ...parsed };
        }
        if (!this.state.inventory) {
            this.state.inventory = { almond_water: 1 };
        }
    }

    saveSession() {
        localStorage.setItem('backrooms_session', JSON.stringify(this.state));
    }

    glitchText(text, sanity) {
        if (!text) return ""; // Safety
        if (sanity > 90) return text;

        // Dynamiczne skalowanie intensywności w zależności od spadku sanity
        const intensity = (100 - sanity) / 100; // od 0.1 do 1.0

        // Zależność procentu zepsutych znaków (maksymalnie 50% przy sanity = 0)
        const percentage = intensity * 50;

        // Moc glitcha (wpływa np. na liczbę nakładanych znaków zalgo)
        const strength = intensity * 3;

        // Dobór aktywnych efektów w zależności od stopnia szaleństwa
        let effects = ['replace', 'case'];
        if (sanity < 70) {
            effects.push('stutter', 'leet');
        }
        if (sanity < 40) {
            effects.push('zalgo', 'binary', 'delete');

            // Okazjonalne odtworzenie dźwięku błędu przy bardzo niskim sanity
            if (Math.random() < 0.05 && this.audio) {
                this.audio.playUiSound('glitch');
            }
        }

        if (window.generateGlitchText) {
            return window.generateGlitchText(text, { percentage, strength, effects });
        }

        // Fallback w razie braku funkcji
        const zalgoChars = ['░', '▒', '▓', '?', '!', '.', ',', ':', ';', '$', '#', '@', '█', '▄', '▀'];
        const chance = (100 - sanity) / 250.0;
        let output = "";
        for (const char of text) {
            output += char;
            if (Math.random() < chance) {
                output += zalgoChars[Math.floor(Math.random() * zalgoChars.length)];
            }
        }
        return output;
    }

    /**
     * Factory method to get the current abstract Location object
     */
    getCurrentLocation() {
        if (this.state.isTransitioning && this.state.transitionContext) {
            return new TransitionLocation(this, this.state.transitionContext);
        } else {
            return new RoomLocation(this, this.state.currentRoom);
        }
    }

    /**
     * Resolves image path. 
     * Handles both legacy paths and new media/ paths.
     */
    resolveImagePath(path) {
        let resolved = '';
        if (!path) {
            resolved = 'media/uploads/fallback.png';
        } else if (path.startsWith('media/uploads/')) {
            const filename = path.split('/').pop();
            resolved = `media/images/${filename}`;
        } else if (path.startsWith('media/')) {
            resolved = path;
        } else {
            resolved = `media/images/${path}`;
        }

        if (CONFIG_MEDIA_BASE_URL) {
            const base = CONFIG_MEDIA_BASE_URL.endsWith('/') ? CONFIG_MEDIA_BASE_URL : `${CONFIG_MEDIA_BASE_URL}/`;
            return `${base}${resolved}`;
        }
        return resolved;
    }

    /**
     * Get the category name for a transition ID
     */
    getTransitionCategory(transitionId) {
        if (!this.world || !this.world.transition_types) return null;
        for (const category in this.world.transition_types) {
            if (this.world.transition_types[category].some(t => t.id === transitionId)) {
                return category;
            }
        }
        return null;
    }

    /**
     * Generate a procedural color for a category string
     */
    getCategoryColor(category) {
        if (!category) return 'hsl(120, 100%, 60%)'; // Fallback to green

        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = Math.abs(hash % 360);
        // Using high saturation and moderate lightness for a vibrant "neon" effect
        return `hsl(${hue}, 90%, 65%)`;
    }

    /**
     * Deleguje generowanie mapy do MapGenerator z mapgen.js.
     * Algorytm spanning-tree gwarantuje odkrywalność wszystkich pokoi.
     */
    generateGlobalMap() {
        const generator = new MapGenerator(this);
        generator.generate();
    }

    // Simplified wrapper for external calls (if any), though Logic is now in Location classes
    getRoomImageUrl(unused) {
        return this.getCurrentLocation().getImage();
    }

    handleAction(type, value, extra, event) {
        console.log(`Action: ${type}`, { value, extra });
        if (event) event.preventDefault();

        // Clear any pending auto-transition
        if (this.transitionTimeout) {
            clearTimeout(this.transitionTimeout);
            this.transitionTimeout = null;
        }

        // Only flash for transitions and movement, not for simple interactions
        if (type !== 'act') {
            this.elements.appContainer.classList.add('glitch-flash');
            setTimeout(() => this.elements.appContainer.classList.remove('glitch-flash'), 100);
        }

        if (type === 'tra') {
            this.audio.stopAllSounds(0.8);
            this.audio.playTransitionSound(value);
            // Clear previous transition image to force a new random pick
            delete this.state.transitionImages[value];
            this.state.isTransitioning = true;
            this.state.transitionContext = { id: value, target: extra };

            // Update terminal for transition (use inline texts from transition data)
            this.updateTerminalText(value);
        } else if (type === 'mov') {
            this.audio.stopAllSounds(0.8);
            this.audio.playUiSound('arrival');
            const targetId = value;
            // Clear previous room image choice to allow a new random pick on entry
            delete this.state.roomImages[targetId];

            this.state.currentRoom = targetId;
            this.state.isTransitioning = false;
            this.state.transitionContext = null;
            this.state.activeInteractableId = null; // Default to room image on entry

            this.audio.updateBgm(targetId);

            if (!this.state.visitedRooms.includes(targetId)) {
                this.state.visitedRooms.push(targetId);
                this.state.sanity = Math.max(0, this.state.sanity - 5);
            } else {
                this.state.sanity = Math.max(0, this.state.sanity - 2);
            }

            // Play entry sound matching room tags
            const roomData = this.world.rooms[this.state.currentRoom];
            if (roomData && roomData.tags) {
                this.playMatchingSfx(roomData.tags);
            }

            // Update terminal text for the room
            this.updateTerminalText();
        } else if (type === 'act') {
            this.audio.playUiSound('click');
            const interId = value;
            const targetState = extra;

            const interactable = this.world.interactables[interId];
            if (interactable && interactable.states) {
                if (typeof targetState === 'number') {
                    this.state.worldStates[interId] = targetState;
                } else {
                    const numStates = interactable.states.length;
                    this.state.worldStates[interId] = (this.state.worldStates[interId] + 1) % numStates;
                }
                this.state.activeInteractableId = interId;
            }
            this.processEffectsFromState(interId);
        }

        this.syncEnvironmentSounds();

        this.saveSession();
        this.render();
    }

    processEffectsFromState(interId) {
        const index = this.state.worldStates[interId] || 0;
        const interactable = this.world.interactables[interId];
        if (!interactable) return;

        const state = interactable.states[index];
        if (state && state.effects) {
            this.processEffects(state.effects);
        }
    }

    processEffects(effects) {
        if (!Array.isArray(effects)) return;

        effects.forEach(eff => {
            console.log("Effect trigger:", eff);
            if (eff.type === 'sfx' || eff.type === 'sound') {
                const soundName = eff.value || eff.asset || eff.id;
                if (soundName && this.audio) {
                    const uiSounds = ['click', 'keypress', 'success', 'error', 'arrival', 'glitch'];
                    if (uiSounds.includes(soundName)) {
                        this.audio.playUiSound(soundName);
                    } else {
                        this.audio.playSfx(soundName);
                    }
                }
            } else if (eff.type === 'sanity') {
                this.state.sanity = Math.max(0, Math.min(100, this.state.sanity + eff.value));
            } else if (eff.type === 'glitch') {
                this.updateGlitchEffects(this.state.sanity - (eff.intensity || 0));
                setTimeout(() => this.updateGlitchEffects(this.state.sanity), eff.duration || 500);
            } else if (eff.type === 'move') {
                const targetRoom = eff.value || eff.room;
                if (targetRoom) {
                    this.handleAction('mov', targetRoom);
                }
            } else if (eff.type === 'act' || eff.type === 'interactable') {
                const interId = eff.id || eff.interactable_id;
                const stateIdx = eff.state !== undefined ? eff.state : eff.value;
                if (interId !== undefined && stateIdx !== undefined) {
                    this.handleAction('act', interId, stateIdx);
                }
            } else if (eff.type === 'item') {
                const itemName = eff.item || eff.name || eff.value;
                const amount = eff.amount !== undefined ? eff.amount : (eff.value !== undefined ? eff.value : 1);
                if (itemName) {
                    if (!this.state.inventory) this.state.inventory = {};
                    this.state.inventory[itemName] = Math.max(0, (this.state.inventory[itemName] || 0) + amount);
                    this.saveSession();
                    if (window.TerminalSystem) {
                        const sign = amount > 0 ? "+" : "";
                        const logMsg = `INVENTORY: ${sign}${amount} ${itemName.replace('_', ' ').toUpperCase()}`;
                        window.TerminalSystem.addToHistory(logMsg, amount > 0 ? 'success' : 'warning', '◆');
                    }
                }
            }
        });
    }

    checkRequirements(req) {
        if (!req) return true;
        // console.log("Checking requirements:", req);

        // Check Interactable State
        if (req.interactable_id && req.state_id) {
            const interId = req.interactable_id;
            const targetStateId = req.state_id;

            const interactable = this.world.interactables[interId];
            if (!interactable) {
                console.warn(`Requirement check failed: interactable ${interId} not found`);
                return false;
            }

            const currentIndex = this.state.worldStates[interId] || 0;
            const currentState = interactable.states[currentIndex];

            if (!currentState || (currentState.id !== targetStateId && currentState.state_id !== targetStateId)) {
                // console.log(`Requirement not met for ${interId}: expected ${targetStateId}, got ${currentState?.id}`);
                return false;
            }
        }

        // Check Sanity
        if (req.sanity_min !== undefined) {
            if (this.state.sanity < parseInt(req.sanity_min)) return false;
        }
        if (req.sanity_max !== undefined) {
            if (this.state.sanity > parseInt(req.sanity_max)) return false;
        }

        // Check visited room requirements
        if (req.visited_room) {
            if (!this.state.visitedRooms.includes(req.visited_room)) return false;
        }
        if (req.unvisited_room) {
            if (this.state.visitedRooms.includes(req.unvisited_room)) return false;
        }

        // Check items in inventory
        if (req.has_item) {
            const count = req.item_count || 1;
            const inv = this.state.inventory || {};
            if ((inv[req.has_item] || 0) < count) return false;
        }

        return true;
    }

    startGlitchLoop() {
        let lastSanity = -1;
        const loop = () => {
            const currentSanity = this.state.sanity;

            if (currentSanity < this.glitchSettings.threshold) {
                this.updateGlitchEffects(currentSanity);
                this.spawnRandomArtifacts(currentSanity);
                lastSanity = currentSanity;
            } else if (lastSanity !== -1) {
                // Reset once when going back above threshold
                const baseFilter = 'brightness(0.55) contrast(1.15) saturate(0.7)';
                this.elements.roomImage.style.filter = baseFilter;
                this.elements.roomImageBlur.style.filter = `blur(20px) ${baseFilter}`;
                if (this.elements.glitchDisplacement) this.elements.glitchDisplacement.setAttribute('scale', 0);
                lastSanity = -1;
            }
            requestAnimationFrame(loop);
        };
        loop();
    }

    spawnRandomArtifacts(sanity) {
        const intensity = (this.glitchSettings.threshold - sanity) / this.glitchSettings.threshold;
        if (Math.random() > intensity * this.glitchSettings.artifactChance * 10) return;

        const slice = document.createElement('div');
        slice.className = 'glitch-slice';

        const w = 10 + Math.random() * 40 * intensity;
        const h = 2 + Math.random() * 10 * intensity;
        const x = Math.random() * 100;
        const y = Math.random() * 100;

        slice.style.width = `${w}%`;
        slice.style.height = `${h}%`;
        slice.style.left = `${x}%`;
        slice.style.top = `${y}%`;
        slice.style.transform = `translateX(${(Math.random() - 0.5) * 50 * intensity}px)`;
        slice.style.backgroundColor = Math.random() < 0.5 ? 'rgba(51, 255, 51, 0.3)' : 'rgba(255, 51, 51, 0.3)';
        if (Math.random() < 0.2) slice.style.backgroundColor = 'rgba(51, 51, 255, 0.3)';

        document.getElementById('scene-bg').appendChild(slice);
        setTimeout(() => slice.remove(), 40 + Math.random() * 120);
    }

    render() {
        const { sanity, visitedRooms, worldStates } = this.state;
        const totalRooms = Object.keys(this.world.rooms).length;

        // Unified Location Object
        const loc = this.getCurrentLocation();

        // Update Header
        this.elements.sanityFill.style.width = `${sanity}%`;
        this.elements.sanityValue.innerText = `${Math.floor(sanity)}%`;
        this.elements.discoveredValue.innerText = `${visitedRooms.length}/${totalRooms}`;

        this.updateGlitchEffects(sanity);

        // Clear actions
        this.elements.actionsContainer.innerHTML = '';

        // Update Header
        let title = `/// ${loc.getName().toUpperCase()} ///`;
        this.elements.roomTitle.innerText = this.glitchText(title, sanity);

        // Subtitle (e.g. transition category)
        const subText = loc.getSubtitle();
        if (subText) {
            this.elements.roomSubtitle.innerText = this.glitchText(subText, sanity);
            this.elements.roomSubtitle.style.display = 'block';
        } else {
            this.elements.roomSubtitle.innerText = '';
            this.elements.roomSubtitle.style.display = 'none';
        }

        // Apply category color to title/subtitle if it's a transition
        if (loc.isTransition && loc.definition && loc.definition.category) {
            const color = this.getCategoryColor(loc.definition.category);
            this.elements.roomSubtitle.style.color = color;
            this.elements.roomSubtitle.style.textShadow = `0 0 12px ${color.replace('hsl', 'hsla').replace(')', ', 0.35)')}`;
            // Let's also keep the title green (default) or should we color it too?
            // The user didn't specify, but usually title is neutral and subtitle is flavored.
            this.elements.roomTitle.style.color = '';
            this.elements.roomTitle.style.textShadow = '';
        } else {
            this.elements.roomTitle.style.color = '';
            this.elements.roomTitle.style.textShadow = '';
            this.elements.roomSubtitle.style.color = '';
            this.elements.roomSubtitle.style.textShadow = '';
        }

        this.elements.roomDesc.innerText = this.glitchText(loc.getDescription(), sanity);

        // Apply background margin from parameter
        document.documentElement.style.setProperty('--bg-margin', `${this.bgMargin}px`);

        // Image (Polymorphic)
        const newSrc = loc.getImage();

        // Handle image fade transition
        const currentSrc = this.elements.roomImage.getAttribute('src') || this.elements.roomImage.src;
        // Check if src actually changed (dealing with resolved paths)
        if (!currentSrc.endsWith(newSrc) && currentSrc !== newSrc) {
            this.elements.roomImage.classList.add('fade-out');
            this.elements.roomImageBlur.classList.add('fade-out');
            setTimeout(() => {
                this.elements.roomImage.src = newSrc;
                this.elements.roomImageBlur.src = newSrc;
                this.elements.roomImage.onload = () => {
                    this.elements.roomImage.classList.remove('fade-out');
                    this.elements.roomImageBlur.classList.remove('fade-out');
                };
            }, 300);
        } else if (!currentSrc) {
            this.elements.roomImage.src = newSrc;
            this.elements.roomImageBlur.src = newSrc;
        }

        // --- Render Interactables (Unified) ---
        const interactableIds = loc.getInteractables();
        if (interactableIds.length > 0) {
            const descriptions = interactableIds.map(interId => {
                const interactable = this.world.interactables[interId];
                if (!interactable) return '';
                const stateIndex = worldStates[interId] || 0;
                const state = interactable.states[stateIndex];
                return state ? state.desc : '';
            }).filter(desc => desc.length > 0);

            this.elements.interactableDesc.innerText = descriptions.join(' ');

            interactableIds.forEach(interId => {
                const interactable = this.world.interactables[interId];
                if (!interactable) return;

                const currentStateIndex = worldStates[interId] || 0;

                // Create a container group for the interactable
                const group = document.createElement('div');
                group.className = 'interaction-group';

                // Label span
                const label = document.createElement('span');
                label.className = 'interaction-group-label';
                label.textContent = `${interactable.label.toUpperCase()}:`;
                group.appendChild(label);

                // Create a button for each state option
                interactable.states.forEach((state, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'interaction-btn';
                    if (idx === currentStateIndex) btn.classList.add('active');

                    btn.textContent = (state.label || state.id).toUpperCase();

                    // Click to directly set this state
                    btn.onclick = (e) => this.handleAction('act', interId, idx, e);
                    group.appendChild(btn);
                });

                this.elements.actionsContainer.appendChild(group);
            });
        } else {
            this.elements.interactableDesc.innerText = "";
        }

        // --- Render Actions (Exits / Transitions) ---
        const actions = loc.getActions();
        actions.forEach(act => {
            const btn = document.createElement('button');

            if (act.type === 'tra' || act.type === 'mov') {
                btn.className = act.type === 'mov' ? 'continue-btn' : 'exit-btn';

                // Build button content: label + optional icons
                const hasBadges = (act.type === 'tra') && (act.isUnknown || act.isRecommended);
                if (hasBadges) {
                    const unknownIcon = act.isUnknown
                        ? `<i data-lucide="sparkles" class="exit-icon-new" title="New Area"></i>`
                        : '';
                    const recommendedIcon = act.isRecommended
                        ? `<i data-lucide="navigation" class="exit-icon-recommend" title="Recommended path"></i>`
                        : '';
                    btn.innerHTML = `<span class="exit-label">${act.label}</span><span class="exit-icon-badges">${unknownIcon}${recommendedIcon}</span>`;
                } else {
                    btn.textContent = act.label;
                }

                // Apply category colors if available
                if (act.category) {
                    const color = this.getCategoryColor(act.category);
                    const glowColor = color.replace('hsl', 'hsla').replace(')', ', 0.3)');
                    const dimColor = color.replace('hsl', 'hsla').replace(')', ', 0.1)');

                    btn.style.borderColor = color;
                    btn.style.color = color;
                    btn.style.boxShadow = `0 0 8px ${glowColor}`;

                    btn.style.setProperty('--btn-color', color);
                    btn.style.setProperty('--btn-glow', glowColor);
                    btn.style.setProperty('--btn-dim', dimColor);
                    btn.classList.add('custom-category-btn');
                }

                // Przycisk "Continue" w trakcie przejścia — auto-timer
                if (act.type === 'mov' && this.state.isTransitioning) {
                    const progress = document.createElement('div');
                    progress.className = 'btn-progress animate';
                    if (act.category) {
                        progress.style.background = 'currentColor';
                    }
                    btn.appendChild(progress);

                    if (!this.transitionTimeout) {
                        this.transitionTimeout = setTimeout(() => {
                            this.handleAction(act.type, act.value, act.extra);
                        }, 11000);
                    }
                }
            } else {
                btn.className = 'action-btn';
                btn.textContent = act.label;
            }

            btn.onclick = (e) => this.handleAction(act.type, act.value, act.extra, e);
            this.elements.actionsContainer.appendChild(btn);
        });

        // Update map layout
        if (this.mapGraph) {
            this.mapGraph.update();
        }

        // Sync URL Hash
        let newHash = this.state.isTransitioning
            ? `tra:${this.state.transitionContext.id}:${this.state.transitionContext.target}`
            : this.state.currentRoom;

        if (window.location.hash !== '#' + newHash) {
            this.isInternalHashChange = true;
            window.location.hash = newHash;
        }

        // Render any dynamically added icons (e.g. exit button icons)
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * Handle hash change for navigation via URL
     */
    checkHash() {
        if (this.isInternalHashChange) {
            this.isInternalHashChange = false;
            return;
        }

        const hash = window.location.hash.slice(1);
        if (!hash) return;

        if (hash.startsWith('tra:')) {
            const parts = hash.split(':');
            if (parts.length === 3) {
                const tId = parts[1];
                const targetId = parts[2];

                // If already in this transition, skip
                if (this.state.isTransitioning &&
                    this.state.transitionContext?.id === tId &&
                    this.state.transitionContext?.target === targetId) return;

                // Validate transition and target
                let foundT = false;
                for (const cat in this.world.transition_types) {
                    if (this.world.transition_types[cat].some(t => t.id === tId)) {
                        foundT = true;
                        break;
                    }
                }

                if (foundT && this.world.rooms[targetId]) {
                    this.audio.stopAllSounds(0.8);
                    this.state.isTransitioning = true;
                    this.state.transitionContext = { id: tId, target: targetId };
                    this.state.activeInteractableId = null;
                    this.updateTerminalText(tId);
                    this.render();
                }
            }
        } else {
            const roomId = hash;
            if (this.world.rooms[roomId]) {
                if (this.state.currentRoom !== roomId || this.state.isTransitioning) {
                    this.handleAction('mov', roomId, null, null);
                }
            }
        }
    }

    /**
     * Update terminal text using inline texts from rooms or transitions.
     * Falls back to category texts if transition has no inline texts.
     */
    updateTerminalText(transitionId = null) {
        // Polymorphic approach:
        const loc = this.getCurrentLocation();
        const possibleTexts = loc.getTerminalTexts();

        // Filter by sanity
        const currentSanity = this.state.sanity;
        const validTexts = possibleTexts.filter(t => {
            // If it's old data (just a string), it's always valid
            if (typeof t === 'string') return true;
            const min = t.sanity_min !== undefined ? parseInt(t.sanity_min) : 0; // Fixed parseInt
            const max = t.sanity_max !== undefined ? parseInt(t.sanity_max) : 100;
            return currentSanity >= min && currentSanity <= max;
        });

        if (validTexts.length === 0) {
            this.state.activeAtmosphericText = null;
            this.typeTerminalText("");
            return;
        }

        const selected = validTexts[Math.floor(Math.random() * validTexts.length)];
        this.state.activeAtmosphericText = selected;

        const displayText = typeof selected === 'string' ? selected : selected.text;
        this.typeTerminalText(displayText.toUpperCase());
    }

    typeTerminalText(fullText, callback) {
        if (this.terminalTimeout) clearTimeout(this.terminalTimeout);

        if (window.TerminalSystem) window.TerminalSystem.isTyping = true;

        const previewEl = document.getElementById('terminal-preview-text');

        const deleteChar = () => {
            const current = this.elements.terminalText.innerText;
            if (current.length > 0) {
                this.elements.terminalText.innerText = current.slice(0, -1);
                if (previewEl) previewEl.textContent = current.slice(0, -1);
                this.terminalTimeout = setTimeout(deleteChar, 10);
            } else {
                if (fullText) startTyping();
                else {
                    if (previewEl) previewEl.textContent = '';
                    if (window.TerminalSystem) window.TerminalSystem.isTyping = false;
                    if (callback) callback();
                }
            }
        };

        const startTyping = () => {
            let currentDisplay = "";
            let index = 0;

            const type = () => {
                if (index < fullText.length) {
                    const isGlitch = Math.random() < this.glitchSettings.terminalChance;
                    const char = isGlitch
                        ? this.terminalGlitchChars[Math.floor(Math.random() * this.terminalGlitchChars.length)]
                        : fullText[index];

                    this.elements.terminalText.innerText = currentDisplay + char;

                    if (!isGlitch) {
                        currentDisplay += char;
                        index++;
                    }

                    // Sync preview with clean text (no glitch chars)
                    if (previewEl) previewEl.textContent = currentDisplay;

                    this.terminalTimeout = setTimeout(type, Math.random() * 10 + 5);
                } else {
                    this.elements.terminalText.innerText = fullText;
                    if (previewEl) previewEl.textContent = fullText.replace(/\n/g, ' ');
                    if (window.TerminalSystem) window.TerminalSystem.isTyping = false;

                    // Add interactive class if dialogue is linked
                    const container = document.getElementById('terminal-line-container');
                    if (this.state.activeAtmosphericText && this.state.activeAtmosphericText.dialogue_id) {
                        container.classList.add('interactive-prompt');
                        if (window.TerminalSystem && container.classList.contains('focused')) {
                            window.TerminalSystem.showActiveDialogueOptions();
                        }
                    } else {
                        container.classList.remove('interactive-prompt');
                    }

                    if (callback) callback();
                }
            };
            type();
        };

        deleteChar();
    }

    updateGlitchEffects(sanity) {
        if (sanity >= this.glitchSettings.threshold) {
            this.elements.roomImage.style.filter = 'brightness(0.55) contrast(1.15) saturate(0.7)';
            if (this.elements.glitchDisplacement) this.elements.glitchDisplacement.setAttribute('scale', 0);
            return;
        }

        const intensity = (this.glitchSettings.threshold - sanity) / this.glitchSettings.threshold; // 0 to 1
        const scale = intensity * this.glitchSettings.maxScale;

        if (this.elements.glitchDisplacement) {
            this.elements.glitchDisplacement.setAttribute('scale', scale);

            // Randomly flicker the baseFrequency to simulate different "noise" patterns
            if (Math.random() < this.glitchSettings.flickerChance) {
                const freqX = 0.05 + Math.random() * 0.1;
                const freqY = 0.5 + Math.random() * 2;
                this.elements.glitchTurbulence.setAttribute('baseFrequency', `${freqX} ${freqY}`);
            }
        }

        // Apply filters to image
        // Base filters + glitch SVG filter
        const br = 0.55 - intensity * this.glitchSettings.brightnessMod;
        const ct = 1.15 + intensity * this.glitchSettings.contrastMod;
        const st = 0.7 - intensity * this.glitchSettings.saturationMod;

        let filterStr = `brightness(${br}) contrast(${ct}) saturate(${st}) url(#glitch-filter)`;

        // Add random chromatic aberration/color shifting
        if (this.elements.glitchColor && intensity > this.glitchSettings.colorShiftChance) {
            const r = 1 + Math.random() * 0.2 * intensity;
            const g = 1;
            const b = 1 + Math.random() * 0.3 * intensity;
            this.elements.glitchColor.setAttribute('values', `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`);
        }

        this.elements.roomImage.style.filter = filterStr;
        this.elements.roomImageBlur.style.filter = `blur(20px) ${filterStr}`;

        // Apply occasional sharp "glitch" artifacts to the whole app container
        if (Math.random() < intensity * this.glitchSettings.jitterChance) {
            this.elements.appContainer.style.transform = `translate(${(Math.random() - 0.5) * 10 * intensity}px, ${(Math.random() - 0.5) * 5 * intensity}px)`;
            setTimeout(() => {
                this.elements.appContainer.style.transform = '';
            }, 50);
        }
    }
}

// MapGraph i MapGenerator są teraz w mapgen.js

// Start game
const game = new BackroomsGame();
window.game = game;
document.addEventListener('DOMContentLoaded', () => game.init());
