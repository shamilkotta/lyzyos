import { useEffect, useMemo, useRef } from "react";

export type Debounced<T extends (...args: never[]) => void> = T & {
  flush: () => void;
  cancel: () => void;
};

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const run = () => {
    timer = null;
    if (lastArgs) fn(...lastArgs);
    lastArgs = null;
  };

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, ms);
  }) as Debounced<T>;

  debounced.flush = () => {
    if (timer) clearTimeout(timer);
    run();
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return debounced;
}

/**
 * Debounces `fn` for a component's lifetime: the timer is recreated when `fn` changes and any
 * pending call is flushed (not dropped) on change or unmount. Keep `fn` stable with useCallback.
 */
export function useDebouncedCallback(fn: () => void, ms: number) {
  const ref = useRef<Debounced<() => void> | null>(null);

  useEffect(() => {
    const debounced = debounce(fn, ms);
    ref.current = debounced;
    return () => debounced.flush();
  }, [fn, ms]);

  return useMemo(
    () => ({
      schedule: () => ref.current?.(),
      flush: () => ref.current?.flush(),
    }),
    [],
  );
}
