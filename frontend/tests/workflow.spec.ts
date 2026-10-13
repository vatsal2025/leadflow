import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { localToISO } from "../src/lib/dates";

test.beforeEach(async ({ page }) => {
  const login = await page.request.post("/api/auth/login", {
    headers: { "X-Leadflow-Client": "web" },
    data: { password: "e2e-workspace-password" },
  });
  expect(login.ok()).toBe(true);
});

test("create, discuss, schedule, update status, reload, and complete follow-up", async ({
  page,
}) => {
  const name = `Taylor Morgan ${Date.now()}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your leads" })).toBeVisible();
  await page.getByRole("button", { name: "Add new lead" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Company").fill("Bright Future Advisors");
  await dialog.getByLabel("Phone number").fill("+91 98765 43210");
  await dialog.getByRole("button", { name: "Add lead", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: `Open ${name}`, exact: true }).click();
  await dialog
    .getByLabel("Add a discussion")
    .fill("Discussed priorities and agreed on the next steps.");
  await dialog.getByLabel("Set a follow-up").check();
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T23:45`;
  });
  await dialog.getByLabel("Follow-up date & time").fill(today);
  await dialog.getByRole("button", { name: "Save discussion" }).click();
  await expect(dialog.locator(".note-card").first()).toContainText(
    "Discussed priorities",
  );
  await dialog
    .getByLabel("Status", { exact: true })
    .selectOption("Proposal Sent");
  await expect(page.getByRole("status")).toContainText(
    "Status updated to Proposal Sent",
  );
  await dialog
    .getByLabel("Add a discussion")
    .fill("Sent a tailored proposal after our call.");
  await dialog.getByRole("button", { name: "Save discussion" }).click();
  await expect(dialog.locator(".note-card").first()).toContainText(
    "Sent a tailored proposal",
  );
  await expect(dialog.locator(".current-reminder")).toContainText("Today");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  const pinned = page.getByRole("region", { name: "TODAY’S FOLLOW-UPS" });
  const row = pinned.getByRole("button", { name: `Open ${name}`, exact: true });
  await expect(row).toContainText("Proposal Sent");
  await expect(row).toContainText("Sent a tailored proposal");
  await page.reload();
  await expect(row).toContainText("Sent a tailored proposal");
  await row.click();
  await expect(dialog.locator(".note-card")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Mark complete" }).click();
  await expect(dialog.locator(".current-reminder")).toHaveCount(0);
  await expect(dialog.locator(".note-reminder")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    pinned.getByRole("button", { name: `Open ${name}`, exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("status filters, name search, empty states and overdue filter", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Won", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Isha Patel" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Aarav Mehta" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^All \d/ }).click();
  await page
    .getByRole("searchbox", { name: "Search leads by name" })
    .fill("pRiYa");
  await expect(
    page.getByRole("button", { name: "Open Priya Sharma" }),
  ).toBeVisible();
  await expect(page.locator(".lead-row")).toHaveCount(1);
  await page.getByRole("searchbox").fill("NoSuchPerson987654");
  await expect(
    page.getByRole("heading", { name: "No leads match just yet" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .first()
    .click();
  await page.getByLabel("Filter follow-ups").selectOption("overdue");
  await expect(
    page.getByRole("button", { name: "Open Rohan Kapoor" }),
  ).toContainText("Overdue");
  await expect(page.locator(".row-reminder:not(.overdue)")).toHaveCount(0);
});

test("failed save preserves the draft, retry succeeds, and unsaved close requires consent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("Ananya Rao");
  await page.getByRole("button", { name: "Open Ananya Rao" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Add a discussion")
    .fill("Keep this draft if the connection fails.");
  await page.route("**/api/leads/*/discussions", async (route) => {
    if (route.request().method() === "POST") await route.abort("failed");
    else await route.continue();
  });
  await dialog.getByRole("button", { name: "Save discussion" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Couldn’t reach the server",
  );
  await expect(dialog.getByLabel("Add a discussion")).toHaveValue(
    "Keep this draft if the connection fails.",
  );
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Keep editing" })
    .click();
  await expect(dialog).toBeVisible();
  await page.unroute("**/api/leads/*/discussions");
  await dialog.getByRole("button", { name: "Save discussion" }).click();
  await expect(dialog.locator(".note-card").first()).toContainText(
    "Keep this draft",
  );
  await expect(dialog.getByLabel("Add a discussion")).toHaveValue("");
});

test("stale edits show a conflict and preserve the discussion draft", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("Vikram Desai");
  await page.getByRole("button", { name: "Open Vikram Desai" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Status", { exact: true })).toBeEnabled();
  const response = await page.request.get("/api/leads?search=Vikram");
  const lead = (await response.json()).items[0];
  await page.request.patch(`/api/leads/${lead.id}`, {
    headers: { "X-Leadflow-Client": "cli" },
    data: { status: "Contacted", expected_version: lead.version },
  });
  await dialog
    .getByLabel("Add a discussion")
    .fill("A draft that must survive a concurrent edit.");
  await dialog.getByRole("button", { name: "Save discussion" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "changed in another session",
  );
  await expect(dialog.getByLabel("Add a discussion")).toHaveValue(
    "A draft that must survive a concurrent edit.",
  );
  await expect(dialog.getByLabel("Status", { exact: true })).toHaveValue(
    "Contacted",
  );
  await dialog.getByRole("button", { name: "Save discussion" }).click();
  await expect(dialog.locator(".note-card").first()).toContainText(
    "A draft that must survive",
  );
});

test("accessible workspace and dialogs, focus restoration, and no horizontal overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Open Aarav Mehta" }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  const opener = page.getByRole("button", { name: "Add new lead" });
  await opener.click();
  await expect(page.getByLabel("Full name")).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await page.getByRole("button", { name: "Open Aarav Mehta" }).click();
  await expect(
    page.getByRole("dialog").locator(".note-card").first(),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("local timestamps reject invalid dates", () => {
  expect(() => localToISO("invalid")).toThrow("valid follow-up");
});

test("a shrinking result set leaves a path back from an empty page", async ({
  page,
}) => {
  const response = await page.request.get("/api/leads");
  const original = await response.json();
  let shrunk = false;
  await page.route("**/api/leads?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const offset = Number(params.get("offset") || 0);
    if (offset > 0) shrunk = true;
    const total = shrunk ? 1 : 26;
    await route.fulfill({
      json: {
        ...original,
        total,
        offset,
        limit: 25,
        items: offset > 0 ? [] : original.items.slice(0, 1),
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByRole("heading", { name: "This page has changed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to first page" }).click();
  await expect(page.locator(".lead-row")).toHaveCount(1);
  await expect(page.getByText("Showing 1–1 of 1 leads")).toBeVisible();
});
