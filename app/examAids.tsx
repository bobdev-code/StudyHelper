"use client";

import { useState } from "react";
import { calculateExpression, formatCalculatorResult } from "@/lib/calculator";
import { portfolioFormulaGroups } from "@/lib/data/examAids";
import { upsertTaxDiagram } from "@/lib/storage";
import type {
  AppProgress,
  Language,
  SavedTaxDiagram,
  Subject,
  TaxDiagramAnswer,
  TaxDiagramEdge,
  TaxDiagramNode,
} from "@/lib/types";

const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;

type DiagramNodeKind = TaxDiagramNode["kind"];
type DiagramRelation = TaxDiagramEdge["relation"];
type DiagramNode = TaxDiagramNode;
type DiagramEdge = TaxDiagramEdge;

const nodeLabels: Record<DiagramNodeKind, { de: string; en: string }> = {
  person: { de: "Person", en: "Individual" },
  partnership: { de: "Personengesellschaft", en: "Partnership" },
  corporation: { de: "Kapitalgesellschaft", en: "Corporation" },
  building: { de: "Gebäude", en: "Building" },
};

const relationLabels: Record<DiagramRelation, { de: string; en: string }> = {
  participation: { de: "Beteiligung", en: "Participation" },
  rental: { de: "Miete / Überlassung", en: "Rent / transfer" },
  loan: { de: "Darlehen / Zins", en: "Loan / interest" },
  dividend: { de: "Dividende", en: "Dividend" },
};

const positions = [
  [110, 72], [320, 72], [530, 72],
  [110, 250], [320, 250], [530, 250],
] as const;

type TemplateNode = Omit<DiagramNode, "id" | "label"> & { label: string; labelEn: string };
const diagramTemplates: Record<string, { nodes: TemplateNode[]; edges: Omit<DiagramEdge, "id">[] }> = {
  partnership: {
    nodes: [
      { kind: "person", x: 180, y: 70, label: "Gesellschafter A", labelEn: "Partner A" },
      { kind: "person", x: 430, y: 70, label: "Gesellschafter B", labelEn: "Partner B" },
      { kind: "partnership", x: 305, y: 240, label: "KG / Mitunternehmerschaft", labelEn: "LP / co-entrepreneurship" },
    ],
    edges: [
      { from: 1, to: 3, relation: "participation" },
      { from: 2, to: 3, relation: "participation" },
    ],
  },
  businessSplit: {
    nodes: [
      { kind: "person", x: 90, y: 70, label: "Beherrschende Person", labelEn: "Controlling individual" },
      { kind: "partnership", x: 250, y: 245, label: "Besitzunternehmen", labelEn: "Possession entity" },
      { kind: "corporation", x: 520, y: 245, label: "Betriebs-GmbH", labelEn: "Operating company" },
      { kind: "building", x: 90, y: 245, label: "Wesentliches Gebäude", labelEn: "Essential building" },
    ],
    edges: [
      { from: 1, to: 2, relation: "participation" },
      { from: 1, to: 3, relation: "participation" },
      { from: 4, to: 3, relation: "rental" },
    ],
  },
  intercompany: {
    nodes: [
      { kind: "corporation", x: 320, y: 70, label: "Mutter-GmbH", labelEn: "Parent company" },
      { kind: "corporation", x: 320, y: 250, label: "Tochter-GmbH", labelEn: "Subsidiary" },
    ],
    edges: [
      { from: 1, to: 2, relation: "participation" },
      { from: 2, to: 1, relation: "dividend" },
    ],
  },
  privateEquity: {
    nodes: [
      { kind: "person", x: 320, y: 50, label: "Privater Investor", labelEn: "Private investor" },
      { kind: "corporation", x: 320, y: 170, label: "Holding-GmbH", labelEn: "Holding company" },
      { kind: "corporation", x: 320, y: 285, label: "PE-Zielgesellschaft", labelEn: "PE target company" },
    ],
    edges: [
      { from: 1, to: 2, relation: "participation" },
      { from: 2, to: 3, relation: "participation" },
      { from: 2, to: 1, relation: "dividend" },
    ],
  },
};

function FormulaSheet({ language }: { language: Language }) {
  return <div className="formula-aid">
    <p>{tr(language, "Die Nummerierung entspricht dem offiziellen zweiseitigen Formula Sheet.", "Numbering follows the official two-page Formula Sheet.")}</p>
    {portfolioFormulaGroups.map((group) => <details key={group.id} open={group.id === "return-risk"}>
      <summary>{tr(language, group.label, group.labelEn)}<small>{group.formulas.length} {tr(language, "Formeln", "formulas")}</small></summary>
      <div className="formula-aid-list">{group.formulas.map((item) => <article key={item.number}>
        <span>{item.number}</span><div><b>{item.name}</b><code>{item.formula}</code></div><small>S. {item.page}</small>
      </article>)}</div>
    </details>)}
    <small className="aid-source">Quelle: Portfolio Management.zip → Formula_Sheet_2024_Exam.pdf, S. 1–2.</small>
  </div>;
}

const calculatorRows = [
  ["C", "⌫", "(", ")", "÷"],
  ["7", "8", "9", "^", "√"],
  ["4", "5", "6", "×", "%"],
  ["1", "2", "3", "+", "−"],
  ["0", ",", "00", "=", ""],
];

function Calculator({ language }: { language: Language }) {
  const [expression, setExpression] = useState("");
  const [display, setDisplay] = useState("0");
  const [error, setError] = useState("");

  const press = (key: string) => {
    setError("");
    if (key === "C") {
      setExpression("");
      setDisplay("0");
      return;
    }
    if (key === "⌫") {
      setExpression((current) => current.slice(0, -1));
      return;
    }
    if (key === "=") {
      try {
        const value = calculateExpression(expression);
        const result = formatCalculatorResult(value);
        setDisplay(result);
        setExpression(result);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Ungültiger Ausdruck");
      }
      return;
    }
    setExpression((current) => `${current}${key === "√" ? "√(" : key}`);
  };

  return <div className="calculator-aid">
    <div className="calculator-display"><small>{expression || tr(language, "Ausdruck eingeben", "Enter expression")}</small><strong>{error || display}</strong></div>
    <div className="calculator-keys">{calculatorRows.flatMap((row, rowIndex) => row.map((key, columnIndex) => key
      ? <button key={`${rowIndex}-${key}`} className={key === "=" ? "equals" : /[÷×+−^√%]/.test(key) ? "operator" : ""} onClick={() => press(key)}>{key}</button>
      : <span key={`${rowIndex}-${columnIndex}`} />))}</div>
    <p>{tr(language, "Unterstützt Klammern, Potenzen, Prozent und Quadratwurzel. Die Rechnung bleibt lokal im Browser.", "Supports parentheses, powers, percentages and square roots. Calculations stay in your browser.")}</p>
  </div>;
}

function DiagramNodeShape({ node, selected, onSelect }: { node: DiagramNode; selected: boolean; onSelect: () => void }) {
  return <g className={selected ? "diagram-node selected" : "diagram-node"} role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onSelect()} aria-label={node.label}>
    {node.kind === "person" && <>
      <circle cx={node.x} cy={node.y - 17} r="16" />
      <path d={`M ${node.x} ${node.y} L ${node.x} ${node.y + 30} M ${node.x - 20} ${node.y + 10} L ${node.x + 20} ${node.y + 10} M ${node.x} ${node.y + 30} L ${node.x - 15} ${node.y + 51} M ${node.x} ${node.y + 30} L ${node.x + 15} ${node.y + 51}`} />
    </>}
    {node.kind === "partnership" && <polygon points={`${node.x},${node.y - 35} ${node.x - 43},${node.y + 35} ${node.x + 43},${node.y + 35}`} />}
    {node.kind === "corporation" && <rect x={node.x - 58} y={node.y - 31} width="116" height="62" rx="4" />}
    {node.kind === "building" && <>
      <path d={`M ${node.x - 48} ${node.y - 10} L ${node.x} ${node.y - 46} L ${node.x + 48} ${node.y - 10} Z`} />
      <rect x={node.x - 42} y={node.y - 10} width="84" height="58" />
      <rect x={node.x - 10} y={node.y + 17} width="20" height="31" />
    </>}
    <text x={node.x} y={node.y + (node.kind === "person" ? 72 : 58)} textAnchor="middle">{node.label}</text>
  </g>;
}

function TaxDiagramCanvas({
  language,
  nodes,
  edges,
  selected = [],
  onSelect,
}: {
  language: Language;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  selected?: number[];
  onSelect?: (id: number) => void;
}) {
  const markerId = onSelect ? "answer-arrow" : "preview-arrow";
  return <svg className="tax-diagram-canvas" viewBox="0 0 640 340" aria-label={tr(language, "Steuerzeichnung", "Tax diagram")}>
    <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" /></marker></defs>
    {edges.map((edge) => {
      const from = nodes.find((item) => item.id === edge.from);
      const to = nodes.find((item) => item.id === edge.to);
      if (!from || !to) return null;
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      return <g className="diagram-edge" key={edge.id}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd={`url(#${markerId})`} /><rect x={midX - 58} y={midY - 12} width="116" height="20" rx="8" /><text x={midX} y={midY + 2} textAnchor="middle">{tr(language, relationLabels[edge.relation].de, relationLabels[edge.relation].en)}</text></g>;
    })}
    {nodes.map((node) => <DiagramNodeShape key={node.id} node={node} selected={selected.includes(node.id)} onSelect={() => onSelect?.(node.id)} />)}
    {!nodes.length && <text className="diagram-empty" x="320" y="170" textAnchor="middle">{tr(language, "Vorlage wählen oder Symbole hinzufügen", "Choose a template or add symbols")}</text>}
  </svg>;
}

function materializeTemplate(id: keyof typeof diagramTemplates, language: Language): TaxDiagramAnswer {
  const template = diagramTemplates[id];
  return {
    nodes: template.nodes.map(({ labelEn, ...item }, index) => ({ ...item, label: tr(language, item.label, labelEn), id: index + 1 })),
    edges: template.edges.map((item, index) => ({ ...item, id: index + 1 })),
  };
}

export function TaxDiagramAnswerEditor({
  language,
  value,
  onChange,
  disabled = false,
}: {
  language: Language;
  value: TaxDiagramAnswer;
  onChange: (answer: TaxDiagramAnswer) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [relation, setRelation] = useState<DiagramRelation>("participation");
  const addNode = (kind: DiagramNodeKind) => {
    const id = Math.max(0, ...value.nodes.map((item) => item.id)) + 1;
    const [x, y] = positions[value.nodes.length % positions.length];
    onChange({ ...value, nodes: [...value.nodes, { id, kind, x, y, label: tr(language, nodeLabels[kind].de, nodeLabels[kind].en) }] });
  };
  const toggleNode = (id: number) => setSelected((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current.slice(-1), id]);
  const connect = () => {
    if (selected.length !== 2) return;
    const edge = { id: Math.max(0, ...value.edges.map((item) => item.id)) + 1, from: selected[0], to: selected[1], relation };
    onChange({ ...value, edges: [...value.edges, edge] });
    setSelected([]);
  };
  const removeSelected = () => {
    const selectedSet = new Set(selected);
    onChange({
      nodes: value.nodes.filter((item) => !selectedSet.has(item.id)),
      edges: value.edges.filter((item) => !selectedSet.has(item.from) && !selectedSet.has(item.to)),
    });
    setSelected([]);
  };

  return <div className="tax-diagram-builder exam-diagram-answer">
    {!disabled && <>
      <div className="diagram-toolbar">
        <div><small>{tr(language, "Bausteine", "Building blocks")}</small>{(["person", "partnership", "corporation", "building"] as DiagramNodeKind[]).map((kind) => <button key={kind} onClick={() => addNode(kind)}>+ {tr(language, nodeLabels[kind].de, nodeLabels[kind].en)}</button>)}</div>
        <div><small>{tr(language, "Vorlagen", "Templates")}</small><button onClick={() => onChange(materializeTemplate("partnership", language))}>{tr(language, "Mitunternehmerschaft", "Co-entrepreneurship")}</button><button onClick={() => onChange(materializeTemplate("businessSplit", language))}>{tr(language, "Betriebsaufspaltung", "Business split")}</button><button onClick={() => onChange(materializeTemplate("intercompany", language))}>Intercompany</button></div>
      </div>
      <div className="diagram-connect">
        <select value={relation} onChange={(event) => setRelation(event.target.value as DiagramRelation)}>{(Object.keys(relationLabels) as DiagramRelation[]).map((key) => <option key={key} value={key}>{tr(language, relationLabels[key].de, relationLabels[key].en)}</option>)}</select>
        <button disabled={selected.length !== 2} onClick={connect}>{tr(language, "Ausgewählte Symbole verbinden", "Connect selected symbols")}</button>
        <button disabled={!selected.length} onClick={removeSelected}>{tr(language, "Auswahl löschen", "Delete selection")}</button>
      </div>
    </>}
    <TaxDiagramCanvas language={language} nodes={value.nodes} edges={value.edges} selected={selected} onSelect={disabled ? undefined : toggleNode} />
    {!disabled && <p>{tr(language, "Wähle zwei Symbole nacheinander und verbinde sie. Deine Zeichnung wird mit der Prüfungsantwort gespeichert.", "Select two symbols in sequence and connect them. Your diagram is saved with the exam answer.")}</p>}
  </div>;
}

export function TaxDiagramPreview({ language, value }: { language: Language; value: TaxDiagramAnswer }) {
  return <div className="tax-diagram-builder diagram-preview"><TaxDiagramCanvas language={language} nodes={value.nodes} edges={value.edges} /></div>;
}

function TaxDiagramBuilder({
  language,
  savedDiagrams,
  onSave,
}: {
  language: Language;
  savedDiagrams: SavedTaxDiagram[];
  onSave?: (diagram: SavedTaxDiagram) => void;
}) {
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [relation, setRelation] = useState<DiagramRelation>("participation");
  const [diagramName, setDiagramName] = useState("");
  const [activeDiagramId, setActiveDiagramId] = useState<string>();

  const addNode = (kind: DiagramNodeKind) => {
    const id = Math.max(0, ...nodes.map((item) => item.id)) + 1;
    const [x, y] = positions[nodes.length % positions.length];
    setNodes((current) => [...current, { id, kind, x, y, label: tr(language, nodeLabels[kind].de, nodeLabels[kind].en) }]);
  };
  const toggleNode = (id: number) => setSelected((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current.slice(-1), id]);
  const connect = () => {
    if (selected.length !== 2) return;
    setEdges((current) => [...current, { id: Math.max(0, ...current.map((item) => item.id)) + 1, from: selected[0], to: selected[1], relation }]);
    setSelected([]);
  };
  const loadTemplate = (id: keyof typeof diagramTemplates) => {
    const template = materializeTemplate(id, language);
    setNodes(template.nodes);
    setEdges(template.edges);
    setSelected([]);
  };
  const removeSelected = () => {
    const selectedSet = new Set(selected);
    setNodes((current) => current.filter((item) => !selectedSet.has(item.id)));
    setEdges((current) => current.filter((item) => !selectedSet.has(item.from) && !selectedSet.has(item.to)));
    setSelected([]);
  };
  const loadSaved = (id: string) => {
    const saved = savedDiagrams.find((item) => item.id === id);
    if (!saved) return;
    setActiveDiagramId(saved.id);
    setDiagramName(saved.name);
    setNodes(saved.nodes);
    setEdges(saved.edges);
    setSelected([]);
  };
  const saveDiagram = () => {
    const name = diagramName.trim();
    if (!name || !nodes.length || !onSave) return;
    const diagram: SavedTaxDiagram = {
      id: activeDiagramId ?? `tax-diagram-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };
    onSave(diagram);
    setActiveDiagramId(diagram.id);
  };

  return <div className="tax-diagram-builder">
    <div className="diagram-savebar">
      <label><span>{tr(language, "Zeichnung benennen", "Name drawing")}</span><input value={diagramName} onChange={(event) => setDiagramName(event.target.value)} placeholder={tr(language, "z. B. Betriebsaufspaltung Fall 2", "e.g. Business split case 2")} /></label>
      <button className="primary-button compact" disabled={!onSave || !diagramName.trim() || !nodes.length} onClick={saveDiagram}>{activeDiagramId ? tr(language, "Änderungen speichern", "Save changes") : tr(language, "Zeichnung speichern", "Save drawing")}</button>
      {savedDiagrams.length > 0 && <label><span>{tr(language, "Gespeicherte Zeichnung laden", "Load saved drawing")}</span><select value={activeDiagramId ?? ""} onChange={(event) => loadSaved(event.target.value)}><option value="">{tr(language, "Auswählen …", "Choose …")}</option>{savedDiagrams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    </div>
    <div className="diagram-toolbar">
      <div><small>{tr(language, "Bausteine", "Building blocks")}</small>{(["person", "partnership", "corporation", "building"] as DiagramNodeKind[]).map((kind) => <button key={kind} onClick={() => addNode(kind)}>+ {tr(language, nodeLabels[kind].de, nodeLabels[kind].en)}</button>)}</div>
      <div><small>{tr(language, "Vorlagen", "Templates")}</small><button onClick={() => loadTemplate("partnership")}>{tr(language, "Mitunternehmerschaft", "Co-entrepreneurship")}</button><button onClick={() => loadTemplate("businessSplit")}>{tr(language, "Betriebsaufspaltung", "Business split")}</button><button onClick={() => loadTemplate("intercompany")}>Intercompany</button><button onClick={() => loadTemplate("privateEquity")}>Private Equity</button></div>
    </div>
    <div className="diagram-connect">
      <select value={relation} onChange={(event) => setRelation(event.target.value as DiagramRelation)}>{(Object.keys(relationLabels) as DiagramRelation[]).map((key) => <option key={key} value={key}>{tr(language, relationLabels[key].de, relationLabels[key].en)}</option>)}</select>
      <button disabled={selected.length !== 2} onClick={connect}>{tr(language, "Ausgewählte Symbole verbinden", "Connect selected symbols")}</button>
      <button disabled={!selected.length} onClick={removeSelected}>{tr(language, "Auswahl löschen", "Delete selection")}</button>
    </div>
    <TaxDiagramCanvas language={language} nodes={nodes} edges={edges} selected={selected} onSelect={toggleNode} />
    <p>{tr(language, "Wähle zwei Symbole nacheinander und verbinde sie. Gespeicherte Zeichnungen bleiben nach Reload und Login erhalten, werden aber bewusst nicht automatisch bewertet.", "Select two symbols in sequence and connect them. Saved drawings persist across reload and login, but are deliberately not auto-graded.")}</p>
    <small className="aid-source">Quelle: German and International Taxation.zip → Copy of German Tax Exam Prep.pdf, S. 1, 4–6.</small>
  </div>;
}

function TaxBurdenSimulator({ language }: { language: Language }) {
  const [personalRate, setPersonalRate] = useState(35);
  const [distribution, setDistribution] = useState(100);
  const companyLevel = 29;
  const shareholderTax = (100 - companyLevel) * (distribution / 100) * .25;
  const combined = companyLevel + shareholderTax;
  return <div className="tax-burden-aid">
    <div className="burden-controls">
      <label><span>{tr(language, "Persönliche Durchschnittsbelastung", "Personal average burden")} <b>{personalRate}%</b></span><input type="range" min="0" max="45" value={personalRate} onChange={(event) => setPersonalRate(Number(event.target.value))} /></label>
      <label><span>{tr(language, "Ausschüttungsquote der GmbH", "Company distribution share")} <b>{distribution}%</b></span><input type="range" min="0" max="100" step="5" value={distribution} onChange={(event) => setDistribution(Number(event.target.value))} /></label>
    </div>
    <div className="burden-chart" role="img" aria-label={tr(language, "Schematischer Steuerbelastungsvergleich", "Schematic tax burden comparison")}>
      <article><strong>Personengesellschaft</strong><div><span style={{ width: `${personalRate / .55}%` }} /></div><b>{personalRate.toFixed(1)}%</b><small>{tr(language, "vereinfachte persönliche Belastung", "simplified personal burden")}</small></article>
      <article><strong>Kapitalgesellschaft</strong><div><span className="company" style={{ width: `${companyLevel / .55}%` }} /><span className="shareholder" style={{ width: `${shareholderTax / .55}%` }} /></div><b>{combined.toFixed(2)}%</b><small>{companyLevel}% {tr(language, "Gesellschaft", "company")} + {shareholderTax.toFixed(2)}% {tr(language, "Ausschüttung", "distribution")}</small></article>
    </div>
    <p>{tr(language, "Kursmodell, keine reale Steuerberechnung: 15% KSt + rund 14% GewSt auf Gesellschaftsebene; 25% nur auf den ausgeschütteten verbleibenden Gewinn.", "Course model, not a real tax calculation: 15% CIT plus roughly 14% trade tax at company level; 25% only on distributed remaining profit.")}</p>
    <small className="aid-source">Quelle: Copy of German Tax Exam Prep.pdf, S. 3–4.</small>
  </div>;
}

export function ExamAidPanel({
  subject,
  language,
  progress,
  setProgress,
}: {
  subject: Subject;
  language: Language;
  progress?: AppProgress;
  setProgress?: React.Dispatch<React.SetStateAction<AppProgress>>;
}) {
  const [tool, setTool] = useState(subject === "portfolio" ? "formula" : "diagram");
  return <details className={`exam-aid-panel ${subject}`}>
    <summary><span>{subject === "portfolio" ? "ƒx" : "◇"}</span><div><b>{tr(language, "Prüfungshilfen", "Exam aids")}</b><small>{subject === "portfolio" ? tr(language, "Formelsammlung & Taschenrechner", "Formula sheet & calculator") : tr(language, "Zeichenbausteine & Belastungsdiagramm", "Diagram blocks & burden chart")}</small></div></summary>
    <div className="exam-aid-body">
      <div className="exam-aid-tabs" role="tablist">
        {subject === "portfolio" ? <>
          <button className={tool === "formula" ? "active" : ""} onClick={() => setTool("formula")}>{tr(language, "Formelsammlung", "Formula sheet")}</button>
          <button className={tool === "calculator" ? "active" : ""} onClick={() => setTool("calculator")}>{tr(language, "Taschenrechner", "Calculator")}</button>
        </> : <>
          <button className={tool === "diagram" ? "active" : ""} onClick={() => setTool("diagram")}>{tr(language, "Zeichenbausteine", "Diagram blocks")}</button>
          <button className={tool === "burden" ? "active" : ""} onClick={() => setTool("burden")}>{tr(language, "Belastungsdiagramm", "Burden chart")}</button>
        </>}
      </div>
      {tool === "formula" && <FormulaSheet language={language} />}
      {tool === "calculator" && <Calculator language={language} />}
      {subject === "tax" && <div hidden={tool !== "diagram"}><TaxDiagramBuilder language={language} savedDiagrams={progress?.taxDiagrams ?? []} onSave={setProgress ? (diagram) => setProgress((current) => upsertTaxDiagram(current, diagram)) : undefined} /></div>}
      {tool === "burden" && <TaxBurdenSimulator language={language} />}
    </div>
  </details>;
}
