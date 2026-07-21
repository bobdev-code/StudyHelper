"use client";

import { useMemo, useState } from "react";
import { createChainTasks, detectiveCases, formulaNodes } from "@/lib/data/advancedPortfolio";
import type { AppProgress, PortfolioAttempt } from "@/lib/types";

type Area = "home"|"chains"|"decision"|"network"|"simulator"|"detective"|"mastery";

const parseNumber = (raw: string, expectedUnit: string) => {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  const percent = cleaned.endsWith("%");
  const value = Number(cleaned.replace("%", ""));
  if (!Number.isFinite(value)) return NaN;
  if (expectedUnit === "%" && !percent && Math.abs(value) <= 1) return value * 100;
  return value;
};

function logAttempt(setProgress: React.Dispatch<React.SetStateAction<AppProgress>>, attempt: Omit<PortfolioAttempt,"id"|"completedAt">) {
  setProgress(current=>({...current,portfolioAttempts:[...(current.portfolioAttempts??[]),{...attempt,id:`pa-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,completedAt:new Date().toISOString()}].slice(-500)}));
}

export function PortfolioAcademy({progress,setProgress,onExit}:{progress:AppProgress;setProgress:React.Dispatch<React.SetStateAction<AppProgress>>;onExit:()=>void}) {
  const [area,setArea]=useState<Area>("home");
  const attempts=progress.portfolioAttempts??[];
  if(area==="chains") return <ChainTrainer setProgress={setProgress} onBack={()=>setArea("home")}/>;
  if(area==="decision") return <DecisionTree onBack={()=>setArea("home")}/>;
  if(area==="network") return <FormulaNetwork onBack={()=>setArea("home")}/>;
  if(area==="simulator") return <Simulator onBack={()=>setArea("home")}/>;
  if(area==="detective") return <Detective setProgress={setProgress} onBack={()=>setArea("home")}/>;
  if(area==="mastery") return <Mastery attempts={attempts} setProgress={setProgress} onBack={()=>setArea("home")}/>;
  const today=attempts.filter(x=>new Date(x.completedAt).toDateString()===new Date().toDateString()).length;
  return <section className="page academy-page">
    <div className="trainer-head"><button className="text-button" onClick={onExit}>← Fachtrainer</button><span>{today} Übungen heute</span></div>
    <div className="page-heading"><p className="eyebrow">VON DER FORMEL ZUR KLAUSURAUFGABE</p><h1>Portfolio-Klausurwerkstatt</h1><p>Modelle selbst erkennen, vollständige Aufgabenketten lösen, Teilpunkte sichern und deine wiederkehrenden Fehler gezielt abbauen.</p></div>
    <div className="academy-grid">
      <button onClick={()=>setArea("chains")}><span>01</span><h2>Gemischte Aufgabenketten</h2><p>Ohne Themenangabe · freies Rechenblatt · Einheitencheck · Teilpunkte · eigene Interpretation</p><b>Klausurtraining starten →</b></button>
      <button onClick={()=>setArea("decision")}><span>02</span><h2>Formel-Entscheidungsbaum</h2><p>Von der gesuchten Größe und den Angaben zur passenden Formel – mit schrittweise ausblendbarer Hilfe.</p><b>Formelwahl trainieren →</b></button>
      <button onClick={()=>setArea("network")}><span>03</span><h2>Interaktives Formelnetz</h2><p>Inputs, Einheit, Bedeutung, typische Falle und verwandte Modelle in einem verbundenen System.</p><b>Zusammenhänge öffnen →</b></button>
      <button onClick={()=>setArea("simulator")}><span>04</span><h2>Diversifikations- & CAPM-Simulator</h2><p>Korrelation, Gewichte und Beta verändern; Ergebnis und ökonomische Wirkung sofort sehen.</p><b>Formeln erleben →</b></button>
      <button onClick={()=>setArea("detective")}><span>05</span><h2>Fehlerdetektiv</h2><p>Gewichte, Kovarianz, Wurzel, Sharpe, Jensen und Beta: Markiere die erste falsche Zeile.</p><b>Denkfehler finden →</b></button>
      <button onClick={()=>setArea("mastery")}><span>06</span><h2>Fehlerprofil & Mastery</h2><p>Tages-Challenge, persönliche Fehlerhäufigkeit und Beherrschung nach wiederholtem Abruf.</p><b>Deinen Stand ansehen →</b></button>
    </div>
  </section>;
}

function ChainTrainer({setProgress,onBack}:{setProgress:React.Dispatch<React.SetStateAction<AppProgress>>;onBack:()=>void}) {
  const [tasks,setTasks]=useState(()=>createChainTasks()); const [index,setIndex]=useState(0); const [values,setValues]=useState<string[]>([]);
  const [sheet,setSheet]=useState(""); const [interpretation,setInterpretation]=useState(""); const [submitted,setSubmitted]=useState(false); const [showFormula,setShowFormula]=useState(false);
  const task=tasks[index%tasks.length];
  const answers=task.steps.map((s,i)=>parseNumber(values[i]??"",s.unit));
  const correct=task.steps.map((s,i)=>Number.isFinite(answers[i])&&Math.abs(answers[i]-s.answer)<=(s.tolerance??Math.max(.02,Math.abs(s.answer)*.006)));
  const keywordHits=task.interpretationKeywords.filter(k=>interpretation.toLowerCase().includes(k)).length;
  const score=task.steps.reduce((sum,s,i)=>sum+(correct[i]?s.points:0),0)+(keywordHits>=task.interpretationKeywords.length?2:keywordHits);
  const next=()=>{setTasks(current=>[...current,...(score<task.totalPoints*.7?createChainTasks(Date.now()).filter(x=>x.id===task.id):[])]);setIndex(i=>i+1);setValues([]);setSheet("");setInterpretation("");setSubmitted(false);setShowFormula(false)};
  const submit=()=>{setSubmitted(true);logAttempt(setProgress,{taskId:task.id,topic:task.topic,mode:"chain",score,maxScore:task.totalPoints,errorTypes:[...(!correct.every(Boolean)?["Rechenweg/Einheit"]:[]),...(keywordHits<task.interpretationKeywords.length?["Interpretation"]:[])]})};
  return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← Klausurwerkstatt</button><span>Gemischter Fall {index+1} / {tasks.length}</span></div>
    <article className="question-card chain-card"><span className="question-type">THEMA NICHT ANGEGEBEN · {task.totalPoints} PUNKTE</span><h1>{task.prompt}</h1>
      <div className="exam-tools"><button className="secondary-button" onClick={()=>setShowFormula(v=>!v)}>{showFormula?"Formelblatt schließen":"Formelblatt öffnen"}</button><span>Eingaben: 7,07% · 7.07 · 0,0707 werden passend erkannt</span></div>
      {showFormula&&<div className="formula-sheet">{formulaNodes.map(n=><div key={n.id}><b>{n.title}</b><code>{n.formula}</code></div>)}</div>}
      <label className="scratchpad"><b>Freies Rechenblatt</b><textarea value={sheet} onChange={e=>setSheet(e.target.value)} placeholder="Ansatz, Zwischenschritte und Notizen – dieses Feld wird nicht automatisch bewertet."/></label>
      <div className="chain-answers">{task.steps.map((step,i)=><label key={step.label} className={submitted?(correct[i]?"right":"wrong"):""}><span><b>{step.label}</b><small>{step.points} P · {step.unit||"ohne Einheit"}</small></span><input disabled={submitted} inputMode="decimal" value={values[i]??""} onChange={e=>setValues(v=>task.steps.map((_,x)=>x===i?e.target.value:(v[x]??"")))} placeholder="Ergebnis"/>{submitted&&!correct[i]&&<em>Lösung: {String(step.answer).replace(".",",")} {step.unit}</em>}</label>)}</div>
      <label className="scratchpad interpretation-box"><b>Ergebnis in eigenen Worten interpretieren</b><textarea disabled={submitted} value={interpretation} onChange={e=>setInterpretation(e.target.value)} placeholder="Was bedeutet das Ergebnis ökonomisch?"/></label>
      {submitted&&<div className="chain-result"><strong>{score} / {task.totalPoints} Punkte</strong><div><b>{task.model}</b><code>{task.formula}</code><p>{task.interpretation}</p></div><ul>{task.steps.map((s,i)=><li key={s.label} className={correct[i]?"ok":"miss"}>{correct[i]?"✓":"×"} {s.label}: {correct[i]?`${s.points} P`:`0/${s.points} P · ${s.hint}`}</li>)}<li className={keywordHits>=task.interpretationKeywords.length?"ok":"miss"}>{keywordHits>=task.interpretationKeywords.length?"✓ 2 P Interpretation":`${keywordHits}/2 P Interpretation · Kernbegriffe: ${task.interpretationKeywords.join(", ")}`}</li></ul></div>}
      <div className="question-actions">{submitted?<button className="primary-button" onClick={next}>Nächster unbekannter Fall →</button>:<button className="primary-button" disabled={values.some(v=>!v?.trim())||values.length<task.steps.length||!interpretation.trim()} onClick={submit}>Abgeben und Teilpunkte berechnen</button>}</div>
    </article></section>;
}

function DecisionTree({onBack}:{onBack:()=>void}) {
  const [goal,setGoal]=useState(""); const [risk,setRisk]=useState(""); const [benchmark,setBenchmark]=useState("");
  const matches=formulaNodes.filter(n=>(!goal||n.group===goal)&&(!risk||(risk==="beta"?n.inputs.toLowerCase().includes("beta"):n.inputs.toLowerCase().includes("standardabweichung")||n.inputs.toLowerCase().includes("volatil")))&&(!benchmark||(benchmark==="market"?/[Cc][Aa][Pp][Mm]|SML|Markt/.test(n.meaning+n.inputs):/Benchmark|Tracking/.test(n.inputs+n.meaning))));
  return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← Klausurwerkstatt</button><span>Formelwahl</span></div><div className="page-heading"><p className="eyebrow">MENTALER ENTSCHEIDUNGSBAUM</p><h1>Welche Formel passt?</h1><p>Beantworte nur Fragen, die der Sachverhalt hergibt. Die Trefferliste wird enger; im Mastery-Modus musst du diesen Weg später ohne Hilfe gehen.</p></div>
    <div className="decision-grid"><label><b>1. Was wird gesucht?</b><select value={goal} onChange={e=>setGoal(e.target.value)}><option value="">Noch offen</option><option>Portfolio</option><option>Kapitalmarkt</option><option>Performance</option><option>Event Study</option></select></label><label><b>2. Welche Risikogröße ist gegeben?</b><select value={risk} onChange={e=>setRisk(e.target.value)}><option value="">Nicht entscheidend</option><option value="beta">Beta / systematisches Risiko</option><option value="vol">Volatilität / Gesamtrisiko</option></select></label><label><b>3. Gibt es einen Vergleich?</b><select value={benchmark} onChange={e=>setBenchmark(e.target.value)}><option value="">Keinen / offen</option><option value="market">Markt / SML</option><option value="benchmark">Benchmark / Tracking Error</option></select></label></div>
    <div className="decision-results"><p>{matches.length} passende Kandidaten</p>{matches.map(n=><article key={n.id}><span>{n.group}</span><h2>{n.title}</h2><code>{n.formula}</code><p><b>Warum:</b> {n.asks}. {n.meaning}.</p></article>)}</div></section>;
}

function FormulaNetwork({onBack}:{onBack:()=>void}) {
 const [selected,setSelected]=useState(formulaNodes[0].id); const node=formulaNodes.find(n=>n.id===selected)!;
 return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← Klausurwerkstatt</button><span>11 verbundene Modelle</span></div><div className="page-heading"><p className="eyebrow">FORMELNETZ STATT FORMELLISTE</p><h1>Wie die Modelle zusammenhängen</h1><p>Wähle einen Knoten. Verwandte Modelle werden hervorgehoben und erklären, welche Größe jeweils ersetzt oder weiterverwendet wird.</p></div>
 <div className="formula-network"><div className="network-nodes">{[...new Set(formulaNodes.map(n=>n.group))].map(g=><section key={g}><h3>{g}</h3>{formulaNodes.filter(n=>n.group===g).map(n=><button className={`${selected===n.id?"selected":""} ${node.related.includes(n.id)?"related":""}`} onClick={()=>setSelected(n.id)} key={n.id}>{n.title}<small>{n.asks}</small></button>)}</section>)}</div><article className="node-detail"><span>{node.group}</span><h2>{node.title}</h2><code>{node.formula}</code><dl><div><dt>Gesucht</dt><dd>{node.asks}</dd></div><div><dt>Inputs</dt><dd>{node.inputs}</dd></div><div><dt>Bedeutung</dt><dd>{node.meaning}</dd></div><div><dt>Einheit</dt><dd>{node.unit}</dd></div><div><dt>Typische Falle</dt><dd>{node.trap}</dd></div></dl><div className="related-chips">Verwandt: {node.related.map(id=><button key={id} onClick={()=>setSelected(id)}>{formulaNodes.find(n=>n.id===id)?.title}</button>)}</div></article></div></section>;
}

function Simulator({onBack}:{onBack:()=>void}) {
 const [w,setW]=useState(.5),[rho,setRho]=useState(0),[beta,setBeta]=useState(1),[rf,setRf]=useState(3),[rm,setRm]=useState(9); const s1=10,s2=15;
 const vol=Math.sqrt(w*w*s1*s1+(1-w)*(1-w)*s2*s2+2*w*(1-w)*rho*s1*s2); const capm=rf+beta*(rm-rf);
 const curve=Array.from({length:21},(_,i)=>{const x=i/20;return {x,y:Math.sqrt(x*x*s1*s1+(1-x)*(1-x)*s2*s2+2*x*(1-x)*rho*s1*s2)}}); const maxY=18;
 return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← Klausurwerkstatt</button><span>Was passiert, wenn …?</span></div><div className="page-heading"><p className="eyebrow">INTERAKTIVER PLAUSIBILITÄTSCHECK</p><h1>Diversifikation & CAPM erleben</h1><p>Verändere einen Input und formuliere zuerst innerlich die erwartete Richtung. Die Kurve und Kennzahlen reagieren sofort.</p></div>
 <div className="sim-grid"><article className="panel"><h2>Zwei-Asset-Portfolio</h2><label>Gewicht Asset A <b>{Math.round(w*100)}%</b><input type="range" min="0" max="1" step=".05" value={w} onChange={e=>setW(+e.target.value)}/></label><label>Korrelation ρ <b>{rho.toFixed(1)}</b><input type="range" min="-1" max="1" step=".1" value={rho} onChange={e=>setRho(+e.target.value)}/></label><svg viewBox="0 0 420 180" role="img" aria-label="Portfoliovolatilität nach Gewicht"><polyline points={curve.map(p=>`${20+p.x*380},${165-p.y/maxY*140}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="5"/><line x1="20" y1="165" x2="400" y2="165" stroke="currentColor" opacity=".25"/></svg><div className="sim-output"><strong>{vol.toFixed(2)}%</strong><span>Portfolio-Volatilität</span></div><p>{rho===1?"Bei ρ=1 verschwindet der reine Diversifikationseffekt.":rho<0?"Negative Korrelation verstärkt die Risikoreduktion.":"Nicht perfekte Korrelation reduziert Risiko gegenüber reinem Gleichlauf."}</p></article>
 <article className="panel"><h2>Security Market Line</h2><label>Beta <b>{beta.toFixed(1)}</b><input type="range" min="0" max="2" step=".1" value={beta} onChange={e=>setBeta(+e.target.value)}/></label><label>Risikofreier Zins <b>{rf}%</b><input type="range" min="0" max="7" step=".5" value={rf} onChange={e=>setRf(+e.target.value)}/></label><label>Marktrendite <b>{rm}%</b><input type="range" min="7" max="15" step=".5" value={rm} onChange={e=>setRm(+e.target.value)}/></label><div className="sml-chart"><span style={{left:`${beta/2*88+6}%`,bottom:`${Math.min(90,capm/16*80+5)}%`}}/><i/></div><div className="sim-output"><strong>{capm.toFixed(2)}%</strong><span>CAPM-Rendite</span></div><p>Steilere SML bei größerer Marktrisikoprämie; Beta bewegt das Asset entlang der Linie.</p></article></div></section>;
}

function Detective({setProgress,onBack}:{setProgress:React.Dispatch<React.SetStateAction<AppProgress>>;onBack:()=>void}) {
 const [index,setIndex]=useState(0),[selected,setSelected]=useState<number>(),[checked,setChecked]=useState(false); const item=detectiveCases[index%detectiveCases.length];
 const submit=()=>{setChecked(true);logAttempt(setProgress,{taskId:item.id,topic:"Typische Rechenfehler",mode:"detective",score:selected===item.wrong?1:0,maxScore:1,errorTypes:selected===item.wrong?[]:[item.title]})};
 return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← Klausurwerkstatt</button><span>Fall {index+1} / {detectiveCases.length}</span></div><article className="question-card detective"><span className="question-type">FEHLERDETEKTIV</span><h1>{item.title}</h1><p>Markiere die erste fachlich falsche Zeile.</p><div className="solution-lines">{item.lines.map((line,i)=><button disabled={checked} className={`${selected===i?"selected":""} ${checked&&i===item.wrong?"correct":""} ${checked&&selected===i&&i!==item.wrong?"incorrect":""}`} onClick={()=>setSelected(i)} key={line}><span>{i+1}</span><code>{line}</code></button>)}</div>{checked&&<div className={selected===item.wrong?"feedback correct-feedback":"feedback wrong-feedback"}><b>{selected===item.wrong?"Erste falsche Zeile erkannt.":"Die frühere Ursache liegt an einer anderen Stelle."}</b><p>{item.why}</p></div>}<div className="question-actions">{checked?<button className="primary-button" onClick={()=>{setIndex(i=>i+1);setSelected(undefined);setChecked(false)}}>Nächster Fehler →</button>:<button className="primary-button" disabled={selected===undefined} onClick={submit}>Zeile prüfen</button>}</div></article></section>;
}

function Mastery({attempts,setProgress,onBack}:{attempts:PortfolioAttempt[];setProgress:React.Dispatch<React.SetStateAction<AppProgress>>;onBack:()=>void}) {
 const topics=useMemo(()=>[...new Set(createChainTasks(1).map(t=>t.topic))].map(topic=>{const rows=attempts.filter(a=>a.topic===topic);const recent=rows.slice(-5);const score=recent.reduce((s,a)=>s+a.score,0),max=recent.reduce((s,a)=>s+a.maxScore,0);const days=new Set(rows.map(a=>new Date(a.completedAt).toDateString())).size;return {topic,attempts:rows.length,accuracy:max?Math.round(score/max*100):0,days,mastered:rows.length>=3&&days>=2&&max>0&&score/max>=.8}}),[attempts]);
 const errors=Object.entries(attempts.flatMap(a=>a.errorTypes).reduce<Record<string,number>>((acc,e)=>(acc[e]=(acc[e]??0)+1,acc),{})).sort((a,b)=>b[1]-a[1]); const challenge=createChainTasks(new Date().getDate())[new Date().getDate()%5];
 return <section className="page academy-page"><div className="trainer-head"><button className="text-button" onClick={onBack}>← Klausurwerkstatt</button><span>{attempts.length} protokollierte Versuche</span></div><div className="page-heading"><p className="eyebrow">NICHT EINMAL RICHTIG, SONDERN DAUERHAFT ABRUFBAR</p><h1>Fehlerprofil & Mastery</h1><p>Beherrscht bedeutet: mindestens drei Versuche, an mindestens zwei Tagen und zuletzt mindestens 80% der Teilpunkte.</p></div>
 <div className="mastery-layout"><article className="panel challenge"><span>TAGES-CHALLENGE</span><h2>{challenge.prompt}</h2><p>Unbekannter Aufgabentyp · {challenge.totalPoints} Punkte · Zielzeit 12 Minuten</p><button className="primary-button" onClick={()=>logAttempt(setProgress,{taskId:challenge.id,topic:challenge.topic,mode:"challenge",score:0,maxScore:challenge.totalPoints,errorTypes:["Challenge gestartet"]})}>Challenge in Aufgabenketten vormerken</button></article><article className="panel"><h2>Häufigste Rechenmuster</h2>{errors.length?errors.slice(0,6).map(([e,n])=><div className="error-bar" key={e}><span>{e}</span><div><i style={{width:`${Math.min(100,n/(errors[0][1] as number)*100)}%`}}/></div><b>{n}×</b></div>):<p>Noch kein Fehlerprofil. Löse eine Aufgabenkette oder einen Fehlerdetektiv.</p>}</article></div>
 <div className="mastery-grid">{topics.map(t=><article key={t.topic} className={t.mastered?"mastered":""}><span>{t.mastered?"BEHERRSCHT":t.attempts?"IM AUFBAU":"NEU"}</span><h3>{t.topic}</h3><div className="progress-track"><i style={{width:`${t.accuracy}%`}}/></div><p>{t.accuracy}% · {t.attempts} Versuche · {t.days} Lerntage</p></article>)}</div></section>;
}

