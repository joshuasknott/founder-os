import { betterAuth } from "better-auth";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

// 1. Correctly initialize the client from the root package
export const authComponent = createClient<DataModel>(components.betterAuth);

// 2. Wrap initialization in a function that receives the Convex 'ctx'
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    database: authComponent.adapter(ctx), // Passes context to the adapter
    emailAndPassword: {
      enabled: true,
    },
    plugins: [convex({ authConfig })],
    // Social providers can be added here later
  });
};

export const { getAuthUser } = authComponent.clientApi();
