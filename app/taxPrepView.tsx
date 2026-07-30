"use client";

import { lazy, Suspense, useState } from "react";
import { taxPrepChapters } from "@/lib/data/taxPrep";
import type { AppProgress, Language } from "@/lib/types";

const ExamAidPanel = lazy(() => import("./examAids").then((module) => ({ default: module.ExamAidPanel })));
const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;

export function TaxExamPreparationView({
  language,
  progress,
  setProgress,
  onExit,
  onStartDiagnostic,
}: {
  language: Language;
  progress: AppProgress;
  setProgress: React.Dispatch<React.SetStateAction<AppProgress>>;
  onExit: () => void;
  onStartDiagnostic: () => void;
}) {
  const [chapter, setChapter] = useState(0);
  const chapters = taxPrepChapters(language);
  const item = chapters[chapter];
  const complete = chapter === chapters.length - 1;
  return <section className="page tax-prep-page">
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← {tr(language, "Trainingsarten", "Training modes")}</button><span>{chapter + 1} / {chapters.length}</span></div>
    <div className="tax-prep-progress" aria-label={tr(language, "Fortschritt der Vorbereitung", "Preparation progress")}><span style={{width:`${((chapter+1)/chapters.length)*100}%`}} /></div>
    <div className="tax-prep-layout">
      <nav className="tax-prep-nav" aria-label={tr(language, "Kapitel", "Chapters")}>{chapters.map((entry,index)=><button key={entry.title} className={index===chapter?"active":index<chapter?"visited":""} onClick={()=>setChapter(index)}><span>{index<chapter?"✓":index+1}</span><div><small>{entry.kicker}</small><strong>{entry.title}</strong></div></button>)}</nav>
      <article className="tax-prep-lesson">
        <span className="question-type">{item.kicker}</span><h1>{item.title}</h1><p className="tax-prep-summary">{item.summary}</p>
        <Suspense fallback={<div className="panel view-loader">{tr(language, "Prüfungshilfen werden geladen …", "Loading exam aids …")}</div>}><ExamAidPanel subject="tax" language={language} progress={progress} setProgress={setProgress} /></Suspense>
        <div className="tax-prep-schema"><h2>{tr(language, "Prüfungsschema", "Exam sequence")}</h2><ol>{item.steps.map(step=><li key={step}>{step}</li>)}</ol></div>
        <div className="tax-prep-example"><span>∑</span><div><h3>{tr(language, "Vorgerechnetes Beispiel", "Worked example")}</h3><p>{item.example}</p></div></div>
        <aside className="tax-prep-trap"><b>{tr(language, "Typischer Punktverlust", "Typical lost marks")}</b><p>{item.trap}</p></aside>
        <p className="tax-prep-note">{tr(language, "Diese Lektion erklärt und bewertet nicht. Dein Wissensstand wird erst im anschließenden Einstufungstest gemessen.", "This lesson explains without scoring. Your knowledge is measured only in the diagnostic that follows.")}</p>
        <div className="tax-prep-actions"><button className="secondary-button" disabled={chapter===0} onClick={()=>setChapter(value=>value-1)}>← {tr(language, "Zurück", "Back")}</button>{complete?<button className="primary-button" onClick={onStartDiagnostic}>{tr(language, "Vorbereitung abgeschlossen · Einstufungstest starten", "Preparation complete · Start diagnostic")} →</button>:<button className="primary-button" onClick={()=>setChapter(value=>value+1)}>{tr(language, "Nächste Erklärung", "Next explanation")} →</button>}</div>
      </article>
    </div>
    <p className="tax-prep-source">{tr(language, "Inhaltliche Grundlage: „German Tax Exam Prep“, 6 Seiten. Normen und Kurslogik wurden mit den vorhandenen Taxation-Lösungsunterlagen abgeglichen.", "Content basis: “German Tax Exam Prep”, 6 pages. Rules and course logic were cross-checked against the available taxation solution materials.")}</p>
  </section>;
}
