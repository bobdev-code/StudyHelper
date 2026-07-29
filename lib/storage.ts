import type {
  AnswerRecord,
  AppProgress,
  CardProgress,
  ExamSession,
  LearningAttempt,
  RepairTask,
  SavedTaxDiagram,
} from "./types";

const STORAGE_KEY = "nachpruefung-lerntrainer-progress-v1";
const LAST_USER_KEY = "nachpruefung-lerntrainer-last-user";
const DAY = 86_400_000;
const INTERVALS = [0, 1, 3, 7, 14, 30];

export const defaultProgress: AppProgress = {
  version: 1,
  cards: {},
  answers: [],
  attempts: [],
  repairs: [],
  exams: [],
  portfolioAttempts: [],
  taxDiagrams: [],
  settings: {
    dailyMinutes: 45,
    examDate: "2026-08-04T09:00:00-03:00",
    language: "de",
    subjectWeights: { portfolio: 50, tax: 50 },
    dailyTargets: { portfolio: 20, tax: 20 },
  },
};

function storageKey(userId?: string) {
  return userId ? `${STORAGE_KEY}:user:${userId}` : `${STORAGE_KEY}:guest`;
}

function hasLearningEvidence(progress: AppProgress) {
  return Object.keys(progress.cards).length > 0
    || progress.answers.length > 0
    || (progress.attempts?.length ?? 0) > 0
    || progress.exams.length > 0;
}

export function loadProgress(userId?: string): AppProgress {
  if (typeof window === "undefined") return defaultProgress;
  try {
    const value = window.localStorage.getItem(storageKey(userId))
      ?? (!userId ? window.localStorage.getItem(STORAGE_KEY) : null);
    if (!value) return defaultProgress;
    const parsed = JSON.parse(value) as AppProgress;
    if (parsed.version !== 1) return defaultProgress;
    return {
      ...defaultProgress,
      ...parsed,
      cards: parsed.cards ?? {},
      answers: parsed.answers ?? [],
      attempts: parsed.attempts ?? [],
      repairs: parsed.repairs ?? [],
      exams: parsed.exams ?? [],
      portfolioAttempts: parsed.portfolioAttempts ?? [],
      taxDiagrams: parsed.taxDiagrams ?? [],
      settings: { ...defaultProgress.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaultProgress;
  }
}

export function saveProgress(progress: AppProgress, userId?: string) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(progress));
    } catch {
      // The app remains usable when browser storage is unavailable or full.
    }
  }
}

export function prepareProgressForUser(current: AppProgress, userId: string) {
  if (typeof window === "undefined") return loadProgress(userId);
  const previousUser = window.localStorage.getItem(LAST_USER_KEY);
  const userProgress = loadProgress(userId);
  window.localStorage.setItem(LAST_USER_KEY, userId);
  if (!previousUser && hasLearningEvidence(current) && !hasLearningEvidence(userProgress)) {
    const imported = mergeProgress(userProgress, current);
    window.localStorage.removeItem(storageKey());
    return imported;
  }
  return userProgress;
}

export function clearLastProgressUser(userId?: string) {
  if (typeof window === "undefined") return;
  const previousUser = window.localStorage.getItem(LAST_USER_KEY);
  if (!userId || previousUser === userId) window.localStorage.removeItem(LAST_USER_KEY);
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

export function addLearningAttempt(progress: AppProgress, attempt: LearningAttempt): AppProgress {
  const attempts = [...(progress.attempts ?? []).filter((item) => item.id !== attempt.id), attempt].slice(-3000);
  const existingRepair = (progress.repairs ?? []).find(
    (item) => item.subject === attempt.subject && item.topic === attempt.topic && item.status === "open",
  );
  let repairs = progress.repairs ?? [];

  if (attempt.score < attempt.maxScore && attempt.errorTypes.length) {
    const errorType = attempt.errorTypes[0];
    const repair: RepairTask = {
      id: existingRepair?.id ?? `repair-${attempt.id}`,
      sourceAttemptId: attempt.id,
      subject: attempt.subject,
      topic: attempt.topic,
      errorType,
      prompt: attempt.subject === "portfolio"
        ? `Löse eine neue Zahlen- oder Sachverhaltsvariante zu „${attempt.topic}“. Prüfe besonders: ${errorType}.`
        : `Bearbeite einen neuen Fall zu „${attempt.topic}“ mit Problem → Norm → Subsumtion/Rechnung → Rechtsfolge. Fokus: ${errorType}.`,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      status: "open",
    };
    repairs = [...repairs.filter((item) => item.id !== repair.id), repair].slice(-500);
  } else if (existingRepair && attempt.stage !== "recall") {
    const sourceAttempt = (progress.attempts ?? []).find((item) => item.id === existingRepair.sourceAttemptId);
    const passedWithNewVariant =
      attempt.maxScore > 0
      && attempt.score / attempt.maxScore >= 0.7
      && attempt.variantId !== sourceAttempt?.variantId;
    if (passedWithNewVariant) {
      repairs = repairs.map((item) => item.id === existingRepair.id
        ? { ...item, status: "passed" as const, passedAt: attempt.completedAt }
        : item);
    }
  }

  return { ...progress, attempts, repairs };
}

export function upsertExam(progress: AppProgress, exam: ExamSession): AppProgress {
  return {
    ...progress,
    exams: [...progress.exams.filter((item) => item.id !== exam.id), exam].slice(-50),
  };
}

export function upsertTaxDiagram(progress: AppProgress, diagram: SavedTaxDiagram): AppProgress {
  return {
    ...progress,
    taxDiagrams: [
      ...(progress.taxDiagrams ?? []).filter((item) => item.id !== diagram.id),
      diagram,
    ].slice(-50),
  };
}

function newestById<T extends { id: string }>(items: T[], timestamp: (item: T) => string | undefined) {
  const merged = new Map<string, T>();
  for (const item of items) {
    const current = merged.get(item.id);
    if (!current || (timestamp(item) ?? "") >= (timestamp(current) ?? "")) merged.set(item.id, item);
  }
  return [...merged.values()];
}

export function mergeProgress(local: AppProgress, remote: AppProgress): AppProgress {
  const cards = { ...remote.cards };
  for (const [id, localCard] of Object.entries(local.cards)) {
    const remoteCard = cards[id];
    if (!remoteCard || (localCard.lastSeenAt ?? localCard.dueAt) >= (remoteCard.lastSeenAt ?? remoteCard.dueAt)) {
      cards[id] = localCard;
    }
  }

  return {
    ...defaultProgress,
    ...remote,
    cards,
    answers: newestById([...(remote.answers ?? []), ...(local.answers ?? [])], (item) => item.answeredAt).slice(-2000),
    attempts: newestById([...(remote.attempts ?? []), ...(local.attempts ?? [])], (item) => item.completedAt).slice(-3000),
    repairs: newestById([...(remote.repairs ?? []), ...(local.repairs ?? [])], (item) => item.passedAt ?? item.dueAt).slice(-500),
    exams: newestById(
      [...(remote.exams ?? []), ...(local.exams ?? [])],
      (item) => item.updatedAt ?? item.completedAt ?? item.startedAt,
    ).slice(-50),
    portfolioAttempts: newestById(
      [...(remote.portfolioAttempts ?? []), ...(local.portfolioAttempts ?? [])],
      (item) => item.completedAt,
    ).slice(-500),
    activeStudySession: (() => {
      const candidates = [remote.activeStudySession, local.activeStudySession].filter(Boolean);
      return candidates.sort((a, b) => (a!.updatedAt).localeCompare(b!.updatedAt)).at(-1);
    })(),
    taxDiagrams: newestById(
      [...(remote.taxDiagrams ?? []), ...(local.taxDiagrams ?? [])],
      (item) => item.updatedAt,
    ).slice(-50),
    settings: { ...defaultProgress.settings, ...(remote.settings ?? {}), ...(local.settings ?? {}) },
  };
}

export function resetProgress(userId?: string): AppProgress {
  if (typeof window !== "undefined") window.localStorage.removeItem(storageKey(userId));
  return structuredClone(defaultProgress);
}
