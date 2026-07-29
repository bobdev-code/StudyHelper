export type FormulaEntry = {
  number: number;
  name: string;
  formula: string;
  page: 1 | 2;
};

export type FormulaGroup = {
  id: string;
  label: string;
  labelEn: string;
  formulas: FormulaEntry[];
};

export const portfolioFormulaGroups: FormulaGroup[] = [
  {
    id: "return-risk",
    label: "Rendite, Gewichte & Risiko",
    labelEn: "Returns, weights & risk",
    formulas: [
      { number: 1, name: "Discrete return", formula: "rᵢᵏ = Vᵢᵗᵏ / Vᵢᵗᵏ⁻¹ − 1", page: 1 },
      { number: 2, name: "Arithmetic mean return", formula: "r̄ᵢ = (1/N) Σₖ₌₁ᴺ rᵢᵏ", page: 1 },
      { number: 3, name: "Geometric mean return", formula: "r̂ᵢ = [Πₖ₌₁ᴺ(1+rᵢᵏ)]¹/ᴺ − 1", page: 1 },
      { number: 4, name: "Portfolio weights", formula: "ωᵢ = market value of asset i / market value of all assets", page: 1 },
      { number: 5, name: "Portfolio return", formula: "rₚᵏ = Σₖ₌₁ᴺ ωᵢ · rᵢᵏ = ωᵀrᵏ", page: 1 },
      { number: 6, name: "Variance of security returns", formula: "σᵢ² = (1/C) Σₖ₌₁ᴺ(rᵢᵏ−r̄ᵢ)²; C=N or N−1", page: 1 },
      { number: 7, name: "Portfolio variance", formula: "σₚ² = ωᵀΣω = Σωᵢ²σᵢ² + ΣᵢΣⱼ≠ᵢ ωᵢωⱼσᵢⱼ", page: 1 },
      { number: 8, name: "Covariance of security returns", formula: "σᵢⱼ = (1/C) Σₖ₌₁ᴺ(rᵢᵏ−r̄ᵢ)(rⱼᵏ−r̄ⱼ)", page: 1 },
      { number: 9, name: "Covariance between portfolios", formula: "σPᵢ,Pⱼ = ωᵢᵀΣωⱼ", page: 1 },
      { number: 10, name: "Correlation", formula: "ρᵢⱼ = σᵢⱼ / (σᵢσⱼ)", page: 1 },
      { number: 44, name: "Minimum Variance Portfolio", formula: "ω₁* = (σ₂²−ρ₁₂σ₁σ₂)/(σ₁²+σ₂²−2ρ₁₂σ₁σ₂)", page: 2 },
    ],
  },
  {
    id: "capm-factors",
    label: "CAPM, CML & Faktormodelle",
    labelEn: "CAPM, CML & factor models",
    formulas: [
      { number: 11, name: "Lagrangian approach", formula: "min/max f(x) subject to g(x)=y → f(x)−λ[g(x)−y]", page: 1 },
      { number: 12, name: "Capital Market Line", formula: "E[r] = r𝒻 + [(E[rM]−r𝒻)/σM] · σ", page: 1 },
      { number: 13, name: "CAPM", formula: "E[rᵢ] = r𝒻 + βᵢ(E[rM]−r𝒻)", page: 1 },
      { number: 14, name: "CAPM beta", formula: "βᵢ = σᵢ,M / σM²", page: 1 },
      { number: 15, name: "Portfolio CAPM beta", formula: "βₚ = Σᵢ₌₁ᴺ ωᵢβᵢ", page: 1 },
      { number: 16, name: "Variance using CAPM", formula: "σᵢ² = βᵢ²σM² + σeᵢ²", page: 1 },
      { number: 17, name: "CAPM valuation", formula: "P₀ = E[P̃ₑ] / {1+r𝒻+βᵢ[E(rM)−r𝒻]}", page: 1 },
      { number: 18, name: "Covariance valuation", formula: "P₀ = E[P̃ₑ] / (1+r𝒻+λσᵢ,M)", page: 1 },
      { number: 19, name: "Market price per unit of risk", formula: "λ = [E(rM)−r𝒻]/σM²", page: 2 },
      { number: 20, name: "Certainty equivalent", formula: "P₀ = {E[P̃ₑ]−λ·COV[P̃ₑ,r̃M]}/(1+r𝒻)", page: 2 },
      { number: 21, name: "K-factor model", formula: "r̃ᵢ = E[r̃ᵢ] + Σⱼ₌₁ᴷ βᵢⱼF̃ⱼ + ẽᵢ", page: 2 },
      { number: 22, name: "K-factor model for portfolios", formula: "r̃ₚ = ΣωᵢE[r̃ᵢ] + ΣⱼΣᵢωᵢβᵢⱼF̃ⱼ + Σωᵢẽᵢ", page: 2 },
      { number: 23, name: "Multi-factor SML", formula: "E[rᵢ] = r𝒻 + Σⱼ₌₁ᴷ(E[rⱼ]−r𝒻)βᵢⱼ", page: 2 },
      { number: 24, name: "Factor risk premium", formula: "RPⱼ = E[rⱼ]−r𝒻", page: 2 },
      { number: 25, name: "Single-factor model", formula: "r̃ᵢ = E[r̃ᵢ] + βᵢF̃ + ẽᵢ", page: 2 },
      { number: 26, name: "Variance in single-factor model", formula: "σᵢ² = βᵢ²σF² + σeᵢ²", page: 2 },
      { number: 27, name: "Covariance in single-factor model", formula: "σᵢⱼ = βᵢβⱼσF²", page: 2 },
      { number: 28, name: "Fama-French three-factor model", formula: "r̃ᵢ−r𝒻 = αᵢ+βᵢM·r̃M+βᵢSMB·SMB+βᵢHML·HML+ẽᵢ", page: 2 },
    ],
  },
  {
    id: "performance-time",
    label: "Zeitgewichtung & Performancemaße",
    labelEn: "Time weighting & performance measures",
    formulas: [
      { number: 29, name: "Time-weighted return", formula: "(1+rᵀ)ᴺ = (1+r¹)(1+r²)…(1+rᴺ)", page: 2 },
      { number: 30, name: "Dollar-weighted return", formula: "PV = C₁/(1+rᴰ)¹ + C₂/(1+rᴰ)² + … + Cᴺ/(1+rᴰ)ᴺ", page: 2 },
      { number: 31, name: "Annualized returns", formula: "rᵢᵖ·ᵃ· = [Πₖ₌₁ᴺ(1+rᵢᵏ)]ᴸ/ᴺ − 1", page: 2 },
      { number: 32, name: "Alpha", formula: "αₚᵏ = rₚᵏ−rBMᵏ", page: 2 },
      { number: 33, name: "Annualized variance", formula: "VAR[rᵢ]ᵖ·ᵃ· = L · VAR[rᵢ]ˢᵘᵇ", page: 2 },
      { number: 34, name: "Annualized standard deviation", formula: "σᵢᵖ·ᵃ· = √L · σᵢˢᵘᵇ", page: 2 },
      { number: 35, name: "Jensen alpha", formula: "αₚᴶ = rₚ − [r𝒻+βₚ(rM−r𝒻)]", page: 2 },
      { number: 36, name: "Sharpe Ratio", formula: "SR = (rₚ−r𝒻)/σₚ", page: 2 },
      { number: 37, name: "Treynor Ratio", formula: "TR = (rₚ−r𝒻)/βₚ", page: 2 },
      { number: 38, name: "Information Ratio", formula: "IR = (rₚ−rBM)/TE", page: 2 },
      { number: 39, name: "Tracking error", formula: "TE = √VAR[αₚᵏ]", page: 2 },
      { number: 40, name: "M² Measure", formula: "M² = rP*−rM", page: 2 },
    ],
  },
  {
    id: "options",
    label: "Optionen",
    labelEn: "Options",
    formulas: [
      { number: 41, name: "Intrinsic value of Call", formula: "IVCall = max{S−X,0}", page: 2 },
      { number: 42, name: "Intrinsic value of Put", formula: "IVPut = max{X−S,0}", page: 2 },
      { number: 43, name: "Put-Call Parity", formula: "CE + PDV(X) = PE + S", page: 2 },
    ],
  },
];
