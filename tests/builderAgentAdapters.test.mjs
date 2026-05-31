import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenCodeArgs,
  builderProviderHelp,
  isLlmBuilderProvider,
  opencodeModelForProfile,
  selectBuilderAgent,
} from "../workers/builder/agentAdapters.mjs";

test("builder agent selection prefers explicit OpenCode without exposing Codex defaults", () => {
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

test("opencode auto leaves model choice to OpenCode and manual tiers can pin models", () => {
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
