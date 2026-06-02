/**
 * Calculates the Elo rating changes for two players.
 * 
 * @param {number} ratingA - Current rating of Player A
 * @param {number} ratingB - Current rating of Player B
 * @param {'player_a' | 'player_b' | 'draw'} outcome - Outcome of the debate
 * @param {number} kFactor - The Elo K-Factor (default: 32)
 * @returns {{changeA: number, changeB: number}} The change in ratings
 */
export function calculateElo(ratingA, ratingB, outcome, kFactor = 32) {
  // Expected scores
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

  // Actual scores
  let scoreA = 0.5;
  let scoreB = 0.5;

  if (outcome === 'player_a') {
    scoreA = 1.0;
    scoreB = 0.0;
  } else if (outcome === 'player_b') {
    scoreA = 0.0;
    scoreB = 1.0;
  }

  // Calculate rating changes
  const changeA = Math.round(kFactor * (scoreA - expectedA));
  const changeB = Math.round(kFactor * (scoreB - expectedB));

  return {
    changeA,
    changeB
  };
}
