import type { Flashcard, QuizQuestion, SourceRef } from "../types";

const catalog = (question: string, pages: string): SourceRef => ({
  document: "EBS - Taxation - Single Choice Questions.pdf",
  location: `${question} · PDF-S. ${pages}`,
  priority: "official-current",
  note: "EBS-Fragenkatalog; laut Einleitung ist jeweils die erste Antwort richtig.",
});

const oldExam = (question: string, page: string): SourceRef => ({
  document: "EBS exam International Taxation FT 2023.pdf",
  location: `${question} · PDF-S. ${page}`,
  priority: "official-older",
  note: "Markierte EBS-Altklausur; gegen den ausführlichen EBS-Fragenkatalog geprüft.",
});

const quizlet = (numbers: string): SourceRef => ({
  document: "Quizlet Patrick MCQ Tax.pdf",
  location: `Fragen ${numbers}`,
  priority: "student-secondary",
  note: "Nur als zusätzliche Wiederholungsquelle; die Regel wurde mit dem EBS-Fragenkatalog abgeglichen.",
});

const card = (
  id: string,
  topic: string,
  front: string,
  back: string,
  source: SourceRef,
  difficulty: 1 | 2 | 3 = 1,
): Flashcard => ({ id, subject: "tax", topic, front, back, source, difficulty });

const question = (item: Omit<QuizQuestion, "subject">): QuizQuestion => ({ ...item, subject: "tax" });

export const taxSupplementCards: Flashcard[] = [
  card("t56", "Tax Accounting", "What does the Maßgeblichkeitsprinzip state?", "Commercial-accounting principles are authoritative for the tax balance sheet unless tax law provides otherwise (§ 5(1) sentence 1 EStG).", catalog("German Taxation · Question 1", "2")),
  card("t57", "Tax Accounting", "Which corporate expense is generally non-deductible under the EBS catalog?", "Income taxes (§ 10 sentence 1 no. 2 KStG).", catalog("German Taxation · Question 2", "2")),
  card("t58", "Tax Accounting", "What is the purpose of the interest-barrier rule?", "To limit the deductibility of interest in specified cases and prevent erosion of the German tax base through excessive interest deductions.", catalog("German Taxation · Question 4", "3")),
  card("t59", "Share Disposals", "A natural person sells part of a private shareholding of at least 1%. Which course path applies?", "Examine § 17 EStG; the Teileinkünfteverfahren applies to the gain in the catalog case.", catalog("German Taxation · Question 6", "4"), 2),
  card("t60", "Trade Tax", "Which expense is not a § 8 no. 1 GewStG add-back item?", "Employee salaries. Interest and specified rent/lease payments are among the financing items examined.", catalog("German Taxation · Question 11", "6")),
  card("t61", "Trade Tax", "Which partnership item is reduced for trade-tax purposes in the EBS catalog?", "Profits derived from an interest in another business partnership (§ 9 no. 2 GewStG).", catalog("German Taxation · Question 12", "6")),
  card("t62", "Business Split", "What does material nexus mean in a Betriebsaufspaltung?", "The possession enterprise provides an essential business asset to the operating company for use.", catalog("German Taxation · Question 15", "7")),
  card("t63", "Business Split", "What is the Wiesbaden model used for in the course catalog?", "It is a structuring model used to mitigate a business split.", catalog("German Taxation · Question 16", "8"), 2),
  card("t64", "Loss Utilisation", "How long can a German loss carryforward exist according to the EBS question?", "For an unlimited period, subject to the applicable legal and economic identity requirements stated in the catalog.", catalog("German Taxation · Question 18", "8")),
  card("t65", "Corporate Dividends", "A corporation receives an exempt EUR 100,000 dividend and has EUR 12,000 related expenses. What is the catalog result?", "EUR −7,000: the dividend is exempt, EUR 5,000 is treated as non-deductible under the 5% rule, and EUR 12,000 expenses remain in the calculation.", catalog("German Taxation · Question 20", "9"), 3),
  card("t66", "Personal Income Tax", "How does German spouses' income splitting work?", "Combine the spouses' income, divide by two, calculate the tax on one half, then double that tax.", catalog("German Taxation · Question 21", "9")),
  card("t67", "International Tax Liability", "Which principle accompanies unlimited German income-tax liability?", "The universality or worldwide-income principle; treaty allocation and relief are checked afterwards.", catalog("German Taxation · Question 28", "12")),
  card("t68", "Double Tax Relief", "Which unilateral double-tax relief methods are named in the EBS catalog?", "Credit, exemption and deduction methods.", oldExam("Question 1", "1"), 2),
  card("t69", "Double Tax Treaties", "What is a genuine link?", "An effective or fixed connection of assets to a state's territory; immovable property is the standard example.", oldExam("Question 4", "1")),
  card("t70", "Anti-Avoidance & Transfer Pricing", "What does the German anti-treaty-shopping rule target?", "Artificial structures through which foreign taxpayers seek treaty or EU-directive benefits without sufficient substantive justification.", catalog("International Taxation · Question 5", "15"), 2),
  card("t71", "Anti-Avoidance & Transfer Pricing", "What direction of § 1 AStG correction is the correct EBS catalog answer?", "The catalog answer is that taxable income can only be increased.", catalog("International Taxation · Question 6", "15"), 2),
  card("t72", "CFC & Global Minimum Tax", "Which low-tax threshold is tested for German CFC taxation in the 2023 EBS material?", "Nominal taxation of 15% or less for the passive income of the controlled foreign entity.", oldExam("Question 9", "2"), 2),
  card("t73", "CFC & Global Minimum Tax", "Which minimum effective tax rate is tested for the GloBE rules?", "15%.", oldExam("Question 10", "2")),
  card("t74", "Partnership & Co-Entrepreneurship", "What two characteristics establish co-entrepreneurship?", "Co-entrepreneurial initiative and co-entrepreneurial risk; a limited partner can satisfy both.", catalog("German Taxation · Question 32", "13"), 2),
  card("t75", "Tax Accounting", "Which bookkeeping entry records interest received by a sole trader?", "Debit bank; credit interest income. This is a bookkeeping recall item, not the tax classification itself.", quizlet("12/35"), 1),
];

export const taxSupplementQuiz: QuizQuestion[] = [
  question({ id:"tq31",topic:"Tax Accounting",type:"legal-rule",prompt:"What does the Maßgeblichkeitsprinzip state?",options:["Commercial-accounting principles govern the tax balance sheet unless tax law provides otherwise","Tax law can never deviate from commercial accounts","Tax accounts always govern commercial accounts","The two accounting systems have no connection"],correct:0,explanation:"§ 5(1) sentence 1 EStG makes commercial principles authoritative subject to tax-law exceptions.",points:3,difficulty:1,source:catalog("German Taxation · Question 1","2"),diagnostic:true }),
  question({ id:"tq32",topic:"Tax Accounting",type:"multiple-choice",prompt:"Which corporate expense is generally non-deductible under the EBS catalog?",options:["Income taxes","Sales wages","Manufacturing costs","Tax depreciation"],correct:0,explanation:"The catalog points to § 10 sentence 1 no. 2 KStG.",points:3,difficulty:1,source:catalog("German Taxation · Question 2","2") }),
  question({ id:"tq33",topic:"Tax Accounting",type:"multiple-choice",prompt:"What is the purpose of the interest-barrier rule?",options:["Limit excessive interest deductions that erode the tax base","Increase every interest deduction","Prevent banks from issuing loans","Replace corporate income tax"],correct:0,explanation:"The rule limits interest deductibility in specified cases.",points:3,difficulty:1,source:catalog("German Taxation · Question 4","3"),diagnostic:true }),
  question({ id:"tq34",topic:"Share Disposals",type:"legal-rule",prompt:"A natural person owns 20% of a corporation privately and sells half of that holding. Which course treatment applies?",options:["§ 17 EStG and the partial-income method","§ 15 EStG and the corporate affiliation privilege","Final withholding tax in every case","The sale is exempt"],correct:0,explanation:"The material participation brings the private disposal into § 17 EStG; the partial-income method applies.",points:4,difficulty:2,source:catalog("German Taxation · Question 6","4"),diagnostic:true }),
  question({ id:"tq35",topic:"Trade Tax",type:"multiple-choice",prompt:"Which item is not in principle subject to a § 8 no. 1 GewStG add-back?",options:["Employee salaries","Interest","Rent for movable assets","Rent for immovable assets"],correct:0,explanation:"Salaries are not financing items within § 8 no. 1 GewStG.",points:3,difficulty:1,source:catalog("German Taxation · Question 11","6") }),
  question({ id:"tq36",topic:"Trade Tax",type:"multiple-choice",prompt:"Which item is in principle subject to a trade-tax reduction in the EBS catalog?",options:["Profit from an interest in another business partnership","Real-estate transfer tax","Patent expense","Rent for immovable assets"],correct:0,explanation:"The catalog cites § 9 no. 2 GewStG.",points:3,difficulty:1,source:catalog("German Taxation · Question 12","6") }),
  question({ id:"tq37",topic:"Business Split",type:"legal-rule",prompt:"What establishes material nexus in a Betriebsaufspaltung?",options:["Provision of an essential business asset to the operating company","Transfer of any insignificant asset","Only provision of an intangible asset","The same tax adviser"],correct:0,explanation:"The operating company must receive an essential business asset for use.",points:3,difficulty:1,source:catalog("German Taxation · Question 15","7") }),
  question({ id:"tq38",topic:"Business Split",type:"multiple-choice",prompt:"What is the purpose of the Wiesbaden model in the EBS catalog?",options:["Mitigate a business split","Mitigate co-entrepreneurship","Avoid unlimited tax liability","Avoid property tax"],correct:0,explanation:"The catalog presents the Wiesbaden model as a way to mitigate a Betriebsaufspaltung.",points:3,difficulty:2,source:catalog("German Taxation · Question 16","8") }),
  question({ id:"tq39",topic:"Loss Utilisation",type:"true-false",prompt:"A loss carryforward can exist for an unlimited period, subject to the identity requirements stated in the course catalog.",options:["True","False"],correct:0,explanation:"This is the correct statement in the EBS question on loss carryforward/carryback.",points:2,difficulty:1,source:catalog("German Taxation · Question 18","8") }),
  question({ id:"tq40",topic:"Corporate Dividends",type:"calculation",prompt:"A GmbH receives an exempt EUR 100,000 dividend and incurs EUR 12,000 related expenses. What taxable-income effect is stated in the EBS catalog?",options:["EUR −7,000","EUR +12,000","EUR +100,000","EUR +17,000"],correct:0,explanation:"Five percent of the exempt dividend gives EUR 5,000 non-deductible expenses; together with the EUR 12,000 expense, the net effect is EUR −7,000.",solutionSteps:["Dividend exemption: EUR 100,000.","5% non-deductible amount: +EUR 5,000.","Related expense: −EUR 12,000.","Net: EUR −7,000."],points:5,difficulty:3,source:catalog("German Taxation · Question 20","9"),diagnostic:true }),
  question({ id:"tq41",topic:"Personal Income Tax",type:"ordering",prompt:"Which sequence describes German spouses' income splitting?",options:["Combine income → divide by two → tax one half → double the tax","Tax separately → add rates → divide tax by two","Divide each income by two → apply trade tax","Apply only to self-employment income"],correct:0,explanation:"This is the splitting method under § 32a(5) EStG as tested in the catalog.",points:4,difficulty:1,source:catalog("German Taxation · Question 21","9") }),
  question({ id:"tq42",topic:"International Tax Liability",type:"legal-rule",prompt:"Which principle applies to unlimited German income-tax liability?",options:["Universality/worldwide-income principle","Territorial principle only","Source principle only","No income-scope principle"],correct:0,explanation:"Unlimited liability generally brings worldwide income into scope; treaty relief is a later step.",points:3,difficulty:1,source:catalog("German Taxation · Question 28","12"),diagnostic:true }),
  question({ id:"tq43",topic:"Double Tax Relief",type:"multiple-choice",prompt:"Which set contains the unilateral double-tax relief methods tested in the EBS material?",options:["Credit, exemption and deduction","Credit only","Exemption only","Deferral and loss carryback only"],correct:0,explanation:"The marked 2023 answer names credit, exemption and deduction methods.",points:3,difficulty:2,source:oldExam("Question 1","1") }),
  question({ id:"tq44",topic:"Double Tax Treaties",type:"legal-rule",prompt:"What does 'genuine link' mean in the EBS material?",options:["Effective or fixed connection of assets to a state's territory","Only floating income","No territorial connection","Immovable assets never establish a link"],correct:0,explanation:"An immovable asset is the clearest example of a fixed territorial connection.",points:3,difficulty:1,source:oldExam("Question 4","1") }),
  question({ id:"tq45",topic:"Double Tax Treaties",type:"calculation",prompt:"Dieter, a German-resident individual, holds 50% of USCo privately and receives a dividend. Under an OECD-MA-like treaty, what maximum US withholding rate is tested?",options:["15% under Art. 10(2)(b)","5% under Art. 10(2)(a)","10% under Art. 11","0%"],correct:0,explanation:"The reduced 5% rate is for a qualifying company recipient, not a private individual.",points:4,difficulty:2,source:oldExam("Question 6","2"),diagnostic:true }),
  question({ id:"tq46",topic:"Anti-Avoidance & Transfer Pricing",type:"legal-rule",prompt:"What does the German anti-treaty-shopping rule aim to prevent?",options:["Treaty or directive benefits obtained through artificial structures","All cross-border investments","German entrepreneurs moving abroad","Ratification of the MLI"],correct:0,explanation:"The provision targets artificial structures used to claim treaty or EU-directive relief.",points:3,difficulty:1,source:catalog("International Taxation · Question 5","15"),diagnostic:true }),
  question({ id:"tq47",topic:"Anti-Avoidance & Transfer Pricing",type:"true-false",prompt:"According to the EBS question catalog, § 1 AStG can only increase taxable income in the tested transfer-pricing correction.",options:["True","False"],correct:0,explanation:"This is the explicit correct answer and explanation in the catalog.",points:2,difficulty:2,source:catalog("International Taxation · Question 6","15") }),
  question({ id:"tq48",topic:"CFC & Global Minimum Tax",type:"multiple-choice",prompt:"Which low-tax threshold is tested for German CFC taxation in the 2023 EBS material?",options:["Nominal rate of 15% or less","25% or less","10% or less","5% or less"],correct:0,explanation:"The marked EBS exam answer uses a nominal foreign tax rate of 15% or less.",points:3,difficulty:2,source:oldExam("Question 9","2") }),
  question({ id:"tq49",topic:"CFC & Global Minimum Tax",type:"multiple-choice",prompt:"Which effective minimum rate is tested for the OECD GloBE rules?",options:["15%","5%","10%","25%"],correct:0,explanation:"The marked 2023 EBS answer is an effective minimum rate of 15%.",points:3,difficulty:1,source:oldExam("Question 10","2") }),
  question({ id:"tq50",topic:"Partnership & Co-Entrepreneurship",type:"legal-rule",prompt:"Which characteristics generally establish a co-entrepreneur?",options:["Co-entrepreneurial initiative and co-entrepreneurial risk","Commercial-register entry only","Unlimited liability only","German nationality and management power"],correct:0,explanation:"Both initiative and risk are required; a limited partner can satisfy them.",points:3,difficulty:1,source:catalog("German Taxation · Question 32","13"),diagnostic:true }),
];

