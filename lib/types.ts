export type Subject = "portfolio" | "tax";
export type Language = "de" | "en";
export type Difficulty = 1 | 2 | 3;
export type ExamModeId = "portfolio-full" | "tax-german" | "tax-international" | "tax-combined";

export type SourceRef = {
  document: string;
  location: string;
  priority: "official-current" | "official-solution" | "official-older" | "student-secondary";
  note?: string;
};

export type Flashcard = {
  id: string;
  subject: Subject;
  topic: string;
  front: string;
  back: string;
  helpDe?: string;
  difficulty: Difficulty;
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
  difficulty: Difficulty;
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
  difficulty?: Difficulty;
};

export type LearningMode =
  | "flashcard"
  | "quiz"
  | "calculation-lab"
  | "tax-case"
  | "portfolio-chain"
  | "portfolio-detective"
  | "exam";

export type LearningStage = "recall" | "application" | "transfer" | "timed";

export type LearningAttempt = {
  id: string;
  activityId: string;
  variantId: string;
  subject: Subject;
  topic: string;
  mode: LearningMode;
  stage: LearningStage;
  score: number;
  maxScore: number;
  durationMs: number;
  confidence: Confidence;
  errorTypes: ErrorType[];
  hintsUsed: number;
  completedAt: string;
  examSessionId?: string;
  difficulty?: Difficulty;
  writtenResponse?: string;
  selfScore?: number;
};

export type RepairTask = {
  id: string;
  sourceAttemptId: string;
  subject: Subject;
  topic: string;
  errorType: ErrorType;
  prompt: string;
  dueAt: string;
  status: "open" | "passed";
  passedAt?: string;
};

export type StudySessionItem = {
  id: string;
  subject: Subject;
  topic: string;
  view: "cards" | "quiz";
  estimatedMinutes: number;
};

export type StudySession = {
  id: string;
  subject: Subject | "all";
  plannedMinutes: number;
  startedAt: string;
  updatedAt: string;
  currentIndex: number;
  items: StudySessionItem[];
  completedItemIds: string[];
  baselineMastery: Record<Subject, number>;
  completedAt?: string;
};

export type TaxDiagramNode = {
  id: number;
  kind: "person" | "partnership" | "corporation" | "building";
  x: number;
  y: number;
  label: string;
};

export type TaxDiagramEdge = {
  id: number;
  from: number;
  to: number;
  relation: "participation" | "rental" | "loan" | "dividend";
};

export type TaxDiagramAnswer = {
  nodes: TaxDiagramNode[];
  edges: TaxDiagramEdge[];
};

export type SavedTaxDiagram = {
  id: string;
  name: string;
  nodes: TaxDiagramNode[];
  edges: TaxDiagramEdge[];
  updatedAt: string;
};

export type ExamAnswer = number | number[] | string | TaxDiagramAnswer;

export type ExamSession = {
  id: string;
  subject: Subject;
  examModeId?: ExamModeId;
  examVariantId?: string;
  durationMinutes?: number;
  startedAt: string;
  updatedAt?: string;
  completedAt?: string;
  currentBlockId?: string;
  currentBlockStartedAt?: string;
  questionIds: string[];
  answers: Record<string, ExamAnswer>;
  confidences: Record<string, Confidence>;
  markedQuestionIds?: string[];
  scratchpads?: Record<string, string>;
  selfScores?: Record<string, number>;
  blockDurationsMs?: Record<string, number>;
  score?: number;
  maxScore?: number;
};

export type AppProgress = {
  version: 1;
  cards: Record<string, CardProgress>;
  answers: AnswerRecord[];
  attempts?: LearningAttempt[];
  repairs?: RepairTask[];
  exams: ExamSession[];
  portfolioAttempts?: PortfolioAttempt[];
  activeStudySession?: StudySession;
  taxDiagrams?: SavedTaxDiagram[];
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
