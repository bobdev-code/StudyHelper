import { modelOverviews } from "./models";
import { portfolioCards, portfolioQuiz } from "./portfolio";
import { taxCards, taxQuiz } from "./tax";

export const flashcards = [...portfolioCards, ...taxCards];
export const quizQuestions = [...portfolioQuiz, ...taxQuiz];
export { modelOverviews };
