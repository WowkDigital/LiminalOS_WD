# Feature Proposals: LiminalOS Evolution

This document presents a curated set of features to elevate the immersion, gameplay depth, and tech-fidelity of **LiminalOS // Backrooms Explorer**.

---

## 1. Visual & Atmospheric Upgrades

### 1.1 CRT Scanline & Low-Sanity Chromatic Aberration
*   **Concept**: When the player's sanity drops, the interface should visually degrade. This mirrors the psychological decay of exploring liminal spaces.
*   **Design**: 
    *   Add a subtle CRT scanline overlay.
    *   Use an SVG filter or CSS animations to introduce chromatic aberration (RGB splitting) and intermittent screen flickering proportional to the player's current sanity loss.
*   **CSS Blueprint**:
    ```css
    @keyframes glitch {
      0% { text-shadow: 0.5px 0 0 red, -0.5px 0 0 blue; }
      100% { text-shadow: -1px 0 0 red, 1px 0 0 blue; }
    }
    .low-sanity-glitch {
      animation: glitch 0.15s infinite;
      filter: contrast(1.2) brightness(0.9);
    }
    ```

### 1.2 Dynamic Static Hum (Audio Engine Coupling)
*   **Concept**: Integrate a low-frequency ambient hum that procedurally changes volume and distortion depending on the current room tags (e.g., `dark`, `industrial`).
*   **Design**: When the room has the `industrial` tag, add a high-pitch magnetic coil whine. When sanity is below 30%, introduce random radio static interruptions.

---

## 2. Gameplay & Progression Mechanics

### 2.1 Almond Water & Inventory System
*   **Concept**: Give players the ability to search rooms for consumables, primarily **Almond Water** to restore sanity.
*   **Design**:
    *   Add an `inventory` key to the game state.
    *   Introduce item nodes in the room view.
    *   A command like `USE almond_water` restores 25% Sanity.
*   **State Blueprint**:
    ```json
    {
      "inventory": {
        "almond_water": 2,
        "flashlight": 1
      }
    }
    ```

### 2.2 Entity Alert System (Panic Encounters)
*   **Concept**: Procedural, random encounters with Backrooms Entities (e.g., Smilers, Hounds) that trigger timed reaction events.
*   **Design**:
    *   Entering a room has a tiny probability of triggering an alert.
    *   The terminal flashes red: `!!! ENTITY DETECTED !!!`
    *   The player has 5 seconds to type `GO [exit]` or `USE flashlight` to escape, otherwise they suffer a severe sanity loss.

---

## 3. Technical Enhancements

### 3.1 Session Persistence (localStorage / Auto-save)
*   **Concept**: Automatically save the player's location, generated map graph, current sanity, and inventory to `localStorage`.
*   **Design**: Upon loading, check for saved states. If present, offer `RESUME OVERRIDE` alongside `NEW EXPEDITION` in the boot menu.

### 3.2 Terminal command History (Arrow Up/Down)
*   **Concept**: Standard console behavior where pressing `ArrowUp` or `ArrowDown` cycles through recently typed commands in the terminal container.
*   **Design**:
    *   A ring buffer of the last 20 commands.
    *   Implements seamless navigation through typed commands, accelerating keyboard navigation.
