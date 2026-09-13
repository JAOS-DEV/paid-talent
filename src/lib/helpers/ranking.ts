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

/**
 * v1.1 Scoring Weights
 *
 * The composite score (0-100) is calculated from four weighted factors:
 *
 * 1. Profile Completeness (25%): Reward complete profiles
 *    - Uses existing profile completeness calculation (0-100%)
 *    - Contributes 0-25 points to final score
 *
 * 2. Unique Recruiter Views (30%): Measure demand/visibility
 *    - Counts distinct recruiter views within time window
 *    - Uses logarithmic scaling with diminishing returns
 *    - Caps at ~15 views for max points (30 points)
 *
 * 3. Interest Rate (25%): Measure recruiter engagement
 *    - Counts unique interests received
 *    - Uses logarithmic scaling with diminishing returns
 *    - Caps at ~10 interests for max points (25 points)
 *
 * 4. Recency (20%): Favor recently active profiles
 *    - Based on profile updatedAt timestamp
 *    - Linear decay: fresh profiles get 20pts, stale profiles 0pts
 *    - Decay window matches timeWindowDays (default 30 days)
 */
export interface ScoringWeights {
  profileCompleteness: number;
  uniqueViews: number;
  interestRate: number;
  recency: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  profileCompleteness: 25,
  uniqueViews: 30,
  interestRate: 25,
  recency: 20,
};

export interface V11RankingCriteria extends RankingCriteria {
  weights?: Partial<ScoringWeights>;
  viewCapForMaxScore?: number;
  interestCapForMaxScore?: number;
}

export const DEFAULT_V11_CRITERIA: Required<Omit<V11RankingCriteria, "weights">> & {
  weights: ScoringWeights;
} = {
  ...DEFAULT_RANKING_CRITERIA,
  weights: DEFAULT_SCORING_WEIGHTS,
  viewCapForMaxScore: 15,
  interestCapForMaxScore: 10,
};

export function mergeV11Criteria(
  criteria?: V11RankingCriteria
): typeof DEFAULT_V11_CRITERIA {
  return {
    ...DEFAULT_V11_CRITERIA,
    ...criteria,
    weights: {
      ...DEFAULT_SCORING_WEIGHTS,
      ...criteria?.weights,
    },
  };
}

/**
 * Calculate profile completeness score component
 * @param completenessPercent - 0-100 percentage
 * @param maxPoints - Maximum points for this factor
 * @returns Score between 0 and maxPoints
 */
export function calculateCompletenessScore(
  completenessPercent: number,
  maxPoints: number
): number {
  const normalizedPercent = Math.max(0, Math.min(100, completenessPercent));
  return Math.round((normalizedPercent / 100) * maxPoints * 100) / 100;
}

/**
 * Calculate unique views score with logarithmic diminishing returns
 * @param uniqueViewCount - Number of unique recruiter views
 * @param capForMaxScore - View count that yields maximum score
 * @param maxPoints - Maximum points for this factor
 * @returns Score between 0 and maxPoints
 */
export function calculateViewScore(
  uniqueViewCount: number,
  capForMaxScore: number,
  maxPoints: number
): number {
  if (uniqueViewCount <= 0) return 0;
  if (capForMaxScore <= 0) return 0;

  const normalizedViews = Math.min(uniqueViewCount, capForMaxScore * 2);
  const logScore = Math.log(normalizedViews + 1) / Math.log(capForMaxScore + 1);
  const score = Math.min(1, logScore) * maxPoints;
  return Math.round(score * 100) / 100;
}

/**
 * Calculate interest score with logarithmic diminishing returns
 * @param interestCount - Number of unique interests received
 * @param capForMaxScore - Interest count that yields maximum score
 * @param maxPoints - Maximum points for this factor
 * @returns Score between 0 and maxPoints
 */
export function calculateInterestScore(
  interestCount: number,
  capForMaxScore: number,
  maxPoints: number
): number {
  if (interestCount <= 0) return 0;
  if (capForMaxScore <= 0) return 0;

  const normalizedInterests = Math.min(interestCount, capForMaxScore * 2);
  const logScore =
    Math.log(normalizedInterests + 1) / Math.log(capForMaxScore + 1);
  const score = Math.min(1, logScore) * maxPoints;
  return Math.round(score * 100) / 100;
}

/**
 * Calculate recency score with linear decay
 * @param updatedAt - Last profile update timestamp
 * @param timeWindowDays - Days until score reaches 0
 * @param maxPoints - Maximum points for this factor
 * @param now - Reference date (defaults to current time)
 * @returns Score between 0 and maxPoints
 */
export function calculateRecencyScore(
  updatedAt: Date | null,
  timeWindowDays: number,
  maxPoints: number,
  now: Date = new Date()
): number {
  if (!updatedAt) return 0;
  if (timeWindowDays <= 0) return 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceUpdate =
    (now.getTime() - updatedAt.getTime()) / msPerDay;

  if (daysSinceUpdate < 0) return maxPoints;
  if (daysSinceUpdate >= timeWindowDays) return 0;

  const decayFactor = 1 - daysSinceUpdate / timeWindowDays;
  return Math.round(decayFactor * maxPoints * 100) / 100;
}

/**
 * Calculate composite v1.1 score from all factors
 */
export interface ScoreComponents {
  completenessScore: number;
  viewScore: number;
  interestScore: number;
  recencyScore: number;
  totalScore: number;
}

export function calculateCompositeScore(
  completenessPercent: number,
  uniqueViewCount: number,
  interestCount: number,
  updatedAt: Date | null,
  criteria?: V11RankingCriteria,
  now?: Date
): ScoreComponents {
  const merged = mergeV11Criteria(criteria);

  const completenessScore = calculateCompletenessScore(
    completenessPercent,
    merged.weights.profileCompleteness
  );

  const viewScore = calculateViewScore(
    uniqueViewCount,
    merged.viewCapForMaxScore,
    merged.weights.uniqueViews
  );

  const interestScore = calculateInterestScore(
    interestCount,
    merged.interestCapForMaxScore,
    merged.weights.interestRate
  );

  const recencyScore = calculateRecencyScore(
    updatedAt,
    merged.timeWindowDays,
    merged.weights.recency,
    now
  );

  const totalScore =
    Math.round(
      (completenessScore + viewScore + interestScore + recencyScore) * 100
    ) / 100;

  return {
    completenessScore,
    viewScore,
    interestScore,
    recencyScore,
    totalScore,
  };
}

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
