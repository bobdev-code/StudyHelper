"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { flashcards, learningVideos, modelOverviews, quizQuestions } from "@/lib/data";
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
import { PortfolioAcademy } from "./portfolioAcademy";
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
import { ExamWorkspace } from "./examWorkspace";
import { ExamAidPanel } from "./examAids";
import { examCoachSnapshot } from "@/lib/examAnalytics";

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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
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
          <button className="menu-button" onClick={() => setMobileNav((value) => !value)} aria-label="Menü öffnen">☰</button>
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
        {view === "models" && <Models initialSubject={subjectScope === "all" ? "portfolio" : subjectScope} navigate={navigate} onSubjectChange={setActiveSubject} />}
        {view === "videos" && <Videos initialSubject={subjectScope === "all" ? "portfolio" : subjectScope} navigate={navigate} onSubjectChange={setActiveSubject} />}
        {view === "exam" && <ExamWorkspace key={subjectScope} progress={progress} setProgress={setProgress} language={language} initialSubject={subjectScope === "all" ? undefined : subjectScope} onSubjectChange={setActiveSubject} onStartRepair={(subject, topic) => navigate("quiz", { subject, topic })} />}
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
            <div className="card-meta"><span>{subjectName[card.subject]}</span><strong>{onSessionTaskComplete ? `${sessionReviews}/${Math.min(3, filtered.length)} Session-Karten` : `${index + 1} / ${filtered.length}`}</strong><span>Box {progress.cards[card.id]?.box ?? 1}</span></div>
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
      <div className="competence-grid">{grouped.map((item) => <article className="competence-card" key={`${item.subject}-${item.topic}`}><div><span>{subjectName[item.subject]}</span><b className={item.accuracy >= 75 ? "safe" : item.accuracy >= 50 ? "unsure" : "weak"}>{item.accuracy >= 75 ? "stabil" : item.falseHigh ? "Scheinsicherheit" : item.accuracy >= 50 ? "unsicher" : "Lücke"}</b></div><h3>{item.topic}</h3><div className="progress-track"><span style={{ width: `${item.accuracy}%` }} /></div><p>{item.correct}/{item.total} richtig{item.falseHigh ? ` · ${item.falseHigh}× sicher falsch` : ""}</p></article>)}</div>
      <button className="primary-button result-restart" onClick={() => { setShowResult(false); if (diagnostic) setSubject("all"); }}>{tr(language,diagnostic ? "Neue Gesamtdiagnose vorbereiten" : "Neues Quiz vorbereiten",diagnostic ? "Prepare another full diagnostic" : "Prepare another quiz")} →</button>
    </section>;
  }

  if (!question) return (
    <section className="page"><PageHeading eyebrow={tr(language,"AKTIVES ABRUFEN","ACTIVE RECALL")} title="Quiz" description={tr(language,"Prüfungsfragen mit deutscher Verständnishilfe, sofortigem Feedback und persönlichem Fehlerprotokoll.","Exam questions with immediate feedback and a personal error log.")} />
      {initialTopic && <div className="active-learning-target"><span>◎</span><div><small>{tr(language,"AUS „OPTIMAL LERNEN“ VORAUSGEWÄHLT","PRESELECTED FROM OPTIMAL SESSION")}</small><strong>{subject === "portfolio" ? "Portfolio Management" : "Taxation"} · {initialTopic}</strong></div></div>}
      <div className="setup-grid three"><article className={`setup-card ${subject === "portfolio" ? "selected" : ""}`} onClick={() => { setSubject("portfolio"); onSubjectChange("portfolio"); setTopic("all"); }}><span>◎</span><h2>Portfolio Management</h2><p>{quizQuestions.filter((item) => item.subject === "portfolio").length} geprüfte Fragen</p></article><article className={`setup-card ${subject === "tax" ? "selected tax" : ""}`} onClick={() => { setSubject("tax"); onSubjectChange("tax"); setTopic("all"); }}><span>§</span><h2>Taxation</h2><p>{quizQuestions.filter((item) => item.subject === "tax").length} geprüfte Fragen</p></article><article className={`setup-card ${subject === "all" ? "selected combined" : ""}`} onClick={() => { setSubject("all"); setTopic("all"); setDiagnostic(true); }}><span>◫</span><h2>Gesamtdiagnose</h2><p>18 Fragen aus beiden Fächern</p></article></div>
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
        <div className="question-actions">{!checked ? <button className="primary-button" disabled={answer === undefined} onClick={check}>Antwort prüfen</button> : <button className="primary-button" onClick={next}>{index === session.length - 1 ? "Quiz beenden" : "Nächste Frage"} →</button>}</div>
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

  if (mode === "academy") return <PortfolioAcademy progress={progress} setProgress={setProgress} onExit={() => setMode(undefined)} onStartQuiz={(topic) => navigate("quiz", { subject: "portfolio", topic })} />;
  if (mode === "tax-prep") return <TaxExamPreparation progress={progress} setProgress={setProgress} onExit={() => setMode(undefined)} onStartDiagnostic={onStartTaxDiagnostic} />;

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

function TaxExamPreparation({ progress, setProgress, onExit, onStartDiagnostic }: { progress: AppProgress; setProgress: React.Dispatch<React.SetStateAction<AppProgress>>; onExit: () => void; onStartDiagnostic: () => void }) {
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
        <ExamAidPanel subject="tax" language={language} progress={progress} setProgress={setProgress} />
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
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← Trainingsarten</button><span>Steuerfall {Math.min(position + 1, total)} / {total}</span></div>
    <div className="tax-case-progress">{taxCase.steps.map((item, index) => <span key={item.id} className={`${index < stepIndex ? (results[index]?.correct ? "passed" : "missed") : ""} ${index === stepIndex && !done ? "active" : ""}`}><b>{index + 1}</b><small>{["Steuerart","Subjekt","Norm","Rechnung","Ergebnis"][index]}</small></span>)}</div>
    <article className="question-card lab-card tax-case-card">
      <div className="lab-title"><span className="question-type">TAXATION FALLLABOR · {taxCase.topic}</span><h1>{taxCase.title}</h1><div className="case-facts"><b>Facts</b><p>{taxCase.facts}</p></div></div>
      <ExamAidPanel subject="tax" language={language} progress={progress} setProgress={setProgress} />
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
        <div className="written-answer-workflow">
          <label className="memo-field"><b>{tr(language,"Eigene kurze Klausurantwort (2 Punkte)","Your short exam answer (2 points)")}</b><small>{tr(language,"Formuliere 3–5 Sätze nach: Problem → Norm → Anwendung/Rechnung → Ergebnis. Speichere erst deine Antwort; danach erscheint die Musterlösung.","Write 3–5 sentences using: issue → rule → application/calculation → conclusion. Save your response before viewing the model answer.")}</small><textarea disabled={memoSaved} value={memo} onChange={(event) => setMemo(event.target.value)} placeholder={tr(language,"Problematisch ist … Nach § … Im vorliegenden Fall … Daher …","The issue is … Under Sec. … In the present case … Therefore …")} rows={5}/></label>
          {!memoSaved ? <div className="written-answer-actions"><button className="secondary-button" disabled={!memo.trim()} onClick={() => setMemoSaved(true)}>{tr(language,"Antwort speichern & vergleichen","Save answer & compare")}</button><button className="text-button" onClick={() => { setMemo(""); setMemoSaved(true); setSelfScore(0); }}>{tr(language,"Ohne Freitext fortfahren","Continue without written answer")}</button></div> : <>
            <p className="saved-answer-note">✓ {memo ? tr(language,"Deine Antwort ist im Lernversuch gespeichert.","Your answer will be saved with this learning attempt.") : tr(language,"Freitext übersprungen: 0/2 Punkte.","Written response skipped: 0/2 points.")}</p>
            <details className="model-answer" open><summary>{tr(language,"Mit Musterlösung vergleichen","Compare with model answer")}</summary><p>{taxCase.modelAnswer}</p></details>
            <fieldset className="writing-self-score"><legend>{tr(language,"Wie vollständig ist deine Antwort im Vergleich?","How complete is your response?")}</legend>{[[0,tr(language,"0 Punkte · fehlt/anderer Lösungsweg","0 points · missing/different approach")],[1,tr(language,"1 Punkt · teilweise vollständig","1 point · partly complete")],[2,tr(language,"2 Punkte · Norm, Anwendung und Ergebnis enthalten","2 points · rule, application and conclusion included")]] .map(([value,label]) => <button type="button" key={value} className={selfScore === value ? "active" : ""} onClick={() => setSelfScore(value as number)}>{label}</button>)}</fieldset>
          </>}
        </div>
        <label className="exam-confidence">Wie sicher fühltest du dich?<select value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}><option value="low">niedrig</option><option value="medium">mittel</option><option value="high">hoch</option></select></label>
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
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← Trainingsarten</button><span>Rechenstrecke {Math.min(position+1,total)} / {total}</span></div>
    <div className="lab-progress">{["Formel","Variablen","Prognose","Rechnen","Deuten"].map((label,index)=><span key={label} className={index <= ["formula","variables","prediction","steps","interpretation","result"].indexOf(stage) ? "active" : ""}>{index+1}<small>{label}</small></span>)}</div>
    <article className="question-card lab-card"><div className="lab-title"><span className="question-type">RECHENLABOR · {task.topic}</span><h1>{task.title}</h1><p>{task.prompt}</p></div>
      <ExamAidPanel subject="portfolio" language={language} />
      {stage === "formula" && <><h2>1. Welches Modell brauchst du?</h2><p className="stage-intro">Wähle zuerst die passende Formel – noch ohne Zahlen einzusetzen.</p><div className="options formula-options">{task.formulaOptions.map((item,i)=><button key={item} disabled={checked} className={`${formula===i?"selected":""} ${checked&&i===0?"correct":""} ${checked&&formula===i&&i!==0?"incorrect":""}`} onClick={()=>setFormula(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>{checked&&<div className={formula===0?"feedback correct-feedback":"feedback wrong-feedback"}><b>{formula===0?"Passende Formel erkannt.":"Diese Formel beantwortet eine andere Frage."}</b><p>{task.trap}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("variables")}>Werte zuordnen →</button>:<button className="primary-button" disabled={formula===undefined} onClick={()=>mark("formula",formula===0)}>Prüfen</button>}</div></>}
      {stage === "variables" && <><h2>2. Angaben den Variablen zuordnen</h2><p className="stage-intro">Sprich jede Zeile innerlich aus. So wird aus Symbolen ein Rechenplan.</p><div className="variable-grid">{task.variables.map(item=><div key={item.symbol}><strong>{item.symbol}</strong><b>{item.value}</b><span>{item.meaning}</span></div>)}</div><div className="feedback neutral-feedback"><b>Einheiten-Check</b><p>Prozentwerte beim Rechnen konsistent als Prozent oder Dezimalzahl verwenden. Nicht innerhalb eines Rechenschritts mischen.</p></div><div className="question-actions"><button className="primary-button" onClick={()=>advance("prediction")}>Ergebnisrichtung vorhersagen →</button></div></>}
      {stage === "prediction" && <><h2>3. Was erwartest du vor dem Rechnen?</h2><p className="stage-intro">Die Prognose ist dein Plausibilitätscheck gegen Taschenrechner- und Vorzeichenfehler.</p><div className="options">{task.predictionOptions.map((item,i)=><button key={item} disabled={checked} className={`${prediction===i?"selected":""} ${checked&&i===0?"correct":""} ${checked&&prediction===i&&i!==0?"incorrect":""}`} onClick={()=>setPrediction(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>{checked&&<div className={prediction===0?"feedback correct-feedback":"feedback wrong-feedback"}><p>{task.prediction}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("steps")}>Jetzt rechnen →</button>:<button className="primary-button" disabled={prediction===undefined} onClick={()=>mark("prediction",prediction===0)}>Prognose prüfen</button>}</div></>}
      {stage === "steps" && <><h2>4. Rechenweg in kontrollierten Schritten</h2><div className="formula-strip">{task.formula}</div><div className="step-inputs">{task.steps.map((item,i)=><label key={item.label} className={checked?(stepCorrect[i]?"step-right":"step-wrong"):""}><span><b>{i+1}. {item.label}</b>{hint===i&&<small>{item.hint}</small>}</span><span className="number-field"><input inputMode="decimal" value={stepValues[i]} disabled={checked} onChange={e=>setStepValues(values=>values.map((v,x)=>x===i?e.target.value:v))} placeholder="Dein Wert"/><i>{item.unit}</i></span>{!checked&&<button type="button" className="hint-button" onClick={()=>setHint(i)}>Hinweis</button>}{checked&&!stepCorrect[i]&&<em>Richtig: {String(item.answer).replace(".",",")} {item.unit}</em>}</label>)}</div>{checked&&<div className={stepCorrect.every(Boolean)?"feedback correct-feedback":"feedback wrong-feedback"}><b>{stepCorrect.every(Boolean)?"Rechenweg vollständig korrekt.":"Der genaue Fehlerpunkt ist markiert."}</b><p>{task.trap}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("interpretation")}>Ergebnis deuten →</button>:<button className="primary-button" disabled={stepValues.some(v=>!v.trim())} onClick={()=>mark("steps",stepCorrect.every(Boolean))}>Rechenweg prüfen</button>}</div></>}
      {stage === "interpretation" && <><h2>5. Was bedeutet das Ergebnis?</h2><div className="options">{task.interpretationOptions.map((item,i)=><button key={item} disabled={checked} className={`${interpretation===i?"selected":""} ${checked&&i===0?"correct":""} ${checked&&interpretation===i&&i!==0?"incorrect":""}`} onClick={()=>setInterpretation(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>{checked&&<div className={interpretation===0?"feedback correct-feedback":"feedback wrong-feedback"}><p>{task.interpretation}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>advance("result")}>Auswertung →</button>:<button className="primary-button" disabled={interpretation===undefined} onClick={()=>mark("interpretation",interpretation===0)}>Interpretation prüfen</button>}</div></>}
      {stage === "result" && <div className="lab-result"><span className={errors.length?"result-ring needs-work":"result-ring mastered"}>{5-errors.length}<small>/ 5</small></span><h2>{errors.length?"Rechenstrecke abgeschlossen – gezielte Wiederholung eingeplant.":"Rechenstrecke sicher beherrscht."}</h2><p>{errors.length?`Noch offen: ${errors.map(e=>({formula:"Formelwahl",prediction:"Plausibilität",steps:"Rechenweg",interpretation:"Deutung"}[e])).join(", ")}. Eine neue Zahlenvariante wird über den adaptiven Plan eingeplant.`:"Du hast Modellwahl, Plausibilität, Rechnung und Interpretation verbunden."}</p><label className="exam-confidence">Wie sicher fühltest du dich?<select value={confidence} onChange={e=>setConfidence(e.target.value as Confidence)}><option value="low">niedrig</option><option value="medium">mittel</option><option value="high">hoch</option></select></label><SourceBadge source={task.source}/><button className="primary-button" onClick={()=>onComplete(errors)}>{position >= total - 1 ? tr(language,"Rechenlabor abschließen","Finish calculation lab") : tr(language,"Nächste Rechenstrecke","Next calculation")} →</button></div>}
    </article>
  </section>;
}

function ErrorBook({ progress, navigate }: { progress: AppProgress; navigate: Navigate }) {
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
      explanation: "Der Fehler bleibt offen, bis du eine neue Variante in Anwendung oder Transfer mit mindestens 70 % löst.",
      date: attempt?.completedAt ?? repair.dueAt,
      source: quizQuestions.find((item) => item.id === attempt?.activityId)?.source,
      writtenResponse: attempt?.writtenResponse,
    };
  });
  const repairPrompt=(answer:AnswerRecord)=> answer.subject==="portfolio" ? `Löse eine neue Zahlenvariante zu „${answer.topic}“. Kontrolliere besonders: ${answer.errorType??"vollständiger Rechenweg"}.` : `Prüfe einen neuen Sachverhalt zu „${answer.topic}“ mit Problem → Norm → Subsumtion/Rechnung → Ergebnis. Fokus: ${answer.errorType??"Normkette"}.`;
  const legacyItems = legacyErrors.map(({ answer, question }) => ({
    key: `${answer.subject}-${answer.topic}-${answer.errorType ?? answer.questionId}`,
    subject: answer.subject,
    topic: answer.topic,
    errorType: answer.errorType ?? "Wissenslücke" as ErrorType,
    confidence: answer.confidence,
    prompt: repairPrompt(answer),
    explanation: question?.explanation ?? `${answer.errorType??"Der Lösungsweg"} war in der letzten Anwendung noch nicht sicher.`,
    date: answer.answeredAt,
    source: question?.source,
    writtenResponse: undefined as string | undefined,
  }));
  const items = [...repairItems, ...legacyItems];
  const errorCounts = errorTypes.map((type) => ({ type, count: items.filter((item) => item.errorType === type).length })).filter((item) => item.count);
  return <section className="page"><PageHeading eyebrow="AUTOMATISCHE FEHLERKARTEN" title="Dein Fehlerbuch" description="Jeder offene Fehler wird als neue Transferaufgabe formuliert. So trainierst du die Ursache und lernst nicht nur die alte Antwort auswendig." />
    <div className="error-summary"><article className="panel"><strong>{items.length}</strong><span>offene Fehler</span></article><article className="panel"><strong>{items.filter((item) => item.confidence === "high").length}</strong><span>Scheinsicherheiten</span></article><article className="panel"><strong>{openRepairs.length}</strong><span>aktive Reparaturen</span></article></div>
    {errorCounts.length > 0 && <div className="error-chips">{errorCounts.map((item) => <span key={item.type}>{item.type} <b>{item.count}</b></span>)}</div>}
    {items.length ? <div className="review-list">{items.map((item) => <article className="review-item wrong" key={item.key}><div><span>{item.confidence === "high" ? "Scheinsicherheit" : "Wiederholen"}</span><strong>{subjectName[item.subject]} · {item.topic}</strong><b>{item.errorType}</b></div><h3>{item.prompt}</h3>{item.writtenResponse && <blockquote><b>Deine gespeicherte Klausurantwort:</b> {item.writtenResponse}</blockquote>}<p><b>Reparaturregel:</b> {item.explanation}</p><small>Neu einzuplanen · letzter Fehler am {new Date(item.date).toLocaleDateString("de-DE")}</small>{item.source&&<SourceBadge source={item.source} />}</article>)}</div> : <EmptyState>Noch keine offenen Fehler. Löse einen Diagnosetest oder eine Prüfung, damit das Fehlerbuch gezielt arbeiten kann.</EmptyState>}
    <button className="primary-button error-cta" onClick={() => items[0] ? navigate("quiz", { subject: items[0].subject, topic: items[0].topic }) : navigate("quiz")}>{items.length ? "Passende Transferaufgabe starten" : "Diagnosetest starten"} →</button>
  </section>;
}

function DailyPlan({ progress, navigate }: { progress: AppProgress; navigate: Navigate }) {
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
    { minutes: allocatedMinutes[0], title: "Fällige Fehler & Karten", detail: due ? `${due} Karte${due === 1 ? "" : "n"} sind heute fällig` : "Kurze Aktivierung aus dem Fehlerbuch", view: due ? "cards" : "errors" },
    { minutes: allocatedMinutes[1], title: first?.topic ?? "Portfolio-Rechenroutine", detail: first ? `${subjectName[first.subject]} · Lernstand ${first.mastery}%` : "CAPM, Beta und Portfoliovarianz", view: "quiz", target: first ? { subject: first.subject, topic: first.topic } : { subject: "portfolio", topic: "CAPM, SML & Beta" } },
    { minutes: allocatedMinutes[2], title: second?.topic ?? "Taxation-Fallroutine", detail: second ? `${subjectName[second.subject]} · Lernstand ${second.mastery}%` : "Norm, Tatbestand und Rechtsfolge", view: "quiz", target: second ? { subject: second.subject, topic: second.topic } : { subject: "tax", topic: "Tax Liability" } },
    { minutes: allocatedMinutes[3], title: "Gemischter Abruf", detail: "Unsicherheiten mit Sicherheitsangabe prüfen", view: "quiz" },
    { minutes: allocatedMinutes[4], title: "Formeln & Normen", detail: "Schneller Abschluss ohne Unterlagen", view: "trainer" },
  ];
  const tasks = allTasks.filter((task) => task.minutes > 0);
  return <section className="page"><PageHeading eyebrow={`${daysUntil(progress.settings.examDate)} TAGE BIS ZUR PRÜFUNG`} title={`Deine ${tasks.reduce((sum, item) => sum + item.minutes, 0)}-Minuten-Session`} description="Der Plan wird aus fälligen Wiederholungen und deinen schwächsten Themen berechnet. Neue Ergebnisse verändern automatisch die nächste Session." />
    <div className="plan-layout"><div className="plan-list">{tasks.map((task, index) => <button key={`${task.title}-${index}`} onClick={() => navigate(task.view, task.target)}><span>{String(index + 1).padStart(2,"0")}</span><div><h3>{task.title}</h3><p>{task.detail}</p></div><b>{task.minutes} Min →</b></button>)}</div>
      <aside className="panel plan-aside"><h2>Heutiger Fokus</h2><div className="plan-ring"><strong>{tasks.reduce((sum, item) => sum + item.minutes, 0)}</strong><span>Minuten</span></div><p>{first ? `Größter Hebel: ${first.topic}.` : "Starte mit der Gesamtdiagnose, damit der Plan persönlich wird."}</p><button className="primary-button" onClick={() => navigate(tasks[0].view, tasks[0].target)}>Session starten →</button></aside></div>
  </section>;
}

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

function Models({ initialSubject, navigate, onSubjectChange }: { initialSubject: Subject; navigate: Navigate; onSubjectChange: (subject: Subject) => void }) {
  const [subject, setSubject] = useState<Subject>(initialSubject);
  const [open, setOpen] = useState(modelOverviews.find((item) => item.subject === initialSubject)?.id ?? "");
  return <section className="page"><PageHeading eyebrow="MODELLE & ÜBERSICHTEN" title="Prüfungswissen als Ablauf" description="Kompakte, quellengebundene Übersichten – für Verständnis und Wiederholung, nicht als Ersatz für die Originalunterlagen." />
    <div className="subject-tabs"><button className={subject === "portfolio" ? "active" : ""} onClick={() => { setSubject("portfolio"); onSubjectChange("portfolio"); }}>Portfolio Management</button><button className={subject === "tax" ? "active" : ""} onClick={() => { setSubject("tax"); onSubjectChange("tax"); }}>Taxation</button></div>
    <div className="models-grid">{modelOverviews.filter((item) => item.subject === subject).map((model) => <article className={open === model.id ? "model-card open" : "model-card"} key={model.id}><button onClick={() => setOpen(open === model.id ? "" : model.id)}><div><span>{subject === "portfolio" ? "◎" : "§"}</span><h2>{model.title}</h2></div><b>{open === model.id ? "−" : "+"}</b></button>{open === model.id && <div className="model-content"><p>{model.summary}</p>{model.formula && <div className="formula-box">{model.formula}</div>}<h3>Prüfungs-Check</h3><ol>{model.checkpoints.map((item) => <li key={item}>{item}</li>)}</ol><SourceBadge source={model.source} /><button className="primary-button active-check" onClick={() => navigate("quiz", { subject: model.subject, topic: modelQuizTopic(model.id, model.title) })}>Wissen aktiv mit MCQs prüfen →</button><small>Das Lesen selbst gibt keine Kompetenzpunkte.</small></div>}</article>)}</div>
  </section>;
}

function Videos({ initialSubject, navigate, onSubjectChange }: { initialSubject: Subject; navigate: Navigate; onSubjectChange: (subject: Subject) => void }) {
  const [subject, setSubject] = useState<Subject>(initialSubject);
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
          <button className={subject === "portfolio" ? "active" : ""} onClick={() => { setSubject("portfolio"); onSubjectChange("portfolio"); setTopic("all"); }}>Portfolio Management</button>
          <button className={subject === "tax" ? "active" : ""} onClick={() => { setSubject("tax"); onSubjectChange("tax"); setTopic("all"); }}>Taxation</button>
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
                  <button className="secondary-button active-check" onClick={() => navigate("quiz", { subject: video.subject, topic: video.topic })}>Danach aktiv prüfen →</button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
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
