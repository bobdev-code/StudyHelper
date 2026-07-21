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

type View = "dashboard" | "cards" | "quiz" | "models" | "videos" | "exam";

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
  { view: "cards", label: "Karteikarten", icon: "▱" },
  { view: "quiz", label: "Quiz", icon: "?" },
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
        {view === "cards" && <Cards progress={progress} setProgress={setProgress} />}
        {view === "quiz" && <Quiz setProgress={setProgress} />}
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
  const [subject, setSubject] = useState<Subject>("portfolio");
  const [diagnostic, setDiagnostic] = useState(false);
  const [session, setSession] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number | number[]>();
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [errorType, setErrorType] = useState<ErrorType>("Wissenslücke");
  const started = useRef(0);
  const question = session[index];

  const start = () => {
    const pool = quizQuestions.filter((item) => item.subject === subject && (!diagnostic || item.diagnostic));
    setSession(shuffle(pool).slice(0, diagnostic ? 10 : 12));
    setIndex(0); setAnswer(undefined); setChecked(false); started.current = Date.now();
  };
  const check = () => {
    if (!question || answer === undefined) return;
    const correct = isCorrect(question, answer);
    const record: AnswerRecord = { id: uid("answer"), questionId: question.id, subject: question.subject, topic: question.topic, correct, durationMs: Date.now() - started.current, confidence, errorType: correct ? undefined : errorType, answeredAt: new Date().toISOString() };
    setProgress((current) => addAnswer(current, record));
    setChecked(true);
  };
  const next = () => {
    if (index >= session.length - 1) { setSession([]); return; }
    setIndex((value) => value + 1); setAnswer(undefined); setChecked(false); setConfidence("medium"); started.current = Date.now();
  };

  if (!question) return (
    <section className="page"><PageHeading eyebrow="AKTIVES ABRUFEN" title="Quiz" description="Englische Prüfungsfragen, sofortiges Feedback und persönliches Fehlerprotokoll." />
      <div className="setup-grid"><article className={`setup-card ${subject === "portfolio" ? "selected" : ""}`} onClick={() => setSubject("portfolio")}><span>◎</span><h2>Portfolio Management</h2><p>{quizQuestions.filter((item) => item.subject === "portfolio").length} geprüfte Fragen</p></article><article className={`setup-card ${subject === "tax" ? "selected tax" : ""}`} onClick={() => setSubject("tax")}><span>§</span><h2>Taxation</h2><p>{quizQuestions.filter((item) => item.subject === "tax").length} geprüfte Fragen</p></article></div>
      <div className="quiz-start panel"><label className="switch-row"><input type="checkbox" checked={diagnostic} onChange={(event) => setDiagnostic(event.target.checked)} /><span><strong>Kurzer Diagnosetest</strong><small>10 breit gestreute Fragen zur Standortbestimmung</small></span></label><button className="primary-button" onClick={start}>{diagnostic ? "Diagnosetest starten" : "12 Fragen starten"} →</button></div>
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
    setExam({ id: uid("exam"), subject, startedAt: new Date().toISOString(), questionIds: selected.map((item) => item.id), answers: {}, confidences: {} });
    setIndex(0); setSeconds(90 * 60); setFinished(false); setWrongFilter(false);
  };
  const answer = (value: number) => { if (!exam || !current) return; setExam({ ...exam, answers: { ...exam.answers, [current.id]: value } }); };
  const setExamConfidence = (value: Confidence) => { if (!exam || !current) return; setExam({ ...exam, confidences: { ...exam.confidences, [current.id]: value } }); };

  if (!exam) return <section className="page"><PageHeading eyebrow="90 MINUTEN · OHNE SOFORTLÖSUNG" title="Prüfungsmodus" description="Gemischte Aufgaben, Punkteverteilung und Auswertung erst nach Abgabe." />
    <div className="exam-setup"><div className="exam-clock">90:00<small>Minuten</small></div><div><h2>Prüfung wählen</h2><div className="subject-tabs"><button className={subject === "portfolio" ? "active" : ""} onClick={() => setSubject("portfolio")}>Portfolio Management</button><button className={subject === "tax" ? "active" : ""} onClick={() => setSubject("tax")}>Taxation</button></div><ul><li>Fragen zufällig gemischt</li><li>Keine Lösung während der Bearbeitung</li><li>Falsche Fragen anschließend wiederholen</li></ul><button className="primary-button" onClick={startExam}>90-Minuten-Prüfung starten →</button></div></div>
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
