export type ExamSafetyBlock = {
  id: string;
  responseType: "choice" | "text";
};

export function isExamAnswerComplete(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined;
}

export function unansweredExamBlockIds(blocks: ExamSafetyBlock[], answers: Record<string, unknown>) {
  return blocks.filter((item) => !isExamAnswerComplete(answers[item.id])).map((item) => item.id);
}

export function ungradedTextBlockIds(blocks: ExamSafetyBlock[], selfScores: Record<string, number> | undefined) {
  return blocks
    .filter((item) => item.responseType === "text" && !Object.hasOwn(selfScores ?? {}, item.id))
    .map((item) => item.id);
}

export function examRemainingSeconds(startedAt: string, durationMinutes: number, now = Date.now()) {
  const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, durationMinutes * 60 - elapsed);
}

export function firstResumeBlockIndex(
  blocks: ExamSafetyBlock[],
  answers: Record<string, unknown>,
  selfScores: Record<string, number> | undefined,
  reviewing: boolean,
  currentBlockId?: string,
) {
  const preferred = reviewing
    ? blocks.findIndex((item) => item.responseType === "text" && !Object.hasOwn(selfScores ?? {}, item.id))
    : blocks.findIndex((item) => !isExamAnswerComplete(answers[item.id]));
  if (preferred >= 0) return preferred;
  const saved = blocks.findIndex((item) => item.id === currentBlockId);
  return Math.max(0, saved);
}
