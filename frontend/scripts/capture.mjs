/* global document */
import console from "node:console";
import { chromium, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const output = path.resolve(import.meta.dirname, "../../docs/screenshots");
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
    timezoneId: "Asia/Kolkata",
  });
  const page = await context.newPage();
  await page.goto(process.env.LEADFLOW_URL || "http://localhost:3000");
  await page.getByRole("button", { name: "Open Aarav Mehta" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(output, "01-workspace.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open Aarav Mehta" }).click();
  await page.getByRole("dialog").locator(".note-card").first().waitFor();
  await page.screenshot({
    path: path.join(output, "02-timeline.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await page
    .getByRole("region", { name: "Qualified stage", exact: true })
    .getByRole("button", { name: "Open Aarav Mehta" })
    .waitFor();
  await page.screenshot({
    path: path.join(output, "05-pipeline.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Add new lead" }).click();
  await page.getByLabel("Full name").fill("Sofia Bennett");
  await page.getByLabel("Company").fill("Evergreen Advisory");
  await page.getByLabel("Phone number").fill("+91 98765 43210");
  await page.getByLabel("Email address").fill("sofia@example.com");
  await page.getByLabel("Lead source").fill("Client referral");
  await page.getByLabel("Priority", { exact: true }).selectOption("High");
  await page.getByLabel("Estimated deal value").fill("15000.00");
  await page.screenshot({
    path: path.join(output, "03-add-lead.png"),
    fullPage: false,
  });
  await context.close();
  const mobile = await browser.newContext({
    ...devices["iPhone 13"],
    timezoneId: "Asia/Kolkata",
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(process.env.LEADFLOW_URL || "http://localhost:3000");
  await mobilePage.getByRole("button", { name: "Open Aarav Mehta" }).waitFor();
  await mobilePage.evaluate(() => document.fonts.ready);
  await mobilePage.screenshot({
    path: path.join(output, "04-mobile.png"),
    fullPage: true,
  });
  await mobile.close();
  console.log(`Saved five application screenshots to ${output}`);
} finally {
  await browser.close();
}
