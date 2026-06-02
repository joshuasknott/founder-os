import {
  configuredModelForRoute,
  selectModelRoute,
  type HiddenModelRouteId,
} from "./modelOrchestration";
import {
  classifyTaskObjective,
  inferLocalSensitivity,
  localRoutingForRun,
  type LocalRunRouting,
  type LocalRunnerSensitivity,
  type TaskClassification,
} from "./taskRuntime";

export type ChatJobStatus = "queued" | "working" | "completed" | "failed";

export type HomeChatIntake = {
  sensitivity: LocalRunnerSensitivity;
  localRouting: LocalRunRouting;
  routeId: HiddenModelRouteId;
  opencodeModel: string;
  verifierRequired: boolean;
  allowFreeRoute: boolean;
  requiresWork: boolean;
  taskClassification: TaskClassification;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function looksLikeThinkingHelp(text: string) {
  return (
    /\bhelp me (?:decide|think|understand|brainstorm|prioriti[sz]e|choose|figure out|reason through|weigh)\b/.test(text) ||
    /\bwhat should i\b/.test(text) ||
    /\bgive me a framework\b/.test(text) ||
    /\bwhat (?:am i|are we) (?:probably )?overlooking\b/.test(text) ||
    /\bquestions should i ask\b/.test(text)
  );
}

function looksLikeWorkRequest(text: string, classification: TaskClassification) {
  const workVerb =
    /\b(?:build|create|draft|write|prepare|make|design|schedule|send|summari[sz]e|turn|convert|put together|set up|fix|revise|produce)\b/.test(text);
  const matchedWorkClass = classification.category !== "generic" && classification.signals.length > 0;

  if (looksLikeThinkingHelp(text) && !/\b(?:build|create|draft|write|prepare|make|design|schedule|send|set up|fix|revise|produce)\b/.test(text)) {
    return false;
  }

  return workVerb || matchedWorkClass;
}

export function titleFromChatContent(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "New request";
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

export function classifyHomeChatIntake(content: string): HomeChatIntake {
  const title = titleFromChatContent(content);
  const normalized = normalize(content);
  const taskClassification = classifyTaskObjective({ title, objective: content });
  const sensitivity = inferLocalSensitivity(content);
  const routeSelection = selectModelRoute({
    capability: "business_reasoning",
    outputContract: "plain_text",
    sensitivity,
    text: content,
    allowFreeDraftRoute: false,
  });

  return {
    sensitivity,
    localRouting: {
      capability: "business_reasoning",
      sensitivity,
      outputContract: "plain_text",
      approvalNeeds: [],
    },
    routeId: routeSelection.selectedRouteId,
    opencodeModel: configuredModelForRoute(routeSelection.selectedRouteId, {}),
    verifierRequired: routeSelection.verifier.required,
    allowFreeRoute: false,
    requiresWork: looksLikeWorkRequest(normalized, taskClassification),
    taskClassification,
  };
}

export function localRoutingForChatWork(args: {
  title: string;
  objective: string;
  classification: TaskClassification;
}) {
  return localRoutingForRun({
    kind: args.classification.runKind,
    title: args.title,
    objective: args.objective,
    classification: args.classification,
  });
}
