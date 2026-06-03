import { expect, test } from "@playwright/test";

test("authenticated settings show the current connector surface", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByText("Services FounderOS can use.")).toBeVisible();

  for (const label of [
    "Gmail",
    "Google Calendar",
    "Google Drive",
    "Google Docs",
    "Google Sheets",
    "GitHub",
    "opencode",
    "Website previews",
  ]) {
    await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
  }

  await expect(page.getByText("Stripe", { exact: true })).toHaveCount(0);
});
