import { httpRouter } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { v } from "convex/values";

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
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    // Route through the sanitized telemetry writer (not direct insert)
    await ctx.scheduler.runAfter(0, internal.telemetry.logEvent, {
      traceId: "webhook_ingest" as any,
      actor: `external: ${args.source}`,
      eventType: "TOOL_INVOCATION" as const,
      rawPayload: {
        source: args.source,
        eventType: args.eventType,
        payload: args.payload,
      },
    });
  },
});

// =========================================================================
// HTTP ROUTER — Secure Webhook Endpoints
// =========================================================================

const http = httpRouter();

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
      payload: JSON.stringify({
        action: payload.action ?? "unknown",
        repository: payload.repository?.full_name ?? "unknown",
        sender: payload.sender?.login ?? "unknown",
        event: eventType,
      }),
    });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
