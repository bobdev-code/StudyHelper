"use client";

import { useState } from "react";
import { learningVideos } from "@/lib/data/videos";
import type { Language, Subject } from "@/lib/types";

const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;
const subjectName: Record<Subject, string> = {
  portfolio: "Portfolio Management",
  tax: "German & International Taxation",
};

export function VideosView({
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
  const [topic, setTopic] = useState("all");
  const topics = [...new Set(learningVideos.filter((video) => video.subject === subject).map((video) => video.topic))];
  const filtered = learningVideos.filter((video) => video.subject === subject && (topic === "all" || video.topic === topic));
  const grouped = topics
    .map((item) => ({ topic: item, videos: filtered.filter((video) => video.topic === item) }))
    .filter((group) => group.videos.length);

  return <section className="page video-page">
    <div className="page-heading">
      <p className="eyebrow">{tr(language, "KURATIERTE ERKLÄRVIDEOS", "CURATED EXPLAINER VIDEOS")}</p>
      <h1>{tr(language, "Video-Playlist", "Video playlist")}</h1>
      <p>{tr(language, "Pro Prüfungsthema ein gezielt ausgewähltes Kernvideo; bei rechen- oder fallintensiven Themen ergänzt um eine Vertiefung. Auswahl nach Themenpassung, fachlichem Profil und sichtbarer Resonanz.", "One carefully selected core video per exam topic, with an additional deep dive for calculation- or case-heavy topics. Selection is based on topic fit, subject expertise, and visible audience response.")}</p>
    </div>
    <div className="video-toolbar">
      <div className="subject-tabs" aria-label={tr(language, "Fach auswählen", "Choose subject")}>
        <button className={subject === "portfolio" ? "active" : ""} onClick={() => { setSubject("portfolio"); onSubjectChange("portfolio"); setTopic("all"); }}>Portfolio Management</button>
        <button className={subject === "tax" ? "active" : ""} onClick={() => { setSubject("tax"); onSubjectChange("tax"); setTopic("all"); }}>Taxation</button>
      </div>
      <label><span>{tr(language, "Thema filtern", "Filter topic")}</span><select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">{tr(language, "Alle Themen", "All topics")}</option>{topics.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <aside className="video-method" aria-label={tr(language, "Hinweis zur Auswahl", "Selection note")}>
      <span aria-hidden="true">✓</span>
      <div><strong>{tr(language, "Geprüft am 20.07.2026", "Reviewed on 20 July 2026")}</strong><p>{tr(language, "Likes und Aufrufe sind nur ein Qualitätssignal; entscheidend war die Passung zu deinen Unterlagen. Bei Steuerrecht gelten im Zweifel Kursunterlagen und aktueller Gesetzesstand.", "Likes and views are only one quality signal; fit with your course materials was decisive. For tax law, the course materials and current law prevail if in doubt.")}</p></div>
    </aside>
    <div className="video-groups">{grouped.map((group, groupIndex) => <section className="video-topic-group" key={group.topic}>
      <div className="video-topic-heading"><span>{String(groupIndex + 1).padStart(2, "0")}</span><div><p>{subjectName[subject]}</p><h2>{group.topic}</h2></div><small>{group.videos.length === 1 ? tr(language, "1 Video", "1 video") : `${group.videos.length} ${tr(language, "Videos", "videos")}`}</small></div>
      <div className="video-grid">{group.videos.map((video) => <article className="video-card" key={video.id}>
        <div className="video-card-top"><span className="video-play" aria-hidden="true">▶</span><div className="video-tags"><span>{video.level}</span><span>{video.language}</span></div></div>
        <h3>{video.title}</h3><p className="video-creator">{video.creator}</p><p className="video-reason">{video.reason}</p><div className="video-signal"><span aria-hidden="true">↗</span>{video.signal}</div>
        <a href={video.url} target="_blank" rel="noopener noreferrer" aria-label={tr(language, `${video.title} auf YouTube öffnen`, `Open ${video.title} on YouTube`)}>{tr(language, "Auf YouTube ansehen", "Watch on YouTube")} <span aria-hidden="true">↗</span></a>
        <button className="secondary-button active-check" onClick={() => navigate("quiz", { subject: video.subject, topic: video.topic })}>{tr(language, "Danach aktiv prüfen", "Test yourself afterwards")} →</button>
      </article>)}</div>
    </section>)}</div>
  </section>;
}
