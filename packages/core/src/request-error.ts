/**
 * Thrown when a request fails and the server supplied no displayable message.
 *
 * The distinction matters for translation. A server-supplied message (the API's
 * JSON `error` field) is specific and worth showing verbatim — that is what
 * surfaces a real fault like a database outage. A generic client-side "request
 * failed" string carries no extra information, and hardcoding it in English
 * would leak untranslated text into a localized UI. So generic failures throw
 * this type, whose message exists only for logs, and the UI substitutes its own
 * localized text via `displayError`.
 */
export class GenericRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GenericRequestError";
    this.status = status;
  }
}

/**
 * Picks what to show the user: a server-supplied message when there is one,
 * otherwise the caller's localized fallback.
 */
export function displayError(error: unknown, fallback: string): string {
  if (error instanceof GenericRequestError) return fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
