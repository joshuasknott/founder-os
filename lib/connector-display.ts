export type ConnectorDisplayService = {
  id: string;
};

const genericServiceReplacements: Record<string, string[]> = {
  email: ["gmail"],
  calendar: ["google_calendar"],
  code_hosting: ["vercel"],
  knowledge: ["google_drive", "google_docs", "google_sheets"],
};

export const activeConnectorIds = [
  "gmail",
  "google_calendar",
  "google_drive",
  "google_docs",
  "google_sheets",
  "opencode",
  "github",
  "vercel",
] as const;

const activeConnectorIdSet = new Set<string>(activeConnectorIds);

export const serviceGroups = [
  { id: "google", title: "Google Workspace", ids: ["gmail", "google_calendar", "google_drive", "google_docs", "google_sheets"] },
  { id: "code", title: "Product work", ids: ["opencode", "github"] },
  { id: "hosting", title: "Website previews", ids: ["vercel"] },
];

export function visibleConnectorServices<T extends ConnectorDisplayService>(services: T[]) {
  const serviceIds = new Set(services.map((service) => service.id));
  return services.filter((service) => activeConnectorIdSet.has(service.id)).filter((service) => {
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
