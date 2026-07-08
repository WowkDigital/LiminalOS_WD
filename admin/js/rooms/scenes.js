// Room scenes and hotspots management logic
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { openMediaModal } from '../media.js';
import { getTerminalDialogueTree } from '../terminal.js';
import { updateRoomExportArea, refreshCategorySelectors } from './editor.js';
import { renderInteractablesCheckboxes } from './interactables.js';
import { TextConfigRow } from '../components/TextConfigRow.js';

let isDrawing = false;
let startX = 0;
let startY = 0;
let currentRect = { x: 0, y: 0, w: 0, h: 0 };
let drawingListenersBound = false;

function setupClickAreaDrawing() {
    if (drawingListenersBound) return;
    
    const overlay = document.getElementById('click-area-drawing-overlay');
    const selectionBox = document.getElementById('click-area-selection-box');
    const coordDisplay = document.getElementById('click-area-box-coords');
    
    if (!overlay || !selectionBox || !coordDisplay) return;
    
    const inputLeft = document.getElementById('click-area-left');
    const inputTop = document.getElementById('click-area-top');
    const inputWidth = document.getElementById('click-area-width');
    const inputHeight = document.getElementById('click-area-height');
    
    function getMousePos(e) {
        const rect = overlay.getBoundingClientRect();
        const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
        const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
        return {
            x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
            y: Math.max(0, Math.min(rect.height, clientY - rect.top))
        };
    }
    
    function updateSelectionBoxDOM() {
        selectionBox.style.left = currentRect.x + 'px';
        selectionBox.style.top = currentRect.y + 'px';
        selectionBox.style.width = currentRect.w + 'px';
        selectionBox.style.height = currentRect.h + 'px';
        selectionBox.style.display = 'block';
        
        const overlayWidth = overlay.offsetWidth || 1;
        const overlayHeight = overlay.offsetHeight || 1;
        const leftPct = ((currentRect.x / overlayWidth) * 100).toFixed(0);
        const topPct = ((currentRect.y / overlayHeight) * 100).toFixed(0);
        const widthPct = ((currentRect.w / overlayWidth) * 100).toFixed(0);
        const heightPct = ((currentRect.h / overlayHeight) * 100).toFixed(0);
        coordDisplay.textContent = `${leftPct}%,${topPct}% (${widthPct}%x${heightPct}%)`;
    }
    
    function startDrawing(e) {
        if (e.target !== overlay && e.target !== selectionBox) return;
        
        isDrawing = true;
        const pos = getMousePos(e);
        startX = pos.x;
        startY = pos.y;
        
        currentRect = { x: startX, y: startY, w: 0, h: 0 };
        updateSelectionBoxDOM();
        
        document.addEventListener('mousemove', draw);
        document.addEventListener('mouseup', stopDrawing);
        document.addEventListener('touchmove', draw, { passive: false });
        document.addEventListener('touchend', stopDrawing);
    }
    
    function draw(e) {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();
        
        const pos = getMousePos(e);
        
        const x = Math.min(startX, pos.x);
        const y = Math.min(startY, pos.y);
        const w = Math.abs(startX - pos.x);
        const h = Math.abs(startY - pos.y);
        
        currentRect = { x, y, w, h };
        updateSelectionBoxDOM();
    }
    
    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        
        document.removeEventListener('mousemove', draw);
        document.removeEventListener('mouseup', stopDrawing);
        document.removeEventListener('touchmove', draw);
        document.removeEventListener('touchend', stopDrawing);
        
        const overlayWidth = overlay.offsetWidth;
        const overlayHeight = overlay.offsetHeight;
        if (overlayWidth > 0 && overlayHeight > 0) {
            inputLeft.value = ((currentRect.x / overlayWidth) * 100).toFixed(1);
            inputTop.value = ((currentRect.y / overlayHeight) * 100).toFixed(1);
            inputWidth.value = ((currentRect.w / overlayWidth) * 100).toFixed(1);
            inputHeight.value = ((currentRect.h / overlayHeight) * 100).toFixed(1);
            
            updateRoomExportArea();
        }
    }
    
    overlay.addEventListener('mousedown', startDrawing);
    overlay.addEventListener('touchstart', startDrawing, { passive: true });
    
    [inputLeft, inputTop, inputWidth, inputHeight].forEach(input => {
        input.addEventListener('input', () => {
            const overlayWidth = overlay.offsetWidth;
            const overlayHeight = overlay.offsetHeight;
            if (overlayWidth > 0 && overlayHeight > 0) {
                const x = (parseFloat(inputLeft.value) || 0) / 100 * overlayWidth;
                const y = (parseFloat(inputTop.value) || 0) / 100 * overlayHeight;
                const w = (parseFloat(inputWidth.value) || 0) / 100 * overlayWidth;
                const h = (parseFloat(inputHeight.value) || 0) / 100 * overlayHeight;
                currentRect = { x, y, w, h };
                updateSelectionBoxDOM();
                updateRoomExportArea();
            }
        });
    });
    
    document.getElementById('btn-close-click-area-modal').addEventListener('click', () => {
        document.getElementById('click-area-modal').classList.add('hidden');
    });
    
    document.getElementById('btn-clear-click-area').addEventListener('click', () => {
        if (window.onSaveSceneClickArea) {
            window.onSaveSceneClickArea(null);
            window.onSaveSceneClickArea = null;
            document.getElementById('click-area-modal').classList.add('hidden');
            showToast('Hotspot click area cleared.', 'info');
            return;
        }
        if (!state.currentClickAreaCategory) return;
        
        if (state.currentClickAreaType === 'interactable') {
            delete state.editorRequirements.interactableClickAreas[state.currentClickAreaCategory];
            showToast('Interactable click area cleared.', 'info');
            const currentSelected = Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => cb.value);
            renderInteractablesCheckboxes(currentSelected);
        } else {
            delete state.editorRequirements.clickAreas[state.currentClickAreaCategory];
            showToast('Click area cleared.', 'info');
            refreshCategorySelectors();
        }
        
        document.getElementById('click-area-modal').classList.add('hidden');
        updateRoomExportArea();
    });
    
    document.getElementById('btn-save-click-area').addEventListener('click', () => {
        const left = parseFloat(inputLeft.value);
        const top = parseFloat(inputTop.value);
        const width = parseFloat(inputWidth.value);
        const height = parseFloat(inputHeight.value);
        
        if (isNaN(left) || isNaN(top) || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
            showToast('Please draw a valid area or fill the dimensions.', 'warning');
            return;
        }
        
        const areaObj = {
            shapes: [
                {
                    type: 'rect',
                    coords: {
                        x: left,
                        y: top,
                        width: width,
                        height: height
                    }
                }
            ]
        };

        if (window.onSaveSceneClickArea) {
            window.onSaveSceneClickArea(areaObj);
            window.onSaveSceneClickArea = null;
            document.getElementById('click-area-modal').classList.add('hidden');
            showToast('Hotspot click area defined.', 'success');
            return;
        }
        
        if (!state.currentClickAreaCategory) return;
        
        if (state.currentClickAreaType === 'interactable') {
            state.editorRequirements.interactableClickAreas[state.currentClickAreaCategory] = areaObj;
            showToast('Interactable click area defined.', 'success');
            const currentSelected = Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => cb.value);
            renderInteractablesCheckboxes(currentSelected);
        } else {
            state.editorRequirements.clickAreas[state.currentClickAreaCategory] = areaObj;
            showToast('Click area defined.', 'success');
            refreshCategorySelectors();
            if (window.syncTransitionsFromEditorRequirements) {
                window.syncTransitionsFromEditorRequirements();
            }
        }
        
        document.getElementById('click-area-modal').classList.add('hidden');
        updateRoomExportArea();
    });
    
    drawingListenersBound = true;
}

window.openClickAreaModal = (category, type = 'transition') => {
    const roomId = state.currentEditId;
    if (!roomId) {
        showToast('Please save the room first.', 'error');
        return;
    }
    
    const roomMedia = state.mediaLibrary.filter(
        m => m.context_type === 'room' && m.context_id === roomId
    );
    
    if (roomMedia.length === 0) {
        showToast('Please assign an image to this room first in the Graphics tab.', 'warning');
        return;
    }
    
    const modal = document.getElementById('click-area-modal');
    const title = document.getElementById('click-area-modal-title');
    const img = document.getElementById('click-area-target-img');
    const overlay = document.getElementById('click-area-drawing-overlay');
    const selectionBox = document.getElementById('click-area-selection-box');
    
    state.currentClickAreaType = type;
    state.currentClickAreaCategory = category;
    
    if (type === 'interactable') {
        title.innerText = `Configure Click Area: ${category.toUpperCase()} (Interactable)`;
    } else {
        title.innerText = `Configure Click Area: ${category.toUpperCase()}`;
    }
    
    img.src = `../${roomMedia[0].filepath}`;
    
    selectionBox.style.display = 'none';
    document.getElementById('click-area-left').value = '';
    document.getElementById('click-area-top').value = '';
    document.getElementById('click-area-width').value = '';
    document.getElementById('click-area-height').value = '';
    
    modal.classList.remove('hidden');
    setupClickAreaDrawing();
    
    img.onload = () => {
        overlay.style.width = img.offsetWidth + 'px';
        overlay.style.height = img.offsetHeight + 'px';
        overlay.style.left = img.offsetLeft + 'px';
        overlay.style.top = img.offsetTop + 'px';
        
        const existingArea = type === 'interactable'
            ? state.editorRequirements.interactableClickAreas?.[category]
            : state.editorRequirements.clickAreas?.[category];
            
        if (existingArea) {
            let coords = null;
            if (existingArea.shapes && existingArea.shapes[0]) {
                coords = existingArea.shapes[0].coords;
            } else if (existingArea.coords) {
                coords = existingArea.coords;
            }
            
            if (coords) {
                const left = parseFloat(coords.x !== undefined ? coords.x : coords.left);
                const top = parseFloat(coords.y !== undefined ? coords.y : coords.top);
                const width = parseFloat(coords.width !== undefined ? coords.width : coords.w);
                const height = parseFloat(coords.height !== undefined ? coords.height : coords.h);
                
                document.getElementById('click-area-left').value = left;
                document.getElementById('click-area-top').value = top;
                document.getElementById('click-area-width').value = width;
                document.getElementById('click-area-height').value = height;
                
                const ow = overlay.offsetWidth;
                const oh = overlay.offsetHeight;
                
                selectionBox.style.left = ((left / 100) * ow) + 'px';
                selectionBox.style.top = ((top / 100) * oh) + 'px';
                selectionBox.style.width = ((width / 100) * ow) + 'px';
                selectionBox.style.height = ((height / 100) * oh) + 'px';
                selectionBox.style.display = 'block';
                
                document.getElementById('click-area-box-coords').textContent = `${left.toFixed(0)}%,${top.toFixed(0)}% (${width.toFixed(0)}%x${height.toFixed(0)}%)`;
            }
        }
    };
};

window.addEventListener('resize', () => {
    const modal = document.getElementById('click-area-modal');
    if (modal && !modal.classList.contains('hidden')) {
        const img = document.getElementById('click-area-target-img');
        const overlay = document.getElementById('click-area-drawing-overlay');
        const selectionBox = document.getElementById('click-area-selection-box');
        
        if (img && overlay && img.offsetWidth > 0) {
            overlay.style.width = img.offsetWidth + 'px';
            overlay.style.height = img.offsetHeight + 'px';
            overlay.style.left = img.offsetLeft + 'px';
            overlay.style.top = img.offsetTop + 'px';
            
            const leftVal = parseFloat(document.getElementById('click-area-left').value);
            const topVal = parseFloat(document.getElementById('click-area-top').value);
            const wVal = parseFloat(document.getElementById('click-area-width').value);
            const hVal = parseFloat(document.getElementById('click-area-height').value);
            
            if (!isNaN(leftVal) && !isNaN(topVal) && !isNaN(wVal) && !isNaN(hVal)) {
                selectionBox.style.left = ((leftVal / 100) * img.offsetWidth) + 'px';
                selectionBox.style.top = ((topVal / 100) * img.offsetHeight) + 'px';
                selectionBox.style.width = ((wVal / 100) * img.offsetWidth) + 'px';
                selectionBox.style.height = ((hVal / 100) * img.offsetHeight) + 'px';
            }
        }
    }
});

export function renderScenesSection() {
    const selector = document.getElementById('scene-selector-dropdown');
    if (!selector) return;
    selector.innerHTML = '';

    if (!state.editorScenes) {
        state.editorScenes = [];
    }

    state.editorScenes.forEach(scene => {
        const opt = document.createElement('option');
        opt.value = scene.id;
        
        const hCount = (scene.hotspots || []).length;
        const cCount = (scene.terminal_commands || []).length;
        const rCount = scene.requirements ? Object.keys(scene.requirements).length : 0;
        const defaultIndicator = scene.is_default ? ' [DEFAULT]' : '';
        
        opt.textContent = `${scene.id}${defaultIndicator} (${hCount} Hotspot${hCount === 1 ? '' : 's'} | ${cCount} Cmd${cCount === 1 ? '' : 's'} | ${rCount} Req)`;
        if (state.selectedSceneId === scene.id) {
            opt.selected = true;
        }
        selector.appendChild(opt);
    });

    selector.onchange = (e) => {
        state.selectedSceneId = e.target.value;
        renderActiveSceneEditor();
        if (window.syncEditorRequirementsFromActiveScene) {
            window.syncEditorRequirementsFromActiveScene();
        }
    };
}

window.toggleCollapsibleSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle('collapsed');
    }
};

export function renderActiveSceneEditor() {
    const editorPanel = document.getElementById('active-scene-editor');
    if (!editorPanel) return;

    const scene = state.editorScenes.find(s => s.id === state.selectedSceneId);
    if (!scene) {
        editorPanel.innerHTML = `
            <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #888;">
                <i data-lucide="image" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
                <span>Select a scene from the left sidebar or create a new one to edit its sub-scene states.</span>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // Calculate metadata counts
    const hotspotCount = (scene.hotspots || []).length;
    const commandCount = (scene.terminal_commands || []).length;
    const textsCount = (scene.texts || []).length;
    const reqs = scene.requirements || {};
    const hasReqs = (reqs.sanity_min !== undefined && reqs.sanity_min !== 0) || 
                    (reqs.sanity_max !== undefined && reqs.sanity_max !== 100) || 
                    (reqs.items && reqs.items.length > 0) || 
                    (reqs.interactables && Object.keys(reqs.interactables).length > 0);

    editorPanel.innerHTML = `
        <div class="scene-editor-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--glass-border); padding-bottom: 8px; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 1.2rem; color: #fff;">Edit Scene: <span style="color: var(--color-primary);">${scene.id}</span></h3>
                <button type="button" id="btn-delete-scene" class="btn-small danger" style="padding: 4px 10px; border-radius: var(--radius-sm);">Delete Scene</button>
            </div>

            <!-- 1. General Config & Graphics (Expanded by default) -->
            <div class="collapsible-section" id="sec-scene-general">
                <div class="collapsible-header" onclick="toggleCollapsibleSection('sec-scene-general')">
                    <h4><i data-lucide="settings" style="width: 16px; height: 16px;"></i> General Settings & Visuals</h4>
                    <div class="collapsible-header-actions">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${scene.bg_image ? 'Background Set' : 'No Image'}</span>
                        <i data-lucide="chevron-down" class="collapsible-icon" style="width: 16px; height: 16px;"></i>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div class="form-row-stacked" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; margin-bottom: 6px; display: block;">Scene ID</label>
                            <input type="text" id="edit-scene-id" value="${scene.id}" placeholder="e.g. lobby_dark" required style="width: 100%;">
                            <small style="color: #888;">Must be unique within this room.</small>
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 0.5rem; margin-bottom: 0;">
                            <label class="checkbox-container" style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="edit-scene-default" ${scene.is_default ? 'checked' : ''}>
                                <span class="checkbox-label" style="font-weight: 600;">Default Scene</span>
                            </label>
                        </div>
                    </div>

                    <div style="margin-top: 1.25rem; border: 1px solid var(--glass-border); padding: 1rem; border-radius: var(--radius-sm); background: rgba(0,0,0,0.15);">
                        <label style="font-weight: 600; margin-bottom: 8px; display: block;">Scene Background Image</label>
                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                            <div id="scene-bg-preview-container" style="width: 120px; height: 80px; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; flex-shrink: 0;">
                                ${scene.bg_image 
                                    ? `<img src="../${scene.bg_image}" style="width: 100%; height: 100%; object-fit: cover;" />` 
                                    : `<i data-lucide="image" style="width: 24px; height: 24px; opacity: 0.3;"></i>`}
                            </div>
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 200px;">
                                <span id="scene-bg-path-label" style="font-size: 0.8rem; color: #aaa; word-break: break-all; font-family: var(--font-mono);">${scene.bg_image || 'No image selected'}</span>
                                <div style="display: flex; gap: 8px;">
                                    <button type="button" id="btn-select-scene-bg" class="btn-secondary btn-small">Choose Image</button>
                                    <button type="button" id="btn-clear-scene-bg" class="btn-small danger">Remove</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-row-stacked" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.25rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; margin-bottom: 6px; display: block;">Dialogue Node ID</label>
                            <select id="edit-scene-dialogue-id" style="width: 100%;">
                                <!-- Will be populated dynamically -->
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; margin-bottom: 6px; display: block;">Scene Description</label>
                            <textarea id="edit-scene-desc" rows="2" placeholder="Main description displayed when entering this scene state..." style="width: 100%;">${scene.desc || ''}</textarea>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; margin-bottom: 6px; display: block;">Interactable Description</label>
                            <textarea id="edit-scene-interactable-desc" rows="2" placeholder="CRT description for this specific scene state..." style="width: 100%;">${scene.interactable_desc || ''}</textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. Scene Entry Requirements (Collapsed by default) -->
            <div class="collapsible-section collapsed" id="sec-scene-reqs">
                <div class="collapsible-header" onclick="toggleCollapsibleSection('sec-scene-reqs')">
                    <h4><i data-lucide="shield-alert" style="width: 16px; height: 16px;"></i> Scene Entry Requirements</h4>
                    <div class="collapsible-header-actions">
                        <span style="font-size: 0.8rem; font-weight: 600; color: ${hasReqs ? 'var(--accent-primary)' : 'var(--text-muted)'};">${hasReqs ? 'Active Conditions' : 'No requirements'}</span>
                        <i data-lucide="chevron-down" class="collapsible-icon" style="width: 16px; height: 16px;"></i>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div id="scene-requirements-container" style="display: flex; flex-direction: column; gap: 8px;">
                        <!-- Requirements config -->
                    </div>
                </div>
            </div>

            <!-- 3. Atmospheric Texts (Collapsed by default) -->
            <div class="collapsible-section collapsed" id="sec-scene-texts">
                <div class="collapsible-header" onclick="toggleCollapsibleSection('sec-scene-texts')">
                    <h4><i data-lucide="align-left" style="width: 16px; height: 16px;"></i> Atmospheric Texts</h4>
                    <div class="collapsible-header-actions">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${textsCount} lines</span>
                        <i data-lucide="chevron-down" class="collapsible-icon" style="width: 16px; height: 16px;"></i>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div id="scene-texts-list" class="texts-list" style="display: flex; flex-direction: column; gap: 8px;">
                        <!-- Rendered list of TextConfigRows -->
                    </div>
                    <button type="button" id="btn-add-scene-text" class="btn-secondary btn-small" style="margin-top: 10px;">+ Add Text Line</button>
                </div>
            </div>

            <!-- 4. Room Objects / Interactables (Collapsed by default) -->
            <div class="collapsible-section collapsed" id="sec-scene-interactables">
                <div class="collapsible-header" onclick="toggleCollapsibleSection('sec-scene-interactables')">
                    <h4><i data-lucide="package" style="width: 16px; height: 16px;"></i> Room Objects (Interactables)</h4>
                    <div class="collapsible-header-actions">
                        <i data-lucide="chevron-down" class="collapsible-icon" style="width: 16px; height: 16px;"></i>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div id="interactables-checkbox-group" style="display: flex; flex-direction: column; gap: 8px;">
                        <!-- Injected by renderInteractablesCheckboxes -->
                    </div>
                    <small style="display: block; margin-top: 8px; color: var(--text-muted);">Manage objects defined in this room.</small>
                </div>
            </div>

            <!-- 5. Hotspots & Click Areas (Expanded by default) -->
            <div class="collapsible-section" id="sec-scene-hotspots">
                <div class="collapsible-header" onclick="toggleCollapsibleSection('sec-scene-hotspots')">
                    <h4><i data-lucide="maximize" style="width: 16px; height: 16px;"></i> Hotspots & Click Areas</h4>
                    <div class="collapsible-header-actions">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${hotspotCount} defined</span>
                        <i data-lucide="chevron-down" class="collapsible-icon" style="width: 16px; height: 16px;"></i>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div id="scene-hotspots-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1rem;">
                        <!-- list of hotspots -->
                    </div>
                    <button type="button" id="btn-add-scene-hotspot" class="btn-secondary btn-small">+ Add Hotspot</button>
                </div>
            </div>

            <!-- 6. Custom Terminal Commands (Collapsed by default) -->
            <div class="collapsible-section collapsed" id="sec-scene-commands">
                <div class="collapsible-header" onclick="toggleCollapsibleSection('sec-scene-commands')">
                    <h4><i data-lucide="terminal" style="width: 16px; height: 16px;"></i> Custom Terminal Commands</h4>
                    <div class="collapsible-header-actions">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${commandCount} defined</span>
                        <i data-lucide="chevron-down" class="collapsible-icon" style="width: 16px; height: 16px;"></i>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div id="scene-commands-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1rem;">
                        <!-- list of custom commands -->
                    </div>
                    <button type="button" id="btn-add-scene-command" class="btn-secondary btn-small">+ Add Custom Command</button>
                </div>
            </div>

        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Bind event handlers
    const idInput = document.getElementById('edit-scene-id');
    const defaultCheck = document.getElementById('edit-scene-default');
    const sceneDescInput = document.getElementById('edit-scene-desc');
    const descTextarea = document.getElementById('edit-scene-interactable-desc');
    const dialogueSelect = document.getElementById('edit-scene-dialogue-id');
    
    // Populate Dialogue dropdown
    const dialogueTree = getTerminalDialogueTree() || {};
    dialogueSelect.innerHTML = '<option value="">-- None / Default --</option>';
    Object.keys(dialogueTree).sort().forEach(nodeId => {
        const opt = document.createElement('option');
        opt.value = nodeId;
        opt.textContent = nodeId;
        if (nodeId === scene.dialogue_id) {
            opt.selected = true;
        }
        dialogueSelect.appendChild(opt);
    });

    // Handle updates
    idInput.addEventListener('input', () => {
        const val = idInput.value.trim();
        if (val && val !== scene.id) {
            // Check uniqueness
            const exists = state.editorScenes.some(s => s.id === val);
            if (!exists) {
                scene.id = val;
                state.selectedSceneId = val;
                renderScenesSection();
                updateRoomExportArea();
            }
        }
    });

    defaultCheck.addEventListener('change', () => {
        if (defaultCheck.checked) {
            state.editorScenes.forEach(s => s.is_default = false);
            scene.is_default = true;
        } else {
            scene.is_default = false;
        }
        renderScenesSection();
        renderActiveSceneEditor();
        updateRoomExportArea();
    });

    if (sceneDescInput) {
        sceneDescInput.addEventListener('input', () => {
            scene.desc = sceneDescInput.value.trim() || null;
            updateRoomExportArea();
        });
    }

    descTextarea.addEventListener('input', () => {
        scene.interactable_desc = descTextarea.value.trim() || null;
        updateRoomExportArea();
    });

    dialogueSelect.addEventListener('change', () => {
        scene.dialogue_id = dialogueSelect.value || null;
        updateRoomExportArea();
    });

    // Delete scene
    document.getElementById('btn-delete-scene').onclick = () => {
        if (confirm(`Are you sure you want to delete scene "${scene.id}"?`)) {
            state.editorScenes = state.editorScenes.filter(s => s.id !== scene.id);
            state.selectedSceneId = state.editorScenes[0]?.id || null;
            renderScenesSection();
            renderActiveSceneEditor();
            updateRoomExportArea();
        }
    };

    // Choose Background Image
    document.getElementById('btn-select-scene-bg').onclick = () => {
        state.currentContext = 'room'; // Keep context room so we see room media
        state.mediaPickerCallback = (selectedMedia) => {
            scene.bg_image = selectedMedia.filepath;
            renderActiveSceneEditor();
            updateRoomExportArea();
        };
        openMediaModal();
    };

    // Clear Background Image
    document.getElementById('btn-clear-scene-bg').onclick = () => {
        scene.bg_image = null;
        renderActiveSceneEditor();
        updateRoomExportArea();
    };

    // Render Sub-components
    renderSceneRequirements(scene);
    renderSceneTexts(scene);
    renderInteractablesCheckboxes();
    renderSceneHotspots(scene);
    renderSceneCommands(scene);
    if (window.syncEditorRequirementsFromActiveScene) {
        window.syncEditorRequirementsFromActiveScene();
    }
}

export function renderSceneTexts(scene) {
    const container = document.getElementById('scene-texts-list');
    if (!container) return;
    container.innerHTML = '';

    scene.texts = scene.texts || [];

    const textsBadge = document.querySelector('#sec-scene-texts .collapsible-header-actions span');
    if (textsBadge) {
        textsBadge.textContent = `${scene.texts.length} lines`;
    }

    if (scene.texts.length === 0) {
        container.innerHTML = '<span style="font-size: 0.85rem; color: #666; font-style: italic;">No atmospheric texts defined.</span>';
    } else {
        scene.texts.forEach((textObj, index) => {
            const onRemove = () => {
                scene.texts.splice(index, 1);
                renderSceneTexts(scene);
                updateRoomExportArea();
            };
            const rowComponent = new TextConfigRow(textObj, onRemove);
            const rendered = rowComponent.render();

            rendered.addEventListener('input', () => {
                scene.texts[index] = {
                    text: rendered.querySelector('.text-content').value.trim(),
                    sanity_min: parseInt(rendered.querySelector('.text-smin').value) || 0,
                    sanity_max: parseInt(rendered.querySelector('.text-smax').value) || 100,
                    dialogue_id: rendered.querySelector('.text-did').value.trim() || null
                };
                updateRoomExportArea();
            });

            container.appendChild(rendered);
        });
    }

    const addSceneTextBtn = document.getElementById('btn-add-scene-text');
    if (addSceneTextBtn) {
        addSceneTextBtn.onclick = () => {
            scene.texts.push({ text: '', sanity_min: 0, sanity_max: 100, dialogue_id: null });
            renderSceneTexts(scene);
            updateRoomExportArea();
        };
    }
}

export function renderSceneRequirements(scene) {
    const container = document.getElementById('scene-requirements-container');
    if (!container) return;
    container.innerHTML = '';

    scene.requirements = scene.requirements || {};

    // Update collapsible header status
    const reqs = scene.requirements;
    const hasReqs = (reqs.sanity_min !== undefined && reqs.sanity_min !== 0) || 
                    (reqs.sanity_max !== undefined && reqs.sanity_max !== 100) || 
                    (reqs.items && reqs.items.length > 0) || 
                    (reqs.interactables && Object.keys(reqs.interactables).length > 0);
    const reqBadge = document.querySelector('#sec-scene-reqs .collapsible-header-actions span');
    if (reqBadge) {
        reqBadge.textContent = hasReqs ? 'Active Conditions' : 'No requirements';
        reqBadge.style.color = hasReqs ? 'var(--accent-primary)' : 'var(--text-muted)';
    }

    // Sanity requirement
    const sanityRow = document.createElement('div');
    sanityRow.style.cssText = 'display: flex; gap: 1rem; align-items: center;';
    
    const sMin = scene.requirements.sanity_min !== undefined ? scene.requirements.sanity_min : 0;
    const sMax = scene.requirements.sanity_max !== undefined ? scene.requirements.sanity_max : 100;

    sanityRow.innerHTML = `
        <span style="font-size: 0.85rem; min-width: 100px;">Sanity Range:</span>
        <input type="number" class="scene-sanity-min" value="${sMin}" min="0" max="100" style="width: 70px;" placeholder="Min" />
        <span>to</span>
        <input type="number" class="scene-sanity-max" value="${sMax}" min="0" max="100" style="width: 70px;" placeholder="Max" />
    `;

    const minInput = sanityRow.querySelector('.scene-sanity-min');
    const maxInput = sanityRow.querySelector('.scene-sanity-max');
    
    const updateSanity = () => {
        const minVal = parseInt(minInput.value);
        const maxVal = parseInt(maxInput.value);
        if (minVal === 0 && maxVal === 100) {
            delete scene.requirements.sanity_min;
            delete scene.requirements.sanity_max;
        } else {
            scene.requirements.sanity_min = minVal;
            scene.requirements.sanity_max = maxVal;
        }
        updateRoomExportArea();
        renderScenesSection();
    };

    minInput.addEventListener('input', updateSanity);
    maxInput.addEventListener('input', updateSanity);

    container.appendChild(sanityRow);

    // Items requirement
    const itemsRow = document.createElement('div');
    itemsRow.style.cssText = 'display: flex; gap: 1rem; align-items: center; margin-top: 8px;';
    const currentItems = (scene.requirements.items || []).join(', ');
    itemsRow.innerHTML = `
        <span style="font-size: 0.85rem; min-width: 100px;">Required Items:</span>
        <input type="text" class="scene-items-input" value="${currentItems}" placeholder="key_card, screwdriver (comma separated)" style="flex: 1;" />
    `;
    const itemsInput = itemsRow.querySelector('.scene-items-input');
    itemsInput.addEventListener('input', () => {
        const val = itemsInput.value.trim();
        if (val) {
            scene.requirements.items = val.split(',').map(s => s.trim()).filter(s => s);
        } else {
            delete scene.requirements.items;
        }
        updateRoomExportArea();
        renderScenesSection();
    });
    container.appendChild(itemsRow);

    // World States requirement
    const statesRow = document.createElement('div');
    statesRow.style.cssText = 'display: flex; gap: 1rem; align-items: center; margin-top: 8px;';
    
    const currentStates = [];
    if (scene.requirements.worldStates) {
        for (const k in scene.requirements.worldStates) {
            currentStates.push(`${k}:${scene.requirements.worldStates[k]}`);
        }
    }

    statesRow.innerHTML = `
        <span style="font-size: 0.85rem; min-width: 100px;">World States:</span>
        <input type="text" class="scene-states-input" value="${currentStates.join(', ')}" placeholder="generator_active:1, console_power:0" style="flex: 1;" />
    `;
    const statesInput = statesRow.querySelector('.scene-states-input');
    statesInput.addEventListener('input', () => {
        const val = statesInput.value.trim();
        if (val) {
            const states = {};
            val.split(',').forEach(pair => {
                const parts = pair.split(':');
                if (parts[0]) {
                    const k = parts[0].trim();
                    const v = parseInt(parts[1] !== undefined ? parts[1].trim() : '1');
                    states[k] = isNaN(v) ? 1 : v;
                }
            });
            scene.requirements.worldStates = states;
        } else {
            delete scene.requirements.worldStates;
        }
        updateRoomExportArea();
        renderScenesSection();
    });
    container.appendChild(statesRow);
}

export function renderSceneHotspots(scene) {
    const list = document.getElementById('scene-hotspots-list');
    if (!list) return;
    list.innerHTML = '';

    scene.hotspots = scene.hotspots || [];

    // Update collapsible header count
    const hotspotBadge = document.querySelector('#sec-scene-hotspots .collapsible-header-actions span');
    if (hotspotBadge) {
        hotspotBadge.textContent = `${scene.hotspots.length} defined`;
    }

    if (scene.hotspots.length === 0) {
        list.innerHTML = '<span style="font-size: 0.85rem; color: #666; font-style: italic;">No hotspots defined.</span>';
    } else {
        scene.hotspots.forEach((h, idx) => {
            const card = document.createElement('div');
            card.className = 'hotspot-config-card';

            // Card Header
            const header = document.createElement('div');
            header.className = 'hotspot-card-header';
            
            const titleSpan = document.createElement('span');
            titleSpan.style.cssText = 'font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-primary);';
            titleSpan.textContent = `Hotspot #${idx + 1} (${h.type === 'tra' ? 'Transition' : 'Interactable'})`;
            
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-remove btn-remove-compact';
            delBtn.style.cssText = 'padding: 4px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); width: 28px; height: 28px;';
            delBtn.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--error);"></i>';
            delBtn.onclick = () => {
                scene.hotspots = scene.hotspots.filter((_, i) => i !== idx);
                renderSceneHotspots(scene);
                updateRoomExportArea();
                if (window.syncEditorRequirementsFromActiveScene) {
                    window.syncEditorRequirementsFromActiveScene();
                }
            };

            header.appendChild(titleSpan);
            header.appendChild(delBtn);
            card.appendChild(header);

            // Card Body
            const cardBody = document.createElement('div');
            cardBody.className = 'hotspot-card-body';

            const controlsCol = document.createElement('div');
            controlsCol.className = 'hotspot-card-controls';

            // 1. Trigger Type
            const typeGroup = document.createElement('div');
            typeGroup.className = 'form-group compact';
            typeGroup.style.margin = '0';
            const typeLabel = document.createElement('label');
            typeLabel.textContent = 'Trigger Action Type';
            typeLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const typeSel = document.createElement('select');
            typeSel.style.width = '100%';
            typeSel.innerHTML = `
                <option value="tra" ${h.type === 'tra' ? 'selected' : ''}>Transition</option>
                <option value="act" ${h.type === 'act' ? 'selected' : ''}>Interactable</option>
            `;
            typeGroup.appendChild(typeLabel);
            typeGroup.appendChild(typeSel);
            controlsCol.appendChild(typeGroup);

            // 2. Destination/Target ID
            const targetGroup = document.createElement('div');
            targetGroup.className = 'form-group compact';
            targetGroup.style.margin = '0';
            const targetLabel = document.createElement('label');
            targetLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const targetEl = document.createElement('select');
            targetEl.style.width = '100%';
            
            const updateTargetOptions = () => {
                targetEl.innerHTML = '';
                if (typeSel.value === 'tra') {
                    targetLabel.textContent = 'Transition Destination Category';
                    const transitionsList = state.transitionTypes || {};
                    Object.keys(transitionsList).forEach(cat => {
                        const opt = document.createElement('option');
                        opt.value = cat;
                        opt.textContent = cat.toUpperCase();
                        if (cat === h.target_id) opt.selected = true;
                        targetEl.appendChild(opt);
                    });
                    if (targetEl.options.length === 0) {
                        const opt = document.createElement('option');
                        opt.value = h.target_id || 'universal';
                        opt.textContent = (h.target_id || 'universal').toUpperCase();
                        opt.selected = true;
                        targetEl.appendChild(opt);
                    }
                } else {
                    targetLabel.textContent = 'Interactable Object';
                    const roomId = state.currentEditId;
                    const interactablesList = state.allInteractables || {};
                    Object.keys(interactablesList).forEach(iid => {
                        if (interactablesList[iid].room_id !== roomId && iid !== h.target_id) return;
                        const opt = document.createElement('option');
                        opt.value = iid;
                        opt.textContent = (interactablesList[iid].label || iid).toUpperCase();
                        if (iid === h.target_id) opt.selected = true;
                        targetEl.appendChild(opt);
                    });
                }
            };
            
            updateTargetOptions();
            targetGroup.appendChild(targetLabel);
            targetGroup.appendChild(targetEl);
            controlsCol.appendChild(targetGroup);

            typeSel.addEventListener('change', () => {
                h.type = typeSel.value;
                updateTargetOptions();
                h.target_id = targetEl.value;
                titleSpan.textContent = `Hotspot #${idx + 1} (${h.type === 'tra' ? 'Transition' : 'Interactable'})`;
                updateRoomExportArea();
                if (window.syncEditorRequirementsFromActiveScene) {
                    window.syncEditorRequirementsFromActiveScene();
                }
            });

            targetEl.addEventListener('change', () => {
                h.target_id = targetEl.value;
                updateRoomExportArea();
                if (window.syncEditorRequirementsFromActiveScene) {
                    window.syncEditorRequirementsFromActiveScene();
                }
            });

            // 3. Hover Label
            const labelGroup = document.createElement('div');
            labelGroup.className = 'form-group compact';
            labelGroup.style.margin = '0';
            const labelLabel = document.createElement('label');
            labelLabel.textContent = 'Active Hotspot Hover Label';
            labelLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.placeholder = 'Label (e.g. Open Box)';
            labelInput.value = h.label || '';
            labelInput.addEventListener('input', () => {
                h.label = labelInput.value.trim() || null;
                updateRoomExportArea();
            });
            labelGroup.appendChild(labelLabel);
            labelGroup.appendChild(labelInput);
            controlsCol.appendChild(labelGroup);

            // 4. Coordinates button
            const coordGroup = document.createElement('div');
            coordGroup.className = 'form-group compact';
            coordGroup.style.margin = '0';
            const coordLabel = document.createElement('label');
            coordLabel.textContent = 'Hotspot Click Boundary';
            coordLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const coordBtn = document.createElement('button');
            coordBtn.type = 'button';
            coordBtn.className = 'btn-small btn-secondary';
            coordBtn.style.width = '100%';
            coordBtn.style.height = '42px';
            
            const updateCoordBtnLabel = () => {
                if (h.area) {
                    coordBtn.textContent = 'Edit Boundary Coordinates';
                    coordBtn.classList.remove('btn-secondary');
                    coordBtn.style.borderColor = '#22c55e';
                    coordBtn.style.color = '#22c55e';
                    coordBtn.style.background = 'rgba(34, 197, 94, 0.1)';
                } else {
                    coordBtn.textContent = 'Draw Bounding Box';
                    coordBtn.classList.add('btn-secondary');
                    coordBtn.style.borderColor = '';
                    coordBtn.style.color = '';
                    coordBtn.style.background = '';
                }
            };
            
            updateCoordBtnLabel();

            coordBtn.onclick = () => {
                window.onSaveSceneClickArea = (areaObj) => {
                    h.area = areaObj;
                    updateCoordBtnLabel();
                    updateRoomExportArea();
                    renderSceneHotspots(scene);
                };
                let bgUrl = null;
                if (scene.bg_image) {
                    bgUrl = `../${scene.bg_image}`;
                } else {
                    const roomMedia = state.mediaLibrary.filter(
                        m => m.context_type === 'room' && m.context_id === state.currentEditId
                    );
                    if (roomMedia.length > 0) {
                        bgUrl = `../${roomMedia[0].filepath}`;
                    }
                }
                state.editorRequirements.interactableClickAreas = state.editorRequirements.interactableClickAreas || {};
                state.editorRequirements.interactableClickAreas[h.target_id] = h.area || null;
                window.openClickAreaModal(h.target_id, 'interactable', bgUrl);
            };

            coordGroup.appendChild(coordLabel);
            coordGroup.appendChild(coordBtn);
            controlsCol.appendChild(coordGroup);

            // 5. Requirements input
            const reqGroup = document.createElement('div');
            reqGroup.className = 'form-group compact';
            reqGroup.style.margin = '0';
            const reqLabel = document.createElement('label');
            reqLabel.textContent = 'Active Conditions / Requirements';
            reqLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const reqInput = document.createElement('input');
            reqInput.type = 'text';
            reqInput.placeholder = 'e.g. smin:30, item:key_card';
            
            const currentReqText = [];
            if (h.requirements) {
                if (h.requirements.sanity_min !== undefined) currentReqText.push(`smin:${h.requirements.sanity_min}`);
                if (h.requirements.sanity_max !== undefined) currentReqText.push(`smax:${h.requirements.sanity_max}`);
                if (h.requirements.items) h.requirements.items.forEach(i => currentReqText.push(`item:${i}`));
                if (h.requirements.worldStates) {
                    for (const k in h.requirements.worldStates) {
                        currentReqText.push(`state:${k}:${h.requirements.worldStates[k]}`);
                    }
                }
            }
            
            reqInput.value = currentReqText.join(', ');
            reqInput.addEventListener('input', () => {
                const val = reqInput.value.trim();
                if (val) {
                    const reqObj = {};
                    val.split(',').forEach(term => {
                        const parts = term.split(':');
                        const type = parts[0]?.trim();
                        if (type === 'smin') reqObj.sanity_min = parseInt(parts[1]);
                        else if (type === 'smax') reqObj.sanity_max = parseInt(parts[1]);
                        else if (type === 'item') {
                            reqObj.items = reqObj.items || [];
                            reqObj.items.push(parts[1].trim());
                        } else if (type === 'state') {
                            reqObj.worldStates = reqObj.worldStates || {};
                            reqObj.worldStates[parts[1].trim()] = parseInt(parts[2] !== undefined ? parts[2].trim() : '1');
                        }
                    });
                    h.requirements = reqObj;
                } else {
                    h.requirements = null;
                }
                updateRoomExportArea();
            });

            reqGroup.appendChild(reqLabel);
            reqGroup.appendChild(reqInput);
            controlsCol.appendChild(reqGroup);

            // Hotspot Position Preview Column
            const previewCol = document.createElement('div');
            previewCol.className = 'hotspot-card-preview-col';

            const previewLabel = document.createElement('label');
            previewLabel.textContent = 'Position Preview';
            previewLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary); width: 100%; text-align: left;';
            previewCol.appendChild(previewLabel);

            const previewWrapper = document.createElement('div');
            previewWrapper.style.cssText = `
                position: relative;
                width: 100%;
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: var(--radius-sm);
                overflow: hidden;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            `;

            // Resolve background image URL
            let bgUrl = null;
            if (scene.bg_image) {
                bgUrl = `../${scene.bg_image}`;
            } else {
                const roomMedia = state.mediaLibrary.filter(
                    m => m.context_type === 'room' && m.context_id === state.currentEditId
                );
                if (roomMedia.length > 0) {
                    bgUrl = `../${roomMedia[0].filepath}`;
                }
            }

            // Resolve coordinates
            let coords = null;
            if (h.area) {
                if (h.area.shapes && h.area.shapes[0]) {
                    coords = h.area.shapes[0].coords;
                } else if (h.area.coords) {
                    coords = h.area.coords;
                }
            }

            if (bgUrl) {
                const img = document.createElement('img');
                img.src = bgUrl;
                img.style.cssText = 'width: 100%; height: auto; display: block; pointer-events: none;';
                previewWrapper.appendChild(img);

                if (coords) {
                    const left = parseFloat(coords.x !== undefined ? coords.x : coords.left);
                    const top = parseFloat(coords.y !== undefined ? coords.y : coords.top);
                    const width = parseFloat(coords.width !== undefined ? coords.width : coords.w);
                    const height = parseFloat(coords.height !== undefined ? coords.height : coords.h);

                    if (!isNaN(left) && !isNaN(top) && !isNaN(width) && !isNaN(height)) {
                        const highlight = document.createElement('div');
                        highlight.style.cssText = `
                            position: absolute;
                            border: 2px dashed var(--accent-primary);
                            background: rgba(234, 179, 8, 0.25);
                            box-shadow: 0 0 6px var(--accent-glow);
                            left: ${left}%;
                            top: ${top}%;
                            width: ${width}%;
                            height: ${height}%;
                            pointer-events: none;
                        `;
                        previewWrapper.appendChild(highlight);
                    }
                } else {
                    const noArea = document.createElement('div');
                    noArea.style.cssText = 'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255, 255, 255, 0.4); font-size: 0.7rem; background: rgba(0, 0, 0, 0.6); font-family: var(--font-sans);';
                    noArea.textContent = 'No boundary';
                    previewWrapper.appendChild(noArea);
                }
            } else {
                const noImage = document.createElement('div');
                noImage.style.cssText = 'height: 90px; display: flex; align-items: center; justify-content: center; color: rgba(255, 255, 255, 0.3); font-size: 0.7rem; font-family: var(--font-sans); text-align: center; padding: 10px;';
                noImage.textContent = 'No Scene Image';
                previewWrapper.appendChild(noImage);
            }

            previewCol.appendChild(previewWrapper);

            cardBody.appendChild(controlsCol);
            cardBody.appendChild(previewCol);
            card.appendChild(cardBody);

            list.appendChild(card);
        });
    }

    if (window.lucide) window.lucide.createIcons();

    document.getElementById('btn-add-scene-hotspot').onclick = () => {
        scene.hotspots.push({
            type: 'tra',
            target_id: '',
            label: '',
            area: null,
            requirements: null
        });
        renderSceneHotspots(scene);
        updateRoomExportArea();
        if (window.syncEditorRequirementsFromActiveScene) {
            window.syncEditorRequirementsFromActiveScene();
        }
    };
}

export function renderSceneCommands(scene) {
    const list = document.getElementById('scene-commands-list');
    if (!list) return;
    list.innerHTML = '';

    scene.terminal_commands = scene.terminal_commands || [];

    // Update collapsible header count
    const commandBadge = document.querySelector('#sec-scene-commands .collapsible-header-actions span');
    if (commandBadge) {
        commandBadge.textContent = `${scene.terminal_commands.length} defined`;
    }

    if (scene.terminal_commands.length === 0) {
        list.innerHTML = '<span style="font-size: 0.85rem; color: #666; font-style: italic;">No custom terminal commands defined.</span>';
    } else {
        scene.terminal_commands.forEach((c, idx) => {
            const card = document.createElement('div');
            card.className = 'command-config-card';
            card.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                background: rgba(0,0,0,0.25);
                padding: 1.25rem;
                border-radius: var(--radius-md);
                border: 1px solid var(--glass-border);
                position: relative;
                margin-bottom: 0.75rem;
            `;

            // Card Header
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px; margin-bottom: 4px;';
            
            const titleSpan = document.createElement('span');
            titleSpan.style.cssText = 'font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-primary);';
            titleSpan.textContent = `Command #${idx + 1}`;
            
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-remove btn-remove-compact';
            delBtn.style.cssText = 'padding: 4px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); width: 28px; height: 28px;';
            delBtn.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--error);"></i>';
            delBtn.onclick = () => {
                scene.terminal_commands = scene.terminal_commands.filter((_, i) => i !== idx);
                renderSceneCommands(scene);
                updateRoomExportArea();
            };

            header.appendChild(titleSpan);
            header.appendChild(delBtn);
            card.appendChild(header);

            // 1. Trigger phrase
            const triggerGroup = document.createElement('div');
            triggerGroup.className = 'form-group compact';
            triggerGroup.style.margin = '0';
            const triggerLabel = document.createElement('label');
            triggerLabel.textContent = 'Command Trigger Word/Phrase';
            triggerLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const triggerInput = document.createElement('input');
            triggerInput.type = 'text';
            triggerInput.placeholder = 'Trigger (e.g. read paper)';
            triggerInput.value = c.trigger || '';
            triggerInput.style.width = '100%';
            
            triggerInput.addEventListener('input', () => {
                c.trigger = triggerInput.value.trim();
                updateRoomExportArea();
            });
            triggerGroup.appendChild(triggerLabel);
            triggerGroup.appendChild(triggerInput);
            card.appendChild(triggerGroup);

            // 2. Success response text
            const successGroup = document.createElement('div');
            successGroup.className = 'form-group compact';
            successGroup.style.margin = '0';
            const successLabel = document.createElement('label');
            successLabel.textContent = 'Terminal Response / Success Text';
            successLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const successInput = document.createElement('input');
            successInput.type = 'text';
            successInput.placeholder = 'Success text displayed on terminal...';
            successInput.value = c.success_text || '';
            successInput.style.width = '100%';
            
            successInput.addEventListener('input', () => {
                c.success_text = successInput.value.trim() || null;
                updateRoomExportArea();
            });
            successGroup.appendChild(successLabel);
            successGroup.appendChild(successInput);
            card.appendChild(successGroup);

            // 3. Effects (JSON)
            const effectsGroup = document.createElement('div');
            effectsGroup.className = 'form-group compact';
            effectsGroup.style.margin = '0';
            const effectsLabel = document.createElement('label');
            effectsLabel.textContent = 'Trigger Action Effects (JSON)';
            effectsLabel.style.cssText = 'font-size: 0.8rem; margin-bottom: 4px; font-weight: 600; color: var(--text-secondary);';
            
            const effectsInput = document.createElement('input');
            effectsInput.type = 'text';
            effectsInput.placeholder = '[{"type":"sfx","value":"paper_rustle"}]';
            effectsInput.value = JSON.stringify(c.effects || []);
            effectsInput.style.cssText = 'width: 100%; font-family: var(--font-mono); font-size: 0.8rem;';
            
            effectsInput.addEventListener('input', () => {
                try {
                    const parsed = JSON.parse(effectsInput.value);
                    c.effects = parsed;
                    effectsInput.style.borderColor = '';
                } catch (e) {
                    effectsInput.style.borderColor = '#ef4444';
                }
                updateRoomExportArea();
            });
            effectsGroup.appendChild(effectsLabel);
            effectsGroup.appendChild(effectsInput);
            card.appendChild(effectsGroup);

            list.appendChild(card);
        });
    }

    if (window.lucide) window.lucide.createIcons();

    document.getElementById('btn-add-scene-command').onclick = () => {
        scene.terminal_commands.push({
            trigger: '',
            effects: [],
            success_text: ''
        });
        renderSceneCommands(scene);
        updateRoomExportArea();
    };
}
