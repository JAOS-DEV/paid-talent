import type {
  HireConfirmationRequestedStatus,
  PhotoModerationStatus,
  VerificationStatus,
  WorkerProfile,
} from "@/lib/db/schema";
import { MAX_PROFILE_PHOTOS } from "@/lib/moderation/photo-policy";

export const PROFILE_VIEW_WINDOW_DAYS = 30;
export const DASHBOARD_RECENT_INTEREST_LIMIT = 5;

export interface WorkerDashboardViewStats {
  windowDays: typeof PROFILE_VIEW_WINDOW_DAYS;
  viewEventsLast30Days: number;
  uniqueRecruiterViewersLast30Days: number;
}

export interface WorkerDashboardPhotoSlots {
  approvedCount: number;
  pendingCount: number;
  slotCount: number;
  maxSlots: typeof MAX_PROFILE_PHOTOS;
  remainingSlots: number;
  canAddGalleryPhoto: boolean;
}

export interface WorkerDashboardRecentInterest {
  id: string;
  venueName: string;
  openingContext: string | null;
  message: string | null;
  createdAt: string;
}

export interface WorkerDashboardPendingConfirmation {
  id: string;
  requestedStatus: HireConfirmationRequestedStatus;
  requestedAt: string;
  venueName: string;
  openingContext: string | null;
}

export interface WorkerDashboardStats {
  profileViewsLast30Days: number;
  profileViewEventsLast30Days: number;
  uniqueRecruiterViewersLast30Days: number;
  interestReceivedCount: number;
}

export interface WorkerDashboardData {
  profile: WorkerProfile | null;
  stats: WorkerDashboardStats;
  recentInterests: WorkerDashboardRecentInterest[];
  interestReceivedCount: number;
  pendingConfirmations: WorkerDashboardPendingConfirmation[];
  photoSlots: WorkerDashboardPhotoSlots;
  verificationStatus: VerificationStatus;
  isPublished: boolean;
}

export interface WorkerOwnedPhoto {
  id: string;
  photoUrl: string | null;
  moderationStatus: PhotoModerationStatus;
  moderationReason: string | null;
  displayOrder: number;
  isCurrentApproved: boolean;
  createdAt: string;
}

export function emptyPhotoSlots(
  canAddGalleryPhoto = false
): WorkerDashboardPhotoSlots {
  return {
    approvedCount: 0,
    pendingCount: 0,
    slotCount: 0,
    maxSlots: MAX_PROFILE_PHOTOS,
    remainingSlots: MAX_PROFILE_PHOTOS,
    canAddGalleryPhoto,
  };
}

export function emptyDashboardStats(): WorkerDashboardStats {
  return {
    profileViewsLast30Days: 0,
    profileViewEventsLast30Days: 0,
    uniqueRecruiterViewersLast30Days: 0,
    interestReceivedCount: 0,
  };
}

export function profileViewWindowStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setDate(start.getDate() - PROFILE_VIEW_WINDOW_DAYS);
  return start;
}

export function toSlotCount(approvedCount: number, pendingCount: number): number {
  return Math.max(0, approvedCount) + Math.max(0, pendingCount);
}
