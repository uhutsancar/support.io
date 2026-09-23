// Loading, failing and retrying — once, instead of in every page.
//
// Sixteen pages carried the same shape by hand:
//
//     const [loading, setLoading] = useState(true);
//     const fetchX = async () => {
//       try { setLoading(true); setX((await api.getAll()).data); }
//       catch (error) { }                       // <- and 30 of these were empty
//       finally { setLoading(false); }
//     };
//     useEffect(() => { fetchX(); }, []);
//
// Three things went wrong with that pattern here, every time:
//
//   * The catch was usually empty, so a failed request left the page showing an
//     empty list that is indistinguishable from "you have no sites yet".
//   * Nothing cancelled the request, so a component unmounted mid-flight called
//     setState on a dead component.
//   * `loading` started `true` and was only cleared in `finally`, so a page that
//     threw before the try block span forever.
//
// The hooks below fix all three in one place.

import { useCallback, useEffect, useRef, useState } from 'react';

/** What a caller gets back: the data, whether it is in flight, and why it failed. */
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  /** The message to show the user, or null when the last run succeeded. */
  error: string | null;
}

export interface AsyncResource<T> extends AsyncState<T> {
  /** Runs the loader again — for a retry button, or after a mutation. */
  reload: () => Promise<void>;
  /** Replaces the data locally, for an optimistic update. */
  setData: (update: T | ((current: T) => T)) => void;
}

/**
 * The message to show for a failed request.
 *
 * The API answers with `{ error, code }` (see backend/src/http/errors.ts), so
 * that is preferred; the fallback is only for a network failure, where there is
 * no response at all.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: { error?: unknown; message?: unknown } } })
      .response;
    const fromBody = response?.data?.error ?? response?.data?.message;
    if (typeof fromBody === 'string' && fromBody) return fromBody;
  }
  return fallback;
}

/**
 * Loads something when the component mounts, and again when `deps` change.
 *
 * `load` receives an AbortSignal; pass it to the request so an in-flight call
 * is cancelled when the component unmounts or the dependencies change. Even
 * when it is ignored, the result of a superseded run is discarded rather than
 * written to state.
 *
 *     const sites = useAsync(() => sitesAPI.getAll().then((r) => r.data.sites), [], {
 *       initial: [],
 *       fallbackMessage: t('sites.loadError')
 *     });
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { initial: T; fallbackMessage: string }
): AsyncResource<T> {
  const { initial, fallbackMessage } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: initial,
    loading: true,
    error: null
  });

  // The loader and the fallback message are held in refs so that an inline
  // arrow function — which is a new value on every render — does not restart
  // the request. They are written in an effect rather than during render:
  // React may render without committing, and a ref written during such a
  // render would be left holding a value that never became current.
  //
  // This effect is declared before the one that runs the loader, and effects
  // fire in declaration order, so the ref is always up to date first.
  const loadRef = useRef(load);
  const fallbackRef = useRef(fallbackMessage);
  useEffect(() => {
    loadRef.current = load;
    fallbackRef.current = fallbackMessage;
  });

  /** Counts runs so only the newest one is allowed to write state. */
  const runId = useRef(0);

  const run = useCallback(async (signal: AbortSignal) => {
    const id = ++runId.current;
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const data = await loadRef.current(signal);
      if (id !== runId.current || signal.aborted) return;
      setState({ data, loading: false, error: null });
    } catch (error) {
      if (id !== runId.current || signal.aborted) return;
      // The failure is kept, not swallowed: the page can show it, and the
      // developer console still gets the original.
      console.error('[useAsync] request failed', error);
      setState((current) => ({
        ...current,
        loading: false,
        error: errorMessage(error, fallbackRef.current)
      }));
    }
  }, []);

  // `deps` is the caller's own dependency list, so it cannot be an array
  // literal here and the rule cannot verify it. `run` is stable (useCallback
  // with no dependencies), so it is deliberately not part of it.
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => {
    const controller = new AbortController();
    void run(controller.signal);
    return () => controller.abort();
  }, deps);

  const reload = useCallback(async () => {
    const controller = new AbortController();
    await run(controller.signal);
  }, [run]);

  const setData = useCallback((update: T | ((current: T) => T)) => {
    setState((current) => ({
      ...current,
      data: typeof update === 'function' ? (update as (c: T) => T)(current.data) : update
    }));
  }, []);

  return { ...state, reload, setData };
}

/**
 * An action the user triggers — save, delete, invite — with its own pending flag.
 *
 * Returns the runner and whether it is in flight, so a submit button can
 * disable itself without the page keeping a second `saving` state of its own.
 *
 * A failure is reported through `onError` and the runner resolves to
 * `undefined`, so the caller checks the result rather than wrapping the call in
 * another try/catch — which is how the empty catches accumulated in the first
 * place.
 */
export function useAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: {
    onError: (message: string) => void;
    fallbackMessage: string;
    onSuccess?: (result: TResult) => void;
  }
): { run: (...args: TArgs) => Promise<TResult | undefined>; pending: boolean } {
  const [pending, setPending] = useState(false);

  // Written in an effect, not during render; see the note in `useAsync`.
  const optionsRef = useRef(options);
  const actionRef = useRef(action);
  useEffect(() => {
    optionsRef.current = options;
    actionRef.current = action;
  });

  const run = useCallback(async (...args: TArgs) => {
    setPending(true);
    try {
      const result = await actionRef.current(...args);
      optionsRef.current.onSuccess?.(result);
      return result;
    } catch (error) {
      console.error('[useAction] failed', error);
      optionsRef.current.onError(errorMessage(error, optionsRef.current.fallbackMessage));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending };
}
