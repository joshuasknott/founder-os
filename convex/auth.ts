import { betterAuth } from "better-auth";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

// 1. Correctly initialize the client from the root package
export const authComponent = createClient<DataModel>(components.betterAuth);

// 2. Wrap initialization in a function that receives the Convex 'ctx'
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const configuredOrigins = [
    process.env.BETTER_AUTH_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ].filter((origin): origin is string => Boolean(origin));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return betterAuth({
    database: authComponent.adapter(ctx), // Passes context to the adapter
    trustedOrigins: configuredOrigins,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : undefined,
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    plugins: [convex({ authConfig }), crossDomain({ siteUrl })],
  });
};

export const { getAuthUser } = authComponent.clientApi();
