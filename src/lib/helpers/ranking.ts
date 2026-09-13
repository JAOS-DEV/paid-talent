export interface RankingCriteria {
  timeWindowDays?: number;
  topTalentThreshold?: number;
  minViews?: number;
}

export const DEFAULT_RANKING_CRITERIA: Required<RankingCriteria> = {
  timeWindowDays: 30,
  topTalentThreshold: 0.1,
  minViews: 5,
};

export function mergeCriteria(
  criteria?: RankingCriteria
): Required<RankingCriteria> {
  return { ...DEFAULT_RANKING_CRITERIA, ...criteria };
}

export function calculateTopTalentCutoffIndex(
  totalProfiles: number,
  threshold: number
): number {
  return Math.max(1, Math.floor(totalProfiles * threshold));
}

export function isScoreAboveThreshold(
  score: number,
  cutoffScore: number,
  minViews: number
): boolean {
  return score >= minViews && score >= cutoffScore;
}

export function determineTopTalentStatus(
  viewCount: number,
  allViewCounts: number[],
  criteria?: RankingCriteria
): boolean {
  const { topTalentThreshold, minViews } = mergeCriteria(criteria);

  if (viewCount < minViews) {
    return false;
  }

  if (allViewCounts.length === 0) {
    return false;
  }

  const sortedScores = [...allViewCounts].sort((a, b) => b - a);
  const cutoffIndex = calculateTopTalentCutoffIndex(
    sortedScores.length,
    topTalentThreshold
  );
  const cutoffScore = sortedScores[cutoffIndex - 1] ?? 0;

  return viewCount >= cutoffScore;
}

export function calculateCutoffScore(
  viewCounts: number[],
  threshold: number
): number {
  if (viewCounts.length === 0) {
    return 0;
  }

  const sortedScores = [...viewCounts].sort((a, b) => b - a);
  const cutoffIndex = calculateTopTalentCutoffIndex(
    sortedScores.length,
    threshold
  );
  return sortedScores[cutoffIndex - 1] ?? 0;
}

export function rankProfiles<T extends { viewCount: number }>(
  profiles: T[]
): (T & { rank: number })[] {
  return profiles
    .sort((a, b) => b.viewCount - a.viewCount)
    .map((profile, index) => ({ ...profile, rank: index + 1 }));
}

export function getStartDateForTimeWindow(
  timeWindowDays: number,
  now: Date = new Date()
): Date {
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - timeWindowDays);
  return startDate;
}
