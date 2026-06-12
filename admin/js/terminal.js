// Terminal Dialogue Tree Editor Module
import { el, icon } from './dom.js';
import { state } from './state.js';
import { showToast } from './ui.js';

let terminalDialogueTree = {};
let activeNodeId = null;
let listenersAttached = false;

export function getTerminalDialogueTree() {
    return terminalDialogueTree;
}

export function setTerminalDialogueTree(tree) {
    terminalDialogueTree = tree;
}

export async function fetchTerminalDialogues() {
    const listCont = document.getElementById('terminal-nodes-list');
    if (listCont) {
        listCont.innerHTML = '<div class="loading">Loading terminal reality matrix...</div>';
    }
    
    try {
        const response = await fetch('api.php?action=get_terminal_dialogue');
        terminalDialogueTree = await response.json();
        
        // Reset active node
        activeNodeId = null;
        
        // Setup general listeners
        setupTerminalEventListenersOnce();
        
        // Render node list
        renderTerminalNodesList();
        
        // Clear editor
        clearTerminalEditor();
    } catch (err) {
        showToast('Failed to load terminal dialogues: ' + err.message, 'error');
        if (listCont) {
            listCont.innerHTML = '<div class="error">Failed to synchronize terminal memory.</div>';
        }
    }
}

function setupTerminalEventListenersOnce() {
    if (listenersAttached) return;
    listenersAttached = true;
    
    // Node search
    const searchInput = document.getElementById('terminal-node-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderTerminalNodesList(searchInput.value.trim());
        });
    }
    
    // Create node button
    const addBtn = document.getElementById('btn-add-terminal-node');
    if (addBtn) {
        addBtn.addEventListener('click', handleAddTerminalNode);
    }
    
    // Add option button
    const addOptBtn = document.getElementById('btn-add-terminal-option');
    if (addOptBtn) {
        addOptBtn.addEventListener('click', () => {
            const list = document.getElementById('terminal-options-list');
            if (list) {
                const newIndex = list.children.length;
                const newOpt = { label: 'NEW OPTION', next: activeNodeId || '' };
                list.appendChild(createOptionCard(newOpt, newIndex));
            }
        });
    }
    
    // Save button
    const saveBtn = document.getElementById('btn-save-terminal');
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSaveTerminal);
    }
    
    // Delete button
    const deleteBtn = document.getElementById('btn-delete-terminal-node');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteTerminalNode);
    }
}

function renderTerminalNodesList(filter = '') {
    const listCont = document.getElementById('terminal-nodes-list');
    if (!listCont) return;
    listCont.innerHTML = '';
    
    const nodeKeys = Object.keys(terminalDialogueTree).sort();
    let renderedCount = 0;
    
    for (const key of nodeKeys) {
        if (filter && !key.toLowerCase().includes(filter.toLowerCase())) {
            continue;
        }
        
        renderedCount++;
        const isActive = key === activeNodeId;
        
        const removeNodeBtn = el('button', {
            type: 'button',
            className: 'btn-remove btn-remove-compact',
            style: { padding: '4px', background: 'transparent', border: 'none' },
            onClick: (e) => {
                e.stopPropagation();
                if (confirm(`Delete dialogue node "${key}"?`)) {
                    delete terminalDialogueTree[key];
                    if (activeNodeId === key) {
                        clearTerminalEditor();
                    }
                    renderTerminalNodesList(filter);
                }
            }
        }, [icon('trash-2', { style: { width: '12px', height: '12px' } })]);

        const itemEl = el('div', {
            className: `node-list-item ${isActive ? 'active' : ''}`,
            onClick: () => selectTerminalNode(key),
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
        }, [
            el('span', {}, key),
            removeNodeBtn
        ]);
        
        listCont.appendChild(itemEl);
    }
    
    if (renderedCount === 0) {
        listCont.appendChild(el('div', { className: 'empty-list-placeholder' }, 'No nodes found'));
    }
}

function selectTerminalNode(nodeId) {
    if (activeNodeId && terminalDialogueTree[activeNodeId]) {
        saveCurrentNodeEditorValues();
    }
    
    activeNodeId = nodeId;
    renderTerminalNodesList(document.getElementById('terminal-node-search')?.value.trim() || '');
    
    const fieldsDiv = document.getElementById('terminal-editor-fields');
    const placeholderDiv = document.getElementById('terminal-editor-placeholder');
    const editorTitle = document.getElementById('terminal-editor-node-id');
    
    if (!fieldsDiv || !placeholderDiv || !editorTitle) return;
    
    fieldsDiv.classList.remove('hidden');
    placeholderDiv.classList.add('hidden');
    
    editorTitle.textContent = `Editing Node: ${nodeId}`;
    
    document.getElementById('terminal-node-id-input').value = nodeId;
    document.getElementById('terminal-node-text-input').value = terminalDialogueTree[nodeId].text || '';
    
    renderTerminalOptionsEditor(terminalDialogueTree[nodeId]);
    
    if (window.lucide) window.lucide.createIcons();
}

function clearTerminalEditor() {
    const fieldsDiv = document.getElementById('terminal-editor-fields');
    const placeholderDiv = document.getElementById('terminal-editor-placeholder');
    const editorTitle = document.getElementById('terminal-editor-node-id');
    
    if (fieldsDiv) fieldsDiv.classList.add('hidden');
    if (placeholderDiv) placeholderDiv.classList.remove('hidden');
    if (editorTitle) editorTitle.textContent = 'Select a node to edit';
    
    activeNodeId = null;
}

function renderTerminalOptionsEditor(node) {
    const optionsCont = document.getElementById('terminal-options-list');
    if (!optionsCont) return;
    optionsCont.innerHTML = '';
    
    const options = node.options || [];
    options.forEach((opt, index) => {
        const optCard = createOptionCard(opt, index);
        optionsCont.appendChild(optCard);
    });
}

export function createOptionCard(opt, index, tree = terminalDialogueTree) {
    // Label input
    const labelInput = el('input', {
        type: 'text',
        className: 'opt-label-input',
        value: opt.label || '',
        placeholder: 'Option Display Label (e.g. BYPASS ALARM)',
        required: true,
        style: { marginBottom: '0.75rem' }
    });
    
    // Next node selection
    const nextSelect = el('select', {
        className: 'opt-next-select',
        style: { flex: 1 }
    });
    
    const nextNodeOptions = Object.keys(terminalDialogueTree).sort();
    const currentNext = opt.next || 'INITIAL';
    
    nextSelect.appendChild(el('option', { value: '' }, 'Choose Next Node...'));
    for (const nKey of nextNodeOptions) {
        nextSelect.appendChild(el('option', { value: nKey, selected: nKey === currentNext }, nKey));
    }
    nextSelect.appendChild(el('option', { value: '_custom_' }, 'Custom Node ID...'));
    
    const isCustomNext = !nextNodeOptions.includes(currentNext) && currentNext !== '';
    const nextCustomInput = el('input', {
        type: 'text',
        className: 'opt-next-custom',
        value: isCustomNext ? currentNext : '',
        placeholder: 'Enter Custom Node ID...',
        style: {
            display: isCustomNext ? 'block' : 'none',
            marginTop: '0.25rem'
        }
    });
    
    if (isCustomNext) {
        nextSelect.value = '_custom_';
    }
    
    nextSelect.addEventListener('change', () => {
        if (nextSelect.value === '_custom_') {
            nextCustomInput.style.display = 'block';
            nextCustomInput.required = true;
        } else {
            nextCustomInput.style.display = 'none';
            nextCustomInput.required = false;
        }
    });

    const nextFormGroup = el('div', { className: 'form-group compact', style: { marginBottom: '1rem' } }, [
        el('label', { style: { fontSize: '0.8rem', marginBottom: '4px' } }, 'Next Node destination'),
        nextSelect,
        nextCustomInput
    ]);

    // Requirements Section
    const req = opt.requirements || {};
    
    const sanityMinInput = el('input', {
        type: 'number',
        className: 'opt-req-sanity-min',
        value: req.sanity_min !== undefined ? req.sanity_min : '',
        placeholder: 'Min %',
        min: 0,
        max: 100,
        style: { flex: 1 }
    });
    
    const sanityMaxInput = el('input', {
        type: 'number',
        className: 'opt-req-sanity-max',
        value: req.sanity_max !== undefined ? req.sanity_max : '',
        placeholder: 'Max %',
        min: 0,
        max: 100,
        style: { flex: 1 }
    });
    
    // Inventory check
    const itemSelect = el('select', {
        className: 'opt-req-item-id',
        style: { flex: 1 }
    });
    itemSelect.appendChild(el('option', { value: '' }, 'No Item Required'));
    
    const commonItems = ['flash_drive', 'almond_water', 'master_key', 'crowbar', 'fuse', 'level_keycard'];
    for (const item of commonItems) {
        itemSelect.appendChild(el('option', { value: item, selected: req.has_item === item }, item));
    }
    
    const isCustomItem = req.has_item && !commonItems.includes(req.has_item);
    const customItemInput = el('input', {
        type: 'text',
        className: 'opt-req-item-custom',
        value: isCustomItem ? req.has_item : '',
        placeholder: 'Custom item name...',
        style: {
            display: isCustomItem ? 'block' : 'none',
            marginTop: '0.25rem'
        }
    });
    
    if (isCustomItem) {
        itemSelect.value = 'custom';
    }
    
    itemSelect.addEventListener('change', () => {
        if (itemSelect.value === 'custom') {
            customItemInput.style.display = 'block';
            customItemInput.required = true;
        } else {
            customItemInput.style.display = 'none';
            customItemInput.required = false;
        }
    });
    itemSelect.appendChild(el('option', { value: 'custom', selected: isCustomItem }, 'Custom Item ID...'));
    
    const itemCountInput = el('input', {
        type: 'number',
        className: 'opt-req-item-count',
        value: req.item_count !== undefined ? req.item_count : '',
        placeholder: 'Qty',
        min: 1,
        style: { width: '80px' }
    });

    // Interactable state requirement
    const reqInteractableSelect = el('select', {
        className: 'opt-req-inter-id',
        style: { flex: 1 }
    });
    reqInteractableSelect.appendChild(el('option', { value: '' }, 'No Interactable Check'));
    const allInters = Object.keys(state.allInteractables || {}).sort();
    for (const iId of allInters) {
        const label = state.allInteractables[iId].label || iId;
        reqInteractableSelect.appendChild(el('option', { value: iId, selected: req.interactable_id === iId }, label));
    }
    
    const reqStateInput = el('input', {
        type: 'number',
        className: 'opt-req-inter-state',
        value: req.state_id !== undefined ? req.state_id : (req.state !== undefined ? req.state : ''),
        placeholder: 'Required state value (e.g. 1)',
        style: { width: '220px' }
    });

    const reqSection = el('div', { className: 'option-requirements-card' }, [
        el('h4', { className: 'sub-header' }, 'Entry Requirements'),
        el('div', { className: 'req-row' }, [
            el('span', { className: 'param-prefix' }, 'Sanity Range:'),
            sanityMinInput,
            el('span', {}, '-'),
            sanityMaxInput
        ]),
        el('div', { className: 'req-row', style: { marginTop: '8px' } }, [
            el('span', { className: 'param-prefix' }, 'Required Item:'),
            itemSelect,
            customItemInput,
            itemCountInput
        ]),
        el('div', { className: 'req-row', style: { marginTop: '8px' } }, [
            el('span', { className: 'param-prefix' }, 'Object State:'),
            reqInteractableSelect,
            reqStateInput
        ])
    ]);

    // Effects Section
    const effectsCont = el('div', { className: 'option-effects-list' });
    const effects = opt.effects || [];
    effects.forEach((eff, effIndex) => {
        effectsCont.appendChild(createEffectRow(eff, effIndex));
    });

    const addEffectBtn = el('button', {
        type: 'button',
        className: 'btn-small',
        style: { width: 'auto', marginTop: '0.75rem', padding: '6px 12px' },
        onClick: () => {
            effectsCont.appendChild(createEffectRow({ type: 'sfx', value: 'success' }, effectsCont.children.length));
        }
    }, '+ Add Trigger Action Effect');

    const effectsSection = el('div', { className: 'option-effects-card' }, [
        el('h4', { className: 'sub-header' }, 'Trigger Effects'),
        effectsCont,
        addEffectBtn
    ]);

    // Delete entire option card
    const removeBtn = el('button', {
        type: 'button',
        className: 'btn-remove btn-remove-compact',
        onClick: () => {
            if (confirm('Delete this option card?')) {
                optCard.remove();
            }
        },
        title: 'Delete Option'
    }, [icon('trash-2', { style: { width: '14px', height: '14px' } })]);

    const header = el('div', { className: 'option-card-header' }, [
        el('span', { className: 'option-number' }, `Option #${index + 1}`),
        removeBtn
    ]);

    const optCard = el('div', {
        className: 'terminal-option-card',
        'data-index': index
    }, [
        header,
        labelInput,
        nextFormGroup,
        reqSection,
        effectsSection
    ]);
    
    return optCard;
}

export function createEffectRow(eff, index) {
    const typeSelect = el('select', {
        className: 'eff-type-select',
        style: { width: '140px' }
    });
    
    const types = [
        { value: 'sfx', label: 'Play SFX' },
        { value: 'sanity', label: 'Modify Sanity' },
        { value: 'item', label: 'Give/Take Item' },
        { value: 'act', label: 'Set Object State' },
        { value: 'move', label: 'Transfer Location' }
    ];
    
    for (const t of types) {
        typeSelect.appendChild(el('option', { value: t.value, selected: eff.type === t.value }, t.label));
    }

    const valueCont = el('div', { className: 'eff-values-cont', style: { flex: 1, display: 'flex', gap: '8px' } });

    const updateInputs = (type) => {
        valueCont.innerHTML = '';
        
        if (type === 'sfx') {
            const sfxSelect = el('select', { className: 'eff-sfx-val' });
            sfxSelect.appendChild(el('option', { value: '' }, 'Select SFX...'));
            
            const defaults = ['success', 'error', 'click', 'arrival', 'hum_low', 'hum_high'];
            for (const d of defaults) {
                sfxSelect.appendChild(el('option', { value: d, selected: eff.value === d }, d));
            }
            
            const audioLib = state.audioLibrary || [];
            for (const item of audioLib) {
                const fn = item.filename;
                if (!defaults.includes(fn)) {
                    sfxSelect.appendChild(el('option', { value: fn, selected: eff.value === fn }, fn));
                }
            }
            
            valueCont.appendChild(sfxSelect);
        }
        else if (type === 'sanity') {
            const numInput = el('input', {
                type: 'number',
                className: 'eff-sanity-val',
                value: eff.value !== undefined ? eff.value : '',
                placeholder: 'Sanity offset (e.g. -15 or 10)',
                required: true
            });
            valueCont.appendChild(numInput);
        }
        else if (type === 'item') {
            const itemInput = el('input', {
                type: 'text',
                className: 'eff-item-id',
                value: eff.item || '',
                placeholder: 'Item ID (e.g. almond_water)',
                required: true,
                style: { flex: 1 }
            });
            const amtInput = el('input', {
                type: 'number',
                className: 'eff-item-amt',
                value: eff.amount !== undefined ? eff.amount : 1,
                placeholder: 'Qty',
                required: true,
                style: { width: '80px' }
            });
            valueCont.appendChild(itemInput);
            valueCont.appendChild(amtInput);
        }
        else if (type === 'act') {
            const interSelect = el('select', { className: 'eff-inter-id', style: { flex: 1 } });
            interSelect.appendChild(el('option', { value: '' }, 'Select Object...'));
            
            const allInters = Object.keys(state.allInteractables || {}).sort();
            for (const iId of allInters) {
                const label = state.allInteractables[iId].label || iId;
                interSelect.appendChild(el('option', { value: iId, selected: eff.id === iId }, label));
            }
            
            const stateInput = el('input', {
                type: 'number',
                className: 'eff-inter-state',
                value: eff.state !== undefined ? eff.state : 1,
                placeholder: 'State Index',
                required: true,
                style: { width: '90px' }
            });
            
            valueCont.appendChild(interSelect);
            valueCont.appendChild(stateInput);
        }
        else if (type === 'move') {
            const roomSelect = el('select', { className: 'eff-room-id' });
            roomSelect.appendChild(el('option', { value: '' }, 'Select Room...'));
            
            const allRooms = Object.keys(state.roomsData || {}).sort();
            for (const rId of allRooms) {
                const name = state.roomsData[rId].name || rId;
                roomSelect.appendChild(el('option', { value: rId, selected: eff.room === rId }, name));
            }
            
            valueCont.appendChild(roomSelect);
        }
    };

    typeSelect.addEventListener('change', (e) => {
        updateInputs(e.target.value);
    });

    updateInputs(eff.type || 'sfx');

    const removeRowBtn = el('button', {
        type: 'button',
        className: 'btn-remove btn-remove-compact',
        style: { width: '28px', height: '28px', padding: 0 },
        onClick: () => {
            row.remove();
        }
    }, '×');

    const row = el('div', {
        className: 'effect-config-row',
        style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', width: '100%' }
    }, [
        typeSelect,
        valueCont,
        removeRowBtn
    ]);

    return row;
}

function saveCurrentNodeEditorValues() {
    if (!activeNodeId || !terminalDialogueTree[activeNodeId]) return;
    
    const nodeText = document.getElementById('terminal-node-text-input').value;
    const optionCards = document.querySelectorAll('.terminal-option-card');
    const options = [];
    
    optionCards.forEach(card => {
        const label = card.querySelector('.opt-label-input').value.trim();
        
        let next = '';
        const nextSelect = card.querySelector('.opt-next-select');
        if (nextSelect.value === '_custom_') {
            next = card.querySelector('.opt-next-custom').value.trim();
        } else {
            next = nextSelect.value;
        }
        
        const opt = { label, next };
        
        // Requirements
        const requirements = {};
        
        const sMin = card.querySelector('.opt-req-sanity-min').value;
        if (sMin !== '') requirements.sanity_min = parseInt(sMin);
        
        const sMax = card.querySelector('.opt-req-sanity-max').value;
        if (sMax !== '') requirements.sanity_max = parseInt(sMax);
        
        const itemVal = card.querySelector('.opt-req-item-id').value;
        if (itemVal === 'custom') {
            const customItem = card.querySelector('.opt-req-item-custom').value.trim();
            if (customItem) {
                requirements.has_item = customItem;
            }
        } else if (itemVal) {
            requirements.has_item = itemVal;
        }
        
        const itemCount = card.querySelector('.opt-req-item-count').value;
        if (itemCount !== '') requirements.item_count = parseInt(itemCount);
        
        const interId = card.querySelector('.opt-req-inter-id').value;
        if (interId) {
            requirements.interactable_id = interId;
            const interState = card.querySelector('.opt-req-inter-state').value;
            if (interState !== '') {
                requirements.state_id = parseInt(interState);
            }
        }
        
        if (Object.keys(requirements).length > 0) {
            opt.requirements = requirements;
        }
        
        // Effects
        const effects = [];
        const effRows = card.querySelectorAll('.effect-config-row');
        effRows.forEach(row => {
            const type = row.querySelector('.eff-type-select').value;
            const eff = { type };
            
            if (type === 'sfx') {
                eff.value = row.querySelector('.eff-sfx-val').value;
            }
            else if (type === 'sanity') {
                eff.value = parseInt(row.querySelector('.eff-sanity-val').value) || 0;
            }
            else if (type === 'item') {
                eff.item = row.querySelector('.eff-item-id').value.trim();
                eff.amount = parseInt(row.querySelector('.eff-item-amt').value) || 1;
            }
            else if (type === 'act') {
                eff.id = row.querySelector('.eff-inter-id').value;
                eff.state = parseInt(row.querySelector('.eff-inter-state').value) || 1;
            }
            else if (type === 'move') {
                eff.room = row.querySelector('.eff-room-id').value;
            }
            
            effects.push(eff);
        });
        
        if (effects.length > 0) {
            opt.effects = effects;
        }
        
        options.push(opt);
    });
    
    // Save state
    terminalDialogueTree[activeNodeId] = {
        text: nodeText,
        options: options
    };
    
    // If ID changed
    const newIdInput = document.getElementById('terminal-node-id-input').value.trim().toUpperCase();
    if (newIdInput && newIdInput !== activeNodeId) {
        if (terminalDialogueTree[newIdInput]) {
            showToast(`Node ID '${newIdInput}' already exists. Reverting to '${activeNodeId}'.`, 'error');
            document.getElementById('terminal-node-id-input').value = activeNodeId;
        } else {
            terminalDialogueTree[newIdInput] = terminalDialogueTree[activeNodeId];
            delete terminalDialogueTree[activeNodeId];
            activeNodeId = newIdInput;
        }
    }
}

function handleAddTerminalNode() {
    let base = "NEW_NODE_";
    let counter = 1;
    while (terminalDialogueTree[base + counter]) {
        counter++;
    }
    const nodeId = base + counter;
    
    terminalDialogueTree[nodeId] = {
        text: "SYS_MSG: SYSTEM ONLINE...\n",
        options: []
    };
    
    selectTerminalNode(nodeId);
    renderTerminalNodesList();
    
    // Focus the ID input so the user can easily type their own name
    setTimeout(() => {
        const idInput = document.getElementById('terminal-node-id-input');
        if (idInput) {
            idInput.focus();
            idInput.select();
        }
    }, 50);
}

function handleDeleteTerminalNode() {
    if (!activeNodeId) return;
    
    if (!confirm(`Are you absolutely sure you want to delete terminal node '${activeNodeId}'?`)) {
        return;
    }
    
    delete terminalDialogueTree[activeNodeId];
    clearTerminalEditor();
    renderTerminalNodesList();
    showToast('Node deleted from memory.', 'info');
}

function handleAddTerminalOption() {
    if (!activeNodeId || !terminalDialogueTree[activeNodeId]) return;
    
    const optionsCont = document.getElementById('terminal-options-list');
    if (!optionsCont) return;
    
    const newOpt = {
        label: "CONTINUE...",
        next: "INITIAL"
    };
    
    if (!terminalDialogueTree[activeNodeId].options) {
        terminalDialogueTree[activeNodeId].options = [];
    }
    
    terminalDialogueTree[activeNodeId].options.push(newOpt);
    
    const index = optionsCont.children.length;
    optionsCont.appendChild(createOptionCard(newOpt, index));
    
    if (window.lucide) window.lucide.createIcons();
}

async function handleSaveTerminal() {
    if (activeNodeId) {
        saveCurrentNodeEditorValues();
    }
    
    try {
        const response = await fetch('api.php?action=save_terminal_dialogue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dialogue: terminalDialogueTree })
        });
        
        const result = await response.json();
        if (result.success) {
            showToast('Terminal dialogues saved successfully!', 'success');
            renderTerminalNodesList(document.getElementById('terminal-node-search')?.value.trim() || '');
        } else {
            throw new Error(result.error || 'Server error');
        }
    } catch (err) {
        showToast('Failed to save terminal dialogues: ' + err.message, 'error');
    }
}
