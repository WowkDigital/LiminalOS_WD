/**
 * LIMINAL OS – Map Generation Module
 *
 * MapGenerator  – builds the global room connection graph at session start.
 *                 Guarantees full reachability via a spanning tree, then adds
 *                 optional shortcut edges for variety.
 */

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
