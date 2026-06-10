# Backrooms G2 - Technical Audio Documentation

## System Architecture
The audio engine uses the **Web Audio API** to generate procedural, non-repetitive sounds. This avoids large assets and allows for real-time manipulation based on the game state.

### Core Components
- **Ambient Buzz**: A constant 60Hz sawtooth hum representing the background radiation/electricity of the Backrooms.
- **Environment Loops**: Procedural sounds tied to specific interactable objects in a room.
- **UI Feedback**: Short, synthetic sounds for clicks, arrivals, and transitions.

---

## Interactable Audio Mapping
The system now uses `stateId` (string) from `interactables.json` to trigger sounds.

| Interactable | stateId | Audio Characteristics |
| :--- | :--- | :--- |
| **lobby_light** | `on` | 120Hz Square wave, Lowpass at 400Hz. |
| | `flickering` | 180Hz Square wave, 8Hz LFO modulating frequency. |
| | `off` | Silent. |
| **pool_valve** | `low` | White noise, Lowpass 800Hz, Q 1.5. |
| | `high` | White noise, Lowpass 2200Hz, Q 3. |
| | `closed` | Silent. |
| **steam_valve** | `hissing` | White noise, Highpass 3000Hz. |
| | `bursting` | Highpass noise + 40Hz Sawtooth rumble layer. |
| | `safe` | Silent. |
| **workstation_pc** | `static` | Pink-ish noise, Bandpass at 8000Hz. |
| | `terminal` | 1500Hz Square wave, 12Hz Square LFO (typing rhythm). |
| | `black` | Silent. |

---

## Technical API

### `setEnvironmentSound(id, stateId)`
Starts or stops a loop for a specific object.
- `id`: The interactable ID (e.g., 'lobby_light').
- `stateId`: The string ID of the state (from JSON). Passing `null` stops the sound.

### `playUiSound(type)`
Plays a one-shot effect.
- Types: `click`, `transition`, `arrival`, `glitch`.

### `syncEnvironmentSounds()`
Called automatically on every action. It checks which interactables are in the current room and updates their audio state. If the player is in a transition screen, all environment sounds are silenced.

---

## Optimization
- **Cleanup**: Uses `_stopLoop` with a small delay and `setTargetAtTime` for click-free transitions between audio states.
- **Resource Management**: Automatically disconnects gain nodes and stops oscillators when an object is no longer in range.
