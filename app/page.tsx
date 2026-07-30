"use client";

import { lazy, Suspense, createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { flashcards, quizQuestions } from "@/lib/data";
import {
  addAnswer,
  addLearningAttempt,
  defaultProgress,
  clearLastProgressUser,
  loadProgress,
  mergeProgress,
  prepareProgressForUser,
  resetProgress,
  reviewCard,
  saveProgress,
} from "@/lib/storage";
import type {
  AnswerRecord,
  AppProgress,
  Confidence,
  Difficulty,
  ErrorType,
  Flashcard,
  Language,
  QuizQuestion,
  StudySession,
  Subject,
} from "@/lib/types";
import { createLabTasks, labErrorByStage, type LabTask } from "@/lib/data/calculationLab";
import { taxCases, taxCaseErrorByStep, type TaxCase } from "@/lib/data/taxCaseLab";
import { getRememberMe, getSupabase, setRememberMe } from "@/lib/supabase";
import {
  adaptiveQueue,
  averageSubjectMastery,
  createStudySession,
  scoreForecast,
  subjectCoverage,
  topicMastery,
  type PlanSubject,
} from "@/lib/adaptive";
import { examCoachSnapshot } from "@/lib/examAnalytics";
import { PwaControls } from "./pwaControls";

const PortfolioAcademy = lazy(() => import("./portfolioAcademy").then((module) => ({ default: module.PortfolioAcademy })));
const ExamWorkspace = lazy(() => import("./examWorkspace").then((module) => ({ default: module.ExamWorkspace })));
const ExamAidPanel = lazy(() => import("./examAids").then((module) => ({ default: module.ExamAidPanel })));
const Models = lazy(() => import("./modelsView").then((module) => ({ default: module.ModelsView })));
const Videos = lazy(() => import("./videosView").then((module) => ({ default: module.VideosView })));
const TaxExamPreparation = lazy(() => import("./taxPrepView").then((module) => ({ default: module.TaxExamPreparationView })));

type View = "dashboard" | "focus" | "mastery" | "plan" | "cards" | "quiz" | "trainer" | "errors" | "models" | "videos" | "exam" | "session-summary";
type SubjectScope = Subject | "all";
type LearningTarget = { subject: Subject; topic: string };
type Navigate = (view: View, target?: LearningTarget) => void;

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

const navItems: { view: View; de: string; en: string; icon: string; group: "overview" | "plan" | "learn" | "test" }[] = [
  { view: "dashboard", de: "Dashboard", en: "Dashboard", icon: "▦", group: "overview" },
  { view: "focus", de: "Optimal lernen", en: "Optimal session", icon: "◎", group: "plan" },
  { view: "mastery", de: "Kompetenzen", en: "Mastery", icon: "◔", group: "plan" },
  { view: "plan", de: "Tagesplan", en: "Daily plan", icon: "✓", group: "plan" },
  { view: "cards", de: "Karteikarten", en: "Flashcards", icon: "▱", group: "learn" },
  { view: "trainer", de: "Fachtrainer", en: "Subject training", icon: "∑", group: "learn" },
  { view: "models", de: "Modelle", en: "Models", icon: "⌁", group: "learn" },
  { view: "videos", de: "Video-Playlist", en: "Video playlist", icon: "▶", group: "learn" },
  { view: "quiz", de: "MCQ & Diagnose", en: "MCQ & assessment", icon: "?", group: "test" },
  { view: "errors", de: "Fehlerbuch", en: "Error log", icon: "!", group: "test" },
  { view: "exam", de: "Prüfungsmodus", en: "Exam mode", icon: "◇", group: "test" },
];

const navGroups = [
  { id: "overview", de: "Überblick", en: "Overview" },
  { id: "plan", de: "Planen", en: "Plan" },
  { id: "learn", de: "Lernen", en: "Learn" },
  { id: "test", de: "Prüfen", en: "Test" },
] as const;

const LanguageContext = createContext<Language>("de");
const useLanguage = () => useContext(LanguageContext);
const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;

function ViewLoader() {
  const language = useLanguage();
  return <div className="panel view-loader" role="status">{tr(language, "Lernmodul wird geladen …", "Loading learning module …")}</div>;
}

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

function shuffleQuestionOptions(question: QuizQuestion): QuizQuestion {
  const entries = shuffle(question.options.map((option, originalIndex) => ({ option, originalIndex })));
  const remap = (originalIndex: number) => entries.findIndex((entry) => entry.originalIndex === originalIndex);
  return {
    ...question,
    options: entries.map((entry) => entry.option),
    correct: Array.isArray(question.correct)
      ? question.correct.map(remap).sort((a, b) => a - b)
      : remap(question.correct),
  };
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

function ProfileIcon() {
  return <svg className="profile-icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5.5 20c.45-4 2.65-6 6.5-6s6.05 2 6.5 6" />
  </svg>;
}

function StudySessionBanner({ session, onResume }: { session: StudySession; onResume: () => void }) {
  const language = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 60_000));
  const remaining = Math.max(0, session.plannedMinutes - elapsed);
  return <aside className="study-session-banner">
    <div><span>◎</span><div><small>{tr(language, "AKTIVE OPTIMAL-SESSION", "ACTIVE OPTIMAL SESSION")}</small><strong>{session.currentIndex + 1}/{session.items.length} · {session.items[session.currentIndex]?.topic}</strong></div></div>
    <div className="session-banner-progress"><i><b style={{ width: `${session.items.length ? session.completedItemIds.length / session.items.length * 100 : 0}%` }} /></i><span>{remaining} {tr(language, "Min verbleibend", "min remaining")}</span></div>
    <button className="secondary-button" onClick={onResume}>{tr(language, "Aktuelle Aufgabe öffnen", "Open current task")} →</button>
  </aside>;
}

function OptimalSessionSummary({
  session,
  progress,
  navigate,
  onStartNext,
}: {
  session: StudySession;
  progress: AppProgress;
  navigate: Navigate;
  onStartNext: () => void;
}) {
  const language = useLanguage();
  const sessionEnd = session.completedAt ?? new Date().toISOString();
  const attempts = (progress.attempts ?? []).filter((item) => item.completedAt >= session.startedAt && item.completedAt <= sessionEnd);
  const score = attempts.reduce((sum, item) => sum + item.score, 0);
  const maxScore = attempts.reduce((sum, item) => sum + item.maxScore, 0);
  const errors = attempts.flatMap((item) => item.errorTypes);
  const subjects = session.subject === "all" ? (["portfolio", "tax"] as Subject[]) : [session.subject];
  return <section className="page session-finish-page">
    <PageHeading eyebrow={tr(language, "SESSION ABGESCHLOSSEN", "SESSION COMPLETE")} title={tr(language, "Dein Lernblock ist sauber abgeschlossen.", "Your study block is complete.")} description={tr(language, "Alle Ergebnisse sind gespeichert und die nächste Empfehlung wurde mit dem neuen Lernstand berechnet.", "All results are saved and the next recommendation has been recalculated from your updated mastery.")} />
    <div className="session-finish-grid">
      <article><strong>{session.completedItemIds.length}/{session.items.length}</strong><span>{tr(language, "Aufgabenblöcke", "task blocks")}</span></article>
      <article><strong>{Number.isInteger(score) ? score : score.toFixed(1)}/{Number.isInteger(maxScore) ? maxScore : maxScore.toFixed(1)}</strong><span>{tr(language, "erreichte Punkte", "points earned")}</span></article>
      <article><strong>{errors.length}</strong><span>{tr(language, "erkannte Fehler", "identified errors")}</span></article>
    </div>
    <div className="session-mastery-summary">{subjects.map((subject) => {
      const before = session.baselineMastery[subject];
      const after = averageSubjectMastery(progress, subject);
      return <article key={subject}><span>{subjectName[subject]}</span><strong>{before}% → {after}%</strong><small>{after >= before ? `+${after - before}` : after - before} {tr(language, "Kompetenzpunkte", "mastery points")}</small></article>;
    })}</div>
    {errors.length > 0 && <div className="panel session-error-list"><h2>{tr(language, "Für die nächste Runde vorgemerkt", "Queued for the next round")}</h2><p>{[...new Set(errors)].join(" · ")}</p></div>}
    <div className="session-finish-actions"><button className="primary-button" onClick={onStartNext}>{tr(language, "Weiter optimal lernen", "Continue optimal learning")} →</button><button className="secondary-button" onClick={() => navigate("dashboard")}>{tr(language, "Zum Dashboard", "Back to dashboard")}</button></div>
  </section>;
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [subjectScope, setSubjectScope] = useState<SubjectScope>("all");
  const [learningTarget, setLearningTarget] = useState<LearningTarget>();
  const [quizPreset, setQuizPreset] = useState<"tax-diagnostic">();
  const [progress, setProgress] = useState<AppProgress>(defaultProgress);
  const [ready, setReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudState, setCloudState] = useState<"offline" | "syncing" | "synced" | "error">("offline");
  const progressRef = useRef(progress);
  const userRef = useRef<User | null>(null);
  const language: Language = progress.settings.language ?? "de";

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setProgress(loadProgress());
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (ready) saveProgress(progress, user?.id);
  }, [progress, ready, user?.id]);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      if (sessionUser) {
        const scoped = prepareProgressForUser(progressRef.current, sessionUser.id);
        progressRef.current = scoped;
        setProgress(scoped);
      }
      userRef.current = sessionUser;
      setUser(sessionUser);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      const previousUser = userRef.current;
      if (sessionUser && previousUser?.id !== sessionUser.id) {
        const scoped = prepareProgressForUser(progressRef.current, sessionUser.id);
        progressRef.current = scoped;
        setProgress(scoped);
      }
      if (!sessionUser && previousUser) {
        saveProgress(progressRef.current, previousUser.id);
        clearLastProgressUser(previousUser.id);
        const guest = loadProgress();
        progressRef.current = guest;
        setProgress(guest);
        setCloudReady(false);
        setCloudState("offline");
      }
      userRef.current = sessionUser;
      setUser(sessionUser);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    queueMicrotask(() => !cancelled && setCloudState("syncing"));
    void (async () => {
      try {
        const scoped = prepareProgressForUser(progressRef.current, user.id);
        progressRef.current = scoped;
        setProgress(scoped);
        const { data, error } = await getSupabase().from("learning_progress").select("progress").eq("user_id", user.id).maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (data?.progress) {
          setProgress((current) => mergeProgress(current, data.progress as AppProgress));
        } else {
          const { error: uploadError } = await getSupabase().from("learning_progress").insert({ user_id: user.id, progress: scoped });
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

  const navigate: Navigate = (next, target) => {
    setLearningTarget(target);
    if (target) setSubjectScope(target.subject);
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const chooseSubject = (next: SubjectScope) => {
    setLearningTarget(undefined);
    setSubjectScope(next);
  };
  const setActiveSubject = (next: Subject) => {
    setSubjectScope(next);
    setLearningTarget((current) => current?.subject === next ? current : undefined);
  };
  const routeStudyItem = (item: StudySession["items"][number]) => {
    navigate(item.view, { subject: item.subject, topic: item.topic });
  };
  const startOptimalSession = (minutes = progress.settings.dailyMinutes || 30, subject: PlanSubject = subjectScope) => {
    const session = createStudySession(progress, minutes, subject);
    if (!session.items.length) {
      navigate("focus");
      return;
    }
    setProgress((current) => ({ ...current, activeStudySession: session }));
    routeStudyItem(session.items[0]);
  };
  const completeStudyItem = () => {
    const active = progress.activeStudySession;
    if (!active || active.completedAt) return;
    const currentItem = active.items[active.currentIndex];
    const completedItemIds = currentItem && !active.completedItemIds.includes(currentItem.id)
      ? [...active.completedItemIds, currentItem.id]
      : active.completedItemIds;
    const nextIndex = active.currentIndex + 1;
    const updatedAt = new Date().toISOString();
    if (nextIndex >= active.items.length) {
      setProgress((current) => ({
        ...current,
        activeStudySession: {
          ...(current.activeStudySession ?? active),
          completedItemIds,
          currentIndex: active.items.length,
          updatedAt,
          completedAt: updatedAt,
        },
      }));
      navigate("session-summary");
      return;
    }
    const nextItem = active.items[nextIndex];
    setProgress((current) => ({
      ...current,
      activeStudySession: {
        ...(current.activeStudySession ?? active),
        completedItemIds,
        currentIndex: nextIndex,
        updatedAt,
      },
    }));
    routeStudyItem(nextItem);
  };
  const resumeStudySession = () => {
    const active = progress.activeStudySession;
    const item = active?.items[active.currentIndex];
    if (active && item && !active.completedAt) routeStudyItem(item);
  };
  const showSubjectSwitcher = ["dashboard", "focus", "mastery", "plan"].includes(view);
  const currentStudyItem = progress.activeStudySession?.items[progress.activeStudySession.currentIndex];
  const isActiveStudyTask = Boolean(
    currentStudyItem
    && !progress.activeStudySession?.completedAt
    && currentStudyItem.view === view
    && currentStudyItem.subject === learningTarget?.subject
    && currentStudyItem.topic === learningTarget?.topic,
  );

  return (
    <LanguageContext.Provider value={language}><div className="app-shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark">L</span>
          <div><strong>{tr(language,"Lerntrainer","StudyHelper")}</strong><small>{tr(language,"Nachprüfung 2026","Resit exam 2026")}</small></div>
        </div>
        <nav aria-label="Hauptnavigation">
          {navGroups.map((group) => <div className="nav-group" key={group.id}>
            <small>{group[language]}</small>
            {navItems.filter((item) => item.group === group.id).map((item) => (
              <button
                key={item.view}
                className={view === item.view ? "nav-item active" : "nav-item"}
                onClick={() => navigate(item.view)}
              >
                <span aria-hidden="true">{item.icon}</span>{item[language]}
              </button>
            ))}
          </div>)}
        </nav>
        <div className="sidebar-footer">
          <span className="pulse-dot" />
          <div><strong>{tr(language,"04. August 2026","4 August 2026")}</strong><small>{tr(language,"Dein Fortschritt zählt.","Every step counts.")}</small></div>
        </div>
      </aside>
      {mobileNav && <button className="nav-backdrop" aria-label={tr(language,"Menü schließen","Close menu")} onClick={() => setMobileNav(false)} />}

      <main className="main-content">
        <header className="mobile-header">
          <button className="menu-button" onClick={() => setMobileNav((value) => !value)} aria-label={tr(language, "Menü öffnen", "Open menu")}>☰</button>
          <strong>{tr(language,"Lerntrainer 2026","StudyHelper 2026")}</strong>
          <button className="mobile-account-button" onClick={() => setAuthOpen(true)} aria-label={tr(language,"Profil und Lernkonto öffnen","Open profile and learning account")}><ProfileIcon /><span className={`sync-dot ${cloudState}`} /></button>
        </header>
        <div className="top-actions">
          {showSubjectSwitcher && <div className="subject-switcher" role="group" aria-label={tr(language,"Fachbereich wählen","Choose subject area")}>
            <button className={subjectScope === "all" ? "active" : ""} onClick={() => chooseSubject("all")}>{tr(language,"Übersicht","Overview")}</button>
            <button className={subjectScope === "portfolio" ? "active" : ""} onClick={() => chooseSubject("portfolio")}>Portfolio</button>
            <button className={subjectScope === "tax" ? "active" : ""} onClick={() => chooseSubject("tax")}>Taxation</button>
          </div>}
          <div className="language-switch" role="group" aria-label={tr(language,"Sprache wählen","Choose language")}>
            <button className={language === "de" ? "active" : ""} onClick={() => setLanguage("de")} aria-pressed={language === "de"}><span className="flag-icon flag-de" aria-hidden="true" /> DE</button>
            <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}><span className="flag-icon flag-gb" aria-hidden="true" /> EN</button>
          </div>
          <PwaControls language={language} />
          <button className="account-button" onClick={() => setAuthOpen(true)}>
            <ProfileIcon />
            <span className={`sync-dot ${cloudState}`} />
            {user ? (user.user_metadata?.display_name || user.email) : tr(language,"Anmelden","Sign in")}
          </button>
        </div>
        {progress.activeStudySession && !progress.activeStudySession.completedAt && <StudySessionBanner session={progress.activeStudySession} onResume={resumeStudySession} />}
        {view === "dashboard" && <Dashboard progress={progress} navigate={navigate} subjectScope={subjectScope} onStartOptimal={() => startOptimalSession()} />}
        {view === "focus" && <AdaptiveSession progress={progress} setProgress={setProgress} navigate={navigate} onStartSession={startOptimalSession} />}
        {view === "mastery" && <MasteryMatrix progress={progress} navigate={navigate} />}
        {view === "plan" && <DailyPlan progress={progress} navigate={navigate} />}
        {view === "cards" && <Cards key={`${subjectScope}-${learningTarget?.topic ?? "all"}`} progress={progress} setProgress={setProgress} initialSubject={subjectScope} initialTopic={learningTarget?.topic} onSubjectChange={setActiveSubject} onSessionTaskComplete={isActiveStudyTask ? completeStudyItem : undefined} />}
        {view === "quiz" && <Quiz key={`${subjectScope}-${learningTarget?.topic ?? "all"}-${quizPreset ?? "regular"}`} setProgress={setProgress} preset={quizPreset} initialSubject={subjectScope} initialTopic={learningTarget?.topic} onPresetApplied={() => setQuizPreset(undefined)} onSubjectChange={setActiveSubject} onSessionTaskComplete={isActiveStudyTask ? completeStudyItem : undefined} />}
        {view === "trainer" && <SubjectTrainer progress={progress} setProgress={setProgress} navigate={navigate} onSubjectChange={setActiveSubject} onStartTaxDiagnostic={() => { setQuizPreset("tax-diagnostic"); navigate("quiz", { subject: "tax", topic: "Tax Liability" }); }} />}
        {view === "errors" && <ErrorBook progress={progress} navigate={navigate} />}
        {view === "models" && <Suspense fallback={<ViewLoader />}><Models language={language} initialSubject={subjectScope === "all" ? "portfolio" : subjectScope} navigate={navigate} onSubjectChange={setActiveSubject} /></Suspense>}
        {view === "videos" && <Suspense fallback={<ViewLoader />}><Videos language={language} initialSubject={subjectScope === "all" ? "portfolio" : subjectScope} navigate={navigate} onSubjectChange={setActiveSubject} /></Suspense>}
        {view === "exam" && <Suspense fallback={<ViewLoader />}><ExamWorkspace key={subjectScope} progress={progress} setProgress={setProgress} language={language} initialSubject={subjectScope === "all" ? undefined : subjectScope} onSubjectChange={setActiveSubject} onStartRepair={(subject, topic) => navigate("quiz", { subject, topic })} /></Suspense>}
        {view === "session-summary" && progress.activeStudySession && <OptimalSessionSummary session={progress.activeStudySession} progress={progress} navigate={navigate} onStartNext={() => startOptimalSession(progress.settings.dailyMinutes, progress.activeStudySession?.subject ?? "all")} />}
        <footer className="app-footer">
          <span>{user ? tr(language, cloudState === "synced" ? "Cloud-Lernstand synchronisiert" : cloudState === "error" ? "Synchronisierung fehlgeschlagen" : "Cloud-Lernstand wird synchronisiert …", cloudState === "synced" ? "Cloud progress synced" : cloudState === "error" ? "Sync failed" : "Syncing cloud progress …") : tr(language,"Lokaler Lernstand · für Gerätewechsel anmelden","Local progress · sign in to use other devices")}</span>
          <button
            className="text-button danger"
            onClick={() => {
              if (window.confirm(tr(language,"Wirklich den gesamten Lernstand zurücksetzen?","Reset all learning progress?"))) {
                setProgress(resetProgress(user?.id));
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

function Dashboard({ progress, navigate, subjectScope, onStartOptimal }: { progress: AppProgress; navigate: Navigate; subjectScope: SubjectScope; onStartOptimal: () => void }) {
  const language = useLanguage();
  const [daypart, setDaypart] = useState<"morning" | "day" | "evening">("day");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const hour = new Date().getHours();
      setDaypart(hour < 11 ? "morning" : hour < 18 ? "day" : "evening");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const greeting = daypart === "morning"
    ? tr(language, "Guten Morgen, Admin", "Good morning, Admin")
    : daypart === "evening"
      ? tr(language, "Guten Abend, Admin", "Good evening, Admin")
      : tr(language, "Guten Tag, Admin", "Good afternoon, Admin");
  const portfolioForecast = scoreForecast(progress, "portfolio");
  const taxForecast = scoreForecast(progress, "tax");
  const pScore = portfolioForecast.central;
  const tScore = taxForecast.central;
  const total = pScore + tScore;
  const weak = getTopicStats(progress)
    .filter((topic) => topic.answers > 0 && (subjectScope === "all" || topic.subject === subjectScope))
    .slice(0, 5);
  const recommendation = adaptiveQueue(progress, 25, subjectScope)[0];
  const reviewed = Object.values(progress.cards).filter((card) => card.attempts > 0).length;
  const accuracy = pct(
    progress.answers.filter((answer) => answer.correct).length,
    progress.answers.length,
  );
  const masteryRows = topicMastery(progress);
  const subjectLearning = (subject: Subject) => {
    const rows = masteryRows.filter((item) => item.subject === subject);
    const attempts = (progress.attempts ?? []).filter((item) => item.subject === subject);
    return {
      mastery: rows.length ? Math.round(rows.reduce((sum, item) => sum + item.mastery, 0) / rows.length) : 0,
      mcqs: attempts.filter((item) => item.mode === "quiz").length,
      applications: attempts.filter((item) => !["quiz", "flashcard"].includes(item.mode)).length,
    };
  };
  const portfolioLearning = subjectLearning("portfolio");
  const taxLearning = subjectLearning("tax");
  const starterTopics = subjectScope === "portfolio"
    ? ["CAPM, SML & Beta", "Diversification & Correlation", "Performance Measures"]
    : subjectScope === "tax"
      ? ["Tax Liability", "Partnership & Co-Entrepreneurship", "Trade Tax"]
      : ["CAPM, SML & Beta", "Performance Measures", "Tax Liability"];
  const coachSubjects: Subject[] = subjectScope === "all" ? ["portfolio", "tax"] : [subjectScope];

  return (
    <section className="page dashboard-page">
      <div className="dashboard-heading">
        <div><p className="eyebrow">{tr(language,"PRÜFUNG · 04. AUGUST 2026","EXAM · 4 AUGUST 2026")}</p><h1>{greeting}</h1><p>{subjectScope === "all" ? tr(language,"Heute zählt nicht Perfektion, sondern der nächste sichere Punkt.","Today is not about perfection, but about securing the next point.") : tr(language,`${subjectName[subjectScope]} ist als Fachbereich ausgewählt.`,`${subjectName[subjectScope]} is selected.`)}</p></div>
        <div className="countdown"><span className="calendar-icon">▦</span><strong>{daysUntil(progress.settings.examDate)}</strong><span>{tr(language,"Tage bis zur Prüfung","days until the exam")}</span></div>
      </div>

      <div className="subject-grid">
        {subjectScope !== "tax" ? <SubjectCard subject="portfolio" score={pScore} mastery={portfolioLearning.mastery} mcqs={portfolioLearning.mcqs} applications={portfolioLearning.applications} priority /> : null}
        {subjectScope !== "portfolio" ? <SubjectCard subject="tax" score={tScore} mastery={taxLearning.mastery} mcqs={taxLearning.mcqs} applications={taxLearning.applications} /> : null}
      </div>

      <section className="exam-coach panel">
        <div className="panel-title"><span>◇</span><div><p className="eyebrow">{tr(language, "PRÜFUNGSCOACH", "EXAM COACH")}</p><h2>{tr(language, "Der nächste sichere Prüfungsschritt", "Your next exam-ready step")}</h2></div></div>
        <div className="exam-coach-grid">{coachSubjects.map((subject) => {
          const coach = examCoachSnapshot(progress, subject);
          const repair = (progress.repairs ?? []).find((item) => item.subject === subject && item.status === "open");
          const action = coach.recommendedMode === "repair" && repair
            ? () => navigate("quiz", { subject, topic: repair.topic })
            : () => navigate("exam", { subject, topic: "Exam" });
          return <article key={subject}>
            <span>{subject === "portfolio" ? "◎ Portfolio Management" : "§ Taxation"}</span>
            <strong>{coach.recommendedMode === "full-mock"
              ? tr(language, "Vollständige Probeklausur", "Full mock exam")
              : coach.recommendedMode === "repair"
                ? tr(language, "Fehler mit größtem Hebel reparieren", "Repair the highest-impact gap")
                : tr(language, "Teilprüfung festigen", "Consolidate with a section exam")}</strong>
            <small>{coach.recentFull
              ? tr(language, `Letzte 90-Punkte-Simulation: ${coach.recentFull.score ?? 0}/90`, `Last 90-point mock: ${coach.recentFull.score ?? 0}/90`)
              : tr(language, "Noch keine vollständige Simulation", "No full mock completed yet")} · {coach.openRepairs} {tr(language, "offene Reparaturen", "open repairs")}</small>
            <button onClick={action}>{coach.recommendedMode === "repair" && repair ? tr(language, "Reparatur starten", "Start repair") : tr(language, "Prüfung starten", "Start exam")} →</button>
          </article>;
        })}</div>
      </section>

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
          )) : <div className="starter-topics">{starterTopics.map((topic, index) => <div key={topic}><span className={index === 0 ? "status-dot weak" : index === 1 ? "status-dot unsure" : "status-dot safe"} />{topic}</div>)}</div>}
        </article>

        <article className="panel next-panel">
          <div className="panel-title"><span>▱</span><h2>{tr(language,"Nächste Lerneinheit","Next study session")}</h2></div>
          <div className="recommendation"><span className="rec-icon">◎</span><div><strong>{recommendation?.topic ?? (subjectScope === "tax" ? "Tax Liability" : "CAPM, SML & Beta")}</strong><span>{recommendation ? `${subjectName[recommendation.subject]} · ${recommendation.reason}` : tr(language,"25 Min · adaptive Auswahl","25 min · adaptive selection")}</span></div></div>
          <button className="primary-button" onClick={onStartOptimal}>{tr(language,"Jetzt optimal lernen","Start optimal session")} <span>→</span></button>
          <button className="text-button" onClick={() => recommendation ? navigate("quiz", { subject: recommendation.subject, topic: recommendation.topic }) : navigate("quiz")}>{tr(language,"MCQ & Diagnose öffnen","Open MCQ & assessment")}</button>
        </article>
      </div>

      <div className="micro-stats"><span><strong>{reviewed}</strong> {tr(language,"Karten bearbeitet","cards reviewed")}</span><span><strong>{progress.answers.length}</strong> {tr(language,"Antworten","answers")}</span><span><strong>{progress.answers.length ? accuracy : "–"}{progress.answers.length ? "%" : ""}</strong> {tr(language,"Trefferquote","accuracy")}</span></div>
    </section>
  );
}

function AdaptiveSession({ progress, setProgress, navigate, onStartSession }: { progress: AppProgress; setProgress: React.Dispatch<React.SetStateAction<AppProgress>>; navigate: Navigate; onStartSession: (minutes: number, subject: PlanSubject) => void }) {
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
  const targetView = (attempts: number): View => attempts === 0 ? "cards" : "quiz";
  const startItem = (item: (typeof queue)[number]) => navigate(targetView(item.attempts), { subject: item.subject, topic: item.topic });
  return <section className="page"><PageHeading eyebrow={tr(language,"ADAPTIVE LERNSTEUERUNG","ADAPTIVE LEARNING")} title={tr(language,"Jetzt optimal lernen","Your optimal session")} description={tr(language,"Die Reihenfolge kombiniert fällige Wiederholungen, Scheinsicherheiten, schwache punktestarke Themen und noch nicht abgedeckten Stoff.","The sequence combines due reviews, false confidence, weak high-value topics and content you have not covered yet.")} />
    <div className="session-length" role="group" aria-label={tr(language,"Dauer wählen","Choose duration")}>{[5,15,30,60,90].map(value=><button key={value} className={minutes===value?"active":""} onClick={()=>{setMinutes(value);setProgress(current=>({...current,settings:{...current.settings,dailyMinutes:value}}));}}>{value} {tr(language,"Min","min")}</button>)}</div>
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
    <div className="adaptive-layout"><div className="adaptive-queue">{queue.map((item,index)=><article key={`${item.subject}-${item.topic}`} className="adaptive-item"><span>{String(index+1).padStart(2,"0")}</span><div><small>{subjectName[item.subject]} · {item.status}</small><h3>{item.topic}</h3><p>{item.reason} · Mastery {item.mastery}% · {item.attempts} {tr(language,"Versuche an","attempts across")} {item.days} {tr(language,"Lerntag(en)","study day(s)")}</p></div><button onClick={()=>startItem(item)}>{tr(language,"Passend starten","Start selected topic")} →</button></article>)}</div>
      <aside className="panel session-summary"><strong>{minutes}</strong><span>{tr(language,"Minuten Fokus","focus minutes")}</span><p>{queue.filter(item=>item.attempts>0&&item.nextDueAt<=new Date().toISOString()).length} {tr(language,"fällige Themen","due topics")}, {queue.filter(item=>item.attempts===0).length} {tr(language,"Abdeckungslücken","coverage gaps")}.</p><div className="why-card"><b>{tr(language,"Warum Priorität 1?","Why priority 1?")}</b><p>{queue[0] ? tr(language, queue[0].reason, queue[0].reasonKey==="false-confidence"?"Correct false confidence":queue[0].reasonKey==="due"?"Review is due":queue[0].reasonKey==="coverage"?"Learn something new":"Close a high-value gap") : "–"}</p></div><button className="primary-button" onClick={()=>onStartSession(minutes,subject)}>{tr(language,"Session mit Priorität 1 starten","Start session with priority 1")} →</button><button className="secondary-button check-button" onClick={()=>queue[0]&&navigate("quiz",{subject:queue[0].subject,topic:queue[0].topic})}>{tr(language,"Nur MCQ-Erfolgskontrolle","MCQ check only")} →</button></aside></div>
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

function MasteryMatrix({ progress, navigate }: { progress: AppProgress; navigate: Navigate }) {
  const language = useLanguage();
  const rows = topicMastery(progress);
  return <section className="page"><PageHeading eyebrow={tr(language,"MEHR ALS RICHTIG / FALSCH","MORE THAN RIGHT / WRONG")} title={tr(language,"Kompetenzmatrix","Mastery matrix")} description={tr(language,"Beherrscht bedeutet: wiederholt korrekt, an mehreren Tagen, angemessen schnell und mit realistischer Sicherheit.","Mastered means: repeatedly correct, across multiple days, at an appropriate speed and with calibrated confidence.")} />
    <div className="mastery-legend"><span className="status-dot weak" /> {tr(language,"Lücke","gap")} <span className="status-dot unsure" /> {tr(language,"im Aufbau","developing")} <span className="status-dot safe" /> {tr(language,"fast sicher / beherrscht","nearly secure / mastered")}</div>
    <div className="mastery-table"><div className="mastery-head"><span>{tr(language,"Kompetenz","Skill")}</span><span>{tr(language,"Treffer","Accuracy")}</span><span>{tr(language,"Tempo","Speed")}</span><span>{tr(language,"Kalibrierung","Calibration")}</span><span>Mastery</span><span>{tr(language,"Status","Status")}</span></div>{rows.map(item=><button key={`${item.subject}-${item.topic}`} onClick={()=>navigate(item.attempts ? "quiz" : "cards",{subject:item.subject,topic:item.topic})}><span><small>{item.subject==="portfolio"?"Portfolio":"Taxation"}</small><b>{item.topic}</b></span><span>{item.attempts?`${item.accuracy}%`:"–"}</span><span>{item.attempts?`${item.speed}%`:"–"}</span><span>{item.attempts?`${item.confidenceCalibration}%`:"–"}</span><span><i style={{width:`${item.mastery}%`}} />{item.mastery}%</span><span className={`mastery-status ${item.status.replaceAll(" ","-")}`}>{item.status}</span></button>)}</div>
  </section>;
}

function SubjectCard({ subject, score, mastery, mcqs, applications, priority = false }: { subject: Subject; score: number; mastery: number; mcqs: number; applications: number; priority?: boolean }) {
  const language = useLanguage();
  return (
    <article className={`subject-card ${subject} ${priority ? "priority" : ""}`}>
      <div className="subject-card-head"><span className="subject-icon">{subject === "portfolio" ? "◎" : "§"}</span><div><p>{priority ? tr(language,"PRIORITÄT HOCH","HIGH PRIORITY") : tr(language,"STABILISIEREN","STABILISE")}</p><h2>{subjectName[subject]}</h2></div></div>
      <div className="score-row"><strong>{score}</strong><span>/ 90 {tr(language,"Punkte","points")}</span><b>{mastery}%</b></div>
      <div className="progress-track"><span style={{ width: `${Math.min(100, (score / 90) * 100)}%` }} /></div>
      <p className="subject-note">{tr(language,`Gemeinsamer Lernstand: Karteikarten, ${mcqs} MCQ-Versuche und ${applications} Anwendungen.`,`Combined mastery: flashcards, ${mcqs} MCQ attempts and ${applications} applications.`)}</p>
    </article>
  );
}

function Cards({
  progress,
  setProgress,
  initialSubject,
  initialTopic,
  onSubjectChange,
  onSessionTaskComplete,
}: {
  progress: AppProgress;
  setProgress: React.Dispatch<React.SetStateAction<AppProgress>>;
  initialSubject: SubjectScope;
  initialTopic?: string;
  onSubjectChange: (subject: Subject) => void;
  onSessionTaskComplete?: () => void;
}) {
  const language = useLanguage();
  const [subject, setSubject] = useState<Subject | "all">(initialSubject);
  const [topic, setTopic] = useState(initialTopic ?? "all");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionReviews, setSessionReviews] = useState(0);
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
    onSubjectChange(card.subject);
    const completedAt = new Date().toISOString();
    setProgress((current) => addLearningAttempt(
      { ...current, cards: { ...current.cards, [card.id]: reviewCard(current.cards[card.id], result) } },
      {
        id: uid("card-attempt"),
        activityId: card.id,
        variantId: card.id,
        subject: card.subject,
        topic: card.topic,
        mode: "flashcard",
        stage: "recall",
        score: result === "known" ? 1 : result === "uncertain" ? .5 : 0,
        maxScore: 1,
        durationMs: 0,
        confidence: result === "known" ? "high" : result === "uncertain" ? "medium" : "low",
        errorTypes: result === "wrong" ? ["Wissenslücke"] : [],
        hintsUsed: 0,
        completedAt,
        difficulty: card.difficulty,
      },
    ));
    const nextSessionReviews = sessionReviews + 1;
    setSessionReviews(nextSessionReviews);
    if (onSessionTaskComplete && nextSessionReviews >= Math.min(3, filtered.length)) {
      onSessionTaskComplete();
      return;
    }
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
      {initialTopic && <div className="active-learning-target"><span>◎</span><div><small>{tr(language,"AUS „OPTIMAL LERNEN“ VORAUSGEWÄHLT","PRESELECTED FROM OPTIMAL SESSION")}</small><strong>{initialSubject === "portfolio" ? "Portfolio Management" : "Taxation"} · {initialTopic}</strong></div></div>}
      <div className="toolbar">
        <select value={subject} onChange={(event) => { const next = event.target.value as Subject | "all"; setSubject(next); if (next !== "all") onSubjectChange(next); setTopic("all"); setIndex(0); setFlipped(false); }}><option value="portfolio">Portfolio Management</option><option value="tax">Taxation</option><option value="all">{tr(language,"Beide Fächer","Both subjects")}</option></select>
        <select value={topic} onChange={(event) => { setTopic(event.target.value); setIndex(0); setFlipped(false); }}><option value="all">{tr(language,"Alle Themen","All topics")}</option>{topics.map((item) => <option key={item}>{item}</option>)}</select>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setIndex(0); setFlipped(false); }} placeholder={tr(language,"Karten durchsuchen …","Search cards …")} />
        <button className={favorites ? "filter-button active" : "filter-button"} onClick={() => { setFavorites((value) => !value); setIndex(0); setFlipped(false); }}>★ {tr(language,"Favoriten","Favourites")}</button>
      </div>
      {card ? (
        <div className="study-layout">
          <div className="card-stage">
            <div className="card-meta"><span>{subjectName[card.subject]}</span><strong>{onSessionTaskComplete ? `${sessionReviews}/${Math.min(3, filtered.length)} ${tr(language, "Session-Karten", "session cards")}` : `${index + 1} / ${filtered.length}`}</strong><span>Box {progress.cards[card.id]?.box ?? 1}</span></div>
            <button className={flipped ? "flashcard flipped" : "flashcard"} onClick={() => setFlipped((value) => !value)}>
              <span className="card-label">{flipped ? tr(language,"ANTWORT","ANSWER") : card.topic.toUpperCase()}</span>
              <div>{flipped ? <><p className="card-answer">{card.back}</p>{language === "de" && card.helpDe && <p className="german-help">Verständnishilfe: {card.helpDe}</p>}</> : <><h2>{card.front}</h2>{language === "de" && card.helpDe && <p className="german-help">Deutsch: {card.helpDe}</p>}</>}</div>
              <span className="flip-hint">{flipped ? tr(language,"Zurück zur Frage","Back to question") : tr(language,"Tippen zum Aufdecken","Tap to reveal")}</span>
            </button>
            {flipped && <div className="review-buttons"><button className="wrong" onClick={() => review("wrong")}>{tr(language,"Nicht gewusst","Did not know")}</button><button className="unsure" onClick={() => review("uncertain")}>{tr(language,"Unsicher","Unsure")}</button><button className="known" onClick={() => review("known")}>{tr(language,"Gewusst","Knew it")}</button></div>}
            <div className="card-actions"><button className="text-button" onClick={() => setIndex((value) => (value - 1 + filtered.length) % filtered.length)}>← {tr(language, "Vorherige", "Previous")}</button><button className={progress.cards[card.id]?.favorite ? "favorite active" : "favorite"} onClick={toggleFavorite}>★ {progress.cards[card.id]?.favorite ? tr(language, "Favorit", "Favourite") : tr(language, "Merken", "Save")}</button><button className="text-button" onClick={() => { setFlipped(false); setIndex((value) => (value + 1) % filtered.length); }}>{tr(language, "Nächste", "Next")} →</button></div>
          </div>
          <aside className="study-sidebar"><h3>{tr(language, "Lernlogik", "Learning logic")}</h3><p>{tr(language, "Gewusste Karten wandern in längere Intervalle. Unsichere Karten kommen morgen, falsche Karten sofort wieder in Box 1.", "Known cards move to longer intervals. Unsure cards return tomorrow, and wrong cards return to box 1 immediately.")}</p><div className="due-stat"><strong>{Object.values(progress.cards).filter((item) => new Date(item.dueAt) <= new Date()).length}</strong><span>{tr(language, "heute fällig", "due today")}</span></div><SourceBadge source={card.source} /></aside>
        </div>
      ) : <EmptyState>{tr(language, "Keine Karten passen zu diesem Filter.", "No cards match this filter.")}</EmptyState>}
    </section>
  );
}

function Quiz({
  setProgress,
  preset,
  initialSubject,
  initialTopic,
  onPresetApplied,
  onSubjectChange,
  onSessionTaskComplete,
}: {
  setProgress: React.Dispatch<React.SetStateAction<AppProgress>>;
  preset?: "tax-diagnostic";
  initialSubject: SubjectScope;
  initialTopic?: string;
  onPresetApplied: () => void;
  onSubjectChange: (subject: Subject) => void;
  onSessionTaskComplete?: () => void;
}) {
  const language = useLanguage();
  const [subject, setSubject] = useState<Subject | "all">(preset === "tax-diagnostic" ? "tax" : initialSubject);
  const [topic, setTopic] = useState(initialTopic ?? "all");
  const [diagnostic, setDiagnostic] = useState(preset === "tax-diagnostic");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [session, setSession] = useState<QuizQuestion[]>([]);
  const [sessionResults, setSessionResults] = useState<AnswerRecord[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number | number[]>();
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [errorType, setErrorType] = useState<ErrorType>("Wissenslücke");
  const started = useRef(0);
  const autoStarted = useRef(false);
  const question = session[index];
  const availableQuestions = quizQuestions.filter((item) =>
    (subject === "all" || item.subject === subject)
    && (topic === "all" || item.topic === topic)
    && (!diagnostic || item.diagnostic)
    && (diagnostic || difficulty === "all" || item.difficulty === difficulty)
  );

  const start = (shortSession = false) => {
    onPresetApplied();
    const pool = availableQuestions;
    if (!pool.length) return;
    const broad = [...new Map(shuffle(pool).map((item) => [`${item.subject}-${item.topic}`, item])).values()];
    const target = shortSession ? 4 : diagnostic ? (subject === "all" ? 18 : 12) : 12;
    setSession([...broad, ...shuffle(pool.filter((item) => !broad.includes(item)))].slice(0, target).map(shuffleQuestionOptions));
    setSessionResults([]); setShowResult(false);
    setIndex(0); setAnswer(undefined); setChecked(false); started.current = Date.now();
  };
  useEffect(() => {
    if (!onSessionTaskComplete || !initialTopic || autoStarted.current) return;
    autoStarted.current = true;
    const frame = window.requestAnimationFrame(() => start(true));
    return () => window.cancelAnimationFrame(frame);
  // The component is keyed by the target; it must auto-start only once for that key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopic, onSessionTaskComplete]);
  const check = () => {
    if (!question || answer === undefined) return;
    onSubjectChange(question.subject);
    const correct = isCorrect(question, answer);
    const record: AnswerRecord = { id: uid("answer"), questionId: question.id, subject: question.subject, topic: question.topic, correct, durationMs: Date.now() - started.current, confidence, errorType: correct ? undefined : errorType, answeredAt: new Date().toISOString(), difficulty: question.difficulty };
    setProgress((current) => addLearningAttempt(addAnswer(current, record), {
      id: `answer-${record.id}`,
      activityId: question.id,
      variantId: question.id,
      subject: question.subject,
      topic: question.topic,
      mode: "quiz",
      stage: question.difficulty === 3 ? "transfer" : question.type === "calculation" || question.type === "legal-rule" ? "application" : "recall",
      score: correct ? question.points : 0,
      maxScore: question.points,
      durationMs: record.durationMs,
      confidence,
      errorTypes: correct ? [] : [errorType],
      hintsUsed: 0,
      completedAt: record.answeredAt,
      difficulty: question.difficulty,
    }));
    setSessionResults((current) => [...current, record]);
    setChecked(true);
  };
  const next = () => {
    if (index >= session.length - 1) {
      if (onSessionTaskComplete) {
        onSessionTaskComplete();
        return;
      }
      setSession([]);
      setShowResult(true);
      return;
    }
    setIndex((value) => value + 1); setAnswer(undefined); setChecked(false); setConfidence("medium"); started.current = Date.now();
  };

  if (!question && showResult) {
    const grouped = [...new Map(sessionResults.map((item) => [`${item.subject}-${item.topic}`, { subject: item.subject, topic: item.topic }])).values()].map((group) => {
      const answers = sessionResults.filter((item) => item.subject === group.subject && item.topic === group.topic);
      const correct = answers.filter((item) => item.correct).length;
      const falseHigh = answers.filter((item) => !item.correct && item.confidence === "high").length;
      return { ...group, correct, total: answers.length, accuracy: pct(correct, answers.length), falseHigh };
    }).sort((a, b) => a.accuracy - b.accuracy);
    const difficultyResults = ([1, 2, 3] as Difficulty[]).map((level) => {
      const answers = sessionResults.filter((item) => item.difficulty === level);
      return { level, correct: answers.filter((item) => item.correct).length, total: answers.length };
    }).filter((item) => item.total > 0);
    return <section className="page"><PageHeading eyebrow={diagnostic ? tr(language,"DIAGNOSE ABGESCHLOSSEN","DIAGNOSTIC COMPLETE") : tr(language,"QUIZ ABGESCHLOSSEN","QUIZ COMPLETE")} title={`${pct(sessionResults.filter((item) => item.correct).length, sessionResults.length)}% ${tr(language,"richtig","correct")}`} description={tr(language,"Das Kompetenzprofil trennt Trefferquote, Schwierigkeit und Scheinsicherheit. Themen mit sicher falschen Antworten erhalten höchste Priorität.","The competence profile separates accuracy, difficulty and false confidence. Topics answered incorrectly with high confidence receive top priority.")} />
      <div className="difficulty-result-grid">{difficultyResults.map((item) => <article key={item.level}><span>Level {item.level}</span><strong>{pct(item.correct, item.total)}%</strong><small>{item.correct}/{item.total} {tr(language,"richtig","correct")}</small></article>)}</div>
      <div className="competence-grid">{grouped.map((item) => <article className="competence-card" key={`${item.subject}-${item.topic}`}><div><span>{subjectName[item.subject]}</span><b className={item.accuracy >= 75 ? "safe" : item.accuracy >= 50 ? "unsure" : "weak"}>{item.accuracy >= 75 ? tr(language, "stabil", "stable") : item.falseHigh ? tr(language, "Scheinsicherheit", "false confidence") : item.accuracy >= 50 ? tr(language, "unsicher", "uncertain") : tr(language, "Lücke", "gap")}</b></div><h3>{item.topic}</h3><div className="progress-track"><span style={{ width: `${item.accuracy}%` }} /></div><p>{item.correct}/{item.total} {tr(language, "richtig", "correct")}{item.falseHigh ? ` · ${item.falseHigh}× ${tr(language, "sicher falsch", "wrong with high confidence")}` : ""}</p></article>)}</div>
      <button className="primary-button result-restart" onClick={() => { setShowResult(false); if (diagnostic) setSubject("all"); }}>{tr(language,diagnostic ? "Neue Gesamtdiagnose vorbereiten" : "Neues Quiz vorbereiten",diagnostic ? "Prepare another full diagnostic" : "Prepare another quiz")} →</button>
    </section>;
  }

  if (!question) return (
    <section className="page"><PageHeading eyebrow={tr(language,"AKTIVES ABRUFEN","ACTIVE RECALL")} title="Quiz" description={tr(language,"Prüfungsfragen mit deutscher Verständnishilfe, sofortigem Feedback und persönlichem Fehlerprotokoll.","Exam questions with immediate feedback and a personal error log.")} />
      {initialTopic && <div className="active-learning-target"><span>◎</span><div><small>{tr(language,"AUS „OPTIMAL LERNEN“ VORAUSGEWÄHLT","PRESELECTED FROM OPTIMAL SESSION")}</small><strong>{subject === "portfolio" ? "Portfolio Management" : "Taxation"} · {initialTopic}</strong></div></div>}
      <div className="setup-grid three"><article className={`setup-card ${subject === "portfolio" ? "selected" : ""}`} onClick={() => { setSubject("portfolio"); onSubjectChange("portfolio"); setTopic("all"); }}><span>◎</span><h2>Portfolio Management</h2><p>{quizQuestions.filter((item) => item.subject === "portfolio").length} {tr(language, "geprüfte Fragen", "reviewed questions")}</p></article><article className={`setup-card ${subject === "tax" ? "selected tax" : ""}`} onClick={() => { setSubject("tax"); onSubjectChange("tax"); setTopic("all"); }}><span>§</span><h2>Taxation</h2><p>{quizQuestions.filter((item) => item.subject === "tax").length} {tr(language, "geprüfte Fragen", "reviewed questions")}</p></article><article className={`setup-card ${subject === "all" ? "selected combined" : ""}`} onClick={() => { setSubject("all"); setTopic("all"); setDiagnostic(true); }}><span>◫</span><h2>{tr(language, "Gesamtdiagnose", "Full diagnostic")}</h2><p>{tr(language, "18 Fragen aus beiden Fächern", "18 questions across both subjects")}</p></article></div>
      <label className="quiz-topic-filter"><span>{tr(language,"Thema für diese Session","Topic for this session")}</span><select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">{tr(language,"Alle Themen des Fachs","All subject topics")}</option>{[...new Set(quizQuestions.filter((item) => subject === "all" || item.subject === subject).map((item) => item.topic))].map((item) => <option key={item} value={item}>{item}</option>)}</select><small>{topic === "all" ? tr(language,"Die Session wird breit über das Fach gestreut.","The session will span the subject.") : tr(language,`Alle Fragen stammen aus „${topic}“.`,`Every question will focus on “${topic}”.`)}</small></label>
      <div className="difficulty-panel panel">
        <div><span className="question-type">{tr(language,"SCHWIERIGKEIT","DIFFICULTY")}</span><h2>{tr(language,"An deinem Lernstand trainieren","Train at your current level")}</h2><p>{tr(language,"Basis prüft Begriffe und Formeln, Anwendung verlangt die richtige Methode, Transfer kombiniert mehrere Schritte und typische Fallen.","Foundation tests concepts and formulas, Application requires the correct method, and Transfer combines several steps and common traps.")}</p></div>
        <div className="difficulty-buttons">
          {([
            ["all", tr(language,"Gemischt","Mixed"), tr(language,"alle Level","all levels")],
            [1, tr(language,"Basis","Foundation"), tr(language,"direkter Abruf","direct recall")],
            [2, tr(language,"Anwendung","Application"), tr(language,"Methode wählen","choose the method")],
            [3, "Transfer", tr(language,"mehrstufig & neu","multi-step & novel")],
          ] as const).map(([level, label, note]) => {
            const count = quizQuestions.filter((item) => (subject === "all" || item.subject === subject) && (topic === "all" || item.topic === topic) && (level === "all" || item.difficulty === level)).length;
            return <button key={level} disabled={diagnostic} className={difficulty === level ? "active" : ""} onClick={() => setDifficulty(level)}><strong>{label}</strong><small>{note} · {count}</small></button>;
          })}
        </div>
      </div>
      <div className="quiz-start panel"><label className="switch-row"><input type="checkbox" checked={diagnostic} onChange={(event) => setDiagnostic(event.target.checked)} /><span><strong>{tr(language,"Adaptiver Diagnosetest","Adaptive diagnostic")}</strong><small>{availableQuestions.length ? tr(language,`${Math.min(subject === "all" ? 18 : 12, availableQuestions.length)} passende Fragen mit Sicherheitsabgleich`,`${Math.min(subject === "all" ? 18 : 12, availableQuestions.length)} matching questions with confidence calibration`) : tr(language,"Für diese Kombination gibt es keine Diagnosefrage. Deaktiviere Diagnose oder wähle „Alle Themen“.","No diagnostic question matches this selection. Disable diagnostic or choose “All topics”.")}</small></span></label><button className="primary-button" disabled={!availableQuestions.length} onClick={() => start()}>{diagnostic ? tr(language,"Diagnosetest starten","Start diagnostic") : tr(language,`${Math.min(12, availableQuestions.length)} Fragen starten`,`Start ${Math.min(12, availableQuestions.length)} questions`)} →</button></div>
    </section>
  );

  return (
    <section className="page quiz-page">
      <div className="quiz-progress"><span style={{ width: `${((index + 1) / session.length) * 100}%` }} /></div>
      <div className="quiz-top"><span>{subjectName[question.subject]} · {question.topic}</span><strong>Frage {index + 1} / {session.length}</strong><span>Level {question.difficulty} · {question.points} Punkte</span></div>
      <article className="question-card"><span className="question-type">{question.type.replace("-", " ")}</span><h1>{question.prompt}</h1>{language === "de" && question.helpDe && <p className="german-help">Deutsch: {question.helpDe}</p>}
        <div className="options">{question.options.map((option, optionIndex) => <button key={option} disabled={checked} className={`${!Array.isArray(answer) && answer === optionIndex ? "selected" : ""} ${checked && !Array.isArray(question.correct) && question.correct === optionIndex ? "correct" : ""} ${checked && !Array.isArray(answer) && answer === optionIndex && !isCorrect(question, answer) ? "incorrect" : ""}`} onClick={() => setAnswer(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>
        {!checked && <div className="answer-meta"><label>Sicherheit<select value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}><option value="low">niedrig</option><option value="medium">mittel</option><option value="high">hoch</option></select></label><label>Falls falsch: Fehlerart<select value={errorType} onChange={(event) => setErrorType(event.target.value as ErrorType)}>{errorTypes.map((item) => <option key={item}>{item}</option>)}</select></label></div>}
        {checked && <div className={isCorrect(question, answer) ? "feedback correct-feedback" : "feedback wrong-feedback"}><h3>{isCorrect(question, answer) ? tr(language,"Richtig.","Correct.") : tr(language,"Noch nicht richtig.","Not quite.")}</h3><p>{question.explanation}</p>{question.solutionSteps && <ol>{question.solutionSteps.map((step) => <li key={step}>{step}</li>)}</ol>}{language === "de" && question.helpDe && <p className="german-help">Verständnishilfe: {question.helpDe}</p>}<SourceBadge source={question.source} /></div>}
        <div className="question-actions">{!checked ? <button className="primary-button" disabled={answer === undefined} onClick={check}>{tr(language, "Antwort prüfen", "Check answer")}</button> : <button className="primary-button" onClick={next}>{index === session.length - 1 ? tr(language, "Quiz beenden", "Finish quiz") : tr(language, "Nächste Frage", "Next question")} →</button>}</div>
      </article>
    </section>
  );
}

type TrainerMode = "calculation" | "tax-case" | "formula" | "lab" | "academy" | "tax-lab" | "tax-prep";
type TrainingRunResult = { id: string; topic: string; score: number; maxScore: number; errors: string[] };

function SubjectTrainer({
  progress,
  setProgress,
  navigate,
  onSubjectChange,
  onStartTaxDiagnostic,
}: {
  progress: AppProgress;
  setProgress: React.Dispatch<React.SetStateAction<AppProgress>>;
  navigate: Navigate;
  onSubjectChange: (subject: Subject) => void;
  onStartTaxDiagnostic: () => void;
}) {
  const language = useLanguage();
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
  const [runResults, setRunResults] = useState<TrainingRunResult[]>([]);
  const [runBaseline, setRunBaseline] = useState(0);
  const started = useRef(0);
  const labStarted = useRef(0);
  const question = questions[index];

  const startMode = (next: TrainerMode) => {
    if (next === "academy") { onSubjectChange("portfolio"); setMode(next); return; }
    if (next === "tax-prep") { onSubjectChange("tax"); setMode(next); return; }
    if (next === "lab") {
      onSubjectChange("portfolio");
      setMode(next); setLabTasks(createLabTasks()); setLabIndex(0); setRunResults([]);
      setRunBaseline(averageSubjectMastery(progress, "portfolio")); labStarted.current = Date.now(); return;
    }
    if (next === "tax-lab") {
      onSubjectChange("tax");
      setMode(next); setTaxLabCases(shuffle(taxCases)); setTaxLabIndex(0); setRunResults([]);
      setRunBaseline(averageSubjectMastery(progress, "tax")); labStarted.current = Date.now(); return;
    }
    if (next === "calculation") onSubjectChange("portfolio");
    if (next === "tax-case") onSubjectChange("tax");
    const filtered = quizQuestions.filter((item) => next === "calculation"
      ? item.subject === "portfolio" && item.type === "calculation"
      : next === "tax-case"
        ? item.subject === "tax" && ["legal-rule", "ordering", "calculation"].includes(item.type)
        : (item.subject === "portfolio" && item.type === "formula") || (item.subject === "tax" && item.type === "legal-rule"));
    setMode(next); setQuestions(shuffle(filtered)); setIndex(0); setAnswer(undefined); setChecked(false); started.current = Date.now();
  };
  const check = () => {
    if (!question || answer === undefined) return;
    onSubjectChange(question.subject);
    const correct = isCorrect(question, answer);
    const errorType: ErrorType = mode === "calculation" ? "Rechenfehler" : mode === "tax-case" ? "Rechtsfolge falsch" : question.subject === "tax" ? "Norm nicht gefunden" : "falsche Formel";
    const record: AnswerRecord = { id: uid("trainer"), questionId: question.id, subject: question.subject, topic: question.topic, correct, durationMs: Date.now() - started.current, confidence, errorType: correct ? undefined : errorType, answeredAt: new Date().toISOString() };
    setProgress((current) => addLearningAttempt(addAnswer(current, record), {
      id: `answer-${record.id}`, activityId: question.id, variantId: question.id,
      subject: question.subject, topic: question.topic, mode: "quiz", stage: "application",
      score: correct ? question.points : 0, maxScore: question.points, durationMs: record.durationMs,
      confidence, errorTypes: correct ? [] : [errorType], hintsUsed: 0, completedAt: record.answeredAt,
      difficulty: question.difficulty,
    }));
    setChecked(true);
  };
  const next = () => { setIndex((value) => (value + 1) % Math.max(1, questions.length)); setAnswer(undefined); setChecked(false); setConfidence("medium"); started.current = Date.now(); };

  if (mode === "academy") return <Suspense fallback={<ViewLoader />}><PortfolioAcademy language={language} progress={progress} setProgress={setProgress} onExit={() => setMode(undefined)} onStartQuiz={(topic) => navigate("quiz", { subject: "portfolio", topic })} /></Suspense>;
  if (mode === "tax-prep") return <Suspense fallback={<ViewLoader />}><TaxExamPreparation language={language} progress={progress} setProgress={setProgress} onExit={() => setMode(undefined)} onStartDiagnostic={onStartTaxDiagnostic} /></Suspense>;

  if (mode === "lab" && labTasks.length > 0 && labIndex >= labTasks.length) {
    return <TrainingRunSummary subject="portfolio" label="Portfolio-Rechenlabor" results={runResults} baseline={runBaseline} progress={progress} navigate={navigate} onBack={() => setMode(undefined)} />;
  }
  if (mode === "tax-lab" && taxLabCases.length > 0 && taxLabIndex >= taxLabCases.length) {
    return <TrainingRunSummary subject="tax" label="Taxation-Falllabor" results={runResults} baseline={runBaseline} progress={progress} navigate={navigate} onBack={() => setMode(undefined)} />;
  }

  if (mode === "lab" && labTasks[labIndex]) return <CalculationLab key={labTasks[labIndex].id} task={labTasks[labIndex]} position={labIndex} total={labTasks.length} confidence={confidence} setConfidence={setConfidence} onExit={() => setMode(undefined)} onComplete={(errors) => {
    const task = labTasks[labIndex]; const correct = errors.length === 0;
    const record: AnswerRecord = { id: uid("lab"), questionId: `lab-${task.id}-${Date.now()}`, subject: "portfolio", topic: task.topic, correct, durationMs: Date.now() - labStarted.current, confidence, errorType: correct ? undefined : labErrorByStage[errors[0]], answeredAt: new Date().toISOString() };
    setProgress((current) => addLearningAttempt(addAnswer(current, record), {
      id: `answer-${record.id}`, activityId: task.id, variantId: record.questionId,
      subject: "portfolio", topic: task.topic, mode: "calculation-lab", stage: "transfer",
      score: Math.max(0, 5 - errors.length), maxScore: 5, durationMs: record.durationMs,
      confidence, errorTypes: correct ? [] : [record.errorType!], hintsUsed: 0, completedAt: record.answeredAt,
    }));
    setRunResults((current) => [...current, { id: task.id, topic: task.topic, score: Math.max(0, 5 - errors.length), maxScore: 5, errors }]);
    setLabIndex((value) => value + 1); setConfidence("medium"); labStarted.current = Date.now();
  }} />;

  if (mode === "tax-lab" && taxLabCases[taxLabIndex]) return <TaxCaseLab key={taxLabCases[taxLabIndex].id} progress={progress} setProgress={setProgress} taxCase={taxLabCases[taxLabIndex]} position={taxLabIndex} total={taxLabCases.length} confidence={confidence} setConfidence={setConfidence} onExit={() => setMode(undefined)} onComplete={({ score, firstError, writtenResponse, selfScore }) => {
    const item = taxLabCases[taxLabIndex];
    const stepMaxScore = item.steps.reduce((sum, step) => sum + step.points, 0);
    const maxScore = stepMaxScore + 2;
    const totalScore = score + selfScore;
    const writingError: ErrorType | undefined = selfScore < 2 ? "Interpretation fehlt" : undefined;
    const errorType = firstError ? taxCaseErrorByStep[firstError] : writingError;
    const correct = totalScore === maxScore;
    const record: AnswerRecord = { id: uid("tax-lab"), questionId: `tax-lab-${item.id}-${Date.now()}`, subject: "tax", topic: item.topic, correct, durationMs: Date.now() - labStarted.current, confidence, errorType, answeredAt: new Date().toISOString() };
    setProgress((current) => addLearningAttempt(addAnswer(current, record), {
      id: `answer-${record.id}`, activityId: item.id, variantId: record.questionId,
      subject: "tax", topic: item.topic, mode: "tax-case", stage: "transfer",
      score: totalScore, maxScore, durationMs: record.durationMs, confidence,
      errorTypes: record.errorType ? [record.errorType] : [], hintsUsed: 0, completedAt: record.answeredAt,
      writtenResponse, selfScore,
    }));
    setRunResults((current) => [...current, { id: item.id, topic: item.topic, score: totalScore, maxScore, errors: errorType ? [errorType] : [] }]);
    setTaxLabIndex((value) => value + 1); setConfidence("medium"); labStarted.current = Date.now();
  }} />;

  if (!mode || !question) return <section className="page"><PageHeading eyebrow={tr(language, "GEZIELTE PRÜFUNGSROUTINE", "TARGETED EXAM ROUTINE")} title={tr(language, "Fachtrainer", "Subject training")} description={tr(language, "Geführte Fachlabore, Klausurwerkstatt, klassische Aufgaben und schneller Abruf verbinden Wissen mit einem vollständigen prüfungsreifen Lösungsweg.", "Guided subject labs, the exam workshop, classic problems and rapid recall connect knowledge with a complete exam-ready solution process.")} />
    <div className="trainer-grid">
      <button className="trainer-card academy" onClick={() => startMode("academy")}><span>◆</span><h2>{tr(language, "Portfolio-Klausurwerkstatt", "Portfolio exam workshop")}</h2><p>{tr(language, "Alle 12 Ausbaustufen: unbekannte Aufgabenketten, Teilpunkte, freies Rechenblatt, Formelnetz, Simulator, Fehlerprofil und Mastery.", "All 12 training levels: unseen problem chains, partial credit, scratchpad, formula network, simulator, error profile and mastery.")}</p><b>{tr(language, "Neue Komplettstufe öffnen", "Open complete training level")} →</b></button>
      <button className="trainer-card tax tax-prep-card" onClick={() => startMode("tax-prep")}><span>◈</span><h2>Tax Exam Prep</h2><p>{tr(language, "Geführte Wiederholung aus der prüfungsentscheidenden Exam-Prep-Datei: Schemata, Zeichnungen, vorgerechnete Beispiele und typische Punktverluste.", "Guided review from the exam-critical prep file: structures, diagrams, worked examples and common lost points.")}</p><b>{tr(language, "Vorbereitung vor dem Einstufungstest", "Preparation before the diagnostic")} →</b></button>
      <button className="trainer-card lab" onClick={() => startMode("lab")}><span>⌬</span><h2>{tr(language, "Portfolio-Rechenlabor", "Portfolio calculation lab")}</h2><p>{tr(language, "Formel erkennen, Werte zuordnen, Ergebnis vorhersagen, jeden Schritt rechnen und ökonomisch erklären.", "Recognize the formula, map values, predict the result, calculate each step and explain the economics.")}</p><b>{tr(language, "7 adaptive Rechenstrecken", "7 adaptive calculation runs")} →</b></button>
      <button className="trainer-card tax tax-lab-card" onClick={() => startMode("tax-lab")}><span>§</span><h2>{tr(language, "Taxation-Falllabor", "Taxation case lab")}</h2><p>{tr(language, "Unbekannten Sachverhalt prüfen: Steuerart, Steuersubjekt, Norm, Berechnung und gutachterliches Ergebnis.", "Analyze an unseen case: tax type, taxable person, rule, calculation and reasoned conclusion.")}</p><b>{taxCases.length} {tr(language, "vollständige Fallketten · Teilpunkte", "complete case chains · partial credit")} →</b></button>
      <button className="trainer-card portfolio" onClick={() => startMode("calculation")}><span>∑</span><h2>{tr(language, "Portfolio-Rechentrainer", "Portfolio calculation training")}</h2><p>{tr(language, "Aufgaben mit vollständigem Lösungsweg, Einheiten und unmittelbarer Fehlererkennung.", "Problems with full solution paths, units and immediate error detection.")}</p><b>{quizQuestions.filter((item) => item.subject === "portfolio" && item.type === "calculation").length} {tr(language, "Aufgaben", "problems")} →</b></button>
      <button className="trainer-card tax" onClick={() => startMode("tax-case")}><span>¶</span><h2>{tr(language, "Taxation-Schnellfälle", "Rapid taxation cases")}</h2><p>{tr(language, "Einzelne Normen, Rechtsfolgen und Berechnungen unter Zeitdruck abrufen.", "Recall individual rules, legal consequences and calculations under time pressure.")}</p><b>{quizQuestions.filter((item) => item.subject === "tax" && ["legal-rule", "ordering", "calculation"].includes(item.type)).length} {tr(language, "Kurzfälle", "short cases")} →</b></button>
      <button className="trainer-card formula" onClick={() => startMode("formula")}><span>ƒ</span><h2>{tr(language, "Formeln & Normen", "Formulas & rules")}</h2><p>{tr(language, "Die passende Formel oder Vorschrift unter Zeitdruck erkennen und typische Verwechslungen vermeiden.", "Recognize the correct formula or provision under time pressure and avoid common mix-ups.")}</p><b>{tr(language, "Schnelltraining", "Rapid training")} →</b></button>
    </div>
  </section>;

  return <section className="page"><div className="trainer-head"><button className="text-button" onClick={() => setMode(undefined)}>← {tr(language, "Trainingsarten", "Training modes")}</button><span>{index + 1} / {questions.length}</span></div>
    <article className="question-card"><span className="question-type">{mode === "calculation" ? tr(language, "RECHENTRAINER", "CALCULATION TRAINING") : mode === "tax-case" ? tr(language, "FALLTRAINER", "CASE TRAINING") : tr(language, "FORMEL / NORM", "FORMULA / RULE")}</span><h1>{question.prompt}</h1>
      {mode === "tax-case" && <div className="case-schema"><span>1 {tr(language, "Steuerart", "Tax type")}</span><span>2 {tr(language, "Subjekt", "Subject")}</span><span>3 {tr(language, "Ausgangsbetrag", "Starting amount")}</span><span>4 {tr(language, "Norm", "Rule")}</span><span>5 {tr(language, "Korrektur", "Adjustment")}</span><span>6 {tr(language, "Ergebnis", "Result")}</span></div>}
      <div className="options">{question.options.map((option, optionIndex) => <button key={option} disabled={checked} className={`${answer === optionIndex ? "selected" : ""} ${checked && !Array.isArray(question.correct) && question.correct === optionIndex ? "correct" : ""} ${checked && answer === optionIndex && !isCorrect(question, answer) ? "incorrect" : ""}`} onClick={() => setAnswer(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>
      {!checked && <label className="exam-confidence">{tr(language, "Sicherheit", "Confidence")}<select value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}><option value="low">{tr(language, "niedrig", "low")}</option><option value="medium">{tr(language, "mittel", "medium")}</option><option value="high">{tr(language, "hoch", "high")}</option></select></label>}
      {checked && <div className={isCorrect(question, answer) ? "feedback correct-feedback" : "feedback wrong-feedback"}><h3>{isCorrect(question, answer) ? tr(language, "Richtig.", "Correct.") : tr(language, "Fehler erkannt.", "Error identified.")}</h3><p>{question.explanation}</p>{question.solutionSteps && <ol>{question.solutionSteps.map((step) => <li key={step}>{step}</li>)}</ol>}<SourceBadge source={question.source} /></div>}
      <div className="question-actions">{checked ? <button className="primary-button" onClick={next}>{tr(language, "Nächste Aufgabe", "Next task")} →</button> : <button className="primary-button" disabled={answer === undefined} onClick={check}>{tr(language, "Antwort prüfen", "Check answer")}</button>}</div>
    </article>
  </section>;
}

function TrainingRunSummary({
  subject,
  label,
  results,
  baseline,
  progress,
  navigate,
  onBack,
}: {
  subject: Subject;
  label: string;
  results: TrainingRunResult[];
  baseline: number;
  progress: AppProgress;
  navigate: Navigate;
  onBack: () => void;
}) {
  const language = useLanguage();
  const score = results.reduce((sum, item) => sum + item.score, 0);
  const maxScore = results.reduce((sum, item) => sum + item.maxScore, 0);
  const errors = results.flatMap((item) => item.errors);
  const currentMastery = averageSubjectMastery(progress, subject);
  const next = adaptiveQueue(progress, progress.settings.dailyMinutes, subject)[0];
  const continueLearning = () => next
    ? navigate(next.attempts === 0 ? "cards" : "quiz", { subject: next.subject, topic: next.topic })
    : navigate("focus");
  return <section className="page session-finish-page">
    <PageHeading eyebrow={`${label.toUpperCase()} · ABGESCHLOSSEN`} title={tr(language, "Lernstrecke ausgewertet", "Training run graded")} description={tr(language, "Punkte, Kompetenzänderung und Fehler sind gespeichert. Die nächste Empfehlung berücksichtigt diesen Lauf bereits.", "Points, mastery change and errors are saved. The next recommendation already includes this run.")} />
    <div className="session-finish-grid"><article><strong>{score}/{maxScore}</strong><span>{tr(language, "Punkte", "points")}</span></article><article><strong>{baseline}% → {currentMastery}%</strong><span>{tr(language, "Fachkompetenz", "subject mastery")}</span></article><article><strong>{errors.length}</strong><span>{tr(language, "Fehlerstellen", "error points")}</span></article></div>
    <div className="panel session-error-list"><h2>{errors.length ? tr(language, "Gezielt nacharbeiten", "Targeted repair") : tr(language, "Stabiler Abschluss", "Stable finish")}</h2><p>{errors.length ? [...new Set(errors)].join(" · ") : tr(language, "Alle bewerteten Schritte wurden sicher gelöst.", "All graded steps were solved securely.")}</p>{next && <small>{tr(language, "Nächste Empfehlung", "Next recommendation")}: {subjectName[next.subject]} · {next.topic}</small>}</div>
    <div className="session-finish-actions"><button className="primary-button" onClick={continueLearning}>{tr(language, "Weiterlernen", "Continue learning")} →</button><button className="secondary-button" onClick={() => navigate("dashboard")}>{tr(language, "Zum Dashboard", "Dashboard")}</button><button className="text-button" onClick={onBack}>{tr(language, "Trainingsarten", "Training modes")}</button></div>
  </section>;
}

function TaxCaseLab({ progress, setProgress, taxCase, position, total, confidence, setConfidence, onExit, onComplete }: {
  progress: AppProgress; setProgress: React.Dispatch<React.SetStateAction<AppProgress>>;
  taxCase: TaxCase; position: number; total: number; confidence: Confidence;
  setConfidence: (value: Confidence) => void; onExit: () => void;
  onComplete: (result: { score: number; firstError?: TaxCase["steps"][number]["id"]; writtenResponse: string; selfScore: number }) => void;
}) {
  const language = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState<number>();
  const [numberAnswer, setNumberAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<{ id: TaxCase["steps"][number]["id"]; correct: boolean; points: number }[]>([]);
  const [memo, setMemo] = useState("");
  const [memoSaved, setMemoSaved] = useState(false);
  const [selfScore, setSelfScore] = useState<number>();
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
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← {tr(language,"Trainingsarten","Training modes")}</button><span>{tr(language,"Steuerfall","Tax case")} {Math.min(position + 1, total)} / {total}</span></div>
    <div className="tax-case-progress">{taxCase.steps.map((item, index) => <span key={item.id} className={`${index < stepIndex ? (results[index]?.correct ? "passed" : "missed") : ""} ${index === stepIndex && !done ? "active" : ""}`}><b>{index + 1}</b><small>{[tr(language,"Steuerart","Tax type"),tr(language,"Subjekt","Subject"),tr(language,"Norm","Rule"),tr(language,"Rechnung","Calculation"),tr(language,"Ergebnis","Conclusion")][index]}</small></span>)}</div>
    <article className="question-card lab-card tax-case-card">
      <div className="lab-title"><span className="question-type">TAXATION FALLLABOR · {taxCase.topic}</span><h1>{taxCase.title}</h1><div className="case-facts"><b>Facts</b><p>{taxCase.facts}</p></div></div>
      <Suspense fallback={<ViewLoader />}><ExamAidPanel subject="tax" language={language} progress={progress} setProgress={setProgress} /></Suspense>
      {!done && <>
        <div className="case-score"><span>{tr(language,"Schritt","Step")} {stepIndex + 1} {tr(language,"von","of")} {taxCase.steps.length}</span><b>{score} / {maxScore} {tr(language,"Punkte bisher","points so far")}</b></div>
        <h2>{step.title}</h2><p className="stage-intro">{step.prompt}</p>
        {step.options && <div className="options">{step.options.map((option, index) => <button key={option} disabled={checked} className={`${answer === index ? "selected" : ""} ${checked && index === step.correct ? "correct" : ""} ${checked && answer === index && answer !== step.correct ? "incorrect" : ""}`} onClick={() => setAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>}
        {step.input && <label className={`tax-number-answer ${checked ? (correct ? "step-right" : "step-wrong") : ""}`}><span><b>Your calculation</b><small>Negative amounts can be entered with a minus sign. Decimal comma and decimal point are accepted.</small></span><span className="number-field"><input inputMode="decimal" disabled={checked} value={numberAnswer} onChange={(event) => setNumberAnswer(event.target.value)} placeholder="Enter result"/><i>{step.input.unit}</i></span>{checked && !correct && <em>Correct result: {step.input.answer.toLocaleString("de-DE")} {step.input.unit}</em>}</label>}
        {checked && <div className={correct ? "feedback correct-feedback" : "feedback wrong-feedback"}><h3>{correct ? `+${step.points} ${tr(language,"Punkte","points")}` : tr(language,"0 Punkte – Fehlerstelle erkannt","0 points – error located")}</h3><p>{step.explanation}</p></div>}
        <div className="question-actions">{checked ? <button className="primary-button" onClick={nextStep}>{stepIndex === taxCase.steps.length - 1 ? tr(language,"Fall auswerten","Grade case") : tr(language,"Nächster Prüfungsschritt","Next exam step")} →</button> : <button className="primary-button" disabled={step.input ? !numberAnswer.trim() : answer === undefined} onClick={checkStep}>{tr(language,"Schritt prüfen","Check step")}</button>}</div>
      </>}
      {done && <div className="tax-case-result">
        <div className="case-result-top"><span className={`result-ring ${score < maxScore * .7 ? "needs-work" : "mastered"}`}>{score}<small>/ {maxScore}</small></span><div><span className="question-type">{tr(language,"TEILPUNKTE-AUSWERTUNG","PARTIAL-CREDIT REVIEW")}</span><h2>{score === maxScore ? tr(language,"Fall vollständig beherrscht.","Case fully mastered.") : score >= maxScore * .7 ? tr(language,"Solider Lösungsweg – einzelne Punkte nachschärfen.","Solid solution path – sharpen individual points.") : tr(language,"Dieser Fall wird adaptiv wiederholt.","This case will be scheduled adaptively.")}</h2><p>{taxCase.trap}</p></div></div>
        <div className="rubric-grid">{taxCase.steps.map((item, index) => <div key={item.id} className={results[index]?.correct ? "rubric-right" : "rubric-wrong"}><span>{results[index]?.correct ? "✓" : "×"}</span><b>{[tr(language,"Steuerart","Tax type"),tr(language,"Steuersubjekt","Tax subject"),tr(language,"Norm","Rule"),tr(language,"Berechnung","Calculation"),tr(language,"Rechtsfolge","Legal consequence")][index]}</b><strong>{results[index]?.points ?? 0}/{item.points}</strong></div>)}</div>
        <div className="written-answer-workflow">
          <label className="memo-field"><b>{tr(language,"Eigene kurze Klausurantwort (2 Punkte)","Your short exam answer (2 points)")}</b><small>{tr(language,"Formuliere 3–5 Sätze nach: Problem → Norm → Anwendung/Rechnung → Ergebnis. Speichere erst deine Antwort; danach erscheint die Musterlösung.","Write 3–5 sentences using: issue → rule → application/calculation → conclusion. Save your response before viewing the model answer.")}</small><textarea disabled={memoSaved} value={memo} onChange={(event) => setMemo(event.target.value)} placeholder={tr(language,"Problematisch ist … Nach § … Im vorliegenden Fall … Daher …","The issue is … Under Sec. … In the present case … Therefore …")} rows={5}/></label>
          {!memoSaved ? <div className="written-answer-actions"><button className="secondary-button" disabled={!memo.trim()} onClick={() => setMemoSaved(true)}>{tr(language,"Antwort speichern & vergleichen","Save answer & compare")}</button><button className="text-button" onClick={() => { setMemo(""); setMemoSaved(true); setSelfScore(0); }}>{tr(language,"Ohne Freitext fortfahren","Continue without written answer")}</button></div> : <>
            <p className="saved-answer-note">✓ {memo ? tr(language,"Deine Antwort ist im Lernversuch gespeichert.","Your answer will be saved with this learning attempt.") : tr(language,"Freitext übersprungen: 0/2 Punkte.","Written response skipped: 0/2 points.")}</p>
            <details className="model-answer" open><summary>{tr(language,"Mit Musterlösung vergleichen","Compare with model answer")}</summary><p>{taxCase.modelAnswer}</p></details>
            <fieldset className="writing-self-score"><legend>{tr(language,"Wie vollständig ist deine Antwort im Vergleich?","How complete is your response?")}</legend>{[[0,tr(language,"0 Punkte · fehlt/anderer Lösungsweg","0 points · missing/different approach")],[1,tr(language,"1 Punkt · teilweise vollständig","1 point · partly complete")],[2,tr(language,"2 Punkte · Norm, Anwendung und Ergebnis enthalten","2 points · rule, application and conclusion included")]] .map(([value,label]) => <button type="button" key={value} className={selfScore === value ? "active" : ""} onClick={() => setSelfScore(value as number)}>{label}</button>)}</fieldset>
          </>}
        </div>
        <label className="exam-confidence">{tr(language,"Wie sicher fühltest du dich?","How confident did you feel?")}<select value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}><option value="low">{tr(language,"niedrig","low")}</option><option value="medium">{tr(language,"mittel","medium")}</option><option value="high">{tr(language,"hoch","high")}</option></select></label>
        <SourceBadge source={taxCase.source}/><button className="primary-button" disabled={!memoSaved || selfScore === undefined} onClick={() => onComplete({ score, firstError, writtenResponse: memo.trim(), selfScore: selfScore ?? 0 })}>{position >= total - 1 ? tr(language,"Falllabor abschließen","Finish case lab") : tr(language,"Nächsten Steuerfall laden","Load next tax case")} →</button>
      </div>}
    </article>
  </section>;
}


function CalculationLab({ task, position, total, confidence, setConfidence, onExit, onComplete }: {
  task: LabTask; position: number; total: number; confidence: Confidence;
  setConfidence: (value: Confidence) => void; onExit: () => void; onComplete: (errors: string[]) => void;
}) {
  const language = useLanguage();
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
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← {tr(language,"Trainingsarten","Training modes")}</button><span>{tr(language,"Rechenstrecke","Calculation run")} {Math.min(position+1,total)} / {total}</span></div>
    <div className="lab-progress">{[tr(language,"Formel","Formula"),tr(language,"Variablen","Variables"),tr(language,"Prognose","Prediction"),tr(language,"Rechnen","Calculate"),tr(language,"Deuten","Interpret")].map((label,index)=><span key={label} className={index <= ["formula","variables","prediction","steps","interpretation","result"].indexOf(stage) ? "active" : ""}>{index+1}<small>{label}</small></span>)}</div>
    <article className="question-card lab-card"><div className="lab-title"><span className="question-type">{tr(language,"RECHENLABOR","CALCULATION LAB")} · {task.topic}</span><h1>{task.title}</h1><p>{task.prompt}</p></div>
      <Suspense fallback={<ViewLoader />}><ExamAidPanel subject="portfolio" language={language} /></Suspense>
      {stage === "formula" && <><h2>1. {tr(language,"Welches Modell brauchst du?","Which model do you need?")}</h2><p className="stage-intro">{tr(language,"Wähle zuerst die passende Formel – noch ohne Zahlen einzusetzen.","Choose the correct formula first, without inserting numbers yet.")}</p><div className="options formula-options">{task.formulaOptions.map((item,i)=><button key={item} disabled={checked} className={`${formula===i?"selected":""} ${checked&&i===0?"correct":""} ${checked&&formula===i&&i!==0?"incorrect":""}`} onClick={()=>setFormula(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>{checked&&<div className={formula===0?"feedback correct-feedback":"feedback wrong-feedback"}><b>{formula===0?tr(language,"Passende Formel erkannt.","Correct formula identified."):tr(language,"Diese Formel beantwortet eine andere Frage.","This formula answers a different question.")}</b><p>{task.trap}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("variables")}>{tr(language,"Werte zuordnen","Map values")} →</button>:<button className="primary-button" disabled={formula===undefined} onClick={()=>mark("formula",formula===0)}>{tr(language,"Prüfen","Check")}</button>}</div></>}
      {stage === "variables" && <><h2>2. {tr(language,"Angaben den Variablen zuordnen","Map the given values to variables")}</h2><p className="stage-intro">{tr(language,"Sprich jede Zeile innerlich aus. So wird aus Symbolen ein Rechenplan.","Read each line internally so the symbols become a calculation plan.")}</p><div className="variable-grid">{task.variables.map(item=><div key={item.symbol}><strong>{item.symbol}</strong><b>{item.value}</b><span>{item.meaning}</span></div>)}</div><div className="feedback neutral-feedback"><b>{tr(language,"Einheiten-Check","Unit check")}</b><p>{tr(language,"Prozentwerte beim Rechnen konsistent als Prozent oder Dezimalzahl verwenden. Nicht innerhalb eines Rechenschritts mischen.","Use percentages consistently as percentages or decimals. Do not mix formats within one calculation step.")}</p></div><div className="question-actions"><button className="primary-button" onClick={()=>advance("prediction")}>{tr(language,"Ergebnisrichtung vorhersagen","Predict the direction")} →</button></div></>}
      {stage === "prediction" && <><h2>3. {tr(language,"Was erwartest du vor dem Rechnen?","What do you expect before calculating?")}</h2><p className="stage-intro">{tr(language,"Die Prognose ist dein Plausibilitätscheck gegen Taschenrechner- und Vorzeichenfehler.","The prediction is your plausibility check against calculator and sign errors.")}</p><div className="options">{task.predictionOptions.map((item,i)=><button key={item} disabled={checked} className={`${prediction===i?"selected":""} ${checked&&i===0?"correct":""} ${checked&&prediction===i&&i!==0?"incorrect":""}`} onClick={()=>setPrediction(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>{checked&&<div className={prediction===0?"feedback correct-feedback":"feedback wrong-feedback"}><p>{task.prediction}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("steps")}>{tr(language,"Jetzt rechnen","Calculate now")} →</button>:<button className="primary-button" disabled={prediction===undefined} onClick={()=>mark("prediction",prediction===0)}>{tr(language,"Prognose prüfen","Check prediction")}</button>}</div></>}
      {stage === "steps" && <><h2>4. {tr(language,"Rechenweg in kontrollierten Schritten","Calculation path in controlled steps")}</h2><div className="formula-strip">{task.formula}</div><div className="step-inputs">{task.steps.map((item,i)=><label key={item.label} className={checked?(stepCorrect[i]?"step-right":"step-wrong"):""}><span><b>{i+1}. {item.label}</b>{hint===i&&<small>{item.hint}</small>}</span><span className="number-field"><input inputMode="decimal" value={stepValues[i]} disabled={checked} onChange={e=>setStepValues(values=>values.map((v,x)=>x===i?e.target.value:v))} placeholder={tr(language,"Dein Wert","Your value")}/><i>{item.unit}</i></span>{!checked&&<button type="button" className="hint-button" onClick={()=>setHint(i)}>{tr(language,"Hinweis","Hint")}</button>}{checked&&!stepCorrect[i]&&<em>{tr(language,"Richtig","Correct")}: {String(item.answer).replace(".",",")} {item.unit}</em>}</label>)}</div>{checked&&<div className={stepCorrect.every(Boolean)?"feedback correct-feedback":"feedback wrong-feedback"}><b>{stepCorrect.every(Boolean)?tr(language,"Rechenweg vollständig korrekt.","Calculation path fully correct."):tr(language,"Der genaue Fehlerpunkt ist markiert.","The exact error point is marked.")}</b><p>{task.trap}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("interpretation")}>{tr(language,"Ergebnis deuten","Interpret result")} →</button>:<button className="primary-button" disabled={stepValues.some(v=>!v.trim())} onClick={()=>mark("steps",stepCorrect.every(Boolean))}>{tr(language,"Rechenweg prüfen","Check calculation")}</button>}</div></>}
      {stage === "interpretation" && <><h2>5. {tr(language,"Was bedeutet das Ergebnis?","What does the result mean?")}</h2><div className="options">{task.interpretationOptions.map((item,i)=><button key={item} disabled={checked} className={`${interpretation===i?"selected":""} ${checked&&i===0?"correct":""} ${checked&&interpretation===i&&i!==0?"incorrect":""}`} onClick={()=>setInterpretation(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>{checked&&<div className={interpretation===0?"feedback correct-feedback":"feedback wrong-feedback"}><p>{task.interpretation}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("result")}>{tr(language,"Auswertung","Review")} →</button>:<button className="primary-button" disabled={interpretation===undefined} onClick={()=>mark("interpretation",interpretation===0)}>{tr(language,"Interpretation prüfen","Check interpretation")}</button>}</div></>}
      {stage === "result" && <div className="lab-result"><span className={errors.length?"result-ring needs-work":"result-ring mastered"}>{5-errors.length}<small>/ 5</small></span><h2>{errors.length?tr(language,"Rechenstrecke abgeschlossen – gezielte Wiederholung eingeplant.","Calculation run complete – targeted review scheduled."):tr(language,"Rechenstrecke sicher beherrscht.","Calculation run securely mastered.")}</h2><p>{errors.length?tr(language,`Noch offen: ${errors.map(e=>({formula:"Formelwahl",prediction:"Plausibilität",steps:"Rechenweg",interpretation:"Deutung"}[e])).join(", ")}. Eine neue Zahlenvariante wird über den adaptiven Plan eingeplant.`,`Still open: ${errors.join(", ")}. A new numerical variant will be scheduled adaptively.`):tr(language,"Du hast Modellwahl, Plausibilität, Rechnung und Interpretation verbunden.","You connected model selection, plausibility, calculation and interpretation.")}</p><label className="exam-confidence">{tr(language,"Wie sicher fühltest du dich?","How confident did you feel?")}<select value={confidence} onChange={e=>setConfidence(e.target.value as Confidence)}><option value="low">{tr(language,"niedrig","low")}</option><option value="medium">{tr(language,"mittel","medium")}</option><option value="high">{tr(language,"hoch","high")}</option></select></label><SourceBadge source={task.source}/><button className="primary-button" onClick={()=>onComplete(errors)}>{position >= total - 1 ? tr(language,"Rechenlabor abschließen","Finish calculation lab") : tr(language,"Nächste Rechenstrecke","Next calculation")} →</button></div>}
    </article>
  </section>;
}

function ErrorBook({ progress, navigate }: { progress: AppProgress; navigate: Navigate }) {
  const language = useLanguage();
  const latestBySkill = new Map<string, AnswerRecord>();
  [...progress.answers].reverse().forEach((item) => { const key=`${item.subject}:${item.topic}:${item.errorType??item.questionId}`; if (!latestBySkill.has(key)) latestBySkill.set(key, item); });
  const openRepairs = (progress.repairs ?? []).filter((item) => item.status === "open").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const legacyErrors = [...latestBySkill.values()]
    .filter((item) => !item.correct && !openRepairs.some((repair) => repair.subject === item.subject && repair.topic === item.topic))
    .map((answer) => ({ answer, question: quizQuestions.find((item) => item.id === answer.questionId) }));
  const repairItems = openRepairs.map((repair) => {
    const attempt = (progress.attempts ?? []).find((item) => item.id === repair.sourceAttemptId);
    return {
      key: repair.id,
      subject: repair.subject,
      topic: repair.topic,
      errorType: repair.errorType,
      confidence: attempt?.confidence,
      prompt: repair.prompt,
      explanation: tr(language, "Der Fehler bleibt offen, bis du eine neue Variante in Anwendung oder Transfer mit mindestens 70 % löst.", "The error remains open until you solve a new application or transfer variant with at least 70%."),
      date: attempt?.completedAt ?? repair.dueAt,
      source: quizQuestions.find((item) => item.id === attempt?.activityId)?.source,
      writtenResponse: attempt?.writtenResponse,
    };
  });
  const repairPrompt=(answer:AnswerRecord)=> answer.subject==="portfolio"
    ? tr(language, `Löse eine neue Zahlenvariante zu „${answer.topic}“. Kontrolliere besonders: ${answer.errorType??"vollständiger Rechenweg"}.`, `Solve a new numerical variant for “${answer.topic}”. Focus especially on the complete calculation path.`)
    : tr(language, `Prüfe einen neuen Sachverhalt zu „${answer.topic}“ mit Problem → Norm → Subsumtion/Rechnung → Ergebnis. Fokus: ${answer.errorType??"Normkette"}.`, `Analyze a new “${answer.topic}” case using issue → rule → application/calculation → conclusion.`);
  const legacyItems = legacyErrors.map(({ answer, question }) => ({
    key: `${answer.subject}-${answer.topic}-${answer.errorType ?? answer.questionId}`,
    subject: answer.subject,
    topic: answer.topic,
    errorType: answer.errorType ?? "Wissenslücke" as ErrorType,
    confidence: answer.confidence,
    prompt: repairPrompt(answer),
    explanation: question?.explanation ?? tr(language, `${answer.errorType??"Der Lösungsweg"} war in der letzten Anwendung noch nicht sicher.`, "The solution path was not yet secure in the last application."),
    date: answer.answeredAt,
    source: question?.source,
    writtenResponse: undefined as string | undefined,
  }));
  const items = [...repairItems, ...legacyItems];
  const errorCounts = errorTypes.map((type) => ({ type, count: items.filter((item) => item.errorType === type).length })).filter((item) => item.count);
  return <section className="page"><PageHeading eyebrow={tr(language, "AUTOMATISCHE FEHLERKARTEN", "AUTOMATIC ERROR CARDS")} title={tr(language, "Dein Fehlerbuch", "Your error log")} description={tr(language, "Jeder offene Fehler wird als neue Transferaufgabe formuliert. So trainierst du die Ursache und lernst nicht nur die alte Antwort auswendig.", "Every open error becomes a new transfer task, so you train the cause instead of memorizing the old answer.")} />
    <div className="error-summary"><article className="panel"><strong>{items.length}</strong><span>{tr(language, "offene Fehler", "open errors")}</span></article><article className="panel"><strong>{items.filter((item) => item.confidence === "high").length}</strong><span>{tr(language, "Scheinsicherheiten", "false-confidence errors")}</span></article><article className="panel"><strong>{openRepairs.length}</strong><span>{tr(language, "aktive Reparaturen", "active repairs")}</span></article></div>
    {errorCounts.length > 0 && <div className="error-chips">{errorCounts.map((item) => <span key={item.type}>{item.type} <b>{item.count}</b></span>)}</div>}
    {items.length ? <div className="review-list">{items.map((item) => <article className="review-item wrong" key={item.key}><div><span>{item.confidence === "high" ? tr(language, "Scheinsicherheit", "False confidence") : tr(language, "Wiederholen", "Review")}</span><strong>{subjectName[item.subject]} · {item.topic}</strong><b>{item.errorType}</b></div><h3>{item.prompt}</h3>{item.writtenResponse && <blockquote><b>{tr(language, "Deine gespeicherte Klausurantwort:", "Your saved exam answer:")}</b> {item.writtenResponse}</blockquote>}<p><b>{tr(language, "Reparaturregel:", "Repair rule:")}</b> {item.explanation}</p><small>{tr(language, "Neu einzuplanen · letzter Fehler am", "To be rescheduled · last error on")} {new Date(item.date).toLocaleDateString(language === "de" ? "de-DE" : "en-GB")}</small>{item.source&&<SourceBadge source={item.source} />}</article>)}</div> : <EmptyState>{tr(language, "Noch keine offenen Fehler. Löse einen Diagnosetest oder eine Prüfung, damit das Fehlerbuch gezielt arbeiten kann.", "No open errors yet. Complete a diagnostic or exam so the error log can work specifically.")}</EmptyState>}
    <button className="primary-button error-cta" onClick={() => items[0] ? navigate("quiz", { subject: items[0].subject, topic: items[0].topic }) : navigate("quiz")}>{items.length ? tr(language, "Passende Transferaufgabe starten", "Start matching transfer task") : tr(language, "Diagnosetest starten", "Start diagnostic")} →</button>
  </section>;
}

function DailyPlan({ progress, navigate }: { progress: AppProgress; navigate: Navigate }) {
  const language = useLanguage();
  const weak = topicMastery(progress).filter((item) => item.attempts > 0);
  const due = Object.values(progress.cards).filter((item) => new Date(item.dueAt) <= new Date()).length;
  const first = weak[0]; const second = weak[1];
  const totalMinutes = Math.max(5, progress.settings.dailyMinutes);
  const minuteWeights = [.2, .3, .25, .15, .1];
  const allocatedMinutes = minuteWeights.map((weight) => Math.floor(totalMinutes * weight));
  let unallocated = totalMinutes - allocatedMinutes.reduce((sum, value) => sum + value, 0);
  for (let index = 0; unallocated > 0; index = (index + 1) % allocatedMinutes.length) {
    allocatedMinutes[index] += 1;
    unallocated -= 1;
  }
  const allTasks: { minutes: number; title: string; detail: string; view: View; target?: LearningTarget }[] = [
    { minutes: allocatedMinutes[0], title: tr(language, "Fällige Fehler & Karten", "Due errors & cards"), detail: due ? tr(language, `${due} Karte${due === 1 ? "" : "n"} sind heute fällig`, `${due} card${due === 1 ? "" : "s"} due today`) : tr(language, "Kurze Aktivierung aus dem Fehlerbuch", "Short activation from the error log"), view: due ? "cards" : "errors" },
    { minutes: allocatedMinutes[1], title: first?.topic ?? tr(language, "Portfolio-Rechenroutine", "Portfolio calculation routine"), detail: first ? `${subjectName[first.subject]} · ${tr(language, "Lernstand", "mastery")} ${first.mastery}%` : tr(language, "CAPM, Beta und Portfoliovarianz", "CAPM, beta and portfolio variance"), view: "quiz", target: first ? { subject: first.subject, topic: first.topic } : { subject: "portfolio", topic: "CAPM, SML & Beta" } },
    { minutes: allocatedMinutes[2], title: second?.topic ?? tr(language, "Taxation-Fallroutine", "Taxation case routine"), detail: second ? `${subjectName[second.subject]} · ${tr(language, "Lernstand", "mastery")} ${second.mastery}%` : tr(language, "Norm, Tatbestand und Rechtsfolge", "Rule, requirements and legal consequence"), view: "quiz", target: second ? { subject: second.subject, topic: second.topic } : { subject: "tax", topic: "Tax Liability" } },
    { minutes: allocatedMinutes[3], title: tr(language, "Gemischter Abruf", "Mixed recall"), detail: tr(language, "Unsicherheiten mit Sicherheitsangabe prüfen", "Test uncertainty with confidence ratings"), view: "quiz" },
    { minutes: allocatedMinutes[4], title: tr(language, "Formeln & Normen", "Formulas & rules"), detail: tr(language, "Schneller Abschluss ohne Unterlagen", "Rapid finish without notes"), view: "trainer" },
  ];
  const tasks = allTasks.filter((task) => task.minutes > 0);
  return <section className="page"><PageHeading eyebrow={tr(language, `${daysUntil(progress.settings.examDate)} TAGE BIS ZUR PRÜFUNG`, `${daysUntil(progress.settings.examDate)} DAYS TO THE EXAM`)} title={tr(language, `Deine ${tasks.reduce((sum, item) => sum + item.minutes, 0)}-Minuten-Session`, `Your ${tasks.reduce((sum, item) => sum + item.minutes, 0)}-minute session`)} description={tr(language, "Der Plan wird aus fälligen Wiederholungen und deinen schwächsten Themen berechnet. Neue Ergebnisse verändern automatisch die nächste Session.", "The plan is calculated from due reviews and your weakest topics. New results automatically change the next session.")} />
    <div className="plan-layout"><div className="plan-list">{tasks.map((task, index) => <button key={`${task.title}-${index}`} onClick={() => navigate(task.view, task.target)}><span>{String(index + 1).padStart(2,"0")}</span><div><h3>{task.title}</h3><p>{task.detail}</p></div><b>{task.minutes} {tr(language, "Min", "min")} →</b></button>)}</div>
      <aside className="panel plan-aside"><h2>{tr(language, "Heutiger Fokus", "Today’s focus")}</h2><div className="plan-ring"><strong>{tasks.reduce((sum, item) => sum + item.minutes, 0)}</strong><span>{tr(language, "Minuten", "minutes")}</span></div><p>{first ? tr(language, `Größter Hebel: ${first.topic}.`, `Biggest lever: ${first.topic}.`) : tr(language, "Starte mit der Gesamtdiagnose, damit der Plan persönlich wird.", "Start with the full diagnostic so the plan becomes personal.")}</p><button className="primary-button" onClick={() => navigate(tasks[0].view, tasks[0].target)}>{tr(language, "Session starten", "Start session")} →</button></aside></div>
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
