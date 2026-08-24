/**
 * The single place the API clients reach the network.
 *
 * On the web every request is same-origin, so a relative path like
 * `/api/user/children` is all that is needed and the browser supplies both the
 * origin and the Clerk session cookie. Neither is true on a native client: there
 * is no origin to be relative to, and there is no cookie jar — the session
 * arrives as a bearer token instead.
 *
 * Rather than teach every client about that, they all call `apiFetch` and a
 * platform configures it once at startup. The web configures nothing, so its
 * behaviour is byte-for-byte what it was before this indirection existed.
 */

let baseUrl = "";
let headerProvider: (() => Promise<HeadersInit> | HeadersInit) | null = null;

/**
 * Absolute origin to prefix onto every API path, e.g.
 * "https://notch.app". Leave unset on the web.
 */
export function configureApiBaseUrl(url: string): void {
  baseUrl = url.replace(/\/+$/, "");
}

/**
 * Supplies headers for every request — on native, the Clerk bearer token.
 * Called per request rather than once, so a refreshed token is picked up
 * without reconfiguring.
 */
export function configureApiHeaders(
  provider: () => Promise<HeadersInit> | HeadersInit,
): void {
  headerProvider = provider;
}

/** Resolves an API path against the configured base. */
export function apiUrl(path: string): string {
  return `${baseUrl}${path}`;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const provided = headerProvider ? await headerProvider() : undefined;

  return fetch(apiUrl(path), {
    ...init,
    headers: { ...(provided ?? {}), ...(init.headers ?? {}) },
  });
}
