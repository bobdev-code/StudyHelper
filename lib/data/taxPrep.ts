import type { Language } from "../types";

export type TaxPrepChapter = {
  kicker: string;
  title: string;
  summary: string;
  steps: string[];
  example: string;
  trap: string;
};

const de: TaxPrepChapter[] = [
  {
    kicker: "30-PUNKTE-KERN",
    title: "Mitunternehmerschaft in der richtigen Reihenfolge",
    summary: "Beginne nie sofort mit der Rechnung. Zeichne zuerst Gesellschaft, Gesellschafter und Vertragsbeziehungen. Prüfe dann Ebene für Ebene.",
    steps: ["Steuerpflicht des Gesellschafters: § 1 Abs. 1 EStG i. V. m. §§ 8, 9 AO.", "Einkunftsart auf Gesellschaftsebene: freier Beruf (§ 18 Abs. 1 Nr. 1 EStG) oder Gewerbebetrieb (§ 15 Abs. 2 EStG).", "Mitunternehmerrisiko und Mitunternehmerinitiative nennen.", "Gesamter Gewinn = Ergebnis Stufe 1 + Sonderergebnis Stufe 2."],
    example: "Beispiel: KG-Verlust −20.000 €, Anteil 2/3 = −13.333 €. Sondervergütung 20.000 € abzüglich Sonderbetriebsausgaben 16.000 € = +4.000 €. Einkünfte des Gesellschafters: −9.333 €.",
    trap: "Sondervergütungen sind keine privaten Nebeneinkünfte. Sie gehören nach § 15 Abs. 1 S. 1 Nr. 2 EStG in die gewerblichen Einkünfte des Mitunternehmers.",
  },
  {
    kicker: "BUCHUNGEN & PERIODENABGRENZUNG",
    title: "Was trotz fehlender Zahlung in die Bilanz gehört",
    summary: "Bei der Gewinnermittlung zählt die wirtschaftliche Zugehörigkeit zur Periode, nicht nur der Geldfluss.",
    steps: ["Umsatz: Bank an Umsatzerlöse.", "Bezahlter Zins: Zinsaufwand an Bank.", "Im Dezember fälliger, noch nicht gezahlter Zins: Zinsaufwand an Verbindlichkeiten.", "Noch nicht festgesetzte Gewerbesteuer: Gewerbesteueraufwand an Gewerbesteuerrückstellung."],
    example: "Die Dezemberzinsen werden berücksichtigt, obwohl kein Geld geflossen ist. Grund ist die periodengerechte Abgrenzung nach § 252 Abs. 1 Nr. 5 HGB.",
    trap: "Nicht Zahlung mit Aufwand verwechseln. In der Klausur ausdrücklich begründen, warum eine Verbindlichkeit statt Bank gebucht wird.",
  },
  {
    kicker: "SONDERBETRIEBSBEREICH",
    title: "SBV I, SBV II und Sonder-GuV sicher trennen",
    summary: "Sonderbetriebsvermögen gehört dem Gesellschafter, dient aber steuerlich der Personengesellschaft oder seiner Beteiligung.",
    steps: ["SBV I dient unmittelbar dem Betrieb der Gesellschaft, z. B. ein an die KG vermietetes Grundstück.", "Grund und Boden wird nicht abgeschrieben; das Gebäude grundsätzlich schon.", "SBV II stärkt die Beteiligung des Gesellschafters an der Gesellschaft.", "Sonder-GuV: Mieteinnahmen minus Gebäude-AfA minus Finanzierungszinsen."],
    example: "Vermietet A Grundstück und Gebäude an die KG, stehen beide in seiner Sonderbilanz. Nur das Gebäude wird linear abgeschrieben; Miete, AfA und Darlehenszinsen bilden das Sonderergebnis.",
    trap: "Finanzierungsdarlehen und Beteiligungsfinanzierung nicht automatisch gleich einordnen. Immer fragen: Dient das Wirtschaftsgut dem Betrieb oder der Beteiligung?",
  },
  {
    kicker: "GEWERBESTEUER",
    title: "Belastung berechnen und Doppelbelastung erklären",
    summary: "Eine gewerblich tätige Personengesellschaft ist selbst Gewerbesteuerschuldnerin; die Einkommensteuer trifft transparent die Gesellschafter.",
    steps: ["Gewerbebetrieb nach § 2 Abs. 1 GewStG prüfen.", "Freibetrag für natürliche Personen und Personengesellschaften: 24.500 € nach § 11 GewStG.", "Gewerbesteuer ist nach § 4 Abs. 5b EStG nicht abzugsfähig und wird steuerlich wieder hinzugerechnet.", "Entlastung auf Gesellschafterebene über § 35 EStG; Kurslogik: Anrechnung bis zum Vierfachen des Messbetrags."],
    example: "Gewerbeertrag 7.235 € bei einer Kapitalgesellschaft: auf 7.200 € abrunden; 7.200 € × 3,5 % = 252 € Messbetrag; × 350 % Hebesatz = 882 € Gewerbesteuer.",
    trap: "Der Freibetrag von 24.500 € gilt nicht für Kapitalgesellschaften.",
  },
  {
    kicker: "BELASTUNGSVERGLEICH",
    title: "Steuerbelastung grafisch erklären",
    summary: "Bei Zeichnungen zählen Achsen, Flächen und die Vergleichbarkeit der Alternativen. Eine Kapitalgesellschaft muss einschließlich Ausschüttung betrachtet werden.",
    steps: ["Grenzsteuersatz: Steuerbelastung der nächsten zusätzlichen Einkommenseinheit.", "Durchschnittsteuersatz: gesamte Steuer geteilt durch gesamtes Einkommen.", "Ehegattensplitting/Familiengesellschaft: Wirkung der Einkommensverteilung zeigen.", "Kapitalgesellschaft: zunächst etwa 15 % KSt plus Gewerbesteuer, anschließend Belastung der Ausschüttung."],
    example: "Bei rund 29 % Belastung auf Gesellschaftsebene bleiben von 100 etwa 71. Werden diese mit 25 % belastet, ergibt sich insgesamt grob eine Belastung von 46,75.",
    trap: "Nur die thesaurierte Belastung der GmbH mit der vollständig dem Gesellschafter zugerechneten Personengesellschaft zu vergleichen ist methodisch unfair.",
  },
  {
    kicker: "BETRIEBSAUFSPALTUNG & DIVIDENDEN",
    title: "Verflechtung erkennen und Teileinkünfte anwenden",
    summary: "Vermietung und Beteiligung werden gewerblich, wenn sachliche und personelle Verflechtung gemeinsam vorliegen.",
    steps: ["Sachliche Verflechtung: eine wesentliche Betriebsgrundlage wird überlassen.", "Personelle Verflechtung: dieselbe Person oder Personengruppe beherrscht Besitz- und Betriebsunternehmen.", "Folge: Betriebsaufspaltung; Miet- und Beteiligungseinkünfte werden betrieblich eingeordnet.", "Dividenden im Betriebsvermögen: Teileinkünfteverfahren mit 60 % steuerpflichtigen Erträgen und 60 % abzugsfähigen Aufwendungen."],
    example: "Dividende 30.000 €, Aufwendungen 200 €: 60 % von 30.000 € = 18.000 €; 60 % von 200 € = 120 €; steuerliches Ergebnis = 17.880 €.",
    trap: "§ 20 und § 21 EStG nicht als Endergebnis stehen lassen, wenn beide Verflechtungen vorliegen.",
  },
  {
    kicker: "KONZERN & PRIVATE EQUITY",
    title: "§ 8b KStG als Rechenkette",
    summary: "Bei Dividenden und Beteiligungsveräußerungen einer Kapitalgesellschaft wird die Freistellung mit pauschal nicht abzugsfähigen Betriebsausgaben kombiniert.",
    steps: ["Dividende: § 8b Abs. 1 KStG freistellen.", "5 % der Dividende nach § 8b Abs. 5 KStG wieder hinzurechnen.", "Veräußerungsgewinn: § 8b Abs. 2 und 3 KStG.", "PE-Struktur: doppelstöckige Kapitalgesellschaft kann Veräußerungsgewinne auf Holdingebene begünstigen; spätere Ausschüttung an die Privatperson bleibt relevant."],
    example: "Handelsrechtlicher Gewinn 80 mit Dividende 100: 80 − 100 nach § 8b Abs. 1 + 5 nach § 8b Abs. 5 = −15 steuerliches Einkommen.",
    trap: "Die Holding verschiebt oder reduziert Belastung auf Gesellschaftsebene, beseitigt aber die spätere Besteuerung beim privaten Investor nicht.",
  },
  {
    kicker: "LETZTER PRÜFUNGSBLOCK",
    title: "Kapitaleinkünfte, Scheinselbstständigkeit und Tax Wedge",
    summary: "Zum Schluss ordnest du die kürzeren Themen sauber ein und vermeidest begriffliche Punktverluste.",
    steps: ["Dividenden: § 20 Abs. 1 Nr. 1 EStG; Veräußerung mindestens 1 % Beteiligung: regelmäßig § 17 EStG und Teileinkünfteverfahren.", "Kleine Portfoliobeteiligung: grundsätzlich Abgeltungsteuer und § 20 Abs. 2 Nr. 1 EStG.", "Dividenden stammen aus bereits belastetem Gesellschaftsgewinn; Darlehenszinsen waren auf Gesellschaftsebene grundsätzlich abzugsfähig.", "Scheinselbstständigkeit ist wegen vermiedener Sozialabgaben attraktiv, wird aber nach der tatsächlichen Eingliederung und Weisungsabhängigkeit beurteilt."],
    example: "Tax Wedge bezeichnet die Differenz zwischen den Arbeitskosten des Arbeitgebers und dem verfügbaren Nettoeinkommen des Arbeitnehmers durch Steuern und Sozialabgaben.",
    trap: "Nicht nur die gewünschte Vertragsbezeichnung prüfen. Für Beschäftigung oder Selbstständigkeit zählt die tatsächliche Durchführung.",
  },
];

const en: TaxPrepChapter[] = [
  { kicker:"30-POINT CORE", title:"Co-entrepreneurship in the correct sequence", summary:"Do not start with the calculation. Draw the partnership, partners and contractual relationships, then work through both profit levels.", steps:["Partner tax status under Sec. 1(1) PITC and Secs. 8/9 GFC.","Classify partnership income under Sec. 18 or Sec. 15(2) PITC.","State co-entrepreneurial risk and initiative.","Partner income equals stage-one share plus the stage-two special result."], example:"Example: −20,000 × 2/3 = −13,333; special remuneration 20,000 less special expenses 16,000 = 4,000; total income = −9,333.", trap:"Special remuneration remains business income under Sec. 15(1) no. 2 PITC." },
  { kicker:"ACCRUALS", title:"Recognise expenses before payment", summary:"Accrual accounting follows economic attribution to the period, not only cash flow.", steps:["Revenue: Bank to sales.","Paid interest: interest expense to bank.","Interest due but unpaid: interest expense to liability.","Unassessed trade tax: trade-tax expense to provision."], example:"December interest is recognised under Sec. 252(1) no. 5 GCC even though cash has not moved.", trap:"Explain why the credit is a liability rather than bank." },
  { kicker:"SPECIAL BUSINESS SPHERE", title:"Separate SBA I, SBA II and the special P&L", summary:"The partner owns the asset, while tax law connects it to the partnership or the participation.", steps:["SBA I directly serves the partnership business.","Land is not depreciated; the building generally is.","SBA II strengthens the participation.","Special P&L: rent less building depreciation and financing interest."], example:"Land and building rented to the KG enter the special balance sheet; only the building is depreciated.", trap:"Classify by function: service to the business or to the participation." },
  { kicker:"TRADE TAX", title:"Calculate the burden and explain relief", summary:"The partnership owes trade tax while partners bear income tax under transparency.", steps:["Check Sec. 2(1) TTC.","EUR 24,500 allowance for individuals and partnerships.","Trade tax is non-deductible and added back.","Relief at partner level under Sec. 35 PITC."], example:"7,235 rounds to 7,200; ×3.5%=252; ×350%=EUR 882.", trap:"Corporations do not receive the EUR 24,500 allowance." },
  { kicker:"BURDEN COMPARISON", title:"Explain the tax burden graph", summary:"Label axes and shaded areas and compare structures on the same distribution basis.", steps:["Marginal versus average tax rate.","Spouse privilege and income allocation.","Company level: roughly 15% CIT plus trade tax.","Add shareholder tax when profits are distributed."], example:"A 29% company burden leaves 71; taxing 25% of 71 gives a total burden of roughly 46.75.", trap:"Do not compare retained corporate profit with fully distributed partnership profit." },
  { kicker:"BUSINESS SPLIT", title:"Identify both nexuses", summary:"A material and a personal nexus convert the rental/shareholding arrangement into a business split.", steps:["Material nexus: essential business asset.","Personal nexus: common control.","Consequence: business split.","Business dividends use the partial-income method."], example:"EUR 30,000 dividend and EUR 200 expenses produce 18,000 − 120 = EUR 17,880.", trap:"Do not stop at Secs. 20 and 21 PITC when both nexuses exist." },
  { kicker:"GROUPS & PRIVATE EQUITY", title:"Apply Sec. 8b CITC as a chain", summary:"Exemption and the 5% add-back must be shown separately.", steps:["Dividend exemption: Sec. 8b(1).","5% add-back: Sec. 8b(5).","Disposal gain: Sec. 8b(2)/(3).","A holding structure does not eliminate later private-level distribution tax."], example:"Commercial profit 80 − dividend 100 + 5% add-back 5 = taxable income −15.", trap:"Always mention the later distribution to the individual investor." },
  { kicker:"FINAL BLOCK", title:"Capital income, bogus self-employment and tax wedge", summary:"Classify the shorter topics precisely.", steps:["Dividends: Sec. 20(1) no. 1 PITC.","At least 1% participation: generally Sec. 17 and partial-income method.","Portfolio holding: final withholding tax.","Employment status follows actual control and integration, not the contract label."], example:"The tax wedge is the gap between employer labour costs and the employee's disposable net income.", trap:"Interest and dividends have different prior company-level tax treatment." },
];

export function taxPrepChapters(language: Language) {
  return language === "de" ? de : en;
}
