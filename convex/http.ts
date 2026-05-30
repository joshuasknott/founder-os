import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { httpAction } from "./_generated/server";
import { v } from "convex/values";
import { authComponent, createAuth } from "./auth";

// =========================================================================
// HMAC SIGNATURE VALIDATION (Doc 7 §3)
//
// Cryptographically validates that incoming webhook payloads are genuine.
// Uses Web Crypto API (available in Convex runtime) with constant-time
// comparison to prevent timing attacks.
// =========================================================================

async function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  const computedHex =
    "sha256=" +
    Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Constant-time comparison
  if (computedHex.length !== signature.length) return false;

  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// =========================================================================
// HELPER: Log a webhook event to observabilityLogs
// (httpActions cannot use ctx.scheduler, so we use ctx.runMutation)
// =========================================================================

export const logWebhookEvent = internalMutation({
  args: {
    source: v.string(),
    eventType: v.string(),
    title: v.string(),
    summary: v.string(),
    branch: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const status =
      args.eventType === "workflow_run"
        ? "building"
        : args.eventType === "check_run"
          ? "ready"
          : "received";

    await ctx.db.insert("buildActivities", {
      source: args.source,
      title: args.title,
      summary: args.summary,
      status,
      branch: args.branch,
      commitSha: args.commitSha,
      previewUrl: args.previewUrl,
      createdAt: Date.now(),
    });
  },
});

// =========================================================================
// HTTP ROUTER — Secure Webhook Endpoints
// =========================================================================

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// -------------------------------------------------------------------------
// POST /webhooks/github
// Validates the GitHub webhook HMAC signature before processing the event.
// -------------------------------------------------------------------------
http.route({
  path: "/webhooks/github",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // 1. Read the raw body
    const body = await request.text();

    // 2. Extract the GitHub signature header
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return new Response("Missing signature header", { status: 401 });
    }

    // 3. Validate HMAC signature
    const isValid = await verifySignature(body, signature, secret);
    if (!isValid) {
      return new Response("Invalid signature", { status: 403 });
    }

    // 4. Parse the payload and log the event
    const payload = JSON.parse(body);
    const eventType = request.headers.get("x-github-event") ?? "unknown";

    await ctx.runMutation(internal.http.logWebhookEvent, {
      source: "github",
      eventType,
      title: `${payload.repository?.full_name ?? "Repository"} ${eventType}`,
      summary: `${payload.sender?.login ?? "GitHub"} sent ${payload.action ?? eventType}.`,
      branch: payload.ref?.replace("refs/heads/", "") ?? payload.workflow_run?.head_branch,
      commitSha: payload.after ?? payload.workflow_run?.head_sha ?? payload.check_run?.head_sha,
      previewUrl: payload.deployment_status?.target_url,
    });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
