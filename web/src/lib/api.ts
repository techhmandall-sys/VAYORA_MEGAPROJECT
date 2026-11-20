// The one place the app talks to core-api, and to intel for an administrator's live
// what-if run. Every request carries the session token and every failure becomes an
// ApiError with a message fit to show.

const BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/v1`;
const INTEL = import.meta.env.VITE_INTEL_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let token: string | null = null;
let onUnauthorized: () => void = () => {};

export function setToken(value: string | null): void {
  token = value;
}

/** The session token, for the one other thing that needs it: the live connection. */
export function getToken(): string | null {
  return token;
}

/** Called when the server rejects the session token, so the app can sign the user out. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const response = await send(path, options);
  // An empty body is nothing, whatever the status: core-api answers some actions with
  // 201 Created and no body, not only 204.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Asks intel, with the session token. Only core-api decides whether a session is still
 * good, so a refusal from intel never signs anyone out.
 */
export async function intel<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  return (await (await send(path, options, INTEL, false)).json()) as T;
}

/**
 * Fetches a file with the session token and hands it to the browser to save. A plain link
 * cannot do this: it would go without the token.
 */
export async function download(path: string, filename: string): Promise<void> {
  const blob = await (await send(path, {})).blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A photo or other file the server keeps, or null if there is none. */
export async function fetchFile(path: string): Promise<Blob | null> {
  try {
    const response = await send(path, {});
    // 204: nothing there yet, such as a member with no photo.
    if (response.status === 204) return null;
    return await response.blob();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

async function send(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> },
  base = BASE,
  ownsSession = true,
): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers };
  // A file goes as itself; anything else as JSON.
  const file = options.body instanceof Blob ? options.body : null;
  if (file) headers['Content-Type'] = file.type || 'application/octet-stream';
  else if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const sentToken = token;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: file ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  // Only if the rejected token is still the session's: a slow answer to a request made
  // by an earlier session must not sign out the one that replaced it.
  if (ownsSession && response.status === 401 && sentToken && sentToken === token) onUnauthorized();
  if (!response.ok) throw new ApiError(response.status, await problemDetail(response));
  return response;
}

// core-api answers errors with an RFC 7807 problem document; intel with FastAPI's
// `detail`, which for a malformed request is a list rather than a sentence.
async function problemDetail(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as { detail?: unknown; title?: string };
    const detail = typeof problem.detail === 'string' ? problem.detail : undefined;
    return detail ?? problem.title ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}
