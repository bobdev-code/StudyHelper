import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { stabilizedForecast } from "../lib/forecast.ts";
import {
  examRemainingSeconds,
  firstResumeBlockIndex,
  isExamAnswerComplete,
  ungradedTextBlockIds,
  unansweredExamBlockIds,
} from "../lib/examSafety.ts";

const blankTopics = (count = 10) => Array.from({ length: count }, () => ({
  weight: 1,
  mastery: 0,
  attempts: 0,
  days: 0,
  variants: 0,
  highestStage: "none",
}));

test("keeps neutral forecast baselines for untested users", () => {
  assert.deepEqual(stabilizedForecast({ baseline: 29, topics: blankTopics(), exams: [] }), { low: 29, high: 29, central: 29 });
  assert.deepEqual(stabilizedForecast({ baseline: 50, topics: blankTopics(), exams: [] }), { low: 50, high: 50, central: 50 });
});

test("bounds the effect of one small learning attempt", () => {
  const good = blankTopics();
  good[0] = { weight: 1, mastery: 90, attempts: 1, days: 1, variants: 1, highestStage: "transfer" };
  const poor = blankTopics();
  poor[0] = { weight: 1, mastery: 10, attempts: 1, days: 1, variants: 1, highestStage: "recall" };
  const goodForecast = stabilizedForecast({ baseline: 50, topics: good, exams: [] });
  const poorForecast = stabilizedForecast({ baseline: 50, topics: poor, exams: [] });
  assert.ok(goodForecast.central >= 50 && goodForecast.central <= 55, JSON.stringify(goodForecast));
  assert.ok(poorForecast.central <= 50 && poorForecast.central >= 45, JSON.stringify(poorForecast));
});

test("weights section exams less than full exams", () => {
  const topics = blankTopics().map((item) => ({ ...item, mastery: 70, attempts: 8, days: 4, variants: 5, highestStage: "timed" }));
  const noExam = stabilizedForecast({ baseline: 50, topics, exams: [] });
  const section = stabilizedForecast({ baseline: 50, topics, exams: [{ score: 0, maxScore: 30 }] });
  const full = stabilizedForecast({ baseline: 50, topics, exams: [{ score: 0, maxScore: 90 }] });
  assert.ok(Math.abs(section.central - noExam.central) < Math.abs(full.central - noExam.central));
});

test("distinguishes blank answers and explicit zero self-scores", () => {
  const blocks = [
    { id: "a", responseType: "choice" },
    { id: "b", responseType: "text" },
    { id: "c", responseType: "text" },
  ];
  assert.equal(isExamAnswerComplete(0), true);
  assert.equal(isExamAnswerComplete("   "), false);
  assert.deepEqual(unansweredExamBlockIds(blocks, { a: 0, b: "answer", c: " " }), ["c"]);
  assert.deepEqual(ungradedTextBlockIds(blocks, { b: 0 }), ["c"]);
  assert.deepEqual(ungradedTextBlockIds(blocks, { b: 0, c: 2 }), []);
});

test("resumes the first unfinished or ungraded block and clamps time", () => {
  const blocks = [
    { id: "a", responseType: "choice" },
    { id: "b", responseType: "text" },
    { id: "c", responseType: "text" },
  ];
  assert.equal(firstResumeBlockIndex(blocks, { a: 0, b: "" }, {}, false, "c"), 1);
  assert.equal(firstResumeBlockIndex(blocks, { a: 0, b: "x", c: "y" }, { b: 0 }, true, "a"), 2);
  assert.equal(examRemainingSeconds("2026-01-01T00:00:00.000Z", 30, new Date("2026-01-01T00:31:00.000Z").getTime()), 0);
});

test("connects the planned PR5 flows without passive scoring", async () => {
  const [page, academy, aids, adaptive, exam, types] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/portfolioAcademy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/examAids.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/adaptive.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/examWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/types.ts", import.meta.url), "utf8"),
  ]);
  assert.match(types, /activeStudySession\?: StudySession/);
  assert.match(page, /onSessionTaskComplete/);
  assert.match(page, /TrainingRunSummary/);
  assert.match(adaptive, /reason: dangerous[\s\S]*"Neu lernen"/);
  assert.doesNotMatch(academy, /errorTypes:\["Challenge gestartet"\]/);
  assert.match(academy, /Ein Versuch wird erst nach deiner tatsächlichen Abgabe gespeichert/);
  assert.match(academy, /aktiv mit MCQs prüfen/);
  assert.match(aids, /Zeichnung speichern/);
  assert.match(aids, /nicht automatisch bewertet/);
  assert.match(exam, /unansweredExamBlockIds/);
  assert.match(exam, /ungradedTextBlockIds/);
  assert.match(exam, /Restzeit/);
});
