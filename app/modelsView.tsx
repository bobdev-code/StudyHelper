"use client";

import { useState } from "react";
import { modelOverviews } from "@/lib/data/models";
import type { Flashcard, Language, Subject } from "@/lib/types";

const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;

function modelQuizTopic(id: string, title: string) {
  if (["m-sharpe", "m-alpha"].includes(id)) return "Performance Measures";
  if (id === "m-event" || id === "m-emh") return "EMH & Event Study";
  if (id === "t-income") return "Seven Income Categories";
  if (id === "t-liability") return "Tax Liability";
  if (id === "t-principles" || id === "t-coentrepreneur") return "Partnership & Co-Entrepreneurship";
  if (id === "t-sbv") return "Special Business Assets";
  if (id === "t-cit") return "Corporate Income Tax";
  if (id === "t-trade") return "Trade Tax";
  if (id === "t-dividend") return "Dividends & Capital Gains";
  if (id === "t-split") return "Business Split";
  if (id === "t-legalform") return "Legal-Form Comparison";
  return title;
}

function SourceBadge({ source, language }: { source: Flashcard["source"]; language: Language }) {
  return <details className="source-badge"><summary>{tr(language, "Quelle prüfen", "Check source")}</summary><div><strong>{source.document}</strong><span>{source.location}</span>{source.note ? <small>{source.note}</small> : null}</div></details>;
}

export function ModelsView({
  language,
  initialSubject,
  navigate,
  onSubjectChange,
}: {
  language: Language;
  initialSubject: Subject;
  navigate: (view: "quiz", target: { subject: Subject; topic: string }) => void;
  onSubjectChange: (subject: Subject) => void;
}) {
  const [subject, setSubject] = useState<Subject>(initialSubject);
  const [open, setOpen] = useState(modelOverviews.find((item) => item.subject === initialSubject)?.id ?? "");
  return <section className="page">
    <div className="page-heading">
      <p className="eyebrow">{tr(language, "MODELLE & ÜBERSICHTEN", "MODELS & OVERVIEWS")}</p>
      <h1>{tr(language, "Prüfungswissen als Ablauf", "Exam knowledge as a process")}</h1>
      <p>{tr(language, "Kompakte, quellengebundene Übersichten – für Verständnis und Wiederholung, nicht als Ersatz für die Originalunterlagen.", "Compact, source-bound overviews for understanding and review, not as a replacement for the original course materials.")}</p>
    </div>
    <div className="subject-tabs">
      <button className={subject === "portfolio" ? "active" : ""} onClick={() => { setSubject("portfolio"); onSubjectChange("portfolio"); }}>Portfolio Management</button>
      <button className={subject === "tax" ? "active" : ""} onClick={() => { setSubject("tax"); onSubjectChange("tax"); }}>Taxation</button>
    </div>
    <div className="models-grid">{modelOverviews.filter((item) => item.subject === subject).map((model) => <article className={open === model.id ? "model-card open" : "model-card"} key={model.id}>
      <button onClick={() => setOpen(open === model.id ? "" : model.id)}><div><span>{subject === "portfolio" ? "◎" : "§"}</span><h2>{model.title}</h2></div><b>{open === model.id ? "−" : "+"}</b></button>
      {open === model.id && <div className="model-content">
        <p>{model.summary}</p>
        {model.formula ? <div className="formula-box">{model.formula}</div> : null}
        <h3>{tr(language, "Prüfungs-Check", "Exam check")}</h3>
        <ol>{model.checkpoints.map((item) => <li key={item}>{item}</li>)}</ol>
        <SourceBadge source={model.source} language={language} />
        <button className="primary-button active-check" onClick={() => navigate("quiz", { subject: model.subject, topic: modelQuizTopic(model.id, model.title) })}>{tr(language, "Wissen aktiv mit MCQs prüfen", "Check knowledge actively with MCQs")} →</button>
        <small>{tr(language, "Das Lesen selbst gibt keine Kompetenzpunkte.", "Reading alone does not award mastery points.")}</small>
      </div>}
    </article>)}</div>
  </section>;
}
