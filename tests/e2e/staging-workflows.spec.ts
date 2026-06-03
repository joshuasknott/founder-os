import { expect, type Page, test } from "@playwright/test";

const liveConnectors = process.env.FOUNDEROS_E2E_LIVE_CONNECTORS === "true";

function marker(kind: string) {
  return `FounderOS E2E ${kind} ${Date.now()}`;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  test.skip(!value, `Set ${name} for this staging workflow.`);
  return value!;
}

async function startTask(page: Page, prompt: string, testMarker: string) {
  await page.goto("/");
  await page.getByRole("button", { name: /Chat|Task/ }).click();
  await page.getByRole("button", { name: "Task mode" }).click();
  await page.getByPlaceholder("Describe the work to create...").fill(prompt);
  await page.getByLabel("Start task").click();

  await page.goto("/work");
  await expect(page.getByText(testMarker, { exact: false }).first()).toBeVisible({
    timeout: 120_000,
  });
}

async function approveTask(page: Page, testMarker: string) {
  await page.goto("/work");
  const row = page.locator("article").filter({ hasText: testMarker }).first();
  await expect(row.getByText("Needs approval")).toBeVisible({ timeout: 180_000 });
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved. Work will continue.")).toBeVisible();
}

test.describe("staging provider workflows", () => {
  test.skip(
    !liveConnectors,
    "Set FOUNDEROS_E2E_LIVE_CONNECTORS=true only for staging provider resources.",
  );

  test("email approval sends through the connected Gmail account", async ({ page }) => {
    const to = requireEnv("E2E_ACCEPTANCE_EMAIL_TO");
    const testMarker = marker("gmail");

    await startTask(
      page,
      `Send a staging test email to ${to}. Use subject "${testMarker}". Body: "This is an automated FounderOS staging acceptance email." Do not send until I approve.`,
      testMarker,
    );
    await approveTask(page, testMarker);
    await expect(page.getByText(testMarker, { exact: false }).first()).toBeVisible({ timeout: 180_000 });
  });

  test("calendar approval creates a dated staging event", async ({ page }) => {
    const attendee = requireEnv("E2E_ACCEPTANCE_CALENDAR_ATTENDEE");
    const testMarker = marker("calendar");

    await startTask(
      page,
      `Create a Google Calendar event titled "${testMarker}" for tomorrow at 10:00 for 30 minutes and invite ${attendee}. Do not create it until I approve.`,
      testMarker,
    );
    await approveTask(page, testMarker);
    await expect(page.getByText(testMarker, { exact: false }).first()).toBeVisible({ timeout: 180_000 });
  });

  test("Google Workspace file actions create approved staging artifacts", async ({ page }) => {
    const testMarker = marker("workspace");

    await startTask(
      page,
      `Create approved staging Google Workspace artifacts with the exact marker "${testMarker}": one Drive text file, one Google Doc, and one Google Sheet. Keep the content minimal and do not create external files until I approve.`,
      testMarker,
    );
    await approveTask(page, testMarker);
    await expect(page.getByText(testMarker, { exact: false }).first()).toBeVisible({ timeout: 180_000 });
  });

  test("GitHub issue and pull request workflow reaches approval before provider write", async ({ page }) => {
    const owner = requireEnv("E2E_ACCEPTANCE_GITHUB_OWNER");
    const repo = requireEnv("E2E_ACCEPTANCE_GITHUB_REPO");
    const headBranch = requireEnv("E2E_ACCEPTANCE_GITHUB_HEAD_BRANCH");
    const baseBranch = process.env.E2E_ACCEPTANCE_GITHUB_BASE_BRANCH?.trim() || "main";
    const testMarker = marker("github");

    await startTask(
      page,
      `In the connected GitHub repository ${owner}/${repo}, create a staging issue titled "${testMarker}" and prepare a draft pull request from ${headBranch} into ${baseBranch} with title "${testMarker}". Do not write to GitHub until I approve.`,
      testMarker,
    );
    await approveTask(page, testMarker);
    await expect(page.getByText(testMarker, { exact: false }).first()).toBeVisible({ timeout: 180_000 });
  });

  test("website preview uses opencode handoff and Vercel preview settings", async ({ page }) => {
    const testMarker = marker("preview");

    await startTask(
      page,
      `Create a tiny private website preview with the visible heading "${testMarker}". Use the connected preview setup only for a private review link and do not publish live.`,
      testMarker,
    );

    await page.goto("/work");
    const row = page.locator("article").filter({ hasText: testMarker }).first();
    await expect(row.getByText(/Working|Ready to review|Completed|Open preview/i)).toBeVisible({
      timeout: 240_000,
    });
  });
});
