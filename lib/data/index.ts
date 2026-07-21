import { modelOverviews } from "./models";
import { portfolioCards, portfolioQuiz } from "./portfolio";
import { taxCards, taxQuiz } from "./tax";
import { learningVideos } from "./videos";

export const flashcards = [...portfolioCards, ...taxCards];
export const quizQuestions = [...portfolioQuiz, ...taxQuiz];
export { learningVideos, modelOverviews };
