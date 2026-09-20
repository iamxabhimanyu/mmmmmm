/**
 * Fetch Utilities with Timeout and Sanitization
 * Used by MAUSAM weather providers to ensure deterministic network bounds.
 */

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = 8000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  let finalInput = input;
  if (typeof input === 'string' && input.startsWith('/')) {
    if (typeof window === 'undefined') {
      const baseUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
      finalInput = `${baseUrl}${input}`;
    }
  }

  try {
    let signal: AbortSignal = controller.signal;

    if (init?.signal) {
      const userSignal = init.signal;
      if (userSignal.aborted) {
        controller.abort();
      } else {
        userSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    const response = await fetch(finalInput, {
      ...init,
      signal,
    });
    return response;
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}
