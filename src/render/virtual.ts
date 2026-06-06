/**
 * Virtual-scroll windowing math. Given the scroll position and a fixed row
 * height, returns the slice of indices to render plus the spacer heights that
 * keep the scrollbar proportional to the full list. Pure + side-effect free so
 * it can be unit-tested without a layout engine.
 */

export interface VirtualWindow {
    /** First index to render (inclusive). */
    start: number;
    /** Last index to render (exclusive). */
    end: number;
    /** Spacer height (px) above the rendered rows. */
    padTop: number;
    /** Spacer height (px) below the rendered rows. */
    padBottom: number;
}

export function computeWindow(
    scrollTop: number,
    viewportHeight: number,
    itemHeight: number,
    total: number,
    buffer = 4,
): VirtualWindow {
    if (total <= 0 || itemHeight <= 0) {
        return { start: 0, end: 0, padTop: 0, padBottom: 0 };
    }
    const visible = Math.max(1, Math.ceil(viewportHeight / itemHeight));
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const end = Math.min(total, start + visible + buffer * 2);
    return {
        start,
        end,
        padTop: start * itemHeight,
        padBottom: Math.max(0, (total - end) * itemHeight),
    };
}
