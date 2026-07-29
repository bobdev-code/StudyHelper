"use client";

import { useEffect, useState } from "react";
import { examModeForSession, examModes, type ExamBlock } from "@/lib/data/exams";
import { addLearningAttempt, upsertExam } from "@/lib/storage";
import {
  examRemainingSeconds,
  firstResumeBlockIndex,
  isExamAnswerComplete,
  ungradedTextBlockIds,
  unansweredExamBlockIds,
} from "@/lib/examSafety";
import type { AppProgress, Confidence, ErrorType, ExamModeId, ExamSession, Language, Subject } from "@/lib/types";
import { ExamAidPanel } from "./examAids";

const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;

function examId() {
  return `exam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Source({ block, language }: { block: ExamBlock; language: Language }) {
  return <details className="source-badge"><summary>{tr(language, "Quelle prüfen", "Check source")}</summary><div><strong>{block.source.document}</strong><span>{block.source.location}</span>{block.source.note ? <small>{block.source.note}</small> : null}</div></details>;
}

export function ExamWorkspace({
  progress,
  setProgress,
  language,
  initialSubject,
  onSubjectChange,
}: {
  progress: AppProgress;
  setProgress: React.Dispatch<React.SetStateAction<AppProgress>>;
  language: Language;
  initialSubject?: Subject;
  onSubjectChange: (subject: Subject) => void;
}) {
  const [modeId, setModeId] = useState<ExamModeId>(initialSubject === "tax" ? "tax-combined" : "portfolio-full");
  const [session, setSession] = useState<ExamSession>();
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(examModes[modeId].durationMinutes * 60);
  const [reviewing, setReviewing] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState("");
  const selectedMode = examModes[modeId];
  const activeMode = session ? examModeForSession(session.subject, session.examModeId) : selectedMode;
  const plan = session
    ? session.questionIds.map((id) => activeMode.blocks.find((item) => item.id === id)).filter((item): item is ExamBlock => Boolean(item))
    : activeMode.blocks;
  const block = plan[index];
  const incomplete = [...progress.exams].filter((item) => !item.completedAt).reverse();
  const ungraded = [...progress.exams].filter((item) => item.completedAt && item.score === undefined).reverse();

  const finishWriting = (forced = false) => {
    if (!session) return;
    const unanswered = unansweredExamBlockIds(plan, session.answers);
    if (!forced && unanswered.length > 0 && !window.confirm(tr(
      language,
      `${unanswered.length} von ${plan.length} Blöcken sind unbeantwortet. Trotzdem zur Selbstkorrektur abgeben?`,
      `${unanswered.length} of ${plan.length} blocks are unanswered. Submit for self-grading anyway?`,
    ))) return;
    const now = new Date().toISOString();
    const completed: ExamSession = { ...session, completedAt: session.completedAt ?? now, updatedAt: now };
    setSession(completed);
    setReviewing(true);
    setIndex(0);
    setProgress((current) => upsertExam(current, completed));
  };

  useEffect(() => {
    if (!session || reviewing || session.completedAt) return;
    const update = () => {
      const remaining = examRemainingSeconds(session.startedAt, session.durationMinutes ?? activeMode.durationMinutes);
      setSeconds(remaining);
      if (remaining === 0) {
        setSubmissionNotice(tr(language, "Die Zeit ist abgelaufen. Die Prüfung wurde automatisch zur Selbstkorrektur abgegeben.", "Time expired. The exam was automatically submitted for self-grading."));
        const now = new Date().toISOString();
        const completed: ExamSession = { ...session, completedAt: session.completedAt ?? now, updatedAt: now };
        setSession(completed);
        setReviewing(true);
        setIndex(0);
        setProgress((current) => upsertExam(current, completed));
      }
    };
    const frame = window.requestAnimationFrame(update);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [activeMode.durationMinutes, language, reviewing, session, setProgress]);

  const save = (next: ExamSession) => {
    const updated = { ...next, updatedAt: new Date().toISOString(), currentBlockId: next.currentBlockId ?? block?.id };
    setSession(updated);
    setProgress((current) => upsertExam(current, updated));
  };

  const start = () => {
    const mode = examModes[modeId];
    const blocks = mode.blocks;
    const created: ExamSession = {
      id: examId(),
      subject: mode.subject,
      examModeId: mode.id,
      durationMinutes: mode.durationMinutes,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentBlockId: blocks[0]?.id,
      questionIds: blocks.map((item) => item.id),
      answers: {},
      confidences: {},
      markedQuestionIds: [],
      scratchpads: {},
      selfScores: {},
    };
    save(created);
    onSubjectChange(mode.subject);
    setIndex(0);
    setReviewing(false);
    setSeconds(mode.durationMinutes * 60);
  };

  const resume = (exam: ExamSession, review: boolean) => {
    const mode = examModeForSession(exam.subject, exam.examModeId);
    const blocks = exam.questionIds.map((id) => mode.blocks.find((item) => item.id === id)).filter((item): item is ExamBlock => Boolean(item));
    setModeId(mode.id);
    setSession(exam);
    setIndex(firstResumeBlockIndex(blocks, exam.answers, exam.selfScores, review, exam.currentBlockId));
    setReviewing(review);
    setSeconds(examRemainingSeconds(exam.startedAt, exam.durationMinutes ?? mode.durationMinutes));
    onSubjectChange(exam.subject);
  };

  const answer = (value: string | number) => {
    if (!session || !block) return;
    save({ ...session, answers: { ...session.answers, [block.id]: value } });
  };

  const scratch = (value: string) => {
    if (!session || !block) return;
    save({ ...session, scratchpads: { ...(session.scratchpads ?? {}), [block.id]: value } });
  };

  const confidence = (value: Confidence) => {
    if (!session || !block) return;
    save({ ...session, confidences: { ...session.confidences, [block.id]: value } });
  };

  const toggleMark = () => {
    if (!session || !block) return;
    const marked = new Set(session.markedQuestionIds ?? []);
    if (marked.has(block.id)) marked.delete(block.id);
    else marked.add(block.id);
    save({ ...session, markedQuestionIds: [...marked] });
  };

  const scoreBlock = (value: number | undefined) => {
    if (!session || !block || block.responseType === "choice") return;
    const selfScores = { ...(session.selfScores ?? {}) };
    if (value === undefined || Number.isNaN(value)) delete selfScores[block.id];
    else selfScores[block.id] = Math.max(0, Math.min(block.points, value));
    save({ ...session, selfScores });
  };

  const effectiveScore = (item: ExamBlock) => {
    if (!session) return 0;
    if (item.responseType === "choice") return session.answers[item.id] === item.correctOption ? item.points : 0;
    return session.selfScores?.[item.id] ?? 0;
  };

  const finalize = () => {
    if (!session) return;
    const ungradedBlocks = ungradedTextBlockIds(plan, session.selfScores);
    if (ungradedBlocks.length > 0) {
      window.alert(tr(language, `Bewerte zuerst alle Freitextblöcke. Noch offen: ${ungradedBlocks.length}.`, `Grade every written block first. Remaining: ${ungradedBlocks.length}.`));
      return;
    }
    const completedAt = session.completedAt ?? new Date().toISOString();
    const score = plan.reduce((sum, item) => sum + effectiveScore(item), 0);
    const finalSession: ExamSession = { ...session, completedAt, updatedAt: new Date().toISOString(), score, maxScore: activeMode.maxPoints };
    setProgress((current) => {
      let next = upsertExam(current, finalSession);
      for (const item of plan) {
        const blockScore = effectiveScore(item);
        const errors: ErrorType[] = blockScore >= item.points * .7
          ? []
          : [item.subject === "portfolio" ? "Interpretation fehlt" : "Rechtsfolge falsch"];
        next = addLearningAttempt(next, {
          id: `attempt-${finalSession.id}-${item.id}`,
          activityId: item.id,
          variantId: `${item.id}-v1`,
          subject: item.subject,
          topic: item.topic,
          mode: "exam",
          stage: "timed",
          score: blockScore,
          maxScore: item.points,
          durationMs: Math.max(
            1,
            (new Date(completedAt).getTime() - new Date(finalSession.startedAt).getTime())
            * item.targetMinutes / Math.max(1, plan.reduce((sum, entry) => sum + entry.targetMinutes, 0)),
          ),
          confidence: finalSession.confidences[item.id] ?? "medium",
          errorTypes: errors,
          hintsUsed: 0,
          completedAt,
          examSessionId: finalSession.id,
        });
      }
      return next;
    });
    setSession(finalSession);
    setReviewing(false);
    setIndex(0);
  };

  const answeredCount = session ? plan.filter((item) => {
    return isExamAnswerComplete(session.answers[item.id]);
  }).length : 0;
  const openSelfScores = session ? ungradedTextBlockIds(plan, session.selfScores) : [];
  const goToBlock = (nextIndex: number) => {
    if (!session || !plan[nextIndex]) return;
    save({ ...session, currentBlockId: plan[nextIndex].id });
    setIndex(nextIndex);
  };

  if (!session) {
    return <section className="page exam-workspace">
      <div className="page-heading">
        <p className="eyebrow">{tr(language, "TEILPRÜFUNGEN & GESAMTPRÜFUNGEN · QUELLENGEBUNDEN", "SECTION & FULL EXAMS · SOURCE-BOUND")}</p>
        <h1>{tr(language, "Klausurnahe Prüfungssimulation", "Exam-realistic simulation")}</h1>
        <p>{tr(language, "Taxation folgt der echten Gewichtung: 60 Minuten German Taxation und maximal 30 Minuten International Taxation. Beide Teile lassen sich einzeln oder als 90-Minuten-Gesamtprüfung absolvieren.", "Taxation follows the real weighting: 60 minutes German Taxation and no more than 30 minutes International Taxation. Complete either section alone or take the combined 90-minute exam.")}</p>
      </div>
      <div className="exam-mode-groups">
        <div>
          <h2>Portfolio Management</h2>
          <div className="exam-subject-cards">
            {(["portfolio-full"] as ExamModeId[]).map((item) => {
              const mode = examModes[item];
              return <button key={item} className={modeId === item ? "selected" : ""} onClick={() => { setModeId(item); onSubjectChange(mode.subject); setSeconds(mode.durationMinutes * 60); }}>
                <span>◎</span>
                <strong>{tr(language, mode.labelDe, mode.labelEn)}</strong>
                <small>{mode.durationMinutes} Min · {mode.maxPoints} P · {mode.blocks.length} {tr(language, "Blöcke", "blocks")}</small>
              </button>;
            })}
          </div>
        </div>
        <div>
          <h2>Taxation</h2>
          <div className="exam-subject-cards tax-exam-cards">
            {(["tax-german", "tax-international", "tax-combined"] as ExamModeId[]).map((item) => {
              const mode = examModes[item];
              return <button key={item} className={modeId === item ? "selected" : ""} onClick={() => { setModeId(item); onSubjectChange(mode.subject); setSeconds(mode.durationMinutes * 60); }}>
                <span>§</span>
                <strong>{tr(language, mode.labelDe, mode.labelEn)}</strong>
                <small>{mode.durationMinutes} Min · {mode.maxPoints} P · {tr(language, mode.descriptionDe, mode.descriptionEn)}</small>
              </button>;
            })}
          </div>
        </div>
      </div>
      <article className="exam-readiness panel">
        <div className="exam-clock">{selectedMode.durationMinutes}:00<small>{tr(language, "Minuten", "minutes")}</small></div>
        <div>
          <h2>{tr(language, selectedMode.labelDe, selectedMode.labelEn)}</h2>
          <p className="exam-selection-summary">{tr(language, selectedMode.descriptionDe, selectedMode.descriptionEn)} · {selectedMode.maxPoints} {tr(language, "Punkte", "points")}</p>
          <ul>
            <li>{tr(language, "Antworten und Rechenblatt werden automatisch gespeichert.", "Answers and scratchpads are saved automatically.")}</li>
            <li>{tr(language, "Aufgaben können markiert und später bearbeitet werden.", "Blocks can be flagged and revisited.")}</li>
            <li>{tr(language, "Lösungen erscheinen erst nach Abgabe.", "Solutions appear only after submission.")}</li>
            <li>{tr(language, "Freitext wird anschließend anhand einer Teilpunkte-Rubrik bewertet.", "Free text is graded afterwards with a partial-credit rubric.")}</li>
          </ul>
          {[...incomplete, ...ungraded].map((exam) => {
            const mode = examModeForSession(exam.subject, exam.examModeId);
            const blocks = exam.questionIds.map((id) => mode.blocks.find((item) => item.id === id)).filter((item): item is ExamBlock => Boolean(item));
            const isReview = Boolean(exam.completedAt);
            const completed = isReview
              ? blocks.filter((item) => item.responseType === "choice" || Object.hasOwn(exam.selfScores ?? {}, item.id)).length
              : blocks.filter((item) => isExamAnswerComplete(exam.answers[item.id])).length;
            const remaining = examRemainingSeconds(exam.startedAt, exam.durationMinutes ?? mode.durationMinutes);
            return <button className="resume-button resume-detail" key={exam.id} onClick={() => resume(exam, isReview)}>
              <span>{exam.subject === "portfolio" ? "◎ Portfolio Management" : "§ Taxation"}</span>
              <strong>{tr(language, mode.labelDe, mode.labelEn)}</strong>
              <small>{isReview ? tr(language, "Selbstkorrektur", "Self-grading") : tr(language, "Bearbeitung", "Writing")} · {completed}/{blocks.length} · {isReview ? tr(language, `${blocks.length - completed} Bewertungen offen`, `${blocks.length - completed} grades left`) : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")} ${tr(language, "Restzeit", "remaining")}`}</small>
            </button>;
          })}
          <button className="primary-button" onClick={start}>{tr(language, "Neue Prüfung starten", "Start new exam")} →</button>
        </div>
      </article>
    </section>;
  }

  if (!block) return null;

  if (!reviewing && session.score !== undefined) {
    return <section className="page exam-workspace"><div className="exam-final panel"><span className="result-ring mastered">{session.score}<small>/ {session.maxScore ?? activeMode.maxPoints}</small></span><h1>{tr(language, "Prüfung ausgewertet", "Exam graded")}</h1><p>{tr(language, "Das Ergebnis ist jetzt mit der Kompetenzmatrix, Prognose und Fehlerreparatur verknüpft. Teilprüfungen fließen entsprechend ihrer Punktzahl gewichtet ein.", "The result is now linked to mastery, forecasting and error repair. Section exams are weighted by their point value.")}</p><button className="primary-button" onClick={() => setSession(undefined)}>{tr(language, "Zur Prüfungswahl", "Choose another exam")} →</button></div></section>;
  }

  return <section className="page exam-workspace">
    <div className="exam-bar">
      <strong>{reviewing ? tr(language, "SELBSTKORREKTUR", "SELF-GRADING") : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}</strong>
      <span>{tr(language, "Block", "Block")} {index + 1}/{plan.length} · {answeredCount}/{plan.length} {tr(language, "beantwortet", "answered")}</span>
      {!reviewing ? <button className="danger-button" onClick={() => finishWriting(false)}>{tr(language, "Abgeben", "Submit")}</button> : <button className="primary-button compact" disabled={openSelfScores.length > 0} onClick={finalize}>{openSelfScores.length ? tr(language, `${openSelfScores.length} Bewertungen offen`, `${openSelfScores.length} grades left`) : tr(language, "Bewertung abschließen", "Finish grading")}</button>}
    </div>
    {submissionNotice && <div className="exam-submission-notice" role="status">{submissionNotice}</div>}

    <article className="question-card exam-block">
      <div className="quiz-top"><span>{block.topic}</span><strong>{block.points} P · {block.targetMinutes} Min</strong></div>
      <h1>{block.title}</h1>
      <p className="exam-prompt">{block.prompt}</p>
      <ExamAidPanel subject={activeMode.subject} language={language} progress={progress} setProgress={setProgress} />

      {block.responseType === "choice" ? <div className="options">{block.options?.map((option, optionIndex) => {
        const selected = session.answers[block.id] === optionIndex;
        const correct = reviewing && block.correctOption === optionIndex;
        const wrong = reviewing && selected && !correct;
        return <button key={option} disabled={reviewing} className={`${selected ? "selected" : ""} ${correct ? "correct" : ""} ${wrong ? "incorrect" : ""}`} onClick={() => answer(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>;
      })}</div> : <label className="exam-answer-field"><span>{tr(language, "Deine strukturierte Antwort", "Your structured answer")}</span><textarea disabled={reviewing} rows={12} value={String(session.answers[block.id] ?? "")} onChange={(event) => answer(event.target.value)} placeholder={tr(language, "Ansatz, Norm/Formel, Rechenweg, Ergebnis und Interpretation …", "Approach, rule/formula, calculation, result and interpretation …")} /></label>}

      <label className="scratchpad"><b>{tr(language, "Freies Rechenblatt", "Scratchpad")}</b><textarea disabled={reviewing} rows={5} value={session.scratchpads?.[block.id] ?? ""} onChange={(event) => scratch(event.target.value)} placeholder={tr(language, "Zwischenschritte und Notizen …", "Intermediate steps and notes …")} /></label>

      {!reviewing ? <div className="exam-block-tools">
        <button className={session.markedQuestionIds?.includes(block.id) ? "filter-button active" : "filter-button"} onClick={toggleMark}>⚑ {tr(language, "Markieren", "Flag")}</button>
        <label>{tr(language, "Sicherheit", "Confidence")}<select value={session.confidences[block.id] ?? "medium"} onChange={(event) => confidence(event.target.value as Confidence)}><option value="low">{tr(language, "niedrig", "low")}</option><option value="medium">{tr(language, "mittel", "medium")}</option><option value="high">{tr(language, "hoch", "high")}</option></select></label>
      </div> : <div className="exam-rubric">
        <h2>{tr(language, "Teilpunkte-Rubrik", "Partial-credit rubric")}</h2>
        <ul>{block.rubric.map((item) => <li key={item.label}><span>{item.label}</span><b>{item.points} P</b></li>)}</ul>
        <details className="model-answer" open><summary>{tr(language, "Musterlösung", "Model answer")}</summary><p>{block.modelAnswer}</p></details>
        {block.responseType === "choice"
          ? <p className="auto-score">{tr(language, "Automatisch bewertet", "Automatically graded")}: <strong>{effectiveScore(block)}/{block.points} P</strong></p>
          : <label className="self-score">{tr(language, "Vergebene Teilpunkte", "Awarded partial credit")}<input type="number" min="0" max={block.points} value={Object.hasOwn(session.selfScores ?? {}, block.id) ? session.selfScores?.[block.id] : ""} onChange={(event) => scoreBlock(event.target.value === "" ? undefined : Number(event.target.value))} placeholder="–" /><b>/ {block.points}</b></label>}
        <Source block={block} language={language} />
      </div>}

      <div className="exam-nav">
        <button className="secondary-button" disabled={index === 0} onClick={() => goToBlock(index - 1)}>← {tr(language, "Zurück", "Back")}</button>
        <div className="question-dots">{plan.map((item, itemIndex) => <button aria-label={`${tr(language, "Block", "Block")} ${itemIndex + 1}`} key={item.id} onClick={() => goToBlock(itemIndex)} className={`${itemIndex === index ? "active" : ""} ${isExamAnswerComplete(session.answers[item.id]) ? "answered" : ""} ${session.markedQuestionIds?.includes(item.id) ? "marked" : ""}`}>{itemIndex + 1}</button>)}</div>
        <button className="primary-button" disabled={index === plan.length - 1} onClick={() => goToBlock(index + 1)}>{tr(language, "Weiter", "Next")} →</button>
      </div>
    </article>
  </section>;
}
