import { flashcards, quizQuestions } from "./data";
import type { AnswerRecord, AppProgress, Subject } from "./types";

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
};

const expectedMs = (answer: AnswerRecord) => answer.questionId.startsWith("lab-") || answer.questionId.startsWith("tax-lab-") ? 8 * 60_000 : 75_000;

export function topicMastery(progress: AppProgress): TopicMastery[] {
  const all = new Map<string, { subject: Subject; topic: string; answers: AnswerRecord[] }>();
  [...flashcards, ...quizQuestions].forEach((item) => {
    const key = `${item.subject}:${item.topic}`;
    if (!all.has(key)) all.set(key, { subject: item.subject, topic: item.topic, answers: [] });
  });
  progress.answers.forEach((answer) => {
    const key = `${answer.subject}:${answer.topic}`;
    const row = all.get(key) ?? { subject: answer.subject, topic: answer.topic, answers: [] };
    row.answers.push(answer);
    all.set(key, row);
  });

  return [...all.values()].map(({ subject, topic, answers }) => {
    const recent = answers.slice(-8);
    const weightTotal = recent.reduce((sum, _, index) => sum + index + 1, 0) || 1;
    const accuracy = Math.round(recent.reduce((sum, item, index) => sum + (item.correct ? index + 1 : 0), 0) / weightTotal * 100);
    const timed = recent.filter((item) => item.durationMs > 0);
    const speed = timed.length ? Math.round(timed.reduce((sum, item) => sum + Math.min(1, expectedMs(item) / item.durationMs), 0) / timed.length * 100) : 50;
    const calibrated = recent.filter((item) => (item.confidence === "high") === item.correct || (item.confidence === "low") !== item.correct).length;
    const confidenceCalibration = recent.length ? Math.round(calibrated / recent.length * 100) : 50;
    const days = new Set(answers.map((item) => item.answeredAt.slice(0, 10))).size;
    const transfer = Math.min(100, days * 35 + Math.min(30, answers.length * 5));
    const mastery = answers.length ? Math.round(accuracy * .55 + speed * .15 + confidenceCalibration * .1 + transfer * .2) : 0;
    const last = answers.at(-1);
    const dangerous = recent.some((item) => !item.correct && item.confidence === "high");
    const intervalDays = mastery >= 80 && days >= 2 ? 7 : mastery >= 60 ? 3 : dangerous ? 0 : 1;
    const nextDueAt = new Date((last ? new Date(last.answeredAt).getTime() : 0) + intervalDays * 86_400_000).toISOString();
    const status: TopicMastery["status"] = !answers.length ? "neu" : mastery < 45 ? "Lücke" : mastery < 65 ? "im Aufbau" : mastery < 80 || days < 2 ? "fast sicher" : "beherrscht";
    return { subject, topic, attempts: answers.length, days, accuracy, speed, confidenceCalibration, mastery, status, nextDueAt };
  }).sort((a, b) => a.mastery - b.mastery || b.attempts - a.attempts);
}

export function scoreForecast(progress: AppProgress, subject: Subject) {
  const baseline = subject === "portfolio" ? 29 : 50;
  const rows = topicMastery(progress).filter((item) => item.subject === subject && item.attempts > 0);
  if (!rows.length) return { low: baseline, high: baseline, central: baseline };
  const examScores = progress.exams.filter((item) => item.subject === subject && item.score !== undefined && item.maxScore).slice(-3).map((item) => item.score! / item.maxScore! * 90);
  const masteryEstimate = rows.reduce((sum, item) => sum + item.mastery, 0) / rows.length * .9;
  const central = Math.round(examScores.length ? (masteryEstimate * .55 + examScores.reduce((a,b)=>a+b,0)/examScores.length * .45) : baseline * .3 + masteryEstimate * .7);
  const uncertainty = Math.max(4, 12 - Math.min(8, rows.reduce((sum, item) => sum + item.attempts, 0) / 5));
  return { low: Math.max(0, Math.round(central - uncertainty)), high: Math.min(90, Math.round(central + uncertainty)), central };
}

export type PlanSubject = Subject | "all";

export function adaptiveQueue(progress: AppProgress, minutes: number, subject: PlanSubject = "all") {
  const now = Date.now();
  const rows = topicMastery(progress).filter((item) => subject === "all" || item.subject === subject);
  const ranked = rows.map((item) => {
    const latest = [...progress.answers].reverse().find((answer) => answer.subject === item.subject && answer.topic === item.topic);
    const overdue = new Date(item.nextDueAt).getTime() <= now;
    const dangerous = latest && !latest.correct && latest.confidence === "high";
    const priority = (overdue ? 40 : 0) + (dangerous ? 35 : 0) + (100 - item.mastery) + (item.subject === "portfolio" ? 8 : 0);
    const reasonKey = dangerous ? "false-confidence" : overdue ? "due" : item.attempts ? "weak-high-value" : "coverage";
    return { ...item, priority, reasonKey, reason: dangerous ? "Scheinsicherheit korrigieren" : overdue ? "Wiederholung ist fällig" : item.attempts ? "Punktestarke Lücke schließen" : "Stoffabdeckung erweitern" };
  }).sort((a,b)=>b.priority-a.priority);
  const size = Math.max(3, Math.min(8, Math.ceil(minutes / 7)));
  if (subject !== "all") return ranked.slice(0, size);

  const portfolio = ranked.filter((item) => item.subject === "portfolio");
  const tax = ranked.filter((item) => item.subject === "tax");
  const portfolioWeight = progress.settings.subjectWeights?.portfolio ?? 50;
  let portfolioSlots = Math.round(size * portfolioWeight / 100);
  portfolioSlots = Math.max(1, Math.min(size - 1, portfolioSlots));
  const selected = [...portfolio.slice(0, portfolioSlots), ...tax.slice(0, size - portfolioSlots)];
  return selected.sort((a, b) => b.priority - a.priority);
}

export function subjectCoverage(progress: AppProgress, subject: Subject) {
  const rows = topicMastery(progress).filter((item) => item.subject === subject);
  const total = rows.length || 1;
  return {
    total: rows.length,
    learned: rows.filter((item) => item.attempts > 0).length,
    practised: rows.filter((item) => item.attempts >= 2).length,
    transferred: rows.filter((item) => item.days >= 2).length,
    examReady: rows.filter((item) => item.status === "beherrscht").length,
    percent: (value: number) => Math.round(value / total * 100),
  };
}
