export type ConnectorDisplayService = {
  id: string;
};

const genericServiceReplacements: Record<string, string[]> = {
  email: ["gmail"],
  calendar: ["google_calendar"],
  payments: ["stripe"],
  code_hosting: ["vercel"],
  knowledge: ["google_drive", "slack", "notion"],
};

export const serviceGroups = [
  { id: "google", title: "Google Workspace", ids: ["gmail", "google_calendar", "google_drive", "email", "calendar"] },
  { id: "communication", title: "Communication", ids: ["slack"] },
  { id: "knowledge", title: "Knowledge", ids: ["notion", "knowledge"] },
  { id: "payments", title: "Payments", ids: ["stripe", "payments"] },
  { id: "publishing", title: "Publishing", ids: ["publishing"] },
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
