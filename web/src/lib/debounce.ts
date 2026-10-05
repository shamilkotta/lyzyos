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
