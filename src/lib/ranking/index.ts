import { db, workerProfiles, profileViews } from "@/lib/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

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

let currentProvider: RankingProvider = new ViewBasedRankingProvider();

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

export { ViewBasedRankingProvider };
