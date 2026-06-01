import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenCodeArgs,
  builderProviderHelp,
  isFreeOpenCodeModel,
  isLlmBuilderProvider,
  opencodeModelForProfile,
  selectOpenCodeModelForRun,
  selectBuilderAgent,
} from "../workers/builder/agentAdapters.mjs";

test("builder agent selection prefers explicit opencode without exposing Codex defaults", () => {
  const selected = selectBuilderAgent({
    BUILDER_PROVIDER: "opencode",
    BUILDER_OPENCODE_MODEL: "openrouter/deepseek/deepseek-chat",
    BUILDER_OPENCODE_AGENT: "founderos-builder",
  });

  assert.equal(selected.adapter, "opencode");
  assert.equal(selected.provider, "opencode");
  assert.equal(selected.command, "opencode");
  assert.equal(selected.model, "openrouter/deepseek/deepseek-chat");
  assert.equal(selected.agent, "founderos-builder");
  assert.equal(selected.displayName, "FounderOS builder");
});

test("builder agent selection maps cheaper chat providers to compatible endpoints", () => {
  const deepseek = selectBuilderAgent({
    BUILDER_PROVIDER: "deepseek",
    DEEPSEEK_API_KEY: "key",
  });
  assert.equal(deepseek.adapter, "llm");
  assert.equal(deepseek.model, "deepseek-chat");
  assert.equal(deepseek.chatCompletionsUrl, "https://api.deepseek.com/chat/completions");

  const openrouter = selectBuilderAgent({
    BUILDER_PROVIDER: "openrouter",
    OPENROUTER_API_KEY: "key",
    OPENROUTER_MODEL: "z-ai/glm-4.5",
  });
  assert.equal(openrouter.adapter, "llm");
  assert.equal(openrouter.model, "z-ai/glm-4.5");
  assert.equal(openrouter.chatCompletionsUrl, "https://openrouter.ai/api/v1/chat/completions");
  assert.deepEqual(openrouter.apiKeyEnvNames, ["BUILDER_LLM_API_KEY", "OPENROUTER_API_KEY"]);

  assert.equal(isLlmBuilderProvider("z.ai"), true);
});

test("builder agent selection preserves local simulation as the safe default", () => {
  const selected = selectBuilderAgent({});

  assert.equal(selected.adapter, "simulated");
  assert.equal(selected.isRealBuilder, false);
  assert.equal(builderProviderHelp("unknown").includes("BUILDER_PROVIDER"), true);
});

test("opencode args run in the isolated workspace and never auto-approve permissions", () => {
  const agent = selectBuilderAgent({
    BUILDER_PROVIDER: "opencode",
    BUILDER_OPENCODE_MODEL: "deepseek/deepseek-chat",
  });
  const args = buildOpenCodeArgs(agent, "Build the preview", "C:/tmp/founderos-run", "Booking tool");

  assert.deepEqual(args.slice(0, 3), ["run", "--dir", "C:/tmp/founderos-run"]);
  assert.equal(args.includes("--title"), true);
  assert.equal(args.includes("--dangerously-skip-permissions"), false);
  assert.equal(args.includes("--model"), true);
  assert.equal(args.at(-1), "Build the preview");
});

test("opencode auto leaves model choice to opencode and manual tiers can pin models", () => {
  const settings = {
    model: "fallback/model",
    modelLow: "fast/model",
    modelHigh: "reasoning/model",
  };

  assert.equal(opencodeModelForProfile(settings, "auto"), undefined);
  assert.equal(opencodeModelForProfile(settings, "low"), "fast/model");
  assert.equal(opencodeModelForProfile(settings, "medium"), "fallback/model");
  assert.equal(opencodeModelForProfile(settings, "high"), "reasoning/model");
});

test("hidden builder route selects glm-5.1 for coding work", () => {
  const selected = selectOpenCodeModelForRun({
    run: {
      kind: "code_preview",
      title: "Booking tool",
    },
    directive: {
      objective: "Build a private booking tool preview",
    },
    env: {},
  });

  assert.equal(selected.model, "zai-coding-plan/glm-5.1");
  assert.equal(selected.outputContract, "code_changes");
  assert.equal(selected.verifierModel, "zai-coding-plan/glm-5-turbo");
});

test("hidden builder route blocks free opencode models for private work", () => {
  const selected = selectOpenCodeModelForRun({
    run: {
      kind: "code_preview",
      title: "Revenue dashboard",
    },
    directive: {
      objective: "Build a dashboard using revenue and customer data",
    },
    env: {
      BUILDER_OPENCODE_MODEL: "opencode/deepseek-v4-flash-free",
    },
  });

  assert.equal(isFreeOpenCodeModel("opencode/deepseek-v4-flash-free"), true);
  assert.equal(selected.requestedModel, "opencode/deepseek-v4-flash-free");
  assert.equal(selected.model, "zai-coding-plan/glm-5.1");
  assert.equal(selected.freeRouteBlocked, true);
  assert.equal(selected.sensitivity, "confidential");
});

test("hidden builder route allows redacted low-sensitive public drafts through free routes", () => {
  const selected = selectOpenCodeModelForRun({
    run: {
      kind: "document",
      title: "Redacted public draft",
    },
    directive: {
      objective: "Redacted public draft for a blog post",
    },
    env: {
      BUILDER_OPENCODE_MODEL: "opencode/minimax-m3-free",
    },
  });

  assert.equal(selected.model, "opencode/minimax-m3-free");
  assert.equal(selected.outputContract, "public_draft");
  assert.equal(selected.freeRouteAllowed, true);
  assert.equal(selected.verifierModel, "zai-coding-plan/glm-4.7");
});
