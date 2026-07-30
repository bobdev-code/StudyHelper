import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("loads heavy learning areas on demand", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const moduleName of ["portfolioAcademy", "examWorkspace", "examAids", "modelsView", "videosView", "taxPrepView"]) {
    assert.match(page, new RegExp(`lazy\\(\\(\\) => import\\("\\./${moduleName}"\\)`));
  }
  assert.doesNotMatch(page, /import \{ (?:PortfolioAcademy|ExamWorkspace|ExamAidPanel) \} from/);
  assert.ok(Buffer.byteLength(page) < 125_000, `page.tsx is still ${Buffer.byteLength(page)} bytes`);
});

test("ships English UI coverage for previously German-only learning areas", async () => {
  const [page, academy, models, videos, taxPrep] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/portfolioAcademy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/modelsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/videosView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/taxPrepView.tsx", import.meta.url), "utf8"),
  ]);
  for (const phrase of ["Open menu", "Your error log", "Today’s focus", "Portfolio calculation lab"]) {
    assert.match(page, new RegExp(phrase));
  }
  for (const phrase of ["Portfolio exam workshop", "Formula decision tree", "Error detective", "recorded attempts"]) {
    assert.match(academy, new RegExp(phrase));
  }
  assert.match(models, /Exam knowledge as a process/);
  assert.match(videos, /CURATED EXPLAINER VIDEOS/);
  assert.match(taxPrep, /Preparation complete · Start diagnostic/);
});

test("provides an installable and update-safe offline shell", async () => {
  const [manifestText, worker, controls, offline] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/pwaControls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/offline.html", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  assert.match(worker, /event\.request\.mode === "navigate"/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /SKIP_WAITING/);
  assert.match(controls, /beforeinstallprompt/);
  assert.match(controls, /Offline – saved content available/);
  assert.match(offline, /You are offline/);
});
