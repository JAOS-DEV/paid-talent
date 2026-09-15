import { z } from "zod";
import { availabilityMatchesFilter } from "@/lib/profile/availability";

export const searchParamsSchema = z.object({
  query: z.string().optional(),
  role: z.string().optional(),
  area: z.string().optional(),
  availability: z.string().optional(),
  verified: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export interface SearchValidationResult {
  success: boolean;
  data?: SearchParams;
  errors?: z.ZodIssue[];
}

export function validateSearchParams(input: unknown): SearchValidationResult {
  const result = searchParamsSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error.issues };
}

export interface SearchFilterCriteria {
  query?: string;
  role?: string;
  area?: string;
  availability?: string;
  verifiedOnly: boolean;
}

export function buildFilterCriteria(params: SearchParams): SearchFilterCriteria {
  return {
    query: params.query || undefined,
    role: params.role || undefined,
    area: params.area || undefined,
    availability: params.availability || undefined,
    verifiedOnly: params.verified === "true",
  };
}

export interface WorkerProfile {
  displayName: string;
  description: string | null;
  jobRoles: string[];
  area: string | null;
  availability: string[] | null;
  isVerified: boolean;
}

/**
 * Pure function to check if a worker profile matches search criteria.
 * Used for client-side filtering or testing filter logic.
 */
export function matchesSearchCriteria(
  profile: WorkerProfile,
  criteria: SearchFilterCriteria
): boolean {
  if (criteria.verifiedOnly && !profile.isVerified) {
    return false;
  }

  if (criteria.query) {
    const queryLower = criteria.query.toLowerCase();
    const nameMatch = profile.displayName.toLowerCase().includes(queryLower);
    const descMatch = profile.description?.toLowerCase().includes(queryLower) ?? false;
    if (!nameMatch && !descMatch) {
      return false;
    }
  }

  if (criteria.role) {
    const roleMatch = profile.jobRoles.some(
      (r) => r.toLowerCase() === criteria.role!.toLowerCase()
    );
    if (!roleMatch) {
      return false;
    }
  }

  if (criteria.area) {
    const areaMatch = profile.area?.toLowerCase().includes(criteria.area.toLowerCase()) ?? false;
    if (!areaMatch) {
      return false;
    }
  }

  if (criteria.availability) {
    if (!availabilityMatchesFilter(profile.availability, criteria.availability)) {
      return false;
    }
  }

  return true;
}

/**
 * Normalize and sanitize search query input.
 */
export function normalizeSearchQuery(query: string | undefined | null): string | undefined {
  if (!query) {
    return undefined;
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.slice(0, 100);
}

/**
 * Check if pagination parameters are valid.
 */
export function isValidPagination(limit: number, offset: number): boolean {
  return limit >= 1 && limit <= 100 && offset >= 0;
}
