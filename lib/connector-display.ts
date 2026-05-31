export type ConnectorDisplayService = {
  id: string;
};

const genericServiceReplacements: Record<string, string[]> = {
  email: ["gmail"],
  calendar: ["google_calendar"],
  payments: ["stripe"],
  code_hosting: ["vercel"],
  knowledge: ["google_drive", "google_docs", "google_sheets", "posthog"],
};

export const serviceGroups = [
  { id: "google", title: "Google Workspace", ids: ["gmail", "google_calendar", "google_drive", "google_docs", "google_sheets", "email", "calendar"] },
  { id: "code", title: "Code", ids: ["github", "opencode"] },
  { id: "analytics", title: "Analytics", ids: ["posthog"] },
  { id: "communication", title: "Communication", ids: ["resend"] },
  { id: "design", title: "Design", ids: ["canva"] },
  { id: "knowledge", title: "Knowledge", ids: ["knowledge"] },
  { id: "payments", title: "Payments", ids: ["stripe", "payments"] },
  { id: "hosting", title: "Hosting", ids: ["vercel", "code_hosting"] },
];

export function visibleConnectorServices<T extends ConnectorDisplayService>(services: T[]) {
  const serviceIds = new Set(services.map((service) => service.id));
  return services.filter((service) => {
    const replacements = genericServiceReplacements[service.id];
    return !replacements?.some((replacementId) => serviceIds.has(replacementId));
  });
}

export function groupedConnectorServices<T extends ConnectorDisplayService>(services: T[]) {
  const visible = visibleConnectorServices(services);
  const byId = new Map(visible.map((service) => [service.id, service]));
  return serviceGroups
    .map((group) => ({
      ...group,
      services: group.ids.flatMap((id) => {
        const service = byId.get(id);
        return service ? [service] : [];
      }),
    }))
    .filter((group) => group.services.length > 0);
}
