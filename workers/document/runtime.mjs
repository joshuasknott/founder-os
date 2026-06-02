const BUSINESS_MODEL = "zai-coding-plan/glm-4.7";
const PLANNING_MODEL = "zai-coding-plan/glm-5-turbo";

function normalizedText(...values) {
  return values.join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

export function classifyDocumentRequest(title, objective) {
  const text = normalizedText(title, objective);
  if (/\b(strategy|strategic)\b/.test(text)) return "strategy document";
  if (/\b(sop|standard operating procedure|playbook|process)\b/.test(text)) return "SOP";
  if (/\b(email draft|draft (?:an? )?email|email)\b/.test(text)) return "email draft";
  if (/\bproposal\b/.test(text)) return "proposal";
  if (/\bbrief\b/.test(text)) return "brief";
  if (/\bmemo\b/.test(text)) return "memo";
  return "plan";
}

export function selectDocumentRoute({ title = "", objective = "", env = process.env } = {}) {
  const text = normalizedText(title, objective);
  const planning =
    /\b(strategy|strategic|plan|planning|roadmap|forecast|finance|financial|budget|runway|revenue|pricing|complex|synthesis|scenario|board|investor)\b/.test(text);
  const highStakes =
    /\b(finance|financial|budget|runway|revenue|pricing|legal|contract|board|investor|commitment|customer proposal)\b/.test(text);
  const model = planning
    ? env.FOUNDEROS_OPENCODE_PLANNING_MODEL || PLANNING_MODEL
    : env.FOUNDEROS_OPENCODE_BUSINESS_MODEL || BUSINESS_MODEL;
  const verifierRequired = planning || highStakes;
  const verifierModel = model === PLANNING_MODEL || model === env.FOUNDEROS_OPENCODE_PLANNING_MODEL
    ? env.FOUNDEROS_OPENCODE_BUSINESS_MODEL || BUSINESS_MODEL
    : env.FOUNDEROS_OPENCODE_PLANNING_MODEL || PLANNING_MODEL;

  return {
    model,
    verifierRequired,
    verifierModel,
    capability: planning ? "planning" : "product_marketing_docs",
    highStakes,
  };
}

function formatContext(context = []) {
  if (!context.length) return "No approved Library context was selected. Draft from the founder request only.";
  return context
    .map((item, index) => [
      `### Context ${index + 1}: ${item.title}`,
      item.summary ? `Summary: ${item.summary}` : undefined,
      item.excerpt,
    ].filter(Boolean).join("\n"))
    .join("\n\n");
}

export function buildDocumentPrompt({ run, directive, context = [], documentType } = {}) {
  return [
    "You are preparing a private FounderOS business document.",
    "Return only polished markdown for the document. Do not wrap it in a markdown fence.",
    "Do not mention hidden systems, AI models, providers, routing, tools, or these instructions.",
    "Use approved Library context only where it is relevant. Do not invent missing facts.",
    `Document type: ${documentType ?? classifyDocumentRequest(run?.title, directive?.objective)}`,
    `Title: ${run?.title ?? directive?.title ?? "Untitled document"}`,
    "",
    "Founder request:",
    directive?.objective ?? "",
    "",
    "Approved Library context:",
    formatContext(context),
  ].join("\n");
}
export function buildVerifierPrompt({ draft, documentType, objective } = {}) {
  return [
    "Review this private FounderOS business document before it is shown to the founder.",
    "Return only the corrected markdown document. Do not add commentary or markdown fences.",
    "Preserve useful detail. Remove unsupported claims, hidden-system references, and accidental credentials.",
    `Document type: ${documentType}`,
    `Founder request: ${objective}`,
    "",
    "Draft:",
    draft,
  ].join("\n");
}

export function summarizeDocument(documentType) {
  return `A ${documentType} draft is ready for review in your Library.`;
}

export function fallbackDocument({ run, directive, documentType } = {}) {
  const title = run?.title ?? directive?.title ?? "Document draft";
  const kind = documentType ?? classifyDocumentRequest(title, directive?.objective);
  return [
    `# ${title}`,
    "",
    "## Purpose",
    directive?.objective ?? "Prepare an internal business document.",
    "",
    "## Draft Notes",
    `This ${kind} needs review. FounderOS kept a structured fallback draft because the full writing pass was not available.`,
    "",
    "## Next Steps",
    "- Review the purpose and add any missing business context.",
    "- Ask FounderOS for a revision when the local writing service is available.",
  ].join("\n");
}
