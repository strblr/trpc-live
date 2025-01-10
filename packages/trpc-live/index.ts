import stringify from "fast-json-stable-stringify";

type MaybePromise<T> = Promise<T> | T;

interface ProcedureResolverOptionsLike {
  signal?: AbortSignal;
}

export interface LiveOptions<TOpts extends ProcedureResolverOptionsLike, T> {
  key: string | string[] | ((opts: TOpts) => string | string[]);
  resolver: (opts: TOpts) => MaybePromise<T>;
}

export class InMemoryLiveStore {
  private store: Map<string, Set<() => void>> = new Map();

  count(key: string | string[]) {
    const keys = castArray(key);
    return keys.reduce((acc, key) => acc + (this.store.get(key)?.size ?? 0), 0);
  }

  invalidate(key: string | string[]) {
    const keys = castArray(key);
    for (const key of keys) {
      this.store.get(key)?.forEach(fn => fn());
    }
  }

  private subscribe(keys: string[], fn: () => void) {
    for (const key of keys) {
      const subscribers = this.store.get(key) || new Set();
      subscribers.add(fn);
      this.store.set(key, subscribers);
    }
  }

  private unsubscribe(keys: string[], fn: () => void) {
    for (const key of keys) {
      const subscribers = this.store.get(key);
      if (subscribers) {
        subscribers.delete(fn);
        if (subscribers.size === 0) {
          this.store.delete(key);
        }
      }
    }
  }

  live<TOpts extends ProcedureResolverOptionsLike, T>({
    key,
    resolver
  }: LiveOptions<TOpts, T>) {
    const store = this;

    return async function* (opts: TOpts) {
      const keys = castArray(typeof key === "function" ? key(opts) : key);
      let triggerNext = () => {};
      let triggerExit = () => {};
      let invalidationPromise = Promise.resolve();

      function resetPromise() {
        invalidationPromise = new Promise((resolve, reject) => {
          triggerNext = resolve;
          triggerExit = reject;
        });
      }

      function invalidate() {
        triggerNext();
      }

      function abort() {
        triggerExit();
      }

      opts.signal?.addEventListener("abort", abort);
      store.subscribe(keys, invalidate);

      try {
        yield resolver(opts);
        while (!opts.signal?.aborted) {
          resetPromise();
          await invalidationPromise;
          yield resolver(opts);
        }
      } finally {
        store.unsubscribe(keys, invalidate);
        opts.signal?.removeEventListener("abort", abort);
      }
    };
  }
}

function castArray<T>(value: T | T[]) {
  return Array.isArray(value) ? value : [value];
}

export function key(...args: any[]) {
  return stringify(args);
}
