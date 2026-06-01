/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as ai from "../ai.js";
import type * as approvals from "../approvals.js";
import type * as artifacts from "../artifacts.js";
import type * as audit from "../audit.js";
import type * as authz from "../authz.js";
import type * as automations from "../automations.js";
import type * as chat from "../chat.js";
import type * as commandCenter from "../commandCenter.js";
import type * as connectorAuthRuntime from "../connectorAuthRuntime.js";
import type * as connectorContent from "../connectorContent.js";
import type * as connectorProviderRuntime from "../connectorProviderRuntime.js";
import type * as connectorRuntime from "../connectorRuntime.js";
import type * as connectors from "../connectors.js";
import type * as crons from "../crons.js";
import type * as deploymentRuntime from "../deploymentRuntime.js";
import type * as directives from "../directives.js";
import type * as githubRuntime from "../githubRuntime.js";
import type * as googleWorkspaceRuntime from "../googleWorkspaceRuntime.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as integrations from "../integrations.js";
import type * as intelligence from "../intelligence.js";
import type * as itemAi from "../itemAi.js";
import type * as itemModel from "../itemModel.js";
import type * as itemValidators from "../itemValidators.js";
import type * as items from "../items.js";
import type * as memory from "../memory.js";
import type * as modelProfiles from "../modelProfiles.js";
import type * as projects from "../projects.js";
import type * as search from "../search.js";
import type * as seedRoster from "../seedRoster.js";
import type * as stripeConnector from "../stripeConnector.js";
import type * as swarm from "../swarm.js";
import type * as system from "../system.js";
import type * as taskRuntime from "../taskRuntime.js";
import type * as telemetry from "../telemetry.js";
import type * as users from "../users.js";
import type * as workRuns from "../workRuns.js";
import type * as workflows from "../workflows.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  ai: typeof ai;
  approvals: typeof approvals;
  artifacts: typeof artifacts;
  audit: typeof audit;
  authz: typeof authz;
  automations: typeof automations;
  chat: typeof chat;
  commandCenter: typeof commandCenter;
  connectorAuthRuntime: typeof connectorAuthRuntime;
  connectorContent: typeof connectorContent;
  connectorProviderRuntime: typeof connectorProviderRuntime;
  connectorRuntime: typeof connectorRuntime;
  connectors: typeof connectors;
  crons: typeof crons;
  deploymentRuntime: typeof deploymentRuntime;
  directives: typeof directives;
  githubRuntime: typeof githubRuntime;
  googleWorkspaceRuntime: typeof googleWorkspaceRuntime;
  http: typeof http;
  init: typeof init;
  integrations: typeof integrations;
  intelligence: typeof intelligence;
  itemAi: typeof itemAi;
  itemModel: typeof itemModel;
  itemValidators: typeof itemValidators;
  items: typeof items;
  memory: typeof memory;
  modelProfiles: typeof modelProfiles;
  projects: typeof projects;
  search: typeof search;
  seedRoster: typeof seedRoster;
  stripeConnector: typeof stripeConnector;
  swarm: typeof swarm;
  system: typeof system;
  taskRuntime: typeof taskRuntime;
  telemetry: typeof telemetry;
  users: typeof users;
  workRuns: typeof workRuns;
  workflows: typeof workflows;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
