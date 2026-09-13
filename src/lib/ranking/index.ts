import { db, workerProfiles, profileViews, profileInterests } from "@/lib/db";
import { eq, desc, sql, and, gte, countDistinct } from "drizzle-orm";
import { getProfileCompleteness } from "@/lib/profile";
import {
  calculateCompositeScore,
  mergeV11Criteria,
  type V11RankingCriteria,
  type ScoreComponents,
  DEFAULT_V11_CRITERIA,
} from "@/lib/helpers/ranking";

export interface RankedWorkerProfile {
  profileId: string;
  userId: string;
  displayName: string;
  photoUrl: string | null;
  location: string | null;
  area: string | null;
  jobRoles: string[];
  availability: string | null;
  isTopTalent: boolean;
  rankScore: number;
  viewCount: number;
}

export interface RankingCriteria {
  timeWindowDays?: number;
  topTalentThreshold?: number;
  minViews?: number;
}

export interface RankingProvider {
  name: string;
  calculateScore(profileId: string, criteria?: RankingCriteria): Promise<number>;
  isTopTalent(profileId: string, criteria?: RankingCriteria): Promise<boolean>;
  getRankedProfiles(
    limit: number,
    offset: number,
    criteria?: RankingCriteria
  ): Promise<RankedWorkerProfile[]>;
}

class ViewBasedRankingProvider implements RankingProvider {
  name = "view-based";

  private defaultCriteria: RankingCriteria = {
    timeWindowDays: 30,
    topTalentThreshold: 0.1,
    minViews: 5,
  };

  async calculateScore(
    profileId: string,
    criteria?: RankingCriteria
  ): Promise<number> {
    const { timeWindowDays } = { ...this.defaultCriteria, ...criteria };

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (timeWindowDays ?? 30));

    const [result] = await db
      .select({
        viewCount: sql<number>`count(*)::int`,
      })
      .from(profileViews)
      .where(
        and(
          eq(profileViews.workerProfileId, profileId),
          gte(profileViews.viewedAt, startDate)
        )
      );

    return result?.viewCount ?? 0;
  }

  async isTopTalent(
    profileId: string,
    criteria?: RankingCriteria
  ): Promise<boolean> {
    const { topTalentThreshold, minViews } = {
      ...this.defaultCriteria,
      ...criteria,
    };

    const score = await this.calculateScore(profileId, criteria);

    if (score < (minViews ?? 5)) {
      return false;
    }

    const allScores = await this.getAllScores(criteria);
    if (allScores.length === 0) return false;

    const sortedScores = allScores.sort((a, b) => b - a);
    const threshold = topTalentThreshold ?? 0.1;
    const cutoffIndex = Math.max(1, Math.floor(sortedScores.length * threshold));
    const cutoffScore = sortedScores[cutoffIndex - 1] ?? 0;

    return score >= cutoffScore;
  }

  async getRankedProfiles(
    limit: number,
    offset: number,
    criteria?: RankingCriteria
  ): Promise<RankedWorkerProfile[]> {
    const { timeWindowDays, topTalentThreshold, minViews } = {
      ...this.defaultCriteria,
      ...criteria,
    };

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (timeWindowDays ?? 30));

    const profilesWithViews = await db
      .select({
        profile: workerProfiles,
        viewCount: sql<number>`coalesce(count(${profileViews.id})::int, 0)`,
      })
      .from(workerProfiles)
      .leftJoin(
        profileViews,
        and(
          eq(profileViews.workerProfileId, workerProfiles.id),
          gte(profileViews.viewedAt, startDate)
        )
      )
      .where(eq(workerProfiles.isPublished, true))
      .groupBy(workerProfiles.id)
      .orderBy(desc(sql`count(${profileViews.id})`))
      .limit(limit)
      .offset(offset);

    const allViewCounts = profilesWithViews.map((p) => p.viewCount);
    const sortedCounts = [...allViewCounts].sort((a, b) => b - a);
    const threshold = topTalentThreshold ?? 0.1;
    const cutoffIndex = Math.max(
      1,
      Math.floor(sortedCounts.length * threshold)
    );
    const cutoffScore = sortedCounts[cutoffIndex - 1] ?? 0;

    return profilesWithViews.map(({ profile, viewCount }) => ({
      profileId: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl,
      location: profile.location,
      area: profile.area,
      jobRoles: (profile.jobRoles as string[]) ?? [],
      availability: profile.availability,
      isTopTalent:
        viewCount >= (minViews ?? 5) && viewCount >= cutoffScore,
      rankScore: viewCount,
      viewCount,
    }));
  }

  private async getAllScores(criteria?: RankingCriteria): Promise<number[]> {
    const { timeWindowDays } = { ...this.defaultCriteria, ...criteria };

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (timeWindowDays ?? 30));

    const results = await db
      .select({
        viewCount: sql<number>`count(*)::int`,
      })
      .from(profileViews)
      .where(gte(profileViews.viewedAt, startDate))
      .groupBy(profileViews.workerProfileId);

    return results.map((r) => r.viewCount);
  }
}

/**
 * v1.1 Composite Ranking Provider
 *
 * Scores profiles based on four weighted factors:
 * 1. Profile Completeness (25%) - Rewards complete profiles
 * 2. Unique Recruiter Views (30%) - Measures demand with logarithmic scaling
 * 3. Interest Rate (25%) - Counts recruiter interests with logarithmic scaling
 * 4. Recency (20%) - Linear decay favoring recently updated profiles
 *
 * Total score range: 0-100
 *
 * @see DEFAULT_SCORING_WEIGHTS in helpers/ranking.ts for weight configuration
 */
class CompositeRankingProvider implements RankingProvider {
  name = "composite-v1.1";

  private defaultCriteria = DEFAULT_V11_CRITERIA;

  async calculateScore(
    profileId: string,
    criteria?: RankingCriteria
  ): Promise<number> {
    const v11Criteria = criteria as V11RankingCriteria | undefined;
    const components = await this.getScoreComponents(profileId, v11Criteria);
    return components.totalScore;
  }

  async getScoreComponents(
    profileId: string,
    criteria?: V11RankingCriteria
  ): Promise<ScoreComponents> {
    const merged = mergeV11Criteria(criteria);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - merged.timeWindowDays);

    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, profileId))
      .limit(1);

    if (!profile) {
      return {
        completenessScore: 0,
        viewScore: 0,
        interestScore: 0,
        recencyScore: 0,
        totalScore: 0,
      };
    }

    const completeness = getProfileCompleteness(profile);

    const [viewResult] = await db
      .select({
        uniqueViewCount: countDistinct(profileViews.viewerUserId),
      })
      .from(profileViews)
      .where(
        and(
          eq(profileViews.workerProfileId, profileId),
          gte(profileViews.viewedAt, startDate),
          sql`${profileViews.viewerUserId} IS NOT NULL`
        )
      );

    const [interestResult] = await db
      .select({
        interestCount: sql<number>`count(*)::int`,
      })
      .from(profileInterests)
      .where(eq(profileInterests.workerProfileId, profileId));

    return calculateCompositeScore(
      completeness.progress,
      viewResult?.uniqueViewCount ?? 0,
      interestResult?.interestCount ?? 0,
      profile.updatedAt,
      criteria
    );
  }

  async isTopTalent(
    profileId: string,
    criteria?: RankingCriteria
  ): Promise<boolean> {
    const v11Criteria = criteria as V11RankingCriteria | undefined;
    const merged = mergeV11Criteria(v11Criteria);

    const score = await this.calculateScore(profileId, criteria);

    const maxPossibleScore =
      merged.weights.profileCompleteness +
      merged.weights.uniqueViews +
      merged.weights.interestRate +
      merged.weights.recency;
    const minimumTopTalentScore = maxPossibleScore * (1 - merged.topTalentThreshold);

    return score >= minimumTopTalentScore;
  }

  async getRankedProfiles(
    limit: number,
    offset: number,
    criteria?: RankingCriteria
  ): Promise<RankedWorkerProfile[]> {
    const v11Criteria = criteria as V11RankingCriteria | undefined;
    const merged = mergeV11Criteria(v11Criteria);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - merged.timeWindowDays);

    const profiles = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.isPublished, true));

    const profileScores: Array<{
      profile: typeof profiles[0];
      components: ScoreComponents;
      viewCount: number;
    }> = [];

    for (const profile of profiles) {
      const completeness = getProfileCompleteness(profile);

      const [viewResult] = await db
        .select({
          uniqueViewCount: countDistinct(profileViews.viewerUserId),
          totalViewCount: sql<number>`count(*)::int`,
        })
        .from(profileViews)
        .where(
          and(
            eq(profileViews.workerProfileId, profile.id),
            gte(profileViews.viewedAt, startDate),
            sql`${profileViews.viewerUserId} IS NOT NULL`
          )
        );

      const [interestResult] = await db
        .select({
          interestCount: sql<number>`count(*)::int`,
        })
        .from(profileInterests)
        .where(eq(profileInterests.workerProfileId, profile.id));

      const components = calculateCompositeScore(
        completeness.progress,
        viewResult?.uniqueViewCount ?? 0,
        interestResult?.interestCount ?? 0,
        profile.updatedAt,
        v11Criteria
      );

      const [totalViewResult] = await db
        .select({
          viewCount: sql<number>`count(*)::int`,
        })
        .from(profileViews)
        .where(
          and(
            eq(profileViews.workerProfileId, profile.id),
            gte(profileViews.viewedAt, startDate)
          )
        );

      profileScores.push({
        profile,
        components,
        viewCount: totalViewResult?.viewCount ?? 0,
      });
    }

    profileScores.sort((a, b) => b.components.totalScore - a.components.totalScore);

    const maxPossibleScore =
      merged.weights.profileCompleteness +
      merged.weights.uniqueViews +
      merged.weights.interestRate +
      merged.weights.recency;
    const topTalentCutoff = maxPossibleScore * (1 - merged.topTalentThreshold);

    const paginatedProfiles = profileScores.slice(offset, offset + limit);

    return paginatedProfiles.map(({ profile, components, viewCount }) => ({
      profileId: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl,
      location: profile.location,
      area: profile.area,
      jobRoles: (profile.jobRoles as string[]) ?? [],
      availability: profile.availability,
      isTopTalent: components.totalScore >= topTalentCutoff,
      rankScore: components.totalScore,
      viewCount,
    }));
  }
}

let currentProvider: RankingProvider = new CompositeRankingProvider();

export function setRankingProvider(provider: RankingProvider): void {
  currentProvider = provider;
  console.log(`[Ranking] Provider set to: ${provider.name}`);
}

export function getRankingProvider(): RankingProvider {
  return currentProvider;
}

export async function calculateProfileScore(
  profileId: string,
  criteria?: RankingCriteria
): Promise<number> {
  return currentProvider.calculateScore(profileId, criteria);
}

export async function isProfileTopTalent(
  profileId: string,
  criteria?: RankingCriteria
): Promise<boolean> {
  return currentProvider.isTopTalent(profileId, criteria);
}

export async function getRankedWorkerProfiles(
  limit: number = 20,
  offset: number = 0,
  criteria?: RankingCriteria
): Promise<RankedWorkerProfile[]> {
  return currentProvider.getRankedProfiles(limit, offset, criteria);
}

export async function recordProfileView(
  workerProfileId: string,
  viewerUserId?: string,
  viewerIpHash?: string
): Promise<void> {
  await db.insert(profileViews).values({
    workerProfileId,
    viewerUserId: viewerUserId ?? null,
    viewerIpHash: viewerIpHash ?? null,
    viewedAt: new Date(),
  });
}

export { ViewBasedRankingProvider, CompositeRankingProvider };
export type {
  V11RankingCriteria,
  ScoreComponents,
} from "@/lib/helpers/ranking";
export {
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_V11_CRITERIA,
  calculateCompositeScore,
} from "@/lib/helpers/ranking";
