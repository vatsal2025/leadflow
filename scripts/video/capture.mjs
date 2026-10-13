import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("@playwright/test");
const out = path.join(root, ".tools/video");
await mkdir(out, { recursive: true });
const scenes = JSON.parse(
  await readFile(path.join(out, "scenes.json"), "utf8"),
);
const base = process.env.LEADFLOW_URL || "http://localhost:3000";
const password = process.env.LEADFLOW_PASSWORD || "e2e-workspace-password";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 1,
  timezoneId: "Asia/Kolkata",
  reducedMotion: "reduce",
  recordVideo: {
    dir: path.join(out, "raw"),
    size: { width: 1440, height: 810 },
  },
});
const login = await context.request.post(`${base}/api/auth/login`, {
  headers: { "X-Leadflow-Client": "web" },
  data: { password },
});
if (!login.ok()) throw new Error(`Recording login failed (${login.status()})`);
const name = "Sofia Bennett";
const errors = [];
try {
  for (const scene of scenes) {
    if (["intro", "delivery"].includes(scene.id)) continue;
    const sceneContext =
      scene.id === "quality"
        ? await browser.newContext({
            viewport: { width: 390, height: 810 },
            timezoneId: "Asia/Kolkata",
            reducedMotion: "reduce",
            storageState: await context.storageState(),
            recordVideo: {
              dir: path.join(out, "raw"),
              size: { width: 390, height: 810 },
            },
          })
        : context;
    const page = await sceneContext.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.getByRole("heading", { name: "Your leads" }).waitFor();
    await page.locator(".lead-row").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (scene.id !== "quality")
      await page
        .locator(".leads-panel")
        .evaluate((element) => element.scrollIntoView({ block: "start" }));
    // A visible pointer makes screen-recorded interactions easy to follow.
    await page.addStyleTag({
      content:
        "#video-pointer{position:fixed;z-index:2147483647;pointer-events:none;width:22px;height:22px;border:2px solid #b58029;border-radius:50%;background:#e8bf6440;transform:translate(-50%,-50%);transition:left .16s,top .16s;left:-50px;top:-50px}",
    });
    await page.evaluate(() => {
      const p = document.createElement("div");
      p.id = "video-pointer";
      document.body.append(p);
    });
    const started = performance.now();
    async function at(seconds, action) {
      await page.waitForTimeout(
        Math.max(0, seconds * 1000 - (performance.now() - started)),
      );
      await action();
    }
    async function click(locator) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (box)
        await page.evaluate(
          ({ x, y }) => {
            const p = document.getElementById("video-pointer");
            p.style.left = `${x}px`;
            p.style.top = `${y}px`;
          },
          { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        );
      await page.waitForTimeout(220);
      await locator.click();
    }
    async function openLead() {
      await page.getByRole("searchbox").fill(name);
      await click(
        page.getByRole("button", { name: `Open ${name}`, exact: true }),
      );
    }
    const dialog = page.getByRole("dialog");
    if (scene.id === "overview") {
      await at(3, () =>
        click(page.getByRole("button", { name: "Qualified", exact: true })),
      );
      await at(6, () => click(page.getByRole("button", { name: /^All \d/ })));
      await at(9, () => page.getByRole("searchbox").fill("Aarav"));
      await at(12, () => page.getByRole("searchbox").fill(""));
    } else if (scene.id === "create") {
      await at(1, () =>
        click(page.getByRole("button", { name: "Add new lead" })),
      );
      await at(2, () => dialog.getByLabel("Full name").fill(name));
      await at(3, () =>
        dialog.getByLabel("Company").fill("Evergreen Advisory"),
      );
      await at(4, () =>
        dialog.getByLabel("Phone number").fill("+91 90000 01001"),
      );
      await at(5, () =>
        dialog.getByLabel("Email address").fill("sofia@example.com"),
      );
      await at(6, () =>
        dialog.getByLabel("Lead source").fill("Client referral"),
      );
      await at(7, () =>
        dialog.getByLabel("Priority", { exact: true }).selectOption("High"),
      );
      await at(8, () =>
        dialog.getByLabel("Estimated deal value").fill("75000"),
      );
      await at(10, () =>
        click(dialog.getByRole("button", { name: "Add lead", exact: true })),
      );
      await at(12, () => page.getByRole("searchbox").fill(name));
    } else if (scene.id === "timeline") {
      await at(1, openLead);
      await at(3, () =>
        dialog.getByLabel("Activity type").selectOption("Call"),
      );
      await at(4, () =>
        dialog
          .getByLabel("Add a discussion")
          .fill(
            "Discussed team priorities. Send a tailored proposal before our next call.",
          ),
      );
      await at(6, () => dialog.getByLabel("Set a follow-up").check());
      const today = await page.evaluate(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T23:45`;
      });
      await at(7, () => dialog.getByLabel("Follow-up date & time").fill(today));
      await at(9, () =>
        click(dialog.getByRole("button", { name: "Save discussion" })),
      );
      await dialog.locator(".note-card").first().waitFor();
      await at(11, () =>
        dialog.getByLabel("Status", { exact: true }).selectOption("Qualified"),
      );
      await at(13, () =>
        click(dialog.getByRole("button", { name: "Close dialog" })),
      );
      await at(15, () => page.reload());
    } else if (scene.id === "pipeline") {
      await at(1, () =>
        click(page.getByRole("button", { name: "Pipeline", exact: true })),
      );
      await page
        .locator(".pipeline-board")
        .evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.getByLabel(`Move ${name} to stage`, { exact: true }).waitFor();
      await at(7, () =>
        page
          .getByLabel(`Move ${name} to stage`, { exact: true })
          .selectOption("Proposal Sent"),
      );
      await at(12, () =>
        page
          .getByRole("region", { name: "Proposal Sent stage", exact: true })
          .scrollIntoViewIfNeeded(),
      );
    } else if (scene.id === "attention") {
      await at(2, () =>
        click(
          page.getByRole("button", { name: "Needs attention", exact: true }),
        ),
      );
      await at(6, () =>
        click(page.getByRole("button", { name: "No next step", exact: true })),
      );
      await at(10, () =>
        click(page.getByRole("button", { name: "All leads", exact: true })),
      );
      await at(12, () =>
        page.getByLabel("Filter priority").selectOption("High"),
      );
    } else if (scene.id === "profile") {
      await at(1, openLead);
      await at(2.5, () =>
        click(dialog.getByRole("tab", { name: "Lead details" })),
      );
      await at(3.5, () =>
        dialog.getByLabel("Lead source").fill("Partner referral"),
      );
      await at(4.5, () =>
        click(dialog.getByRole("button", { name: "Save lead details" })),
      );
      await at(6, () =>
        click(
          dialog.getByRole("button", { name: "Archive lead", exact: true }),
        ),
      );
      await dialog.getByRole("button", { name: "Restore lead" }).waitFor();
      await at(7.5, () =>
        click(dialog.getByRole("button", { name: "Close dialog" })),
      );
      await at(8.5, () =>
        page.getByLabel("Lead visibility").selectOption("archived"),
      );
      await at(9.5, () =>
        click(page.getByRole("button", { name: `Open ${name}`, exact: true })),
      );
      await at(11, () =>
        click(dialog.getByRole("tab", { name: "Lead details" })),
      );
      await at(12, () =>
        click(dialog.getByRole("button", { name: "Restore lead" })),
      );
    } else if (scene.id === "exports") {
      await at(1, openLead);
      await at(3, () =>
        click(
          dialog.getByRole("button", {
            name: "Reschedule follow-up",
            exact: true,
          }),
        ),
      );
      await at(4, () =>
        click(dialog.getByRole("button", { name: "Tomorrow, 9 AM" })),
      );
      await at(5.5, () =>
        click(
          dialog.getByRole("button", { name: "Save follow-up", exact: true }),
        ),
      );
      await at(8, async () => {
        const waiting = page.waitForEvent("download");
        await click(
          dialog.getByRole("button", { name: "Calendar (.ics)", exact: true }),
        );
        await (await waiting).saveAs(path.join(out, "example-follow-up.ics"));
      });
      await at(10.5, () =>
        click(dialog.getByRole("button", { name: "Mark complete" })),
      );
      await at(12, () =>
        click(dialog.getByRole("button", { name: "Close dialog" })),
      );
      await at(14, async () => {
        const waiting = page.waitForEvent("download");
        await click(
          page.getByRole("button", { name: "Export CSV", exact: true }),
        );
        await (await waiting).saveAs(path.join(out, "example-leads.csv"));
      });
    } else if (scene.id === "quality") {
      await at(2, () => page.setViewportSize({ width: 390, height: 810 }));
      await at(5, () => page.locator(".leads-panel").scrollIntoViewIfNeeded());
      await at(9, () => page.getByRole("searchbox").fill(name));
      await at(11, () =>
        click(page.getByRole("button", { name: `Open ${name}`, exact: true })),
      );
      await at(16, () =>
        click(dialog.getByRole("button", { name: "Close dialog" })),
      );
    }
    const elapsed = (performance.now() - started) / 1000;
    if (elapsed > scene.duration)
      throw new Error(`${scene.id} exceeded planned duration: ${elapsed}`);
    await page.waitForTimeout((scene.duration - elapsed) * 1000);
    const video = page.video();
    await page.close();
    await video.saveAs(path.join(out, `${scene.id}.webm`));
    if (sceneContext !== context) await sceneContext.close();
    console.log(`Recorded ${scene.id}: ${scene.duration}s`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    path.join(out, "capture-verification.json"),
    JSON.stringify(
      {
        pageErrors: errors,
        source: base,
        recordedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
