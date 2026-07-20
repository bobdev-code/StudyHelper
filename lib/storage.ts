import type {
  AnswerRecord,
  AppProgress,
  CardProgress,
  ExamSession,
} from "./types";

const STORAGE_KEY = "nachpruefung-lerntrainer-progress-v1";
const DAY = 86_400_000;
const INTERVALS = [0, 1, 3, 7, 14, 30];

export const defaultProgress: AppProgress = {
  version: 1,
  cards: {},
  answers: [],
  exams: [],
  settings: { dailyMinutes: 45, examDate: "2026-08-04T09:00:00-03:00" },
};

export function loadProgress(): AppProgress {
  if (typeof window === "undefined") return defaultProgress;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return defaultProgress;
    const parsed = JSON.parse(value) as AppProgress;
    if (parsed.version !== 1) return defaultProgress;
    return {
      ...defaultProgress,
      ...parsed,
      cards: parsed.cards ?? {},
      answers: parsed.answers ?? [],
      exams: parsed.exams ?? [],
      settings: { ...defaultProgress.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaultProgress;
  }
}

export function saveProgress(progress: AppProgress) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }
}

export function reviewCard(
  current: CardProgress | undefined,
  result: "known" | "uncertain" | "wrong",
): CardProgress {
  const base: CardProgress = current ?? {
    box: 1,
    dueAt: new Date().toISOString(),
    attempts: 0,
    known: 0,
    uncertain: 0,
    wrong: 0,
    favorite: false,
  };
  const box =
    result === "known"
      ? Math.min(5, base.box + 1)
      : result === "uncertain"
        ? Math.max(1, base.box)
        : 1;
  const interval = result === "uncertain" ? 1 : INTERVALS[box];
  return {
    ...base,
    box,
    dueAt: new Date(Date.now() + interval * DAY).toISOString(),
    attempts: base.attempts + 1,
    known: base.known + (result === "known" ? 1 : 0),
    uncertain: base.uncertain + (result === "uncertain" ? 1 : 0),
    wrong: base.wrong + (result === "wrong" ? 1 : 0),
    lastSeenAt: new Date().toISOString(),
  };
}

export function addAnswer(progress: AppProgress, answer: AnswerRecord): AppProgress {
  return { ...progress, answers: [...progress.answers, answer].slice(-2000) };
}

export function upsertExam(progress: AppProgress, exam: ExamSession): AppProgress {
  return {
    ...progress,
    exams: [...progress.exams.filter((item) => item.id !== exam.id), exam].slice(-50),
  };
}

export function resetProgress(): AppProgress {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  return structuredClone(defaultProgress);
}
