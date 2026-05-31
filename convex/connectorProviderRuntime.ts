import { safeConnectorError } from "./connectorRuntime";

export type ConnectorHttpResponse<T = unknown> = {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  json(): Promise<T>;
};

export type ConnectorRequest = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<ConnectorHttpResponse>;

export type ConnectorRetryOptions = {
  attempts?: number;
  retryStatuses?: number[];
};

export async function requestConnectorJson<T = unknown>(
  request: ConnectorRequest,
  input: string,
  init: Parameters<ConnectorRequest>[1] = {},
  options: ConnectorRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.min(5, options.attempts ?? 2));
  const retryStatuses = new Set(options.retryStatuses ?? [408, 429, 500, 502, 503, 504]);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await request(input, init);
      if (response.ok) return await response.json() as T;
      if (!retryStatuses.has(response.status) || attempt === attempts - 1) {
        throw new Error(`Connector request failed with status ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
    }
  }

  throw new Error(safeConnectorError(lastError));
}

export async function collectPaginatedConnectorResults<T>(args: {
  firstUrl: string;
  request: ConnectorRequest;
  readItems(payload: unknown): T[];
  readNextUrl(payload: unknown, response?: ConnectorHttpResponse): string | undefined;
  maxPages?: number;
}) {
  const items: T[] = [];
  let url: string | undefined = args.firstUrl;
  let cursor: string | undefined;
  const maxPages = Math.max(1, Math.min(args.maxPages ?? 10, 50));

  for (let page = 0; url && page < maxPages; page += 1) {
    const response = await args.request(url, { method: "GET" });
    if (!response.ok) throw new Error(`Connector request failed with status ${response.status}`);
    const payload = await response.json();
    items.push(...args.readItems(payload));
    url = args.readNextUrl(payload, response);
    cursor = url;
  }

  return { items, cursor };
}

export function connectorIdempotencyKey(parts: Array<string | number | undefined>) {
  const input = parts.filter((part) => part !== undefined && part !== "").join(":");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `founderos_${(hash >>> 0).toString(36).padStart(7, "0")}`;
}

export function providerAuthHeaders(kind: "bearer" | "basic", credential: string) {
  const clean = credential.trim();
  if (!clean) throw new Error("A private credential is required.");
  return kind === "bearer"
    ? { Authorization: `Bearer ${clean}` }
    : { Authorization: `Basic ${btoa(clean)}` };
}
