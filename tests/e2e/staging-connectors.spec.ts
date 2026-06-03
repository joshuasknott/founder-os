import { expect, test } from "@playwright/test";

const liveConnectors = process.env.FOUNDEROS_E2E_LIVE_CONNECTORS === "true";

test.describe("staging connector acceptance", () => {
  test.skip(
    !liveConnectors,
    "Set FOUNDEROS_E2E_LIVE_CONNECTORS=true only after staging provider accounts and teardown resources are ready.",
  );

  test("connected services are available before provider workflow acceptance", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText("Services FounderOS can use.")).toBeVisible();
    await expect(page.getByText(/Google Workspace|Gmail|Google Calendar/i).first()).toBeVisible();
    await expect(page.getByText("GitHub", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Website previews|Vercel/i).first()).toBeVisible();
    await expect(page.getByText("opencode", { exact: false }).first()).toBeVisible();
  });
});
