"use client";

import { useMemo, useState } from "react";
import { createChainTasks, detectiveCases, formulaNodes, type ChainTask } from "@/lib/data/advancedPortfolio";
import type { AppProgress, Language, PortfolioAttempt } from "@/lib/types";
import { addLearningAttempt } from "@/lib/storage";

type Area = "home"|"chains"|"decision"|"network"|"simulator"|"detective"|"mastery";
const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;

const parseNumber = (raw: string, expectedUnit: string) => {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  const percent = cleaned.endsWith("%");
  const value = Number(cleaned.replace("%", ""));
  if (!Number.isFinite(value)) return NaN;
  if (expectedUnit === "%" && !percent && Math.abs(value) <= 1) return value * 100;
  return value;
};

function logAttempt(setProgress: React.Dispatch<React.SetStateAction<AppProgress>>, attempt: Omit<PortfolioAttempt,"id"|"completedAt">) {
  const id = `pa-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const completedAt = new Date().toISOString();
  const portfolioAttempt = { ...attempt, id, completedAt };
  const errorTypes = attempt.errorTypes.map((item) =>
    item.toLowerCase().includes("interpret") ? "Interpretation fehlt" as const
      : item.toLowerCase().includes("rechen") || item.toLowerCase().includes("einheit") ? "Rechenfehler" as const
        : "falsche Formel" as const
  );
  setProgress(current=>addLearningAttempt(
    { ...current, portfolioAttempts:[...(current.portfolioAttempts??[]), portfolioAttempt].slice(-500) },
    {
      id: `attempt-${id}`,
      activityId: attempt.taskId,
      variantId: `${attempt.taskId}-${completedAt}`,
      subject: "portfolio",
      topic: attempt.topic,
      mode: attempt.mode === "detective" ? "portfolio-detective" : "portfolio-chain",
      stage: attempt.mode === "chain" || attempt.mode === "challenge" ? "transfer" : "application",
      score: attempt.score,
      maxScore: attempt.maxScore,
      durationMs: 0,
      confidence: "medium",
      errorTypes,
      hintsUsed: 0,
      completedAt,
    },
  ));
}

const formulaTopic = (id: string) => id === "apt"
  ? "APT & Arbitrage"
  : id === "car"
    ? "EMH & Event Study"
    : ["beta", "capm", "jensen"].includes(id)
      ? "CAPM, SML & Beta"
      : ["sharpe", "treynor", "ir"].includes(id)
        ? "Performance Measures"
        : id === "mvp"
          ? "Minimum-Variance Portfolio"
          : "Diversification & Correlation";

export function PortfolioAcademy({language,progress,setProgress,onExit,onStartQuiz}:{language:Language;progress:AppProgress;setProgress:React.Dispatch<React.SetStateAction<AppProgress>>;onExit:()=>void;onStartQuiz:(topic:string)=>void}) {
  const [area,setArea]=useState<Area>("home");
  const [challengeTask,setChallengeTask]=useState<ChainTask>();
  const attempts=progress.portfolioAttempts??[];
  if(area==="chains") return <ChainTrainer language={language} setProgress={setProgress} initialTask={challengeTask} attemptMode={challengeTask?"challenge":"chain"} onBack={()=>{setChallengeTask(undefined);setArea("home")}}/>;
  if(area==="decision") return <DecisionTree language={language} onBack={()=>setArea("home")}/>;
  if(area==="network") return <FormulaNetwork language={language} onBack={()=>setArea("home")} onStartQuiz={onStartQuiz}/>;
  if(area==="simulator") return <Simulator language={language} onBack={()=>setArea("home")} onStartQuiz={onStartQuiz}/>;
  if(area==="detective") return <Detective language={language} setProgress={setProgress} onBack={()=>setArea("home")}/>;
  if(area==="mastery") return <Mastery language={language} attempts={attempts} onStartChallenge={(task)=>{setChallengeTask(task);setArea("chains")}} onBack={()=>setArea("home")}/>;
  const today=attempts.filter(x=>new Date(x.completedAt).toDateString()===new Date().toDateString()).length;
  return <section className="page academy-page">
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← {tr(language,"Fachtrainer","Subject training")}</button><span>{today} {tr(language,"Übungen heute","exercises today")}</span></div>
    <div className="page-heading"><p className="eyebrow">{tr(language,"VON DER FORMEL ZUR KLAUSURAUFGABE","FROM FORMULA TO EXAM PROBLEM")}</p><h1>{tr(language,"Portfolio-Klausurwerkstatt","Portfolio exam workshop")}</h1><p>{tr(language,"Modelle selbst erkennen, vollständige Aufgabenketten lösen, Teilpunkte sichern und deine wiederkehrenden Fehler gezielt abbauen.","Recognize models independently, solve complete problem chains, secure partial credit and target your recurring errors.")}</p></div>
    <div className="academy-grid">
      <button onClick={()=>setArea("chains")}><span>01</span><h2>{tr(language,"Gemischte Aufgabenketten","Mixed problem chains")}</h2><p>{tr(language,"Ohne Themenangabe · freies Rechenblatt · Einheitencheck · Teilpunkte · eigene Interpretation","No topic hint · scratchpad · unit check · partial credit · your own interpretation")}</p><b>{tr(language,"Klausurtraining starten","Start exam training")} →</b></button>
      <button onClick={()=>setArea("decision")}><span>02</span><h2>{tr(language,"Formel-Entscheidungsbaum","Formula decision tree")}</h2><p>{tr(language,"Von der gesuchten Größe und den Angaben zur passenden Formel – mit schrittweise ausblendbarer Hilfe.","Move from the target quantity and given inputs to the correct formula, with help that fades step by step.")}</p><b>{tr(language,"Formelwahl trainieren","Train formula selection")} →</b></button>
      <button onClick={()=>setArea("network")}><span>03</span><h2>{tr(language,"Interaktives Formelnetz","Interactive formula network")}</h2><p>{tr(language,"Inputs, Einheit, Bedeutung, typische Falle und verwandte Modelle in einem verbundenen System.","Inputs, unit, meaning, common trap and related models in one connected system.")}</p><b>{tr(language,"Zusammenhänge öffnen","Explore connections")} →</b></button>
      <button onClick={()=>setArea("simulator")}><span>04</span><h2>{tr(language,"Diversifikations- & CAPM-Simulator","Diversification & CAPM simulator")}</h2><p>{tr(language,"Korrelation, Gewichte und Beta verändern; Ergebnis und ökonomische Wirkung sofort sehen.","Change correlation, weights and beta; see the result and economic effect immediately.")}</p><b>{tr(language,"Formeln erleben","Explore formulas")} →</b></button>
      <button onClick={()=>setArea("detective")}><span>05</span><h2>{tr(language,"Fehlerdetektiv","Error detective")}</h2><p>{tr(language,"Gewichte, Kovarianz, Wurzel, Sharpe, Jensen und Beta: Markiere die erste falsche Zeile.","Weights, covariance, square root, Sharpe, Jensen and beta: mark the first incorrect line.")}</p><b>{tr(language,"Denkfehler finden","Find reasoning errors")} →</b></button>
      <button onClick={()=>setArea("mastery")}><span>06</span><h2>{tr(language,"Fehlerprofil & Mastery","Error profile & mastery")}</h2><p>{tr(language,"Tages-Challenge, persönliche Fehlerhäufigkeit und Beherrschung nach wiederholtem Abruf.","Daily challenge, personal error frequency and mastery after repeated recall.")}</p><b>{tr(language,"Deinen Stand ansehen","View your progress")} →</b></button>
    </div>
  </section>;
}

function ChainTrainer({language,setProgress,onBack,initialTask,attemptMode}:{language:Language;setProgress:React.Dispatch<React.SetStateAction<AppProgress>>;onBack:()=>void;initialTask?:ChainTask;attemptMode:"chain"|"challenge"}) {
  const [tasks,setTasks]=useState(()=>initialTask?[initialTask]:createChainTasks()); const [index,setIndex]=useState(0); const [values,setValues]=useState<string[]>([]);
  const [sheet,setSheet]=useState(""); const [interpretation,setInterpretation]=useState(""); const [submitted,setSubmitted]=useState(false); const [showFormula,setShowFormula]=useState(false);
  const task=tasks[index%tasks.length];
  const answers=task.steps.map((s,i)=>parseNumber(values[i]??"",s.unit));
  const correct=task.steps.map((s,i)=>Number.isFinite(answers[i])&&Math.abs(answers[i]-s.answer)<=(s.tolerance??Math.max(.02,Math.abs(s.answer)*.006)));
  const keywordHits=task.interpretationKeywords.filter(k=>interpretation.toLowerCase().includes(k)).length;
  const score=task.steps.reduce((sum,s,i)=>sum+(correct[i]?s.points:0),0)+(keywordHits>=task.interpretationKeywords.length?2:keywordHits);
  const next=()=>{if(attemptMode==="challenge"){onBack();return}setTasks(current=>[...current,...(score<task.totalPoints*.7?createChainTasks(Date.now()).filter(x=>x.id===task.id):[])]);setIndex(i=>i+1);setValues([]);setSheet("");setInterpretation("");setSubmitted(false);setShowFormula(false)};
  const submit=()=>{setSubmitted(true);logAttempt(setProgress,{taskId:task.id,topic:task.topic,mode:attemptMode,score,maxScore:task.totalPoints,errorTypes:[...(!correct.every(Boolean)?["Rechenweg/Einheit"]:[]),...(keywordHits<task.interpretationKeywords.length?["Interpretation"]:[])]})};
  return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← {tr(language,"Klausurwerkstatt","Exam workshop")}</button><span>{attemptMode==="challenge"?tr(language,"Tages-Challenge","Daily challenge"):tr(language,`Gemischter Fall ${index+1} / ${tasks.length}`,`Mixed case ${index+1} / ${tasks.length}`)}</span></div>
    <article className="question-card chain-card"><span className="question-type">{attemptMode==="challenge"?tr(language,"TAGES-CHALLENGE","DAILY CHALLENGE"):tr(language,"THEMA NICHT ANGEGEBEN","TOPIC NOT GIVEN")} · {task.totalPoints} {tr(language,"PUNKTE","POINTS")}</span><h1>{task.prompt}</h1>
      <div className="exam-tools"><button className="secondary-button" onClick={()=>setShowFormula(v=>!v)}>{showFormula?tr(language,"Formelblatt schließen","Close formula sheet"):tr(language,"Formelblatt öffnen","Open formula sheet")}</button><span>{tr(language,"Eingaben: 7,07% · 7.07 · 0,0707 werden passend erkannt","Inputs 7.07% · 7.07 · 0.0707 are recognized correctly")}</span></div>
      {showFormula&&<div className="formula-sheet">{formulaNodes.map(n=><div key={n.id}><b>{n.title}</b><code>{n.formula}</code></div>)}</div>}
      <label className="scratchpad"><b>{tr(language,"Freies Rechenblatt","Scratchpad")}</b><textarea value={sheet} onChange={e=>setSheet(e.target.value)} placeholder={tr(language,"Ansatz, Zwischenschritte und Notizen – dieses Feld wird nicht automatisch bewertet.","Setup, intermediate steps and notes – this field is not graded automatically.")}/></label>
      <div className="chain-answers">{task.steps.map((step,i)=><label key={step.label} className={submitted?(correct[i]?"right":"wrong"):""}><span><b>{step.label}</b><small>{step.points} P · {step.unit||tr(language,"ohne Einheit","no unit")}</small></span><input disabled={submitted} inputMode="decimal" value={values[i]??""} onChange={e=>setValues(v=>task.steps.map((_,x)=>x===i?e.target.value:(v[x]??"")))} placeholder={tr(language,"Ergebnis","Result")}/>{submitted&&!correct[i]&&<em>{tr(language,"Lösung","Solution")}: {String(step.answer).replace(".",",")} {step.unit}</em>}</label>)}</div>
      <label className="scratchpad interpretation-box"><b>{tr(language,"Ergebnis in eigenen Worten interpretieren","Interpret the result in your own words")}</b><textarea disabled={submitted} value={interpretation} onChange={e=>setInterpretation(e.target.value)} placeholder={tr(language,"Was bedeutet das Ergebnis ökonomisch?","What does the result mean economically?")}/></label>
      {submitted&&<div className="chain-result"><strong>{score} / {task.totalPoints} Punkte</strong><div><b>{task.model}</b><code>{task.formula}</code><p>{task.interpretation}</p></div><ul>{task.steps.map((s,i)=><li key={s.label} className={correct[i]?"ok":"miss"}>{correct[i]?"✓":"×"} {s.label}: {correct[i]?`${s.points} P`:`0/${s.points} P · ${s.hint}`}</li>)}<li className={keywordHits>=task.interpretationKeywords.length?"ok":"miss"}>{keywordHits>=task.interpretationKeywords.length?"✓ 2 P Interpretation":`${keywordHits}/2 P Interpretation · Kernbegriffe: ${task.interpretationKeywords.join(", ")}`}</li></ul></div>}
      <div className="question-actions">{submitted?<button className="primary-button" onClick={next}>{attemptMode==="challenge"?tr(language,"Challenge abschließen","Finish challenge"):tr(language,"Nächster unbekannter Fall","Next unseen case")} →</button>:<button className="primary-button" disabled={values.some(v=>!v?.trim())||values.length<task.steps.length||!interpretation.trim()} onClick={submit}>{tr(language,"Abgeben und Teilpunkte berechnen","Submit and calculate partial credit")}</button>}</div>
    </article></section>;
}

function DecisionTree({language,onBack}:{language:Language;onBack:()=>void}) {
  const [goal,setGoal]=useState(""); const [risk,setRisk]=useState(""); const [benchmark,setBenchmark]=useState("");
  const matches=formulaNodes.filter(n=>(!goal||n.group===goal)&&(!risk||(risk==="beta"?n.inputs.toLowerCase().includes("beta"):n.inputs.toLowerCase().includes("standardabweichung")||n.inputs.toLowerCase().includes("volatil")))&&(!benchmark||(benchmark==="market"?/[Cc][Aa][Pp][Mm]|SML|Markt/.test(n.meaning+n.inputs):/Benchmark|Tracking/.test(n.inputs+n.meaning))));
  return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← {tr(language,"Klausurwerkstatt","Exam workshop")}</button><span>{tr(language,"Formelwahl","Formula selection")}</span></div><div className="page-heading"><p className="eyebrow">{tr(language,"MENTALER ENTSCHEIDUNGSBAUM","MENTAL DECISION TREE")}</p><h1>{tr(language,"Welche Formel passt?","Which formula fits?")}</h1><p>{tr(language,"Beantworte nur Fragen, die der Sachverhalt hergibt. Die Trefferliste wird enger; im Mastery-Modus musst du diesen Weg später ohne Hilfe gehen.","Answer only questions supported by the facts. The candidate list narrows; in mastery mode you will later follow this path without help.")}</p></div>
    <div className="decision-grid"><label><b>1. {tr(language,"Was wird gesucht?","What is required?")}</b><select value={goal} onChange={e=>setGoal(e.target.value)}><option value="">{tr(language,"Noch offen","Still open")}</option><option>Portfolio</option><option>{tr(language,"Kapitalmarkt","Capital market")}</option><option>Performance</option><option>Event Study</option></select></label><label><b>2. {tr(language,"Welche Risikogröße ist gegeben?","Which risk measure is given?")}</b><select value={risk} onChange={e=>setRisk(e.target.value)}><option value="">{tr(language,"Nicht entscheidend","Not decisive")}</option><option value="beta">Beta / {tr(language,"systematisches Risiko","systematic risk")}</option><option value="vol">{tr(language,"Volatilität / Gesamtrisiko","Volatility / total risk")}</option></select></label><label><b>3. {tr(language,"Gibt es einen Vergleich?","Is there a comparison?")}</b><select value={benchmark} onChange={e=>setBenchmark(e.target.value)}><option value="">{tr(language,"Keinen / offen","None / open")}</option><option value="market">{tr(language,"Markt / SML","Market / SML")}</option><option value="benchmark">Benchmark / Tracking Error</option></select></label></div>
    <div className="decision-results"><p>{matches.length} {tr(language,"passende Kandidaten","matching candidates")}</p>{matches.map(n=><article key={n.id}><span>{n.group}</span><h2>{n.title}</h2><code>{n.formula}</code><p><b>{tr(language,"Warum","Why")}:</b> {n.asks}. {n.meaning}.</p></article>)}</div></section>;
}

function FormulaNetwork({language,onBack,onStartQuiz}:{language:Language;onBack:()=>void;onStartQuiz:(topic:string)=>void}) {
 const [selected,setSelected]=useState(formulaNodes[0].id); const node=formulaNodes.find(n=>n.id===selected)!;
 return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← {tr(language,"Klausurwerkstatt","Exam workshop")}</button><span>11 {tr(language,"verbundene Modelle","connected models")}</span></div><div className="page-heading"><p className="eyebrow">{tr(language,"FORMELNETZ STATT FORMELLISTE","FORMULA NETWORK INSTEAD OF A LIST")}</p><h1>{tr(language,"Wie die Modelle zusammenhängen","How the models connect")}</h1><p>{tr(language,"Wähle einen Knoten. Verwandte Modelle werden hervorgehoben und erklären, welche Größe jeweils ersetzt oder weiterverwendet wird.","Select a node. Related models are highlighted and show which quantity is replaced or reused.")}</p></div>
 <div className="formula-network"><div className="network-nodes">{[...new Set(formulaNodes.map(n=>n.group))].map(g=><section key={g}><h3>{g}</h3>{formulaNodes.filter(n=>n.group===g).map(n=><button className={`${selected===n.id?"selected":""} ${node.related.includes(n.id)?"related":""}`} onClick={()=>setSelected(n.id)} key={n.id}>{n.title}<small>{n.asks}</small></button>)}</section>)}</div><article className="node-detail"><span>{node.group}</span><h2>{node.title}</h2><code>{node.formula}</code><dl><div><dt>{tr(language,"Gesucht","Target")}</dt><dd>{node.asks}</dd></div><div><dt>Inputs</dt><dd>{node.inputs}</dd></div><div><dt>{tr(language,"Bedeutung","Meaning")}</dt><dd>{node.meaning}</dd></div><div><dt>{tr(language,"Einheit","Unit")}</dt><dd>{node.unit}</dd></div><div><dt>{tr(language,"Typische Falle","Common trap")}</dt><dd>{node.trap}</dd></div></dl><div className="related-chips">{tr(language,"Verwandt","Related")}: {node.related.map(id=><button key={id} onClick={()=>setSelected(id)}>{formulaNodes.find(n=>n.id===id)?.title}</button>)}</div><button className="primary-button active-check" onClick={()=>onStartQuiz(formulaTopic(node.id))}>{tr(language,"Dieses Modell aktiv mit MCQs prüfen","Test this model actively with MCQs")} →</button><small>{tr(language,"Das Ansehen verändert deinen Lernstand nicht; erst beantwortete Fragen zählen.","Viewing does not change your mastery; only answered questions count.")}</small></article></div></section>;
}

function Simulator({language,onBack,onStartQuiz}:{language:Language;onBack:()=>void;onStartQuiz:(topic:string)=>void}) {
 const [w,setW]=useState(.5),[rho,setRho]=useState(0),[beta,setBeta]=useState(1),[rf,setRf]=useState(3),[rm,setRm]=useState(9); const s1=10,s2=15;
 const vol=Math.sqrt(w*w*s1*s1+(1-w)*(1-w)*s2*s2+2*w*(1-w)*rho*s1*s2); const capm=rf+beta*(rm-rf);
 const curve=Array.from({length:21},(_,i)=>{const x=i/20;return {x,y:Math.sqrt(x*x*s1*s1+(1-x)*(1-x)*s2*s2+2*x*(1-x)*rho*s1*s2)}}); const maxY=18;
 return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← {tr(language,"Klausurwerkstatt","Exam workshop")}</button><span>{tr(language,"Was passiert, wenn …?","What happens if …?")}</span></div><div className="page-heading"><p className="eyebrow">{tr(language,"INTERAKTIVER PLAUSIBILITÄTSCHECK","INTERACTIVE PLAUSIBILITY CHECK")}</p><h1>{tr(language,"Diversifikation & CAPM erleben","Explore diversification & CAPM")}</h1><p>{tr(language,"Verändere einen Input und formuliere zuerst innerlich die erwartete Richtung. Die Kurve und Kennzahlen reagieren sofort.","Change one input and first predict the direction. The curve and metrics respond immediately.")}</p></div>
 <div className="sim-grid"><article className="panel"><h2>Zwei-Asset-Portfolio</h2><label>Gewicht Asset A <b>{Math.round(w*100)}%</b><input type="range" min="0" max="1" step=".05" value={w} onChange={e=>setW(+e.target.value)}/></label><label>Korrelation ρ <b>{rho.toFixed(1)}</b><input type="range" min="-1" max="1" step=".1" value={rho} onChange={e=>setRho(+e.target.value)}/></label><svg viewBox="0 0 420 180" role="img" aria-label="Portfoliovolatilität nach Gewicht"><polyline points={curve.map(p=>`${20+p.x*380},${165-p.y/maxY*140}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="5"/><line x1="20" y1="165" x2="400" y2="165" stroke="currentColor" opacity=".25"/></svg><div className="sim-output"><strong>{vol.toFixed(2)}%</strong><span>Portfolio-Volatilität</span></div><p>{rho===1?"Bei ρ=1 verschwindet der reine Diversifikationseffekt.":rho<0?"Negative Korrelation verstärkt die Risikoreduktion.":"Nicht perfekte Korrelation reduziert Risiko gegenüber reinem Gleichlauf."}</p></article>
 <article className="panel"><h2>Security Market Line</h2><label>Beta <b>{beta.toFixed(1)}</b><input type="range" min="0" max="2" step=".1" value={beta} onChange={e=>setBeta(+e.target.value)}/></label><label>Risikofreier Zins <b>{rf}%</b><input type="range" min="0" max="7" step=".5" value={rf} onChange={e=>setRf(+e.target.value)}/></label><label>Marktrendite <b>{rm}%</b><input type="range" min="7" max="15" step=".5" value={rm} onChange={e=>setRm(+e.target.value)}/></label><div className="sml-chart"><span style={{left:`${beta/2*88+6}%`,bottom:`${Math.min(90,capm/16*80+5)}%`}}/><i/></div><div className="sim-output"><strong>{capm.toFixed(2)}%</strong><span>CAPM-Rendite</span></div><p>Steilere SML bei größerer Marktrisikoprämie; Beta bewegt das Asset entlang der Linie.</p></article></div><div className="sim-active-checks"><button className="primary-button" onClick={()=>onStartQuiz("Diversification & Correlation")}>Diversifikation aktiv prüfen →</button><button className="primary-button" onClick={()=>onStartQuiz("CAPM, SML & Beta")}>CAPM aktiv prüfen →</button><small>Slider und Diagramme sind Erklärung; nur die anschließende bewertete Aufgabe verändert den Lernstand.</small></div></section>;
}

function Detective({language,setProgress,onBack}:{language:Language;setProgress:React.Dispatch<React.SetStateAction<AppProgress>>;onBack:()=>void}) {
 const [index,setIndex]=useState(0),[selected,setSelected]=useState<number>(),[checked,setChecked]=useState(false); const item=detectiveCases[index%detectiveCases.length];
 const submit=()=>{setChecked(true);logAttempt(setProgress,{taskId:item.id,topic:"Typische Rechenfehler",mode:"detective",score:selected===item.wrong?1:0,maxScore:1,errorTypes:selected===item.wrong?[]:[item.title]})};
 return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← {tr(language,"Klausurwerkstatt","Exam workshop")}</button><span>{tr(language,"Fall","Case")} {index+1} / {detectiveCases.length}</span></div><article className="question-card detective"><span className="question-type">{tr(language,"FEHLERDETEKTIV","ERROR DETECTIVE")}</span><h1>{item.title}</h1><p>{tr(language,"Markiere die erste fachlich falsche Zeile.","Mark the first technically incorrect line.")}</p><div className="solution-lines">{item.lines.map((line,i)=><button disabled={checked} className={`${selected===i?"selected":""} ${checked&&i===item.wrong?"correct":""} ${checked&&selected===i&&i!==item.wrong?"incorrect":""}`} onClick={()=>setSelected(i)} key={line}><span>{i+1}</span><code>{line}</code></button>)}</div>{checked&&<div className={selected===item.wrong?"feedback correct-feedback":"feedback wrong-feedback"}><b>{selected===item.wrong?tr(language,"Erste falsche Zeile erkannt.","First incorrect line identified."):tr(language,"Die frühere Ursache liegt an einer anderen Stelle.","The earlier cause is elsewhere.")}</b><p>{item.why}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>{setIndex(i=>i+1);setSelected(undefined);setChecked(false)}}>{tr(language,"Nächster Fehler","Next error")} →</button>:<button className="primary-button" disabled={selected===undefined} onClick={submit}>{tr(language,"Zeile prüfen","Check line")}</button>}</div></article></section>;
}

function Mastery({language,attempts,onStartChallenge,onBack}:{language:Language;attempts:PortfolioAttempt[];onStartChallenge:(task:ChainTask)=>void;onBack:()=>void}) {
 const topics=useMemo(()=>[...new Set(createChainTasks(1).map(t=>t.topic))].map(topic=>{const rows=attempts.filter(a=>a.topic===topic);const recent=rows.slice(-5);const score=recent.reduce((s,a)=>s+a.score,0),max=recent.reduce((s,a)=>s+a.maxScore,0);const days=new Set(rows.map(a=>new Date(a.completedAt).toDateString())).size;return {topic,attempts:rows.length,accuracy:max?Math.round(score/max*100):0,days,mastered:rows.length>=3&&days>=2&&max>0&&score/max>=.8}}),[attempts]);
 const errors=Object.entries(attempts.flatMap(a=>a.errorTypes).reduce<Record<string,number>>((acc,e)=>(acc[e]=(acc[e]??0)+1,acc),{})).sort((a,b)=>b[1]-a[1]); const challenge=createChainTasks(new Date().getDate())[new Date().getDate()%5]; const completedToday=[...attempts].reverse().find(item=>item.mode==="challenge"&&new Date(item.completedAt).toDateString()===new Date().toDateString());
 return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← {tr(language,"Klausurwerkstatt","Exam workshop")}</button><span>{attempts.length} {tr(language,"protokollierte Versuche","recorded attempts")}</span></div><div className="page-heading"><p className="eyebrow">{tr(language,"NICHT EINMAL RICHTIG, SONDERN DAUERHAFT ABRUFBAR","NOT RIGHT ONCE, BUT RETRIEVABLE OVER TIME")}</p><h1>{tr(language,"Fehlerprofil & Mastery","Error profile & mastery")}</h1><p>{tr(language,"Beherrscht bedeutet: mindestens drei Versuche, an mindestens zwei Tagen und zuletzt mindestens 80% der Teilpunkte.","Mastered means at least three attempts across at least two days and at least 80% of the latest partial credit.")}</p></div>
 <div className="mastery-layout"><article className="panel challenge"><span>{tr(language,"TAGES-CHALLENGE","DAILY CHALLENGE")}</span><h2>{challenge.prompt}</h2><p>{tr(language,"Unbekannter Aufgabentyp","Unseen problem type")} · {challenge.totalPoints} {tr(language,"Punkte","points")} · {tr(language,"Zielzeit 12 Minuten","target time 12 minutes")}</p>{completedToday&&<strong>{tr(language,"Heute erreicht","Achieved today")}: {completedToday.score}/{completedToday.maxScore} {tr(language,"Punkte","points")}</strong>}<button className="primary-button" onClick={()=>onStartChallenge(challenge)}>{completedToday?tr(language,"Challenge erneut lösen","Repeat challenge"):tr(language,"Challenge jetzt lösen","Solve challenge now")} →</button><small>{tr(language,"Ein Versuch wird erst nach deiner tatsächlichen Abgabe gespeichert.","An attempt is saved only after your actual submission.")}</small></article><article className="panel"><h2>{tr(language,"Häufigste Rechenmuster","Most frequent calculation patterns")}</h2>{errors.length?errors.slice(0,6).map(([e,n])=><div className="error-bar" key={e}><span>{e}</span><div><i style={{width:`${Math.min(100,n/(errors[0][1] as number)*100)}%`}}/></div><b>{n}×</b></div>):<p>{tr(language,"Noch kein Fehlerprofil. Löse eine Aufgabenkette oder einen Fehlerdetektiv.","No error profile yet. Solve a problem chain or error detective.")}</p>}</article></div>
 <div className="mastery-grid">{topics.map(t=><article key={t.topic} className={t.mastered?"mastered":""}><span>{t.mastered?tr(language,"BEHERRSCHT","MASTERED"):t.attempts?tr(language,"IM AUFBAU","DEVELOPING"):tr(language,"NEU","NEW")}</span><h3>{t.topic}</h3><div className="progress-track"><i style={{width:`${t.accuracy}%`}}/></div><p>{t.accuracy}% · {t.attempts} {tr(language,"Versuche","attempts")} · {t.days} {tr(language,"Lerntage","study days")}</p></article>)}</div></section>;
}
