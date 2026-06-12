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

        // Step 6: Guarantee strong connectivity (every room can reach startId)
        let S = this._getNodesCanReach(startId, globalTransitions, roomIds);
        while (S.size < roomIds.length) {
            const remaining = roomIds.filter(id => !S.has(id));
            const u = remaining[Math.floor(Math.random() * remaining.length)];
            
            const targetPool = Array.from(S);
            const w = targetPool[Math.floor(Math.random() * targetPool.length)];
            
            const tDef = this._pickTransition(u, w);
            globalTransitions[u].push({
                id: tDef.id,
                label: tDef.label,
                target: w,
                requirements: null, // Guarantee this return path is not locked
                category: tDef.category,
                isDiscovery: false
            });
            
            S = this._getNodesCanReach(startId, globalTransitions, roomIds);
        }

        this.game.state.roomTransitions = globalTransitions;
        // BFS depths used by MapGraph for the hierarchical layout
        this.game.state.bfsDepth = this._computeBFSDepth(startId, globalTransitions);
        // Optimize and precompute graph positions for the entire world
        this.game.state.mapPositions = this._computeGlobalLayout(globalTransitions, startId);
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

    /**
     * Finds all rooms that can reach the target room through the directed transition graph.
     * @param {string} target
     * @param {{ [roomId: string]: any[] }} transitions
     * @param {string[]} roomIds
     * @returns {Set<string>}
     */
    _getNodesCanReach(target, transitions, roomIds) {
        // Build transpose graph (incoming edges)
        const incoming = {};
        roomIds.forEach(id => { incoming[id] = []; });
        roomIds.forEach(source => {
            for (const t of (transitions[source] || [])) {
                if (incoming[t.target]) {
                    incoming[t.target].push(source);
                }
            }
        });

        const visited = new Set([target]);
        const queue = [target];
        while (queue.length > 0) {
            const curr = queue.shift();
            for (const parent of (incoming[curr] || [])) {
                if (!visited.has(parent)) {
                    visited.add(parent);
                    queue.push(parent);
                }
            }
        }
        return visited;
    }

    /**
     * Run force-directed layout optimization over the entire world graph.
     * Calculated in a normalized 800x1200 logical space.
     */
    _computeGlobalLayout(transitions, startId) {
        const roomIds = Object.keys(this.game.world.rooms);
        const bfsDepth = this._computeBFSDepth(startId, transitions);

        // Find max depth to scale layout height
        let maxDepth = 1;
        roomIds.forEach(id => {
            const d = bfsDepth[id] !== undefined ? bfsDepth[id] : 0;
            if (d > maxDepth) maxDepth = d;
        });

        // Logical space size
        const width = 800;
        const height = 1200;
        const PAD = 80;
        const usableW = width - PAD * 2;
        const usableH = height - PAD * 2;

        // Initialize positions: hierarchy-based top-to-bottom layout with random horizontal scatter
        const pos = {};
        roomIds.forEach(id => {
            const d = bfsDepth[id] !== undefined ? bfsDepth[id] : maxDepth + 1;
            // Target layer Y
            const targetY = PAD + (d / (maxDepth + 1)) * usableH;
            
            // Generate deterministic offset based on roomId string hash
            let hash = 0;
            for (let k = 0; k < id.length; k++) {
                hash = (hash * 31 + id.charCodeAt(k)) | 0;
            }
            const offsetFraction = ((Math.abs(hash) % 100) / 100) - 0.5; // -0.5 to 0.5
            const startX = (width / 2) + offsetFraction * (usableW * 0.4);

            pos[id] = {
                x: startX,
                y: targetY,
                vx: 0,
                vy: 0,
                depth: d
            };
        });

        // Extract unique edges in the graph
        const edges = [];
        const seenEdges = new Set();
        roomIds.forEach(source => {
            (transitions[source] || []).forEach(exit => {
                const target = exit.target;
                const edgeKey = source < target ? `${source}-${target}` : `${target}-${source}`;
                if (!seenEdges.has(edgeKey)) {
                    edges.push({ source, target });
                    seenEdges.add(edgeKey);
                }
            });
        });

        // Simulation parameters
        const totalIterations = 600;
        const idealLength = 160;     // Ideal link distance
        const kAttraction = 0.08;   // Spring constant
        const kRepulsion = 150000;  // Node repulsion strength (charge)
        const kGravityX = 0.03;     // Pull toward horizontal center
        const kGravityY = 0.08;     // Pull toward target hierarchical Y
        const minDistance = 110;    // Hard collision limit
        const damping = 0.85;

        for (let iter = 0; iter < totalIterations; iter++) {
            // Cool down the system temperature from 1.0 to 0.05
            const temp = 1.0 - (iter / totalIterations) * 0.95;

            // 1. Repulsive forces (all pairs repel)
            for (let i = 0; i < roomIds.length; i++) {
                for (let j = i + 1; j < roomIds.length; j++) {
                    const idA = roomIds[i];
                    const idB = roomIds[j];
                    const nodeA = pos[idA];
                    const nodeB = pos[idB];

                    const dx = nodeA.x - nodeB.x;
                    const dy = nodeA.y - nodeB.y;
                    const distSq = dx * dx + dy * dy || 1;
                    const dist = Math.sqrt(distSq);

                    // Repulsion force inversely proportional to distance squared
                    const force = kRepulsion / Math.max(100, distSq);
                    const ux = dx / dist;
                    const uy = dy / dist;

                    nodeA.vx += ux * force;
                    nodeA.vy += uy * force;
                    nodeB.vx -= ux * force;
                    nodeB.vy -= uy * force;
                }
            }

            // 2. Attractive forces (links pull connected nodes)
            edges.forEach(({ source, target }) => {
                const nodeA = pos[source];
                const nodeB = pos[target];
                if (!nodeA || !nodeB) return;

                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                // Hooke's Law spring force
                const force = (dist - idealLength) * kAttraction;
                const ux = dx / dist;
                const uy = dy / dist;

                nodeA.vx += ux * force;
                nodeA.vy += uy * force;
                nodeB.vx -= ux * force;
                nodeB.vy -= uy * force;
            });

            // 3. Gravity and target depth pull (hierarchical guidance)
            roomIds.forEach(id => {
                const node = pos[id];
                const targetY = PAD + (node.depth / (maxDepth + 1)) * usableH;

                // Soft pull toward x = 400 (horizontal center)
                node.vx += (400 - node.x) * kGravityX;

                // Soft pull toward hierarchical target Y
                node.vy += (targetY - node.y) * kGravityY;
            });

            // 4. Update positions, apply temperature damping, clamp to canvas bounds
            roomIds.forEach(id => {
                const node = pos[id];

                // Apply velocity scaled by temperature
                node.x += node.vx * temp;
                node.y += node.vy * temp;

                // Apply damping
                node.vx *= damping;
                node.vy *= damping;

                // Keep inside canvas bounds
                node.x = Math.max(PAD, Math.min(width - PAD, node.x));
                node.y = Math.max(PAD, Math.min(height - PAD, node.y));
            });

            // 5. Post-pass collision prevention (hard separation push)
            for (let pushPass = 0; pushPass < 3; pushPass++) {
                for (let i = 0; i < roomIds.length; i++) {
                    for (let j = i + 1; j < roomIds.length; j++) {
                        const nodeA = pos[roomIds[i]];
                        const nodeB = pos[roomIds[j]];

                        let dx = nodeA.x - nodeB.x;
                        let dy = nodeA.y - nodeB.y;
                        let dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < minDistance) {
                            if (dist === 0) {
                                dx = (Math.random() - 0.5) * 2;
                                dy = (Math.random() - 0.5) * 2;
                                dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                            }
                            const push = (minDistance - dist) * 0.5;
                            const ux = dx / dist;
                            const uy = dy / dist;

                            nodeA.x += ux * push;
                            nodeA.y += uy * push;
                            nodeB.x -= ux * push;
                            nodeB.y -= uy * push;

                            // Keep inside canvas bounds
                            nodeA.x = Math.max(PAD, Math.min(width - PAD, nodeA.x));
                            nodeA.y = Math.max(PAD, Math.min(height - PAD, nodeA.y));
                            nodeB.x = Math.max(PAD, Math.min(width - PAD, nodeB.x));
                            nodeB.y = Math.max(PAD, Math.min(height - PAD, nodeB.y));
                        }
                    }
                }
            }
        }

        // Return final optimized layout positions
        const result = {};
        roomIds.forEach(id => {
            result[id] = { x: pos[id].x, y: pos[id].y };
        });
        return result;
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

        // Zoom/pan state
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.hasDragged = false;
        this.startX = 0;
        this.startY = 0;
        this.lastRoom = null;

        const mapPanel = document.getElementById('map-panel');
        const toggleBtn = document.getElementById('map-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                mapPanel.classList.toggle('collapsed');
                if (!mapPanel.classList.contains('collapsed')) this.update();
            });
        }

        window.addEventListener('resize', () => {
            if (mapPanel && !mapPanel.classList.contains('collapsed')) {
                this.update();
            }
        });

        // Initialize drag, zoom, and resize controls
        this._initInteraction();
    }

    update() {
        if (!this.svg) return;
        const mapPanel = document.getElementById('map-panel');
        if (mapPanel && mapPanel.classList.contains('collapsed')) return;

        // Update technical header statistics
        const totalRooms = Object.keys(this.game.world.rooms).length;
        const visitedRooms = this.game.state.visitedRooms.length;
        
        const exploredEl = document.getElementById('map-stat-explored');
        if (exploredEl) {
            exploredEl.textContent = `${visitedRooms}/${totalRooms}`;
        }
        
        const stabilityEl = document.getElementById('map-stat-stability');
        if (stabilityEl) {
            stabilityEl.textContent = `${this.game.state.sanity}%`;
        }

        const rect = this.svg.getBoundingClientRect();
        this.width = rect.width || 330;
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

        // Determine current room
        const currentRoom = state.isTransitioning
            ? state.transitionContext?.target
            : state.currentRoom;

        if (currentRoom) {
            visible.add(currentRoom);
        }

        // Center coordinates
        const cx = this.width / 2;
        const cy = this.height / 2;

        // Get precalculated logical positions
        const mapPositions = state.mapPositions || {};
        const currentLogical = mapPositions[currentRoom] || { x: 400, y: 600 };

        // Scale factors to map logical offset to screen coordinates
        const scaleX = (this.width - 70) / 800;
        const scaleY = (this.height - 80) / 1200;

        // Initialize positions: offset relative to the centered current room
        const pos = {};
        visible.forEach(id => {
            if (id === currentRoom) {
                pos[id] = { x: cx, y: cy, vx: 0, vy: 0, fixed: true };
            } else {
                const logicalPos = mapPositions[id] || { x: 400, y: 600 };
                let dx = (logicalPos.x - currentLogical.x) * scaleX;
                let dy = (logicalPos.y - currentLogical.y) * scaleY;

                // Cap initial distance to prevent extreme offsets
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const maxOffset = Math.min(this.width, this.height) * 0.45;
                if (dist > maxOffset) {
                    dx = (dx / dist) * maxOffset;
                    dy = (dy / dist) * maxOffset;
                }

                pos[id] = {
                    x: cx + dx,
                    y: cy + dy,
                    vx: 0,
                    vy: 0,
                    fixed: false
                };
            }
        });

        const edges = this._buildEdges(visited);

        // Run a fast, localized force simulation (150 iterations)
        const allNodes = Object.keys(pos);
        const idealLength = 95;
        const kAttraction = 0.15;
        const kRepulsion = 22000;
        const kGravity = 0.06;
        const minDistance = 72;
        const damping = 0.8;

        for (let iter = 0; iter < 150; iter++) {
            const temp = 1.0 - (iter / 150) * 0.9; // simulated cooling

            // 1. Repulsion forces
            for (let i = 0; i < allNodes.length; i++) {
                for (let j = i + 1; j < allNodes.length; j++) {
                    const nodeA = pos[allNodes[i]];
                    const nodeB = pos[allNodes[j]];

                    const dx = nodeA.x - nodeB.x;
                    const dy = nodeA.y - nodeB.y;
                    const distSq = dx * dx + dy * dy || 1;
                    const dist = Math.sqrt(distSq);

                    const force = kRepulsion / Math.max(25, distSq);
                    const ux = dx / dist;
                    const uy = dy / dist;

                    if (!nodeA.fixed) { nodeA.vx += ux * force; nodeA.vy += uy * force; }
                    if (!nodeB.fixed) { nodeB.vx -= ux * force; nodeB.vy -= uy * force; }
                }
            }

            // 2. Attraction forces along connections
            edges.forEach(({ source, target }) => {
                const nodeA = pos[source];
                const nodeB = pos[target];
                if (!nodeA || !nodeB) return;

                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                const force = (dist - idealLength) * kAttraction;
                const ux = dx / dist;
                const uy = dy / dist;

                if (!nodeA.fixed) { nodeA.vx += ux * force; nodeA.vy += uy * force; }
                if (!nodeB.fixed) { nodeB.vx -= ux * force; nodeB.vy -= uy * force; }
            });

            // 3. Gravity toward center for non-fixed nodes
            allNodes.forEach(id => {
                const node = pos[id];
                if (node.fixed) return;

                node.vx += (cx - node.x) * kGravity;
                node.vy += (cy - node.y) * kGravity;
            });

            // 4. Update coordinates, damping, and viewport clamping
            const padX = 30;
            const padY = 35;
            allNodes.forEach(id => {
                const node = pos[id];
                if (node.fixed) return;

                node.x += node.vx * temp;
                node.y += node.vy * temp;

                node.vx *= damping;
                node.vy *= damping;

                node.x = Math.max(padX, Math.min(this.width - padX, node.x));
                node.y = Math.max(padY, Math.min(this.height - padY, node.y));
            });

            // 5. Collision resolution push pass
            for (let i = 0; i < allNodes.length; i++) {
                for (let j = i + 1; j < allNodes.length; j++) {
                    const nodeA = pos[allNodes[i]];
                    const nodeB = pos[allNodes[j]];
                    if (!nodeA || !nodeB) continue;

                    let dx = nodeA.x - nodeB.x;
                    let dy = nodeA.y - nodeB.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < minDistance) {
                        if (dist === 0) {
                            dx = (Math.random() - 0.5) * 2;
                            dy = (Math.random() - 0.5) * 2;
                            dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                        }
                        const push = minDistance - dist;
                        const ux = dx / dist;
                        const uy = dy / dist;

                        if (nodeA.fixed) {
                            nodeB.x -= ux * push;
                            nodeB.y -= uy * push;
                        } else if (nodeB.fixed) {
                            nodeA.x += ux * push;
                            nodeA.y += uy * push;
                        } else {
                            nodeA.x += ux * push * 0.5;
                            nodeA.y += uy * push * 0.5;
                            nodeB.x -= ux * push * 0.5;
                            nodeB.y -= uy * push * 0.5;
                        }

                        // Re-clamp
                        if (!nodeA.fixed) {
                            nodeA.x = Math.max(padX, Math.min(this.width - padX, nodeA.x));
                            nodeA.y = Math.max(padY, Math.min(this.height - padY, nodeA.y));
                        }
                        if (!nodeB.fixed) {
                            nodeB.x = Math.max(padX, Math.min(this.width - padX, nodeB.x));
                            nodeB.y = Math.max(padY, Math.min(this.height - padY, nodeB.y));
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

        // Determine which rooms are directly reachable from current position
        const state = this.game.state;
        const currentRoom = state.isTransitioning
            ? state.transitionContext?.target
            : state.currentRoom;

        // Reset zoom/pan only when current room actually changes
        if (currentRoom !== this.lastRoom) {
            this.zoom = 1.0;
            this.panX = 0;
            this.panY = 0;
            this.lastRoom = currentRoom;
        }

        const reachable = new Set();
        (state.roomTransitions[currentRoom] || []).forEach(e => reachable.add(e.target));

        // --- SVG defs: grid pattern & arrowhead marker ---
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Dotted grid pattern matching LiminalOS aesthetic
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'map-grid');
        pattern.setAttribute('width', '24');
        pattern.setAttribute('height', '24');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        const gridCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        gridCircle.setAttribute('cx', '12');
        gridCircle.setAttribute('cy', '12');
        gridCircle.setAttribute('r', '1');
        gridCircle.setAttribute('fill', 'rgba(234, 179, 8, 0.12)'); // Subtle amber dot
        pattern.appendChild(gridCircle);
        defs.appendChild(pattern);

        // Tech arrowhead marker
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '4');
        marker.setAttribute('refX', '5');
        marker.setAttribute('refY', '2');
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('markerUnits', 'strokeWidth');
        const arrowPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrowPoly.setAttribute('points', '0 0, 6 2, 0 4');
        arrowPoly.setAttribute('fill', 'currentColor');
        marker.appendChild(arrowPoly);
        defs.appendChild(marker);
        this.svg.appendChild(defs);

        // Background Grid Pattern (keeps static radar background grid)
        const bgGrid = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgGrid.setAttribute('width', '100%');
        bgGrid.setAttribute('height', '100%');
        bgGrid.setAttribute('fill', 'url(#map-grid)');
        this.svg.appendChild(bgGrid);

        // --- Create Map Stage Group (for transform/zoom/pan) ---
        const stage = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        stage.setAttribute('id', 'map-stage');

        const NODE_R_VISITED = 7;
        const NODE_R_UNKNOWN = 4.5;
        const NODE_R_CURRENT = 9;

        // --- Draw edges (with arrowheads) ---
        const drawn = new Set();
        edges.forEach(({ source, target, category }) => {
            const p1 = pos[source];
            const p2 = pos[target];
            if (!p1 || !p2) return;

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

            // Base connection path
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'map-edge');
            line.setAttribute('x1', p1.x);
            line.setAttribute('y1', p1.y);
            line.setAttribute('x2', ex);
            line.setAttribute('y2', ey);
            line.setAttribute('stroke', strokeColor);
            line.setAttribute('stroke-width', isTargetVisited ? '2' : '1');
            line.setAttribute('color', strokeColor); // makes arrowhead currentColor
            if (!isTargetVisited) line.setAttribute('stroke-dasharray', '3 3');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            stage.appendChild(line);

            // Flow overlay (animated scanner pulse) for visited paths
            if (isTargetVisited) {
                const lineFlow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lineFlow.setAttribute('class', 'map-edge-flow');
                lineFlow.setAttribute('x1', p1.x);
                lineFlow.setAttribute('y1', p1.y);
                lineFlow.setAttribute('x2', ex);
                lineFlow.setAttribute('y2', ey);
                
                const flowColor = color.replace('hsl', 'hsla').replace(')', `, 0.7)`);
                lineFlow.setAttribute('stroke', flowColor);
                lineFlow.setAttribute('stroke-width', '2');
                stage.appendChild(lineFlow);
            }
        });

        // --- Draw nodes ---
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
            const isReachable = reachable.has(id);
            this._renderNode(id, p, isCurrent, isVisited, isReachable, stage);
        });

        this.svg.appendChild(stage);
        this._applyTransform();
    }

    _renderNode(id, pos, isCurrent, isVisited, isReachable, parentContainer) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        let nodeClass = 'map-node';
        if (isReachable) nodeClass += ' map-node--reachable';
        if (isCurrent) nodeClass += ' map-node--current';
        group.setAttribute('class', nodeClass);
        group.setAttribute('data-id', id);

        // Interaction event listeners
        group.addEventListener('mouseenter', () => this.showNodeTelemetry(id, isCurrent, isVisited, isReachable));
        group.addEventListener('mouseleave', () => this.resetNodeTelemetry());

        // Click to navigate to reachable rooms (ignore if user is panning the map)
        if (isReachable && !isCurrent) {
            group.addEventListener('click', () => {
                if (this.hasDragged) return;
                this._navigateToRoom(id);
            });
        }

        // Target target ring / scanner glow for current location
        if (isCurrent) {
            // Pulsing glow outer ring
            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            glow.setAttribute('cx', pos.x);
            glow.setAttribute('cy', pos.y);
            glow.setAttribute('r', 16);
            glow.setAttribute('fill', 'none');
            glow.setAttribute('stroke', 'var(--accent-glow)');
            glow.setAttribute('stroke-width', '2');
            
            const animateR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animateR.setAttribute('attributeName', 'r');
            animateR.setAttribute('values', '11;17;11');
            animateR.setAttribute('dur', '2s');
            animateR.setAttribute('repeatCount', 'indefinite');
            glow.appendChild(animateR);
            
            const animateO = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animateO.setAttribute('attributeName', 'opacity');
            animateO.setAttribute('values', '0.8;0.2;0.8');
            animateO.setAttribute('dur', '2s');
            animateO.setAttribute('repeatCount', 'indefinite');
            glow.appendChild(animateO);
            
            group.appendChild(glow);

            // Technical target brackets
            const targetRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            targetRing.setAttribute('cx', pos.x);
            targetRing.setAttribute('cy', pos.y);
            targetRing.setAttribute('r', '13');
            targetRing.setAttribute('fill', 'none');
            targetRing.setAttribute('stroke', 'var(--accent-primary)');
            targetRing.setAttribute('stroke-width', '0.75');
            targetRing.setAttribute('stroke-dasharray', '5 3');
            
            const animateRot = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
            animateRot.setAttribute('attributeName', 'transform');
            animateRot.setAttribute('type', 'rotate');
            animateRot.setAttribute('from', `0 ${pos.x} ${pos.y}`);
            animateRot.setAttribute('to', `360 ${pos.x} ${pos.y}`);
            animateRot.setAttribute('dur', '10s');
            animateRot.setAttribute('repeatCount', 'indefinite');
            targetRing.appendChild(animateRot);
            
            group.appendChild(targetRing);
        }

        // Reachable room glow halo — solid pulsing ring
        if (isReachable && !isCurrent) {
            const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            halo.setAttribute('cx', pos.x);
            halo.setAttribute('cy', pos.y);
            halo.setAttribute('r', '13');
            halo.setAttribute('fill', 'rgba(234, 179, 8, 0.05)');
            halo.setAttribute('stroke', 'var(--accent-primary)');
            halo.setAttribute('stroke-width', '1.5');
            halo.setAttribute('class', 'map-node-reachable-halo');

            // SVG animate for radius pulse
            const animR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animR.setAttribute('attributeName', 'r');
            animR.setAttribute('values', '11;14;11');
            animR.setAttribute('dur', '2s');
            animR.setAttribute('repeatCount', 'indefinite');
            halo.appendChild(animR);

            // SVG animate for opacity pulse
            const animO = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animO.setAttribute('attributeName', 'opacity');
            animO.setAttribute('values', '0.4;1;0.4');
            animO.setAttribute('dur', '2s');
            animO.setAttribute('repeatCount', 'indefinite');
            halo.appendChild(animO);

            group.appendChild(halo);
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);

        if (isCurrent) {
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', 'var(--accent-primary)');
            circle.setAttribute('stroke', '#ffffff');
            circle.setAttribute('stroke-width', '2');
        } else if (isReachable && isVisited) {
            circle.setAttribute('r', '7');
            circle.setAttribute('fill', 'rgba(234, 179, 8, 0.15)');
            circle.setAttribute('stroke', 'var(--accent-primary)');
            circle.setAttribute('stroke-width', '2');
        } else if (isReachable) {
            circle.setAttribute('r', '5.5');
            circle.setAttribute('fill', 'rgba(234, 179, 8, 0.1)');
            circle.setAttribute('stroke', 'var(--accent-primary)');
            circle.setAttribute('stroke-width', '1.5');
        } else if (isVisited) {
            circle.setAttribute('r', '6');
            circle.setAttribute('fill', 'rgba(16, 185, 129, 0.15)');
            circle.setAttribute('stroke', 'var(--success)');
            circle.setAttribute('stroke-width', '2');
        } else {
            // Unknown room
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', 'rgba(5, 5, 5, 0.8)');
            circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
            circle.setAttribute('stroke-width', '1');
            circle.setAttribute('stroke-dasharray', '2 2');
        }
        group.appendChild(circle);

        // Label for visited / current / reachable nodes
        if (isVisited || isCurrent || isReachable) {
            const name = this.game.world.rooms[id]?.name || id;
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pos.x + 12);
            text.setAttribute('y', pos.y + 3.5);
            text.setAttribute('fill', isCurrent ? 'var(--accent-primary)' : 'var(--text-main)');
            text.setAttribute('font-size', isCurrent ? '9px' : '8.5px');
            text.setAttribute('font-family', 'var(--font-mono)');
            text.setAttribute('font-weight', isCurrent ? 'bold' : 'normal');
            text.setAttribute('letter-spacing', '0.05em');
            text.textContent = name.toUpperCase().substring(0, 16);
            group.appendChild(text);
        } else {
            // Question mark for undiscovered nodes
            const q = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            q.setAttribute('x', pos.x);
            q.setAttribute('y', pos.y + 2.5);
            q.setAttribute('fill', 'var(--text-muted)');
            q.setAttribute('font-size', '6px');
            q.setAttribute('font-family', 'var(--font-mono)');
            q.setAttribute('text-anchor', 'middle');
            q.textContent = '?';
            group.appendChild(q);
        }

        // Click-to-navigate label for reachable rooms
        if (isReachable && !isCurrent) {
            const hint = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            hint.setAttribute('x', pos.x);
            hint.setAttribute('y', pos.y + 22);
            hint.setAttribute('fill', 'var(--accent-primary)');
            hint.setAttribute('font-size', '6px');
            hint.setAttribute('font-family', 'var(--font-mono)');
            hint.setAttribute('text-anchor', 'middle');
            hint.setAttribute('opacity', '0.7');
            hint.setAttribute('class', 'map-node-goto-hint');
            hint.textContent = '▸ GO';
            group.appendChild(hint);
        }

        parentContainer.appendChild(group);
    }

    /** Find the transition ID leading to targetRoomId from current room and trigger it */
    _navigateToRoom(targetRoomId) {
        const state = this.game.state;
        const currentRoom = state.isTransitioning
            ? state.transitionContext?.target
            : state.currentRoom;

        const transitions = state.roomTransitions[currentRoom] || [];
        const transition = transitions.find(t => t.target === targetRoomId);

        if (!transition) return;

        // Play UI feedback
        if (this.game.audio && typeof this.game.audio.playUiSound === 'function') {
            this.game.audio.playUiSound('click');
        }

        // Trigger the transition as if the player clicked the exit button
        this.game.handleAction('tra', transition.id, targetRoomId);
    }

    showNodeTelemetry(id, isCurrent, isVisited, isReachable) {
        const detailsContainer = document.getElementById('map-node-details');
        if (!detailsContainer) return;

        const roomData = this.game.world.rooms[id];
        const roomName = roomData ? roomData.name : id;
        
        let statusText = 'UNKNOWN';
        let statusClass = 'node-details-status--unknown';
        if (isCurrent) {
            statusText = 'YOU ARE HERE';
            statusClass = 'node-details-status--current';
        } else if (isVisited) {
            statusText = 'VISITED';
            statusClass = 'node-details-status--visited';
        }

        // Calculate deterministic coordinates based on room ID string
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
        const coordX = Math.abs((hash % 180) + 10);
        const coordY = Math.abs(((hash >> 4) % 180) + 10);

        // Find exits/connections from this room
        const exits = this.game.state.roomTransitions[id] || [];
        const exitNames = exits.map(e => {
            const targetRoom = this.game.world.rooms[e.target];
            const name = targetRoom ? targetRoom.name : e.target;
            const visited = this.game.state.visitedRooms.includes(e.target);
            return visited ? name.toUpperCase() : '???';
        });
        const exitsStr = exitNames.length > 0 ? exitNames.join(', ') : 'NONE';

        // Play feedback UI sound if possible
        if (this.game.audio && typeof this.game.audio.playUiSound === 'function') {
            this.game.audio.playUiSound('keypress');
        }

        const reachableHint = (isReachable && !isCurrent)
            ? `<div class="node-details-row node-details-row--reachable"><div class="node-details-key">ACTION:</div><div class="node-details-val node-details-val--reachable">▸ CLICK TO NAVIGATE</div></div>`
            : '';

        detailsContainer.classList.add('node-details-active');
        detailsContainer.innerHTML = `
            <div class="node-details-header">
                <div class="node-details-name">${roomName}</div>
                <div class="node-details-status ${statusClass}">${statusText}</div>
            </div>
            <div class="node-details-row">
                <div class="node-details-key">SECTOR:</div>
                <div class="node-details-val">SEC_${coordX}-${coordY}</div>
            </div>
            <div class="node-details-row">
                <div class="node-details-key">EXITS:</div>
                <div class="node-details-val">${exitsStr}</div>
            </div>
            ${reachableHint}
        `;
    }

    resetNodeTelemetry() {
        const detailsContainer = document.getElementById('map-node-details');
        if (!detailsContainer) return;
        detailsContainer.classList.remove('node-details-active');
        detailsContainer.innerHTML = `
            <div class="node-details-placeholder">// TELEMETRY SCANNER INITIALIZED</div>
            <div class="node-details-hint">Hover over node to tap visual feed</div>
        `;
    }

    _initInteraction() {
        if (!this.svg) return;

        // 1. Mouse Wheel Zoom
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
            const nextZoom = Math.max(0.3, Math.min(5.0, this.zoom * zoomFactor));

            // Pan to keep cursor focus point stable
            this.panX = mouseX - (mouseX - this.panX) * (nextZoom / this.zoom);
            this.panY = mouseY - (mouseY - this.panY) * (nextZoom / this.zoom);
            this.zoom = nextZoom;

            this._applyTransform();
        }, { passive: false });

        // 2. Mouse Drag (Pan)
        this.svg.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.hasDragged = false;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.initialPanX = this.panX;
            this.initialPanY = this.panY;
            this.svg.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;

            if (Math.sqrt(dx * dx + dy * dy) > 5) {
                this.hasDragged = true;
            }

            this.panX = this.initialPanX + dx;
            this.panY = this.initialPanY + dy;
            this._applyTransform();
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.svg.style.cursor = '';
            }
        });

        // 3. Touch Drag & Pinch-to-Zoom
        let touchStartDist = 0;
        let touchStartZoom = 1;
        let touchStartCenter = { x: 0, y: 0 };

        this.svg.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.hasDragged = false;
                this.startX = e.touches[0].clientX;
                this.startY = e.touches[0].clientY;
                this.initialPanX = this.panX;
                this.initialPanY = this.panY;
            } else if (e.touches.length === 2) {
                this.isDragging = false; // Disable single finger drag
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                touchStartZoom = this.zoom;

                const rect = this.svg.getBoundingClientRect();
                touchStartCenter = {
                    x: ((t1.clientX + t2.clientX) / 2) - rect.left,
                    y: ((t1.clientY + t2.clientY) / 2) - rect.top
                };
            }
        }, { passive: true });

        this.svg.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                const dx = e.touches[0].clientX - this.startX;
                const dy = e.touches[0].clientY - this.startY;
                if (Math.hypot(dx, dy) > 5) {
                    this.hasDragged = true;
                }
                this.panX = this.initialPanX + dx;
                this.panY = this.initialPanY + dy;
                this._applyTransform();
            } else if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const factor = dist / (touchStartDist || 1);
                const nextZoom = Math.max(0.3, Math.min(5.0, touchStartZoom * factor));

                // Adjust pan to zoom centered on touch midpoint
                this.panX = touchStartCenter.x - (touchStartCenter.x - this.panX) * (nextZoom / this.zoom);
                this.panY = touchStartCenter.y - (touchStartCenter.y - this.panY) * (nextZoom / this.zoom);
                this.zoom = nextZoom;

                this._applyTransform();
            }
        }, { passive: true });

        this.svg.addEventListener('touchend', () => {
            this.isDragging = false;
        });

        // 4. Zoom Buttons binding
        const zoomInBtn = document.getElementById('map-zoom-in');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._zoomByFactor(1.3);
            });
        }
        const zoomOutBtn = document.getElementById('map-zoom-out');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._zoomByFactor(1 / 1.3);
            });
        }
        const zoomResetBtn = document.getElementById('map-zoom-reset');
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetZoomView();
            });
        }

        // 5. Sidebar Resize Grabber drag logic
        const resizer = document.getElementById('map-resizer');
        const mapPanel = document.getElementById('map-panel');
        if (resizer && mapPanel) {
            let startWidth = 0;
            let startMouseX = 0;
            let isResizing = false;

            const onResizeMouseDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                startWidth = parseFloat(getComputedStyle(mapPanel).width) || 330;
                startMouseX = e.clientX || e.touches?.[0]?.clientX;
                document.body.classList.add('is-resizing');
                window.addEventListener('mousemove', onResizeMouseMove);
                window.addEventListener('mouseup', onResizeMouseUp);
                window.addEventListener('touchmove', onResizeMouseMove, { passive: false });
                window.addEventListener('touchend', onResizeMouseUp);
            };

            const onResizeMouseMove = (e) => {
                if (!isResizing) return;
                const clientX = e.clientX !== undefined ? e.clientX : e.touches?.[0]?.clientX;
                if (clientX === undefined) return;
                const dx = startMouseX - clientX;
                const newWidth = Math.max(250, Math.min(window.innerWidth - 60, startWidth + dx));
                document.documentElement.style.setProperty('--map-panel-width', `${newWidth}px`);
                this.update();
            };

            const onResizeMouseUp = () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.classList.remove('is-resizing');
                    window.removeEventListener('mousemove', onResizeMouseMove);
                    window.removeEventListener('mouseup', onResizeMouseUp);
                    window.removeEventListener('touchmove', onResizeMouseMove);
                    window.removeEventListener('touchend', onResizeMouseUp);
                }
            };

            resizer.addEventListener('mousedown', onResizeMouseDown);
            resizer.addEventListener('touchstart', onResizeMouseDown, { passive: false });
        }
    }

    _zoomByFactor(factor) {
        const nextZoom = Math.max(0.3, Math.min(5.0, this.zoom * factor));
        const cx = this.width / 2;
        const cy = this.height / 2;
        // Center zoom on viewport midpoint
        this.panX = cx - (cx - this.panX) * (nextZoom / this.zoom);
        this.panY = cy - (cy - this.panY) * (nextZoom / this.zoom);
        this.zoom = nextZoom;
        this._applyTransform();
    }

    resetZoomView() {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this._applyTransform();
    }

    _applyTransform() {
        const stage = this.svg.querySelector('#map-stage');
        if (stage) {
            stage.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
        }
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
