/**
 * Tiny synchronous event bus. Handlers fire in subscription order; `on`/`once`
 * return an unsubscribe function. Used for the public instance events
 * (open/close/select/deselect/clear/change/type/optionAdd/optionRemove/destroy)
 * and the cancelable `before*` variants.
 */

export type Handler<T = unknown> = (payload: T) => void;

export class Emitter {
    private map = new Map<string, Set<Handler<never>>>();

    on(event: string, handler: Handler): () => void {
        let set = this.map.get(event);
        if (!set) {
            set = new Set();
            this.map.set(event, set);
        }
        set.add(handler as Handler<never>);
        return () => this.off(event, handler);
    }

    once(event: string, handler: Handler): () => void {
        const wrap: Handler = (p) => {
            this.off(event, wrap);
            handler(p);
        };
        return this.on(event, wrap);
    }

    off(event: string, handler?: Handler): void {
        if (!handler) {
            this.map.delete(event);
            return;
        }
        this.map.get(event)?.delete(handler as Handler<never>);
    }

    emit(event: string, payload?: unknown): void {
        // Copy to a snapshot so a handler that unsubscribes mid-dispatch is safe.
        const set = this.map.get(event);
        if (!set) return;
        [...set].forEach((h) => (h as Handler)(payload));
    }

    clear(): void {
        this.map.clear();
    }
}
