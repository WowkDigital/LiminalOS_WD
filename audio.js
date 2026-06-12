/**
 * LIMINAL OS - Procedural Audio Engine
 * Handles ambient humming, retro UI sound effects, and environmental loops.
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.ambientGain = null;
        this.sfxGain = null;
        this.enabled = false;
        this.loops = new Map();
        this.activeSfx = new Set(); // Track active buffer sources
        this.pendingStops = new Set(); // Track IDs being stopped

        this.masterVol = 0.4;
        this.ambientVol = 0.0; // Default hum to 0
        this.sfxVol = 0.5; // Default SFX volume

        this.mappings = { bgm: {}, states: {}, transitions: {}, ui: {} };
        this.buffers = new Map(); // id -> AudioBuffer
        this.bgmSource = null;
        this.bgmGain = null;
        this.currentBgmId = null;
    }

    init() {
        if (this.ctx) return;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.masterVol;
            this.masterGain.connect(this.ctx.destination);

            // Create a bus for ambient HUM (60Hz buzz)
            this.ambientGain = this.ctx.createGain();
            this.ambientGain.gain.value = this.ambientVol;
            this.ambientGain.connect(this.masterGain);

            // Create a bus for SFX (clicks, transitions, external effects)
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = this.sfxVol;
            this.sfxGain.connect(this.masterGain);

            this.setupAmbientBuzz();
            this.playStartupSound();
            this.fetchMappings();

            console.log("AUDIO ENGINE: ONLINE");
        } catch (e) {
            console.error("Failed to initialize Web Audio API:", e);
        }
    }

    setupAmbientBuzz() {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, this.ctx.currentTime);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.connect(filter);
        filter.connect(this.ambientGain);
        osc.start();
    }

    /**
     * Stop all oscillators/sources in a loop entry safely with a fade-out.
     */
    _stopLoop(id, fadeTime = 0.2) {
        if (!this.loops.has(id)) return;
        const loop = this.loops.get(id);
        this.loops.delete(id);

        const now = this.ctx.currentTime;
        try {
            if (loop.gain) loop.gain.gain.setTargetAtTime(0, now, fadeTime);
        } catch (e) { /* ignore */ }

        // Cleanup after fade (3x time constant for ~95% decrease)
        setTimeout(() => {
            const nodes = [loop.source, loop.osc2, loop.osc3, loop.lfo];
            nodes.forEach(node => {
                if (node) try { node.stop(); } catch (e) { /* already stopped */ }
            });
            // Disconnect gain to release resources
            if (loop.gain) try { loop.gain.disconnect(); } catch (e) { /* ignore */ }
            this.pendingStops.delete(id);
        }, (fadeTime * 3000) + 50);

        this.pendingStops.add(id);
    }

    /**
     * Create a noise buffer source
     */
    _createNoiseSource() {
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        return source;
    }

    /**
     * Build and start an environment sound for the given interactable + stateId.
     * stateId is the string ID from interactables.json (e.g. "on", "flickering", "off", "closed", etc.)
     * If stateId is null, stop the sound.
     */
    async setEnvironmentSound(id, stateId) {
        if (!this.ctx || !this.enabled) return;

        // Stop existing sound for this id
        this._stopLoop(id);

        // Check for mapped SFX
        const contextId = `${id}.${stateId}`;
        const mapping = this.mappings.states[contextId];
        if (mapping) {
            const buffer = await this.ensureBuffer(mapping.audio_file_id);
            if (buffer) {
                const sfx = this.playBuffer(mapping.audio_file_id, this.sfxGain, mapping.volume || 0.5, mapping.loop);
                if (sfx) {
                    this.loops.set(id, { source: sfx.source, gain: sfx.gain });
                }
            }
            return;
        }

        // If no stateId or silent state, just stop
        if (!stateId) return;

        // Build the sound
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        let source = null;
        let extraNodes = {}; // lfo, osc2, osc3 for cleanup

        // ---------- LOBBY LIGHT ----------
        if (id === 'lobby_light') {
            if (stateId === 'on') {
                // Steady fluorescent buzz
                source = this.ctx.createOscillator();
                source.type = 'square';
                source.frequency.setValueAtTime(120, this.ctx.currentTime);
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 400;
                source.connect(filter);
                filter.connect(gain);
                gain.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.15);

            } else if (stateId === 'flickering') {
                // Unstable flickering with LFO
                source = this.ctx.createOscillator();
                source.type = 'square';
                source.frequency.setValueAtTime(180, this.ctx.currentTime);

                const lfo = this.ctx.createOscillator();
                const lfoGain = this.ctx.createGain();
                lfo.frequency.value = 8;
                lfoGain.gain.value = 40;
                lfo.connect(lfoGain);
                lfoGain.connect(source.frequency);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 200;
                source.connect(filter);
                filter.connect(gain);
                gain.gain.setTargetAtTime(0.6, this.ctx.currentTime, 0.1);

                lfo.start();
                extraNodes.lfo = lfo;

            } else if (stateId === 'off') {
                // Silence – no sound
                return;
            }

            // ---------- POOL VALVE ----------
        } else if (id === 'pool_valve') {
            if (stateId === 'closed') {
                return; // Silence
            } else if (stateId === 'low') {
                source = this._createNoiseSource();
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, this.ctx.currentTime);
                filter.Q.value = 1.5;
                source.connect(filter);
                filter.connect(gain);
                gain.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.4);

            } else if (stateId === 'high') {
                source = this._createNoiseSource();
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2200, this.ctx.currentTime);
                filter.Q.value = 3;
                source.connect(filter);
                filter.connect(gain);
                gain.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.25);
            }

            // ---------- STEAM VALVE ----------
        } else if (id === 'steam_valve') {
            if (stateId === 'safe') {
                return; // Silence
            } else if (stateId === 'hissing') {
                source = this._createNoiseSource();
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(3000, this.ctx.currentTime);
                filter.Q.value = 2;
                source.connect(filter);
                filter.connect(gain);
                gain.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.3);

            } else if (stateId === 'bursting') {
                source = this._createNoiseSource();
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(2000, this.ctx.currentTime);
                filter.Q.value = 5;

                // Low rumble layer
                const rumble = this.ctx.createOscillator();
                const rumbleGain = this.ctx.createGain();
                rumble.type = 'sawtooth';
                rumble.frequency.setValueAtTime(40, this.ctx.currentTime);
                rumbleGain.gain.value = 0.25;
                rumble.connect(rumbleGain);

                const mixer = this.ctx.createGain();
                source.connect(filter);
                filter.connect(mixer);
                rumbleGain.connect(mixer);
                mixer.connect(gain);
                gain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.2);

                rumble.start();
                extraNodes.osc2 = rumble;
            }

            // ---------- WORKSTATION PC ----------
        } else if (id === 'workstation_pc') {
            if (stateId === 'black') {
                return; // Silence
            } else if (stateId === 'static') {
                source = this._createNoiseSource();
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(8000, this.ctx.currentTime);
                filter.Q.value = 1.5;
                source.connect(filter);
                filter.connect(gain);
                gain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.2);

            } else if (stateId === 'terminal') {
                source = this.ctx.createOscillator();
                source.type = 'square';
                source.frequency.setValueAtTime(1500, this.ctx.currentTime);

                const lfo = this.ctx.createOscillator();
                const lfoGain = this.ctx.createGain();
                lfo.type = 'square';
                lfo.frequency.value = 1;
                lfoGain.gain.value = 0.15;
                lfo.connect(lfoGain);
                lfoGain.connect(gain.gain);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 1000;
                source.connect(filter);
                filter.connect(gain);
                gain.gain.setTargetAtTime(0.25, this.ctx.currentTime, 0.1);

                lfo.start();
                extraNodes.lfo = lfo;
            }

        } else {
            // Unknown interactable – no sound
            return;
        }

        // If no source was created (shouldn't happen but safety), bail out
        if (!source) return;

        // Connect to master, start, register
        gain.connect(this.masterGain);
        source.start();
        this.loops.set(id, { source, gain, ...extraNodes });
    }

    async playUiSound(type) {
        if (!this.ctx || !this.enabled) return;

        const now = this.ctx.currentTime;

        // Check if there's a mapped sound for this UI type
        const mapped = this.mappings.ui[type];
        if (mapped) {
            const buffer = await this.ensureBuffer(mapped.audio_file_id);
            if (buffer) {
                this.playBuffer(mapped.audio_file_id, this.sfxGain, mapped.volume);
                return;
            }
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        switch (type) {
            case 'click':
                osc.type = 'square';
                osc.frequency.setValueAtTime(1200, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            case 'keypress':
                // Retro mechanical keyboard click sound
                osc.type = 'triangle';
                const keyFreq = 600 + Math.random() * 800;
                osc.frequency.setValueAtTime(keyFreq, now);
                osc.frequency.exponentialRampToValueAtTime(keyFreq / 4, now + 0.03);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.03);
                osc.start(now);
                osc.stop(now + 0.03);
                break;
            case 'error':
                // Low retro beep for syntax/action error
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(120, now);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'success':
                // Classic ascending retro success sound
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.setValueAtTime(600, now + 0.08);
                osc.frequency.setValueAtTime(800, now + 0.16);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
                break;
            case 'transition':
                const transBase = 200 + (Math.random() * 60 - 30);
                const transEnd = 50 + (Math.random() * 20 - 10);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(transBase, now);
                osc.frequency.linearRampToValueAtTime(transEnd, now + 0.5);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;
            case 'arrival':
                const arrivalStart = 440 + (Math.random() * 80 - 40);
                const arrivalEnd = 880 + (Math.random() * 160 - 80);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(arrivalStart, now);
                osc.frequency.setValueAtTime(arrivalEnd, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            case 'glitch':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(Math.random() * 2000, now);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.02);
                osc.start(now);
                osc.stop(now + 0.02);
                break;
        }

        osc.connect(gain);
        gain.connect(this.sfxGain);
    }

    async playTransitionSound(transitionId) {
        if (!this.ctx || !this.enabled) return;

        const mapping = this.mappings.transitions[transitionId];
        if (mapping) {
            const buffer = await this.ensureBuffer(mapping.audio_file_id);
            if (buffer) {
                this.playBuffer(mapping.audio_file_id, this.sfxGain, mapping.volume);
                return;
            }
        }
        
        // Default procedural transition sound
        this.playUiSound('transition');
    }

    async fetchMappings() {
        try {
            const res = await fetch('admin/api.php?action=get_audio');
            const data = await res.json();

            this.mappings = { bgm: {}, states: {}, transitions: {}, ui: {} };
            (data.mappings || []).forEach(m => {
                if (this.mappings[m.mapping_type]) {
                    this.mappings[m.mapping_type][m.context_id] = m;
                }
            });

            // Populate the library map with ID -> Filepath mappings for lazy loading
            this.library = new Map();
            (data.library || []).forEach(a => {
                this.library.set(a.id, a.filepath);
            });

            // Preload only UI sounds to ensure zero-latency UI feedback
            const uiAssetIds = Object.values(this.mappings.ui).map(m => m.audio_file_id);
            const preloadPromises = (data.library || [])
                .filter(a => uiAssetIds.includes(a.id))
                .map(async (a) => {
                    const buffer = await this.loadBuffer(a.filepath);
                    if (buffer) this.buffers.set(a.id, buffer);
                });
            await Promise.all(preloadPromises);
            console.log(`AUDIO ENGINE: Mapped ${data.mappings.length} sounds, preloaded ${this.buffers.size} UI assets.`);
        } catch (e) {
            console.error("Failed to fetch audio mappings:", e);
        }
    }

    async ensureBuffer(id) {
        if (!id) return null;
        if (this.buffers.has(id)) {
            return this.buffers.get(id);
        }
        const filepath = this.library?.get(id);
        if (!filepath) {
            console.warn(`AUDIO ENGINE: Filepath not found for audio asset ID ${id}`);
            return null;
        }
        console.log(`AUDIO ENGINE: Lazy-loading audio asset: ${filepath} (ID: ${id})`);
        const buffer = await this.loadBuffer(filepath);
        if (buffer) {
            this.buffers.set(id, buffer);
        }
        return buffer;
    }

    async loadBuffer(url) {
        if (!this.ctx) return null;
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            return await this.ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error(`Failed to load audio: ${url}`, e);
            return null;
        }
    }

    playBuffer(id, destination, volume = 0.5, loop = false) {
        const buffer = this.buffers.get(id);
        if (!buffer) return null;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;

        const gain = this.ctx.createGain();
        gain.gain.value = volume;

        source.connect(gain);
        gain.connect(destination || this.ctx.destination);
        source.start();

        return { source, gain };
    }

    async updateBgm(roomId) {
        if (!this.ctx || !this.enabled) return;

        const mapping = this.mappings.bgm[roomId];
        const nextBgmId = mapping ? mapping.audio_file_id : null;

        if (this.currentBgmId === nextBgmId) return;

        if (this.bgmSource) {
            const oldGain = this.bgmGain;
            const oldSource = this.bgmSource;
            oldGain.gain.setTargetAtTime(0, this.ctx.currentTime, 1.5);
            setTimeout(() => {
                try { oldSource.stop(); } catch (e) { }
                oldGain.disconnect();
            }, 3000);
        }

        this.currentBgmId = nextBgmId;
        this.bgmSource = null;
        this.bgmGain = null;

        if (nextBgmId) {
            const buffer = await this.ensureBuffer(nextBgmId);
            if (buffer && this.currentBgmId === nextBgmId) { // Check race condition
                const bgm = this.playBuffer(nextBgmId, this.masterGain, mapping.volume || 0.3, true);
                if (bgm) {
                    this.bgmSource = bgm.source;
                    this.bgmGain = bgm.gain;
                    this.bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
                    this.bgmGain.gain.setTargetAtTime(mapping.volume || 0.3, this.ctx.currentTime, 2.0);
                }
            }
        }
    }

    playStartupSound() {
        const now = this.ctx.currentTime;
        const notes = [440, 554.37, 659.25];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(freq, now + (i * 0.1));
            gain.gain.setValueAtTime(0.2, now + (i * 0.1));
            gain.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.1) + 0.5);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(now + (i * 0.1));
            osc.stop(now + (i * 0.1) + 0.5);
        });
    }

    setMasterVolume(val) {
        this.masterVol = val;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
        }
    }

    setAmbientVolume(val) {
        this.ambientVol = val;
        if (this.ambientGain) {
            this.ambientGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
        }
    }

    setSfxVolume(val) {
        this.sfxVol = val;
        if (this.sfxGain) {
            this.sfxGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
        }
    }

    // --- SFX Manifest Handling ---
    async loadSfxMapping(mapping) {
        if (!this.ctx) return;
        this.sfxBuffers = new Map();

        const promises = mapping.map(async (item) => {
            try {
                const response = await fetch(`media/sound_effects/${item.file}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.sfxBuffers.set(item.id, { buffer: audioBuffer, volume: item.volume });
            } catch (e) {
                console.error(`Failed to load SFX: ${item.file}`, e);
            }
        });

        await Promise.all(promises);
        console.log(`AUDIO ENGINE: Loaded ${this.sfxBuffers.size} external sound effects.`);
    }

    playSfx(id) {
        if (!this.ctx || !this.enabled || !this.sfxBuffers || !this.sfxBuffers.has(id)) return;

        const data = this.sfxBuffers.get(id);
        const source = this.ctx.createBufferSource();
        source.buffer = data.buffer;

        const gain = this.ctx.createGain();
        gain.gain.value = 0; // Fade-in SFX too
        gain.gain.setTargetAtTime(data.volume, this.ctx.currentTime, 0.05);

        source.connect(gain);
        gain.connect(this.sfxGain);

        // Track both source and gain for fade-out support
        const sfxEntry = { source, gain };

        source.onended = () => {
            this.activeSfx.delete(sfxEntry);
            try { gain.disconnect(); } catch (e) { }
        };

        this.activeSfx.add(sfxEntry);
        source.start(0);
    }

    /**
     * Stop absolutely everything – loops and transient SFX – with a graceful fade.
     */
    stopAllSounds(fadeTime = 0.3) {
        if (!this.ctx || !this.enabled) return;

        // Stop all environment loops with fade
        for (const id of Array.from(this.loops.keys())) {
            this._stopLoop(id, fadeTime);
        }

        const now = this.ctx.currentTime;
        // Stop all active buffer SFX with fade
        for (const sfx of this.activeSfx) {
            try {
                if (sfx.gain) {
                    sfx.gain.gain.setTargetAtTime(0, now, fadeTime);
                    setTimeout(() => {
                        try { sfx.source.stop(); } catch (e) { }
                        try { sfx.gain.disconnect(); } catch (e) { }
                    }, (fadeTime * 3000) + 50);
                } else {
                    // Fallback for untracked sources
                    sfx.stop();
                }
            } catch (e) { /* ignore */ }
        }
        this.activeSfx.clear();
    }

    playRandomSfxByCategory(category, manifest) {
        if (!manifest || !manifest.effects) return;
        const eligible = manifest.effects.filter(e => e.category === category);
        if (eligible.length === 0) return;

        const picked = eligible[Math.floor(Math.random() * eligible.length)];
        this.playSfx(picked.id);
    }
}

window.AudioEngine = AudioEngine;
