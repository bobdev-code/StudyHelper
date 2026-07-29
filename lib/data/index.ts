import { modelOverviews } from "./models";
import { portfolioCards, portfolioQuiz } from "./portfolio";
import { taxCards, taxQuiz } from "./tax";
import { taxSupplementCards, taxSupplementQuiz } from "./taxSupplement";
import { learningVideos } from "./videos";

export const flashcards = [...portfolioCards, ...taxCards, ...taxSupplementCards];
export const quizQuestions = [...portfolioQuiz, ...taxQuiz, ...taxSupplementQuiz];
export { learningVideos, modelOverviews };
