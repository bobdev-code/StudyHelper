import { modelOverviews } from "./models";
import { portfolioCards, portfolioQuiz } from "./portfolio";
import { taxCards, taxQuiz } from "./tax";
import { taxSupplementCards, taxSupplementQuiz } from "./taxSupplement";
import { quizVariants } from "./quizVariants";
import { learningVideos } from "./videos";

export const flashcards = [...portfolioCards, ...taxCards, ...taxSupplementCards];
export const quizQuestions = [...portfolioQuiz, ...taxQuiz, ...taxSupplementQuiz, ...quizVariants];
export { learningVideos, modelOverviews };
