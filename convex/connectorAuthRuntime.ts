import { requestConnectorJson, type ConnectorRequest } from "./connectorProviderRuntime";

export type OAuthConnectorId = "google_workspace";
export type ConnectorOAuthServiceId =
  | "gmail"
  | "google_calendar"
  | "google_drive"
  | "google_docs"
  | "google_sheets";
export type ConnectorSetupProviderId = OAuthConnectorId | "github_app";

export type ConnectorSetupStatePayload = {
  workspaceId: string;
  providerId: ConnectorSetupProviderId;
  connectorIds: string[];
  nonce: string;
  issuedAt: number;
};

export type OAuthConnectorConfig = {
  connectorId: OAuthConnectorId;
  authorizationUrl: string;
  tokenUrl: string;
  defaultScopes: string[];
};

export const googleWorkspaceConnectorIds = [
  "gmail",
  "google_calendar",
  "google_drive",
  "google_docs",
  "google_sheets",
] as const;

export const apiKeyConnectorIds = ["vercel"] as const;
export type ApiKeyConnectorId = (typeof apiKeyConnectorIds)[number];

export const oauthConnectorConfigs: Record<OAuthConnectorId, OAuthConnectorConfig> = {
  google_workspace: {
    connectorId: "google_workspace",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    defaultScopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  },
};

const oauthScopeMap: Record<OAuthConnectorId, Record<string, string[]>> = {
  google_workspace: {
    "https://www.googleapis.com/auth/gmail.readonly": ["google.gmail.read"],
    "https://www.googleapis.com/auth/gmail.compose": ["google.gmail.compose"],
    "https://www.googleapis.com/auth/gmail.send": ["google.gmail.send"],
    "https://www.googleapis.com/auth/calendar.readonly": ["google.calendar.read"],
    "https://www.googleapis.com/auth/calendar.events": ["google.calendar.events"],
    "https://www.googleapis.com/auth/drive.readonly": ["google.drive.read"],
    "https://www.googleapis.com/auth/drive.metadata.readonly": ["google.drive.read"],
    "https://www.googleapis.com/auth/drive.file": ["google.drive.file"],
    "https://www.googleapis.com/auth/documents.readonly": ["google.docs.read"],
    "https://www.googleapis.com/auth/documents": ["google.docs.read", "google.docs.file"],
    "https://www.googleapis.com/auth/spreadsheets.readonly": ["google.sheets.read"],
    "https://www.googleapis.com/auth/spreadsheets": ["google.sheets.read", "google.sheets.write"],
  },
};

const providerDefaultInternalScopes: Record<OAuthConnectorId, string[]> = {
  google_workspace: Array.from(
    new Set(
      oauthConnectorConfigs.google_workspace.defaultScopes.flatMap((scope) =>
        oauthScopeMap.google_workspace[scope] ?? [],
      ),
    ),
  ),
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64UrlEncode(value: string | Uint8Array) {
  const base64 = typeof value === "string"
    ? btoa(unescape(encodeURIComponent(value)))
    : bytesToBase64(value);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return decodeURIComponent(escape(atob(padded)));
}

async function hmacSha256(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

export function randomConnectorSecret(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64UrlEncode(bytes);
}

export function oauthProviderForConnector(connectorId: string): OAuthConnectorId | undefined {
  if ((googleWorkspaceConnectorIds as readonly string[]).includes(connectorId)) return "google_workspace";
  return undefined;
}

export function connectorIdsForOAuthSetup(connectorId: string) {
  const providerId = oauthProviderForConnector(connectorId);
  if (providerId === "google_workspace") return [...googleWorkspaceConnectorIds];
  return [];
}

export function internalOAuthScopesForProvider(providerId: OAuthConnectorId, rawScope?: string) {
  const scopes = rawScope?.split(/\s+/).filter(Boolean);
  if (!scopes || scopes.length === 0) return providerDefaultInternalScopes[providerId];

  const mapped = scopes.flatMap((scope) => oauthScopeMap[providerId][scope] ?? []);
  return mapped.length > 0 ? Array.from(new Set(mapped)) : providerDefaultInternalScopes[providerId];
}

export async function createConnectorSetupState(
  payload: ConnectorSetupStatePayload,
  secret: string,
) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifyConnectorSetupState(args: {
  state: string;
  secret: string;
  now: number;
  maxAgeMs?: number;
}) {
  const [encodedPayload, signature, extra] = args.state.split(".");
  if (!encodedPayload || !signature || extra) {
    throw new Error("Connection setup expired. Start again from Settings.");
  }
  const expectedSignature = await hmacSha256(encodedPayload, args.secret);
  if (signature !== expectedSignature) {
    throw new Error("Connection setup expired. Start again from Settings.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as ConnectorSetupStatePayload;
  const maxAgeMs = args.maxAgeMs ?? 15 * 60 * 1000;
  if (!payload.workspaceId || !payload.providerId || !Array.isArray(payload.connectorIds)) {
    throw new Error("Connection setup expired. Start again from Settings.");
  }
  if (args.now - payload.issuedAt > maxAgeMs || payload.issuedAt - args.now > 60 * 1000) {
    throw new Error("Connection setup expired. Start again from Settings.");
  }
  return payload;
}

export async function createPkcePair(verifier = randomConnectorSecret(64)) {
  return {
    verifier,
    challenge: await sha256Base64Url(verifier),
    method: "S256" as const,
  };
}

export function buildOAuthAuthorizationUrl(args: {
  connectorId: OAuthConnectorId;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
  prompt?: "consent" | "select_account";
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
}) {
  const config = oauthConnectorConfigs[args.connectorId];
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", args.clientId.trim());
  url.searchParams.set("redirect_uri", args.redirectUri.trim());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (args.scopes ?? config.defaultScopes).join(" "));
  url.searchParams.set("state", args.state);
  if (args.connectorId === "google_workspace") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
  }
  if (args.prompt) url.searchParams.set("prompt", args.prompt);
  return url.toString();
}

export async function exchangeOAuthCode(args: {
  connectorId: OAuthConnectorId;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  request: ConnectorRequest;
  codeVerifier?: string;
}) {
  const config = oauthConnectorConfigs[args.connectorId];
  const body = new URLSearchParams({
    client_id: args.clientId,
    code: args.code,
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
  });

  body.set("client_secret", args.clientSecret);
  return await requestConnectorJson(args.request, config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

export async function refreshOAuthToken(args: {
  connectorId: OAuthConnectorId;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  request: ConnectorRequest;
}) {
  const config = oauthConnectorConfigs[args.connectorId];
  const body = new URLSearchParams({
    client_id: args.clientId,
    refresh_token: args.refreshToken,
    grant_type: "refresh_token",
  });

  body.set("client_secret", args.clientSecret);
  return await requestConnectorJson(args.request, config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

export type OAuthTokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  grantedScopes: string[];
};

function stringField(payload: Record<string, unknown>, field: string) {
  const value = payload[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseOAuthTokenResult(args: {
  connectorId: OAuthConnectorId;
  payload: unknown;
  now: number;
}): OAuthTokenResult {
  const source = args.payload && typeof args.payload === "object" && !Array.isArray(args.payload)
    ? args.payload as Record<string, unknown>
    : {};
  const accessToken = stringField(source, "access_token");
  if (!accessToken) {
    throw new Error("Connection setup expired. Start again from Settings.");
  }

  const expiresIn = typeof source.expires_in === "number" && Number.isFinite(source.expires_in)
    ? Math.max(0, source.expires_in)
    : undefined;

  return {
    accessToken,
    refreshToken: stringField(source, "refresh_token"),
    expiresAt: expiresIn === undefined ? undefined : args.now + expiresIn * 1000,
    grantedScopes: internalOAuthScopesForProvider(args.connectorId, stringField(source, "scope")),
  };
}

export function buildGitHubAppInstallUrl(args: {
  appName: string;
  state: string;
  targetId?: string;
}) {
  const url = new URL(`https://github.com/apps/${encodeURIComponent(args.appName.trim())}/installations/new`);
  url.searchParams.set("state", args.state);
  if (args.targetId) url.searchParams.set("target_id", args.targetId);
  return url.toString();
}
