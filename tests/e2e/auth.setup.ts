import { expect, test as setup } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "path";

const authFile = path.join(process.cwd(), "playwright/.auth/founderos-user.json");

setup.describe.configure({ mode: "serial" });

setup("authenticate FounderOS test user", async ({ page }) => {
  const emailAddress = process.env.E2E_CLERK_TEST_USER_EMAIL;

  if (!emailAddress) {
    throw new Error(
      "Set E2E_CLERK_TEST_USER_EMAIL to a Clerk test user before running Playwright acceptance tests.",
    );
  }

  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.signIn({ page, emailAddress });
  await page.goto("/settings");

  const settingsMarker = page.getByText("Services FounderOS can use.");
  const openFounderOS = page.getByRole("button", { name: "Open FounderOS" });
  await expect(settingsMarker.or(openFounderOS)).toBeVisible({ timeout: 30_000 });

  if (await openFounderOS.isVisible().catch(() => false)) {
    await openFounderOS.click();
    await expect(page.getByRole("heading", { name: "Set up your workspace." })).toBeHidden({
      timeout: 30_000,
    });
    await page.goto("/settings");
  }

  await expect(settingsMarker).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: authFile });
});
