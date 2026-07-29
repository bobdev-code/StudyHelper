import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("ships two source-bound 90-point exam plans", async () => {
  const exams = await read("../lib/data/exams.ts");
  const points = (prefix) => [...exams.matchAll(new RegExp(`id:\\s*"${prefix}-[^"]+"[\\s\\S]*?points:\\s*(\\d+),\\s*\\n\\s*targetMinutes`, "g"))]
    .map((match) => Number(match[1]));

  const portfolio = points("pe");
  const tax = points("te");
  assert.equal(portfolio.length, 7);
  assert.equal(tax.length, 7);
  assert.equal(portfolio.reduce((sum, value) => sum + value, 0), 90);
  assert.equal(tax.reduce((sum, value) => sum + value, 0), 90);
  assert.match(exams, /responseType: "text"/);
  assert.match(exams, /rubric:/);
});

test("removes dependent quiz wording and supplies all required values", async () => {
  const [portfolio, tax] = await Promise.all([
    read("../lib/data/portfolio.ts"),
    read("../lib/data/tax.ts"),
  ]);
  for (const wording of [
    "In the same setup",
    "Using the same data",
    "that Disney/Kraft-Heinz MVP",
    "previous partner",
  ]) {
    assert.equal(`${portfolio}\n${tax}`.includes(wording), false, `dependent wording remains: ${wording}`);
  }
  assert.match(portfolio, /Disney has σDIS=4\.3%/);
  assert.match(portfolio, /E\(rDIS\)=15\.7%/);
  assert.match(tax, /Partner B receives 2\/3/);
});

test("adds the verified EBS tax catalog and secondary Quizlet coverage", async () => {
  const supplement = await read("../lib/data/taxSupplement.ts");
  assert.ok((supplement.match(/card\("t\d{2}"/g) ?? []).length >= 20);
  assert.ok((supplement.match(/id:"tq\d{2}"/g) ?? []).length >= 20);
  assert.match(supplement, /EBS - Taxation - Single Choice Questions\.pdf/);
  assert.match(supplement, /Quizlet Patrick MCQ Tax\.pdf/);
  assert.match(supplement, /student-secondary/);
});

test("connects navigation, attempts, cloud merge and realistic exam UI", async () => {
  const [page, storage, types, examUi] = await Promise.all([
    read("../app/page.tsx"),
    read("../lib/storage.ts"),
    read("../lib/types.ts"),
    read("../app/examWorkspace.tsx"),
  ]);
  assert.match(page, /subject-switcher/);
  assert.match(page, /Guten Morgen, Admin/);
  assert.match(page, /Guten Tag, Admin/);
  assert.match(page, /Guten Abend, Admin/);
  assert.match(page, /mergeProgress/);
  assert.match(storage, /addLearningAttempt/);
  assert.match(storage, /sourceAttemptId/);
  assert.match(types, /LearningStage/);
  assert.match(examUi, /Freies Rechenblatt/);
  assert.match(examUi, /Teilpunkte-Rubrik/);
  assert.match(examUi, /markedQuestionIds/);
});

