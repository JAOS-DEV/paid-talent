"use client";

import React, { useEffect, useRef, useState } from "react";
import { PROFILE_PHOTO_ACCEPT, type ProfilePhotoUploadStage } from "@/lib/media/profile-photo";
import {
  clearVenueLogo,
  uploadVenueLogo,
  venueLogoFailureMessage,
} from "@/lib/media/upload-venue-logo";
import { VENUE_LOGO_STATUS } from "@/lib/media/venue-logo";

export interface VenueLogoChange {
  logoKey: string | null;
  logoUrl: string | null;
}

interface VenueLogoPickerProps {
  logoUrl: string | null;
  onChange: (next: VenueLogoChange) => void;
}

function PlusIcon(): React.ReactElement {
  return (
    <svg
      className="h-8 w-8 text-charcoal-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

export function VenueLogoPicker({
  logoUrl,
  onChange,
}: VenueLogoPickerProps): React.ReactElement {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [stage, setStage] = useState<ProfilePhotoUploadStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const uploadingRef = useRef(false);
  const localPreviewRef = useRef<string | null>(null);

  const busy = uploading || removing;
  const displayUrl = localPreview ?? logoUrl;
  const controlLabel = displayUrl ? "Change logo" : "Add logo";
  const statusText = stage ? VENUE_LOGO_STATUS[stage] : null;

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
    };
  }, []);

  function replaceLocalPreview(file: File): void {
    if (typeof URL.createObjectURL !== "function") return;
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
    }
    const url = URL.createObjectURL(file);
    localPreviewRef.current = url;
    setLocalPreview(url);
  }

  function clearLocalPreview(): void {
    if (localPreviewRef.current && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(localPreviewRef.current);
    }
    localPreviewRef.current = null;
    setLocalPreview(null);
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploadingRef.current) return;

    uploadingRef.current = true;
    setUploading(true);
    setError(null);
    setStage("preparing");
    replaceLocalPreview(file);

    try {
      const uploaded = await uploadVenueLogo(file, { onStage: setStage });
      clearLocalPreview();
      onChange(uploaded);
    } catch (uploadError) {
      clearLocalPreview();
      setError(venueLogoFailureMessage(uploadError));
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      setStage(null);
    }
  }

  async function handleRemove(): Promise<void> {
    if (busy) return;
    setRemoving(true);
    setError(null);
    try {
      await clearVenueLogo();
      clearLocalPreview();
      onChange({ logoKey: null, logoUrl: null });
    } catch (removeError) {
      setError(venueLogoFailureMessage(removeError));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <label
        htmlFor="venue-logo-input"
        className={`flex cursor-pointer flex-col items-center gap-2 ${
          busy ? "cursor-wait" : ""
        }`}
      >
        <span
          className={`relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-charcoal-600 bg-charcoal-800 ${
            busy ? "opacity-80" : ""
          }`}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- CDN/R2 URLs are not next/image remotePatterns
            <img
              src={displayUrl}
              alt="Venue logo preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <PlusIcon />
          )}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-charcoal-950/70">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </span>
          ) : null}
        </span>
        <span className="text-xs text-charcoal-500">{controlLabel}</span>
      </label>
      <input
        id="venue-logo-input"
        type="file"
        accept={PROFILE_PHOTO_ACCEPT}
        className="sr-only"
        disabled={busy}
        aria-label={controlLabel}
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />
      {statusText ? (
        <p className="text-xs text-charcoal-400" role="status">
          {statusText}
        </p>
      ) : null}
      {displayUrl ? (
        <button
          type="button"
          className="min-h-11 px-2 text-sm text-charcoal-400 hover:text-charcoal-200 disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            void handleRemove();
          }}
        >
          Remove logo
        </button>
      ) : null}
      {error ? (
        <p className="max-w-[12rem] text-center text-xs text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
