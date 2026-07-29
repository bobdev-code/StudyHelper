import { flashcards, quizQuestions } from "./data";
import { stabilizedForecast } from "./forecast";
import type { AnswerRecord, AppProgress, LearningAttempt, LearningStage, StudySession, Subject } from "./types";

export type TopicMastery = {
  subject: Subject;
  topic: string;
  attempts: number;
  days: number;
  accuracy: number;
  speed: number;
  confidenceCalibration: number;
  mastery: number;
  status: "neu" | "Lücke" | "im Aufbau" | "fast sicher" | "beherrscht";
  nextDueAt: string;
  highestStage: LearningStage | "none";
  variants: number;
};

const stageRank: Record<LearningStage, number> = { recall: 1, application: 2, transfer: 3, timed: 4 };

function legacyAttempt(answer: AnswerRecord): LearningAttempt {
  return {
    id: `legacy-${answer.id}`,
    activityId: answer.questionId,
    variantId: answer.questionId,
    subject: answer.subject,
    topic: answer.topic,
    mode: answer.examSessionId ? "exam" : "quiz",
    stage: answer.examSessionId ? "timed" : answer.questionId.startsWith("lab-") || answer.questionId.startsWith("tax-lab-") ? "application" : "recall",
    score: answer.correct ? 1 : 0,
    maxScore: 1,
    durationMs: answer.durationMs,
    confidence: answer.confidence,
    errorTypes: answer.errorType ? [answer.errorType] : [],
    hintsUsed: 0,
    completedAt: answer.answeredAt,
    examSessionId: answer.examSessionId,
    difficulty: answer.difficulty,
  };
}

export function topicMastery(progress: AppProgress, includeExamAttempts = true): TopicMastery[] {
  const all = new Map<string, { subject: Subject; topic: string; attempts: LearningAttempt[] }>();
  [...flashcards, ...quizQuestions].forEach((item) => {
    const key = `${item.subject}:${item.topic}`;
    if (!all.has(key)) all.set(key, { subject: item.subject, topic: item.topic, attempts: [] });
  });
  const explicitIds = new Set((progress.attempts ?? []).map((item) => item.id));
  const attempts = [
    ...(progress.attempts ?? []),
    ...progress.answers.filter((answer) => !explicitIds.has(`answer-${answer.id}`)).map(legacyAttempt),
  ].filter((item) => includeExamAttempts || item.mode !== "exam")
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  attempts.forEach((attempt) => {
    const key = `${attempt.subject}:${attempt.topic}`;
    const row = all.get(key) ?? { subject: attempt.subject, topic: attempt.topic, attempts: [] };
    row.attempts.push(attempt);
    all.set(key, row);
  });

  return [...all.values()].map(({ subject, topic, attempts: topicAttempts }) => {
    const recent = topicAttempts.slice(-8);
    const attemptWeight = (item: LearningAttempt, index: number) => {
      const modeWeight = item.mode === "flashcard"
        ? 0.55
        : item.mode === "quiz"
          ? 0.9
          : item.mode === "exam"
            ? 1.6
            : item.mode === "portfolio-detective"
              ? 0.85
              : item.mode === "calculation-lab" || item.mode === "tax-case" || item.mode === "portfolio-chain"
                ? 1.3
                : 1;
      return (index + 1) * (item.difficulty ?? 2) / 2 * modeWeight;
    };
    const weightTotal = recent.reduce((sum, item, index) => sum + attemptWeight(item, index), 0) || 1;
    const accuracy = Math.round(recent.reduce((sum, item, index) => sum + (item.maxScore ? item.score / item.maxScore : 0) * attemptWeight(item, index), 0) / weightTotal * 100);
    const timed = recent.filter((item) => item.durationMs > 0);
    const speed = timed.length ? Math.round(timed.reduce((sum, item) => {
      const expected = item.stage === "timed" ? 10 * 60_000 : item.mode === "calculation-lab" || item.mode === "tax-case" ? 8 * 60_000 : 75_000;
      return sum + Math.min(1, expected / item.durationMs);
    }, 0) / timed.length * 100) : 50;
    const calibrated = recent.filter((item) => {
      const correct = item.maxScore > 0 && item.score / item.maxScore >= .7;
      return (item.confidence === "high") === correct || (item.confidence === "low") !== correct;
    }).length;
    const confidenceCalibration = recent.length ? Math.round(calibrated / recent.length * 100) : 50;
    const days = new Set(topicAttempts.map((item) => item.completedAt.slice(0, 10))).size;
    const variants = new Set(topicAttempts.map((item) => item.variantId)).size;
    const highestRank = topicAttempts.reduce((rank, item) => Math.max(rank, stageRank[item.stage]), 0);
    const highestStage = (Object.entries(stageRank).find(([, rank]) => rank === highestRank)?.[0] ?? "none") as LearningStage | "none";
    const evidence = Math.min(100, highestRank * 18 + Math.min(18, variants * 6) + Math.min(10, days * 5));
    const mastery = topicAttempts.length ? Math.round(accuracy * .55 + speed * .1 + confidenceCalibration * .1 + evidence * .25) : 0;
    const last = topicAttempts.at(-1);
    const dangerous = recent.some((item) => item.maxScore > 0 && item.score / item.maxScore < .7 && item.confidence === "high");
    const intervalDays = mastery >= 80 && days >= 2 ? 7 : mastery >= 60 ? 3 : dangerous ? 0 : 1;
    const nextDueAt = new Date((last ? new Date(last.completedAt).getTime() : 0) + intervalDays * 86_400_000).toISOString();
    const status: TopicMastery["status"] = !topicAttempts.length ? "neu" : mastery < 45 ? "Lücke" : mastery < 65 ? "im Aufbau" : mastery < 80 || highestRank < 3 ? "fast sicher" : "beherrscht";
    return { subject, topic, attempts: topicAttempts.length, days, accuracy, speed, confidenceCalibration, mastery, status, nextDueAt, highestStage, variants };
  }).sort((a, b) => a.mastery - b.mastery || b.attempts - a.attempts);
}

export function scoreForecast(progress: AppProgress, subject: Subject) {
  const baseline = subject === "portfolio" ? 29 : 50;
  const rows = topicMastery(progress, false).filter((item) => item.subject === subject);
  const recentExams = progress.exams.filter((item) => item.subject === subject && item.score !== undefined && item.maxScore).slice(-5);
  return stabilizedForecast({
    baseline,
    topics: rows.map((item) => ({
      weight: 1,
      mastery: item.mastery,
      attempts: item.attempts,
      days: item.days,
      variants: item.variants,
      highestStage: item.highestStage,
    })),
    exams: recentExams.map((item) => ({ score: item.score!, maxScore: item.maxScore! })),
  });
}

export type PlanSubject = Subject | "all";

export function adaptiveQueue(progress: AppProgress, minutes: number, subject: PlanSubject = "all") {
  const now = Date.now();
  const rows = topicMastery(progress).filter((item) => subject === "all" || item.subject === subject);
  const ranked = rows.map((item) => {
    const latest = [...progress.answers].reverse().find((answer) => answer.subject === item.subject && answer.topic === item.topic);
    const overdue = item.attempts > 0 && new Date(item.nextDueAt).getTime() <= now;
    const dangerous = latest && !latest.correct && latest.confidence === "high";
    const priority = (overdue ? 40 : 0) + (dangerous ? 35 : 0) + (100 - item.mastery) + (item.subject === "portfolio" ? 8 : 0);
    const reasonKey = dangerous ? "false-confidence" : overdue ? "due" : item.attempts ? "weak-high-value" : "coverage";
    return { ...item, priority, reasonKey, reason: dangerous ? "Scheinsicherheit korrigieren" : overdue ? "Wiederholung ist fällig" : item.attempts ? "Punktestarke Lücke schließen" : "Neu lernen" };
  }).sort((a,b)=>b.priority-a.priority);
  const size = Math.max(3, Math.min(8, Math.ceil(minutes / 7)));
  if (subject !== "all") return ranked.slice(0, size);

  const portfolio = ranked.filter((item) => item.subject === "portfolio");
  const tax = ranked.filter((item) => item.subject === "tax");
  const portfolioWeight = progress.settings.subjectWeights?.portfolio ?? 50;
  const portfolioTarget = progress.settings.dailyTargets?.portfolio ?? 20;
  const taxTarget = progress.settings.dailyTargets?.tax ?? 20;
  const targetWeight = portfolioTarget / Math.max(1, portfolioTarget + taxTarget) * 100;
  const effectivePortfolioWeight = (portfolioWeight + targetWeight) / 2;
  let portfolioSlots = Math.round(size * effectivePortfolioWeight / 100);
  portfolioSlots = Math.max(1, Math.min(size - 1, portfolioSlots));
  const selected = [...portfolio.slice(0, portfolioSlots), ...tax.slice(0, size - portfolioSlots)];
  return selected.sort((a, b) => b.priority - a.priority);
}

export function averageSubjectMastery(progress: AppProgress, subject: Subject) {
  const rows = topicMastery(progress).filter((item) => item.subject === subject);
  return rows.length ? Math.round(rows.reduce((sum, item) => sum + item.mastery, 0) / rows.length) : 0;
}

export function createStudySession(progress: AppProgress, minutes: number, subject: PlanSubject = "all"): StudySession {
  const now = new Date().toISOString();
  const queue = adaptiveQueue(progress, minutes, subject);
  const perItem = Math.max(3, Math.round(minutes / Math.max(1, queue.length)));
  return {
    id: `study-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subject,
    plannedMinutes: minutes,
    startedAt: now,
    updatedAt: now,
    currentIndex: 0,
    items: queue.map((item) => ({
      id: `${item.subject}:${item.topic}`,
      subject: item.subject,
      topic: item.topic,
      view: item.attempts === 0 && flashcards.some((card) => card.subject === item.subject && card.topic === item.topic) ? "cards" : "quiz",
      estimatedMinutes: perItem,
    })),
    completedItemIds: [],
    baselineMastery: {
      portfolio: averageSubjectMastery(progress, "portfolio"),
      tax: averageSubjectMastery(progress, "tax"),
    },
  };
}

export function subjectCoverage(progress: AppProgress, subject: Subject) {
  const rows = topicMastery(progress).filter((item) => item.subject === subject);
  const total = rows.length || 1;
  return {
    total: rows.length,
    learned: rows.filter((item) => item.attempts > 0).length,
    practised: rows.filter((item) => item.highestStage !== "none" && stageRank[item.highestStage] >= 2).length,
    transferred: rows.filter((item) => item.highestStage !== "none" && stageRank[item.highestStage] >= 3 && item.variants >= 2).length,
    examReady: rows.filter((item) => item.highestStage === "timed" && item.mastery >= 70).length,
    percent: (value: number) => Math.round(value / total * 100),
  };
}
