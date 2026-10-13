import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("workspace password login, protected data, session persistence, and logout", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("Workspace password")).toBeVisible();
  expect((await page.request.get("/api/leads")).status()).toBe(401);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByLabel("Workspace password").fill("incorrect-password");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Incorrect workspace password",
  );
  await page.getByLabel("Workspace password").fill("e2e-workspace-password");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("heading", { name: "Your leads" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your leads" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Workspace password")).toBeVisible();
  expect((await page.request.get("/api/leads")).status()).toBe(401);
  await page.reload();
  await expect(page.getByLabel("Workspace password")).toBeVisible();
});
