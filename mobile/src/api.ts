// core-api over HTTP, as the web app calls it: a bearer token, JSON both ways, and errors as the
// problem document's `detail`, which is written to be shown to a person.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The web app's own words for an unreachable server, so they come out translated. */
export const CANNOT_REACH = 'Cannot reach the server. Check your connection and try again.';

interface Config {
  base: string;
  token: string | null;
  onUnauthorized: () => void;
}

const config: Config = { base: '', token: null, onUnauthorized: () => undefined };

export function configureApi(next: Partial<Config>): void {
  Object.assign(config, next);
}

type Query = Record<string, string | number | boolean | null | undefined>;

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query; headers?: Record<string, string> } = {},
): Promise<T> {
  if (!config.base) throw new ApiError(0, CANNOT_REACH);
  const query = options.query
    ? '?' +
      Object.entries(options.query)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')
    : '';
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const sentToken = config.token;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(`${config.base}/api/v1${path}${query}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, CANNOT_REACH);
  } finally {
    clearTimeout(timer);
  }

  // A token refused now ends the session it belongs to, not a newer one.
  if (response.status === 401 && sentToken && sentToken === config.token) config.onUnauthorized();
  if (!response.ok) throw new ApiError(response.status, await problemText(response));
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function problemText(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as { detail?: unknown; title?: string };
    if (typeof problem.detail === 'string') return problem.detail;
    if (problem.title) return problem.title;
  } catch {
    // Not a problem document: fall through to the status.
  }
  return `Request failed (${response.status})`;
}

/** A message from anything thrown, for a notice on screen. */
export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A key that makes a retried booking return the first booking instead of making another. */
export const idempotencyKey = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
