// Conditional gates and sanity-gates management logic
import { state } from './state.js';
import { showToast } from './ui.js';
import { refreshCategorySelectors, renderInteractablesCheckboxes } from './rooms.js';

export function updateReqStateDropdown(interId, selectedStateId = null) {
    const group = document.getElementById('req-state-group');
    const sel = document.getElementById('req-state-id');

    if (!interId || !state.allInteractables[interId]) {
        if (group) group.classList.add('hidden');
        return;
    }

    if (sel) {
        sel.innerHTML = '';
        (state.allInteractables[interId].states || []).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.innerText = `${s.id} (${s.desc.substring(0, 20)}...)`;
            sel.appendChild(opt);
        });

        if (selectedStateId) sel.value = selectedStateId;
    }
    if (group) group.classList.remove('hidden');
}

export function clearRequirements() {
    if (!state.currentReqTarget) return;
    delete state.editorRequirements[state.currentReqTarget.type][state.currentReqTarget.id];
    document.getElementById('req-modal').classList.add('hidden');
    refreshCategorySelectors();

    const checkedIds = Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => cb.value);
    renderInteractablesCheckboxes(checkedIds);
}

export function saveRequirementsToState() {
    if (!state.currentReqTarget) return;

    const interId = document.getElementById('req-interactable-id').value;
    const stateId = document.getElementById('req-state-id').value;
    const sMin = parseInt(document.getElementById('req-sanity-min').value);
    const sMax = parseInt(document.getElementById('req-sanity-max').value);

    const reqObj = {};
    if (interId) {
        reqObj.interactable_id = interId;
        reqObj.state_id = stateId;
    }
    if (sMin > 0) reqObj.sanity_min = sMin;
    if (sMax < 100) reqObj.sanity_max = sMax;

    if (Object.keys(reqObj).length > 0) {
        state.editorRequirements[state.currentReqTarget.type][state.currentReqTarget.id] = reqObj;
    } else {
        delete state.editorRequirements[state.currentReqTarget.type][state.currentReqTarget.id];
    }

    document.getElementById('req-modal').classList.add('hidden');
    showToast('Conditions applied to draft.', 'success');

    refreshCategorySelectors();
    const checkedIds = Array.from(document.querySelectorAll('#interactables-checkbox-group input:checked')).map(cb => cb.value);
    renderInteractablesCheckboxes(checkedIds);
}

// Bind openRequirementsModal globally
window.openRequirementsModal = (type, id) => {
    state.currentReqTarget = { type, id };
    const reqs = state.editorRequirements[type][id] || {};

    const modalTitle = document.getElementById('req-modal-title');
    if (modalTitle) modalTitle.innerText = `Conditions: ${id}`;

    const sel = document.getElementById('req-interactable-id');
    if (sel) {
        sel.innerHTML = '<option value="">None</option>';
        Object.entries(state.allInteractables).forEach(([iid, data]) => {
            const opt = document.createElement('option');
            opt.value = iid;
            opt.innerText = data.label || iid;
            sel.appendChild(opt);
        });
        sel.value = reqs.interactable_id || '';
    }

    const sMinInput = document.getElementById('req-sanity-min');
    if (sMinInput) sMinInput.value = reqs.sanity_min !== undefined ? reqs.sanity_min : 0;

    const sMaxInput = document.getElementById('req-sanity-max');
    if (sMaxInput) sMaxInput.value = reqs.sanity_max !== undefined ? reqs.sanity_max : 100;

    updateReqStateDropdown(reqs.interactable_id, reqs.state_id);
    document.getElementById('req-modal').classList.remove('hidden');
};
