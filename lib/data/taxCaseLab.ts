import type { ErrorType, SourceRef } from "../types";

export type TaxCaseStep = {
  id: "tax" | "subject" | "rule" | "calculation" | "conclusion";
  title: string;
  prompt: string;
  options?: string[];
  correct?: number;
  input?: { answer: number; unit: string; tolerance?: number };
  explanation: string;
  points: number;
};

export type TaxCase = {
  id: string;
  topic: string;
  title: string;
  facts: string;
  steps: TaxCaseStep[];
  modelAnswer: string;
  trap: string;
  source: SourceRef;
};

const source = (file: string, pages: string, note?: string): SourceRef => ({
  document: `German and International Taxation.zip → ${file}`,
  location: `S. ${pages}`,
  priority: "official-solution",
  note: note ?? "Sachverhalt und Zahlen wurden für das Training neu formuliert; Prüfungsweg und Rechtsfolge folgen der offiziellen Kurslösung.",
});

export const taxCaseErrorByStep: Record<TaxCaseStep["id"], ErrorType> = {
  tax: "Wissenslücke",
  subject: "Wissenslücke",
  rule: "Norm nicht gefunden",
  calculation: "Rechenfehler",
  conclusion: "Rechtsfolge falsch",
};

export const taxCases: TaxCase[] = [
  {
    id: "residence-world-income", topic: "Tax Liability", title: "Residence and worldwide income",
    facts: "Lena is a natural person and keeps a permanently available apartment in Wiesbaden. During the year she also receives rental income from an apartment abroad. Determine the German income-tax treatment.",
    steps: [
      { id:"tax", title:"Identify the tax", prompt:"Which tax is examined first?", options:["Personal income tax (Einkommensteuer)","Corporate income tax","Trade tax"], correct:0, explanation:"The taxpayer is a natural person, so the starting point is personal income tax.", points:2 },
      { id:"subject", title:"Identify the tax subject", prompt:"Which fact establishes the personal tax nexus?", options:["Domestic residence","German citizenship","A German customer"], correct:0, explanation:"A residence under § 8 AO is sufficient for § 1(1) EStG.", points:2 },
      { id:"rule", title:"Select the rule", prompt:"Which rule combination applies?", options:["§ 1(1) EStG in conjunction with § 8 AO","§ 1(4) EStG with § 49 EStG","§ 1 KStG with § 11 AO"], correct:0, explanation:"Domestic residence creates unlimited personal income-tax liability.", points:2 },
      { id:"calculation", title:"Determine the tax base scope", prompt:"Which income scope follows?", options:["Worldwide income is included in principle","Only German-source income","Only employment income"], correct:0, explanation:"Unlimited liability generally triggers the worldwide-income principle; treaty relief must be checked separately if relevant.", points:2 },
      { id:"conclusion", title:"State the result", prompt:"Choose the exam-ready conclusion.", options:["Lena is subject to unlimited German income tax; the foreign rent enters the German assessment in principle.","The foreign rent is automatically ignored.","Lena is only subject to limited tax liability."], correct:0, explanation:"First establish unlimited liability and worldwide income; only afterwards examine a possible DTA allocation or relief method.", points:2 },
    ],
    modelAnswer:"Lena has a domestic residence within § 8 AO and is therefore subject to unlimited income tax liability under § 1(1) EStG. Consequently, her worldwide income is covered in principle, including the foreign rental income. Any treaty allocation and relief from double taxation must be examined in a separate second step.",
    trap:"Do not jump directly to a double-tax treaty. First establish domestic tax liability.", source:source("EBS - BSc DStR task 2_with solution_2025.pdf","2–4"),
  },
  {
    id:"partnership-two-stage", topic:"Partnership & Co-Entrepreneurship", title:"Two-stage partnership profit",
    facts:"A KG reports a tax loss of EUR 24,000. Partner B receives 2/3 of the result and EUR 18,000 remuneration for a loan to the KG. B has EUR 6,000 special business expenses connected with that loan. Determine B's partnership income.",
    steps:[
      {id:"tax",title:"Identify the income category",prompt:"Which category governs the partner's share and special remuneration?",options:["Business income under § 15 EStG","Capital income only","Employment income"],correct:0,explanation:"The co-entrepreneur's share and special remuneration form business income.",points:2},
      {id:"subject",title:"Apply transparency",prompt:"Who is the income-tax subject?",options:["The partner; profit is attributed under the transparency principle","The KG alone","The managing director"],correct:0,explanation:"The partnership determines income, but income tax is imposed on the partners.",points:2},
      {id:"rule",title:"Select the rule",prompt:"Which provision combines stage 1 and stage 2?",options:["§ 15(1) sentence 1 no. 2 EStG","§ 20(1) no. 1 EStG","§ 8b KStG"],correct:0,explanation:"The first half covers the profit share; the second half covers Sondervergütungen and connected special expenses.",points:2},
      {id:"calculation",title:"Calculate B's total",prompt:"Enter B's additive partnership income.",input:{answer:-4000,unit:"EUR",tolerance:1},explanation:"Stage 1: −24,000 × 2/3 = −16,000. Stage 2: 18,000 − 6,000 = +12,000. Total = −4,000.",points:2},
      {id:"conclusion",title:"State the result",prompt:"Which statement is correct?",options:["B has EUR 4,000 negative business income from the KG.","B has EUR 12,000 capital income.","B has EUR 16,000 negative employment income."],correct:0,explanation:"Stage 1 and the special result are added for the partner.",points:2},
    ],modelAnswer:"Under § 15(1) sentence 1 no. 2 EStG, B first receives a loss share of EUR 16,000. The loan remuneration of EUR 18,000 is special remuneration; after EUR 6,000 special business expenses, the stage-2 result is EUR 12,000. B therefore has negative business income of EUR 4,000.",trap:"Do not tax partner loan interest separately under § 20 EStG; it is reclassified within § 15 EStG.",source:source("EBS - BSc DStR task 4_with solution_2025.pdf","3–6"),
  },
  {
    id:"limited-partner-loss",topic:"Partnership & Co-Entrepreneurship",title:"Limited partner loss under § 15a",
    facts:"A limited partner is allocated a loss of EUR 145,000. The relevant capital account available for loss offset is EUR 110,000. No extended liability amount is available.",
    steps:[
      {id:"tax",title:"Identify the problem",prompt:"What is being restricted?",options:["Current loss offset by a limited partner","The KG's trade-tax liability","Dividend withholding tax"],correct:0,explanation:"§ 15a concerns the extent to which the limited partner may currently use the allocated loss.",points:2},
      {id:"subject",title:"Identify the affected person",prompt:"Who applies the restriction?",options:["The limited partner (Kommanditist)","Every GmbH shareholder","Only the KG's creditors"],correct:0,explanation:"The rule targets limited partners and comparable limited-liability positions.",points:2},
      {id:"rule",title:"Select the rule",prompt:"Which provision governs?",options:["§ 15a EStG","§ 8b KStG","§ 35 EStG"],correct:0,explanation:"§ 15a EStG limits current offset and carries the excess forward as verrechenbarer Verlust.",points:2},
      {id:"calculation",title:"Calculate the restricted amount",prompt:"How much becomes verrechenbarer Verlust?",input:{answer:35000,unit:"EUR",tolerance:1},explanation:"EUR 145,000 loss minus EUR 110,000 usable capital account = EUR 35,000 restricted loss.",points:2},
      {id:"conclusion",title:"State the result",prompt:"Choose the correct treatment.",options:["EUR 110,000 is currently usable; EUR 35,000 is carried forward for this participation.","The full EUR 145,000 is immediately usable.","No loss is recognized at all."],correct:0,explanation:"The excess is not lost; it can offset later profits from the participation under § 15a(2) EStG.",points:2},
    ],modelAnswer:"Pursuant to § 15a EStG, the loss is currently offsettable only up to EUR 110,000. The remaining EUR 35,000 constitutes a verrechenbarer Verlust and may be used against future profits from the same participation.",trap:"Restricted does not mean permanently lost.",source:source("EBS - BSc DStR task 5_with solution 2025.pdf","7–8"),
  },
  {
    id:"corporate-reconciliation",topic:"Corporate Income Tax",title:"Corporate tax reconciliation",
    facts:"A German GmbH reports a commercial profit of EUR 80,000 after deducting a EUR 2,000 fine and EUR 20,000 supervisory-board remuneration. Ignore all other adjustments. Determine taxable income.",
    steps:[
      {id:"tax",title:"Identify the tax",prompt:"Which company-level tax base is requested?",options:["Corporate income tax","Personal income tax","VAT"],correct:0,explanation:"A GmbH is a corporation and the task requests its KSt taxable income.",points:2},
      {id:"subject",title:"Establish liability",prompt:"Which fact is decisive for unlimited KSt liability?",options:["Management or registered seat in Germany","German shareholders only","A profit above EUR 24,500"],correct:0,explanation:"§ 1 KStG refers to domestic management or registered seat.",points:2},
      {id:"rule",title:"Select the adjustments",prompt:"Which treatment is correct?",options:["Add back the fine and 50% of supervisory-board remuneration","Deduct both amounts again","Add back the full supervisory-board remuneration only"],correct:0,explanation:"The fine is non-deductible under § 4(5) no. 8 EStG; 50% of supervisory-board remuneration is non-deductible under § 10 no. 4 KStG.",points:2},
      {id:"calculation",title:"Calculate taxable income",prompt:"Enter the taxable income.",input:{answer:92000,unit:"EUR",tolerance:1},explanation:"80,000 + 2,000 fine + 10,000 (50% of 20,000) = 92,000.",points:2},
      {id:"conclusion",title:"State the result",prompt:"Which concise conclusion is correct?",options:["The GmbH's taxable income is EUR 92,000 before any further adjustments.","The taxable income remains EUR 80,000.","The taxable income is EUR 102,000."],correct:0,explanation:"Off-balance-sheet additions correct expenses recognized commercially but disallowed for tax.",points:2},
    ],modelAnswer:"The commercial profit is the starting point. The EUR 2,000 fine is added back under § 4(5) no. 8 EStG. Under § 10 no. 4 KStG, 50% of the EUR 20,000 supervisory-board remuneration, i.e. EUR 10,000, is also added back. Taxable income is EUR 92,000.",trap:"An off-balance-sheet add-back does not mean booking the expense a second time.",source:source("EBS - BSc DStR task 6_ with solution 2025.pdf","3–5"),
  },
  {
    id:"partial-income",topic:"Dividends & Capital Gains",title:"Dividend in business assets",
    facts:"A natural person holds shares as business assets. The gross dividend is EUR 40,000 and directly related business expenses are EUR 1,000. Apply the Teileinkünfteverfahren used in the course.",
    steps:[
      {id:"tax",title:"Identify the regime",prompt:"Which regime applies?",options:["Teileinkünfteverfahren","Final withholding regime with no expense deduction","§ 8b KStG corporate exemption"],correct:0,explanation:"The shareholder is a natural person and the shares are held as business assets.",points:2},
      {id:"subject",title:"Identify the taxpayer",prompt:"Who is taxed?",options:["The natural person holding the business asset","A corporation under KStG","No taxpayer because all dividends are exempt"],correct:0,explanation:"The business-income attribution brings the dividend into the natural person's assessment.",points:2},
      {id:"rule",title:"Select the rule",prompt:"Which combination is correct?",options:["60% dividend taxable and 60% expenses deductible","100% dividend taxable and no expenses deductible","95% dividend exempt and 5% taxable"],correct:0,explanation:"§ 3 no. 40 EStG and § 3c(2) EStG produce the 60/60 treatment.",points:2},
      {id:"calculation",title:"Calculate the taxable result",prompt:"Enter the taxable income contribution.",input:{answer:23400,unit:"EUR",tolerance:1},explanation:"40,000 × 60% = 24,000; 1,000 × 60% = 600; result = 23,400.",points:2},
      {id:"conclusion",title:"State the result",prompt:"Choose the correct conclusion.",options:["The dividend contributes EUR 23,400 to taxable business income.","EUR 40,000 is taxable and expenses are ignored.","Only EUR 2,000 is taxable."],correct:0,explanation:"Taxable dividend and deductible related expense are both limited to 60%.",points:2},
    ],modelAnswer:"Because the participation belongs to business assets of a natural person, the Teileinkünfteverfahren applies. EUR 24,000 of the dividend is taxable and EUR 600 of the related expense is deductible. The net taxable contribution is EUR 23,400.",trap:"Do not apply the private final-withholding rules or the corporate § 8b KStG regime.",source:source("EBS - BSc DStR task 7_ with solution 2025.pdf","3–4"),
  },
  {
    id:"share-disposal-corporation",topic:"Dividends & Capital Gains",title:"Corporate share-disposal gain",
    facts:"A GmbH sells 80% of a participation for EUR 120,000. The acquisition cost of the full 100% holding was EUR 100,000. Determine the corporate-tax effect of the gain under § 8b KStG.",
    steps:[
      {id:"tax",title:"Identify the tax",prompt:"At which level is the gain examined?",options:["Corporate income tax of the selling GmbH","Personal income tax under § 17 EStG","Wage tax"],correct:0,explanation:"The seller is a corporation.",points:2},
      {id:"subject",title:"Allocate acquisition cost",prompt:"What acquisition cost belongs to the sold 80%?",options:["EUR 80,000","EUR 100,000","EUR 20,000"],correct:0,explanation:"The cost of the total holding must be allocated to the fraction sold.",points:2},
      {id:"rule",title:"Select the rule",prompt:"Which treatment applies in principle?",options:["Gain exempt under § 8b(2); 5% deemed non-deductible under § 8b(3)","Full gain taxable","60% taxable under the Teileinkünfteverfahren"],correct:0,explanation:"Corporate share-disposal gains follow § 8b(2) and (3) KStG.",points:2},
      {id:"calculation",title:"Calculate the taxable effect",prompt:"Enter the 5% taxable effect.",input:{answer:2000,unit:"EUR",tolerance:1},explanation:"Gain: 120,000 − 80,000 = 40,000. Five percent = EUR 2,000.",points:2},
      {id:"conclusion",title:"State the result",prompt:"Which result is correct?",options:["The EUR 40,000 gain is exempt; EUR 2,000 has a taxable expense effect.","The full EUR 40,000 is taxable.","EUR 24,000 is taxable."],correct:0,explanation:"The 5% amount is treated as non-deductible business expense despite the gain exemption.",points:2},
    ],modelAnswer:"The allocated acquisition cost is EUR 80,000, so the disposal gain is EUR 40,000. The gain is exempt under § 8b(2) KStG. Under § 8b(3) KStG, 5% or EUR 2,000 is treated as non-deductible business expense.",trap:"First allocate acquisition cost and calculate the gain; apply 5% to the gain, not to proceeds.",source:source("EBS - BSc DStR task 7_ with solution 2025.pdf","5–6"),
  },
  {
    id:"trade-tax",topic:"Trade Tax",title:"Trade-tax calculation chain",
    facts:"A corporation has profit for trade-tax purposes before § 8 add-backs of EUR 500,040. It paid EUR 260,000 interest and EUR 200,000 rent for immovable property. There are no reductions. The municipal multiplier is 400%.",
    steps:[
      {id:"tax",title:"Identify the tax",prompt:"Which tax is calculated?",options:["Trade tax (Gewerbesteuer)","Corporate income tax only","Capital income tax"],correct:0,explanation:"The required chain uses GewStG add-backs, tax base rate and municipal multiplier.",points:2},
      {id:"subject",title:"Identify the debtor",prompt:"Who owes trade tax here?",options:["The corporation operating the business","Its shareholders","The municipality"],correct:0,explanation:"A corporation is deemed to operate a trade and is the trade-tax debtor.",points:2},
      {id:"rule",title:"Calculate the financing shares",prompt:"Which financing-share total enters § 8 no. 1 before the allowance?",options:["EUR 360,000","EUR 460,000","EUR 260,000"],correct:0,explanation:"Interest counts 100%: 260,000. Immovable rent counts 50%: 100,000. Total EUR 360,000.",points:2},
      {id:"calculation",title:"Calculate trade tax",prompt:"Enter the final trade tax.",input:{answer:75600,unit:"EUR",tolerance:1},explanation:"Add-back: (360,000−200,000)×25%=40,000. Trade income 540,040 rounds down to 540,000. Base amount 18,900. ×400%=75,600.",points:2},
      {id:"conclusion",title:"State the chain",prompt:"Which sequence is correct?",options:["Profit → § 8 add-back → round down → ×3.5% → ×Hebesatz","Profit → ×15% → SolZ → Hebesatz","Revenue → allowance → ×25%"],correct:0,explanation:"This is the statutory computation sequence used in the official Task 8 solution.",points:2},
    ],modelAnswer:"The financing shares are EUR 360,000. After the EUR 200,000 allowance, 25% of EUR 160,000, i.e. EUR 40,000, is added. Trade income is EUR 540,040 and is rounded down to EUR 540,000. The tax base amount is EUR 18,900 and trade tax at 400% is EUR 75,600.",trap:"Deduct the EUR 200,000 allowance before taking 25%, and round trade income down to full EUR 100.",source:source("EBS - BSc DStR task 8_ with solution 2025.pdf","2–6"),
  },
  {
    id:"business-split",topic:"Business Split",title:"Betriebsaufspaltung",
    facts:"Nora controls both a possession partnership and an operating GmbH. The partnership lets the GmbH the warehouse essential for its operations. Assess the structure.",
    steps:[
      {id:"tax",title:"Identify the issue",prompt:"Which doctrine must be examined?",options:["Betriebsaufspaltung","§ 15a loss limitation","Final withholding tax"],correct:0,explanation:"The combination of control and transfer of an essential asset points to a business split.",points:2},
      {id:"subject",title:"Test personal nexus",prompt:"What establishes personelle Verflechtung?",options:["Nora can enforce a uniform business will in both entities","The warehouse has a high value","Both entities use the same bank"],correct:0,explanation:"Control of both entities supports a uniform business will.",points:2},
      {id:"rule",title:"Test material nexus",prompt:"What establishes sachliche Verflechtung?",options:["An essential business asset is provided to the operating GmbH","Any cash loan","A dividend distribution"],correct:0,explanation:"The essential warehouse creates the material nexus.",points:2},
      {id:"calculation",title:"Determine the income character",prompt:"What is the tax consequence for the possession activity?",options:["It becomes commercial business activity","It remains pure private rental in every case","It becomes employment income"],correct:0,explanation:"The business split transforms the possession activity into business income.",points:2},
      {id:"conclusion",title:"State the result",prompt:"Choose the exam-ready result.",options:["Personal and material nexus exist; a Betriebsaufspaltung is present.","Only material nexus exists, so no tax consequence follows.","The entities must merge legally."],correct:0,explanation:"Legal identity remains separate; the consequence concerns the tax character of the possession activity and asset classification.",points:2},
    ],modelAnswer:"Nora's control of both entities establishes personelle Verflechtung. The warehouse is essential to the operating company and therefore establishes sachliche Verflechtung. Both conditions are met, so a Betriebsaufspaltung exists and the possession activity produces business income.",trap:"The entities do not merge. Keep the civil-law entities separate and state the tax reclassification.",source:source("EBS - BSc DStR task 9_ with solution 2025.pdf","6–9"),
  },
];
