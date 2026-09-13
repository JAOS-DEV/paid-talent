import { isSearchableWorker } from "@/lib/verification";
import type { WorkerProfile } from "@/lib/db/schema";

export interface SearchableWorkerProfile extends WorkerProfile {
  isSearchable: true;
}

export interface WorkerSearchFilters {
  query?: string;
  area?: string;
  jobRole?: string;
  availability?: string;
  verifiedOnly?: boolean;
}

export function filterSearchableWorkers<
  T extends Pick<WorkerProfile, "verificationStatus" | "isPublished">,
>(profiles: T[]): T[] {
  return profiles.filter((profile) => {
    const result = isSearchableWorker(profile);
    return result.isSearchable;
  });
}

export function applyWorkerSearchFilters<T extends WorkerProfile>(
  profiles: T[],
  filters: WorkerSearchFilters
): T[] {
  return profiles.filter((profile) => {
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const matchesQuery =
        profile.displayName?.toLowerCase().includes(q) ||
        profile.bio?.toLowerCase().includes(q) ||
        profile.description?.toLowerCase().includes(q) ||
        (profile.jobRoles as string[] | null)?.some((role) =>
          role.toLowerCase().includes(q)
        );
      if (!matchesQuery) return false;
    }

    if (filters.area && profile.area !== filters.area) {
      return false;
    }

    if (filters.jobRole) {
      const roles = profile.jobRoles as string[] | null;
      if (!roles?.includes(filters.jobRole)) {
        return false;
      }
    }

    if (filters.availability && profile.availability !== filters.availability) {
      return false;
    }

    return true;
  });
}

export function getSearchableWorkersWithFilters<T extends WorkerProfile>(
  profiles: T[],
  filters: WorkerSearchFilters
): T[] {
  const searchable = filterSearchableWorkers(profiles);
  return applyWorkerSearchFilters(searchable, filters);
}

export type { WorkerProfile } from "@/lib/db/schema";
