import type { QuizQuestion } from "../types";
import { portfolioQuiz } from "./portfolio";
import { taxQuiz } from "./tax";
import { taxSupplementQuiz } from "./taxSupplement";

function variant(
  collection: QuizQuestion[],
  sourceId: string,
  id: string,
  values: Partial<QuizQuestion>,
): QuizQuestion {
  const source = collection.find((item) => item.id === sourceId);
  if (!source) throw new Error(`Missing source question ${sourceId}`);
  const variantSource = values.source ?? {
    ...source.source,
    note: [source.source.note, "Neue Zahlen- bzw. Sachverhaltsvariante derselben belegten Kursmethode."].filter(Boolean).join(" "),
  };
  return {
    ...source,
    ...values,
    id,
    difficulty: 3,
    diagnostic: false,
    source: variantSource,
  };
}

export const portfolioQuizVariants: QuizQuestion[] = [
  variant(portfolioQuiz, "pq08", "pqv01", {
    prompt: "Eine Aktie hat β=1,2, r𝒻=2% und E(rM)=8%. Ein Analyst erwartet 10%. Welche Kombination aus CAPM-Rendite und Bewertung ist richtig?",
    options: ["8,0% und fair bewertet", "10,0% und überbewertet", "9,2% und unterbewertet", "9,2% und überbewertet"],
    correct: 2,
    explanation: "CAPM verlangt 2%+1,2×(8%−2%)=9,2%. Die Analystenerwartung von 10% liegt darüber; die Aktie gilt in der Kurslogik als unterbewertet.",
    solutionSteps: ["Marktrisikoprämie: 8%−2%=6%.", "CAPM: 2%+1,2×6%=9,2%.", "10% > 9,2% → unterbewertet."],
    points: 5,
  }),
  variant(portfolioQuiz, "pq02", "pqv02", {
    prompt: "45% eines Portfolios liegen in einer Aktie mit E(r)=14% und σ=20%, der Rest risikofrei zu 2%. Welche Kombination ist richtig?",
    options: ["E(rₚ)=9,0%; σₚ=7,4%", "E(rₚ)=7,4%; σₚ=9,0%", "E(rₚ)=7,4%; σₚ=20,0%", "E(rₚ)=6,3%; σₚ=11,0%"],
    correct: 1,
    explanation: "E(rₚ)=0,45×14%+0,55×2%=7,4%. Da nur die Aktie Risiko trägt, ist σₚ=0,45×20%=9%.",
    solutionSteps: ["Gewichte: 0,45 und 0,55.", "Rendite: 6,3%+1,1%=7,4%.", "Volatilität: 0,45×20%=9%."],
    points: 5,
  }),
  variant(portfolioQuiz, "pq22", "pqv03", {
    prompt: "Portfolio P erzielt 7,4%. r𝒻=2%, βP=1,1 und E(rM)=8%. Wie hoch ist Jensen’s Alpha und wie lautet die Kursinterpretation?",
    options: ["+1,2%; unterbewertet", "−1,2%; überbewertet", "−0,6%; unterbewertet", "+0,6%; fair bewertet"],
    correct: 1,
    explanation: "CAPM verlangt 2%+1,1×6%=8,6%. α=7,4%−8,6%=−1,2%; die Rendite liegt unter der Benchmark.",
    solutionSteps: ["Marktprämie: 6%.", "CAPM-Benchmark: 8,6%.", "Alpha: −1,2%."],
    points: 5,
  }),
  variant(portfolioQuiz, "pq39", "pqv04", {
    prompt: "Portfolio: wA=35%, wB=65%, E(rA)=12%, E(rB)=6%, σA=18%, σB=10%, ρAB=−0,2. Welche Kombination ist näherungsweise richtig?",
    options: ["E(r)=8,1%; σ=8,1%", "E(r)=9,0%; σ=14,0%", "E(r)=8,1%; σ=4,2%", "E(r)=6,0%; σ=10,0%"],
    correct: 0,
    explanation: "Die gewichtete Rendite beträgt 8,1%. Die vollständige Zwei-Asset-Varianz ergibt rund 0,006556 und damit σ≈8,1%.",
    solutionSteps: ["E(r)=0,35×12%+0,65×6%=8,1%.", "Varianz einschließlich negativem Kovarianzterm berechnen.", "√0,006556≈8,1%."],
    points: 6,
  }),
  variant(portfolioQuiz, "pq38", "pqv05", {
    prompt: "Für zwei Assets gelten σA=12%, σB=8% und ρAB=0,25. Welches Gewicht von Asset A minimiert die Varianz?",
    options: ["75%", "50%", "25%", "0%"],
    correct: 2,
    explanation: "CovAB=0,25×0,12×0,08=0,0024. wA=(0,08²−0,0024)/(0,12²+0,08²−2×0,0024)=0,25.",
    solutionSteps: ["Kovarianz: 0,0024.", "Zähler: 0,0064−0,0024=0,004.", "Nenner: 0,016; wA=25%."],
    points: 6,
  }),
  variant(portfolioQuiz, "pq14", "pqv06", {
    prompt: "Ein Drei-Faktor-Modell hat r𝒻=2%, Betas 1,1 / 0,6 / −0,3 und Prämien 5% / 2% / 4%. Welche Rendite folgt?",
    options: ["9,9%", "7,5%", "5,5%", "11,1%"],
    correct: 1,
    explanation: "2%+1,1×5%+0,6×2%−0,3×4%=7,5%.",
    solutionSteps: ["Faktorbeiträge: 5,5%, 1,2%, −1,2%.", "Mit r𝒻: 2%+5,5%+1,2%−1,2%=7,5%."],
    points: 5,
  }),
  variant(portfolioQuiz, "pq24", "pqv07", {
    prompt: "P: r=11%, r𝒻=3%, σ=16%, β=1,25. Welche Kombination aus Sharpe- und Treynor-Ratio ist richtig?",
    options: ["0,50 und 6,40%", "0,69 und 10,00%", "6,40% und 0,50", "0,50 und 8,00%"],
    correct: 0,
    explanation: "Sharpe=(11−3)/16=0,50. Treynor=(11−3)/1,25=6,40%.",
    solutionSteps: ["Überschussrendite: 8%.", "Durch σ teilen: 0,50.", "Durch β teilen: 6,40%."],
    points: 5,
  }),
  variant(portfolioQuiz, "pq36", "pqv08", {
    prompt: "Abnormale Renditen im Ereignisfenster: −0,6%, +1,4%, +0,3%, −0,5%. Welcher CAR und welche Aussage sind richtig?",
    options: ["+0,6%; positive Modellabweichung, aber kein automatischer Kausalitätsbeweis", "+0,6%; sicher kausaler Effekt", "−0,6%; negative Modellabweichung", "+1,2%; semi-starke Effizienz widerlegt"],
    correct: 0,
    explanation: "Der CAR ist die Summe und beträgt +0,6%. Er beschreibt eine positive kumulierte abnormale Rendite, beweist allein aber keine Kausalität.",
    points: 5,
  }),
  variant(portfolioQuiz, "pq40", "pqv09", {
    prompt: "Ein ABS-Pool von EUR 200 Mio. verliert 9%. First Loss umfasst 2%, Junior 4% und Mezzanine 8% des Pools. Wie wird der Verlust verteilt?",
    options: ["First Loss 4; Junior 8; Mezzanine 6; Senior 0 Mio.", "First Loss 4; Junior 14; Mezzanine 0; Senior 0 Mio.", "Senior 18 Mio.; alle anderen 0", "First Loss 2; Junior 4; Mezzanine 8; Senior 4 Mio."],
    correct: 0,
    explanation: "EUR 18 Mio. Verlust treffen zuerst EUR 4 Mio. First Loss, dann EUR 8 Mio. Junior und anschließend EUR 6 Mio. Mezzanine.",
    solutionSteps: ["Gesamtverlust: 200×9%=18.", "First Loss: 4; Rest 14.", "Junior: 8; Rest 6.", "Mezzanine: 6; Senior: 0."],
    points: 6,
  }),
];

const allTaxQuestions = [...taxQuiz, ...taxSupplementQuiz];

export const taxQuizVariants: QuizQuestion[] = [
  variant(allTaxQuestions, "tq13", "tqv01", {
    prompt: "Eine KG erzielt EUR −60.000; B erhält 50%. B erhält außerdem EUR 14.000 Sondervergütung und trägt EUR 2.000 zugehörige Sonderbetriebsausgaben. Wie hoch sind Bs additive gewerbliche Einkünfte aus der Mitunternehmerschaft?",
    options: ["EUR −30.000", "EUR +12.000", "EUR −18.000", "EUR −42.000"],
    correct: 2,
    explanation: "Stufe 1 beträgt −30.000. Das Sonderergebnis der Stufe 2 ist +12.000. Beide Stufen werden addiert: Bs Einkünfte betragen −18.000.",
    solutionSteps: ["Stufe 1: −60.000×50%=−30.000.", "Stufe 2: 14.000−2.000=+12.000.", "Additive Einkünfte: −30.000+12.000=−18.000."],
    points: 6,
  }),
  variant(allTaxQuestions, "tq20", "tqv02", {
    prompt: "Das zu versteuernde Einkommen einer GmbH beträgt EUR 80.000. Welche Kombination aus Körperschaftsteuer, Solidaritätszuschlag und Gesamtbelastung folgt mit den Kurssätzen?",
    options: ["KSt 12.000; SolZ 660; gesamt 12.660", "KSt 12.660; SolZ 696,30; gesamt 13.356,30", "KSt 8.000; SolZ 440; gesamt 8.440", "KSt 12.000; SolZ 4.400; gesamt 16.400"],
    correct: 0,
    explanation: "KSt=80.000×15%=12.000. Der Solidaritätszuschlag beträgt 12.000×5,5%=660. Gesamt: EUR 12.660.",
    solutionSteps: ["KSt: 80.000×15%=12.000.", "SolZ: 12.000×5,5%=660.", "Gesamtbelastung: 12.660."],
    points: 6,
  }),
  variant(allTaxQuestions, "tq21", "tqv03", {
    prompt: "Dividende im Betriebsvermögen EUR 40.000, direkt zugehörige Aufwendungen EUR 4.000. Nach dem Teileinkünfteverfahren: Welcher steuerpflichtige Einkünftebeitrag entsteht?",
    options: ["EUR 24.000", "EUR 36.000", "EUR 21.600", "EUR 9.000 Steuer"],
    correct: 2,
    explanation: "60% der Dividende sind EUR 24.000; 60% der Aufwendungen EUR 2.400. Der Einkünftebeitrag beträgt EUR 21.600, nicht die Steuer.",
    solutionSteps: ["40.000×60%=24.000.", "4.000×60%=2.400.", "24.000−2.400=21.600."],
    points: 6,
  }),
  variant(allTaxQuestions, "tq26", "tqv04", {
    prompt: "GmbH-Gewinn EUR 400.040; Zinsaufwand EUR 260.000; keine weiteren Hinzurechnungen/Kürzungen; Hebesatz 400%. Welche Gewerbesteuer folgt nach dem Kursschema?",
    options: ["EUR 56.000", "EUR 58.100", "EUR 14.525", "EUR 60.200"],
    correct: 1,
    explanation: "(260.000−200.000)×25%=15.000 Hinzurechnung. Gewerbeertrag 415.040 → 415.000; Messbetrag 14.525; Gewerbesteuer 58.100.",
    solutionSteps: ["Hinzurechnung: 15.000.", "Gewerbeertrag abgerundet: 415.000.", "415.000×3,5%=14.525.", "14.525×400%=58.100."],
    points: 7,
  }),
  variant(allTaxQuestions, "tq29", "tqv05", {
    prompt: "Dieselbe Person kontrolliert Besitzunternehmen und Betriebs-GmbH; ein für den Betrieb wesentliches Grundstück wird überlassen. Welche vollständige Einordnung ist richtig?",
    options: ["Nur private Vermögensverwaltung", "Nur personelle Verflechtung", "Personelle und sachliche Verflechtung; Betriebsaufspaltung", "Gewerbliche Prägung ohne sachliche Verflechtung"],
    correct: 2,
    explanation: "Gemeinsame Kontrolle schafft die personelle, das wesentliche Grundstück die sachliche Verflechtung. Zusammen entsteht die Betriebsaufspaltung.",
    points: 5,
  }),
  variant(allTaxQuestions, "tq45", "tqv06", {
    prompt: "Eine in Deutschland ansässige Kapitalgesellschaft hält direkt 30% an USCo und ist Nutzungsberechtigte der Dividende. Das Abkommen entspricht der im Kurs geprüften OECD-MA-Systematik. Welche maximale Quellensteuer ist einschlägig?",
    options: ["15% wie bei einer Privatperson", "0% in jedem Fall", "5% für den qualifizierten Gesellschaftsempfänger", "25% nach dem Welteinkommensprinzip"],
    correct: 2,
    explanation: "Anders als beim privaten Empfänger fällt die qualifizierte Gesellschaftsbeteiligung in die 5%-Kategorie des im Kurs geprüften Art. 10-Schemas.",
    points: 5,
  }),
  variant(allTaxQuestions, "tq48", "tqv07", {
    prompt: "Welche Zuordnung der im EBS-Material geprüften 15%-Schwellen ist richtig?",
    options: ["CFC: effektive Mindeststeuer; GloBE: nur nominale Niedrigsteuer", "CFC: nominal 15% oder weniger; GloBE: 15% effektive Mindeststeuer", "Beide Regeln verwenden ausschließlich 25%", "CFC 5%; GloBE 10%"],
    correct: 1,
    explanation: "Das Material prüft bei der CFC-Regel eine nominale Niedrigbesteuerung von 15% oder weniger und bei GloBE eine effektive Mindeststeuer von 15%.",
    points: 5,
    source: {
      document: "EBS exam International Taxation FT 2023.pdf",
      location: "Questions 9–10 · PDF-S. 2",
      priority: "official-older",
      note: "Markierte EBS-Altklausur; beide 15%-Aussagen wurden im ausführlichen EBS-Fragenkatalog gegengeprüft.",
    },
  }),
];

export const quizVariants = [...portfolioQuizVariants, ...taxQuizVariants];
