import { and, countDistinct, eq, gte, sql } from "drizzle-orm";
import { db, workerProfiles, profileViews, profileInterests } from "@/lib/db";
import type { WorkerProfile } from "@/lib/db/schema";
import { getProfileCompleteness } from "@/lib/profile";
import {
  calculateCompositeScore,
  isCompositeTopTalentScore,
  mergeV11Criteria,
  type V11RankingCriteria,
} from "@/lib/helpers/ranking";

export function countTopTalentFromPublishedProfiles(
  profiles: WorkerProfile[],
  uniqueViewsByProfileId: Map<string, number>,
  interestCountByProfileId: Map<string, number>,
  now: Date,
  criteria?: V11RankingCriteria
): number {
  let topTalentCount = 0;

  for (const profile of profiles) {
    const completeness = getProfileCompleteness(profile);
    const components = calculateCompositeScore(
      completeness.progress,
      uniqueViewsByProfileId.get(profile.id) ?? 0,
      interestCountByProfileId.get(profile.id) ?? 0,
      profile.updatedAt,
      criteria,
      now
    );
    if (isCompositeTopTalentScore(components.totalScore, criteria)) {
      topTalentCount += 1;
    }
  }

  return topTalentCount;
}

export async function countPublishedTopTalent(
  now: Date = new Date(),
  criteria?: V11RankingCriteria
): Promise<number> {
  const merged = mergeV11Criteria(criteria);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - merged.timeWindowDays);

  const [profiles, viewRows, interestRows] = await Promise.all([
    db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.isPublished, true)),
    db
      .select({
        workerProfileId: profileViews.workerProfileId,
        uniqueViewCount: countDistinct(profileViews.viewerUserId),
      })
      .from(profileViews)
      .innerJoin(
        workerProfiles,
        eq(profileViews.workerProfileId, workerProfiles.id)
      )
      .where(
        and(
          eq(workerProfiles.isPublished, true),
          gte(profileViews.viewedAt, startDate),
          sql`${profileViews.viewerUserId} IS NOT NULL`
        )
      )
      .groupBy(profileViews.workerProfileId),
    db
      .select({
        workerProfileId: profileInterests.workerProfileId,
        interestCount: sql<number>`count(*)::int`,
      })
      .from(profileInterests)
      .innerJoin(
        workerProfiles,
        eq(profileInterests.workerProfileId, workerProfiles.id)
      )
      .where(eq(workerProfiles.isPublished, true))
      .groupBy(profileInterests.workerProfileId),
  ]);

  const uniqueViewsByProfileId = new Map(
    viewRows.map((row) => [row.workerProfileId, Number(row.uniqueViewCount)])
  );
  const interestCountByProfileId = new Map(
    interestRows.map((row) => [row.workerProfileId, Number(row.interestCount)])
  );

  return countTopTalentFromPublishedProfiles(
    profiles,
    uniqueViewsByProfileId,
    interestCountByProfileId,
    now,
    criteria
  );
}
