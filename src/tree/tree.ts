/**
 * Tree model for hierarchical select. The native <select> stays flat (and is the
 * form value); hierarchy is reconstructed from each option's `data-parent`
 * attribute (item.data.parent points at the parent option's value). Options with
 * no parent are roots. Cycles are defended against with visited guards.
 */

import type { Item } from '../types';

export interface TreeNode {
    item: Item;
    value: string;
    label: string;
    parent: TreeNode | null;
    children: TreeNode[];
    level: number;
}

/** Build a forest from flat items linked by data-parent. */
export function buildTree(items: Item[]): TreeNode[] {
    const byValue = new Map<string, TreeNode>();
    for (const item of items) {
        byValue.set(item.value, {
            item,
            value: item.value,
            label: item.label,
            parent: null,
            children: [],
            level: 0,
        });
    }

    const roots: TreeNode[] = [];
    for (const item of items) {
        const node = byValue.get(item.value);
        if (!node) continue;
        const parentValue = item.data?.parent;
        const parent = parentValue ? byValue.get(parentValue) : undefined;
        if (parent && parent !== node) {
            node.parent = parent;
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }

    const setLevel = (node: TreeNode, level: number, seen: Set<TreeNode>): void => {
        if (seen.has(node)) return;
        seen.add(node);
        node.level = level;
        node.children.forEach((c) => setLevel(c, level + 1, seen));
    };
    const seen = new Set<TreeNode>();
    roots.forEach((r) => setLevel(r, 0, seen));
    return roots;
}

/** All leaf descendants (nodes with no children) of a node, itself if it's a leaf. */
export function leavesOf(node: TreeNode, seen = new Set<TreeNode>()): TreeNode[] {
    if (seen.has(node)) return [];
    seen.add(node);
    if (!node.children.length) return [node];
    return node.children.flatMap((c) => leavesOf(c, seen));
}

/** Pre-order walk over the whole forest. */
export function walk(nodes: TreeNode[], fn: (node: TreeNode) => void, seen = new Set<TreeNode>()): void {
    for (const node of nodes) {
        if (seen.has(node)) continue;
        seen.add(node);
        fn(node);
        walk(node.children, fn, seen);
    }
}
