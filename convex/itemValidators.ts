import { v } from "convex/values";

export const flexiblePrimitive = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
);

export const flexibleRecord = v.record(
  v.string(),
  v.union(flexiblePrimitive, v.array(flexiblePrimitive)),
);

export const flexiblePayload = v.record(
  v.string(),
  v.union(
    flexiblePrimitive,
    v.array(flexiblePrimitive),
    flexibleRecord,
    v.array(flexibleRecord),
  ),
);

export const itemKind = v.union(
  v.literal("created_output"),
  v.literal("upload"),
  v.literal("website"),
  v.literal("deck"),
  v.literal("doc"),
  v.literal("email"),
  v.literal("contact"),
  v.literal("company"),
  v.literal("decision"),
  v.literal("research"),
  v.literal("automation"),
  v.literal("tool"),
  v.literal("task_output"),
  v.literal("document"),
  v.literal("file"),
  v.literal("internal_tool"),
  v.literal("presentation"),
  v.literal("conversation"),
  v.literal("record"),
  v.literal("brief"),
  v.literal("plan"),
);

export const itemStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("under_review"),
  v.literal("approved"),
  v.literal("finalized"),
  v.literal("archived"),
  v.literal("deprecated"),
);

export const itemSource = v.union(
  v.literal("user"),
  v.literal("agent"),
  v.literal("upload"),
  v.literal("website"),
  v.literal("connector"),
  v.literal("migration"),
  v.literal("system"),
);

export const versionFormat = v.union(
  v.literal("markdown"),
  v.literal("plain_text"),
  v.literal("html"),
  v.literal("json"),
  v.literal("binary"),
  v.literal("external"),
);

export const relationType = v.union(
  v.literal("created_from"),
  v.literal("derived_from"),
  v.literal("references"),
  v.literal("mentions"),
  v.literal("supports"),
  v.literal("contradicts"),
  v.literal("owns"),
  v.literal("works_at"),
  v.literal("decided_by"),
  v.literal("output_of"),
  v.literal("used_by"),
  v.literal("part_of"),
  v.literal("duplicate_of"),
  v.literal("evidence_for"),
  v.literal("related"),
);

export const entityType = v.union(
  v.literal("person"),
  v.literal("company"),
  v.literal("customer"),
  v.literal("competitor"),
  v.literal("vendor"),
  v.literal("product"),
  v.literal("market"),
  v.literal("tool"),
  v.literal("website"),
  v.literal("email"),
  v.literal("domain"),
  v.literal("concept"),
);

export const factStatus = v.union(
  v.literal("observed"),
  v.literal("inferred"),
  v.literal("confirmed"),
  v.literal("retracted"),
);

export const savedViewScope = v.union(
  v.literal("library"),
  v.literal("work"),
  v.literal("schedules"),
  v.literal("workspace"),
);

export const workflowKind = v.union(
  v.literal("automation"),
  v.literal("playbook"),
  v.literal("checklist"),
  v.literal("process"),
  v.literal("research"),
  v.literal("task_pipeline"),
  v.literal("integration"),
);

export const workflowStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("archived"),
);
