import assert from "node:assert/strict";
import test from "node:test";
import { defaultProgress, mergeProgress } from "../lib/storage.ts";

const exam = (updatedAt, answers) => ({
  id: "exam-1",
  subject: "tax",
  examModeId: "tax-international",
  durationMinutes: 30,
  startedAt: "2026-07-29T10:00:00.000Z",
  updatedAt,
  questionIds: ["a", "b"],
  answers,
  confidences: {},
});

test("keeps the newest in-progress exam edit during cloud merge", () => {
  const remote = { ...structuredClone(defaultProgress), exams: [exam("2026-07-29T10:05:00.000Z", { a: 0 })] };
  const local = { ...structuredClone(defaultProgress), exams: [exam("2026-07-29T10:10:00.000Z", { a: 0, b: "saved" })] };
  const merged = mergeProgress(local, remote);
  assert.deepEqual(merged.exams[0].answers, { a: 0, b: "saved" });
  assert.deepEqual(mergeProgress(merged, merged).exams, merged.exams);
});

test("merges saved tax drawings and the newest active session", () => {
  const local = {
    ...structuredClone(defaultProgress),
    taxDiagrams: [{ id: "d1", name: "new", nodes: [], edges: [], updatedAt: "2026-07-29T11:00:00.000Z" }],
    activeStudySession: { id: "s1", subject: "tax", plannedMinutes: 30, startedAt: "2026-07-29T10:00:00.000Z", updatedAt: "2026-07-29T11:00:00.000Z", currentIndex: 1, items: [], completedItemIds: [], baselineMastery: { portfolio: 0, tax: 0 } },
  };
  const remote = {
    ...structuredClone(defaultProgress),
    taxDiagrams: [{ id: "d1", name: "old", nodes: [], edges: [], updatedAt: "2026-07-29T10:00:00.000Z" }],
    activeStudySession: { ...local.activeStudySession, updatedAt: "2026-07-29T10:00:00.000Z", currentIndex: 0 },
  };
  const merged = mergeProgress(local, remote);
  assert.equal(merged.taxDiagrams[0].name, "new");
  assert.equal(merged.activeStudySession.currentIndex, 1);
});
