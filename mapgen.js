/**
 * LIMINAL OS – Map Generation & Visualization Module
 *
 * MapGenerator  – builds the global room connection graph at session start.
 *                 Guarantees full reachability via a spanning tree, then adds
 *                 optional shortcut edges for variety.
 *
 * MapGraph      – renders a directed SVG map with hierarchical-organic layout.
 *                 Uses BFS depth for layer Y-positions and runs a short
 *                 force simulation for compact, organic horizontal spacing.
 *                 Directed edges are drawn with arrowheads.
 */

/* ============================================================
   MAP GENERATOR
   ============================================================ */

class MapGenerator {
    /** @param {BackroomsGame} game */
    constructor(game) {
        this.game = game;
    }

    /**
     * Generates state.roomTransitions for the entire map.
     *
     * Algorithm:
     *   1. Spanning tree – every room (except the root) gets one "forward"
     *      incoming edge from an already-placed room, guaranteeing 100%
     *      reachability.
     *   2. Remaining exit slots are filled with random shortcut edges.
     *   3. Each edge picks a random transition definition from transition_types.
     */
    generate() {
        const world = this.game.world;
        const roomIds = Object.keys(world.rooms);
        if (roomIds.length === 0) return;

        // Step 1: Spanning Tree (BFS order)
        const startId = roomIds.includes('lobby') ? 'lobby' : roomIds[0];
        const shuffledRest = roomIds
            .filter(id => id !== startId)
            .sort(() => Math.random() - 0.5);

        // assigned = rooms already wired into the tree
        const assigned = [startId];
        // incoming[roomId] = edge descriptor that "discovers" this room
        const incoming = {};

        for (const roomId of shuffledRest) {
            const parent = assigned[Math.floor(Math.random() * assigned.length)];
            const tDef = this._pickTransition(parent, roomId);
            incoming[roomId] = { from: parent, ...tDef };
            assigned.push(roomId);
        }

        // Step 2: Determine exit slot count per room
        // Higher probability for 1 exit (less shortcuts)
        const maxSlots = {};
        roomIds.forEach(id => {
            const r = Math.random();
            if (r < 0.65) maxSlots[id] = 1;      // 65% chance → 1 exit
            else if (r < 0.90) maxSlots[id] = 2; // 25% chance → 2 exits
            else maxSlots[id] = 3;               // 10% chance → 3 exits
        });

        // Step 3: Build outgoing edge lists
        // globalTransitions[roomId] = [{ id, label, target, requirements, category, isDiscovery }]
        const globalTransitions = {};
        roomIds.forEach(id => { globalTransitions[id] = []; });

        // Insert spanning-tree edges as exits from the parent
        for (const roomId of shuffledRest) {
            const inc = incoming[roomId];
            globalTransitions[inc.from].push({
                id: inc.id,
                label: inc.label,
                target: roomId,
                requirements: inc.requirements || null,
                category: inc.category,
                isDiscovery: true   // this edge leads to a room unknown at game-start
            });
        }

        // Step 4: Fill remaining slots with shortcuts
        roomIds.forEach(roomId => {
            const used = globalTransitions[roomId].length;
            const slots = maxSlots[roomId] - used;
            if (slots <= 0) return;

            const alreadyTargeted = new Set(globalTransitions[roomId].map(t => t.target));
            const candidates = roomIds
                .filter(id => id !== roomId && !alreadyTargeted.has(id))
                .sort(() => Math.random() - 0.5);

            candidates.slice(0, slots).forEach(targetRoom => {
                const tDef = this._pickTransition(roomId, targetRoom);
                globalTransitions[roomId].push({
                    id: tDef.id,
                    label: tDef.label,
                    target: targetRoom,
                    requirements: tDef.requirements || null,
                    category: tDef.category,
                    isDiscovery: false
                });
            });
        });

        // Step 5: Guarantee every room has at least one exit
        roomIds.forEach(roomId => {
            if (globalTransitions[roomId].length === 0) {
                const others = roomIds.filter(id => id !== roomId);
                const target = others[Math.floor(Math.random() * others.length)];
                const tDef = this._pickTransition(roomId, target);
                globalTransitions[roomId].push({
                    id: tDef.id,
                    label: tDef.label,
                    target,
                    requirements: null,
                    category: tDef.category,
                    isDiscovery: true
                });
            }
        });

        this.game.state.roomTransitions = globalTransitions;
        // BFS depths used by MapGraph for the hierarchical layout
        this.game.state.bfsDepth = this._computeBFSDepth(startId, globalTransitions);
    }

    /**
     * Picks a random transition definition compatible with the source room's
     * configured categories. Falls back to any available category.
     */
    _pickTransition(fromRoom, _toRoom) {
        const world = this.game.world;
        const categories = Object.keys(world.transition_types);
        if (categories.length === 0) {
            return { id: 'passage', label: '▸ Passage', category: null, requirements: null };
        }

        const rawTransitions = world.rooms[fromRoom]?.transitions || [];
        const preferredCategories = rawTransitions
            .map(t => (typeof t === 'object' && t !== null) ? t.category : t)
            .filter(cat => Boolean(cat) && world.transition_types[cat]);

        const catPool = preferredCategories.length > 0 ? preferredCategories : categories;
        const category = catPool[Math.floor(Math.random() * catPool.length)];
        const defs = world.transition_types[category];
        const def = defs[Math.floor(Math.random() * defs.length)];

        const rawDef = rawTransitions.find(
            t => typeof t === 'object' && t !== null && t.category === category
        );
        const requirements = rawDef?.requirements || null;

        return { id: def.id, label: def.label, category, requirements };
    }

    /**
     * BFS depth from startId through the generated transition graph.
     * @returns {{ [roomId: string]: number }}
     */
    _computeBFSDepth(startId, transitions) {
        const depth = { [startId]: 0 };
        const queue = [startId];
        while (queue.length > 0) {
            const current = queue.shift();
            for (const exit of (transitions[current] || [])) {
                if (depth[exit.target] === undefined) {
                    depth[exit.target] = depth[current] + 1;
                    queue.push(exit.target);
                }
            }
        }
        return depth;
    }
}


/* ============================================================
   MAP GRAPH  –  Hierarchical + organic force layout
   ============================================================ */

class MapGraph {
    /** @param {BackroomsGame} game */
    constructor(game) {
        this.game = game;
        this.svg = document.getElementById('map-svg');

        const mapPanel = document.getElementById('map-panel');
        const toggleBtn = document.getElementById('map-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                mapPanel.classList.toggle('collapsed');
                if (!mapPanel.classList.contains('collapsed')) this.update();
            });
        }
    }

    update() {
        if (!this.svg) return;
        const mapPanel = document.getElementById('map-panel');
        if (mapPanel && mapPanel.classList.contains('collapsed')) return;

        const rect = this.svg.getBoundingClientRect();
        this.width = rect.width || 280;
        this.height = rect.height || 460;

        this._draw();
    }

    /* ----------------------------------------------------------
       Layout: BFS depth → layer Y, then compact organic sim
    ---------------------------------------------------------- */

    _computeLayout() {
        const state = this.game.state;
        const visited = new Set(state.visitedRooms);

        // Visible nodes: visited rooms + their immediate unvisited neighbours
        const visible = new Set(state.visitedRooms);
        state.visitedRooms.forEach(roomId => {
            (state.roomTransitions[roomId] || []).forEach(e => visible.add(e.target));
        });

        const bfsDepth = state.bfsDepth || {};

        // Group nodes by BFS depth layer
        const byDepth = {};
        visible.forEach(id => {
            const d = bfsDepth[id] !== undefined ? bfsDepth[id] : 999;
            (byDepth[d] = byDepth[d] || []).push(id);
        });

        const depths = Object.keys(byDepth).map(Number).sort((a, b) => a - b);
        const layerCount = depths.length;

        const PAD = 30;
        const usableW = this.width - PAD * 2;
        const usableH = this.height - PAD * 2;

        // Target Y per layer (top → bottom, older rooms at top)
        const layerY = {};
        depths.forEach((d, i) => {
            layerY[d] = layerCount === 1
                ? PAD + usableH / 2
                : PAD + (i / (layerCount - 1)) * usableH;
        });

        // Initial positions: evenly spread within each layer
        const pos = {};
        depths.forEach(d => {
            const nodes = byDepth[d];
            nodes.forEach((id, colIdx) => {
                const count = nodes.length;
                const segW = count > 1 ? usableW / (count - 1) : 0;
                const baseX = count === 1
                    ? PAD + usableW / 2
                    : PAD + colIdx * segW;
                // Tiny deterministic jitter to break symmetry
                let hash = 0;
                for (let k = 0; k < id.length; k++) hash = (hash * 31 + id.charCodeAt(k)) | 0;
                const jitter = (Math.abs(hash % 12) - 6);
                pos[id] = { x: baseX + jitter, y: layerY[d], vx: 0, vy: 0 };
            });
        });

        // Build adjacency for force simulation
        const edges = this._buildEdges(visited);

        // Force simulation: 120 iterations
        const allNodes = Object.keys(pos);
        const TARGET_D = 110;  // ideal spring length between connected nodes
        const REPEL_D = 95;   // soft repulsion radius
        const MIN_DIST = 70;   // hard minimum distance between any two nodes
        const SPRING_K = 0.12;
        const REPEL_K = 480;
        const LAYER_K = 0.08; // soft pull back to BFS layer Y

        for (let iter = 0; iter < 120; iter++) {
            // --- Soft repulsion between all pairs ---
            for (let i = 0; i < allNodes.length; i++) {
                for (let j = i + 1; j < allNodes.length; j++) {
                    const a = pos[allNodes[i]];
                    const b = pos[allNodes[j]];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                    if (dist < REPEL_D) {
                        const f = REPEL_K / (dist * dist);
                        const ux = dx / dist, uy = dy / dist;
                        a.vx += ux * f; a.vy += uy * f;
                        b.vx -= ux * f; b.vy -= uy * f;
                    }
                }
            }

            // --- Spring attraction between connected nodes ---
            edges.forEach(({ source, target }) => {
                const a = pos[source];
                const b = pos[target];
                if (!a || !b) return;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                const f = (dist - TARGET_D) * SPRING_K;
                const ux = dx / dist, uy = dy / dist;
                a.vx += ux * f; a.vy += uy * f;
                b.vx -= ux * f; b.vy -= uy * f;
            });

            // --- Soft pull toward BFS layer Y ---
            allNodes.forEach(id => {
                const n = pos[id];
                const d = bfsDepth[id] !== undefined ? bfsDepth[id] : 999;
                if (layerY[d] !== undefined) {
                    n.vy += (layerY[d] - n.y) * LAYER_K;
                }
            });

            // --- Integrate + dampen + clamp to canvas bounds ---
            allNodes.forEach(id => {
                const n = pos[id];
                n.x += n.vx;
                n.y += n.vy;
                n.vx *= 0.45;
                n.vy *= 0.45;
                n.x = Math.max(PAD, Math.min(this.width - PAD, n.x));
                n.y = Math.max(PAD, Math.min(this.height - PAD, n.y));
            });

            // --- Hard separation pass: push apart any nodes closer than MIN_DIST ---
            // Run multiple sub-passes per iteration for faster convergence
            for (let sp = 0; sp < 3; sp++) {
                for (let i = 0; i < allNodes.length; i++) {
                    for (let j = i + 1; j < allNodes.length; j++) {
                        const a = pos[allNodes[i]];
                        const b = pos[allNodes[j]];
                        const dx = a.x - b.x;
                        const dy = a.y - b.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < MIN_DIST * MIN_DIST && distSq > 0) {
                            const dist = Math.sqrt(distSq);
                            // How much to push each node (split equally)
                            const push = (MIN_DIST - dist) * 0.5;
                            const ux = dx / dist, uy = dy / dist;
                            a.x += ux * push;
                            a.y += uy * push;
                            b.x -= ux * push;
                            b.y -= uy * push;
                            // Re-clamp after correction
                            a.x = Math.max(PAD, Math.min(this.width - PAD, a.x));
                            a.y = Math.max(PAD, Math.min(this.height - PAD, a.y));
                            b.x = Math.max(PAD, Math.min(this.width - PAD, b.x));
                            b.y = Math.max(PAD, Math.min(this.height - PAD, b.y));
                        }
                    }
                }
            }
        }

        return { pos, edges, visited };
    }

    /** Collect directed edges visible from visited rooms */
    _buildEdges(visitedSet) {
        const state = this.game.state;
        const edges = [];
        visitedSet.forEach(roomId => {
            (state.roomTransitions[roomId] || []).forEach(exit => {
                edges.push({ source: roomId, target: exit.target, category: exit.category });
            });
        });
        return edges;
    }

    /* ----------------------------------------------------------
       Rendering
    ---------------------------------------------------------- */

    _draw() {
        if (!this.svg) return;
        this.svg.innerHTML = '';

        const { pos, edges, visited } = this._computeLayout();

        // --- SVG defs: arrowhead marker ---
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        // Generic semi-transparent marker (colour is set per-line via stroke)
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '7');
        marker.setAttribute('markerHeight', '5');
        marker.setAttribute('refX', '6');
        marker.setAttribute('refY', '2.5');
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('markerUnits', 'strokeWidth');
        const arrowPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrowPoly.setAttribute('points', '0 0, 7 2.5, 0 5');
        arrowPoly.setAttribute('fill', 'currentColor');
        marker.appendChild(arrowPoly);
        defs.appendChild(marker);
        this.svg.appendChild(defs);

        const NODE_R_VISITED = 7;
        const NODE_R_UNKNOWN = 4.5;
        const NODE_R_CURRENT = 9;

        const state = this.game.state;
        const currentRoom = state.isTransitioning
            ? state.transitionContext?.target
            : state.currentRoom;

        // --- Draw edges (with arrowheads) ---
        const drawn = new Set();
        edges.forEach(({ source, target, category }) => {
            const p1 = pos[source];
            const p2 = pos[target];
            if (!p1 || !p2) return;

            // Avoid duplicate bidirectional rendering of the same pair
            const key = source + '→' + target;
            if (drawn.has(key)) return;
            drawn.add(key);

            const isTargetVisited = visited.has(target);
            const color = this.game.getCategoryColor(category);
            const alpha = isTargetVisited ? 0.65 : 0.25;
            const strokeColor = color.replace('hsl', 'hsla').replace(')', `, ${alpha})`);

            // Shorten line end so arrowhead touches node circumference
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / len, uy = dy / len;
            const rEnd = (target === currentRoom ? NODE_R_CURRENT : (isTargetVisited ? NODE_R_VISITED : NODE_R_UNKNOWN)) + 2;
            const ex = p2.x - ux * rEnd;
            const ey = p2.y - uy * rEnd;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', p1.x);
            line.setAttribute('y1', p1.y);
            line.setAttribute('x2', ex);
            line.setAttribute('y2', ey);
            line.setAttribute('stroke', strokeColor);
            line.setAttribute('stroke-width', isTargetVisited ? '2' : '1.2');
            line.setAttribute('color', strokeColor); // makes arrowhead currentColor
            if (!isTargetVisited) line.setAttribute('stroke-dasharray', '4 4');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            this.svg.appendChild(line);
        });

        // --- Draw nodes (unvisited first, then visited, current last) ---
        const allIds = Object.keys(pos).sort((a, b) => {
            if (a === currentRoom) return 1;
            if (b === currentRoom) return -1;
            return (visited.has(a) ? 1 : 0) - (visited.has(b) ? 1 : 0);
        });

        allIds.forEach(id => {
            const p = pos[id];
            if (!p) return;
            const isCurrent = id === currentRoom;
            const isVisited = visited.has(id);
            this._renderNode(id, p, isCurrent, isVisited);
        });
    }

    _renderNode(id, pos, isCurrent, isVisited) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        // Glow ring for current position
        if (isCurrent) {
            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            glow.setAttribute('cx', pos.x);
            glow.setAttribute('cy', pos.y);
            glow.setAttribute('r', 15);
            glow.setAttribute('fill', 'rgba(255,255,255,0.03)');
            glow.setAttribute('stroke', 'rgba(255, 255, 255, 0.25)');
            glow.setAttribute('stroke-width', '1');
            // Adding subtle animation to glow
            const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animate.setAttribute('attributeName', 'r');
            animate.setAttribute('values', '13;17;13');
            animate.setAttribute('dur', '2s');
            animate.setAttribute('repeatCount', 'indefinite');
            glow.appendChild(animate);
            group.appendChild(glow);
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);

        if (isCurrent) {
            circle.setAttribute('r', '9');
            circle.setAttribute('fill', '#ffffff');
            circle.setAttribute('stroke', '#33ff33');
            circle.setAttribute('stroke-width', '2.5');
        } else if (isVisited) {
            circle.setAttribute('r', '7');
            circle.setAttribute('fill', 'rgba(51, 255, 51, 0.15)');
            circle.setAttribute('stroke', '#33ff33');
            circle.setAttribute('stroke-width', '2');
        } else {
            // Unknown room
            circle.setAttribute('r', '4.5');
            circle.setAttribute('fill', 'rgba(255, 255, 255, 0.05)');
            circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
            circle.setAttribute('stroke-width', '1');
        }
        group.appendChild(circle);

        // Label for visited / current nodes
        if (isVisited || isCurrent) {
            const name = this.game.world.rooms[id]?.name || id;
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pos.x + 13);
            text.setAttribute('y', pos.y + 4);
            text.setAttribute('fill', isCurrent ? '#ffffff' : 'rgba(255, 255, 255, 0.85)');
            text.setAttribute('font-size', isCurrent ? '10px' : '9px');
            text.setAttribute('font-family', 'var(--font-tech)');
            text.setAttribute('font-weight', isCurrent ? 'bold' : '500');
            text.textContent = name.toUpperCase().substring(0, 16);
            group.appendChild(text);
        } else {
            // Question mark for undiscovered nodes
            const q = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            q.setAttribute('x', pos.x);
            q.setAttribute('y', pos.y + 3);
            q.setAttribute('fill', 'rgba(255, 255, 255, 0.35)');
            q.setAttribute('font-size', '7px');
            q.setAttribute('font-family', 'var(--font-tech)');
            q.setAttribute('text-anchor', 'middle');
            q.textContent = '?';
            group.appendChild(q);
        }

        this.svg.appendChild(group);
    }
}

/* ============================================================
   PATHFINDING HINT  –  getRecommendedExits(game)

   Returns a Set of transition IDs whose exit leads to the NEAREST
   unvisited room (fewest hops through the directed roomTransitions
   graph).  The player should take these exits to discover new rooms
   as quickly as possible.

   Ties: if two exits have the same minimum distance, both are marked.
   All rooms visited: returns an empty Set.
   ============================================================ */

/**
 * @param   {BackroomsGame} game
 * @returns {Set<string>}   Set of transition IDs to mark with ▹ EXPLORE
 */
function getRecommendedExits(game) {
    const state = game.state;
    const visited = new Set(state.visitedRooms);
    const exits = state.roomTransitions[state.currentRoom] || [];

    if (exits.length === 0) return new Set();

    // Early-out: nothing left to discover
    const hasUnvisited = Object.keys(game.world.rooms).some(id => !visited.has(id));
    if (!hasUnvisited) return new Set();

    /**
     * BFS from startRoom through directed edges.
     * Returns the number of hops to the closest unvisited room,
     * or Infinity if no unvisited room is reachable.
     */
    function distToNearestUnvisited(startRoom) {
        // The start room itself may already be unvisited (target of this exit)
        if (!visited.has(startRoom)) return 0;

        const queue = [{ room: startRoom, dist: 0 }];
        const seen = new Set([startRoom]);

        while (queue.length > 0) {
            const { room, dist } = queue.shift();
            for (const e of (state.roomTransitions[room] || [])) {
                if (seen.has(e.target)) continue;
                seen.add(e.target);
                if (!visited.has(e.target)) return dist + 1; // found one
                queue.push({ room: e.target, dist: dist + 1 });
            }
        }
        return Infinity; // dead end — no unvisited room reachable
    }

    // Compute minimum distance to nearest unvisited room for each exit
    const exitDistances = exits.map(exit => ({
        id: exit.id,
        dist: distToNearestUnvisited(exit.target)
    }));

    const minDist = Math.min(...exitDistances.map(e => e.dist));

    // No reachable unvisited room from any exit
    if (!isFinite(minDist)) return new Set();

    // Mark all exits tied at the minimum distance
    return new Set(
        exitDistances
            .filter(e => e.dist === minDist)
            .map(e => e.id)
    );
}
