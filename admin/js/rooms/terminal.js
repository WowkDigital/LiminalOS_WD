// Room terminal dialogue management logic
import { state } from '../state.js';
import { getTerminalDialogueTree, createOptionCard } from '../terminal.js';
import { updateRoomExportArea } from './editor.js';

let terminalListenersAttached = false;
export function setupRoomTerminalListeners() {
    if (terminalListenersAttached) return;
    terminalListenersAttached = true;

    const checkbox = document.getElementById('room-terminal-enabled');
    const configDiv = document.getElementById('room-terminal-config');
    const addOptBtn = document.getElementById('btn-add-room-terminal-option');
    const optionsList = document.getElementById('room-terminal-options-list');

    if (checkbox && configDiv) {
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                configDiv.classList.remove('hidden');
            } else {
                configDiv.classList.add('hidden');
            }
            updateRoomExportArea();
        });
    }

    if (addOptBtn && optionsList) {
        addOptBtn.addEventListener('click', () => {
            const newIndex = optionsList.children.length;
            const newOpt = { label: 'NEW OPTION', next: '' };
            const tree = getTerminalDialogueTree();
            const card = createOptionCard(newOpt, newIndex, tree);
            optionsList.appendChild(card);
            
            // Listen for input to update JSON area
            card.addEventListener('input', updateRoomExportArea);
            if (window.lucide) window.lucide.createIcons();
            updateRoomExportArea();
        });
    }

    const termText = document.getElementById('room-terminal-text');
    if (termText) {
        termText.addEventListener('input', updateRoomExportArea);
    }
}

export function populateTerminalSection(id) {
    const checkbox = document.getElementById('room-terminal-enabled');
    const configDiv = document.getElementById('room-terminal-config');
    const textInput = document.getElementById('room-terminal-text');
    const optionsList = document.getElementById('room-terminal-options-list');
    
    if (!checkbox || !configDiv || !textInput || !optionsList) return;
    
    optionsList.innerHTML = '';
    
    if (id) {
        const nodeKey = "ROOM_" + id.toUpperCase();
        const tree = getTerminalDialogueTree();
        const node = tree[nodeKey];
        
        if (node) {
            checkbox.checked = true;
            configDiv.classList.remove('hidden');
            textInput.value = node.text || '';
            
            const options = node.options || [];
            options.forEach((opt, index) => {
                const card = createOptionCard(opt, index, tree);
                optionsList.appendChild(card);
                card.addEventListener('input', updateRoomExportArea);
            });
        } else {
            checkbox.checked = false;
            configDiv.classList.add('hidden');
            textInput.value = '';
        }
    } else {
        checkbox.checked = false;
        configDiv.classList.add('hidden');
        textInput.value = '';
    }
    
    if (window.lucide) window.lucide.createIcons();
    updateRoomExportArea();
}

export function getRoomTerminalDialogueData() {
    const enabled = document.getElementById('room-terminal-enabled').checked;
    if (!enabled) return null;
    
    const nodeText = document.getElementById('room-terminal-text').value;
    const optionCards = document.querySelectorAll('#room-terminal-options-list .terminal-option-card');
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
    
    return {
        text: nodeText,
        options: options
    };
}
