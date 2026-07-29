import type { ExamModeId, SourceRef, Subject } from "../types";

export type ExamRubricItem = {
  label: string;
  points: number;
};

export type ExamBlock = {
  id: string;
  subject: Subject;
  topic: string;
  title: string;
  prompt: string;
  points: number;
  targetMinutes: number;
  responseType: "choice" | "text";
  options?: string[];
  correctOption?: number;
  rubric: ExamRubricItem[];
  modelAnswer: string;
  source: SourceRef;
};

export type ExamMode = {
  id: ExamModeId;
  subject: Subject;
  labelDe: string;
  labelEn: string;
  descriptionDe: string;
  descriptionEn: string;
  durationMinutes: number;
  maxPoints: number;
  blocks: ExamBlock[];
};

const portfolioExam = (page: string): SourceRef => ({
  document: "00.0_Study_Pack_2025_Solutions.pdf",
  location: `PDF-S. ${page} · BSC Portfolio Management Resit FT2025`,
  priority: "official-solution",
  note: "Struktur und Methode stammen aus der offiziellen Prüfung; Zahlen wurden für eine eigenständige Variante verändert.",
});

const taxExam = (task: string, pages: string): SourceRef => ({
  document: "German and International Taxation.zip → 00.0_Study_Pack_2025_Solutions.pdf",
  location: `Task ${task} · PDF-S. ${pages}`,
  priority: "official-solution",
  note: "Vollständige neue Fallvariante nach dem offiziellen Lösungsschema.",
});

const internationalCatalog = (location: string): SourceRef => ({
  document: "EBS - Taxation - Single Choice Questions.pdf",
  location,
  priority: "official-current",
  note: "EBS-Fragenkatalog; laut Einleitung ist jeweils die erste Antwort richtig.",
});

export const portfolioExamPlan: ExamBlock[] = [
  {
    id: "pe-tf",
    subject: "portfolio",
    topic: "Diversification & Correlation",
    title: "True/False mit Begründung",
    prompt: "Beurteile beide Aussagen und begründe jeweils kurz: (1) Eine Korrelation von 0 bedeutet, dass zwei Assets unabhängig sind. (2) Eine niedrigere Korrelation kann das Portfoliorisiko senken, ohne die erwarteten Einzelrenditen zu verändern.",
    points: 10,
    targetMinutes: 8,
    responseType: "text",
    rubric: [
      { label: "Aussage 1 als falsch erkannt", points: 2 },
      { label: "Korrelation misst nur linearen Zusammenhang; ρ=0 beweist keine Unabhängigkeit", points: 3 },
      { label: "Aussage 2 als richtig erkannt", points: 2 },
      { label: "Kovarianzterm/Risikowirkung korrekt erklärt", points: 3 },
    ],
    modelAnswer: "(1) Falsch. Unabhängigkeit impliziert zwar bei endlichen Momenten ρ=0, aber ρ=0 schließt nichtlineare Abhängigkeit nicht aus. (2) Richtig. In der Zwei-Asset-Varianz sinkt der Kreuzterm 2w₁w₂ρ₁₂σ₁σ₂, während E(rₚ)=ΣwᵢE(rᵢ) nicht von ρ abhängt.",
    source: portfolioExam("96"),
  },
  {
    id: "pe-mcq",
    subject: "portfolio",
    topic: "CAPM, SML & Beta",
    title: "Formelwahl",
    prompt: "Ein Analyst erwartet für eine Aktie 7,5%. r𝒻=2%, E(rM)=10% und β=0,8. Welche Aussage folgt aus der Kurslogik?",
    points: 10,
    targetMinutes: 5,
    responseType: "choice",
    options: [
      "CAPM verlangt 8,4%; die Analystenschätzung liegt darunter und spricht für Überbewertung.",
      "CAPM verlangt 7,5%; die Aktie liegt exakt auf der SML.",
      "CAPM verlangt 10%; die Aktie ist unterbewertet.",
      "CAPM verlangt 6,4%; die Aktie ist überbewertet.",
    ],
    correctOption: 0,
    rubric: [{ label: "Richtige CAPM-Rechnung und Bewertung", points: 10 }],
    modelAnswer: "CAPM: 2% + 0,8×(10%−2%) = 8,4%. Die erwartete tatsächliche Rendite von 7,5% liegt unter der geforderten Rendite; in der Kurslogik ist die Aktie überbewertet.",
    source: portfolioExam("97–99"),
  },
  {
    id: "pe-risk",
    subject: "portfolio",
    topic: "Risk & Return",
    title: "Portfolio aus Aktie und T-Bill",
    prompt: "EUR 12.000 von EUR 30.000 liegen in einer Aktie mit E(r)=11% und Var(r)=0,0225; der Rest liegt risikofrei zu 3%. Berechne Gewicht, erwartete Portfoliorendite und Portfoliovolatilität. Interpretiere das Ergebnis.",
    points: 14,
    targetMinutes: 12,
    responseType: "text",
    rubric: [
      { label: "Gewichte 0,4 und 0,6", points: 2 },
      { label: "E(rₚ)=6,2%", points: 4 },
      { label: "σAktie=15%", points: 2 },
      { label: "σₚ=0,4×15%=6%", points: 4 },
      { label: "Rendite und Risiko korrekt interpretiert", points: 2 },
    ],
    modelAnswer: "wAktie=12.000/30.000=0,4; w𝒻=0,6. E(rₚ)=0,4×11%+0,6×3%=6,2%. σAktie=√0,0225=15%. Da der risikofreie Teil keine Varianz/Kovarianz beiträgt, σₚ=0,4×15%=6%.",
    source: portfolioExam("95"),
  },
  {
    id: "pe-capm",
    subject: "portfolio",
    topic: "CAPM, SML & Beta",
    title: "Beta, CAPM und Bewertung",
    prompt: "Für Aktie A gelten ρAM=0,6, σA=25%, σM=15%, r𝒻=3% und E(rM)=9%. Ein Analyst erwartet 10%. Berechne βA und die CAPM-Rendite. Beurteile die Aktie.",
    points: 14,
    targetMinutes: 12,
    responseType: "text",
    rubric: [
      { label: "β=ρAM·σA/σM=1", points: 4 },
      { label: "Marktrisikoprämie 6%", points: 2 },
      { label: "CAPM-Rendite 9%", points: 4 },
      { label: "Analystenerwartung 10% > 9%", points: 2 },
      { label: "Unterbewertung nach Kurslogik", points: 2 },
    ],
    modelAnswer: "βA=0,6×0,25/0,15=1. CAPM: 3%+1×(9%−3%)=9%. Die Analystenschätzung von 10% liegt oberhalb der SML-Anforderung; die Aktie gilt in der Kurslogik als unterbewertet.",
    source: portfolioExam("97"),
  },
  {
    id: "pe-performance",
    subject: "portfolio",
    topic: "Performance Measures",
    title: "Sharpe, Treynor und Jensen",
    prompt: "Portfolio P: rP=11%, σP=16%, βP=1,2. Markt: rM=9%. r𝒻=3%. Berechne Sharpe Ratio, Treynor Ratio und Jensen’s Alpha. Ordne die Risikonenner korrekt ein.",
    points: 14,
    targetMinutes: 13,
    responseType: "text",
    rubric: [
      { label: "Überschussrendite 8%", points: 2 },
      { label: "Sharpe=0,50", points: 3 },
      { label: "Treynor=6,67%", points: 3 },
      { label: "CAPM-Benchmark 10,2%", points: 2 },
      { label: "Jensen α=+0,8%", points: 2 },
      { label: "σ=Gesamtrisiko, β=systematisches Risiko", points: 2 },
    ],
    modelAnswer: "Sharpe=(11−3)/16=0,50. Treynor=(11−3)/1,2=6,67%. CAPM=3+1,2×(9−3)=10,2%; α=11−10,2=+0,8%. Sharpe nutzt Gesamtrisiko, Treynor und Jensen systematisches Risiko.",
    source: portfolioExam("100"),
  },
  {
    id: "pe-event",
    subject: "portfolio",
    topic: "EMH & Event Study",
    title: "Event Study",
    prompt: "Im Ereignisfenster betragen die abnormalen Renditen −0,8%, +1,1%, +0,5% und −0,2%. Berechne den CAR und erkläre, was ein positiver CAR bedeutet. Nenne außerdem die Informationsmenge der semi-starken EMH.",
    points: 14,
    targetMinutes: 11,
    responseType: "text",
    rubric: [
      { label: "Vorzeichen korrekt übernommen", points: 2 },
      { label: "CAR=+0,6%", points: 4 },
      { label: "Kumulierte abnormale Rendite erklärt", points: 3 },
      { label: "Positiver Ereigniseffekt vorsichtig interpretiert", points: 2 },
      { label: "Semi-stark: alle öffentlich verfügbaren Informationen", points: 3 },
    ],
    modelAnswer: "CAR=−0,8+1,1+0,5−0,2=+0,6%. Er misst die kumulierte abnormale Rendite im Fenster; positiv bedeutet eine positive Abweichung von der Modellrendite, nicht automatisch Kausalität. Semi-starke Effizienz umfasst alle öffentlich verfügbaren Informationen.",
    source: portfolioExam("106–107"),
  },
  {
    id: "pe-abs",
    subject: "portfolio",
    topic: "Financial Innovation",
    title: "ABS Loss Waterfall",
    prompt: "Ein ABS-Pool von EUR 120 Mio. erleidet 13% Verlust. Die Originator-First-Loss-Position beträgt 4%, die Junior-Tranche 6% und die Mezzanine-Tranche 10% des Pools. Verteile den Verlust und erkläre die Schutzwirkung der Subordination.",
    points: 14,
    targetMinutes: 12,
    responseType: "text",
    rubric: [
      { label: "Gesamtverlust EUR 15,6 Mio.", points: 3 },
      { label: "Originator trägt EUR 4,8 Mio.", points: 3 },
      { label: "Junior trägt EUR 7,2 Mio.", points: 3 },
      { label: "Mezzanine trägt EUR 3,6 Mio.; Senior 0", points: 3 },
      { label: "Subordination als Schutz der Senior-Tranche erklärt", points: 2 },
    ],
    modelAnswer: "Verlust: 120×13%=EUR 15,6 Mio. First Loss: 120×4%=4,8. Rest 10,8. Junior: 120×6%=7,2. Rest 3,6. Mezzanine übernimmt 3,6; Senior bleibt unbelastet. Nachrangige Positionen absorbieren Verluste zuerst.",
    source: portfolioExam("108"),
  },
];

export const taxExamPlan: ExamBlock[] = [
  {
    id: "te-partnership",
    subject: "tax",
    topic: "Partnership & Co-Entrepreneurship",
    title: "Mitunternehmerschaft - 30-Punkte-Block",
    prompt: "Die AB-KG erzielt laut Steuerbilanz einen Verlust von EUR 90.000. A und B sind zu 40%/60% beteiligt. B erhält für ein betrieblich genutztes Darlehen EUR 18.000 Zinsen; damit zusammenhängende Sonderbetriebsausgaben betragen EUR 3.000. B ist Kommanditist; sein maßgebliches Kapitalkonto vor Verlustzurechnung beträgt EUR 45.000. Prüfe Transparenzprinzip, zweistufige Gewinnermittlung, Einkünfte von B und § 15a EStG.",
    points: 30,
    targetMinutes: 28,
    responseType: "text",
    rubric: [
      { label: "Transparenzprinzip und § 15 Abs. 1 S. 1 Nr. 2 EStG", points: 5 },
      { label: "Stufe 1 B: −EUR 54.000", points: 5 },
      { label: "Stufe 2 B: +EUR 15.000", points: 5 },
      { label: "Additive Einkünfte B: −EUR 39.000", points: 5 },
      { label: "§ 15a auf Verlustanteil/Kapitalkonto bezogen geprüft", points: 5 },
      { label: "Ergebnis klar mit aktuell nutzbarem und verrechenbarem Verlust formuliert", points: 5 },
    ],
    modelAnswer: "Die KG ist für die Einkommensteuer transparent; B erzielt Einkünfte nach § 15 Abs. 1 S. 1 Nr. 2 EStG. Stufe 1: −90.000×60%=−54.000. Stufe 2: 18.000−3.000=+15.000. Additiv: −39.000. Für § 15a ist der zugerechnete Verlustanteil mit dem maßgeblichen Kapitalkonto zu vergleichen; bei EUR 45.000 sind EUR 45.000 aktuell ausgleichsfähig und EUR 9.000 verrechenbar. Die positive Sondervergütung ist anschließend in der additiven Einkünfteermittlung zu berücksichtigen.",
    source: taxExam("4/5", "Partnership taxation and § 15a"),
  },
  {
    id: "te-corporate",
    subject: "tax",
    topic: "Corporate Income Tax",
    title: "Körperschaftsteuerliche Überleitung",
    prompt: "Eine inländische GmbH weist handelsrechtlich EUR 70.000 Gewinn aus. Enthalten sind eine Geldbuße von EUR 4.000 und Aufsichtsratsvergütungen von EUR 12.000. Ermittle das zu versteuernde Einkommen vor weiteren Korrekturen und nenne die maßgeblichen Korrekturen.",
    points: 10,
    targetMinutes: 10,
    responseType: "text",
    rubric: [
      { label: "Unbeschränkte KSt-Pflicht/Gewerbeeinkünfte eingeordnet", points: 2 },
      { label: "Geldbuße +EUR 4.000", points: 2 },
      { label: "50% Aufsichtsrat +EUR 6.000", points: 2 },
      { label: "zvE EUR 80.000", points: 2 },
      { label: "Rechnung und Rechtsfolge klar getrennt", points: 2 },
    ],
    modelAnswer: "Ausgangspunkt EUR 70.000. Die Geldbuße ist nicht abzugsfähig und wird mit EUR 4.000 hinzugerechnet. Von EUR 12.000 Aufsichtsratsvergütung sind 50%=EUR 6.000 nicht abzugsfähig. Vor weiteren Korrekturen beträgt das zvE EUR 80.000.",
    source: taxExam("6/7", "Corporate income tax"),
  },
  {
    id: "te-dividend",
    subject: "tax",
    topic: "Dividends & Capital Gains",
    title: "Privat- oder Betriebsvermögen",
    prompt: "Eine natürliche Person hält GmbH-Anteile im Betriebsvermögen und erhält EUR 50.000 Dividende. Direkt zugehörige Aufwendungen: EUR 5.000. Berechne den steuerpflichtigen Einkünftebeitrag nach dem Teileinkünfteverfahren. Sage ausdrücklich, ob nach steuerpflichtigem Betrag oder Steuer gefragt ist.",
    points: 10,
    targetMinutes: 9,
    responseType: "text",
    rubric: [
      { label: "Teileinkünfteverfahren erkannt", points: 2 },
      { label: "60% Dividende = EUR 30.000", points: 2 },
      { label: "60% Aufwendungen = EUR 3.000", points: 2 },
      { label: "Steuerpflichtiger Einkünftebeitrag EUR 27.000", points: 2 },
      { label: "Nicht mit tatsächlicher Steuer verwechselt", points: 2 },
    ],
    modelAnswer: "Gefragt ist der steuerpflichtige Einkünftebeitrag, nicht die Steuer. 60% von EUR 50.000 sind EUR 30.000 steuerpflichtig; 60% von EUR 5.000 sind EUR 3.000 abzugsfähig. Ergebnis: EUR 27.000.",
    source: taxExam("7", "Dividends and capital gains"),
  },
  {
    id: "te-trade",
    subject: "tax",
    topic: "Trade Tax",
    title: "Gewerbesteuer-Kette",
    prompt: "Eine GmbH hat einen Gewinn von EUR 300.040. Der bereits als Aufwand erfasste Zins beträgt EUR 240.000. Weitere Hinzurechnungstatbestände oder Kürzungen bestehen nicht. Hebesatz 400%. Berechne die Gewerbesteuer nach dem im Kurs verwendeten Freibetrag für § 8 Nr. 1 GewStG.",
    points: 10,
    targetMinutes: 11,
    responseType: "text",
    rubric: [
      { label: "Finanzierungsanteil EUR 240.000", points: 1 },
      { label: "Abzüglich EUR 200.000", points: 2 },
      { label: "25% Hinzurechnung = EUR 10.000", points: 2 },
      { label: "Gewerbeertrag EUR 310.040 → 310.000", points: 2 },
      { label: "Messbetrag EUR 10.850; GewSt EUR 43.400", points: 3 },
    ],
    modelAnswer: "(240.000−200.000)×25%=EUR 10.000 Hinzurechnung. Gewerbeertrag: 310.040, abgerundet 310.000. Messbetrag: 310.000×3,5%=10.850. Gewerbesteuer: 10.850×400%=EUR 43.400.",
    source: taxExam("8", "Trade tax"),
  },
  {
    id: "te-inbound",
    subject: "tax",
    topic: "International Tax Liability",
    title: "Wohnsitz und Welteinkommen",
    prompt: "Aisha besitzt eine Wohnung in Teheran und mietet für ihr Studium eine dauerhaft verfügbare Wohnung in Hattenheim, in der sie lebt. Prüfe ihre persönliche Einkommensteuerpflicht in Deutschland und den grundsätzlichen Umfang des steuerbaren Einkommens.",
    points: 10,
    targetMinutes: 8,
    responseType: "text",
    rubric: [
      { label: "Natürliche Person", points: 1 },
      { label: "Wohnsitz nach § 8 AO", points: 3 },
      { label: "§ 1 Abs. 1 EStG", points: 2 },
      { label: "Unbeschränkte Steuerpflicht", points: 2 },
      { label: "Welteinkommensprinzip; DTA-Prüfung nachgelagert", points: 2 },
    ],
    modelAnswer: "Die dauerhaft verfügbare und tatsächlich genutzte Wohnung begründet einen Wohnsitz nach § 8 AO. Aisha ist daher als natürliche Person nach § 1 Abs. 1 EStG unbeschränkt einkommensteuerpflichtig. Grundsätzlich gilt das Welteinkommensprinzip; eine abkommensrechtliche Zuweisung oder Entlastung ist anschließend gesondert zu prüfen.",
    source: internationalCatalog("International Taxation · Question 2, PDF-S. 13"),
  },
  {
    id: "te-dtt",
    subject: "tax",
    topic: "Double Tax Treaties",
    title: "Dividende nach OECD-MA",
    prompt: "Dieter lebt in Wiesbaden und hält privat 50% an einer in den USA ansässigen und geleiteten USCo. USCo zahlt ihm eine Dividende. Das Abkommen entspricht dem OECD-Musterabkommen. Ordne Ansässigkeits- und Quellenstaat zu und nenne die maximale US-Quellensteuer nach Art. 10 OECD-MA.",
    points: 10,
    targetMinutes: 8,
    responseType: "text",
    rubric: [
      { label: "Deutschland als Ansässigkeitsstaat des Empfängers", points: 2 },
      { label: "USA als Quellenstaat", points: 2 },
      { label: "Dividendenartikel Art. 10", points: 2 },
      { label: "Privatperson/kein qualifizierter Gesellschaftsempfänger", points: 2 },
      { label: "Maximal 15% nach Art. 10 Abs. 2 lit. b OECD-MA", points: 2 },
    ],
    modelAnswer: "Dieter ist in Deutschland ansässig; die USA sind Quellenstaat der Dividende. Da der Empfänger eine natürliche Person ist, greift nicht die 5%-Regel für qualifizierte Gesellschaftsbeteiligungen. Die US-Quellensteuer ist nach Art. 10 Abs. 2 lit. b OECD-MA auf 15% begrenzt.",
    source: internationalCatalog("International Taxation · Question 4, PDF-S. 14"),
  },
  {
    id: "te-avoidance",
    subject: "tax",
    topic: "Anti-Avoidance & Transfer Pricing",
    title: "Anti-Treaty-Shopping und Verrechnungspreise",
    prompt: "Erkläre knapp den Zweck der Anti-Treaty-Shopping-Regel und entscheide, ob § 1 AStG nach der im EBS-Fragenkatalog geprüften Aussage eine Einkünftekorrektur nach oben, nach unten oder in beide Richtungen erlaubt.",
    points: 10,
    targetMinutes: 7,
    responseType: "text",
    rubric: [
      { label: "Künstliche Strukturen/Treaty- oder Richtlinienvorteile als Problem", points: 3 },
      { label: "Anti-Treaty-Shopping als Missbrauchsverhinderung", points: 2 },
      { label: "Fremdvergleich/Verrechnungspreise eingeordnet", points: 2 },
      { label: "Nach Kurskatalog: Einkünfte können nur erhöht werden", points: 2 },
      { label: "Klare Rechtsfolge", points: 1 },
    ],
    modelAnswer: "Die Anti-Treaty-Shopping-Regel soll verhindern, dass ausländische Steuerpflichtige über künstliche, wirtschaftlich nicht substanzielle Strukturen Abkommens- oder Richtlinienvorteile erlangen. Nach dem EBS-Fragenkatalog erlaubt § 1 AStG in der geprüften Aussage eine Erhöhung, nicht eine Minderung des steuerpflichtigen Einkommens.",
    source: internationalCatalog("International Taxation · Questions 5–6, PDF-S. 15"),
  },
];

export const examPlans: Record<Subject, ExamBlock[]> = {
  portfolio: portfolioExamPlan,
  tax: taxExamPlan,
};

const germanTaxExamPlan = taxExamPlan.slice(0, 4);
const internationalTaxExamPlan = taxExamPlan.slice(4);

export const examModes: Record<ExamModeId, ExamMode> = {
  "portfolio-full": {
    id: "portfolio-full",
    subject: "portfolio",
    labelDe: "Portfolio-Gesamtprüfung",
    labelEn: "Full Portfolio exam",
    descriptionDe: "Vollständige Portfolio-Simulation",
    descriptionEn: "Complete Portfolio simulation",
    durationMinutes: 90,
    maxPoints: 90,
    blocks: portfolioExamPlan,
  },
  "tax-german": {
    id: "tax-german",
    subject: "tax",
    labelDe: "German Taxation",
    labelEn: "German Taxation",
    descriptionDe: "Teil I · zwei Drittel der Tax-Prüfung",
    descriptionEn: "Part I · two thirds of the Tax exam",
    durationMinutes: 60,
    maxPoints: 60,
    blocks: germanTaxExamPlan,
  },
  "tax-international": {
    id: "tax-international",
    subject: "tax",
    labelDe: "International Taxation",
    labelEn: "International Taxation",
    descriptionDe: "Teil II · maximal 30 Minuten",
    descriptionEn: "Part II · maximum 30 minutes",
    durationMinutes: 30,
    maxPoints: 30,
    blocks: internationalTaxExamPlan,
  },
  "tax-combined": {
    id: "tax-combined",
    subject: "tax",
    labelDe: "Tax-Gesamtprüfung",
    labelEn: "Full Tax exam",
    descriptionDe: "60 Min German + 30 Min International",
    descriptionEn: "60 min German + 30 min International",
    durationMinutes: 90,
    maxPoints: 90,
    blocks: taxExamPlan,
  },
};

export function examModeForSession(subject: Subject, examModeId?: ExamModeId) {
  return examModes[examModeId ?? (subject === "tax" ? "tax-combined" : "portfolio-full")];
}
