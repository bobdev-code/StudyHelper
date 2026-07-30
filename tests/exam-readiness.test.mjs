import assert from "node:assert/strict";
import test from "node:test";
import { examResultInsights, examCoachSnapshot } from "../lib/examAnalytics.ts";
import { examModes, selectExamVariant } from "../lib/data/exams.ts";
import { isExamAnswerComplete, ungradedTextBlockIds } from "../lib/examSafety.ts";
import { defaultProgress } from "../lib/storage.ts";

test("rotates away from the most recently used exam variant", () => {
  const mode = examModes["portfolio-full"];
  const chosen = selectExamVariant("portfolio-full", [mode.variants[0].id], () => 0);
  assert.notEqual(chosen.id, mode.variants[0].id);
  assert.equal(chosen.blocks.reduce((sum, block) => sum + block.points, 0), 90);
});

test("requires a meaningful tax diagram and manual grading", () => {
  const diagram = { nodes: [{ id: 1 }, { id: 2 }], edges: [{ id: 1, from: 1, to: 2 }] };
  assert.equal(isExamAnswerComplete({ nodes: [], edges: [] }), false);
  assert.equal(isExamAnswerComplete(diagram), true);
  assert.deepEqual(ungradedTextBlockIds([{ id: "d", responseType: "diagram" }], {}), ["d"]);
  assert.deepEqual(ungradedTextBlockIds([{ id: "d", responseType: "diagram" }], { d: 0 }), []);
});

test("reports score, time, lost points and repair priorities", () => {
  const blocks = examModes["tax-international"].variants[0].blocks;
  const session = {
    id: "exam-test",
    subject: "tax",
    startedAt: "2026-07-30T10:00:00.000Z",
    completedAt: "2026-07-30T10:30:00.000Z",
    questionIds: blocks.map((block) => block.id),
    answers: { [blocks[0].id]: "structured answer", [blocks[1].id]: "structured answer" },
    confidences: {},
    selfScores: { [blocks[0].id]: 8, [blocks[1].id]: 4, [blocks[2].id]: 0 },
    blockDurationsMs: { [blocks[0].id]: 600_000, [blocks[1].id]: 900_000, [blocks[2].id]: 300_000 },
  };
  const insights = examResultInsights(session, blocks);
  assert.equal(insights.score, 12);
  assert.equal(insights.maxScore, 30);
  assert.equal(insights.minutesUsed, 30);
  assert.equal(insights.unanswered.length, 1);
  assert.equal(insights.repairTargets.length, 3);
  assert.equal(Object.values(insights.lostByTopic).reduce((sum, value) => sum + value, 0), 18);
});

test("coach recommends a full mock until one has been completed", () => {
  const snapshot = examCoachSnapshot(defaultProgress, "portfolio", new Date("2026-07-30T09:00:00-03:00"));
  assert.equal(snapshot.recommendedMode, "full-mock");
  assert.equal(snapshot.recentFull, undefined);
});
