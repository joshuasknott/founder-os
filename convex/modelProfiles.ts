export type ModelProfile = "auto" | "low" | "medium" | "high";

export const modelProfiles: ModelProfile[] = ["auto", "low", "medium", "high"];

export function normalizeModelProfile(value?: string): ModelProfile {
  return modelProfiles.includes(value as ModelProfile) ? value as ModelProfile : "auto";
}

export function tierForModelProfile(profile: string | undefined, autoTier: number) {
  const normalized = normalizeModelProfile(profile);
  if (normalized === "low") return 1;
  if (normalized === "medium") return 2;
  if (normalized === "high") return 4;
  return autoTier;
}
