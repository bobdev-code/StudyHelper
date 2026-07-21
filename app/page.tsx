"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flashcards, learningVideos, modelOverviews, quizQuestions } from "@/lib/data";
import {
  addAnswer,
  defaultProgress,
  loadProgress,
  resetProgress,
  reviewCard,
  saveProgress,
  upsertExam,
} from "@/lib/storage";
import type {
  AnswerRecord,
  AppProgress,
  Confidence,
  ErrorType,
  ExamSession,
  Flashcard,
  QuizQuestion,
  Subject,
} from "@/lib/types";
import { createLabTasks, labErrorByStage, type LabTask } from "@/lib/data/calculationLab";

type View = "dashboard" | "plan" | "cards" | "quiz" | "trainer" | "errors" | "models" | "videos" | "exam";

const subjectName: Record<Subject, string> = {
  portfolio: "Portfolio Management",
  tax: "German & International Taxation",
};

const errorTypes: ErrorType[] = [
  "Wissenslücke",
  "falsche Formel",
  "Rechenfehler",
  "Norm nicht gefunden",
  "Rechtsfolge falsch",
  "Interpretation fehlt",
  "Flüchtigkeitsfehler",
];

const navItems: { view: View; label: string; icon: string }[] = [
  { view: "dashboard", label: "Dashboard", icon: "▦" },
  { view: "plan", label: "Tagesplan", icon: "✓" },
  { view: "cards", label: "Karteikarten", icon: "▱" },
  { view: "quiz", label: "Diagnose & Quiz", icon: "?" },
  { view: "trainer", label: "Fachtrainer", icon: "∑" },
  { view: "errors", label: "Fehlerbuch", icon: "!" },
  { view: "models", label: "Modelle", icon: "⌁" },
  { view: "videos", label: "Video-Playlist", icon: "▶" },
  { view: "exam", label: "Prüfungsmodus", icon: "◇" },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isCorrect(question: QuizQuestion, answer: number | number[] | undefined) {
  if (answer === undefined) return false;
  if (Array.isArray(question.correct)) {
    return (
      Array.isArray(answer) &&
      question.correct.length === answer.length &&
      question.correct.every((item, index) => item === answer[index])
    );
  }
  return answer === question.correct;
}

function daysUntil(date: string) {
  return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000));
}

function pct(value: number, max: number) {
  return max ? Math.round((value / max) * 100) : 0;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function pickQuestionsForPoints(items: QuizQuestion[], target: number) {
  const combinations = new Map<number, QuizQuestion[]>([[0, []]]);
  for (const item of shuffle(items)) {
    const existing = [...combinations.entries()].sort((a, b) => b[0] - a[0]);
    for (const [points, selected] of existing) {
      const next = points + item.points;
      if (next <= target && !combinations.has(next)) {
        combinations.set(next, [...selected, item]);
      }
    }
    if (combinations.has(target)) return combinations.get(target)!;
  }
  return combinations.get(Math.max(...combinations.keys())) ?? [];
}

function SourceBadge({ source }: { source: Flashcard["source"] }) {
  return (
    <details className="source-badge">
      <summary>Quelle prüfen</summary>
      <div>
        <strong>{source.document}</strong>
        <span>{source.location}</span>
        {source.note && <small>{source.note}</small>}
      </div>
    </details>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [progress, setProgress] = useState<AppProgress>(defaultProgress);
  const [ready, setReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setProgress(loadProgress());
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (ready) saveProgress(progress);
  }, [progress, ready]);

  const navigate = (next: View) => {
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark">L</span>
          <div><strong>Lerntrainer</strong><small>Nachprüfung 2026</small></div>
        </div>
        <nav aria-label="Hauptnavigation">
          {navItems.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.view)}
            >
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="pulse-dot" />
          <div><strong>04. August 2026</strong><small>Dein Fortschritt zählt.</small></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
          <button className="menu-button" onClick={() => setMobileNav((value) => !value)} aria-label="Menü öffnen">☰</button>
          <strong>Lerntrainer 2026</strong>
          <span>{daysUntil(progress.settings.examDate)} T</span>
        </header>
        {view === "dashboard" && <Dashboard progress={progress} navigate={navigate} />}
        {view === "plan" && <DailyPlan progress={progress} navigate={navigate} />}
        {view === "cards" && <Cards progress={progress} setProgress={setProgress} />}
        {view === "quiz" && <Quiz setProgress={setProgress} />}
        {view === "trainer" && <SubjectTrainer setProgress={setProgress} />}
        {view === "errors" && <ErrorBook progress={progress} navigate={navigate} />}
        {view === "models" && <Models />}
        {view === "videos" && <Videos />}
        {view === "exam" && <Exam progress={progress} setProgress={setProgress} />}
        <footer className="app-footer">
          <span>Lokaler Lernstand · keine Anmeldung</span>
          <button
            className="text-button danger"
            onClick={() => {
              if (window.confirm("Wirklich den gesamten Lernstand zurücksetzen?")) {
                setProgress(resetProgress());
              }
            }}
          >Lernstand zurücksetzen</button>
        </footer>
      </main>
    </div>
  );
}

function Dashboard({ progress, navigate }: { progress: AppProgress; navigate: (view: View) => void }) {
  const metrics = useMemo(() => {
    const result = { portfolio: { correct: 0, total: 0 }, tax: { correct: 0, total: 0 } };
    progress.answers.forEach((answer) => {
      result[answer.subject].total += 1;
      if (answer.correct) result[answer.subject].correct += 1;
    });
    return result;
  }, [progress.answers]);
  const baseline = { portfolio: 29, tax: 50 };
  const score = (subject: Subject) => {
    const metric = metrics[subject];
    if (!metric.total) return baseline[subject];
    const practiceEstimate = Math.round((metric.correct / metric.total) * 90);
    return Math.round(baseline[subject] * 0.35 + practiceEstimate * 0.65);
  };
  const pScore = score("portfolio");
  const tScore = score("tax");
  const total = pScore + tScore;
  const weak = getTopicStats(progress).filter((topic) => topic.answers > 0).slice(0, 5);
  const reviewed = Object.values(progress.cards).filter((card) => card.attempts > 0).length;
  const accuracy = pct(
    progress.answers.filter((answer) => answer.correct).length,
    progress.answers.length,
  );

  return (
    <section className="page dashboard-page">
      <div className="dashboard-heading">
        <div><p className="eyebrow">PRÜFUNG · 04. AUGUST 2026</p><h1>Guten Abend, Admin</h1><p>Heute zählt nicht Perfektion, sondern der nächste sichere Punkt.</p></div>
        <div className="countdown"><span className="calendar-icon">▦</span><strong>{daysUntil(progress.settings.examDate)}</strong><span>Tage bis zur Prüfung</span></div>
      </div>

      <div className="subject-grid">
        <SubjectCard subject="portfolio" score={pScore} accuracy={metrics.portfolio.total ? pct(metrics.portfolio.correct, metrics.portfolio.total) : 32} priority />
        <SubjectCard subject="tax" score={tScore} accuracy={metrics.tax.total ? pct(metrics.tax.correct, metrics.tax.total) : 56} />
      </div>

      <div className="dashboard-lower">
        <article className="panel goal-panel">
          <div className="panel-title"><span>◎</span><h2>Punkteziele</h2></div>
          <div className="goal-scale">
            {[90, 105, 115].map((goal) => <div key={goal} className={total >= goal ? "goal reached" : goal === 105 ? "goal focus" : "goal"}><strong>{goal}</strong><span>{goal === 90 ? "Bestehen" : goal === 105 ? "Sicherheitspuffer" : "Starkes Ziel"}</span></div>)}
          </div>
          <div className="goal-line"><span style={{ width: `${Math.min(100, (total / 115) * 100)}%` }} /></div>
          <p className="current-score">Aktuelle Schätzung <strong>{total} / 180</strong></p>
          <small>Die Schätzung gewichtet dein altes Ergebnis und deine Lernantworten; sie ist keine Prüfungsprognose.</small>
        </article>

        <article className="panel topic-panel">
          <div className="panel-title"><span>◔</span><h2>Themenstatus</h2></div>
          {weak.length ? weak.map((item) => (
            <div className="topic-row" key={`${item.subject}-${item.topic}`}><span className={item.accuracy >= 75 ? "status-dot safe" : item.accuracy >= 55 ? "status-dot unsure" : "status-dot weak"} /><span>{item.topic}</span><strong>{item.accuracy}%</strong></div>
          )) : <div className="starter-topics"><div><span className="status-dot weak" />CAPM, SML & Beta</div><div><span className="status-dot unsure" />Performance Measures</div><div><span className="status-dot safe" />Taxation basics</div></div>}
        </article>

        <article className="panel next-panel">
          <div className="panel-title"><span>▱</span><h2>Nächste Lerneinheit</h2></div>
          <div className="recommendation"><span className="rec-icon">◎</span><div><strong>{weak[0]?.topic ?? "CAPM, SML & Beta"}</strong><span>25 Min · 12 Karten · 8 Fragen</span></div></div>
          <button className="primary-button" onClick={() => navigate("cards")}>Portfolio-Fokus starten <span>→</span></button>
          <button className="text-button" onClick={() => navigate("quiz")}>Diagnosetest öffnen</button>
        </article>
      </div>

      <div className="micro-stats"><span><strong>{reviewed}</strong> Karten bearbeitet</span><span><strong>{progress.answers.length}</strong> Antworten</span><span><strong>{progress.answers.length ? accuracy : "–"}{progress.answers.length ? "%" : ""}</strong> Trefferquote</span></div>
    </section>
  );
}

function SubjectCard({ subject, score, accuracy, priority = false }: { subject: Subject; score: number; accuracy: number; priority?: boolean }) {
  return (
    <article className={`subject-card ${subject} ${priority ? "priority" : ""}`}>
      <div className="subject-card-head"><span className="subject-icon">{subject === "portfolio" ? "◎" : "§"}</span><div><p>{priority ? "PRIORITÄT HOCH" : "STABILISIEREN"}</p><h2>{subjectName[subject]}</h2></div></div>
      <div className="score-row"><strong>{score}</strong><span>/ 90 Punkte</span><b>{accuracy}%</b></div>
      <div className="progress-track"><span style={{ width: `${Math.min(100, (score / 90) * 100)}%` }} /></div>
      <p className="subject-note">{subject === "portfolio" ? "Intensivpfad · Formeln, Rechenroutine, Interpretation" : "Punkte sichern · Norm, Tatbestand, Rechtsfolge"}</p>
    </article>
  );
}

function Cards({ progress, setProgress }: { progress: AppProgress; setProgress: React.Dispatch<React.SetStateAction<AppProgress>> }) {
  const [subject, setSubject] = useState<Subject | "all">("portfolio");
  const [topic, setTopic] = useState("all");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const topics = [...new Set(flashcards.filter((card) => subject === "all" || card.subject === subject).map((card) => card.topic))];
  const filtered = flashcards.filter((card) => {
    const matchesSubject = subject === "all" || card.subject === subject;
    const matchesTopic = topic === "all" || card.topic === topic;
    const matchesQuery = `${card.front} ${card.back} ${card.topic}`.toLowerCase().includes(query.toLowerCase());
    const matchesFavorite = !favorites || progress.cards[card.id]?.favorite;
    return matchesSubject && matchesTopic && matchesQuery && matchesFavorite;
  });
  const card = filtered[index % Math.max(1, filtered.length)];
  const review = (result: "known" | "uncertain" | "wrong") => {
    if (!card) return;
    setProgress((current) => ({ ...current, cards: { ...current.cards, [card.id]: reviewCard(current.cards[card.id], result) } }));
    setFlipped(false);
    setIndex((value) => (value + 1) % Math.max(1, filtered.length));
  };
  const toggleFavorite = () => {
    if (!card) return;
    setProgress((current) => {
      const old = current.cards[card.id] ?? reviewCard(undefined, "uncertain");
      return { ...current, cards: { ...current.cards, [card.id]: { ...old, favorite: !old.favorite, attempts: current.cards[card.id]?.attempts ?? 0 } } };
    });
  };

  return (
    <section className="page">
      <PageHeading eyebrow="SPACED REPETITION" title="Karteikarten" description={`${flashcards.filter((item) => item.subject === "portfolio").length} Portfolio- und ${flashcards.filter((item) => item.subject === "tax").length} Taxation-Karten mit Quellenreferenz.`} />
      <div className="toolbar">
        <select value={subject} onChange={(event) => { setSubject(event.target.value as Subject | "all"); setTopic("all"); setIndex(0); setFlipped(false); }}><option value="portfolio">Portfolio Management</option><option value="tax">Taxation</option><option value="all">Beide Fächer</option></select>
        <select value={topic} onChange={(event) => { setTopic(event.target.value); setIndex(0); setFlipped(false); }}><option value="all">Alle Themen</option>{topics.map((item) => <option key={item}>{item}</option>)}</select>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setIndex(0); setFlipped(false); }} placeholder="Karten durchsuchen …" />
        <button className={favorites ? "filter-button active" : "filter-button"} onClick={() => { setFavorites((value) => !value); setIndex(0); setFlipped(false); }}>★ Favoriten</button>
      </div>
      {card ? (
        <div className="study-layout">
          <div className="card-stage">
            <div className="card-meta"><span>{subjectName[card.subject]}</span><strong>{index + 1} / {filtered.length}</strong><span>Box {progress.cards[card.id]?.box ?? 1}</span></div>
            <button className={flipped ? "flashcard flipped" : "flashcard"} onClick={() => setFlipped((value) => !value)}>
              <span className="card-label">{flipped ? "ANTWORT" : card.topic.toUpperCase()}</span>
              <div>{flipped ? <><p className="card-answer">{card.back}</p>{card.helpDe && <p className="german-help">Verständnishilfe: {card.helpDe}</p>}</> : <h2>{card.front}</h2>}</div>
              <span className="flip-hint">{flipped ? "Zurück zur Frage" : "Tippen zum Aufdecken"}</span>
            </button>
            {flipped && <div className="review-buttons"><button className="wrong" onClick={() => review("wrong")}>Nicht gewusst</button><button className="unsure" onClick={() => review("uncertain")}>Unsicher</button><button className="known" onClick={() => review("known")}>Gewusst</button></div>}
            <div className="card-actions"><button className="text-button" onClick={() => setIndex((value) => (value - 1 + filtered.length) % filtered.length)}>← Vorherige</button><button className={progress.cards[card.id]?.favorite ? "favorite active" : "favorite"} onClick={toggleFavorite}>★ {progress.cards[card.id]?.favorite ? "Favorit" : "Merken"}</button><button className="text-button" onClick={() => { setFlipped(false); setIndex((value) => (value + 1) % filtered.length); }}>Nächste →</button></div>
          </div>
          <aside className="study-sidebar"><h3>Lernlogik</h3><p>Gewusste Karten wandern in längere Intervalle. Unsichere Karten kommen morgen, falsche Karten sofort wieder in Box 1.</p><div className="due-stat"><strong>{Object.values(progress.cards).filter((item) => new Date(item.dueAt) <= new Date()).length}</strong><span>heute fällig</span></div><SourceBadge source={card.source} /></aside>
        </div>
      ) : <EmptyState>Keine Karten passen zu diesem Filter.</EmptyState>}
    </section>
  );
}

function Quiz({ setProgress }: { setProgress: React.Dispatch<React.SetStateAction<AppProgress>> }) {
  const [subject, setSubject] = useState<Subject | "all">("portfolio");
  const [diagnostic, setDiagnostic] = useState(false);
  const [session, setSession] = useState<QuizQuestion[]>([]);
  const [sessionResults, setSessionResults] = useState<AnswerRecord[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number | number[]>();
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [errorType, setErrorType] = useState<ErrorType>("Wissenslücke");
  const started = useRef(0);
  const question = session[index];

  const start = () => {
    const pool = quizQuestions.filter((item) => (subject === "all" || item.subject === subject) && (!diagnostic || item.diagnostic));
    const broad = [...new Map(shuffle(pool).map((item) => [`${item.subject}-${item.topic}`, item])).values()];
    const target = diagnostic ? (subject === "all" ? 18 : 12) : 12;
    setSession([...broad, ...shuffle(pool.filter((item) => !broad.includes(item)))].slice(0, target));
    setSessionResults([]); setShowResult(false);
    setIndex(0); setAnswer(undefined); setChecked(false); started.current = Date.now();
  };
  const check = () => {
    if (!question || answer === undefined) return;
    const correct = isCorrect(question, answer);
    const record: AnswerRecord = { id: uid("answer"), questionId: question.id, subject: question.subject, topic: question.topic, correct, durationMs: Date.now() - started.current, confidence, errorType: correct ? undefined : errorType, answeredAt: new Date().toISOString() };
    setProgress((current) => addAnswer(current, record));
    setSessionResults((current) => [...current, record]);
    setChecked(true);
  };
  const next = () => {
    if (index >= session.length - 1) { setSession([]); setShowResult(true); return; }
    setIndex((value) => value + 1); setAnswer(undefined); setChecked(false); setConfidence("medium"); started.current = Date.now();
  };

  if (!question && showResult) {
    const grouped = [...new Map(sessionResults.map((item) => [`${item.subject}-${item.topic}`, { subject: item.subject, topic: item.topic }])).values()].map((group) => {
      const answers = sessionResults.filter((item) => item.subject === group.subject && item.topic === group.topic);
      const correct = answers.filter((item) => item.correct).length;
      const falseHigh = answers.filter((item) => !item.correct && item.confidence === "high").length;
      return { ...group, correct, total: answers.length, accuracy: pct(correct, answers.length), falseHigh };
    }).sort((a, b) => a.accuracy - b.accuracy);
    return <section className="page"><PageHeading eyebrow="DIAGNOSE ABGESCHLOSSEN" title={`${pct(sessionResults.filter((item) => item.correct).length, sessionResults.length)}% richtig`} description="Das Kompetenzprofil trennt Trefferquote und Scheinsicherheit. Themen mit sicher falschen Antworten erhalten höchste Priorität." />
      <div className="competence-grid">{grouped.map((item) => <article className="competence-card" key={`${item.subject}-${item.topic}`}><div><span>{subjectName[item.subject]}</span><b className={item.accuracy >= 75 ? "safe" : item.accuracy >= 50 ? "unsure" : "weak"}>{item.accuracy >= 75 ? "stabil" : item.falseHigh ? "Scheinsicherheit" : item.accuracy >= 50 ? "unsicher" : "Lücke"}</b></div><h3>{item.topic}</h3><div className="progress-track"><span style={{ width: `${item.accuracy}%` }} /></div><p>{item.correct}/{item.total} richtig{item.falseHigh ? ` · ${item.falseHigh}× sicher falsch` : ""}</p></article>)}</div>
      <button className="primary-button result-restart" onClick={() => { setShowResult(false); setSubject("all"); setDiagnostic(true); }}>Neue Gesamtdiagnose vorbereiten →</button>
    </section>;
  }

  if (!question) return (
    <section className="page"><PageHeading eyebrow="AKTIVES ABRUFEN" title="Quiz" description="Englische Prüfungsfragen, sofortiges Feedback und persönliches Fehlerprotokoll." />
      <div className="setup-grid three"><article className={`setup-card ${subject === "portfolio" ? "selected" : ""}`} onClick={() => setSubject("portfolio")}><span>◎</span><h2>Portfolio Management</h2><p>{quizQuestions.filter((item) => item.subject === "portfolio").length} geprüfte Fragen</p></article><article className={`setup-card ${subject === "tax" ? "selected tax" : ""}`} onClick={() => setSubject("tax")}><span>§</span><h2>Taxation</h2><p>{quizQuestions.filter((item) => item.subject === "tax").length} geprüfte Fragen</p></article><article className={`setup-card ${subject === "all" ? "selected combined" : ""}`} onClick={() => { setSubject("all"); setDiagnostic(true); }}><span>◫</span><h2>Gesamtdiagnose</h2><p>18 Fragen aus beiden Fächern</p></article></div>
      <div className="quiz-start panel"><label className="switch-row"><input type="checkbox" checked={diagnostic} onChange={(event) => setDiagnostic(event.target.checked)} /><span><strong>Adaptiver Diagnosetest</strong><small>{subject === "all" ? "18" : "12"} breit gestreute Fragen mit Sicherheitsabgleich</small></span></label><button className="primary-button" onClick={start}>{diagnostic ? "Diagnosetest starten" : "12 Fragen starten"} →</button></div>
    </section>
  );

  return (
    <section className="page quiz-page">
      <div className="quiz-progress"><span style={{ width: `${((index + 1) / session.length) * 100}%` }} /></div>
      <div className="quiz-top"><span>{subjectName[question.subject]} · {question.topic}</span><strong>Frage {index + 1} / {session.length}</strong><span>{question.points} Punkte</span></div>
      <article className="question-card"><span className="question-type">{question.type.replace("-", " ")}</span><h1>{question.prompt}</h1>
        <div className="options">{question.options.map((option, optionIndex) => <button key={option} disabled={checked} className={`${!Array.isArray(answer) && answer === optionIndex ? "selected" : ""} ${checked && !Array.isArray(question.correct) && question.correct === optionIndex ? "correct" : ""} ${checked && !Array.isArray(answer) && answer === optionIndex && !isCorrect(question, answer) ? "incorrect" : ""}`} onClick={() => setAnswer(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>
        {!checked && <div className="answer-meta"><label>Sicherheit<select value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}><option value="low">niedrig</option><option value="medium">mittel</option><option value="high">hoch</option></select></label><label>Falls falsch: Fehlerart<select value={errorType} onChange={(event) => setErrorType(event.target.value as ErrorType)}>{errorTypes.map((item) => <option key={item}>{item}</option>)}</select></label></div>}
        {checked && <div className={isCorrect(question, answer) ? "feedback correct-feedback" : "feedback wrong-feedback"}><h3>{isCorrect(question, answer) ? "Richtig." : "Noch nicht richtig."}</h3><p>{question.explanation}</p>{question.solutionSteps && <ol>{question.solutionSteps.map((step) => <li key={step}>{step}</li>)}</ol>}{question.helpDe && <p className="german-help">Verständnishilfe: {question.helpDe}</p>}<SourceBadge source={question.source} /></div>}
        <div className="question-actions">{!checked ? <button className="primary-button" disabled={answer === undefined} onClick={check}>Antwort prüfen</button> : <button className="primary-button" onClick={next}>{index === session.length - 1 ? "Quiz beenden" : "Nächste Frage"} →</button>}</div>
      </article>
    </section>
  );
}

type TrainerMode = "calculation" | "tax-case" | "formula" | "lab";

function SubjectTrainer({ setProgress }: { setProgress: React.Dispatch<React.SetStateAction<AppProgress>> }) {
  const [mode, setMode] = useState<TrainerMode>();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number>();
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [labTasks, setLabTasks] = useState<LabTask[]>([]);
  const [labIndex, setLabIndex] = useState(0);
  const started = useRef(0);
  const question = questions[index];

  const startMode = (next: TrainerMode) => {
    if (next === "lab") { setMode(next); setLabTasks(createLabTasks()); setLabIndex(0); return; }
    const filtered = quizQuestions.filter((item) => next === "calculation"
      ? item.subject === "portfolio" && item.type === "calculation"
      : next === "tax-case"
        ? item.subject === "tax" && ["legal-rule", "ordering", "calculation"].includes(item.type)
        : (item.subject === "portfolio" && item.type === "formula") || (item.subject === "tax" && item.type === "legal-rule"));
    setMode(next); setQuestions(shuffle(filtered)); setIndex(0); setAnswer(undefined); setChecked(false); started.current = Date.now();
  };
  const check = () => {
    if (!question || answer === undefined) return;
    const correct = isCorrect(question, answer);
    setProgress((current) => addAnswer(current, { id: uid("trainer"), questionId: question.id, subject: question.subject, topic: question.topic, correct, durationMs: Date.now() - started.current, confidence, errorType: correct ? undefined : mode === "calculation" ? "Rechenfehler" : mode === "tax-case" ? "Rechtsfolge falsch" : question.subject === "tax" ? "Norm nicht gefunden" : "falsche Formel", answeredAt: new Date().toISOString() }));
    setChecked(true);
  };
  const next = () => { setIndex((value) => (value + 1) % Math.max(1, questions.length)); setAnswer(undefined); setChecked(false); setConfidence("medium"); started.current = Date.now(); };

  if (mode === "lab" && labTasks[labIndex]) return <CalculationLab task={labTasks[labIndex]} position={labIndex} total={labTasks.length} confidence={confidence} setConfidence={setConfidence} onExit={() => setMode(undefined)} onComplete={(errors) => {
    const task = labTasks[labIndex]; const correct = errors.length === 0;
    setProgress((current) => addAnswer(current, { id: uid("lab"), questionId: `lab-${task.id}-${Date.now()}`, subject: "portfolio", topic: task.topic, correct, durationMs: 0, confidence, errorType: correct ? undefined : labErrorByStage[errors[0]], answeredAt: new Date().toISOString() }));
    setLabTasks((current) => correct ? current : [...current, createLabTasks(Date.now()+labIndex).find((item) => item.id === task.id)!]);
    setLabIndex((value) => value + 1); setConfidence("medium");
  }} />;

  if (!mode || !question) return <section className="page"><PageHeading eyebrow="GEZIELTE PRÜFUNGSROUTINE" title="Fachtrainer" description="Vier fokussierte Trainingsarten: Rechenlabor, klassische Aufgaben, strukturierte Steuerfälle und schnelles Abrufen von Formeln beziehungsweise Normen." />
    <div className="trainer-grid">
      <button className="trainer-card lab" onClick={() => startMode("lab")}><span>⌬</span><h2>Portfolio-Rechenlabor</h2><p>Formel erkennen, Werte zuordnen, Ergebnis vorhersagen, jeden Schritt rechnen und ökonomisch erklären.</p><b>7 adaptive Rechenstrecken →</b></button>
      <button className="trainer-card portfolio" onClick={() => startMode("calculation")}><span>∑</span><h2>Portfolio-Rechentrainer</h2><p>Aufgaben mit vollständigem Lösungsweg, Einheiten und unmittelbarer Fehlererkennung.</p><b>{quizQuestions.filter((item) => item.subject === "portfolio" && item.type === "calculation").length} Aufgaben →</b></button>
      <button className="trainer-card tax" onClick={() => startMode("tax-case")}><span>§</span><h2>Taxation-Falltrainer</h2><p>Steuerart, Steuersubjekt, Norm, Korrektur und Rechtsfolge systematisch prüfen.</p><b>{quizQuestions.filter((item) => item.subject === "tax" && ["legal-rule", "ordering", "calculation"].includes(item.type)).length} Fälle →</b></button>
      <button className="trainer-card formula" onClick={() => startMode("formula")}><span>ƒ</span><h2>Formeln & Normen</h2><p>Die passende Formel oder Vorschrift unter Zeitdruck erkennen und typische Verwechslungen vermeiden.</p><b>Schnelltraining →</b></button>
    </div>
  </section>;

  return <section className="page"><div className="trainer-head"><button className="text-button" onClick={() => setMode(undefined)}>← Trainingsarten</button><span>{index + 1} / {questions.length}</span></div>
    <article className="question-card"><span className="question-type">{mode === "calculation" ? "RECHENTRAINER" : mode === "tax-case" ? "FALLTRAINER" : "FORMEL / NORM"}</span><h1>{question.prompt}</h1>
      {mode === "tax-case" && <div className="case-schema"><span>1 Steuerart</span><span>2 Subjekt</span><span>3 Ausgangsbetrag</span><span>4 Norm</span><span>5 Korrektur</span><span>6 Ergebnis</span></div>}
      <div className="options">{question.options.map((option, optionIndex) => <button key={option} disabled={checked} className={`${answer === optionIndex ? "selected" : ""} ${checked && !Array.isArray(question.correct) && question.correct === optionIndex ? "correct" : ""} ${checked && answer === optionIndex && !isCorrect(question, answer) ? "incorrect" : ""}`} onClick={() => setAnswer(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>
      {!checked && <label className="exam-confidence">Sicherheit<select value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}><option value="low">niedrig</option><option value="medium">mittel</option><option value="high">hoch</option></select></label>}
      {checked && <div className={isCorrect(question, answer) ? "feedback correct-feedback" : "feedback wrong-feedback"}><h3>{isCorrect(question, answer) ? "Richtig." : "Fehler erkannt."}</h3><p>{question.explanation}</p>{question.solutionSteps && <ol>{question.solutionSteps.map((step) => <li key={step}>{step}</li>)}</ol>}<SourceBadge source={question.source} /></div>}
      <div className="question-actions">{checked ? <button className="primary-button" onClick={next}>Nächste Aufgabe →</button> : <button className="primary-button" disabled={answer === undefined} onClick={check}>Antwort prüfen</button>}</div>
    </article>
  </section>;
}

function CalculationLab({ task, position, total, confidence, setConfidence, onExit, onComplete }: {
  task: LabTask; position: number; total: number; confidence: Confidence;
  setConfidence: (value: Confidence) => void; onExit: () => void; onComplete: (errors: string[]) => void;
}) {
  const [stage, setStage] = useState<"formula" | "variables" | "prediction" | "steps" | "interpretation" | "result">("formula");
  const [formula, setFormula] = useState<number>();
  const [prediction, setPrediction] = useState<number>();
  const [stepValues, setStepValues] = useState<string[]>(task.steps.map(() => ""));
  const [interpretation, setInterpretation] = useState<number>();
  const [checked, setChecked] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [hint, setHint] = useState<number>();
  const mark = (key: string, correct: boolean) => { if (!correct) setErrors((items) => items.includes(key) ? items : [...items, key]); setChecked(true); };
  const advance = (next: typeof stage) => { setStage(next); setChecked(false); setHint(undefined); };
  const stepCorrect = task.steps.map((item, index) => {
    const value = Number(stepValues[index].replace(",", "."));
    return Number.isFinite(value) && Math.abs(value-item.answer) <= (item.tolerance ?? Math.max(.02, Math.abs(item.answer)*.005));
  });
  return <section className="page lab-page">
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← Trainingsarten</button><span>Rechenstrecke {Math.min(position+1,total)} / {total}</span></div>
    <div className="lab-progress">{["Formel","Variablen","Prognose","Rechnen","Deuten"].map((label,index)=><span key={label} className={index <= ["formula","variables","prediction","steps","interpretation","result"].indexOf(stage) ? "active" : ""}>{index+1}<small>{label}</small></span>)}</div>
    <article className="question-card lab-card"><div className="lab-title"><span className="question-type">RECHENLABOR · {task.topic}</span><h1>{task.title}</h1><p>{task.prompt}</p></div>
      {stage === "formula" && <><h2>1. Welches Modell brauchst du?</h2><p className="stage-intro">Wähle zuerst die passende Formel – noch ohne Zahlen einzusetzen.</p><div className="options formula-options">{task.formulaOptions.map((item,i)=><button key={item} disabled={checked} className={`${formula===i?"selected":""} ${checked&&i===0?"correct":""} ${checked&&formula===i&&i!==0?"incorrect":""}`} onClick={()=>setFormula(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>{checked&&<div className={formula===0?"feedback correct-feedback":"feedback wrong-feedback"}><b>{formula===0?"Passende Formel erkannt.":"Diese Formel beantwortet eine andere Frage."}</b><p>{task.trap}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("variables")}>Werte zuordnen →</button>:<button className="primary-button" disabled={formula===undefined} onClick={()=>mark("formula",formula===0)}>Prüfen</button>}</div></>}
      {stage === "variables" && <><h2>2. Angaben den Variablen zuordnen</h2><p className="stage-intro">Sprich jede Zeile innerlich aus. So wird aus Symbolen ein Rechenplan.</p><div className="variable-grid">{task.variables.map(item=><div key={item.symbol}><strong>{item.symbol}</strong><b>{item.value}</b><span>{item.meaning}</span></div>)}</div><div className="feedback neutral-feedback"><b>Einheiten-Check</b><p>Prozentwerte beim Rechnen konsistent als Prozent oder Dezimalzahl verwenden. Nicht innerhalb eines Rechenschritts mischen.</p></div><div className="question-actions"><button className="primary-button" onClick={()=>advance("prediction")}>Ergebnisrichtung vorhersagen →</button></div></>}
      {stage === "prediction" && <><h2>3. Was erwartest du vor dem Rechnen?</h2><p className="stage-intro">Die Prognose ist dein Plausibilitätscheck gegen Taschenrechner- und Vorzeichenfehler.</p><div className="options">{task.predictionOptions.map((item,i)=><button key={item} disabled={checked} className={`${prediction===i?"selected":""} ${checked&&i===0?"correct":""} ${checked&&prediction===i&&i!==0?"incorrect":""}`} onClick={()=>setPrediction(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>{checked&&<div className={prediction===0?"feedback correct-feedback":"feedback wrong-feedback"}><p>{task.prediction}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("steps")}>Jetzt rechnen →</button>:<button className="primary-button" disabled={prediction===undefined} onClick={()=>mark("prediction",prediction===0)}>Prognose prüfen</button>}</div></>}
      {stage === "steps" && <><h2>4. Rechenweg in kontrollierten Schritten</h2><div className="formula-strip">{task.formula}</div><div className="step-inputs">{task.steps.map((item,i)=><label key={item.label} className={checked?(stepCorrect[i]?"step-right":"step-wrong"):""}><span><b>{i+1}. {item.label}</b>{hint===i&&<small>{item.hint}</small>}</span><span className="number-field"><input inputMode="decimal" value={stepValues[i]} disabled={checked} onChange={e=>setStepValues(values=>values.map((v,x)=>x===i?e.target.value:v))} placeholder="Dein Wert"/><i>{item.unit}</i></span>{!checked&&<button type="button" className="hint-button" onClick={()=>setHint(i)}>Hinweis</button>}{checked&&!stepCorrect[i]&&<em>Richtig: {String(item.answer).replace(".",",")} {item.unit}</em>}</label>)}</div>{checked&&<div className={stepCorrect.every(Boolean)?"feedback correct-feedback":"feedback wrong-feedback"}><b>{stepCorrect.every(Boolean)?"Rechenweg vollständig korrekt.":"Der genaue Fehlerpunkt ist markiert."}</b><p>{task.trap}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("interpretation")}>Ergebnis deuten →</button>:<button className="primary-button" disabled={stepValues.some(v=>!v.trim())} onClick={()=>mark("steps",stepCorrect.every(Boolean))}>Rechenweg prüfen</button>}</div></>}
      {stage === "interpretation" && <><h2>5. Was bedeutet das Ergebnis?</h2><div className="options">{task.interpretationOptions.map((item,i)=><button key={item} disabled={checked} className={`${interpretation===i?"selected":""} ${checked&&i===0?"correct":""} ${checked&&interpretation===i&&i!==0?"incorrect":""}`} onClick={()=>setInterpretation(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>{checked&&<div className={interpretation===0?"feedback correct-feedback":"feedback wrong-feedback"}><p>{task.interpretation}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("result")}>Auswertung →</button>:<button className="primary-button" disabled={interpretation===undefined} onClick={()=>mark("interpretation",interpretation===0)}>Interpretation prüfen</button>}</div></>}
      {stage === "result" && <div className="lab-result"><span className={errors.length?"result-ring needs-work":"result-ring mastered"}>{5-errors.length}<small>/ 5</small></span><h2>{errors.length?"Rechenstrecke abgeschlossen – gezielte Wiederholung eingeplant.":"Rechenstrecke sicher beherrscht."}</h2><p>{errors.length?`Noch offen: ${errors.map(e=>({formula:"Formelwahl",prediction:"Plausibilität",steps:"Rechenweg",interpretation:"Deutung"}[e])).join(", ")}. Eine neue Zahlenvariante dieses Themas wird hinten angefügt.`:"Du hast Modellwahl, Plausibilität, Rechnung und Interpretation verbunden."}</p><label className="exam-confidence">Wie sicher fühltest du dich?<select value={confidence} onChange={e=>setConfidence(e.target.value as Confidence)}><option value="low">niedrig</option><option value="medium">mittel</option><option value="high">hoch</option></select></label><SourceBadge source={task.source}/><button className="primary-button" onClick={()=>onComplete(errors)}>Nächste Rechenstrecke →</button></div>}
    </article>
  </section>;
}

function ErrorBook({ progress, navigate }: { progress: AppProgress; navigate: (view: View) => void }) {
  const latestByQuestion = new Map<string, AnswerRecord>();
  [...progress.answers].reverse().forEach((item) => { if (!latestByQuestion.has(item.questionId)) latestByQuestion.set(item.questionId, item); });
  const errors = [...latestByQuestion.values()].filter((item) => !item.correct).map((answer) => ({ answer, question: quizQuestions.find((item) => item.id === answer.questionId) })).filter((item) => item.question) as { answer: AnswerRecord; question: QuizQuestion }[];
  const errorCounts = errorTypes.map((type) => ({ type, count: errors.filter((item) => item.answer.errorType === type).length })).filter((item) => item.count);
  return <section className="page"><PageHeading eyebrow="AUTOMATISCHE WIEDERVORLAGE" title="Dein Fehlerbuch" description="Hier landen die aktuell noch offenen Fehler. Sobald du dieselbe Aufgabe später richtig löst, verschwindet sie automatisch aus dieser Liste." />
    <div className="error-summary"><article className="panel"><strong>{errors.length}</strong><span>offene Fehler</span></article><article className="panel"><strong>{errors.filter((item) => item.answer.confidence === "high").length}</strong><span>Scheinsicherheiten</span></article><article className="panel"><strong>{errors.length}</strong><span>zur Wiedervorlage</span></article></div>
    {errorCounts.length > 0 && <div className="error-chips">{errorCounts.map((item) => <span key={item.type}>{item.type} <b>{item.count}</b></span>)}</div>}
    {errors.length ? <div className="review-list">{errors.map(({ answer, question }) => <article className="review-item wrong" key={question.id}><div><span>{answer.confidence === "high" ? "Scheinsicherheit" : "Wiederholen"}</span><strong>{subjectName[answer.subject]} · {answer.topic}</strong><b>{answer.errorType ?? "Wissenslücke"}</b></div><h3>{question.prompt}</h3><p>{question.explanation}</p><small>Fehler vom {new Date(answer.answeredAt).toLocaleDateString("de-DE")}</small><SourceBadge source={question.source} /></article>)}</div> : <EmptyState>Noch keine offenen Fehler. Löse einen Diagnosetest oder eine Prüfung, damit das Fehlerbuch gezielt arbeiten kann.</EmptyState>}
    <button className="primary-button error-cta" onClick={() => navigate("quiz")}>{errors.length ? "Offene Themen im Quiz trainieren" : "Diagnosetest starten"} →</button>
  </section>;
}

function DailyPlan({ progress, navigate }: { progress: AppProgress; navigate: (view: View) => void }) {
  const weak = getTopicStats(progress);
  const due = Object.values(progress.cards).filter((item) => new Date(item.dueAt) <= new Date()).length;
  const first = weak[0]; const second = weak[1];
  const tasks: { minutes: number; title: string; detail: string; view: View }[] = [
    { minutes: 10, title: "Fällige Fehler & Karten", detail: due ? `${due} Karte${due === 1 ? "" : "n"} sind heute fällig` : "Kurze Aktivierung aus dem Fehlerbuch", view: due ? "cards" : "errors" },
    { minutes: 15, title: first?.topic ?? "Portfolio-Rechenroutine", detail: first ? `${subjectName[first.subject]} · aktuell ${first.accuracy}%` : "CAPM, Beta und Portfoliovarianz", view: first?.subject === "tax" ? "quiz" : "trainer" },
    { minutes: 15, title: second?.topic ?? "Taxation-Fallroutine", detail: second ? `${subjectName[second.subject]} · aktuell ${second.accuracy}%` : "Norm, Tatbestand und Rechtsfolge", view: second?.subject === "portfolio" ? "trainer" : "quiz" },
    { minutes: 10, title: "Gemischter Abruf", detail: "Unsicherheiten mit Sicherheitsangabe prüfen", view: "quiz" },
    { minutes: 5, title: "Formeln & Normen", detail: "Schneller Abschluss ohne Unterlagen", view: "trainer" },
  ];
  return <section className="page"><PageHeading eyebrow={`${daysUntil(progress.settings.examDate)} TAGE BIS ZUR PRÜFUNG`} title={`Deine ${progress.settings.dailyMinutes + 10}-Minuten-Session`} description="Der Plan wird aus fälligen Wiederholungen und deinen schwächsten Themen berechnet. Neue Ergebnisse verändern automatisch die nächste Session." />
    <div className="plan-layout"><div className="plan-list">{tasks.map((task, index) => <button key={`${task.title}-${index}`} onClick={() => navigate(task.view)}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{task.title}</h3><p>{task.detail}</p></div><b>{task.minutes} Min →</b></button>)}</div>
      <aside className="panel plan-aside"><h2>Heutiger Fokus</h2><div className="plan-ring"><strong>{tasks.reduce((sum, item) => sum + item.minutes, 0)}</strong><span>Minuten</span></div><p>{first ? `Größter Hebel: ${first.topic}.` : "Starte mit der Gesamtdiagnose, damit der Plan persönlich wird."}</p><button className="primary-button" onClick={() => navigate(first ? tasks[0].view : "quiz")}>Session starten →</button></aside></div>
  </section>;
}

function Models() {
  const [subject, setSubject] = useState<Subject>("portfolio");
  const [open, setOpen] = useState(modelOverviews[0]?.id ?? "");
  return <section className="page"><PageHeading eyebrow="MODELLE & ÜBERSICHTEN" title="Prüfungswissen als Ablauf" description="Kompakte, quellengebundene Übersichten – für Verständnis und Wiederholung, nicht als Ersatz für die Originalunterlagen." />
    <div className="subject-tabs"><button className={subject === "portfolio" ? "active" : ""} onClick={() => setSubject("portfolio")}>Portfolio Management</button><button className={subject === "tax" ? "active" : ""} onClick={() => setSubject("tax")}>Taxation</button></div>
    <div className="models-grid">{modelOverviews.filter((item) => item.subject === subject).map((model) => <article className={open === model.id ? "model-card open" : "model-card"} key={model.id}><button onClick={() => setOpen(open === model.id ? "" : model.id)}><div><span>{subject === "portfolio" ? "◎" : "§"}</span><h2>{model.title}</h2></div><b>{open === model.id ? "−" : "+"}</b></button>{open === model.id && <div className="model-content"><p>{model.summary}</p>{model.formula && <div className="formula-box">{model.formula}</div>}<h3>Prüfungs-Check</h3><ol>{model.checkpoints.map((item) => <li key={item}>{item}</li>)}</ol><SourceBadge source={model.source} /></div>}</article>)}</div>
  </section>;
}

function Videos() {
  const [subject, setSubject] = useState<Subject>("portfolio");
  const [topic, setTopic] = useState("all");
  const topics = [...new Set(learningVideos.filter((video) => video.subject === subject).map((video) => video.topic))];
  const filtered = learningVideos.filter((video) => video.subject === subject && (topic === "all" || video.topic === topic));
  const grouped = topics
    .map((item) => ({ topic: item, videos: filtered.filter((video) => video.topic === item) }))
    .filter((group) => group.videos.length);

  return (
    <section className="page video-page">
      <PageHeading
        eyebrow="KURATIERTE ERKLÄRVIDEOS"
        title="Video-Playlist"
        description="Pro Prüfungsthema ein gezielt ausgewähltes Kernvideo; bei rechen- oder fallintensiven Themen ergänzt um eine Vertiefung. Auswahl nach Themenpassung, fachlichem Profil und sichtbarer Resonanz."
      />
      <div className="video-toolbar">
        <div className="subject-tabs" aria-label="Fach auswählen">
          <button className={subject === "portfolio" ? "active" : ""} onClick={() => { setSubject("portfolio"); setTopic("all"); }}>Portfolio Management</button>
          <button className={subject === "tax" ? "active" : ""} onClick={() => { setSubject("tax"); setTopic("all"); }}>Taxation</button>
        </div>
        <label>
          <span>Thema filtern</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="all">Alle Themen</option>
            {topics.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <aside className="video-method" aria-label="Hinweis zur Auswahl">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Geprüft am 20.07.2026</strong>
          <p>Likes und Aufrufe sind nur ein Qualitätssignal; entscheidend war die Passung zu deinen Unterlagen. Bei Steuerrecht gelten im Zweifel Kursunterlagen und aktueller Gesetzesstand.</p>
        </div>
      </aside>
      <div className="video-groups">
        {grouped.map((group, groupIndex) => (
          <section className="video-topic-group" key={group.topic}>
            <div className="video-topic-heading">
              <span>{String(groupIndex + 1).padStart(2, "0")}</span>
              <div><p>{subjectName[subject]}</p><h2>{group.topic}</h2></div>
              <small>{group.videos.length === 1 ? "1 Video" : `${group.videos.length} Videos`}</small>
            </div>
            <div className="video-grid">
              {group.videos.map((video) => (
                <article className="video-card" key={video.id}>
                  <div className="video-card-top">
                    <span className="video-play" aria-hidden="true">▶</span>
                    <div className="video-tags"><span>{video.level}</span><span>{video.language}</span></div>
                  </div>
                  <h3>{video.title}</h3>
                  <p className="video-creator">{video.creator}</p>
                  <p className="video-reason">{video.reason}</p>
                  <div className="video-signal"><span aria-hidden="true">↗</span>{video.signal}</div>
                  <a href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`${video.title} auf YouTube öffnen`}>
                    Auf YouTube ansehen <span aria-hidden="true">↗</span>
                  </a>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function Exam({ progress, setProgress }: { progress: AppProgress; setProgress: React.Dispatch<React.SetStateAction<AppProgress>> }) {
  const [subject, setSubject] = useState<Subject>("portfolio");
  const [exam, setExam] = useState<ExamSession>();
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(90 * 60);
  const [finished, setFinished] = useState(false);
  const [wrongFilter, setWrongFilter] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const incomplete = [...progress.exams].reverse().find((item) => !item.completedAt);

  const examQuestions = useMemo(() => exam ? exam.questionIds.map((id) => quizQuestions.find((item) => item.id === id)).filter(Boolean) as QuizQuestion[] : [], [exam]);
  const current = examQuestions[index];
  const results = useMemo(() => examQuestions.map((question) => ({ question, correct: isCorrect(question, exam?.answers[question.id]) })), [exam?.answers, examQuestions]);
  const score = useMemo(() => results.filter((item) => item.correct).reduce((sum, item) => sum + item.question.points, 0), [results]);
  const maxScore = useMemo(() => results.reduce((sum, item) => sum + item.question.points, 0), [results]);

  const completeExam = useCallback(() => {
    if (!exam || exam.completedAt) return;
    const completed = { ...exam, completedAt: new Date().toISOString(), score, maxScore };
    setExam(completed);
    setFinished(true);
    setProgress((currentProgress) => {
      let next = upsertExam(currentProgress, completed);
      results.forEach(({ question, correct }) => {
        next = addAnswer(next, { id: uid("exam-answer"), questionId: question.id, subject: question.subject, topic: question.topic, correct, durationMs: Math.round((Date.now() - new Date(exam.startedAt).getTime()) / Math.max(1, results.length)), confidence: exam.confidences[question.id] ?? "medium", errorType: correct ? undefined : "Wissenslücke", answeredAt: new Date().toISOString(), examSessionId: completed.id });
      });
      return next;
    });
  }, [exam, maxScore, results, score, setProgress]);

  useEffect(() => {
    if (!exam || finished) return;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(exam.startedAt).getTime() + 90 * 60 * 1000 - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) completeExam();
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [completeExam, exam, finished]);

  const startExam = () => {
    const pool = quizQuestions.filter((item) => item.subject === subject);
    const selected = pickQuestionsForPoints(pool, 90);
    const created: ExamSession = { id: uid("exam"), subject, startedAt: new Date().toISOString(), questionIds: selected.map((item) => item.id), answers: {}, confidences: {} };
    setExam(created); setProgress((current) => upsertExam(current, created));
    setIndex(0); setSeconds(90 * 60); setFinished(false); setWrongFilter(false);
  };
  const resumeExam = () => { if (!incomplete) return; setSubject(incomplete.subject); setExam(incomplete); setIndex(Math.max(0, incomplete.questionIds.findIndex((id) => incomplete.answers[id] === undefined))); setFinished(false); };
  const answer = (value: number) => { if (!exam || !current) return; const changed = { ...exam, answers: { ...exam.answers, [current.id]: value } }; setExam(changed); setProgress((progressNow) => upsertExam(progressNow, changed)); };
  const setExamConfidence = (value: Confidence) => { if (!exam || !current) return; const changed = { ...exam, confidences: { ...exam.confidences, [current.id]: value } }; setExam(changed); setProgress((progressNow) => upsertExam(progressNow, changed)); };

  if (!exam) return <section className="page"><PageHeading eyebrow="90 MINUTEN · OHNE SOFORTLÖSUNG" title="Prüfungsmodus" description="Gemischte Aufgaben, Punkteverteilung und Auswertung erst nach Abgabe." />
    <div className="exam-setup"><div className="exam-clock">90:00<small>Minuten</small></div><div><h2>Prüfung wählen</h2><div className="subject-tabs"><button className={subject === "portfolio" ? "active" : ""} onClick={() => setSubject("portfolio")}>Portfolio Management</button><button className={subject === "tax" ? "active" : ""} onClick={() => setSubject("tax")}>Taxation</button></div><ul><li>Fragen zufällig gemischt</li><li>Automatische Zwischenspeicherung</li><li>Keine Lösung während der Bearbeitung</li><li>Falsche Fragen anschließend wiederholen</li></ul>{incomplete && <button className="resume-button" onClick={resumeExam}>Offene {subjectName[incomplete.subject]}-Prüfung fortsetzen →</button>}<button className="primary-button" onClick={startExam}>Neue 90-Minuten-Prüfung starten →</button></div></div>
  </section>;

  if (finished) {
    const shown = wrongFilter ? results.filter((item) => !item.correct) : results;
    const topics = Object.entries(results.reduce<Record<string, { correct: number; total: number }>>((acc, item) => { acc[item.question.topic] ??= { correct: 0, total: 0 }; acc[item.question.topic].total += 1; if (item.correct) acc[item.question.topic].correct += 1; return acc; }, {}));
    const wrongQuestions = results.filter((item) => !item.correct).map((item) => item.question);
    const repeatWrong = () => {
      if (!wrongQuestions.length) return;
      setExam({ id: uid("repeat"), subject, startedAt: new Date().toISOString(), questionIds: wrongQuestions.map((item) => item.id), answers: {}, confidences: {} });
      setIndex(0); setSeconds(90 * 60); setFinished(false); setWrongFilter(false);
    };
    const setStoredError = (questionId: string, value: ErrorType) => {
      if (!exam) return;
      setProgress((currentProgress) => ({ ...currentProgress, answers: currentProgress.answers.map((item) => item.examSessionId === exam.id && item.questionId === questionId ? { ...item, errorType: value } : item) }));
    };
    return <section className="page"><PageHeading eyebrow="PRÜFUNG ABGEGEBEN" title={`${score} / ${maxScore} Punkte`} description={`${pct(score, maxScore)}% · ${results.filter((item) => item.correct).length} von ${results.length} Aufgaben richtig`} />
      <div className="result-grid"><article className="panel"><h2>Themenanalyse</h2>{topics.map(([topic, value]) => <div className="result-topic" key={topic}><span>{topic}</span><strong>{value.correct}/{value.total}</strong><div><span style={{ width: `${pct(value.correct, value.total)}%` }} /></div></div>)}</article><article className="panel"><h2>Fehlerprotokoll</h2><p>{wrongQuestions.length} Fragen gezielt nacharbeiten.</p><button className="primary-button" disabled={!wrongQuestions.length} onClick={repeatWrong}>Falsche Fragen wiederholen →</button><button className="secondary-button" onClick={() => setWrongFilter((value) => !value)}>{wrongFilter ? "Alle Fragen anzeigen" : "Nur falsche Fragen anzeigen"}</button><button className="secondary-button" onClick={() => { setExam(undefined); setFinished(false); }}>Neue Prüfung</button></article></div>
      <div className="review-list">{shown.map(({ question, correct }) => { const stored = progress.answers.find((item) => item.examSessionId === exam?.id && item.questionId === question.id); return <article key={question.id} className={correct ? "review-item correct" : "review-item wrong"}><div><span>{correct ? "Richtig" : "Falsch"}</span><strong>{question.topic}</strong><b>{question.points} P</b></div><h3>{question.prompt}</h3><p>{question.explanation}</p>{!correct && <label className="error-select">Fehlerart<select value={stored?.errorType ?? "Wissenslücke"} onChange={(event) => setStoredError(question.id, event.target.value as ErrorType)}>{errorTypes.map((item) => <option key={item}>{item}</option>)}</select></label>}<SourceBadge source={question.source} /></article>; })}</div>
    </section>;
  }

  return <section className="page exam-page"><div className="exam-bar"><strong>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</strong><span>Aufgabe {index + 1} / {examQuestions.length}</span><button className="danger-button" onClick={completeExam}>Prüfung abgeben</button></div>
    {current && <article className="question-card exam-question"><div className="quiz-top"><span>{current.topic}</span><strong>{current.points} Punkte</strong></div><h1>{current.prompt}</h1><div className="options">{current.options.map((option, optionIndex) => <button key={option} className={!Array.isArray(exam.answers[current.id]) && exam.answers[current.id] === optionIndex ? "selected" : ""} onClick={() => answer(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div><label className="exam-confidence">Subjektive Sicherheit<select value={exam.confidences[current.id] ?? "medium"} onChange={(event) => setExamConfidence(event.target.value as Confidence)}><option value="low">niedrig</option><option value="medium">mittel</option><option value="high">hoch</option></select></label><div className="exam-nav"><button className="secondary-button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>← Zurück</button><div className="question-dots">{examQuestions.map((item, dotIndex) => <button aria-label={`Aufgabe ${dotIndex + 1}`} key={item.id} onClick={() => setIndex(dotIndex)} className={`${dotIndex === index ? "active" : ""} ${exam.answers[item.id] !== undefined ? "answered" : ""}`}>{dotIndex + 1}</button>)}</div><button className="primary-button" disabled={index === examQuestions.length - 1} onClick={() => setIndex((value) => value + 1)}>Weiter →</button></div></article>}
  </section>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>;
}

function getTopicStats(progress: AppProgress) {
  const map = new Map<string, { subject: Subject; topic: string; correct: number; answers: number }>();
  progress.answers.forEach((answer) => {
    const key = `${answer.subject}-${answer.topic}`;
    const item = map.get(key) ?? { subject: answer.subject, topic: answer.topic, correct: 0, answers: 0 };
    item.answers += 1;
    if (answer.correct) item.correct += 1;
    map.set(key, item);
  });
  return [...map.values()].map((item) => ({ ...item, accuracy: pct(item.correct, item.answers) })).sort((a, b) => a.accuracy - b.accuracy || b.answers - a.answers);
}
