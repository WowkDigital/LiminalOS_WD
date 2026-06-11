// Navigation routing logic for LiminalOS Admin Panel SPA

const views = {
    dashboard: document.getElementById('view-dashboard'),
    editor: document.getElementById('view-editor'),
    media: document.getElementById('view-media'),
    interactables: document.getElementById('view-interactables'),
    interEditor: document.getElementById('view-interactable-editor'),
    transitions: document.getElementById('view-transitions'),
    transEditor: document.getElementById('view-transition-editor'),
    taxonomy: document.getElementById('view-taxonomy'),
    sfx: document.getElementById('view-sfx')
};

export const navigate = (view) => window.location.hash = view;

export function switchView(viewName, renderCallbacks = {}) {
    // Hide all view elements
    Object.values(views).forEach(el => {
        if (el) {
            el.classList.add('hidden');
            el.classList.remove('active');
        }
    });

    // Show active view element
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
        views[viewName].classList.add('active');
    }

    // Toggle nav link classes
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = `btn-${viewName}`;
    if (viewName === 'editor') btnId = 'btn-add-room';
    if (viewName === 'interEditor') btnId = 'btn-interactables';
    if (viewName === 'transEditor') btnId = 'btn-transitions';
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');

    // Run custom rendering or fetching trigger for this view
    if (renderCallbacks[viewName]) {
        renderCallbacks[viewName]();
    }
}
