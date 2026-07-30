import { isExamAnswerComplete } from "./examSafety.ts";
import type { ExamBlock } from "./data/exams";
import type { AppProgress, ExamSession, Subject } from "./types";

export type ExamRepairTarget = {
  blockId: string;
  subject: Subject;
  topic: string;
  lostPoints: number;
  errorType: ExamBlock["errorType"];
};

export function examResultInsights(session: ExamSession, blocks: ExamBlock[]) {
  const scoreFor = (block: ExamBlock) => block.responseType === "choice"
    ? session.answers[block.id] === block.correctOption ? block.points : 0
    : session.selfScores?.[block.id] ?? 0;
  const durationMs = Object.values(session.blockDurationsMs ?? {}).reduce((sum, value) => sum + value, 0)
    || Math.max(0, new Date(session.completedAt ?? session.updatedAt ?? session.startedAt).getTime() - new Date(session.startedAt).getTime());
  const scored = blocks.map((block) => {
    const score = scoreFor(block);
    return { block, score, lostPoints: Math.max(0, block.points - score) };
  });
  const score = scored.reduce((sum, item) => sum + item.score, 0);
  const maxScore = blocks.reduce((sum, item) => sum + item.points, 0);
  const lostByError = scored.reduce<Record<string, number>>((result, item) => {
    if (item.lostPoints > 0) result[item.block.errorType] = (result[item.block.errorType] ?? 0) + item.lostPoints;
    return result;
  }, {});
  const lostByTopic = scored.reduce<Record<string, number>>((result, item) => {
    if (item.lostPoints > 0) result[item.block.topic] = (result[item.block.topic] ?? 0) + item.lostPoints;
    return result;
  }, {});
  const repairTargets: ExamRepairTarget[] = scored
    .filter((item) => item.lostPoints > 0)
    .sort((a, b) => b.lostPoints - a.lostPoints || a.block.targetMinutes - b.block.targetMinutes)
    .slice(0, 5)
    .map((item) => ({
      blockId: item.block.id,
      subject: item.block.subject,
      topic: item.block.topic,
      lostPoints: item.lostPoints,
      errorType: item.block.errorType,
    }));

  return {
    score,
    maxScore,
    durationMs,
    minutesUsed: Math.round(durationMs / 60_000),
    minutesPerPoint: score > 0 ? Math.round(durationMs / 60_000 / score * 10) / 10 : null,
    unanswered: blocks.filter((block) => !isExamAnswerComplete(session.answers[block.id])).map((block) => block.id),
    lostByError,
    lostByTopic,
    repairTargets,
  };
}

export function examCoachSnapshot(progress: AppProgress, subject: Subject, now = new Date()) {
  const examDate = new Date(progress.settings.examDate);
  const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / 86_400_000));
  const completed = progress.exams
    .filter((item) => item.subject === subject && item.score !== undefined && item.maxScore)
    .sort((a, b) => (a.completedAt ?? a.startedAt).localeCompare(b.completedAt ?? b.startedAt));
  const last = completed.at(-1);
  const fullMocks = completed.filter((item) => (item.maxScore ?? 0) === 90);
  const recentFull = fullMocks.at(-1);
  const openRepairs = (progress.repairs ?? []).filter((item) => item.subject === subject && item.status === "open");
  const recommendedMode = !recentFull || daysLeft <= 2 ? "full-mock" : openRepairs.length ? "repair" : "section";
  return {
    daysLeft,
    last,
    recentFull,
    openRepairs: openRepairs.length,
    recommendedMode,
  } as const;
}
