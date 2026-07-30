import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  combinedTaxExamVariants,
  examModes,
  germanTaxExamVariants,
  internationalTaxExamVariants,
  portfolioExamVariants,
} from "../lib/data/exams.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("ships rotating source-bound 90-point mock banks", () => {
  assert.equal(portfolioExamVariants.length, 3);
  assert.equal(combinedTaxExamVariants.length, 3);
  for (const variant of [...portfolioExamVariants, ...combinedTaxExamVariants]) {
    assert.equal(variant.blocks.reduce((sum, block) => sum + block.points, 0), 90);
    assert.ok(variant.blocks.every((block) => block.rubric.length > 0 && block.source.document));
  }
  for (const variant of portfolioExamVariants) {
    assert.equal(variant.blocks.length, 13);
    assert.deepEqual(variant.blocks.slice(0, 4).map((block) => block.points), [6, 6, 6, 6]);
    assert.deepEqual(variant.blocks.slice(4, 9).map((block) => block.points), [3, 3, 4, 4, 4]);
    assert.deepEqual(variant.blocks.slice(9).map((block) => block.points), [20, 9, 9, 10]);
  }
});

test("splits Taxation into rotating 60-, 30- and 90-point modes", async () => {
  const [examUi, types] = await Promise.all([
    read("../app/examWorkspace.tsx"),
    read("../lib/types.ts"),
  ]);
  assert.deepEqual(
    [examModes["tax-german"], examModes["tax-international"], examModes["tax-combined"]].map((mode) => [mode.durationMinutes, mode.maxPoints]),
    [[60, 60], [30, 30], [90, 90]],
  );
  assert.equal(germanTaxExamVariants.length, 3);
  assert.equal(internationalTaxExamVariants.length, 3);
  assert.ok(germanTaxExamVariants.every((variant) => variant.blocks.reduce((sum, block) => sum + block.points, 0) === 60));
  assert.ok(internationalTaxExamVariants.every((variant) => variant.blocks.reduce((sum, block) => sum + block.points, 0) === 30));
  assert.ok(germanTaxExamVariants.every((variant) => variant.blocks.some((block) => block.responseType === "diagram")));
  assert.match(examUi, /Taxation folgt der echten Gewichtung/);
  assert.match(types, /examModeId\?: ExamModeId/);
  assert.match(types, /examVariantId\?: string/);
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
