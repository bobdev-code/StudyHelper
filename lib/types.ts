export type Subject = "portfolio" | "tax";
export type Language = "de" | "en";

export type SourceRef = {
  document: string;
  location: string;
  priority: "official-current" | "official-solution" | "official-older";
  note?: string;
};

export type Flashcard = {
  id: string;
  subject: Subject;
  topic: string;
  front: string;
  back: string;
  helpDe?: string;
  difficulty: 1 | 2 | 3;
  source: SourceRef;
};

export type QuizType =
  | "multiple-choice"
  | "true-false"
  | "formula"
  | "calculation"
  | "matching"
  | "ordering"
  | "legal-rule";

export type QuizQuestion = {
  id: string;
  subject: Subject;
  topic: string;
  type: QuizType;
  prompt: string;
  options: string[];
  correct: number | number[];
  explanation: string;
  helpDe?: string;
  solutionSteps?: string[];
  points: number;
  difficulty: 1 | 2 | 3;
  source: SourceRef;
  diagnostic?: boolean;
};

export type ModelOverview = {
  id: string;
  subject: Subject;
  title: string;
  summary: string;
  formula?: string;
  checkpoints: string[];
  source: SourceRef;
};

export type Confidence = "low" | "medium" | "high";

export type ErrorType =
  | "Wissenslücke"
  | "falsche Formel"
  | "Rechenfehler"
  | "Norm nicht gefunden"
  | "Rechtsfolge falsch"
  | "Interpretation fehlt"
  | "Flüchtigkeitsfehler";

export type CardProgress = {
  box: number;
  dueAt: string;
  attempts: number;
  known: number;
  uncertain: number;
  wrong: number;
  favorite: boolean;
  lastSeenAt?: string;
};

export type AnswerRecord = {
  id: string;
  questionId: string;
  subject: Subject;
  topic: string;
  correct: boolean;
  durationMs: number;
  confidence: Confidence;
  errorType?: ErrorType;
  answeredAt: string;
  examSessionId?: string;
};

export type ExamSession = {
  id: string;
  subject: Subject;
  startedAt: string;
  completedAt?: string;
  questionIds: string[];
  answers: Record<string, number | number[]>;
  confidences: Record<string, Confidence>;
  score?: number;
  maxScore?: number;
};

export type AppProgress = {
  version: 1;
  cards: Record<string, CardProgress>;
  answers: AnswerRecord[];
  exams: ExamSession[];
  portfolioAttempts?: PortfolioAttempt[];
  settings: {
    dailyMinutes: number;
    examDate: string;
    language?: Language;
    subjectWeights?: Record<Subject, number>;
    dailyTargets?: Record<Subject, number>;
  };
};

export type PortfolioAttempt = {
  id: string;
  taskId: string;
  topic: string;
  mode: "chain" | "challenge" | "detective" | "explanation";
  score: number;
  maxScore: number;
  errorTypes: string[];
  completedAt: string;
};
