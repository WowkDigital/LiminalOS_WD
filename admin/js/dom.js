// Lightweight DOM building helper to replace raw innerHTML with safe, programmatic elements

/**
 * Creates an HTML element with attributes and children.
 * @param {string} tag - The HTML tag name (e.g. 'div', 'span')
 * @param {Object} attrs - Attribute object, handles classNames, inline styles, and 'onEvent' handlers.
 * @param {Array|HTMLElement|string} children - Child node(s) or text.
 */
export function el(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (value === null || value === undefined) continue;

        if (key === 'className') {
            element.className = value;
        } else if (['checked', 'value', 'required', 'readOnly', 'disabled', 'selected'].includes(key)) {
            element[key] = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            const eventName = key.slice(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else if (key === 'textContent') {
            element.textContent = value;
        } else {
            element.setAttribute(key, value);
        }
    }

    const childrenArr = Array.isArray(children) ? children : [children];
    for (const child of childrenArr) {
        if (child === null || child === undefined || child === false) continue;
        if (typeof child === 'string' || typeof child === 'number') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof HTMLElement || child instanceof SVGElement) {
            element.appendChild(child);
        }
    }

    return element;
}

/**
 * Helper to build custom SVGs or Lucide icons when lucide is not preloaded or for specific inline icons
 */
export function icon(name, attrs = {}) {
    const i = el('i', { ...attrs });
    i.setAttribute('data-lucide', name);
    return i;
}
