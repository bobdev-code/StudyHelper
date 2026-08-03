import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("registration emails return users to the active StudyHelper site", async () => {
  const [page, supabase] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /emailRedirectTo: getEmailRedirectTo\(\)/);
  assert.match(supabase, /window\.location\.origin/);
  assert.match(supabase, /https:\/\/studyhelper-gamma\.vercel\.app/);
  assert.doesNotMatch(supabase, /http:\/\/localhost:3000/);
});
