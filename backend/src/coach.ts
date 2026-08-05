// Turn Azure scores into encouraging, specific coaching - no raw numbers to
// the learner. Pure + dependency-free so it's cheap to unit-check.
export function coach(score: number, words: { word: string; errorType: string }[]): string {
  const bad = words.find((w) => w.errorType === "Mispronunciation");
  if (score >= 85) return "Excellent pronunciation!";
  if (score >= 65) {
    return bad ? `Nice! Watch the word "${bad.word}" - try it once more.` : "Good - keep going!";
  }
  return bad
    ? `Let's practice "${bad.word}" slowly. Repeat after me.`
    : "Almost - say it a little slower and try again.";
}
