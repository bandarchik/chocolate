/**
 * Wilson Lower Bound scoring with time decay for comment ranking.
 * Uses 95% confidence interval for vote-based scoring.
 */

const Z_95 = 1.96;

export function wilsonLowerBound(upvotes: number, downvotes: number): number {
  const n = upvotes + downvotes;
  if (n === 0) return 0;

  const phat = upvotes / n;
  const zSquared = Z_95 * Z_95;

  const numerator =
    phat + zSquared / (2 * n) - Z_95 * Math.sqrt((phat * (1 - phat) + zSquared / (4 * n)) / n);
  const denominator = 1 + zSquared / n;

  return numerator / denominator;
}

export function computeHotRank(score: number, createdAt: number): number {
  const wilson = score > 0 ? wilsonLowerBound(score, 0) : 0;
  const ageHours = (Date.now() - createdAt) / (1000 * 60 * 60);
  const decay = 1 / Math.sqrt(ageHours + 2);
  return wilson * decay;
}

export function computeHotRankFromVotes(
  upvotes: number,
  downvotes: number,
  createdAt: number
): number {
  const wilson = wilsonLowerBound(upvotes, downvotes);
  const ageHours = (Date.now() - createdAt) / (1000 * 60 * 60);
  const decay = 1 / Math.sqrt(ageHours + 2);
  return wilson * decay;
}

interface RankableComment {
  _id: string;
  upvotes: number;
  downvotes: number;
  createdAt: number;
  [key: string]: unknown;
}

export function rankComments<T extends RankableComment>(comments: T[]): T[] {
  return [...comments].sort((a, b) => {
    const rankA = computeHotRankFromVotes(a.upvotes, a.downvotes, a.createdAt);
    const rankB = computeHotRankFromVotes(b.upvotes, b.downvotes, b.createdAt);
    return rankB - rankA;
  });
}
