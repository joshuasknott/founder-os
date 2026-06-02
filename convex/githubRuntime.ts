import { requestConnectorJson, type ConnectorRequest } from "./connectorProviderRuntime";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const MAX_REPOSITORY_FILES = 80;
const MAX_README_CHARS = 6000;

export type GitHubRepositorySettings = {
  installationId?: string;
  repositoryOwner?: string;
  repositoryName?: string;
  organizationName?: string;
};

export type GitHubRepositoryImport = {
  externalId: string;
  externalType: "repository";
  title: string;
  summary: string;
  content: string;
  sourceUrl?: string;
  authorName: string;
  tags: string[];
  sourceName: string;
  externalUpdatedAt?: number;
  metadata: {
    owner: string;
    name: string;
    defaultBranch?: string;
    fileCount: number;
  };
};

type GitHubInstallationTokenResponse = {
  token?: string;
  expires_at?: string;
};

type GitHubRepositoryResponse = {
  full_name?: string;
  name?: string;
  description?: string | null;
  html_url?: string;
  default_branch?: string;
  pushed_at?: string;
  updated_at?: string;
  language?: string | null;
  visibility?: string;
  topics?: string[];
};

type GitHubReadmeResponse = {
  content?: string;
  encoding?: string;
  html_url?: string;
  name?: string;
};

type GitHubTreeResponse = {
  tree?: Array<{
    path?: string;
    type?: string;
    size?: number;
  }>;
  truncated?: boolean;
};

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/https?:\/\/\S+/gi, "external link")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(ghp|ghs|github_pat|sk|pk|rk|ya29)[-._A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, "private detail")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function cleanMarkdown(value: unknown, maxLength = MAX_README_CHARS) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(ghp|ghs|github_pat|sk|pk|rk|ya29)[-._A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\b[A-Za-z0-9+/]{48,}={0,2}\b/g, "private detail")
    .trim()
    .slice(0, maxLength);
}

function base64UrlEncode(value: string | Uint8Array) {
  const base64 = typeof value === "string"
    ? btoa(unescape(encodeURIComponent(value)))
    : bytesToBase64(value);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(...chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function derLength(length: number) {
  if (length < 0x80) return new Uint8Array([length]);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, value: Uint8Array) {
  return concatBytes(new Uint8Array([tag]), derLength(value.length), value);
}

function pkcs1ToPkcs8(pkcs1: Uint8Array) {
  const version = der(0x02, new Uint8Array([0x00]));
  const rsaEncryptionOid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);
  const nullParams = new Uint8Array([0x05, 0x00]);
  const algorithm = der(0x30, concatBytes(rsaEncryptionOid, nullParams));
  const privateKey = der(0x04, pkcs1);
  return der(0x30, concatBytes(version, algorithm, privateKey));
}

function privateKeyDerFromPem(privateKey: string) {
  const normalized = privateKey.replace(/\\n/g, "\n").trim();
  const isPkcs1 = normalized.includes("BEGIN RSA PRIVATE KEY");
  const body = normalized
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("GitHub import is not configured yet.");
  const derBytes = base64ToBytes(body);
  return isPkcs1 ? pkcs1ToPkcs8(derBytes) : derBytes;
}

async function signGitHubJwt(args: {
  appId: string;
  privateKey: string;
  now?: number;
}) {
  const issuedAt = Math.floor((args.now ?? Date.now()) / 1000) - 60;
  const payload = {
    iat: issuedAt,
    exp: issuedAt + 9 * 60,
    iss: args.appId.trim(),
  };
  const unsigned = [
    base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64UrlEncode(JSON.stringify(payload)),
  ].join(".");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyDerFromPem(args.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function githubUrl(pathname: string) {
  return new URL(pathname, GITHUB_API_BASE).toString();
}

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "FounderOS",
  };
}

function decodeGitHubContent(value?: string, encoding?: string) {
  if (!value || encoding !== "base64") return "";
  try {
    const binary = atob(value.replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function cleanRepositoryPart(value: unknown) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().replace(/^\/+|\/+$/g, "");
  return /^[A-Za-z0-9_.-]+$/.test(cleaned) ? cleaned : undefined;
}

export function normalizeGitHubRepositorySettings(settings: GitHubRepositorySettings) {
  const owner = cleanRepositoryPart(settings.repositoryOwner ?? settings.organizationName);
  const name = cleanRepositoryPart(settings.repositoryName);
  const installationId = cleanRepositoryPart(settings.installationId);
  if (!installationId) throw new Error("Install GitHub before importing repository context.");
  if (!owner || !name) throw new Error("Choose the repository before importing GitHub context.");
  return { installationId, owner, name };
}

function shouldKeepTreePath(path: string) {
  if (
    /(^|\/)(\.git|node_modules|dist|build|coverage|\.next|out|vendor|tmp|temp)\//i.test(path) ||
    /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|mp4|mov|woff2?)$/i.test(path)
  ) {
    return false;
  }
  return true;
}

function summarizeTree(tree: NonNullable<GitHubTreeResponse["tree"]>) {
  return tree
    .filter((entry) => entry.type === "blob" && entry.path && shouldKeepTreePath(entry.path))
    .slice(0, MAX_REPOSITORY_FILES)
    .map((entry) => {
      const size = typeof entry.size === "number" ? ` (${entry.size} bytes)` : "";
      return `- ${entry.path}${size}`;
    });
}

export async function createGitHubInstallationToken(args: {
  appId?: string;
  privateKey?: string;
  installationId: string;
  request: ConnectorRequest;
}) {
  const appId = args.appId?.trim();
  const privateKey = args.privateKey?.trim();
  if (!appId || !privateKey) {
    throw new Error("GitHub import is not configured yet.");
  }

  const jwt = await signGitHubJwt({ appId, privateKey });
  const result = await requestConnectorJson<GitHubInstallationTokenResponse>(
    args.request,
    githubUrl(`/app/installations/${encodeURIComponent(args.installationId)}/access_tokens`),
    {
      method: "POST",
      headers: githubHeaders(jwt),
    },
  );
  if (!result.token) throw new Error("GitHub did not confirm repository access.");
  return result.token;
}

export async function fetchGitHubRepositoryContext(args: {
  appId?: string;
  privateKey?: string;
  installationId: string;
  repositoryOwner: string;
  repositoryName: string;
  request: ConnectorRequest;
}): Promise<GitHubRepositoryImport> {
  const token = await createGitHubInstallationToken({
    appId: args.appId,
    privateKey: args.privateKey,
    installationId: args.installationId,
    request: args.request,
  });
  const owner = encodeURIComponent(args.repositoryOwner);
  const name = encodeURIComponent(args.repositoryName);
  const repo = await requestConnectorJson<GitHubRepositoryResponse>(
    args.request,
    githubUrl(`/repos/${owner}/${name}`),
    { method: "GET", headers: githubHeaders(token) },
  );
  const defaultBranch = cleanString(repo.default_branch, 120);

  let readme: GitHubReadmeResponse | undefined;
  try {
    readme = await requestConnectorJson<GitHubReadmeResponse>(
      args.request,
      githubUrl(`/repos/${owner}/${name}/readme`),
      { method: "GET", headers: githubHeaders(token) },
    );
  } catch {
    readme = undefined;
  }

  let treeLines: string[] = [];
  if (defaultBranch) {
    try {
      const tree = await requestConnectorJson<GitHubTreeResponse>(
        args.request,
        githubUrl(`/repos/${owner}/${name}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`),
        { method: "GET", headers: githubHeaders(token) },
      );
      treeLines = summarizeTree(tree.tree ?? []);
    } catch {
      treeLines = [];
    }
  }

  const fullName = cleanString(repo.full_name, 180) ?? `${args.repositoryOwner}/${args.repositoryName}`;
  const description = cleanString(repo.description, 280);
  const readmeText = cleanMarkdown(decodeGitHubContent(readme?.content, readme?.encoding));
  const topics = (repo.topics ?? []).map((topic) => cleanString(topic, 40)).filter(Boolean) as string[];
  const updatedAt = Date.parse(repo.pushed_at ?? repo.updated_at ?? "");
  const summary = description
    ? `Repository context imported from GitHub: ${description}`
    : "Repository context imported from GitHub.";
  const content = [
    `# ${fullName}`,
    description ? `\n${description}` : undefined,
    defaultBranch ? `\nDefault branch: ${defaultBranch}` : undefined,
    repo.language ? `Primary language: ${cleanString(repo.language, 80)}` : undefined,
    repo.visibility ? `Visibility: ${cleanString(repo.visibility, 40)}` : undefined,
    topics.length > 0 ? `Topics: ${topics.join(", ")}` : undefined,
    treeLines.length > 0 ? `\n## Repository files\n${treeLines.join("\n")}` : undefined,
    readmeText ? `\n## README preview\n${readmeText}` : undefined,
  ].filter(Boolean).join("\n");

  return {
    externalId: fullName,
    externalType: "repository",
    title: `Repository context: ${fullName}`,
    summary,
    content,
    sourceUrl: repo.html_url ?? readme?.html_url,
    authorName: "GitHub",
    tags: ["repository", "opencode", ...topics],
    sourceName: fullName,
    externalUpdatedAt: Number.isNaN(updatedAt) ? undefined : updatedAt,
    metadata: {
      owner: args.repositoryOwner,
      name: args.repositoryName,
      defaultBranch,
      fileCount: treeLines.length,
    },
  };
}
