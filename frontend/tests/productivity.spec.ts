import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const headers = { "X-Leadflow-Client": "web" };
test.beforeEach(async ({ page }) => {
  const response = await page.request.post("/api/auth/login", {
    headers,
    data: { password: "e2e-workspace-password" },
  });
  expect(response.ok()).toBe(true);
});
async function create(page: Page, fields: Record<string, unknown> = {}) {
  const response = await page.request.post("/api/leads", {
    headers,
    data: {
      id: crypto.randomUUID(),
      name: `Productivity ${crypto.randomUUID()}`,
      ...fields,
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}
async function downloadText(page: Page, button: string) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  const download = await waiting;
  expect(await download.failure()).toBeNull();
  return readFile((await download.path())!, "utf8");
}

test("edit a rich contact, archive and restore with its activity intact", async ({
  page,
}) => {
  const lead = await create(page);
  await page.goto("/");
  await page.getByRole("searchbox").fill(lead.name);
  await page
    .getByRole("button", { name: `Open ${lead.name}`, exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Activity type").selectOption("Call");
  await dialog
    .getByLabel("Add a discussion")
    .fill("Confirmed requirements by phone.");
  await dialog.getByRole("button", { name: "Save discussion" }).click();
  await expect(dialog.locator(".note-card").first()).toContainText("Call");
  await dialog.getByRole("tab", { name: "Lead details" }).click();
  await page.keyboard.press("ArrowLeft");
  await expect(
    dialog.getByRole("tab", { name: "Activity", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("tab", { name: "Lead details" })).toBeFocused();
  await dialog.getByLabel("Email address").fill("contact@example.com");
  await dialog.getByLabel("Lead source").fill("Conference");
  await dialog.getByLabel("Priority", { exact: true }).selectOption("High");
  await dialog.getByLabel("Estimated deal value").fill("15000.50");
  await dialog.getByLabel("Currency").selectOption("USD");
  await dialog.getByRole("button", { name: "Save lead details" }).click();
  await expect(
    dialog.getByRole("button", { name: "Save lead details" }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Archive lead", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Restore lead" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".lead-row")).toHaveCount(0);
  await page.getByLabel("Lead visibility").selectOption("archived");
  await page
    .getByRole("button", { name: `Open ${lead.name}`, exact: true })
    .click();
  await expect(dialog.locator(".note-card").first()).toContainText(
    "Confirmed requirements",
  );
  await dialog.getByRole("tab", { name: "Lead details" }).click();
  await expect(dialog.getByLabel("Email address")).toHaveValue(
    "contact@example.com",
  );
  await expect(dialog.getByLabel("Estimated deal value")).toHaveValue(
    "15000.50",
  );
  await dialog.getByRole("button", { name: "Restore lead" }).click();
  await expect(
    dialog.getByRole("button", { name: "Archive lead", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("Lead visibility").selectOption("active");
  await expect(
    page.getByRole("button", { name: `Open ${lead.name}`, exact: true }),
  ).toContainText("High");
});

test("profile conflict preserves the draft until explicit reload", async ({
  page,
}) => {
  const lead = await create(page);
  await page.goto("/");
  await page.getByRole("searchbox").fill(lead.name);
  await page
    .getByRole("button", { name: `Open ${lead.name}`, exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Status", { exact: true })).toBeEnabled();
  await dialog.getByRole("tab", { name: "Lead details" }).click();
  await dialog.getByLabel("Company").fill("Unsaved draft");
  const changed = await page.request.patch(`/api/leads/${lead.id}`, {
    headers,
    data: { expected_version: lead.version, company: "Other session" },
  });
  expect(changed.ok()).toBe(true);
  await dialog.getByRole("button", { name: "Save lead details" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "changed in another session",
  );
  await expect(dialog.getByLabel("Company")).toHaveValue("Unsaved draft");
  await expect(
    dialog.getByRole("button", { name: "Save lead details" }),
  ).toBeDisabled();
  await expect(dialog.locator(".contact-details")).toContainText(
    "Other session",
  );
  await dialog.getByRole("button", { name: "Reload saved details" }).click();
  await expect(dialog.getByLabel("Company")).toHaveValue("Other session");
  await dialog.getByLabel("Company").fill("Reviewed and updated");
  await dialog.getByRole("button", { name: "Save lead details" }).click();
  await expect(dialog.locator(".contact-details")).toContainText(
    "Reviewed and updated",
  );
});

test("attention, priority, pipeline stage changes, and filtered CSV work together", async ({
  page,
}) => {
  const source = `Conference-${crypto.randomUUID()}`;
  const lead = await create(page, {
    source,
    priority: "High",
    estimated_value: "123.45",
    currency: "USD",
  });
  await create(page, { source, priority: "Low" });
  await page.goto("/");
  await page.getByRole("searchbox").fill(source);
  await page.getByLabel("Filter priority").selectOption("High");
  await page.getByRole("button", { name: "No next step", exact: true }).click();
  await expect(page.locator(".lead-row")).toHaveCount(1);
  await expect(page.locator(".lead-row")).toContainText(lead.name);
  const csv = await downloadText(page, "Export CSV");
  expect(csv).toContain(lead.name);
  expect(csv).toContain('"123.45"');
  expect(csv.trim().split("\n")).toHaveLength(2);
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  const lane = page.getByRole("region", { name: "New stage", exact: true });
  await expect(lane).toContainText("$123.45");
  await lane
    .getByLabel(`Move ${lead.name} to stage`, { exact: true })
    .selectOption("Qualified");
  const qualified = page.getByRole("region", {
    name: "Qualified stage",
    exact: true,
  });
  await expect(
    qualified.getByRole("button", { name: `Open ${lead.name}`, exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await qualified
    .getByLabel(`Move ${lead.name} to stage`, { exact: true })
    .selectOption("Won");
  await expect(page.locator(".pipeline-card")).toHaveCount(0);
  await page.getByRole("button", { name: "All leads", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Won stage", exact: true }),
  ).toContainText(lead.name);
});

test("standalone scheduling protects drafts and exports a real calendar event", async ({
  page,
}) => {
  const lead = await create(page);
  await page.goto("/");
  await page.getByRole("searchbox").fill(lead.name);
  await page
    .getByRole("button", { name: `Open ${lead.name}`, exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Schedule follow-up", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Tomorrow, 9 AM" }).click();
  const nextDate = await dialog
    .getByLabel("Next follow-up date & time")
    .inputValue();
  expect(nextDate).toMatch(/T09:00$/);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Keep editing" })
    .click();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Save follow-up", exact: true })
    .click();
  await expect(dialog.locator(".current-reminder")).toBeVisible();
  const calendar = await downloadText(page, "Calendar (.ics)");
  expect(calendar).toContain("BEGIN:VCALENDAR\r\n");
  expect(calendar).toContain(`UID:${lead.id}-followup@leadflow`);
  expect(calendar).toContain("T033000Z"); // 09:00 Asia/Kolkata in UTC
  await expect(dialog.locator(".note-card")).toHaveCount(0);
  await page.reload();
  await page.getByRole("searchbox").fill(lead.name);
  await page
    .getByRole("button", { name: `Open ${lead.name}`, exact: true })
    .click();
  await expect(dialog.locator(".current-reminder")).toBeVisible();
  await dialog.getByRole("button", { name: "Mark complete" }).click();
  await expect(
    dialog.getByRole("button", { name: "Calendar (.ics)", exact: true }),
  ).toHaveCount(0);
});

test("pipeline loads beyond its first page and shows the full stage total", async ({
  page,
}) => {
  const source = `Paged-${crypto.randomUUID()}`;
  for (let i = 0; i < 21; i++)
    await create(page, {
      name: `Paged ${i}`,
      source,
      estimated_value: "1.00",
      currency: "USD",
    });
  await page.goto("/");
  await page.getByRole("searchbox").fill(source);
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  const lane = page.getByRole("region", { name: "New stage", exact: true });
  await expect(lane.locator(".pipeline-card")).toHaveCount(20);
  await expect(lane.locator(".stage-values")).toHaveText("$21.00");
  await lane.getByRole("button", { name: "Load more leads" }).click();
  await expect(lane.locator(".pipeline-card")).toHaveCount(21);
  await expect(
    lane.getByRole("button", { name: "Load more leads" }),
  ).toHaveCount(0);
});

test("the full pipeline scrolls inside its board without widening the viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Lost stage", exact: true })
      .getByRole("button", { name: "Open Kabir Sethi" }),
  ).toBeAttached();
  const viewport = page.viewportSize()!.width;
  const measurements = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    board: document.querySelector(".pipeline-board")!.clientWidth,
    contents: document.querySelector(".pipeline-board")!.scrollWidth,
  }));
  expect(measurements.viewport).toBe(viewport);
  expect(measurements.document).toBeLessThanOrEqual(viewport);
  expect(measurements.contents).toBeGreaterThan(measurements.board);
  const lost = page.getByRole("region", { name: "Lost stage", exact: true });
  await lost.getByRole("button", { name: "Open Kabir Sethi" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
