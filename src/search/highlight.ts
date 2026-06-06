/**
 * Wrap the matched substring of `label` in <mark> and return the text nodes to
 * append (never innerHTML). Matching is case-insensitive on the original string;
 * if the query isn't a direct substring (e.g. a diacritic-only match) the label
 * is returned unmarked rather than risk a wrong highlight range.
 */
export function highlight(label: string, query: string): Node[] {
    const q = query.trim();
    if (!q) return [document.createTextNode(label)];

    const idx = label.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return [document.createTextNode(label)];

    const before = label.slice(0, idx);
    const match = label.slice(idx, idx + q.length);
    const after = label.slice(idx + q.length);

    const mark = document.createElement('mark');
    mark.className = 's3__mark';
    mark.textContent = match;

    const nodes: Node[] = [];
    if (before) nodes.push(document.createTextNode(before));
    nodes.push(mark);
    if (after) nodes.push(document.createTextNode(after));
    return nodes;
}
