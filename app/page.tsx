"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
  Language,
  QuizQuestion,
  Subject,
} from "@/lib/types";
import { PortfolioAcademy } from "./portfolioAcademy";
import { createLabTasks, labErrorByStage, type LabTask } from "@/lib/data/calculationLab";
import { taxCases, taxCaseErrorByStep, type TaxCase } from "@/lib/data/taxCaseLab";
import { getRememberMe, getSupabase, setRememberMe } from "@/lib/supabase";
import { adaptiveQueue, scoreForecast, subjectCoverage, topicMastery, type PlanSubject } from "@/lib/adaptive";

type View = "dashboard" | "focus" | "mastery" | "plan" | "cards" | "quiz" | "trainer" | "errors" | "models" | "videos" | "exam";

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

const navItems: { view: View; de: string; en: string; icon: string }[] = [
  { view: "dashboard", de: "Dashboard", en: "Dashboard", icon: "▦" },
  { view: "focus", de: "Optimal lernen", en: "Optimal session", icon: "◎" },
  { view: "mastery", de: "Kompetenzen", en: "Mastery", icon: "◔" },
  { view: "plan", de: "Tagesplan", en: "Daily plan", icon: "✓" },
  { view: "cards", de: "Karteikarten", en: "Flashcards", icon: "▱" },
  { view: "quiz", de: "Diagnose & Quiz", en: "Assessment & quiz", icon: "?" },
  { view: "trainer", de: "Fachtrainer", en: "Subject training", icon: "∑" },
  { view: "errors", de: "Fehlerbuch", en: "Error log", icon: "!" },
  { view: "models", de: "Modelle", en: "Models", icon: "⌁" },
  { view: "videos", de: "Video-Playlist", en: "Video playlist", icon: "▶" },
  { view: "exam", de: "Prüfungsmodus", en: "Exam mode", icon: "◇" },
];

const LanguageContext = createContext<Language>("de");
const useLanguage = () => useContext(LanguageContext);
const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;

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
  const language = useLanguage();
  return (
    <details className="source-badge">
      <summary>{tr(language,"Quelle prüfen","Check source")}</summary>
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
  const [quizPreset, setQuizPreset] = useState<"tax-diagnostic">();
  const [progress, setProgress] = useState<AppProgress>(defaultProgress);
  const [ready, setReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudState, setCloudState] = useState<"offline" | "syncing" | "synced" | "error">("offline");
  const progressRef = useRef(progress);
  const language: Language = progress.settings.language ?? "de";

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

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

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setCloudReady(false);
        setCloudState("offline");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    queueMicrotask(() => !cancelled && setCloudState("syncing"));
    void (async () => {
      try {
        const { data, error } = await getSupabase().from("learning_progress").select("progress").eq("user_id", user.id).maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (data?.progress) {
          setProgress(data.progress as AppProgress);
        } else {
          const { error: uploadError } = await getSupabase().from("learning_progress").insert({ user_id: user.id, progress: progressRef.current });
          if (uploadError) throw uploadError;
        }
        if (!cancelled) {
          setCloudReady(true);
          setCloudState("synced");
        }
      } catch {
        if (!cancelled) setCloudState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !user || !cloudReady) return;
    const timer = window.setTimeout(async () => {
      setCloudState("syncing");
      const { error } = await getSupabase().from("learning_progress").upsert({
        user_id: user.id,
        progress,
        updated_at: new Date().toISOString(),
      });
      setCloudState(error ? "error" : "synced");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [progress, ready, user, cloudReady]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const setLanguage = (next: Language) => setProgress((current) => ({
    ...current,
    settings: { ...current.settings, language: next },
  }));

  const navigate = (next: View) => {
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <LanguageContext.Provider value={language}><div className="app-shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark">L</span>
          <div><strong>{tr(language,"Lerntrainer","StudyHelper")}</strong><small>{tr(language,"Nachprüfung 2026","Resit exam 2026")}</small></div>
        </div>
        <nav aria-label="Hauptnavigation">
          {navItems.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.view)}
            >
              <span aria-hidden="true">{item.icon}</span>{item[language]}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="pulse-dot" />
          <div><strong>{tr(language,"04. August 2026","4 August 2026")}</strong><small>{tr(language,"Dein Fortschritt zählt.","Every step counts.")}</small></div>
        </div>
      </aside>
      {mobileNav && <button className="nav-backdrop" aria-label={tr(language,"Menü schließen","Close menu")} onClick={() => setMobileNav(false)} />}

      <main className="main-content">
        <header className="mobile-header">
          <button className="menu-button" onClick={() => setMobileNav((value) => !value)} aria-label="Menü öffnen">☰</button>
          <strong>{tr(language,"Lerntrainer 2026","StudyHelper 2026")}</strong>
          <button className="mobile-account-button" onClick={() => setAuthOpen(true)} aria-label={tr(language,"Konto öffnen","Open account")}>{user ? "✓" : "♙"}</button>
        </header>
        <div className="top-actions">
          <div className="language-switch" role="group" aria-label={tr(language,"Sprache wählen","Choose language")}>
            <button className={language === "de" ? "active" : ""} onClick={() => setLanguage("de")} aria-pressed={language === "de"}><span className="flag-icon flag-de" aria-hidden="true" /> DE</button>
            <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}><span className="flag-icon flag-gb" aria-hidden="true" /> EN</button>
          </div>
          <button className="account-button" onClick={() => setAuthOpen(true)}>
            <span className={`sync-dot ${cloudState}`} />
            {user ? (user.user_metadata?.display_name || user.email) : tr(language,"Anmelden","Sign in")}
          </button>
        </div>
        {view === "dashboard" && <Dashboard progress={progress} navigate={navigate} />}
        {view === "focus" && <AdaptiveSession progress={progress} setProgress={setProgress} navigate={navigate} />}
        {view === "mastery" && <MasteryMatrix progress={progress} navigate={navigate} />}
        {view === "plan" && <DailyPlan progress={progress} navigate={navigate} />}
        {view === "cards" && <Cards progress={progress} setProgress={setProgress} />}
        {view === "quiz" && <Quiz setProgress={setProgress} preset={quizPreset} onPresetApplied={() => setQuizPreset(undefined)} />}
        {view === "trainer" && <SubjectTrainer progress={progress} setProgress={setProgress} onStartTaxDiagnostic={() => { setQuizPreset("tax-diagnostic"); navigate("quiz"); }} />}
        {view === "errors" && <ErrorBook progress={progress} navigate={navigate} />}
        {view === "models" && <Models />}
        {view === "videos" && <Videos />}
        {view === "exam" && <Exam progress={progress} setProgress={setProgress} />}
        <footer className="app-footer">
          <span>{user ? tr(language, cloudState === "synced" ? "Cloud-Lernstand synchronisiert" : cloudState === "error" ? "Synchronisierung fehlgeschlagen" : "Cloud-Lernstand wird synchronisiert …", cloudState === "synced" ? "Cloud progress synced" : cloudState === "error" ? "Sync failed" : "Syncing cloud progress …") : tr(language,"Lokaler Lernstand · für Gerätewechsel anmelden","Local progress · sign in to use other devices")}</span>
          <button
            className="text-button danger"
            onClick={() => {
              if (window.confirm(tr(language,"Wirklich den gesamten Lernstand zurücksetzen?","Reset all learning progress?"))) {
                setProgress(resetProgress());
              }
            }}
          >{tr(language,"Lernstand zurücksetzen","Reset progress")}</button>
        </footer>
        {authOpen && <AuthDialog user={user} language={language} onClose={() => setAuthOpen(false)} />}
      </main>
    </div></LanguageContext.Provider>
  );
}

function AuthDialog({ user, language, onClose }: { user: User | null; language: Language; onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [remember, setRemember] = useState(getRememberMe());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setRememberMe(remember);
    const supabase = getSupabase();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage(tr(language,"Bitte bestätige die E-Mail und melde dich danach an.","Please confirm the email, then sign in."));
    else onClose();
  };

  const signOut = async () => {
    setBusy(true);
    await getSupabase().auth.signOut();
    setBusy(false);
    onClose();
  };

  return <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-label={tr(language,"Lernkonto","Learning account")}>
      <button className="auth-close" onClick={onClose} aria-label={tr(language,"Schließen","Close")}>×</button>
      {user ? <>
        <span className="auth-kicker">{tr(language,"CLOUD-LERNKONTO","CLOUD LEARNING ACCOUNT")}</span>
        <h2>{user.user_metadata?.display_name || user.email}</h2>
        <p>{tr(language,"Dein Lernstand wird auf diesem und deinen anderen Geräten synchronisiert.","Your progress is synced on this device and your other devices.")}</p>
        <button className="secondary-button" disabled={busy} onClick={signOut}>{tr(language,"Abmelden","Sign out")}</button>
      </> : <>
        <span className="auth-kicker">{tr(language,"GERÄTEÜBERGREIFEND LERNEN","LEARN ACROSS DEVICES")}</span>
        <h2>{mode === "login" ? tr(language,"Willkommen zurück","Welcome back") : tr(language,"Eigenes Lernkonto erstellen","Create your learning account")}</h2>
        <p>{tr(language,"Bobby und Patrick erhalten vollständig getrennte, persönliche Lernstände.","Bobby and Patrick each get a completely separate personal learning record.")}</p>
        <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>{tr(language,"Anmelden","Sign in")}</button><button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>{tr(language,"Registrieren","Register")}</button></div>
        <form onSubmit={submit}>
          {mode === "signup" && <label>{tr(language,"Name","Name")}<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" /></label>}
          <label>{tr(language,"E-Mail","Email")}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>{tr(language,"Passwort (mindestens 6 Zeichen)","Password (at least 6 characters)")}<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
          <label className="remember-row"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> <span>{tr(language,"Angemeldet bleiben","Remember me")}</span></label>
          {message && <p className="auth-message">{message}</p>}
          <button className="primary-button" disabled={busy}>{busy ? tr(language,"Bitte warten …","Please wait …") : mode === "login" ? tr(language,"Anmelden","Sign in") : tr(language,"Konto erstellen","Create account")}</button>
        </form>
      </>}
    </section>
  </div>;
}

function Dashboard({ progress, navigate }: { progress: AppProgress; navigate: (view: View) => void }) {
  const language = useLanguage();
  const metrics = useMemo(() => {
    const result = { portfolio: { correct: 0, total: 0 }, tax: { correct: 0, total: 0 } };
    progress.answers.forEach((answer) => {
      result[answer.subject].total += 1;
      if (answer.correct) result[answer.subject].correct += 1;
    });
    return result;
  }, [progress.answers]);
  const portfolioForecast = scoreForecast(progress, "portfolio");
  const taxForecast = scoreForecast(progress, "tax");
  const pScore = portfolioForecast.central;
  const tScore = taxForecast.central;
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
        <div><p className="eyebrow">{tr(language,"PRÜFUNG · 04. AUGUST 2026","EXAM · 4 AUGUST 2026")}</p><h1>{tr(language,"Guten Abend, Admin","Good evening, Admin")}</h1><p>{tr(language,"Heute zählt nicht Perfektion, sondern der nächste sichere Punkt.","Today is not about perfection, but about securing the next point.")}</p></div>
        <div className="countdown"><span className="calendar-icon">▦</span><strong>{daysUntil(progress.settings.examDate)}</strong><span>{tr(language,"Tage bis zur Prüfung","days until the exam")}</span></div>
      </div>

      <div className="subject-grid">
        <SubjectCard subject="portfolio" score={pScore} accuracy={metrics.portfolio.total ? pct(metrics.portfolio.correct, metrics.portfolio.total) : 32} priority />
        <SubjectCard subject="tax" score={tScore} accuracy={metrics.tax.total ? pct(metrics.tax.correct, metrics.tax.total) : 56} />
      </div>

      <div className="dashboard-lower">
        <article className="panel goal-panel">
          <div className="panel-title"><span>◎</span><h2>{tr(language,"Punkteziele","Score targets")}</h2></div>
          <div className="goal-scale">
            {[90, 105, 115].map((goal) => <div key={goal} className={total >= goal ? "goal reached" : goal === 105 ? "goal focus" : "goal"}><strong>{goal}</strong><span>{goal === 90 ? tr(language,"Bestehen","Pass") : goal === 105 ? tr(language,"Sicherheitspuffer","Safety margin") : tr(language,"Starkes Ziel","Strong target")}</span></div>)}
          </div>
          <div className="goal-line"><span style={{ width: `${Math.min(100, (total / 115) * 100)}%` }} /></div>
          <p className="current-score">{tr(language,"Aktuelle Schätzung","Current estimate")} <strong>{total} / 180</strong></p>
          <small>{tr(language,`Realistischer Korridor: Portfolio ${portfolioForecast.low}–${portfolioForecast.high}/90 · Taxation ${taxForecast.low}–${taxForecast.high}/90. Gewichtet werden Kompetenz, Zeit und Probeklausuren.`,`Realistic range: Portfolio ${portfolioForecast.low}–${portfolioForecast.high}/90 · Taxation ${taxForecast.low}–${taxForecast.high}/90. Mastery, time and mock exams are weighted.`)}</small>
        </article>

        <article className="panel topic-panel">
          <div className="panel-title"><span>◔</span><h2>{tr(language,"Themenstatus","Topic status")}</h2></div>
          {weak.length ? weak.map((item) => (
            <div className="topic-row" key={`${item.subject}-${item.topic}`}><span className={item.accuracy >= 75 ? "status-dot safe" : item.accuracy >= 55 ? "status-dot unsure" : "status-dot weak"} /><span>{item.topic}</span><strong>{item.accuracy}%</strong></div>
          )) : <div className="starter-topics"><div><span className="status-dot weak" />CAPM, SML & Beta</div><div><span className="status-dot unsure" />Performance Measures</div><div><span className="status-dot safe" />Taxation basics</div></div>}
        </article>

        <article className="panel next-panel">
          <div className="panel-title"><span>▱</span><h2>{tr(language,"Nächste Lerneinheit","Next study session")}</h2></div>
          <div className="recommendation"><span className="rec-icon">◎</span><div><strong>{weak[0]?.topic ?? "CAPM, SML & Beta"}</strong><span>{tr(language,"25 Min · 12 Karten · 8 Fragen","25 min · 12 cards · 8 questions")}</span></div></div>
          <button className="primary-button" onClick={() => navigate("focus")}>{tr(language,"Jetzt optimal lernen","Start optimal session")} <span>→</span></button>
          <button className="text-button" onClick={() => navigate("quiz")}>{tr(language,"Diagnosetest öffnen","Open assessment")}</button>
        </article>
      </div>

      <div className="micro-stats"><span><strong>{reviewed}</strong> {tr(language,"Karten bearbeitet","cards reviewed")}</span><span><strong>{progress.answers.length}</strong> {tr(language,"Antworten","answers")}</span><span><strong>{progress.answers.length ? accuracy : "–"}{progress.answers.length ? "%" : ""}</strong> {tr(language,"Trefferquote","accuracy")}</span></div>
    </section>
  );
}

function AdaptiveSession({ progress, setProgress, navigate }: { progress: AppProgress; setProgress: React.Dispatch<React.SetStateAction<AppProgress>>; navigate: (view: View) => void }) {
  const language = useLanguage();
  const [minutes, setMinutes] = useState(progress.settings.dailyMinutes || 30);
  const [subject, setSubject] = useState<PlanSubject>("all");
  const portfolioWeight = progress.settings.subjectWeights?.portfolio ?? 50;
  const queue = adaptiveQueue(progress, minutes, subject);
  const subjectRows = topicMastery(progress);
  const summary = (value: Subject) => {
    const rows = subjectRows.filter((item) => item.subject === value);
    return {
      mastery: rows.length ? Math.round(rows.reduce((sum, item) => sum + item.mastery, 0) / rows.length) : 0,
      gaps: rows.filter((item) => item.attempts === 0 || item.mastery < 45).length,
      due: rows.filter((item) => item.nextDueAt <= new Date().toISOString()).length,
    };
  };
  const portfolioSummary = summary("portfolio");
  const taxSummary = summary("tax");
  const targetView = (subject: Subject, attempts: number): View => attempts === 0 ? "cards" : subject === "portfolio" ? "trainer" : "quiz";
  return <section className="page"><PageHeading eyebrow={tr(language,"ADAPTIVE LERNSTEUERUNG","ADAPTIVE LEARNING")} title={tr(language,"Jetzt optimal lernen","Your optimal session")} description={tr(language,"Die Reihenfolge kombiniert fällige Wiederholungen, Scheinsicherheiten, schwache punktestarke Themen und noch nicht abgedeckten Stoff.","The sequence combines due reviews, false confidence, weak high-value topics and content you have not covered yet.")} />
    <div className="session-length" role="group" aria-label={tr(language,"Dauer wählen","Choose duration")}>{[5,15,30,60,90].map(value=><button key={value} className={minutes===value?"active":""} onClick={()=>setMinutes(value)}>{value} {tr(language,"Min","min")}</button>)}</div>
    <div className="subject-plan-tabs" role="group" aria-label={tr(language,"Fachplan wählen","Choose subject plan")}>
      {(["all","portfolio","tax"] as PlanSubject[]).map((value)=><button key={value} className={subject===value?"active":""} onClick={()=>setSubject(value)}>{value==="all"?tr(language,"Gesamtplan","Combined plan"):value==="portfolio"?"Portfolio Management":"Taxation"}</button>)}
    </div>
    <div className="subject-plan-cards">
      <button className={subject==="portfolio"?"active":""} onClick={()=>setSubject("portfolio")}><span>◎ Portfolio</span><strong>{portfolioSummary.mastery}% Mastery</strong><small>{portfolioSummary.gaps} {tr(language,"Lücken","gaps")} · {portfolioSummary.due} {tr(language,"fällig","due")}</small></button>
      <button className={subject==="tax"?"active tax":"tax"} onClick={()=>setSubject("tax")}><span>§ Taxation</span><strong>{taxSummary.mastery}% Mastery</strong><small>{taxSummary.gaps} {tr(language,"Lücken","gaps")} · {taxSummary.due} {tr(language,"fällig","due")}</small></button>
    </div>
    <article className="panel subject-weight-panel">
      <div><b>{tr(language,"Persönliche Wochengewichtung","Personal weekly split")}</b><small>{tr(language,"Der Gesamtplan hält beide Fächer sichtbar. Akut fällige Wiederholungen dürfen die Quote übersteuern.","The combined plan keeps both subjects visible. Urgent reviews may override the split.")}</small></div>
      <label><span>Portfolio {portfolioWeight}%</span><input type="range" min="20" max="80" step="10" value={portfolioWeight} onChange={(event)=>{const portfolio=Number(event.target.value);setProgress(current=>({...current,settings:{...current.settings,subjectWeights:{portfolio,tax:100-portfolio}}}));}}/><span>Taxation {100-portfolioWeight}%</span></label>
      <div><b>{tr(language,"Tagesziele je Fach","Daily targets by subject")}</b><small>{tr(language,"Minuten, die du heute mindestens je Fach reservieren möchtest.","Minutes you want to reserve for each subject today.")}</small></div>
      <div className="daily-targets">{(["portfolio","tax"] as Subject[]).map((value)=><label key={value}><span>{value==="portfolio"?"Portfolio":"Taxation"}</span><input type="number" min="5" max="90" step="5" value={progress.settings.dailyTargets?.[value]??20} onChange={(event)=>setProgress(current=>({...current,settings:{...current.settings,dailyTargets:{portfolio:current.settings.dailyTargets?.portfolio??20,tax:current.settings.dailyTargets?.tax??20,[value]:Number(event.target.value)}}}))}/><b>{tr(language,"Min","min")}</b></label>)}</div>
    </article>
    <div className="adaptive-layout"><div className="adaptive-queue">{queue.map((item,index)=><article key={`${item.subject}-${item.topic}`} className="adaptive-item"><span>{String(index+1).padStart(2,"0")}</span><div><small>{subjectName[item.subject]} · {item.status}</small><h3>{item.topic}</h3><p>{item.reason} · Mastery {item.mastery}% · {item.attempts} {tr(language,"Versuche an","attempts across")} {item.days} {tr(language,"Lerntag(en)","study day(s)")}</p></div><button onClick={()=>navigate(targetView(item.subject,item.attempts))}>{tr(language,"Starten","Start")} →</button></article>)}</div>
      <aside className="panel session-summary"><strong>{minutes}</strong><span>{tr(language,"Minuten Fokus","focus minutes")}</span><p>{queue.filter(item=>item.nextDueAt<=new Date().toISOString()).length} {tr(language,"fällige Themen","due topics")}, {queue.filter(item=>item.attempts===0).length} {tr(language,"Abdeckungslücken","coverage gaps")}.</p><div className="why-card"><b>{tr(language,"Warum Priorität 1?","Why priority 1?")}</b><p>{queue[0] ? tr(language, queue[0].reason, queue[0].reasonKey==="false-confidence"?"Correct false confidence":queue[0].reasonKey==="due"?"Review is due":queue[0].reasonKey==="coverage"?"Extend content coverage":"Close a high-value gap") : "–"}</p></div><button className="primary-button" onClick={()=>queue[0]&&navigate(targetView(queue[0].subject,queue[0].attempts))}>{tr(language,"Mit Priorität 1 beginnen","Start with priority 1")} →</button><button className="secondary-button check-button" onClick={()=>navigate(queue[0]?.subject==="portfolio"?"trainer":"quiz")}>{tr(language,"Erfolgskontrolle mit neuer Variante","Check retention with a new variant")} →</button></aside></div>
    <CoverageAndCountdown progress={progress} />
  </section>;
}

function CoverageAndCountdown({ progress }: { progress: AppProgress }) {
  const language = useLanguage();
  const remainingDays = Math.max(1, daysUntil(progress.settings.examDate));
  const rows = (["portfolio","tax"] as Subject[]).map((subject)=>({subject,coverage:subjectCoverage(progress,subject)}));
  const totalGaps = rows.reduce((sum,row)=>sum+(row.coverage.total-row.coverage.learned),0);
  const dailyNew = Math.max(1, Math.ceil(totalGaps/remainingDays));
  return <div className="coverage-section"><div className="coverage-heading"><div><span className="question-type">{tr(language,"STOFFABDECKUNG","CONTENT COVERAGE")}</span><h2>{tr(language,"Vom ersten Kontakt bis klausursicher","From first contact to exam-ready")}</h2></div><p><b>{remainingDays} {tr(language,"Tage","days")}</b> · {tr(language,`ca. ${dailyNew} neue Themen pro Tag`,`about ${dailyNew} new topics per day`)}</p></div><div className="coverage-grid">{rows.map(({subject,coverage})=><article key={subject}><h3>{subjectName[subject]}</h3>{([['learned','Gelernt','Learned'],['practised','Geübt','Practised'],['transferred','Transferiert','Transferred'],['examReady','Klausursicher','Exam-ready']] as const).map(([key,de,en])=><div className="coverage-row" key={key}><span>{tr(language,de,en)}</span><i><b style={{width:`${coverage.percent(coverage[key])}%`}}/></i><strong>{coverage[key]}/{coverage.total}</strong></div>)}</article>)}</div><p className="dynamic-plan-note">{tr(language,"Der Plan wird nach jedem Versuch neu berechnet. Fällige Fehler kommen zuerst; danach schließt du gleichmäßig Abdeckungslücken bis zum 04.08.","The plan recalculates after every attempt. Due errors come first, then coverage gaps are closed steadily until 4 August.")}</p></div>;
}

function MasteryMatrix({ progress, navigate }: { progress: AppProgress; navigate: (view: View) => void }) {
  const language = useLanguage();
  const rows = topicMastery(progress);
  return <section className="page"><PageHeading eyebrow={tr(language,"MEHR ALS RICHTIG / FALSCH","MORE THAN RIGHT / WRONG")} title={tr(language,"Kompetenzmatrix","Mastery matrix")} description={tr(language,"Beherrscht bedeutet: wiederholt korrekt, an mehreren Tagen, angemessen schnell und mit realistischer Sicherheit.","Mastered means: repeatedly correct, across multiple days, at an appropriate speed and with calibrated confidence.")} />
    <div className="mastery-legend"><span className="status-dot weak" /> {tr(language,"Lücke","gap")} <span className="status-dot unsure" /> {tr(language,"im Aufbau","developing")} <span className="status-dot safe" /> {tr(language,"fast sicher / beherrscht","nearly secure / mastered")}</div>
    <div className="mastery-table"><div className="mastery-head"><span>{tr(language,"Kompetenz","Skill")}</span><span>{tr(language,"Treffer","Accuracy")}</span><span>{tr(language,"Tempo","Speed")}</span><span>{tr(language,"Kalibrierung","Calibration")}</span><span>Mastery</span><span>{tr(language,"Status","Status")}</span></div>{rows.map(item=><button key={`${item.subject}-${item.topic}`} onClick={()=>navigate(item.subject==="portfolio"?"trainer":"quiz")}><span><small>{item.subject==="portfolio"?"Portfolio":"Taxation"}</small><b>{item.topic}</b></span><span>{item.attempts?`${item.accuracy}%`:"–"}</span><span>{item.attempts?`${item.speed}%`:"–"}</span><span>{item.attempts?`${item.confidenceCalibration}%`:"–"}</span><span><i style={{width:`${item.mastery}%`}} />{item.mastery}%</span><span className={`mastery-status ${item.status.replaceAll(" ","-")}`}>{item.status}</span></button>)}</div>
  </section>;
}

function SubjectCard({ subject, score, accuracy, priority = false }: { subject: Subject; score: number; accuracy: number; priority?: boolean }) {
  const language = useLanguage();
  return (
    <article className={`subject-card ${subject} ${priority ? "priority" : ""}`}>
      <div className="subject-card-head"><span className="subject-icon">{subject === "portfolio" ? "◎" : "§"}</span><div><p>{priority ? tr(language,"PRIORITÄT HOCH","HIGH PRIORITY") : tr(language,"STABILISIEREN","STABILISE")}</p><h2>{subjectName[subject]}</h2></div></div>
      <div className="score-row"><strong>{score}</strong><span>/ 90 {tr(language,"Punkte","points")}</span><b>{accuracy}%</b></div>
      <div className="progress-track"><span style={{ width: `${Math.min(100, (score / 90) * 100)}%` }} /></div>
      <p className="subject-note">{subject === "portfolio" ? tr(language,"Intensivpfad · Formeln, Rechenroutine, Interpretation","Intensive track · formulas, calculations, interpretation") : tr(language,"Punkte sichern · Norm, Tatbestand, Rechtsfolge","Secure points · rule, requirements, legal consequence")}</p>
    </article>
  );
}

function Cards({ progress, setProgress }: { progress: AppProgress; setProgress: React.Dispatch<React.SetStateAction<AppProgress>> }) {
  const language = useLanguage();
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
      <PageHeading eyebrow="SPACED REPETITION" title={tr(language,"Karteikarten","Flashcards")} description={tr(language,`${flashcards.filter((item) => item.subject === "portfolio").length} Portfolio- und ${flashcards.filter((item) => item.subject === "tax").length} Taxation-Karten mit Quellenreferenz.`,`${flashcards.filter((item) => item.subject === "portfolio").length} portfolio and ${flashcards.filter((item) => item.subject === "tax").length} taxation cards with source references.`)} />
      <div className="toolbar">
        <select value={subject} onChange={(event) => { setSubject(event.target.value as Subject | "all"); setTopic("all"); setIndex(0); setFlipped(false); }}><option value="portfolio">Portfolio Management</option><option value="tax">Taxation</option><option value="all">{tr(language,"Beide Fächer","Both subjects")}</option></select>
        <select value={topic} onChange={(event) => { setTopic(event.target.value); setIndex(0); setFlipped(false); }}><option value="all">{tr(language,"Alle Themen","All topics")}</option>{topics.map((item) => <option key={item}>{item}</option>)}</select>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setIndex(0); setFlipped(false); }} placeholder={tr(language,"Karten durchsuchen …","Search cards …")} />
        <button className={favorites ? "filter-button active" : "filter-button"} onClick={() => { setFavorites((value) => !value); setIndex(0); setFlipped(false); }}>★ {tr(language,"Favoriten","Favourites")}</button>
      </div>
      {card ? (
        <div className="study-layout">
          <div className="card-stage">
            <div className="card-meta"><span>{subjectName[card.subject]}</span><strong>{index + 1} / {filtered.length}</strong><span>Box {progress.cards[card.id]?.box ?? 1}</span></div>
            <button className={flipped ? "flashcard flipped" : "flashcard"} onClick={() => setFlipped((value) => !value)}>
              <span className="card-label">{flipped ? tr(language,"ANTWORT","ANSWER") : card.topic.toUpperCase()}</span>
              <div>{flipped ? <><p className="card-answer">{card.back}</p>{language === "de" && card.helpDe && <p className="german-help">Verständnishilfe: {card.helpDe}</p>}</> : <><h2>{card.front}</h2>{language === "de" && card.helpDe && <p className="german-help">Deutsch: {card.helpDe}</p>}</>}</div>
              <span className="flip-hint">{flipped ? tr(language,"Zurück zur Frage","Back to question") : tr(language,"Tippen zum Aufdecken","Tap to reveal")}</span>
            </button>
            {flipped && <div className="review-buttons"><button className="wrong" onClick={() => review("wrong")}>{tr(language,"Nicht gewusst","Did not know")}</button><button className="unsure" onClick={() => review("uncertain")}>{tr(language,"Unsicher","Unsure")}</button><button className="known" onClick={() => review("known")}>{tr(language,"Gewusst","Knew it")}</button></div>}
            <div className="card-actions"><button className="text-button" onClick={() => setIndex((value) => (value - 1 + filtered.length) % filtered.length)}>← Vorherige</button><button className={progress.cards[card.id]?.favorite ? "favorite active" : "favorite"} onClick={toggleFavorite}>★ {progress.cards[card.id]?.favorite ? "Favorit" : "Merken"}</button><button className="text-button" onClick={() => { setFlipped(false); setIndex((value) => (value + 1) % filtered.length); }}>Nächste →</button></div>
          </div>
          <aside className="study-sidebar"><h3>Lernlogik</h3><p>Gewusste Karten wandern in längere Intervalle. Unsichere Karten kommen morgen, falsche Karten sofort wieder in Box 1.</p><div className="due-stat"><strong>{Object.values(progress.cards).filter((item) => new Date(item.dueAt) <= new Date()).length}</strong><span>heute fällig</span></div><SourceBadge source={card.source} /></aside>
        </div>
      ) : <EmptyState>Keine Karten passen zu diesem Filter.</EmptyState>}
    </section>
  );
}

function Quiz({ setProgress, preset, onPresetApplied }: { setProgress: React.Dispatch<React.SetStateAction<AppProgress>>; preset?: "tax-diagnostic"; onPresetApplied: () => void }) {
  const language = useLanguage();
  const [subject, setSubject] = useState<Subject | "all">(preset === "tax-diagnostic" ? "tax" : "portfolio");
  const [diagnostic, setDiagnostic] = useState(preset === "tax-diagnostic");
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
    onPresetApplied();
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
    <section className="page"><PageHeading eyebrow={tr(language,"AKTIVES ABRUFEN","ACTIVE RECALL")} title="Quiz" description={tr(language,"Prüfungsfragen mit deutscher Verständnishilfe, sofortigem Feedback und persönlichem Fehlerprotokoll.","Exam questions with immediate feedback and a personal error log.")} />
      <div className="setup-grid three"><article className={`setup-card ${subject === "portfolio" ? "selected" : ""}`} onClick={() => setSubject("portfolio")}><span>◎</span><h2>Portfolio Management</h2><p>{quizQuestions.filter((item) => item.subject === "portfolio").length} geprüfte Fragen</p></article><article className={`setup-card ${subject === "tax" ? "selected tax" : ""}`} onClick={() => setSubject("tax")}><span>§</span><h2>Taxation</h2><p>{quizQuestions.filter((item) => item.subject === "tax").length} geprüfte Fragen</p></article><article className={`setup-card ${subject === "all" ? "selected combined" : ""}`} onClick={() => { setSubject("all"); setDiagnostic(true); }}><span>◫</span><h2>Gesamtdiagnose</h2><p>18 Fragen aus beiden Fächern</p></article></div>
      <div className="quiz-start panel"><label className="switch-row"><input type="checkbox" checked={diagnostic} onChange={(event) => setDiagnostic(event.target.checked)} /><span><strong>Adaptiver Diagnosetest</strong><small>{subject === "all" ? "18" : "12"} breit gestreute Fragen mit Sicherheitsabgleich</small></span></label><button className="primary-button" onClick={start}>{diagnostic ? "Diagnosetest starten" : "12 Fragen starten"} →</button></div>
    </section>
  );

  return (
    <section className="page quiz-page">
      <div className="quiz-progress"><span style={{ width: `${((index + 1) / session.length) * 100}%` }} /></div>
      <div className="quiz-top"><span>{subjectName[question.subject]} · {question.topic}</span><strong>Frage {index + 1} / {session.length}</strong><span>{question.points} Punkte</span></div>
      <article className="question-card"><span className="question-type">{question.type.replace("-", " ")}</span><h1>{question.prompt}</h1>{language === "de" && question.helpDe && <p className="german-help">Deutsch: {question.helpDe}</p>}
        <div className="options">{question.options.map((option, optionIndex) => <button key={option} disabled={checked} className={`${!Array.isArray(answer) && answer === optionIndex ? "selected" : ""} ${checked && !Array.isArray(question.correct) && question.correct === optionIndex ? "correct" : ""} ${checked && !Array.isArray(answer) && answer === optionIndex && !isCorrect(question, answer) ? "incorrect" : ""}`} onClick={() => setAnswer(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>
        {!checked && <div className="answer-meta"><label>Sicherheit<select value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}><option value="low">niedrig</option><option value="medium">mittel</option><option value="high">hoch</option></select></label><label>Falls falsch: Fehlerart<select value={errorType} onChange={(event) => setErrorType(event.target.value as ErrorType)}>{errorTypes.map((item) => <option key={item}>{item}</option>)}</select></label></div>}
        {checked && <div className={isCorrect(question, answer) ? "feedback correct-feedback" : "feedback wrong-feedback"}><h3>{isCorrect(question, answer) ? tr(language,"Richtig.","Correct.") : tr(language,"Noch nicht richtig.","Not quite.")}</h3><p>{question.explanation}</p>{question.solutionSteps && <ol>{question.solutionSteps.map((step) => <li key={step}>{step}</li>)}</ol>}{language === "de" && question.helpDe && <p className="german-help">Verständnishilfe: {question.helpDe}</p>}<SourceBadge source={question.source} /></div>}
        <div className="question-actions">{!checked ? <button className="primary-button" disabled={answer === undefined} onClick={check}>Antwort prüfen</button> : <button className="primary-button" onClick={next}>{index === session.length - 1 ? "Quiz beenden" : "Nächste Frage"} →</button>}</div>
      </article>
    </section>
  );
}

type TrainerMode = "calculation" | "tax-case" | "formula" | "lab" | "academy" | "tax-lab" | "tax-prep";

function SubjectTrainer({ progress, setProgress, onStartTaxDiagnostic }: { progress: AppProgress; setProgress: React.Dispatch<React.SetStateAction<AppProgress>>; onStartTaxDiagnostic: () => void }) {
  const [mode, setMode] = useState<TrainerMode>();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number>();
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [labTasks, setLabTasks] = useState<LabTask[]>([]);
  const [labIndex, setLabIndex] = useState(0);
  const [taxLabCases, setTaxLabCases] = useState<TaxCase[]>([]);
  const [taxLabIndex, setTaxLabIndex] = useState(0);
  const started = useRef(0);
  const labStarted = useRef(0);
  const question = questions[index];

  const startMode = (next: TrainerMode) => {
    if (next === "academy" || next === "tax-prep") { setMode(next); return; }
    if (next === "lab") { setMode(next); setLabTasks(createLabTasks()); setLabIndex(0); labStarted.current = Date.now(); return; }
    if (next === "tax-lab") { setMode(next); setTaxLabCases(shuffle(taxCases)); setTaxLabIndex(0); labStarted.current = Date.now(); return; }
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

  if (mode === "academy") return <PortfolioAcademy progress={progress} setProgress={setProgress} onExit={() => setMode(undefined)} />;
  if (mode === "tax-prep") return <TaxExamPreparation onExit={() => setMode(undefined)} onStartDiagnostic={onStartTaxDiagnostic} />;

  if (mode === "lab" && labTasks[labIndex]) return <CalculationLab task={labTasks[labIndex]} position={labIndex} total={labTasks.length} confidence={confidence} setConfidence={setConfidence} onExit={() => setMode(undefined)} onComplete={(errors) => {
    const task = labTasks[labIndex]; const correct = errors.length === 0;
    setProgress((current) => addAnswer(current, { id: uid("lab"), questionId: `lab-${task.id}-${Date.now()}`, subject: "portfolio", topic: task.topic, correct, durationMs: Date.now() - labStarted.current, confidence, errorType: correct ? undefined : labErrorByStage[errors[0]], answeredAt: new Date().toISOString() }));
    setLabTasks((current) => correct ? current : [...current, createLabTasks(Date.now()+labIndex).find((item) => item.id === task.id)!]);
    setLabIndex((value) => value + 1); setConfidence("medium"); labStarted.current = Date.now();
  }} />;

  if (mode === "tax-lab" && taxLabCases[taxLabIndex]) return <TaxCaseLab taxCase={taxLabCases[taxLabIndex]} position={taxLabIndex} total={taxLabCases.length} confidence={confidence} setConfidence={setConfidence} onExit={() => setMode(undefined)} onComplete={(score, firstError) => {
    const item = taxLabCases[taxLabIndex]; const correct = score === item.steps.reduce((sum, step) => sum + step.points, 0);
    setProgress((current) => addAnswer(current, { id: uid("tax-lab"), questionId: `tax-lab-${item.id}-${Date.now()}`, subject: "tax", topic: item.topic, correct, durationMs: Date.now() - labStarted.current, confidence, errorType: firstError ? taxCaseErrorByStep[firstError] : undefined, answeredAt: new Date().toISOString() }));
    setTaxLabCases((current) => correct ? current : [...current, item]);
    setTaxLabIndex((value) => value + 1); setConfidence("medium"); labStarted.current = Date.now();
  }} />;

  if (!mode || !question) return <section className="page"><PageHeading eyebrow="GEZIELTE PRÜFUNGSROUTINE" title="Fachtrainer" description="Geführte Fachlabore, Klausurwerkstatt, klassische Aufgaben und schneller Abruf verbinden Wissen mit einem vollständigen prüfungsreifen Lösungsweg." />
    <div className="trainer-grid">
      <button className="trainer-card academy" onClick={() => startMode("academy")}><span>◆</span><h2>Portfolio-Klausurwerkstatt</h2><p>Alle 12 Ausbaustufen: unbekannte Aufgabenketten, Teilpunkte, freies Rechenblatt, Formelnetz, Simulator, Fehlerprofil und Mastery.</p><b>Neue Komplettstufe öffnen →</b></button>
      <button className="trainer-card tax tax-prep-card" onClick={() => startMode("tax-prep")}><span>◈</span><h2>Tax Exam Prep</h2><p>Geführte Wiederholung aus der prüfungsentscheidenden Exam-Prep-Datei: Schemata, Zeichnungen, vorgerechnete Beispiele und typische Punktverluste.</p><b>Vorbereitung vor dem Einstufungstest →</b></button>
      <button className="trainer-card lab" onClick={() => startMode("lab")}><span>⌬</span><h2>Portfolio-Rechenlabor</h2><p>Formel erkennen, Werte zuordnen, Ergebnis vorhersagen, jeden Schritt rechnen und ökonomisch erklären.</p><b>7 adaptive Rechenstrecken →</b></button>
      <button className="trainer-card tax tax-lab-card" onClick={() => startMode("tax-lab")}><span>§</span><h2>Taxation-Falllabor</h2><p>Unbekannten Sachverhalt prüfen: Steuerart, Steuersubjekt, Norm, Berechnung und gutachterliches Ergebnis.</p><b>{taxCases.length} vollständige Fallketten · Teilpunkte →</b></button>
      <button className="trainer-card portfolio" onClick={() => startMode("calculation")}><span>∑</span><h2>Portfolio-Rechentrainer</h2><p>Aufgaben mit vollständigem Lösungsweg, Einheiten und unmittelbarer Fehlererkennung.</p><b>{quizQuestions.filter((item) => item.subject === "portfolio" && item.type === "calculation").length} Aufgaben →</b></button>
      <button className="trainer-card tax" onClick={() => startMode("tax-case")}><span>¶</span><h2>Taxation-Schnellfälle</h2><p>Einzelne Normen, Rechtsfolgen und Berechnungen unter Zeitdruck abrufen.</p><b>{quizQuestions.filter((item) => item.subject === "tax" && ["legal-rule", "ordering", "calculation"].includes(item.type)).length} Kurzfälle →</b></button>
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

function TaxExamPreparation({ onExit, onStartDiagnostic }: { onExit: () => void; onStartDiagnostic: () => void }) {
  const language = useLanguage();
  const de = language === "de";
  const [chapter, setChapter] = useState(0);
  const chapters = de ? [
    {
      kicker: "30-PUNKTE-KERN",
      title: "Mitunternehmerschaft in der richtigen Reihenfolge",
      summary: "Beginne nie sofort mit der Rechnung. Zeichne zuerst Gesellschaft, Gesellschafter und Vertragsbeziehungen. Prüfe dann Ebene für Ebene.",
      steps: ["Steuerpflicht des Gesellschafters: § 1 Abs. 1 EStG i. V. m. §§ 8, 9 AO.", "Einkunftsart auf Gesellschaftsebene: freier Beruf (§ 18 Abs. 1 Nr. 1 EStG) oder Gewerbebetrieb (§ 15 Abs. 2 EStG).", "Mitunternehmerrisiko und Mitunternehmerinitiative nennen.", "Gesamter Gewinn = Ergebnis Stufe 1 + Sonderergebnis Stufe 2."],
      example: "Beispiel: KG-Verlust −20.000 €, Anteil 2/3 = −13.333 €. Sondervergütung 20.000 € abzüglich Sonderbetriebsausgaben 16.000 € = +4.000 €. Einkünfte des Gesellschafters: −9.333 €.",
      trap: "Sondervergütungen sind keine privaten Nebeneinkünfte. Sie gehören nach § 15 Abs. 1 S. 1 Nr. 2 EStG in die gewerblichen Einkünfte des Mitunternehmers."
    },
    {
      kicker: "BUCHUNGEN & PERIODENABGRENZUNG",
      title: "Was trotz fehlender Zahlung in die Bilanz gehört",
      summary: "Bei der Gewinnermittlung zählt die wirtschaftliche Zugehörigkeit zur Periode, nicht nur der Geldfluss.",
      steps: ["Umsatz: Bank an Umsatzerlöse.", "Bezahlter Zins: Zinsaufwand an Bank.", "Im Dezember fälliger, noch nicht gezahlter Zins: Zinsaufwand an Verbindlichkeiten.", "Noch nicht festgesetzte Gewerbesteuer: Gewerbesteueraufwand an Gewerbesteuerrückstellung."],
      example: "Die Dezemberzinsen werden berücksichtigt, obwohl kein Geld geflossen ist. Grund ist die periodengerechte Abgrenzung nach § 252 Abs. 1 Nr. 5 HGB.",
      trap: "Nicht Zahlung mit Aufwand verwechseln. In der Klausur ausdrücklich begründen, warum eine Verbindlichkeit statt Bank gebucht wird."
    },
    {
      kicker: "SONDERBETRIEBSBEREICH",
      title: "SBV I, SBV II und Sonder-GuV sicher trennen",
      summary: "Sonderbetriebsvermögen gehört dem Gesellschafter, dient aber steuerlich der Personengesellschaft oder seiner Beteiligung.",
      steps: ["SBV I dient unmittelbar dem Betrieb der Gesellschaft, z. B. ein an die KG vermietetes Grundstück.", "Grund und Boden wird nicht abgeschrieben; das Gebäude grundsätzlich schon.", "SBV II stärkt die Beteiligung des Gesellschafters an der Gesellschaft.", "Sonder-GuV: Mieteinnahmen minus Gebäude-AfA minus Finanzierungszinsen."],
      example: "Vermietet A Grundstück und Gebäude an die KG, stehen beide in seiner Sonderbilanz. Nur das Gebäude wird linear abgeschrieben; Miete, AfA und Darlehenszinsen bilden das Sonderergebnis.",
      trap: "Finanzierungsdarlehen und Beteiligungsfinanzierung nicht automatisch gleich einordnen. Immer fragen: Dient das Wirtschaftsgut dem Betrieb oder der Beteiligung?"
    },
    {
      kicker: "GEWERBESTEUER",
      title: "Belastung berechnen und Doppelbelastung erklären",
      summary: "Eine gewerblich tätige Personengesellschaft ist selbst Gewerbesteuerschuldnerin; die Einkommensteuer trifft transparent die Gesellschafter.",
      steps: ["Gewerbebetrieb nach § 2 Abs. 1 GewStG prüfen.", "Freibetrag für natürliche Personen und Personengesellschaften: 24.500 € nach § 11 GewStG.", "Gewerbesteuer ist nach § 4 Abs. 5b EStG nicht abzugsfähig und wird steuerlich wieder hinzugerechnet.", "Entlastung auf Gesellschafterebene über § 35 EStG; Kurslogik: Anrechnung bis zum Vierfachen des Messbetrags."],
      example: "Gewerbeertrag 7.235 € bei einer Kapitalgesellschaft: auf 7.200 € abrunden; 7.200 € × 3,5 % = 252 € Messbetrag; × 350 % Hebesatz = 882 € Gewerbesteuer.",
      trap: "Der Freibetrag von 24.500 € gilt nicht für Kapitalgesellschaften."
    },
    {
      kicker: "BELASTUNGSVERGLEICH",
      title: "Steuerbelastung grafisch erklären",
      summary: "Bei Zeichnungen zählen Achsen, Flächen und die Vergleichbarkeit der Alternativen. Eine Kapitalgesellschaft muss einschließlich Ausschüttung betrachtet werden.",
      steps: ["Grenzsteuersatz: Steuerbelastung der nächsten zusätzlichen Einkommenseinheit.", "Durchschnittsteuersatz: gesamte Steuer geteilt durch gesamtes Einkommen.", "Ehegattensplitting/Familiengesellschaft: Wirkung der Einkommensverteilung zeigen.", "Kapitalgesellschaft: zunächst etwa 15 % KSt plus Gewerbesteuer, anschließend Belastung der Ausschüttung."],
      example: "Bei rund 29 % Belastung auf Gesellschaftsebene bleiben von 100 etwa 71. Werden diese mit 25 % belastet, ergibt sich insgesamt grob eine Belastung von 46,75.",
      trap: "Nur die thesaurierte Belastung der GmbH mit der vollständig dem Gesellschafter zugerechneten Personengesellschaft zu vergleichen ist methodisch unfair."
    },
    {
      kicker: "BETRIEBSAUFSPALTUNG & DIVIDENDEN",
      title: "Verflechtung erkennen und Teileinkünfte anwenden",
      summary: "Vermietung und Beteiligung werden gewerblich, wenn sachliche und personelle Verflechtung gemeinsam vorliegen.",
      steps: ["Sachliche Verflechtung: eine wesentliche Betriebsgrundlage wird überlassen.", "Personelle Verflechtung: dieselbe Person oder Personengruppe beherrscht Besitz- und Betriebsunternehmen.", "Folge: Betriebsaufspaltung; Miet- und Beteiligungseinkünfte werden betrieblich eingeordnet.", "Dividenden im Betriebsvermögen: Teileinkünfteverfahren mit 60 % steuerpflichtigen Erträgen und 60 % abzugsfähigen Aufwendungen."],
      example: "Dividende 30.000 €, Aufwendungen 200 €: 60 % von 30.000 € = 18.000 €; 60 % von 200 € = 120 €; steuerliches Ergebnis = 17.880 €.",
      trap: "§ 20 und § 21 EStG nicht als Endergebnis stehen lassen, wenn beide Verflechtungen vorliegen."
    },
    {
      kicker: "KONZERN & PRIVATE EQUITY",
      title: "§ 8b KStG als Rechenkette",
      summary: "Bei Dividenden und Beteiligungsveräußerungen einer Kapitalgesellschaft wird die Freistellung mit pauschal nicht abzugsfähigen Betriebsausgaben kombiniert.",
      steps: ["Dividende: § 8b Abs. 1 KStG freistellen.", "5 % der Dividende nach § 8b Abs. 5 KStG wieder hinzurechnen.", "Veräußerungsgewinn: § 8b Abs. 2 und 3 KStG.", "PE-Struktur: doppelstöckige Kapitalgesellschaft kann Veräußerungsgewinne auf Holdingebene begünstigen; spätere Ausschüttung an die Privatperson bleibt relevant."],
      example: "Handelsrechtlicher Gewinn 80 mit Dividende 100: 80 − 100 nach § 8b Abs. 1 + 5 nach § 8b Abs. 5 = −15 steuerliches Einkommen.",
      trap: "Die Holding verschiebt oder reduziert Belastung auf Gesellschaftsebene, beseitigt aber die spätere Besteuerung beim privaten Investor nicht."
    },
    {
      kicker: "LETZTER PRÜFUNGSBLOCK",
      title: "Kapitaleinkünfte, Scheinselbstständigkeit und Tax Wedge",
      summary: "Zum Schluss ordnest du die kürzeren Themen sauber ein und vermeidest begriffliche Punktverluste.",
      steps: ["Dividenden: § 20 Abs. 1 Nr. 1 EStG; Veräußerung mindestens 1 % Beteiligung: regelmäßig § 17 EStG und Teileinkünfteverfahren.", "Kleine Portfoliobeteiligung: grundsätzlich Abgeltungsteuer und § 20 Abs. 2 Nr. 1 EStG.", "Dividenden stammen aus bereits belastetem Gesellschaftsgewinn; Darlehenszinsen waren auf Gesellschaftsebene grundsätzlich abzugsfähig.", "Scheinselbstständigkeit ist wegen vermiedener Sozialabgaben attraktiv, wird aber nach der tatsächlichen Eingliederung und Weisungsabhängigkeit beurteilt."],
      example: "Tax Wedge bezeichnet die Differenz zwischen den Arbeitskosten des Arbeitgebers und dem verfügbaren Nettoeinkommen des Arbeitnehmers durch Steuern und Sozialabgaben.",
      trap: "Nicht nur die gewünschte Vertragsbezeichnung prüfen. Für Beschäftigung oder Selbstständigkeit zählt die tatsächliche Durchführung."
    }
  ] : [
    { kicker:"30-POINT CORE", title:"Co-entrepreneurship in the correct sequence", summary:"Do not start with the calculation. Draw the partnership, partners and contractual relationships, then work through both profit levels.", steps:["Partner tax status under Sec. 1(1) PITC and Secs. 8/9 GFC.","Classify partnership income under Sec. 18 or Sec. 15(2) PITC.","State co-entrepreneurial risk and initiative.","Partner income equals stage-one share plus the stage-two special result."], example:"Example: −20,000 × 2/3 = −13,333; special remuneration 20,000 less special expenses 16,000 = 4,000; total income = −9,333.", trap:"Special remuneration remains business income under Sec. 15(1) no. 2 PITC." },
    { kicker:"ACCRUALS", title:"Recognise expenses before payment", summary:"Accrual accounting follows economic attribution to the period, not only cash flow.", steps:["Revenue: Bank to sales.","Paid interest: interest expense to bank.","Interest due but unpaid: interest expense to liability.","Unassessed trade tax: trade-tax expense to provision."], example:"December interest is recognised under Sec. 252(1) no. 5 GCC even though cash has not moved.", trap:"Explain why the credit is a liability rather than bank." },
    { kicker:"SPECIAL BUSINESS SPHERE", title:"Separate SBA I, SBA II and the special P&L", summary:"The partner owns the asset, while tax law connects it to the partnership or the participation.", steps:["SBA I directly serves the partnership business.","Land is not depreciated; the building generally is.","SBA II strengthens the participation.","Special P&L: rent less building depreciation and financing interest."], example:"Land and building rented to the KG enter the special balance sheet; only the building is depreciated.", trap:"Classify by function: service to the business or to the participation." },
    { kicker:"TRADE TAX", title:"Calculate the burden and explain relief", summary:"The partnership owes trade tax while partners bear income tax under transparency.", steps:["Check Sec. 2(1) TTC.","EUR 24,500 allowance for individuals and partnerships.","Trade tax is non-deductible and added back.","Relief at partner level under Sec. 35 PITC."], example:"7,235 rounds to 7,200; ×3.5%=252; ×350%=EUR 882.", trap:"Corporations do not receive the EUR 24,500 allowance." },
    { kicker:"BURDEN COMPARISON", title:"Explain the tax burden graph", summary:"Label axes and shaded areas and compare structures on the same distribution basis.", steps:["Marginal versus average tax rate.","Spouse privilege and income allocation.","Company level: roughly 15% CIT plus trade tax.","Add shareholder tax when profits are distributed."], example:"A 29% company burden leaves 71; taxing 25% of 71 gives a total burden of roughly 46.75.", trap:"Do not compare retained corporate profit with fully distributed partnership profit." },
    { kicker:"BUSINESS SPLIT", title:"Identify both nexuses", summary:"A material and a personal nexus convert the rental/shareholding arrangement into a business split.", steps:["Material nexus: essential business asset.","Personal nexus: common control.","Consequence: business split.","Business dividends use the partial-income method."], example:"EUR 30,000 dividend and EUR 200 expenses produce 18,000 − 120 = EUR 17,880.", trap:"Do not stop at Secs. 20 and 21 PITC when both nexuses exist." },
    { kicker:"GROUPS & PRIVATE EQUITY", title:"Apply Sec. 8b CITC as a chain", summary:"Exemption and the 5% add-back must be shown separately.", steps:["Dividend exemption: Sec. 8b(1).","5% add-back: Sec. 8b(5).","Disposal gain: Sec. 8b(2)/(3).","A holding structure does not eliminate later private-level distribution tax."], example:"Commercial profit 80 − dividend 100 + 5% add-back 5 = taxable income −15.", trap:"Always mention the later distribution to the individual investor." },
    { kicker:"FINAL BLOCK", title:"Capital income, bogus self-employment and tax wedge", summary:"Classify the shorter topics precisely.", steps:["Dividends: Sec. 20(1) no. 1 PITC.","At least 1% participation: generally Sec. 17 and partial-income method.","Portfolio holding: final withholding tax.","Employment status follows actual control and integration, not the contract label."], example:"The tax wedge is the gap between employer labour costs and the employee's disposable net income.", trap:"Interest and dividends have different prior company-level tax treatment." }
  ];
  const item = chapters[chapter];
  const complete = chapter === chapters.length - 1;
  return <section className="page tax-prep-page">
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← {de ? "Trainingsarten" : "Training modes"}</button><span>{chapter + 1} / {chapters.length}</span></div>
    <div className="tax-prep-progress" aria-label={de ? "Fortschritt der Vorbereitung" : "Preparation progress"}><span style={{width:`${((chapter+1)/chapters.length)*100}%`}} /></div>
    <div className="tax-prep-layout">
      <nav className="tax-prep-nav" aria-label={de ? "Kapitel" : "Chapters"}>{chapters.map((entry,index)=><button key={entry.title} className={index===chapter?"active":index<chapter?"visited":""} onClick={()=>setChapter(index)}><span>{index<chapter?"✓":index+1}</span><div><small>{entry.kicker}</small><strong>{entry.title}</strong></div></button>)}</nav>
      <article className="tax-prep-lesson">
        <span className="question-type">{item.kicker}</span><h1>{item.title}</h1><p className="tax-prep-summary">{item.summary}</p>
        <div className="tax-prep-schema"><h2>{de ? "Prüfungsschema" : "Exam sequence"}</h2><ol>{item.steps.map(step=><li key={step}>{step}</li>)}</ol></div>
        <div className="tax-prep-example"><span>∑</span><div><h3>{de ? "Vorgerechnetes Beispiel" : "Worked example"}</h3><p>{item.example}</p></div></div>
        <aside className="tax-prep-trap"><b>{de ? "Typischer Punktverlust" : "Typical lost marks"}</b><p>{item.trap}</p></aside>
        <p className="tax-prep-note">{de ? "Diese Lektion erklärt und bewertet nicht. Dein Wissensstand wird erst im anschließenden Einstufungstest gemessen." : "This lesson explains without scoring. Your knowledge is measured only in the diagnostic that follows."}</p>
        <div className="tax-prep-actions"><button className="secondary-button" disabled={chapter===0} onClick={()=>setChapter(value=>value-1)}>← {de ? "Zurück" : "Back"}</button>{complete?<button className="primary-button" onClick={onStartDiagnostic}>{de ? "Vorbereitung abgeschlossen · Einstufungstest starten" : "Preparation complete · Start diagnostic"} →</button>:<button className="primary-button" onClick={()=>setChapter(value=>value+1)}>{de ? "Nächste Erklärung" : "Next explanation"} →</button>}</div>
      </article>
    </div>
    <p className="tax-prep-source">{de ? "Inhaltliche Grundlage: „German Tax Exam Prep“, 6 Seiten. Normen und Kurslogik wurden mit den vorhandenen Taxation-Lösungsunterlagen abgeglichen." : "Content basis: “German Tax Exam Prep”, 6 pages. Rules and course logic were cross-checked against the available taxation solution materials."}</p>
  </section>;
}

function TaxCaseLab({ taxCase, position, total, confidence, setConfidence, onExit, onComplete }: {
  taxCase: TaxCase; position: number; total: number; confidence: Confidence;
  setConfidence: (value: Confidence) => void; onExit: () => void;
  onComplete: (score: number, firstError?: TaxCase["steps"][number]["id"]) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState<number>();
  const [numberAnswer, setNumberAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<{ id: TaxCase["steps"][number]["id"]; correct: boolean; points: number }[]>([]);
  const [memo, setMemo] = useState("");
  const done = stepIndex >= taxCase.steps.length;
  const step = taxCase.steps[Math.min(stepIndex, taxCase.steps.length - 1)];
  const maxScore = taxCase.steps.reduce((sum, item) => sum + item.points, 0);
  const score = results.reduce((sum, item) => sum + item.points, 0);
  const isNumberCorrect = step.input ? Math.abs(Number(numberAnswer.replace(/\s/g, "").replace(",", ".")) - step.input.answer) <= (step.input.tolerance ?? 0.01) : false;
  const correct = step.input ? isNumberCorrect : answer === step.correct;
  const checkStep = () => {
    setResults((current) => [...current, { id: step.id, correct, points: correct ? step.points : 0 }]);
    setChecked(true);
  };
  const nextStep = () => { setStepIndex((value) => value + 1); setAnswer(undefined); setNumberAnswer(""); setChecked(false); };
  const firstError = results.find((item) => !item.correct)?.id;

  return <section className="page lab-page tax-case-page">
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← Trainingsarten</button><span>Steuerfall {Math.min(position + 1, total)} / {total}</span></div>
    <div className="tax-case-progress">{taxCase.steps.map((item, index) => <span key={item.id} className={`${index < stepIndex ? (results[index]?.correct ? "passed" : "missed") : ""} ${index === stepIndex && !done ? "active" : ""}`}><b>{index + 1}</b><small>{["Steuerart","Subjekt","Norm","Rechnung","Ergebnis"][index]}</small></span>)}</div>
    <article className="question-card lab-card tax-case-card">
      <div className="lab-title"><span className="question-type">TAXATION FALLLABOR · {taxCase.topic}</span><h1>{taxCase.title}</h1><div className="case-facts"><b>Facts</b><p>{taxCase.facts}</p></div></div>
      {!done && <>
        <div className="case-score"><span>Schritt {stepIndex + 1} von {taxCase.steps.length}</span><b>{score} / {maxScore} Punkte bisher</b></div>
        <h2>{step.title}</h2><p className="stage-intro">{step.prompt}</p>
        {step.options && <div className="options">{step.options.map((option, index) => <button key={option} disabled={checked} className={`${answer === index ? "selected" : ""} ${checked && index === step.correct ? "correct" : ""} ${checked && answer === index && answer !== step.correct ? "incorrect" : ""}`} onClick={() => setAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>}
        {step.input && <label className={`tax-number-answer ${checked ? (correct ? "step-right" : "step-wrong") : ""}`}><span><b>Your calculation</b><small>Negative amounts can be entered with a minus sign. Decimal comma and decimal point are accepted.</small></span><span className="number-field"><input inputMode="decimal" disabled={checked} value={numberAnswer} onChange={(event) => setNumberAnswer(event.target.value)} placeholder="Enter result"/><i>{step.input.unit}</i></span>{checked && !correct && <em>Correct result: {step.input.answer.toLocaleString("de-DE")} {step.input.unit}</em>}</label>}
        {checked && <div className={correct ? "feedback correct-feedback" : "feedback wrong-feedback"}><h3>{correct ? `+${step.points} Punkte` : "0 Punkte – Fehlerstelle erkannt"}</h3><p>{step.explanation}</p></div>}
        <div className="question-actions">{checked ? <button className="primary-button" onClick={nextStep}>{stepIndex === taxCase.steps.length - 1 ? "Fall auswerten" : "Nächster Prüfungsschritt"} →</button> : <button className="primary-button" disabled={step.input ? !numberAnswer.trim() : answer === undefined} onClick={checkStep}>Schritt prüfen</button>}</div>
      </>}
      {done && <div className="tax-case-result">
        <div className="case-result-top"><span className={`result-ring ${score < maxScore * .7 ? "needs-work" : "mastered"}`}>{score}<small>/ {maxScore}</small></span><div><span className="question-type">TEILPUNKTE-AUSWERTUNG</span><h2>{score === maxScore ? "Fall vollständig beherrscht." : score >= maxScore * .7 ? "Solider Lösungsweg – einzelne Punkte nachschärfen." : "Dieser Fall wird adaptiv wiederholt."}</h2><p>{taxCase.trap}</p></div></div>
        <div className="rubric-grid">{taxCase.steps.map((item, index) => <div key={item.id} className={results[index]?.correct ? "rubric-right" : "rubric-wrong"}><span>{results[index]?.correct ? "✓" : "×"}</span><b>{["Steuerart","Steuersubjekt","Norm","Berechnung","Rechtsfolge"][index]}</b><strong>{results[index]?.points ?? 0}/{item.points}</strong></div>)}</div>
        <label className="memo-field"><b>Write your own short exam answer</b><small>Use: issue → rule → application/calculation → conclusion. This field is deliberately not auto-corrected.</small><textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="In the present case ..." rows={5}/></label>
        <details className="model-answer"><summary>Compare with model answer</summary><p>{taxCase.modelAnswer}</p></details>
        <label className="exam-confidence">Wie sicher fühltest du dich?<select value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}><option value="low">niedrig</option><option value="medium">mittel</option><option value="high">hoch</option></select></label>
        <SourceBadge source={taxCase.source}/><button className="primary-button" onClick={() => onComplete(score, firstError)}>Nächster Steuerfall →</button>
      </div>}
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
  const latestBySkill = new Map<string, AnswerRecord>();
  [...progress.answers].reverse().forEach((item) => { const key=`${item.subject}:${item.topic}:${item.errorType??item.questionId}`; if (!latestBySkill.has(key)) latestBySkill.set(key, item); });
  const errors = [...latestBySkill.values()].filter((item) => !item.correct).map((answer) => ({ answer, question: quizQuestions.find((item) => item.id === answer.questionId) }));
  const errorCounts = errorTypes.map((type) => ({ type, count: errors.filter((item) => item.answer.errorType === type).length })).filter((item) => item.count);
  const repairPrompt=(answer:AnswerRecord)=> answer.subject==="portfolio" ? `Löse eine neue Zahlenvariante zu „${answer.topic}“. Kontrolliere besonders: ${answer.errorType??"vollständiger Rechenweg"}.` : `Prüfe einen neuen Sachverhalt zu „${answer.topic}“ mit Problem → Norm → Subsumtion/Rechnung → Ergebnis. Fokus: ${answer.errorType??"Normkette"}.`;
  return <section className="page"><PageHeading eyebrow="AUTOMATISCHE FEHLERKARTEN" title="Dein Fehlerbuch" description="Jeder offene Fehler wird als neue Transferaufgabe formuliert. So trainierst du die Ursache und lernst nicht nur die alte Antwort auswendig." />
    <div className="error-summary"><article className="panel"><strong>{errors.length}</strong><span>offene Fehler</span></article><article className="panel"><strong>{errors.filter((item) => item.answer.confidence === "high").length}</strong><span>Scheinsicherheiten</span></article><article className="panel"><strong>{errors.length}</strong><span>zur Wiedervorlage</span></article></div>
    {errorCounts.length > 0 && <div className="error-chips">{errorCounts.map((item) => <span key={item.type}>{item.type} <b>{item.count}</b></span>)}</div>}
    {errors.length ? <div className="review-list">{errors.map(({ answer, question }) => <article className="review-item wrong" key={`${answer.subject}-${answer.topic}-${answer.errorType}`}><div><span>{answer.confidence === "high" ? "Scheinsicherheit" : "Wiederholen"}</span><strong>{subjectName[answer.subject]} · {answer.topic}</strong><b>{answer.errorType ?? "Wissenslücke"}</b></div><h3>{repairPrompt(answer)}</h3><p><b>Fehlerursache:</b> {question?.explanation ?? `${answer.errorType??"Der Lösungsweg"} war in der letzten Anwendung noch nicht sicher.`}</p><small>Neu einzuplanen · letzter Fehler am {new Date(answer.answeredAt).toLocaleDateString("de-DE")}</small>{question&&<SourceBadge source={question.source} />}</article>)}</div> : <EmptyState>Noch keine offenen Fehler. Löse einen Diagnosetest oder eine Prüfung, damit das Fehlerbuch gezielt arbeiten kann.</EmptyState>}
    <button className="primary-button error-cta" onClick={() => navigate(errors[0]?.answer.subject === "portfolio" ? "trainer" : "quiz")}>{errors.length ? "Transferaufgabe starten" : "Diagnosetest starten"} →</button>
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
