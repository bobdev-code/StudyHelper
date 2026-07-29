export type ForecastStage = "none" | "recall" | "application" | "transfer" | "timed";

export type ForecastTopic = {
  weight: number;
  mastery: number;
  attempts: number;
  days: number;
  variants: number;
  highestStage: ForecastStage;
};

export type ForecastExam = {
  score: number;
  maxScore: number;
};

const stageEvidence: Record<ForecastStage, number> = {
  none: 0,
  recall: 0.55,
  application: 0.75,
  transfer: 0.9,
  timed: 1,
};

export function stabilizedForecast({
  baseline,
  maxPoints = 90,
  topics,
  exams,
}: {
  baseline: number;
  maxPoints?: number;
  topics: ForecastTopic[];
  exams: ForecastExam[];
}) {
  if (!topics.some((item) => item.attempts > 0) && !exams.length) {
    return { low: baseline, high: baseline, central: baseline };
  }

  const baselinePercent = baseline / maxPoints * 100;
  const topicWeight = topics.reduce((sum, item) => sum + item.weight, 0) || 1;
  const topicPercent = topics.reduce((sum, item) => {
    if (!item.attempts) return sum + baselinePercent * item.weight;
    const evidence = Math.min(
      0.95,
      (0.12 + Math.log1p(item.attempts) * 0.16 + Math.min(4, item.days) * 0.04 + Math.min(5, item.variants) * 0.03)
      * stageEvidence[item.highestStage],
    );
    const estimate = baselinePercent + (item.mastery - baselinePercent) * evidence;
    return sum + estimate * item.weight;
  }, 0) / topicWeight;
  const topicEstimate = topicPercent / 100 * maxPoints;

  const examPoints = exams.reduce((sum, item) => sum + item.maxScore, 0);
  const examEstimate = examPoints
    ? exams.reduce((sum, item) => sum + item.score / item.maxScore * maxPoints * item.maxScore, 0) / examPoints
    : topicEstimate;
  const examInfluence = Math.min(0.65, examPoints / (maxPoints * 2) * 0.6);
  const central = Math.round(topicEstimate * (1 - examInfluence) + examEstimate * examInfluence);
  const coverage = topics.filter((item) => item.attempts > 0).length / Math.max(1, topics.length);
  const uncertainty = Math.max(5, Math.round(13 - coverage * 5 - Math.min(3, examPoints / maxPoints)));

  return {
    low: Math.max(0, Math.round(central - uncertainty)),
    high: Math.min(maxPoints, Math.round(central + uncertainty)),
    central,
  };
}
