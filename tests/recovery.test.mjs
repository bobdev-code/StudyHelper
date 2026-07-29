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

test("splits Taxation into a 60-minute German part, 30-minute international part and combined exam", async () => {
  const [exams, examUi, types] = await Promise.all([
    read("../lib/data/exams.ts"),
    read("../app/examWorkspace.tsx"),
    read("../lib/types.ts"),
  ]);
  assert.match(exams, /"tax-german"[\s\S]*?durationMinutes: 60,[\s\S]*?maxPoints: 60/);
  assert.match(exams, /"tax-international"[\s\S]*?durationMinutes: 30,[\s\S]*?maxPoints: 30/);
  assert.match(exams, /"tax-combined"[\s\S]*?durationMinutes: 90,[\s\S]*?maxPoints: 90/);
  assert.match(exams, /const germanTaxExamPlan = taxExamPlan\.slice\(0, 4\)/);
  assert.match(exams, /const internationalTaxExamPlan = taxExamPlan\.slice\(4\)/);
  assert.match(examUi, /Taxation folgt der echten Gewichtung/);
  assert.match(types, /examModeId\?: ExamModeId/);
});

test("offers three MCQ difficulty levels with balanced transfer variants", async () => {
  const [page, variants, index, adaptive] = await Promise.all([
    read("../app/page.tsx"),
    read("../lib/data/quizVariants.ts"),
    read("../lib/data/index.ts"),
    read("../lib/adaptive.ts"),
  ]);
  assert.match(page, /Basis/);
  assert.match(page, /Anwendung/);
  assert.match(page, /Transfer/);
  assert.match(page, /shuffleQuestionOptions/);
  assert.match(page, /difficulty: question\.difficulty/);
  assert.equal((variants.match(/"pqv\d{2}"/g) ?? []).length, 9);
  assert.equal((variants.match(/"tqv\d{2}"/g) ?? []).length, 7);
  assert.match(index, /\.\.\.quizVariants/);
  assert.match(adaptive, /item\.difficulty \?\? 2/);
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

test("deep-links adaptive recommendations and resets every lab item", async () => {
  const [page, adaptive] = await Promise.all([
    read("../app/page.tsx"),
    read("../lib/adaptive.ts"),
  ]);
  assert.match(page, /type LearningTarget = \{ subject: Subject; topic: string \}/);
  assert.match(page, /navigate\(targetView\(item\.attempts\), \{ subject: item\.subject, topic: item\.topic \}\)/);
  assert.match(page, /initialTopic=\{learningTarget\?\.topic\}/);
  assert.match(page, /topic === "all" \|\| item\.topic === topic/);
  assert.match(page, /<TaxCaseLab key=\{taxLabCases\[taxLabIndex\]\.id\}/);
  assert.match(page, /<CalculationLab key=\{labTasks\[labIndex\]\.id\}/);
  assert.match(page, /const showSubjectSwitcher = \["dashboard", "focus", "mastery", "plan"\]/);
  assert.match(page, /dailyMinutes:value/);
  assert.match(adaptive, /effectivePortfolioWeight/);
});

test("persists tax written answers and ships source-bound exam aids", async () => {
  const [page, types, aids, formulas, calculator, examUi, adaptive] = await Promise.all([
    read("../app/page.tsx"),
    read("../lib/types.ts"),
    read("../app/examAids.tsx"),
    read("../lib/data/examAids.ts"),
    read("../lib/calculator.ts"),
    read("../app/examWorkspace.tsx"),
    read("../lib/adaptive.ts"),
  ]);
  assert.match(page, /Antwort speichern & vergleichen/);
  assert.match(page, /writtenResponse, selfScore/);
  assert.match(types, /writtenResponse\?: string/);
  assert.match(types, /selfScore\?: number/);
  assert.equal((formulas.match(/number: \d+/g) ?? []).length, 44);
  assert.match(aids, /Formula_Sheet_2024_Exam\.pdf/);
  assert.match(aids, /Copy of German Tax Exam Prep\.pdf/);
  assert.match(aids, /Betriebsaufspaltung/);
  assert.match(aids, /TaxBurdenSimulator/);
  assert.match(calculator, /class ExpressionParser/);
  assert.doesNotMatch(calculator, /\beval\s*\(|new Function/);
  assert.match(examUi, /ExamAidPanel/);
  assert.match(adaptive, /item\.mode === "flashcard"[\s\S]*\? 0\.55/);
});
