import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  const response = await page.request.post("/api/auth/login", {
    headers: { "X-Leadflow-Client": "web" },
    data: { password: "e2e-workspace-password" },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Open Aarav Mehta", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".note-card").first(),
  ).toBeVisible();
});

test("discard confirmation protects notes, traps focus, and restores the lead dialog", async ({
  page,
}, testInfo) => {
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.message());
    await dialog.dismiss();
  });
  const lead = page.getByRole("dialog");
  await lead
    .getByLabel("Add a discussion")
    .fill("Keep this unsaved conversation.");
  await lead.getByRole("button", { name: "Close dialog" }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Discard unsaved changes?",
  });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: "Keep editing" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    confirmation.getByRole("button", { name: "Discard changes" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    confirmation.getByRole("button", { name: "Keep editing" }),
  ).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("discard-confirmation.png"),
  });
  await page.keyboard.press("Escape");
  await expect(confirmation).not.toBeVisible();
  await expect(lead).toBeVisible();
  await expect(
    lead.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await expect(lead.getByLabel("Add a discussion")).toHaveValue(
    "Keep this unsaved conversation.",
  );
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Discard changes" }).click();
  await expect(lead).not.toBeVisible();
  const trigger = page.getByRole("button", {
    name: "Open Aarav Mehta",
    exact: true,
  });
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(lead.getByLabel("Add a discussion")).toHaveValue("");
  await expect(lead.locator(".note-card")).toHaveCount(2);
  expect(nativeDialogs).toEqual([]);
});

test("tab changes and reminder cancellation discard only confirmed drafts", async ({
  page,
}) => {
  const lead = page.getByRole("dialog");
  const confirmation = page.getByRole("alertdialog");
  await lead.getByRole("tab", { name: "Lead details" }).click();
  await lead.getByLabel("Company").fill("Unsaved company");
  await lead.getByRole("tab", { name: "Activity", exact: true }).click();
  await confirmation.getByRole("button", { name: "Keep editing" }).click();
  await expect(lead.getByLabel("Company")).toHaveValue("Unsaved company");
  await lead.getByRole("tab", { name: "Activity", exact: true }).click();
  await confirmation.getByRole("button", { name: "Discard changes" }).click();
  await lead.getByRole("tab", { name: "Lead details" }).click();
  await expect(lead.getByLabel("Company")).toHaveValue("Meridian Ventures");
  await lead.getByRole("tab", { name: "Activity", exact: true }).click();
  await lead.getByRole("button", { name: "Reschedule follow-up" }).click();
  const original = await lead
    .getByLabel("Next follow-up date & time")
    .inputValue();
  await lead.getByRole("button", { name: "Cancel scheduling" }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(lead.getByLabel("Next follow-up date & time")).not.toBeVisible();
  await lead.getByRole("button", { name: "Reschedule follow-up" }).click();
  await lead.getByRole("button", { name: "Tomorrow, 9 AM" }).click();
  const draft = await lead
    .getByLabel("Next follow-up date & time")
    .inputValue();
  await lead.getByRole("button", { name: "Cancel scheduling" }).click();
  await confirmation.getByRole("button", { name: "Keep editing" }).click();
  await expect(lead.getByLabel("Next follow-up date & time")).toHaveValue(
    draft,
  );
  await lead.getByRole("button", { name: "Cancel scheduling" }).click();
  await confirmation.getByRole("button", { name: "Discard changes" }).click();
  await lead.getByRole("button", { name: "Reschedule follow-up" }).click();
  await expect(lead.getByLabel("Next follow-up date & time")).toHaveValue(
    original,
  );
  await lead.getByRole("button", { name: "Tomorrow, 9 AM" }).click();
  await lead.getByRole("tab", { name: "Lead details" }).click();
  await confirmation.getByRole("button", { name: "Discard changes" }).click();
  await lead.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(lead.getByLabel("Next follow-up date & time")).not.toBeVisible();
  await lead.getByRole("button", { name: "Close dialog" }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(lead).not.toBeVisible();
});

test("short viewports keep reminder controls, history and the composer in one scroll area", async ({
  page,
}, testInfo) => {
  const lead = page.getByRole("dialog");
  await lead.getByRole("button", { name: "Reschedule follow-up" }).click();
  await lead.getByLabel("Set a follow-up").check();
  for (const viewport of [
    { width: 900, height: 600 },
    { width: 390, height: 650 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const scrollers = await lead.evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>("*")]
        .filter(
          (node) =>
            /auto|scroll/.test(getComputedStyle(node).overflowY) &&
            node.scrollHeight > node.clientHeight + 1 &&
            node.tagName !== "TEXTAREA",
        )
        .map((node) => node.className),
    );
    expect(scrollers).toEqual(["timeline-content"]);
    await lead
      .getByRole("button", { name: "Save follow-up", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      lead.getByRole("button", { name: "Save follow-up", exact: true }),
    ).toBeInViewport();
    await lead
      .getByRole("button", { name: "Save discussion" })
      .scrollIntoViewIfNeeded();
    await expect(
      lead.getByRole("button", { name: "Save discussion" }),
    ).toBeInViewport();
    await expect(
      lead.getByRole("button", { name: "Close dialog" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize(
    testInfo.project.name === "mobile"
      ? { width: 390, height: 844 }
      : { width: 1100, height: 850 },
  );
  await lead.locator(".timeline-content").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: testInfo.outputPath("timeline-layout.png") });
});
