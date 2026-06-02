import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import {
  buildDocumentPrompt,
  classifyDocumentRequest,
  fallbackDocument,
  selectDocumentRoute,
} from "../workers/document/runtime.mjs";
import { runOpenCodeDocument } from "../workers/local-runner/opencode.mjs";

async function loadTypescriptModule(relativePath, outputName) {
  const source = await readFile(resolve(process.cwd(), relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-document-workflow-"));
  const outputPath = join(outputDir, outputName);
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const contextRuntime = await loadTypescriptModule("convex/documentContextRuntime.ts", "documentContextRuntime.mjs");
const markdownRuntime = await loadTypescriptModule("lib/markdown.ts", "markdown.mjs");

test("document workflow recognizes founder-facing document types", () => {
  assert.equal(classifyDocumentRequest("Quarterly memo", "Write a memo"), "memo");
  assert.equal(classifyDocumentRequest("Sales brief", "Prepare a brief"), "brief");
  assert.equal(classifyDocumentRequest("Launch plan", "Create a plan"), "plan");
  assert.equal(classifyDocumentRequest("Support SOP", "Write a standard operating procedure"), "SOP");
  assert.equal(classifyDocumentRequest("Investor email", "Draft an email"), "email draft");
  assert.equal(classifyDocumentRequest("Partner proposal", "Prepare a proposal"), "proposal");
  assert.equal(classifyDocumentRequest("Pricing strategy", "Write a strategy document"), "strategy document");
});

test("document workflow uses paid GLM business and planning routes without requiring direct ZAI keys", () => {
  const memo = selectDocumentRoute({
    title: "Customer memo",
    objective: "Write a short customer memo",
    env: { ZAI_API_KEY: "must-not-be-used", DEEPSEEK_API_KEY: "must-not-be-used" },
  });
  assert.equal(memo.model, "zai-coding-plan/glm-4.7");
  assert.equal(memo.verifierRequired, false);

  const strategy = selectDocumentRoute({
    title: "Pricing strategy",
    objective: "Create a pricing strategy with runway scenarios",
    env: { ZAI_API_KEY: "must-not-be-used", DEEPSEEK_API_KEY: "must-not-be-used" },
  });
  assert.equal(strategy.model, "zai-coding-plan/glm-5-turbo");
  assert.equal(strategy.verifierRequired, true);
  assert.equal(strategy.verifierModel, "zai-coding-plan/glm-4.7");
});

test("document prompt includes only selected context and fallback stays viewable markdown", () => {
  const prompt = buildDocumentPrompt({
    run: { title: "Launch memo" },
    directive: { objective: "Write a launch memo for the team." },
    context: [{ title: "Launch notes", summary: "Approved.", excerpt: "Ship in June." }],
    documentType: "memo",
  });
  assert.equal(prompt.includes("Ship in June."), true);
  assert.equal(prompt.includes("Return only polished markdown"), true);

  const fallback = fallbackDocument({
    run: { title: "Launch memo" },
    directive: { objective: "Write a launch memo." },
    documentType: "memo",
  });
  assert.equal(fallback.startsWith("# Launch memo"), true);
  assert.equal(fallback.includes("structured fallback draft"), true);
});

test("Library context gate excludes restricted, private, and unapproved content", () => {
  const candidates = [
    { id: "approved", title: "Launch notes", summary: "Approved launch", content: "Launch date June", status: "approved" },
    { id: "draft", title: "Launch draft", content: "Launch draft June", status: "draft" },
    { id: "private", title: "Launch private", content: "Launch private June", status: "approved", metadata: { private: true } },
    { id: "restricted", title: "Launch secrets", content: "api_key secret launch token", status: "approved" },
    { id: "explicit", title: "Launch working note", content: "Launch checklist June", status: "active", metadata: { documentContextAllowed: true } },
  ];

  const selected = contextRuntime.selectDocumentContextCandidates({
    queryText: "launch June plan",
    requestSensitivity: "internal",
    candidates,
  });
  assert.deepEqual(selected.map((item) => item.id), ["approved", "explicit"]);
});

test("Library context gate allows confidential context only for confidential requests", () => {
  const candidate = {
    id: "finance",
    title: "Runway plan",
    content: "Revenue runway scenarios",
    status: "approved",
    metadata: { sensitivity: "confidential" },
  };
  assert.equal(contextRuntime.canUseLibraryContext(candidate, "internal"), false);
  assert.equal(contextRuntime.canUseLibraryContext(candidate, "confidential"), true);
});

test("markdown parser produces clean render blocks for generated documents", () => {
  const blocks = markdownRuntime.parseMarkdownBlocks([
    "# Launch memo",
    "",
    "A short intro.",
    "",
    "## Next Steps",
    "- Review copy",
    "- Approve launch",
  ].join("\n"));

  assert.deepEqual(blocks.map((block) => block.type), [
    "heading",
    "paragraph",
    "heading",
    "unordered_list",
  ]);
});

test("OpenCode document execution passes the selected route and returns markdown", async () => {
  let receivedArgs = [];
  const execFileImpl = (_command, args, _options, callback) => {
    receivedArgs = args;
    callback(null, "# Memo\n\nReady for review.", "");
  };
  const result = await runOpenCodeDocument({
    commandValue: "opencode",
    model: "zai-coding-plan/glm-4.7",
    prompt: "Write the memo.",
    execFileImpl,
  });

  assert.equal(receivedArgs.includes("zai-coding-plan/glm-4.7"), true);
  assert.equal(result.content, "# Memo\n\nReady for review.");
});
