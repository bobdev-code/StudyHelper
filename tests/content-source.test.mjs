import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const portfolioPath = new URL("../lib/data/portfolio.ts", import.meta.url);
const taxPath = new URL("../lib/data/tax.ts", import.meta.url);

test("ships the promised sourced learning-content minimum", async () => {
  const [portfolio, tax] = await Promise.all([
    readFile(portfolioPath, "utf8"),
    readFile(taxPath, "utf8"),
  ]);

  const portfolioCards = portfolio.match(/pc\("p\d{2}"/g) ?? [];
  const portfolioQuiz = portfolio.match(/id:\s*"pq\d{2}"/g) ?? [];
  const taxCards = tax.match(/tc\("t\d{2}"/g) ?? [];
  const taxQuiz = tax.match(/id:\s*"tq\d{2}"/g) ?? [];

  assert.ok(portfolioCards.length >= 60, `portfolio cards: ${portfolioCards.length}`);
  assert.ok(taxCards.length >= 50, `tax cards: ${taxCards.length}`);
  assert.ok(portfolioQuiz.length >= 40, `portfolio quiz: ${portfolioQuiz.length}`);
  assert.ok(taxQuiz.length >= 30, `tax quiz: ${taxQuiz.length}`);

  for (const blocked of [
    "PS8_25_Solution_Final.pdf",
    "BSC_Portfolio_Management_FT25_90_final_Solution.pdf",
    "PS8_25_Final.pdf",
  ]) {
    assert.equal(portfolio.includes(blocked), false, `${blocked} must stay blocked`);
  }
});
