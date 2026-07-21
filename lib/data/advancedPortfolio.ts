import type { SourceRef } from "../types";

export type ChainStep = {
  label: string; answer: number; unit: string; points: number; tolerance?: number; hint: string;
};

export type ChainTask = {
  id: string; topic: string; prompt: string; model: string; formula: string; totalPoints: number;
  steps: ChainStep[]; interpretation: string; interpretationKeywords: string[]; source: SourceRef;
};

export type FormulaNode = {
  id: string; title: string; group: string; formula: string; asks: string; inputs: string;
  meaning: string; unit: string; trap: string; related: string[];
};

const source: SourceRef = {
  document: "00.0_Study_Pack_2025_Solutions.pdf",
  location: "PDF-S. 95–111 · Portfolio-Rechenwege und Formelblatt FT2025",
  priority: "official-current",
  note: "Zahlen sind didaktisch variiert; Modelle, Bewertungslogik und typische Fehler folgen dem Kursmaterial.",
};

const round = (value: number, digits = 3) => Number(value.toFixed(digits));

export function createChainTasks(seed = Date.now()): ChainTask[] {
  let cursor = seed;
  const n = (min: number, max: number, step = 1) => min + ((Math.abs(Math.sin(cursor++)) * Math.floor((max-min)/step+1))|0)*step;
  const rf=n(2,4), rm=n(8,12), beta=n(8,15)/10, actual=n(8,15);
  const required=round(rf+beta*(rm-rf),2), alpha=round(actual-required,2);
  const w=n(3,7)/10, ra=n(7,13), rb=n(4,10), sa=n(9,15), sb=n(11,19), rho=n(-4,6)/10;
  const er=round(w*ra+(1-w)*rb,2);
  const variance=round((w*w*sa*sa+(1-w)*(1-w)*sb*sb+2*w*(1-w)*rho*sa*sb)/10000,6);
  const vol=round(Math.sqrt(variance)*100,2), sharpe=round((er-rf)/vol,3);
  const b1=n(7,14)/10,b2=n(4,11)/10,p1=n(3,6),p2=n(2,5),apt=round(rf+b1*p1+b2*p2,2);
  const ar=[n(-8,14)/10,n(-6,12)/10,n(-5,10)/10],car=round(ar.reduce((a,b)=>a+b,0),2);
  const wa=n(3,7)/10,ba=n(8,17)/10,bb=n(3,9)/10,bp=round(wa*ba+(1-wa)*bb,3);
  return [
    {id:"chain-risk",topic:"Diversification & Correlation",model:"Portfoliorendite → Varianz → Volatilität → Sharpe",formula:"E(rₚ)=ΣwᵢE(rᵢ); σₚ²=wA²σA²+wB²σB²+2wAwBρσAσB; S=(rₚ−r𝒻)/σₚ",prompt:`Ein Portfolio investiert ${(w*100).toFixed(0)}% in A (E[r]=${ra}%, σ=${sa}%) und den Rest in B (E[r]=${rb}%, σ=${sb}%). ρ=${rho}, r𝒻=${rf}%. Beurteile Rendite und risikoadjustierte Performance.`,totalPoints:9,steps:[{label:"Erwartete Portfoliorendite",answer:er,unit:"%",points:2,hint:"Gewichtete Renditen addieren."},{label:"Portfoliovarianz",answer:variance,unit:"",points:2,tolerance:.000012,hint:"Prozentwerte als Dezimalzahlen; Gewichte quadrieren."},{label:"Portfoliovolatilität",answer:vol,unit:"%",points:2,tolerance:.1,hint:"Wurzel aus der Varianz, dann ×100."},{label:"Sharpe Ratio",answer:sharpe,unit:"",points:1,tolerance:.015,hint:"Überschussrendite durch Volatilität."}],interpretation:"Die Volatilität berücksichtigt die Korrelation; die Sharpe Ratio misst Überschussrendite pro Einheit Gesamtrisiko.",interpretationKeywords:["korrelation","gesamtrisiko"],source},
    {id:"chain-capm",topic:"CAPM, SML & Beta",model:"CAPM → Fehlbewertung/Jensen",formula:"E(rᵢ)=r𝒻+βᵢ(E[rM]−r𝒻); α=rᵢ−E(rᵢ)",prompt:`Eine Aktie hat β=${beta}, erzielt ${actual}% Rendite; r𝒻=${rf}% und E(rM)=${rm}%. Beurteile ihre Performance gegenüber der SML.`,totalPoints:8,steps:[{label:"Marktrisikoprämie",answer:rm-rf,unit:"%",points:1,hint:"Markt minus risikofrei."},{label:"CAPM-Rendite",answer:required,unit:"%",points:3,tolerance:.06,hint:"r𝒻 + Beta × Marktrisikoprämie."},{label:"Jensen's Alpha",answer:alpha,unit:"%",points:2,tolerance:.06,hint:"Tatsächlich minus CAPM-Anforderung."}],interpretation:alpha>=0?"Positives Alpha: Die Aktie liegt oberhalb der SML und liefert mehr Rendite als für ihr Beta gefordert.":"Negatives Alpha: Die Aktie liegt unterhalb der SML und liefert weniger Rendite als für ihr Beta gefordert.",interpretationKeywords:[alpha>=0?"oberhalb":"unterhalb","sml"],source},
    {id:"chain-beta",topic:"CAPM, SML & Beta",model:"Gewichtetes Portfoliobeta",formula:"βₚ=Σwᵢβᵢ",prompt:`Portfolio A/B: wA=${round(wa*100,0)}%, βA=${ba}; wB=${round((1-wa)*100,0)}%, βB=${bb}. Bestimme das systematische Portfoliorisiko.`,totalPoints:6,steps:[{label:"Beta-Beitrag A",answer:round(wa*ba,3),unit:"",points:1,hint:"wA × βA."},{label:"Beta-Beitrag B",answer:round((1-wa)*bb,3),unit:"",points:1,hint:"wB × βB."},{label:"Portfoliobeta",answer:bp,unit:"",points:2,tolerance:.012,hint:"Beiträge addieren."}],interpretation:"Das Portfoliobeta misst die Sensitivität gegenüber Marktbewegungen und muss zwischen den Einzelbetas liegen.",interpretationKeywords:["markt","zwischen"],source},
    {id:"chain-apt",topic:"APT & Arbitrage",model:"Zwei-Faktor-APT",formula:"E(rᵢ)=r𝒻+β₁λ₁+β₂λ₂",prompt:`Ein Asset hat β₁=${b1} zur Prämie λ₁=${p1}% und β₂=${b2} zur Prämie λ₂=${p2}%; r𝒻=${rf}%. Welche Rendite verlangt das APT?`,totalPoints:7,steps:[{label:"Faktorbeitrag 1",answer:round(b1*p1,2),unit:"%",points:1,hint:"β₁×λ₁."},{label:"Faktorbeitrag 2",answer:round(b2*p2,2),unit:"%",points:1,hint:"β₂×λ₂."},{label:"APT-Rendite",answer:apt,unit:"%",points:3,tolerance:.06,hint:"r𝒻 plus beide Faktorbeiträge."}],interpretation:"Die erwartete Rendite kompensiert beide systematischen Faktorexposures; jedes Beta gehört zu seiner Faktorprämie.",interpretationKeywords:["faktor","beta"],source},
    {id:"chain-event",topic:"EMH & Event Study",model:"Abnormal Return → CAR",formula:"ARₜ=rₜ−E(rₜ); CAR=ΣARₜ",prompt:`Im Eventfenster wurden folgende abnormalen Renditen gemessen: ${ar.map(x=>`${x}%`).join(", ")}. Bestimme und interpretiere den CAR.`,totalPoints:5,steps:[{label:"Cumulative Abnormal Return",answer:car,unit:"%",points:3,tolerance:.04,hint:"Vorzeichen beachten und alle AR addieren."}],interpretation:`Der CAR von ${car}% ist die kumulierte abnormale Rendite im Eventfenster und beschreibt den aggregierten Ereigniseffekt.`,interpretationKeywords:["kumuliert","event"],source},
  ];
}

export const formulaNodes: FormulaNode[] = [
  {id:"return",title:"Portfolio Return",group:"Portfolio",formula:"E(rₚ)=ΣwᵢE(rᵢ)",asks:"Erwartete Portfoliorendite",inputs:"Gewichte, erwartete Einzelrenditen",meaning:"Gewichteter Renditemittelwert",unit:"%",trap:"Gewichte müssen 1 ergeben.",related:["variance","sharpe"]},
  {id:"variance",title:"Portfolio Variance",group:"Portfolio",formula:"σₚ²=ΣᵢΣⱼwᵢwⱼCovᵢⱼ",asks:"Gesamtrisiko vor der Wurzel",inputs:"Gewichte, Volatilitäten, Korrelation/Kovarianz",meaning:"Risiko inklusive Zusammenwirken der Assets",unit:"Varianz",trap:"Gewichte und Volatilitäten im Einzelterm quadrieren; danach ggf. Wurzel.",related:["return","mvp","sharpe"]},
  {id:"mvp",title:"Minimum Variance",group:"Portfolio",formula:"wA*=(σB²−CovAB)/(σA²+σB²−2CovAB)",asks:"Risikominimales Gewicht",inputs:"Varianzen und Kovarianz",meaning:"Gewicht am globalen Risikominimum",unit:"Gewicht",trap:"Korrelation zuerst in Kovarianz umwandeln.",related:["variance"]},
  {id:"beta",title:"Beta",group:"Kapitalmarkt",formula:"βᵢ=Cov(rᵢ,rM)/σM²",asks:"Systematisches Risiko",inputs:"Kovarianz mit Markt, Marktvarianz",meaning:"Marktsensitivität",unit:"ohne Einheit",trap:"Beta ist nicht Gesamtrisiko.",related:["capm","jensen"]},
  {id:"capm",title:"CAPM",group:"Kapitalmarkt",formula:"E(rᵢ)=r𝒻+βᵢ(E[rM]−r𝒻)",asks:"Geforderte Rendite",inputs:"r𝒻, Beta, Marktrendite",meaning:"Kompensation für systematisches Risiko",unit:"%",trap:"Beta nur mit der Marktrisikoprämie multiplizieren.",related:["beta","jensen","apt"]},
  {id:"apt",title:"APT",group:"Kapitalmarkt",formula:"E(rᵢ)=r𝒻+Σβᵢkλk",asks:"Mehrfaktor-Rendite",inputs:"Faktorbetas und -prämien",meaning:"Kompensation mehrerer systematischer Risiken",unit:"%",trap:"Beta und Prämie faktorweise paaren.",related:["capm"]},
  {id:"sharpe",title:"Sharpe Ratio",group:"Performance",formula:"(rₚ−r𝒻)/σₚ",asks:"Rendite pro Gesamtrisiko",inputs:"Rendite, r𝒻, Standardabweichung",meaning:"Überschussrendite je Einheit Gesamtrisiko",unit:"Ratio",trap:"Standardabweichung, nicht Beta.",related:["treynor","jensen","variance"]},
  {id:"treynor",title:"Treynor Ratio",group:"Performance",formula:"(rₚ−r𝒻)/βₚ",asks:"Rendite pro systematischem Risiko",inputs:"Rendite, r𝒻, Beta",meaning:"Überschussrendite je Beta-Einheit",unit:"Ratio",trap:"Nur sinnvoll für gut diversifizierte Portfolios.",related:["sharpe","jensen"]},
  {id:"jensen",title:"Jensen's Alpha",group:"Performance",formula:"αₚ=rₚ−[r𝒻+βₚ(rM−r𝒻)]",asks:"Abweichung von CAPM",inputs:"Tatsächliche Rendite und CAPM-Inputs",meaning:"Mehr-/Minderrendite relativ zur SML",unit:"%",trap:"Tatsächlich minus gefordert; Vorzeichen beachten.",related:["capm","beta","sharpe"]},
  {id:"ir",title:"Information Ratio",group:"Performance",formula:"IR=(rₚ−rBM)/TE",asks:"Aktive Rendite pro aktivem Risiko",inputs:"Portfolio-, Benchmarkrendite, Tracking Error",meaning:"Konsistenz aktiver Performance",unit:"Ratio",trap:"Benchmark statt risikofreiem Zins.",related:["sharpe"]},
  {id:"car",title:"CAR",group:"Event Study",formula:"CAR(τ₁,τ₂)=ΣARₜ",asks:"Kumulierten Ereigniseffekt",inputs:"Abnormale Renditen im Fenster",meaning:"Aggregierter abnormaler Return",unit:"%",trap:"Summe, nicht Durchschnitt.",related:["capm"]},
];

export const detectiveCases = [
  {id:"weights",title:"Gewichte nicht quadriert",lines:["σₚ² = wA σA² + wB σB² + 2wAwBρσAσB","σₚ = √σₚ²"],wrong:0,why:"In den beiden Einzelvarianzbeiträgen müssen die Gewichte quadriert werden."},
  {id:"covariance",title:"Korrelation direkt eingesetzt",lines:["CovAB = ρAB", "σₚ² = wA²σA² + wB²σB² + 2wAwBCovAB"],wrong:0,why:"Kovarianz ist ρAB·σA·σB; Korrelation allein hat eine andere Skala."},
  {id:"root",title:"Varianz als Volatilität berichtet",lines:["σₚ² = 0,0064", "σₚ = 0,0064 = 0,64%"],wrong:1,why:"Für die Standardabweichung muss die Wurzel gezogen werden: √0,0064 = 0,08 = 8%."},
  {id:"sharpe",title:"Risikofreien Zins vergessen",lines:["Sharpe = rₚ / σₚ", "Sharpe = 10% / 15% = 0,667"],wrong:0,why:"Sharpe verwendet Überschussrendite: (rₚ−r𝒻)/σₚ."},
  {id:"jensen",title:"Alpha-Vorzeichen vertauscht",lines:["CAPM-Anforderung = 9%", "Tatsächliche Rendite = 11%", "α = 9% − 11% = −2%"],wrong:2,why:"Jensen Alpha ist tatsächliche minus geforderte Rendite, hier +2%."},
  {id:"beta",title:"Beta als Gesamtrisiko",lines:["βₚ = 1,2", "Das Portfolio hat eine Volatilität von 120%."],wrong:1,why:"Beta misst Marktsensitivität/systematisches Risiko, nicht die Standardabweichung."},
];

