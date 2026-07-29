"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { examPlans, type ExamBlock } from "@/lib/data/exams";
import { addLearningAttempt, upsertExam } from "@/lib/storage";
import type { AppProgress, Confidence, ErrorType, ExamSession, Language, Subject } from "@/lib/types";

const subjectLabel: Record<Subject, string> = {
  portfolio: "Portfolio Management",
  tax: "German & International Taxation",
};

const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;

function examId() {
  return `exam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function totalPoints(blocks: ExamBlock[]) {
  return blocks.reduce((sum, block) => sum + block.points, 0);
}

function Source({ block, language }: { block: ExamBlock; language: Language }) {
  return <details className="source-badge"><summary>{tr(language, "Quelle prüfen", "Check source")}</summary><div><strong>{block.source.document}</strong><span>{block.source.location}</span>{block.source.note ? <small>{block.source.note}</small> : null}</div></details>;
}

export function ExamWorkspace({
  progress,
  setProgress,
  language,
  initialSubject,
}: {
  progress: AppProgress;
  setProgress: React.Dispatch<React.SetStateAction<AppProgress>>;
  language: Language;
  initialSubject?: Subject;
}) {
  const [subject, setSubject] = useState<Subject>(initialSubject ?? "portfolio");
  const [session, setSession] = useState<ExamSession>();
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(90 * 60);
  const [reviewing, setReviewing] = useState(false);
  const plan = examPlans[session?.subject ?? subject];
  const block = plan[index];
  const incomplete = [...progress.exams].reverse().find((item) => !item.completedAt);
  const ungraded = [...progress.exams].reverse().find((item) => item.completedAt && item.score === undefined);

  const finishWriting = useCallback(() => {
    if (!session) return;
    const completed: ExamSession = { ...session, completedAt: session.completedAt ?? new Date().toISOString() };
    setSession(completed);
    setReviewing(true);
    setIndex(0);
    setProgress((current) => upsertExam(current, completed));
  }, [session, setProgress]);

  useEffect(() => {
    if (!session || reviewing || session.completedAt) return;
    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
      const remaining = Math.max(0, 90 * 60 - elapsed);
      setSeconds(remaining);
      if (remaining === 0) finishWriting();
    };
    const frame = window.requestAnimationFrame(update);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [finishWriting, reviewing, session]);

  const save = (next: ExamSession) => {
    setSession(next);
    setProgress((current) => upsertExam(current, next));
  };

  const start = () => {
    const blocks = examPlans[subject];
    const created: ExamSession = {
      id: examId(),
      subject,
      startedAt: new Date().toISOString(),
      questionIds: blocks.map((item) => item.id),
      answers: {},
      confidences: {},
      markedQuestionIds: [],
      scratchpads: {},
      selfScores: {},
    };
    save(created);
    setIndex(0);
    setReviewing(false);
    setSeconds(90 * 60);
  };

  const resume = (exam: ExamSession, review: boolean) => {
    setSubject(exam.subject);
    setSession(exam);
    setIndex(0);
    setReviewing(review);
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

  const scoreBlock = (value: number) => {
    if (!session || !block || block.responseType === "choice") return;
    const bounded = Math.max(0, Math.min(block.points, value));
    save({ ...session, selfScores: { ...(session.selfScores ?? {}), [block.id]: bounded } });
  };

  const effectiveScore = (item: ExamBlock) => {
    if (!session) return 0;
    if (item.responseType === "choice") return session.answers[item.id] === item.correctOption ? item.points : 0;
    return session.selfScores?.[item.id] ?? 0;
  };

  const finalize = () => {
    if (!session) return;
    const completedAt = session.completedAt ?? new Date().toISOString();
    const score = plan.reduce((sum, item) => sum + effectiveScore(item), 0);
    const finalSession: ExamSession = { ...session, completedAt, score, maxScore: 90 };
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
          durationMs: item.targetMinutes * 60_000,
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

  const answeredCount = useMemo(
    () => session ? plan.filter((item) => {
      const value = session.answers[item.id];
      return typeof value === "string" ? value.trim().length > 0 : value !== undefined;
    }).length : 0,
    [plan, session],
  );

  if (!session) {
    return <section className="page exam-workspace">
      <div className="page-heading">
        <p className="eyebrow">{tr(language, "90 MINUTEN · 90 PUNKTE · QUELLENGEBUNDEN", "90 MINUTES · 90 POINTS · SOURCE-BOUND")}</p>
        <h1>{tr(language, "Realistische Prüfungssimulation", "Realistic exam simulation")}</h1>
        <p>{tr(language, "Vollständige Fälle, Rechenwege, Freitext, Markierungen und Teilpunkte statt einer zufälligen Sammlung von Multiple-Choice-Fragen.", "Complete cases, calculations, free text, flags and partial credit instead of a random multiple-choice set.")}</p>
      </div>
      <div className="exam-subject-cards">
        {(["portfolio", "tax"] as Subject[]).map((item) => <button key={item} className={subject === item ? "selected" : ""} onClick={() => setSubject(item)}>
          <span>{item === "portfolio" ? "◎" : "§"}</span>
          <strong>{subjectLabel[item]}</strong>
          <small>{examPlans[item].length} {tr(language, "Prüfungsblöcke", "exam blocks")} · {totalPoints(examPlans[item])} P</small>
        </button>)}
      </div>
      <article className="exam-readiness panel">
        <div className="exam-clock">90:00<small>{tr(language, "Minuten", "minutes")}</small></div>
        <div>
          <h2>{tr(language, "Vor dem Start", "Before you start")}</h2>
          <ul>
            <li>{tr(language, "Antworten und Rechenblatt werden automatisch gespeichert.", "Answers and scratchpads are saved automatically.")}</li>
            <li>{tr(language, "Aufgaben können markiert und später bearbeitet werden.", "Blocks can be flagged and revisited.")}</li>
            <li>{tr(language, "Lösungen erscheinen erst nach Abgabe.", "Solutions appear only after submission.")}</li>
            <li>{tr(language, "Freitext wird anschließend anhand einer Teilpunkte-Rubrik bewertet.", "Free text is graded afterwards with a partial-credit rubric.")}</li>
          </ul>
          {incomplete ? <button className="resume-button" onClick={() => resume(incomplete, false)}>{tr(language, "Offene Prüfung fortsetzen", "Resume open exam")} →</button> : null}
          {ungraded ? <button className="resume-button" onClick={() => resume(ungraded, true)}>{tr(language, "Offene Selbstkorrektur fortsetzen", "Resume self-grading")} →</button> : null}
          <button className="primary-button" onClick={start}>{tr(language, "Neue Prüfung starten", "Start new exam")} →</button>
        </div>
      </article>
    </section>;
  }

  if (!block) return null;

  if (!reviewing && session.score !== undefined) {
    return <section className="page exam-workspace"><div className="exam-final panel"><span className="result-ring mastered">{session.score}<small>/ 90</small></span><h1>{tr(language, "Prüfung ausgewertet", "Exam graded")}</h1><p>{tr(language, "Das Ergebnis ist jetzt mit der Kompetenzmatrix, Prognose und Fehlerreparatur verknüpft.", "The result is now linked to mastery, forecasting and error repair.")}</p><button className="primary-button" onClick={() => setSession(undefined)}>{tr(language, "Zur Prüfungswahl", "Choose another exam")} →</button></div></section>;
  }

  return <section className="page exam-workspace">
    <div className="exam-bar">
      <strong>{reviewing ? tr(language, "SELBSTKORREKTUR", "SELF-GRADING") : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}</strong>
      <span>{tr(language, "Block", "Block")} {index + 1}/{plan.length} · {answeredCount}/{plan.length} {tr(language, "beantwortet", "answered")}</span>
      {!reviewing ? <button className="danger-button" onClick={finishWriting}>{tr(language, "Abgeben", "Submit")}</button> : <button className="primary-button compact" onClick={finalize}>{tr(language, "Bewertung abschließen", "Finish grading")}</button>}
    </div>

    <article className="question-card exam-block">
      <div className="quiz-top"><span>{block.topic}</span><strong>{block.points} P · {block.targetMinutes} Min</strong></div>
      <h1>{block.title}</h1>
      <p className="exam-prompt">{block.prompt}</p>

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
          : <label className="self-score">{tr(language, "Vergebene Teilpunkte", "Awarded partial credit")}<input type="number" min="0" max={block.points} value={session.selfScores?.[block.id] ?? 0} onChange={(event) => scoreBlock(Number(event.target.value))} /><b>/ {block.points}</b></label>}
        <Source block={block} language={language} />
      </div>}

      <div className="exam-nav">
        <button className="secondary-button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>← {tr(language, "Zurück", "Back")}</button>
        <div className="question-dots">{plan.map((item, itemIndex) => <button aria-label={`${tr(language, "Block", "Block")} ${itemIndex + 1}`} key={item.id} onClick={() => setIndex(itemIndex)} className={`${itemIndex === index ? "active" : ""} ${session.answers[item.id] !== undefined ? "answered" : ""} ${session.markedQuestionIds?.includes(item.id) ? "marked" : ""}`}>{itemIndex + 1}</button>)}</div>
        <button className="primary-button" disabled={index === plan.length - 1} onClick={() => setIndex((value) => value + 1)}>{tr(language, "Weiter", "Next")} →</button>
      </div>
    </article>
  </section>;
}
