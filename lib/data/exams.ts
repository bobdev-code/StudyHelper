import type {
  ErrorType,
  ExamModeId,
  SourceRef,
  Subject,
  TaxDiagramAnswer,
} from "../types";

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
  helpDe?: string;
  points: number;
  targetMinutes: number;
  responseType: "choice" | "text" | "diagram";
  options?: string[];
  correctOption?: number;
  rubric: ExamRubricItem[];
  modelAnswer: string;
  modelDiagram?: TaxDiagramAnswer;
  errorType: ErrorType;
  source: SourceRef;
};

export type ExamVariant = {
  id: string;
  labelDe: string;
  labelEn: string;
  blocks: ExamBlock[];
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
  variants: ExamVariant[];
  blocks: ExamBlock[];
};

const portfolio2025 = (pages: string, note?: string): SourceRef => ({
  document: "00.0_Study_Pack_2025_Solutions.pdf",
  location: `BSC Portfolio Management Resit FT2025 · PDF-S. ${pages}`,
  priority: "official-solution",
  note: note ?? "Official 2025 structure and solution method; names and figures are varied for independent practice.",
});

const portfolioWorkshop = (slides: string): SourceRef => ({
  document: "Exam_Prep_2025.pptx",
  location: `Slides ${slides}`,
  priority: "official-current",
  note: "Formula choice and calculation path follow the official exam-preparation deck.",
});

const taxCaseDocuments: Record<number, string> = {
  4: "EBS - BSc DStR task 4_with solution_2025.pdf",
  6: "EBS - BSc DStR task 6_ with solution 2025.pdf",
  7: "EBS - BSc DStR task 7_ with solution 2025.pdf",
  8: "EBS - BSc DStR task 8_ with solution 2025.pdf",
  9: "EBS - BSc DStR task 9_ with solution 2025.pdf",
};

const taxCase = (task: number, pages: string): SourceRef => ({
  document: `German and International Taxation.zip → ${taxCaseDocuments[task]}`,
  location: `Case ${task} · PDF-S. ${pages}`,
  priority: "official-solution",
  note: "New fact pattern using the official 2025 solution structure.",
});

const internationalCatalog = (location: string): SourceRef => ({
  document: "EBS - Taxation - Single Choice Questions.pdf",
  location,
  priority: "official-current",
  note: "Converted from a verified course-catalog rule into a written case; no new tax rule is introduced.",
});

const pct = (value: number, digits = 2) => `${(value * 100).toFixed(digits).replace(/\.?0+$/, "")}%`;
const money = (value: number) => `EUR ${Math.round(value).toLocaleString("en-US")}`;
const r4 = (value: number) => Math.round(value * 10_000) / 10_000;

function rotatedChoice(correct: string, distractors: string[], rotation: number) {
  const entries = [correct, ...distractors];
  const shift = rotation % entries.length;
  const options = [...entries.slice(shift), ...entries.slice(0, shift)];
  return { options, correctOption: options.indexOf(correct) };
}

type PortfolioSpec = {
  id: "a" | "b" | "c";
  label: string;
  rotation: number;
  capital: number;
  stockInvestment: number;
  stockReturn: number;
  riskFree: number;
  stockVariance: number;
  tfClaimReturnDelta: number;
  tfClaimVolDelta: number;
  capmSigma: number;
  marketSigma: number;
  marketCorrelation: number;
  marketReturn: number;
  capmClaimDelta: number;
  sharpeReturn: number;
  sharpeSigma: number;
  jensenReturn: number;
  jensenBeta: number;
  aptBetas: [number, number, number];
  aptPremiums: [number, number, number];
  currentPrice: number;
  targetPrice: number;
  assetBeta: number;
  assetOneSigma: number;
  assetTwoSigma: number;
  assetCorrelation: number;
  assetTwoReturn: number;
  fundA: { alpha: number; beta: number };
  fundB: { alpha: number; beta: number };
  abnormalReturns: number[];
  pool: number;
  defaultRate: number;
  firstLoss: number;
  junior: number;
};

const portfolioSpecs: PortfolioSpec[] = [
  {
    id: "a", label: "Mock A · FT2025 structure", rotation: 0,
    capital: 20_000, stockInvestment: 8_000, stockReturn: .12, riskFree: .04, stockVariance: .04,
    tfClaimReturnDelta: 0, tfClaimVolDelta: 0,
    capmSigma: .20, marketSigma: .15, marketCorrelation: .75, marketReturn: .08, capmClaimDelta: .01,
    sharpeReturn: .10, sharpeSigma: .15, jensenReturn: .125, jensenBeta: 1.4,
    aptBetas: [1.5, .8, 1.2], aptPremiums: [.04, .03, .05],
    currentPrice: 571.85, targetPrice: 660, assetBeta: 1.4,
    assetOneSigma: .07, assetTwoSigma: .041, assetCorrelation: .25, assetTwoReturn: .1155,
    fundA: { alpha: .02, beta: .9 }, fundB: { alpha: .03, beta: 1.6 },
    abnormalReturns: [-.008, .011, .005, -.002],
    pool: 100, defaultRate: .10, firstLoss: .05, junior: .10,
  },
  {
    id: "b", label: "Mock B · transfer variant", rotation: 1,
    capital: 30_000, stockInvestment: 12_000, stockReturn: .11, riskFree: .03, stockVariance: .0225,
    tfClaimReturnDelta: .005, tfClaimVolDelta: 0,
    capmSigma: .24, marketSigma: .16, marketCorrelation: .50, marketReturn: .09, capmClaimDelta: 0,
    sharpeReturn: .11, sharpeSigma: .16, jensenReturn: .11, jensenBeta: 1.2,
    aptBetas: [1.2, .6, 1.4], aptPremiums: [.05, .025, .04],
    currentPrice: 244.50, targetPrice: 290, assetBeta: 1.1,
    assetOneSigma: .06, assetTwoSigma: .035, assetCorrelation: -.10, assetTwoReturn: .075,
    fundA: { alpha: .018, beta: .8 }, fundB: { alpha: .032, beta: 1.4 },
    abnormalReturns: [-.004, .009, .003, .001],
    pool: 120, defaultRate: .13, firstLoss: .04, junior: .06,
  },
  {
    id: "c", label: "Mock C · mixed repair", rotation: 2,
    capital: 25_000, stockInvestment: 10_000, stockReturn: .14, riskFree: .025, stockVariance: .0324,
    tfClaimReturnDelta: 0, tfClaimVolDelta: .01,
    capmSigma: .18, marketSigma: .12, marketCorrelation: .60, marketReturn: .085, capmClaimDelta: -.01,
    sharpeReturn: .09, sharpeSigma: .12, jensenReturn: .095, jensenBeta: .9,
    aptBetas: [1.1, .7, 1.3], aptPremiums: [.045, .035, .03],
    currentPrice: 180, targetPrice: 205, assetBeta: .9,
    assetOneSigma: .05, assetTwoSigma: .08, assetCorrelation: .20, assetTwoReturn: .13,
    fundA: { alpha: .015, beta: .7 }, fundB: { alpha: .025, beta: 1.3 },
    abnormalReturns: [-.006, .004, .008, -.001],
    pool: 80, defaultRate: .15, firstLoss: .05, junior: .08,
  },
];

function createPortfolioVariant(spec: PortfolioSpec): ExamVariant {
  const prefix = `pf-${spec.id}`;
  const weight = spec.stockInvestment / spec.capital;
  const expectedReturn = weight * spec.stockReturn + (1 - weight) * spec.riskFree;
  const stockSigma = Math.sqrt(spec.stockVariance);
  const portfolioSigma = weight * stockSigma;
  const claimedReturn = expectedReturn + spec.tfClaimReturnDelta;
  const claimedVol = portfolioSigma + spec.tfClaimVolDelta;
  const beta = spec.marketCorrelation * spec.capmSigma / spec.marketSigma;
  const capmReturn = spec.riskFree + beta * (spec.marketReturn - spec.riskFree);
  const capmClaim = capmReturn + spec.capmClaimDelta;
  const sharpe = (spec.sharpeReturn - spec.riskFree) / spec.sharpeSigma;
  const jensen = spec.jensenReturn - (spec.riskFree + spec.jensenBeta * (spec.marketReturn - spec.riskFree));
  const apt = spec.riskFree + spec.aptBetas.reduce((sum, value, index) => sum + value * spec.aptPremiums[index], 0);
  const impliedTargetReturn = spec.targetPrice / spec.currentPrice - 1;
  const assetCapm = spec.riskFree + spec.assetBeta * (spec.marketReturn - spec.riskFree);
  const mvpWeight = (
    spec.assetTwoSigma ** 2 - spec.assetCorrelation * spec.assetOneSigma * spec.assetTwoSigma
  ) / (
    spec.assetOneSigma ** 2 + spec.assetTwoSigma ** 2
    - 2 * spec.assetCorrelation * spec.assetOneSigma * spec.assetTwoSigma
  );
  const mvpReturn = mvpWeight * assetCapm + (1 - mvpWeight) * spec.assetTwoReturn;
  const mvpVariance = mvpWeight ** 2 * spec.assetOneSigma ** 2
    + (1 - mvpWeight) ** 2 * spec.assetTwoSigma ** 2
    + 2 * mvpWeight * (1 - mvpWeight) * spec.assetCorrelation * spec.assetOneSigma * spec.assetTwoSigma;
  const mvpSigma = Math.sqrt(mvpVariance);
  const t2 = spec.fundB.alpha * spec.fundA.beta / spec.fundB.beta - spec.fundA.alpha;
  const car = spec.abnormalReturns.reduce((sum, value) => sum + value, 0);
  const totalLoss = spec.pool * spec.defaultRate;
  const firstLossAmount = spec.pool * spec.firstLoss;
  const juniorLoss = Math.min(spec.pool * spec.junior, Math.max(0, totalLoss - firstLossAmount));
  const remainingLoss = Math.max(0, totalLoss - firstLossAmount - juniorLoss);
  const tf1Correct = spec.tfClaimReturnDelta === 0 && spec.tfClaimVolDelta === 0;
  const tf3Correct = spec.capmClaimDelta === 0;
  const cmlChoice = rotatedChoice(
    "It shows the risk-return trade-off for efficient portfolios combining the market portfolio and a risk-free asset.",
    [
      "It prices every individual asset solely by total volatility.",
      "It is the minimum-variance frontier of risky assets without a risk-free asset.",
      "It measures abnormal return relative to a benchmark.",
    ],
    spec.rotation,
  );
  const marketChoice = rotatedChoice(
    spec.id === "a"
      ? "Reflexivity describes a feedback loop between biased perceptions and market prices."
      : spec.id === "b"
        ? "Semi-strong efficiency means prices reflect all publicly available information."
        : "ESG integration may support risk management, regulation and revenue opportunities; it does not eliminate governance.",
    spec.id === "a"
      ? ["Reflexivity is identical to the random-walk hypothesis.", "Reflexivity assumes perceptions never influence fundamentals.", "Reflexivity applies only to risk-free assets."]
      : spec.id === "b"
        ? ["Semi-strong efficiency includes private insider information.", "Semi-strong efficiency uses only historical prices.", "Semi-strong efficiency guarantees identical investor returns."]
        : ["ESG eliminates the need for governance.", "ESG guarantees positive alpha.", "ESG removes all environmental risk."],
    spec.rotation + 1,
  );
  const sharpeChoice = rotatedChoice(
    sharpe.toFixed(2),
    [(sharpe * 10).toFixed(2), ((spec.sharpeReturn - spec.riskFree) / spec.jensenBeta).toFixed(2), pct(spec.sharpeReturn - spec.riskFree)],
    spec.rotation + 2,
  );
  const jensenChoice = rotatedChoice(
    pct(jensen),
    [pct(-jensen), pct(spec.jensenReturn - spec.riskFree), pct(spec.jensenReturn)],
    spec.rotation + 3,
  );
  const aptChoice = rotatedChoice(
    pct(apt),
    [pct(apt - .02), pct(apt + .015), pct(spec.aptPremiums.reduce((sum, value) => sum + value, 0))],
    spec.rotation,
  );

  const blocks: ExamBlock[] = [
    {
      id: `${prefix}-tf-return`, subject: "portfolio", topic: "Risk & Return",
      title: "True / False I · Return and volatility",
      prompt: `${money(spec.stockInvestment)} of ${money(spec.capital)} is invested in a stock with E(r)=${pct(spec.stockReturn)} and variance ${spec.stockVariance}; the remainder earns ${pct(spec.riskFree)} risk-free. Statement: portfolio return is ${pct(claimedReturn)} and volatility is ${pct(claimedVol)}. Decide TRUE, FALSE or UNCERTAIN and justify.`,
      helpDe: "Prüfe zuerst das Aktiengewicht. Beim risikofreien Anteil sind Varianz und Kovarianz null.",
      points: 6, targetMinutes: 6, responseType: "text",
      rubric: [{ label: "Clear verdict", points: 1 }, { label: `Weight ${pct(weight)}`, points: 1 }, { label: `Return ${pct(expectedReturn)}`, points: 2 }, { label: `Volatility ${pct(portfolioSigma)}`, points: 2 }],
      modelAnswer: `${tf1Correct ? "TRUE" : "FALSE"}. wStock=${pct(weight)}. E(rp)=${pct(expectedReturn)}. σStock=√${spec.stockVariance}=${pct(stockSigma)} and σp=wStock×σStock=${pct(portfolioSigma)} because the remaining asset is risk-free.`,
      errorType: "Rechenfehler", source: portfolio2025("3-4"),
    },
    {
      id: `${prefix}-tf-correlation`, subject: "portfolio", topic: "Diversification & Correlation",
      title: "True / False II · Perfect negative correlation",
      prompt: "Two risky assets are perfectly negatively correlated. A risk-averse investor chooses the zero-variance combination. Statement: under the course's MPT assumptions, that synthetic riskless portfolio must offer the risk-free return. Decide and justify, preferably with a frontier sketch.",
      helpDe: "Bei ρ=-1 kann eine passende Gewichtung σp=0 erzeugen. Vergleiche danach Renditen gleich riskanter Anlagen.",
      points: 6, targetMinutes: 6, responseType: "text",
      rubric: [{ label: "TRUE under the stated assumptions", points: 1 }, { label: "ρ=-1 and suitable weights can create σ²=0", points: 2 }, { label: "No-arbitrage comparison with risk-free asset", points: 2 }, { label: "Useful sketch or concise interpretation", points: 1 }],
      modelAnswer: "TRUE under the course assumptions. With ρ=-1, a suitable combination can have σ²=0. A zero-risk portfolio and the risk-free asset cannot persistently offer different returns without an arbitrage trade.",
      errorType: "Interpretation fehlt", source: portfolio2025("5"),
    },
    {
      id: `${prefix}-tf-capm`, subject: "portfolio", topic: "CAPM, SML & Beta",
      title: "True / False III · CAPM application",
      prompt: `A stock has σi=${pct(spec.capmSigma)}, σM=${pct(spec.marketSigma)} and ρiM=${spec.marketCorrelation}. With rf=${pct(spec.riskFree)} and E(rM)=${pct(spec.marketReturn)}, the statement claims CAPM requires ${pct(capmClaim)}. Decide and justify.`,
      helpDe: "Berechne zuerst β=ρiM·σi/σM und setze es dann in das CAPM ein.",
      points: 6, targetMinutes: 6, responseType: "text",
      rubric: [{ label: "Clear verdict", points: 1 }, { label: `Beta ${r4(beta)}`, points: 2 }, { label: `CAPM return ${pct(capmReturn)}`, points: 2 }, { label: "SML interpretation", points: 1 }],
      modelAnswer: `${tf3Correct ? "TRUE" : "FALSE"}. β=ρiMσi/σM=${r4(beta)}. CAPM=${pct(spec.riskFree)}+${r4(beta)}×(${pct(spec.marketReturn)}-${pct(spec.riskFree)})=${pct(capmReturn)}.`,
      errorType: "falsche Formel", source: portfolio2025("6"),
    },
    {
      id: `${prefix}-tf-markets`, subject: "portfolio", topic: spec.id === "a" ? "Behavioral Finance" : spec.id === "b" ? "EMH & Event Study" : "ESG",
      title: "True / False IV · Market interpretation",
      prompt: spec.id === "a"
        ? "Statement: Under Soros' reflexivity, biased investor perceptions can influence prices and the price movement can then reinforce those perceptions. Decide and explain."
        : spec.id === "b"
          ? "Statement: Semi-strong market efficiency means that prices reflect public information, but not necessarily private insider information. Decide and explain."
          : "Statement: Companies integrate ESG information partly for risk management, regulation and revenue opportunities; this makes corporate governance unnecessary. Decide and explain.",
      helpDe: "Definiere den Begriff knapp und prüfe anschließend jeden Teil der Aussage.",
      points: 6, targetMinutes: 6, responseType: "text",
      rubric: [{ label: "Correct verdict", points: 1 }, { label: "Core concept defined", points: 3 }, { label: "Application to the statement", points: 2 }],
      modelAnswer: spec.id === "a"
        ? "TRUE. Reflexivity is the two-way feedback between participants' perceptions and prices/fundamentals; it can create self-reinforcing booms or busts."
        : spec.id === "b"
          ? "TRUE. Semi-strong efficiency includes all publicly available information. Private insider information belongs to the strong-form benchmark."
          : "FALSE. The first purposes are valid, but ESG integration supports rather than eliminates corporate governance.",
      errorType: "Wissenslücke", source: portfolio2025(spec.id === "c" ? "8" : "7-8"),
    },
    {
      id: `${prefix}-mc-cml`, subject: "portfolio", topic: "Capital Market Line",
      title: "Single Choice I · CML", prompt: "Which statement best describes the Capital Market Line?",
      points: 3, targetMinutes: 3, responseType: "choice", ...cmlChoice,
      rubric: [{ label: "Best answer selected", points: 3 }], modelAnswer: cmlChoice.options[cmlChoice.correctOption],
      errorType: "Wissenslücke", source: portfolio2025("8"),
    },
    {
      id: `${prefix}-mc-market`, subject: "portfolio", topic: spec.id === "a" ? "Behavioral Finance" : spec.id === "b" ? "EMH & Event Study" : "ESG",
      title: "Single Choice II · Markets", prompt: "Choose the statement that matches the course material.",
      points: 3, targetMinutes: 3, responseType: "choice", ...marketChoice,
      rubric: [{ label: "Best answer selected", points: 3 }], modelAnswer: marketChoice.options[marketChoice.correctOption],
      errorType: "Wissenslücke", source: portfolio2025("7-8"),
    },
    {
      id: `${prefix}-mc-sharpe`, subject: "portfolio", topic: "Performance Measures",
      title: "Single Choice III · Sharpe ratio",
      prompt: `A portfolio earns ${pct(spec.sharpeReturn)}, rf=${pct(spec.riskFree)} and σp=${pct(spec.sharpeSigma)}. What is its Sharpe ratio?`,
      points: 4, targetMinutes: 4, responseType: "choice", ...sharpeChoice,
      rubric: [{ label: "Correct calculation", points: 4 }], modelAnswer: `(${pct(spec.sharpeReturn)}-${pct(spec.riskFree)})/${pct(spec.sharpeSigma)}=${sharpe.toFixed(2)}.`,
      errorType: "falsche Formel", source: portfolio2025("9"),
    },
    {
      id: `${prefix}-mc-jensen`, subject: "portfolio", topic: "Performance Measures",
      title: "Single Choice IV · Jensen's alpha",
      prompt: `rp=${pct(spec.jensenReturn)}, rf=${pct(spec.riskFree)}, βp=${spec.jensenBeta}, rM=${pct(spec.marketReturn)}. What is Jensen's alpha?`,
      points: 4, targetMinutes: 4, responseType: "choice", ...jensenChoice,
      rubric: [{ label: "Correct calculation", points: 4 }], modelAnswer: `αJ=rp-[rf+β(rM-rf)]=${pct(jensen)}.`,
      errorType: "falsche Formel", source: portfolioWorkshop("21-22"),
    },
    {
      id: `${prefix}-mc-apt`, subject: "portfolio", topic: "APT & Arbitrage",
      title: "Single Choice V · APT",
      prompt: `rf=${pct(spec.riskFree)}. Factor betas are ${spec.aptBetas.join(", ")} and premiums are ${spec.aptPremiums.map((item) => pct(item)).join(", ")}. What return does the multi-factor model imply?`,
      points: 4, targetMinutes: 4, responseType: "choice", ...aptChoice,
      rubric: [{ label: "Correct multi-factor calculation", points: 4 }], modelAnswer: `rf+ΣβkFk=${pct(apt)}.`,
      errorType: "Rechenfehler", source: portfolioWorkshop("16-17"),
    },
    {
      id: `${prefix}-short-mvp`, subject: "portfolio", topic: "Minimum-Variance Portfolio",
      title: "Short Answer I · CAPM, target price and MVP",
      prompt: `Asset A trades at ${money(spec.currentPrice)}, βA=${spec.assetBeta}, σA=${pct(spec.assetOneSigma)}. rf=${pct(spec.riskFree)} and E(rM)=${pct(spec.marketReturn)}. An analyst target is ${money(spec.targetPrice)}. Asset B has E(rB)=${pct(spec.assetTwoReturn)}, σB=${pct(spec.assetTwoSigma)} and ρAB=${spec.assetCorrelation}. (a) Calculate CAPM return. (b) Compare the analyst-implied return with CAPM and assess the target. (c) Calculate the two-asset MVP weights, return and volatility, and sketch the frontier.`,
      helpDe: "Trenne CAPM, Kurszielrendite und Minimum-Varianz-Portfolio. Beim Urteil geht es um das Kursziel des Analysten.",
      points: 20, targetMinutes: 20, responseType: "text",
      rubric: [{ label: `CAPM return ${pct(assetCapm)}`, points: 5 }, { label: `Target-implied return ${pct(impliedTargetReturn)}`, points: 3 }, { label: "Target assessment explained", points: 2 }, { label: `MVP weight A ${pct(mvpWeight)}`, points: 4 }, { label: `MVP return ${pct(mvpReturn)}`, points: 2 }, { label: `MVP volatility ${pct(mvpSigma)}`, points: 2 }, { label: "Plausible frontier sketch", points: 2 }],
      modelAnswer: `CAPM=${pct(assetCapm)}. The target implies ${pct(impliedTargetReturn)}; ${impliedTargetReturn > assetCapm ? "the analyst target is above the CAPM-consistent target (analyst overvaluation)" : "the analyst target is below the CAPM-consistent target (analyst undervaluation)"}. wA*=${pct(mvpWeight)}, wB*=${pct(1 - mvpWeight)}, E(rMVP)=${pct(mvpReturn)}, σMVP=${pct(mvpSigma)}.`,
      errorType: "Rechenfehler", source: portfolio2025("10-13"),
    },
    {
      id: `${prefix}-short-t2`, subject: "portfolio", topic: "Performance Measures",
      title: "Short Answer II · T² comparison",
      prompt: `Fund A has αA=${pct(spec.fundA.alpha)} and βA=${spec.fundA.beta}; Fund B has αB=${pct(spec.fundB.alpha)} and βB=${spec.fundB.beta}. Rescale B to A's beta, calculate T²=αB*−αA, and interpret.`,
      helpDe: "Skaliere zunächst das Beta von B mit w*=βA/βB; das Alpha wird mit demselben Gewicht skaliert.",
      points: 9, targetMinutes: 9, responseType: "text",
      rubric: [{ label: `Rescaling weight ${(spec.fundA.beta / spec.fundB.beta).toFixed(4)}`, points: 3 }, { label: `Scaled alpha ${pct(spec.fundB.alpha * spec.fundA.beta / spec.fundB.beta)}`, points: 2 }, { label: `T² ${pct(t2)}`, points: 2 }, { label: "Correct performance interpretation", points: 2 }],
      modelAnswer: `w*=βA/βB=${(spec.fundA.beta / spec.fundB.beta).toFixed(4)}. αB*=${pct(spec.fundB.alpha * spec.fundA.beta / spec.fundB.beta)}. T²=${pct(t2)}; ${t2 < 0 ? "B underperforms A after equalising systematic risk" : "B outperforms A after equalising systematic risk"}.`,
      errorType: "Interpretation fehlt", source: portfolio2025("14-15"),
    },
    {
      id: `${prefix}-short-emh`, subject: "portfolio", topic: "EMH & Event Study",
      title: "Short Answer III · EMH and event evidence",
      prompt: `State the weak, semi-strong and strong forms of market efficiency. Then calculate CAR for abnormal returns ${spec.abnormalReturns.map((item) => pct(item)).join(", ")} and explain what the sign does—and does not—prove.`,
      helpDe: "Ordne jeder EMH-Form ihre Informationsmenge zu. CAR ist die Summe der abnormalen Renditen.",
      points: 9, targetMinutes: 9, responseType: "text",
      rubric: [{ label: "Weak: past trading information", points: 1 }, { label: "Semi-strong: all public information", points: 1 }, { label: "Strong: public and private information", points: 1 }, { label: `CAR ${pct(car)}`, points: 3 }, { label: "Sign interpreted without claiming automatic causality", points: 3 }],
      modelAnswer: `Weak form: past prices/volume; semi-strong: all public information; strong: public and private information. CAR=${pct(car)}. Its sign shows cumulative model-adjusted performance in the event window, but alone does not establish causality.`,
      errorType: "Interpretation fehlt", source: portfolio2025("15-16"),
    },
    {
      id: `${prefix}-short-abs`, subject: "portfolio", topic: "Financial Innovation",
      title: "Short Answer IV · ABS loss waterfall",
      prompt: `An SPV holds a ${money(spec.pool * 1_000_000)} loan pool. The expected loss rate is ${pct(spec.defaultRate)}. The originator retains a ${pct(spec.firstLoss)} first-loss piece and the junior tranche is ${pct(spec.junior)} of the pool. Allocate losses sequentially; state the remaining loss for mezzanine/senior and explain subordination.`,
      helpDe: "Berechne zuerst den Gesamtverlust. Danach werden First Loss und Junior nacheinander verbraucht.",
      points: 10, targetMinutes: 10, responseType: "text",
      rubric: [{ label: `Total loss EUR ${totalLoss}m`, points: 2 }, { label: `Originator EUR ${firstLossAmount}m`, points: 2 }, { label: `Junior EUR ${juniorLoss}m`, points: 2 }, { label: `Remaining loss EUR ${remainingLoss}m`, points: 2 }, { label: "Subordination explained", points: 2 }],
      modelAnswer: `Total expected loss is EUR ${totalLoss}m. Originator absorbs EUR ${firstLossAmount}m, junior EUR ${juniorLoss}m, and EUR ${remainingLoss}m remains for the next tranche; senior is hit only after all subordinated protection is exhausted.`,
      errorType: "Rechenfehler", source: portfolio2025("17"),
    },
  ];
  return { id: `portfolio-${spec.id}`, labelDe: spec.label, labelEn: spec.label, blocks };
}

const diagramModels = {
  businessSplit: {
    nodes: [
      { id: 1, kind: "person", x: 100, y: 70, label: "Controlling individual" },
      { id: 2, kind: "partnership", x: 260, y: 240, label: "Possession entity" },
      { id: 3, kind: "corporation", x: 520, y: 240, label: "Operating GmbH" },
      { id: 4, kind: "building", x: 90, y: 240, label: "Essential building" },
    ],
    edges: [
      { id: 1, from: 1, to: 2, relation: "participation" },
      { id: 2, from: 1, to: 3, relation: "participation" },
      { id: 3, from: 4, to: 3, relation: "rental" },
    ],
  },
  intercompany: {
    nodes: [
      { id: 1, kind: "person", x: 100, y: 70, label: "Shareholder" },
      { id: 2, kind: "corporation", x: 320, y: 160, label: "Parent GmbH" },
      { id: 3, kind: "corporation", x: 520, y: 260, label: "Subsidiary GmbH" },
    ],
    edges: [
      { id: 1, from: 1, to: 2, relation: "participation" },
      { id: 2, from: 2, to: 3, relation: "participation" },
      { id: 3, from: 3, to: 2, relation: "dividend" },
    ],
  },
  specialAsset: {
    nodes: [
      { id: 1, kind: "person", x: 140, y: 70, label: "Limited partner" },
      { id: 2, kind: "partnership", x: 420, y: 230, label: "KG" },
      { id: 3, kind: "building", x: 140, y: 245, label: "Partner asset" },
    ],
    edges: [
      { id: 1, from: 1, to: 2, relation: "participation" },
      { id: 2, from: 3, to: 2, relation: "rental" },
    ],
  },
} satisfies Record<string, TaxDiagramAnswer>;

type TaxSpec = {
  id: "a" | "b" | "c";
  label: string;
  partnershipLoss: number;
  share: number;
  remuneration: number;
  specialExpense: number;
  capitalAccount: number;
  diagram: keyof typeof diagramModels;
  commercialProfit: number;
  fine: number;
  boardFee: number;
  interest: number;
  tradeProfit: number;
  multiplier: number;
};

const taxSpecs: TaxSpec[] = [
  { id: "a", label: "Mock A · core cases", partnershipLoss: 90_000, share: .60, remuneration: 18_000, specialExpense: 3_000, capitalAccount: 45_000, diagram: "businessSplit", commercialProfit: 70_000, fine: 4_000, boardFee: 12_000, interest: 240_000, tradeProfit: 300_040, multiplier: 4 },
  { id: "b", label: "Mock B · intercompany focus", partnershipLoss: 120_000, share: .50, remuneration: 24_000, specialExpense: 4_000, capitalAccount: 50_000, diagram: "intercompany", commercialProfit: 92_000, fine: 2_000, boardFee: 20_000, interest: 260_000, tradeProfit: 250_080, multiplier: 3.5 },
  { id: "c", label: "Mock C · special assets", partnershipLoss: 150_000, share: .40, remuneration: 30_000, specialExpense: 6_000, capitalAccount: 35_000, diagram: "specialAsset", commercialProfit: 55_000, fine: 5_000, boardFee: 10_000, interest: 280_000, tradeProfit: 330_060, multiplier: 4.4 },
];

function createTaxVariant(spec: TaxSpec) {
  const prefix = `tx-${spec.id}`;
  const stageOne = -spec.partnershipLoss * spec.share;
  const stageTwo = spec.remuneration - spec.specialExpense;
  const additiveIncome = stageOne + stageTwo;
  const deductibleLoss = Math.min(-stageOne, spec.capitalAccount);
  const suspendedLoss = Math.max(0, -stageOne - spec.capitalAccount);
  const taxableCorporateIncome = spec.commercialProfit + spec.fine + spec.boardFee * .5;
  const tradeAddBack = Math.max(0, spec.interest - 200_000) * .25;
  const tradeIncomeBeforeRounding = spec.tradeProfit + tradeAddBack;
  const roundedTradeIncome = Math.floor(tradeIncomeBeforeRounding / 100) * 100;
  const tradeTax = roundedTradeIncome * .035 * spec.multiplier;
  const diagramDefinition = spec.diagram === "businessSplit"
    ? {
        topic: "Business Split",
        title: "Graphical analysis · Betriebsaufspaltung",
        prompt: "Build a diagram showing the controlling individual, the possession entity, the operating GmbH and the essential building. Label participation and rental/transfer relationships. Then use the scratchpad to state personal nexus, material nexus and the income reclassification.",
        help: "Zeige personelle und sachliche Verflechtung sowie die Überlassung des wesentlichen Wirtschaftsguts.",
        answer: "The same individual can enforce a uniform business will in both entities (personal nexus), and an essential asset is provided to the operating company (material nexus). The possession activity is reclassified as business income.",
        source: taxCase(9, "1-2"),
      }
    : spec.diagram === "intercompany"
      ? {
          topic: "Corporate Dividends",
          title: "Graphical analysis · Intercompany dividend",
          prompt: "Build a diagram showing an individual shareholder, a parent GmbH and a subsidiary GmbH. Add both participation links and the dividend flow from subsidiary to parent. In the scratchpad, show the § 8b KStG exemption and 5% add-back logic.",
          help: "Zeige Beteiligungskette und Dividendenfluss getrennt. Ergänze § 8b Abs. 1 und Abs. 5 KStG.",
          answer: "The subsidiary distributes to the parent. At parent level the dividend is generally exempt under § 8b(1) KStG and 5% is treated as non-deductible expense under § 8b(5), subject to threshold checks.",
          source: taxCase(7, "5-7"),
        }
      : {
          topic: "Special Business Assets",
          title: "Graphical analysis · Special business asset",
          prompt: "Build a diagram showing a limited partner, the KG and a building owned by the partner but provided to the KG. Label participation and rental/transfer. In the scratchpad, classify the building and remuneration within the two-stage partnership-profit calculation.",
          help: "Das Wirtschaftsgut dient unmittelbar dem Betrieb der KG. Prüfe Sonderbetriebsvermögen I und Sondervergütung.",
          answer: "The partner's building directly serves the KG and is special business asset I. Rental remuneration and related expenses enter the partner's stage-two special result under § 15(1) sentence 1 no. 2 EStG.",
          source: taxCase(4, "4-6"),
        };

  const germanBlocks: ExamBlock[] = [
    {
      id: `${prefix}-partnership`, subject: "tax", topic: "Partnership & Co-Entrepreneurship",
      title: "Co-entrepreneurship · 30-point case",
      prompt: `A KG reports a tax-balance-sheet loss of ${money(spec.partnershipLoss)}. Partner B receives ${pct(spec.share, 0)} of the common result. B also receives ${money(spec.remuneration)} interest for a business loan and incurs ${money(spec.specialExpense)} related special business expenses. B is a limited partner; the relevant capital account before loss allocation is ${money(spec.capitalAccount)}. Examine tax liability, transparency, the two-stage profit determination, B's additive income and § 15a EStG.`,
      helpDe: "Aufbau: Steuerpflicht → Mitunternehmerschaft → Stufe 1 → Sonderbereich Stufe 2 → additive Einkünfte → § 15a.",
      points: 30, targetMinutes: 30, responseType: "text",
      rubric: [{ label: "Tax subject, transparency and § 15(1) sentence 1 no. 2 EStG", points: 5 }, { label: `Stage 1 ${money(stageOne)}`, points: 5 }, { label: `Stage 2 +${money(stageTwo)}`, points: 5 }, { label: `Additive income ${money(additiveIncome)}`, points: 5 }, { label: `Currently usable loss ${money(deductibleLoss)}`, points: 5 }, { label: `Suspended loss ${money(suspendedLoss)} and clear conclusion`, points: 5 }],
      modelAnswer: `The KG is transparent for income tax; B is assessed under § 15(1) sentence 1 no. 2 EStG. Stage 1: ${money(stageOne)}. Stage 2: ${money(spec.remuneration)}-${money(spec.specialExpense)}=+${money(stageTwo)}. Additive income: ${money(additiveIncome)}. Under § 15a, ${money(deductibleLoss)} of the allocated loss is currently usable and ${money(suspendedLoss)} is suspended; the positive special result remains part of the additive income calculation.`,
      errorType: "Rechtsfolge falsch", source: taxCase(4, "2-6"),
    },
    {
      id: `${prefix}-diagram`, subject: "tax", topic: diagramDefinition.topic,
      title: diagramDefinition.title, prompt: diagramDefinition.prompt, helpDe: diagramDefinition.help,
      points: 10, targetMinutes: 10, responseType: "diagram",
      rubric: [{ label: "Correct entities/assets", points: 3 }, { label: "Correct participation links", points: 2 }, { label: "Correct payment/transfer direction", points: 2 }, { label: "Tax nexus and consequence in scratchpad", points: 3 }],
      modelAnswer: diagramDefinition.answer, modelDiagram: diagramModels[spec.diagram],
      errorType: "Rechtsfolge falsch", source: diagramDefinition.source,
    },
    {
      id: `${prefix}-corporate`, subject: "tax", topic: "Corporate Income Tax",
      title: "Corporate taxable-income reconciliation",
      prompt: `A domestic GmbH reports commercial profit of ${money(spec.commercialProfit)}. It includes a non-deductible fine of ${money(spec.fine)} and supervisory-board remuneration of ${money(spec.boardFee)}. Determine taxable income before further corrections and explain the separation between commercial expense and tax correction.`,
      helpDe: "Geldbuße vollständig hinzurechnen; Aufsichtsratsvergütung zu 50% nicht abzugsfähig.",
      points: 10, targetMinutes: 10, responseType: "text",
      rubric: [{ label: "Unlimited corporate tax liability / business-income classification", points: 2 }, { label: `Fine add-back ${money(spec.fine)}`, points: 2 }, { label: `50% board-fee add-back ${money(spec.boardFee * .5)}`, points: 2 }, { label: `Taxable income ${money(taxableCorporateIncome)}`, points: 2 }, { label: "Commercial and tax treatment clearly separated", points: 2 }],
      modelAnswer: `Start with ${money(spec.commercialProfit)}. Add the full fine ${money(spec.fine)} and 50% of the supervisory-board remuneration, ${money(spec.boardFee * .5)}. Taxable income before other corrections is ${money(taxableCorporateIncome)}.`,
      errorType: "Norm nicht gefunden", source: taxCase(6, "3-5"),
    },
    {
      id: `${prefix}-trade`, subject: "tax", topic: "Trade Tax",
      title: "Trade-tax computation chain",
      prompt: `A GmbH has profit of ${money(spec.tradeProfit)} after deducting interest of ${money(spec.interest)}. No other add-backs or reductions apply. The municipal multiplier is ${Math.round(spec.multiplier * 100)}%. Use the course allowance of EUR 200,000 for § 8 no. 1 GewStG. Calculate trade tax.`,
      helpDe: "Reihenfolge: Gewinn → Finanzierungsanteil minus Freibetrag → 25% Hinzurechnung → Abrundung auf 100 EUR → 3,5% → Hebesatz.",
      points: 10, targetMinutes: 10, responseType: "text",
      rubric: [{ label: `Add-back ${money(tradeAddBack)}`, points: 3 }, { label: `Trade income before rounding ${money(tradeIncomeBeforeRounding)}`, points: 2 }, { label: `Rounded trade income ${money(roundedTradeIncome)}`, points: 1 }, { label: `Assessment amount ${money(roundedTradeIncome * .035)}`, points: 2 }, { label: `Trade tax ${money(tradeTax)}`, points: 2 }],
      modelAnswer: `(${money(spec.interest)}-EUR 200,000)×25%=${money(tradeAddBack)}. Trade income ${money(tradeIncomeBeforeRounding)}, rounded down to ${money(roundedTradeIncome)}. Assessment amount ${money(roundedTradeIncome * .035)}; trade tax at ${Math.round(spec.multiplier * 100)}% is ${money(tradeTax)}.`,
      errorType: "Rechenfehler", source: taxCase(8, "2-5"),
    },
  ];

  const internationalBlocks: ExamBlock[] = [
    {
      id: `${prefix}-intl-liability`, subject: "tax", topic: "International Tax Liability",
      title: "Residence and worldwide income",
      prompt: spec.id === "a"
        ? "Aisha keeps a home in Tehran and a permanently available apartment in Hattenheim that she actually uses while studying. Determine her personal German income-tax liability and the basic scope of income before treaty relief."
        : spec.id === "b"
          ? "Leo works abroad for most of the year but retains and regularly uses a permanently available apartment in Wiesbaden. Determine his personal German income-tax liability and the basic income scope before treaty allocation."
          : "Mira has no German citizenship but maintains and uses a permanent apartment in Mainz while receiving foreign rental income. Determine German personal tax liability and the order in which domestic liability and treaty relief are examined.",
      helpDe: "Staatsangehörigkeit ist nicht entscheidend. Prüfe Wohnsitz nach § 8 AO, dann § 1 Abs. 1 EStG und Welteinkommen; DTA erst danach.",
      points: 10, targetMinutes: 10, responseType: "text",
      rubric: [{ label: "Natural person", points: 1 }, { label: "Residence under § 8 AO", points: 3 }, { label: "§ 1(1) EStG", points: 2 }, { label: "Unlimited liability", points: 2 }, { label: "Worldwide-income principle; treaty check afterwards", points: 2 }],
      modelAnswer: "The permanently available and used German apartment establishes residence under § 8 AO. The natural person is therefore subject to unlimited German income tax under § 1(1) EStG. Worldwide income is included in principle; treaty allocation and double-tax relief are examined in a second step.",
      errorType: "Norm nicht gefunden", source: internationalCatalog("International Taxation · residence/worldwide-income questions"),
    },
    {
      id: `${prefix}-intl-treaty`, subject: "tax", topic: "Double Tax Treaties",
      title: "OECD-MA dividend allocation",
      prompt: spec.id === "b"
        ? "A German-resident GmbH directly owns 30% of a US corporation and receives a dividend. Assuming an OECD-MA-like treaty and beneficial ownership, identify residence/source state and the maximum source-state rate under Art. 10(2)(a)."
        : "A German-resident individual privately owns 50% of a US corporation and receives a dividend. Assuming an OECD-MA-like treaty and beneficial ownership, identify residence/source state and the maximum source-state rate under Art. 10.",
      helpDe: spec.id === "b" ? "Bei qualifiziertem Gesellschaftsempfänger gilt im OECD-MA grundsätzlich die 5%-Grenze." : "Für eine Privatperson greift nicht die 5%-Regel für qualifizierte Gesellschaften; prüfe Art. 10 Abs. 2 lit. b.",
      points: 10, targetMinutes: 10, responseType: "text",
      rubric: [{ label: "Germany as residence state", points: 2 }, { label: "USA as source state", points: 2 }, { label: "Art. 10 identified", points: 2 }, { label: spec.id === "b" ? "Qualifying company recipient" : "Individual is not a qualifying company recipient", points: 2 }, { label: spec.id === "b" ? "Maximum 5%" : "Maximum 15%", points: 2 }],
      modelAnswer: spec.id === "b"
        ? "Germany is the recipient's residence state and the USA the dividend source state. A direct 30% corporate holding meets the stated qualifying-recipient condition; Art. 10(2)(a) limits source taxation to 5% under the assumed treaty."
        : "Germany is the recipient's residence state and the USA the source state. An individual does not qualify for the 5% company rate; Art. 10(2)(b) limits source taxation to 15% under the assumed treaty.",
      errorType: "Rechtsfolge falsch", source: internationalCatalog("International Taxation · OECD-MA Art. 10 dividend questions"),
    },
    {
      id: `${prefix}-intl-avoidance`, subject: "tax", topic: "Anti-Avoidance & Transfer Pricing",
      title: "Anti-treaty-shopping and transfer pricing",
      prompt: spec.id === "c"
        ? "A German parent pays an excessive price to a related foreign subsidiary, reducing German taxable income. Explain the arm's-length correction purpose and state the correction direction tested for § 1 AStG in the EBS catalog."
        : "A foreign investor inserts an economically insubstantial conduit solely to obtain treaty or EU-directive relief. Explain the anti-treaty-shopping purpose and state the correction direction tested for § 1 AStG in the EBS catalog.",
      helpDe: "Künstliche Strukturen bzw. fremdunübliche Bedingungen benennen. Laut Fragenkatalog kann § 1 AStG in der geprüften Aussage das Einkommen nur erhöhen.",
      points: 10, targetMinutes: 10, responseType: "text",
      rubric: [{ label: "Artificial structure or non-arm's-length condition identified", points: 3 }, { label: "Purpose: prevent unjustified relief/base erosion", points: 2 }, { label: "Arm's-length/transfer-pricing context", points: 2 }, { label: "Catalog direction: taxable income may only be increased", points: 2 }, { label: "Clear conclusion", points: 1 }],
      modelAnswer: "Anti-treaty-shopping prevents treaty or directive benefits obtained through artificial structures without sufficient substantive justification. Transfer-pricing rules restore arm's-length conditions. In the tested EBS catalog statement, § 1 AStG permits an upward correction of taxable income, not a downward correction.",
      errorType: "Rechtsfolge falsch", source: internationalCatalog("International Taxation · Questions 5-6"),
    },
  ];
  return {
    german: { id: `tax-german-${spec.id}`, labelDe: spec.label, labelEn: spec.label, blocks: germanBlocks } satisfies ExamVariant,
    international: { id: `tax-international-${spec.id}`, labelDe: spec.label, labelEn: spec.label, blocks: internationalBlocks } satisfies ExamVariant,
    combined: { id: `tax-combined-${spec.id}`, labelDe: spec.label, labelEn: spec.label, blocks: [...germanBlocks, ...internationalBlocks] } satisfies ExamVariant,
  };
}

export const portfolioExamVariants = portfolioSpecs.map(createPortfolioVariant);
const taxVariantGroups = taxSpecs.map(createTaxVariant);
export const germanTaxExamVariants = taxVariantGroups.map((item) => item.german);
export const internationalTaxExamVariants = taxVariantGroups.map((item) => item.international);
export const combinedTaxExamVariants = taxVariantGroups.map((item) => item.combined);

export const portfolioExamPlan = portfolioExamVariants[0].blocks;
export const taxExamPlan = combinedTaxExamVariants[0].blocks;
export const examPlans: Record<Subject, ExamBlock[]> = { portfolio: portfolioExamPlan, tax: taxExamPlan };

function mode(
  id: ExamModeId,
  subject: Subject,
  labelDe: string,
  labelEn: string,
  descriptionDe: string,
  descriptionEn: string,
  durationMinutes: number,
  maxPoints: number,
  variants: ExamVariant[],
): ExamMode {
  return { id, subject, labelDe, labelEn, descriptionDe, descriptionEn, durationMinutes, maxPoints, variants, blocks: variants[0].blocks };
}

export const examModes: Record<ExamModeId, ExamMode> = {
  "portfolio-full": mode("portfolio-full", "portfolio", "Portfolio-Gesamtprüfung", "Full Portfolio exam", "FT2025-Struktur · drei wechselnde Klausuren", "FT2025 structure · three rotating mocks", 90, 90, portfolioExamVariants),
  "tax-german": mode("tax-german", "tax", "German Taxation", "German Taxation", "Teil I · 30-Punkte-Mitunternehmerschaft plus drei Fallblöcke", "Part I · 30-point partnership case plus three case blocks", 60, 60, germanTaxExamVariants),
  "tax-international": mode("tax-international", "tax", "International Taxation", "International Taxation", "Teil II · drei eigenständige 10-Punkte-Fälle", "Part II · three independent 10-point cases", 30, 30, internationalTaxExamVariants),
  "tax-combined": mode("tax-combined", "tax", "Tax-Gesamtprüfung", "Full Tax exam", "60 Min German + 30 Min International", "60 min German + 30 min International", 90, 90, combinedTaxExamVariants),
};

export function selectExamVariant(modeId: ExamModeId, completedVariantIds: string[], random = Math.random) {
  const variants = examModes[modeId].variants;
  const last = completedVariantIds.at(-1);
  const candidates = variants.filter((item) => item.id !== last);
  const pool = candidates.length ? candidates : variants;
  return pool[Math.floor(Math.max(0, Math.min(.999999, random())) * pool.length)];
}

export function examModeForSession(subject: Subject, examModeId?: ExamModeId, examVariantId?: string) {
  const base = examModes[examModeId ?? (subject === "tax" ? "tax-combined" : "portfolio-full")];
  const variant = base.variants.find((item) => item.id === examVariantId) ?? base.variants[0];
  return { ...base, blocks: variant.blocks };
}
