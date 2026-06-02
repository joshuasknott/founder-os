import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenCodeChatPrompt,
  runOpenCodeChat,
  selectOpenCodeChatModel,
} from "../workers/local-runner/opencode.mjs";

test("local OpenCode chat uses the paid business route for normal chat", () => {
  const selected = selectOpenCodeChatModel({
    routeModel: "zai-coding-plan/glm-4.7",
    sensitivity: "internal",
    env: {},
  });

  assert.equal(selected.model, "zai-coding-plan/glm-4.7");
  assert.equal(selected.freeRouteBlocked, false);
  assert.equal(selected.deepSeekBlocked, false);
});

test("local OpenCode chat blocks free routes for sensitive chat", () => {
  const selected = selectOpenCodeChatModel({
    requestedModel: "opencode/minimax-m3-free",
    routeModel: "zai-coding-plan/glm-4.7",
    sensitivity: "confidential",
    allowFreeRoute: false,
    verifierRequired: false,
    env: {},
  });

  assert.equal(selected.model, "zai-coding-plan/glm-4.7");
  assert.equal(selected.requestedModel, "opencode/minimax-m3-free");
  assert.equal(selected.freeRouteBlocked, true);
});

test("local OpenCode chat does not use DeepSeek as routine fallback", () => {
  const selected = selectOpenCodeChatModel({
    routeModel: "zai-coding-plan/glm-4.7",
    sensitivity: "internal",
    env: {
      FOUNDEROS_OPENCODE_BUSINESS_MODEL: "deepseek/deepseek-v4-pro",
    },
  });

  assert.equal(selected.model, "zai-coding-plan/glm-4.7");
  assert.equal(selected.deepSeekBlocked, true);
});

test("OpenCode unavailable returns a safe founder-facing failure", async () => {
  const execFileImpl = (_command, _args, _options, callback) => {
    callback(new Error("spawn opencode ENOENT"), "", "opencode missing");
  };

  await assert.rejects(
    runOpenCodeChat({
      commandValue: "opencode",
      model: "zai-coding-plan/glm-4.7",
      systemPrompt: "You are FounderOS.",
      userPrompt: "Help me prioritize.",
      execFileImpl,
    }),
    /FounderOS/,
  );
});

test("OpenCode chat prompt keeps work intake as acknowledgment, not hidden detail", () => {
  const prompt = buildOpenCodeChatPrompt({
    systemPrompt: "System",
    userPrompt: "Draft an email",
    requiresWork: true,
  });

  assert.equal(prompt.includes("already been added to Work"), true);
  assert.equal(prompt.includes("model"), false);
  assert.equal(prompt.includes("provider"), false);
});
