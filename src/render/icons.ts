import type { IconName, IconSet } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Path data for the built-in icons (24x24, drawn with a 2px round stroke). */
const PATHS: Record<IconName, string[]> = {
    arrow: ['m6 9 6 6 6-6'],
    clear: ['M18 6 6 18', 'm6 6 12 12'],
    remove: ['M18 6 6 18', 'm6 6 12 12'],
    check: ['M20 6 9 17l-5-5'],
    spinner: ['M21 12a9 9 0 1 1-6.22-8.56'],
};

/** The classes select3 used before it had its own icons; `icons: 'fontawesome'` brings them back. */
const FONT_AWESOME: Record<IconName, string> = {
    arrow: 'fa-solid fa-chevron-down',
    clear: 'fa-solid fa-xmark',
    remove: 'fa-solid fa-xmark',
    check: 'fa-solid fa-check',
    spinner: 'fa-solid fa-spinner',
};

/** An inline SVG icon, built with DOM calls (select3 never uses innerHTML). */
const svgIcon = (name: IconName): SVGSVGElement => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', `s3__svg s3__svg--${name}`);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    for (const d of PATHS[name]) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        svg.append(path);
    }

    return svg;
};

/** An icon-font glyph: an empty <i> carrying the given classes. */
export const classIcon = (className: string): HTMLElement => {
    const i = document.createElement('i');
    i.className = className;
    i.setAttribute('aria-hidden', 'true');
    return i;
};

/**
 * One of select3's own icons from the configured set: the built-in SVGs
 * ('svg', the default), Font Awesome 6 classes ('fontawesome'), or a map that
 * overrides single icons with a class list or a function returning a node.
 * Icons a map leaves out fall back to the SVG. `extraClass` is added to the
 * resulting element (e.g. 's3__check').
 */
export const icon = (set: IconSet, name: IconName, extraClass?: string): Node => {
    let node: Node;

    if (set === 'fontawesome') {
        node = classIcon(FONT_AWESOME[name]);
    } else if (typeof set === 'object' && set !== null && set[name] !== undefined) {
        const source = set[name]!;
        node = typeof source === 'function' ? source() : classIcon(source);
    } else {
        node = svgIcon(name);
    }

    if (extraClass && node instanceof Element) {
        node.classList.add(...extraClass.split(/\s+/).filter(Boolean));
    }

    return node;
};
