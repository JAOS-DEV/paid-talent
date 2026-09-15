"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import {
  updateProfilePhoto,
  updateProfileBasicInfo,
  updateProfileWorkDetails,
  updateProfileContact,
} from "@/app/worker/actions";
import {
  LANGUAGE_OPTIONS,
  getProfileCompleteness,
  INCOMPLETE_PROFILE_REDIRECT_THRESHOLD,
} from "@/lib/profile";
import {
  splitStoredJobRoles,
  toPersistedJobRoles,
} from "@/lib/profile/job-roles";
import { normalizeAvailability } from "@/lib/profile/availability";
import {
  AREA_MAX_LENGTH,
  BIO_MAX_LENGTH,
  DEFAULT_WORKER_PAY_CURRENCY,
  DISPLAY_NAME_MAX_LENGTH,
  EXPERIENCE_DESCRIPTION_MAX_LENGTH,
  LINE_ID_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  PHONE_NUMBER_MAX_LENGTH,
  WHATSAPP_MAX_LENGTH,
  workerPayCurrencyOptions,
} from "@/lib/profile/limits";
import {
  parseProfileBio,
  parseProfileContact,
  parseProfileExperience,
  parseProfileLocation,
  parseProfileName,
  parseProfileRoles,
} from "@/lib/profile/worker-profile-input";
import { AvailabilityPicker } from "@/components/profile/AvailabilityPicker";
import { CharacterCount } from "@/components/profile/CharacterCount";
import { JobRolesPicker } from "@/components/profile/JobRolesPicker";
import { VerificationStatusBanner } from "@/components/verification";
import type { WorkerProfile } from "@/lib/db/schema";
import {
  PROFILE_PHOTO_ACCEPT,
  PROFILE_PHOTO_ERRORS,
  PROFILE_PHOTO_STATUS,
  type ProfilePhotoUploadStage,
} from "@/lib/media/profile-photo";
import {
  isApprovedPublicPhotoUpload,
  uploadProfilePhoto,
} from "@/lib/media/upload-profile-photo";
import { ProfilePhotoPreview } from "@/components/media/ProfilePhotoPreview";
import { PHOTO_POLICY_COPY } from "@/lib/moderation/photo-policy";
import { ProfilePhotoGalleryManager } from "@/components/media/ProfilePhotoGalleryManager";

export default function WorkerProfilePage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [hasSubmittedPhoto, setHasSubmittedPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [basicError, setBasicError] = useState<string | null>(null);
  const [workError, setWorkError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [predefinedRoles, setPredefinedRoles] = useState<string[]>([]);
  const [otherRoleSelected, setOtherRoleSelected] = useState(false);
  const [customJobRole, setCustomJobRole] = useState("");
  const [experience, setExperience] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_WORKER_PAY_CURRENCY);
  const [lineId, setLineId] = useState("");
  const [whatsApp, setWhatsApp] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoStage, setPhotoStage] = useState<ProfilePhotoUploadStage | null>(
    null
  );
  const [photoPreviewFailed, setPhotoPreviewFailed] = useState(false);
  const [photoPendingReview, setPhotoPendingReview] = useState(false);
  const photoUploadingRef = useRef(false);
  const localPhotoPreviewUrlRef = useRef<string | null>(null);
  const workerUserId = session?.user?.id;
  const workerRole = session?.user?.role;

  useEffect(() => {
    async function fetchProfile(): Promise<void> {
      try {
        const res = await fetch("/api/worker/profile");
        if (res.ok) {
          const data = await res.json();
          const p = data.profile as WorkerProfile | null;
          if (p) {
            setProfile(p);
            setHasSubmittedPhoto(
              Boolean(data.photoOnboarding?.hasSubmittedPhoto) ||
                Boolean(p.photoUrl)
            );
            setPhotoPendingReview(
              Boolean(data.photoOnboarding?.hasSubmittedPhoto) && !p.photoUrl
            );
            if (!p.photoUrl && data.photoOnboarding?.pendingPreviewUrl) {
              setPhotoUrl(data.photoOnboarding.pendingPreviewUrl);
            }
            setDisplayName(p.displayName || "");
            setLocation(p.location || "");
            setArea(p.area || "");
            setBio(p.bio || "");
            const splitRoles = splitStoredJobRoles((p.jobRoles as string[]) || []);
            setPredefinedRoles(splitRoles.predefined);
            setOtherRoleSelected(splitRoles.otherSelected);
            setCustomJobRole(splitRoles.customRole);
            setExperience(p.experience || "");
            setExperienceYears(p.experienceYears?.toString() || "");
            setLanguages((p.languages as string[]) || []);
            setAvailability(normalizeAvailability(p.availability));
            setPayMin(p.expectedPayMin?.toString() || "");
            setPayMax(p.expectedPayMax?.toString() || "");
            setCurrency(p.payCurrency || DEFAULT_WORKER_PAY_CURRENCY);
            setLineId(p.lineId || "");
            setWhatsApp(p.whatsappNumber || "");
            setPhone(p.phoneNumber || "");
            setPhotoUrl(
              p.photoUrl ?? data.photoOnboarding?.pendingPreviewUrl ?? null
            );
            setPhotoPreviewFailed(false);

            const completeness = getProfileCompleteness({
              ...p,
              hasSubmittedPhoto:
                Boolean(data.photoOnboarding?.hasSubmittedPhoto) ||
                Boolean(p.photoUrl),
            });
            if (
              !completeness.isComplete &&
              completeness.progress < INCOMPLETE_PROFILE_REDIRECT_THRESHOLD
            ) {
              router.replace("/worker/onboarding");
            }
          } else {
            router.replace("/worker/onboarding");
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!workerUserId) {
      return;
    }

    if (workerRole !== "worker") {
      router.replace("/auth/signin");
      return;
    }

    fetchProfile();
  }, [workerUserId, workerRole, router]);

  useEffect(() => {
    return () => {
      if (
        localPhotoPreviewUrlRef.current &&
        typeof URL.revokeObjectURL === "function"
      ) {
        URL.revokeObjectURL(localPhotoPreviewUrlRef.current);
      }
    };
  }, []);

  function showSuccess(message: string): void {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  function handlePhotoPreviewError(): void {
    setPhotoPreviewFailed(true);
  }

  function handleChoosePhoto(): void {
    if (photoUploadingRef.current) return;
    fileInputRef.current?.click();
  }

  function replaceLocalPhotoPreview(file: File): string | null {
    if (typeof URL.createObjectURL !== "function") {
      return null;
    }
    if (localPhotoPreviewUrlRef.current) {
      URL.revokeObjectURL(localPhotoPreviewUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    localPhotoPreviewUrlRef.current = url;
    return url;
  }

  function clearLocalPhotoPreview(): void {
    if (
      localPhotoPreviewUrlRef.current &&
      typeof URL.revokeObjectURL === "function"
    ) {
      URL.revokeObjectURL(localPhotoPreviewUrlRef.current);
      localPhotoPreviewUrlRef.current = null;
    }
  }

  async function handlePhotoUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || photoUploadingRef.current) return;

    photoUploadingRef.current = true;
    setSaving("photo");
    setPhotoError(null);
    setPhotoPreviewFailed(false);
    setPhotoStage("preparing");

    try {
      const result = await uploadProfilePhoto(file, {
        onStage: setPhotoStage,
      });
      setPhotoStage("saving");

      if (result.status === "rejected") {
        clearLocalPhotoPreview();
        setPhotoPendingReview(false);
        setPhotoUrl(profile?.photoUrl ?? null);
        setPhotoError(result.message || PHOTO_POLICY_COPY.rejected);
        return;
      }

      if (isApprovedPublicPhotoUpload(result)) {
        const persist = await updateProfilePhoto({
          photoKey: result.photoKey,
          photoUrl: result.publicUrl,
        });
        if (!persist.success) {
          throw new Error(persist.error || PROFILE_PHOTO_ERRORS.uploadFailed);
        }
        clearLocalPhotoPreview();
        setPhotoPendingReview(false);
        setPhotoUrl(result.publicUrl);
        showSuccess("Photo updated");
        return;
      }

      setPhotoPendingReview(true);
      const localPreview = replaceLocalPhotoPreview(file);
      if (localPreview) {
        setPhotoUrl(localPreview);
      }
      showSuccess("Photo submitted for review");
    } catch (error) {
      setPhotoError(
        error instanceof Error
          ? error.message
          : PROFILE_PHOTO_ERRORS.uploadFailed
      );
    } finally {
      photoUploadingRef.current = false;
      setSaving(null);
      setPhotoStage(null);
    }
  }

  async function handleSaveBasicInfo(): Promise<void> {
    setSaving("basic");
    setBasicError(null);
    try {
      const nameResult = parseProfileName({ displayName });
      if (!nameResult.ok) {
        setBasicError(nameResult.error);
        return;
      }

      const locationResult = parseProfileLocation({
        location,
        area: area || undefined,
        availability,
        expectedPayMin: payMin ? parseInt(payMin, 10) : undefined,
        expectedPayMax: payMax ? parseInt(payMax, 10) : undefined,
        payCurrency: currency,
      });
      if (!locationResult.ok) {
        setBasicError(locationResult.error);
        return;
      }

      const saved = await updateProfileBasicInfo({
        displayName: nameResult.data.displayName,
        location: locationResult.data.location,
        area: locationResult.data.area || undefined,
        availability: locationResult.data.availability,
        expectedPayMin: locationResult.data.expectedPayMin ?? undefined,
        expectedPayMax: locationResult.data.expectedPayMax ?? undefined,
        payCurrency: locationResult.data.payCurrency,
      });
      if (!saved.success) {
        setBasicError(saved.error || "Failed to save basic info");
        return;
      }
      showSuccess("Basic info saved");
    } catch (error) {
      setBasicError(
        error instanceof Error ? error.message : "Failed to save basic info"
      );
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveWorkDetails(): Promise<void> {
    setSaving("work");
    setWorkError(null);
    try {
      if (otherRoleSelected && !customJobRole.trim()) {
        setWorkError("Enter a custom role when Other is selected");
        return;
      }

      const rolesResult = parseProfileRoles({
        jobRoles: toPersistedJobRoles(
          predefinedRoles,
          otherRoleSelected,
          customJobRole
        ),
        customJobRole: otherRoleSelected ? customJobRole.trim() : undefined,
      });
      if (!rolesResult.ok) {
        setWorkError(rolesResult.error);
        return;
      }

      const experienceResult = parseProfileExperience({
        experience: experience || undefined,
        experienceYears: experienceYears
          ? parseInt(experienceYears, 10)
          : undefined,
      });
      if (!experienceResult.ok) {
        setWorkError(experienceResult.error);
        return;
      }

      const bioResult = parseProfileBio({ bio });
      if (!bioResult.ok) {
        setWorkError(bioResult.error);
        return;
      }

      const saved = await updateProfileWorkDetails({
        jobRoles: rolesResult.data.jobRoles,
        customJobRole: otherRoleSelected ? customJobRole.trim() : undefined,
        experience: experienceResult.data.experience || undefined,
        experienceYears: experienceResult.data.experienceYears ?? undefined,
        languages,
        bio: bioResult.data.bio,
      });
      if (!saved.success) {
        setWorkError(saved.error || "Failed to save work details");
        return;
      }
      showSuccess("Work details saved");
    } catch (error) {
      setWorkError(
        error instanceof Error ? error.message : "Failed to save work details"
      );
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveContact(): Promise<void> {
    setSaving("contact");
    setContactError(null);
    try {
      const parsed = parseProfileContact({
        lineId: lineId || undefined,
        whatsappNumber: whatsApp || undefined,
        phoneNumber: phone || undefined,
      });
      if (!parsed.ok) {
        setContactError(parsed.error);
        return;
      }

      const result = await updateProfileContact({
        lineId: parsed.data.lineId || undefined,
        whatsappNumber: parsed.data.whatsappNumber || undefined,
        phoneNumber: parsed.data.phoneNumber || undefined,
      });
      if (!result.success) {
        setContactError(result.error || "Failed to save contact info");
        return;
      }
      showSuccess("Contact info saved");
    } catch (error) {
      setContactError(
        error instanceof Error ? error.message : "Failed to save contact info"
      );
    } finally {
      setSaving(null);
    }
  }

  function toggleLanguage(lang: string): void {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  }

  if (status === "loading" || loading || !session || session.user.role !== "worker") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const completeness = getProfileCompleteness(
    profile ? { ...profile, hasSubmittedPhoto } : null
  );
  const verificationStatus = profile?.verificationStatus || "unverified";
  const isPublished = profile?.isPublished || false;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {successMessage && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-success text-white px-4 py-2 rounded-lg shadow-lg z-50">
              {successMessage}
            </div>
          )}

          <div className="mb-6">
            <VerificationStatusBanner
              status={verificationStatus}
              isPublished={isPublished}
              hasApprovedPrimaryPhoto={Boolean(
                profile?.photoKey && profile?.photoUrl
              )}
              userId={session.user.id}
            />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-charcoal-100">
              Edit Profile
            </h1>
            <p className="text-charcoal-400 mt-1">
              Keep your profile updated to attract more recruiters
            </p>

            {!completeness.isComplete && (
              <div className="mt-4 bg-charcoal-800 border border-charcoal-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-charcoal-300">
                    Profile completion
                  </span>
                  <span className="text-sm text-primary-400">
                    {completeness.progress}%
                  </span>
                </div>
                <div className="w-full bg-charcoal-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{ width: `${completeness.progress}%` }}
                  />
                </div>
                <button
                  onClick={() => router.push("/worker/onboarding")}
                  className="text-primary-400 text-sm mt-2 hover:text-primary-300"
                >
                  Complete your profile →
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Primary photo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-6">
                  <ProfilePhotoPreview
                    photoUrl={photoUrl}
                    uploading={saving === "photo"}
                    previewFailed={photoPreviewFailed}
                    onPreviewError={handlePhotoPreviewError}
                    sizeClassName="w-24 h-24"
                  />
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={PROFILE_PHOTO_ACCEPT}
                      className="hidden"
                      disabled={saving === "photo"}
                      onChange={handlePhotoUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="upload-primary-photo"
                      onClick={handleChoosePhoto}
                      disabled={saving === "photo"}
                    >
                      {photoUrl || photoPendingReview ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {photoStage ? (
                      <p
                        className="text-charcoal-300 text-sm mt-2"
                        aria-live="polite"
                      >
                        {PROFILE_PHOTO_STATUS[photoStage]}
                      </p>
                    ) : null}
                    {photoPendingReview && saving !== "photo" ? (
                      <p className="text-charcoal-300 text-sm mt-2">
                        {PHOTO_POLICY_COPY.pending}
                      </p>
                    ) : null}
                    <p className="text-charcoal-500 text-xs mt-2">
                      JPG, PNG or WebP. Max 10MB.
                    </p>
                    <p className="text-charcoal-500 text-xs mt-1">
                      {PHOTO_POLICY_COPY.rules}
                    </p>
                    {photoPreviewFailed && photoUrl ? (
                      <p className="text-charcoal-300 text-sm mt-2">
                        {PROFILE_PHOTO_ERRORS.previewFailed}
                      </p>
                    ) : null}
                    {photoError ? (
                      <p className="text-error text-sm mt-2">{photoError}</p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Profile Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfilePhotoGalleryManager
                  isVerified={
                    verificationStatus === "verified" ||
                    Boolean(profile?.isVerified)
                  }
                  hasApprovedPrimaryPhoto={Boolean(
                    profile?.photoKey && profile?.photoUrl
                  )}
                />
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Display Name"
                  placeholder="How you want to be called"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setBasicError(null);
                  }}
                  maxLength={DISPLAY_NAME_MAX_LENGTH}
                />
                <Input
                  label="Location"
                  placeholder="City, Country"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setBasicError(null);
                  }}
                  maxLength={LOCATION_MAX_LENGTH}
                />
                <Input
                  label="Area"
                  placeholder="Your primary work area"
                  value={area}
                  onChange={(e) => {
                    setArea(e.target.value);
                    setBasicError(null);
                  }}
                  maxLength={AREA_MAX_LENGTH}
                />

                <AvailabilityPicker
                  value={availability}
                  onChange={(next) => {
                    setAvailability(next);
                    setBasicError(null);
                  }}
                />

                <div>
                  <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                    Expected Pay
                  </label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="px-3 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {workerPayCurrencyOptions(currency).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={payMin}
                      onChange={(e) => setPayMin(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-charcoal-500">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={payMax}
                      onChange={(e) => setPayMax(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {basicError ? (
                  <p className="text-error text-sm">{basicError}</p>
                ) : null}

                <div className="pt-2">
                  <Button
                    onClick={handleSaveBasicInfo}
                    loading={saving === "basic"}
                  >
                    Save Basic Info
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Work Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                    Job Roles
                  </label>
                  <JobRolesPicker
                    predefined={predefinedRoles}
                    otherSelected={otherRoleSelected}
                    customRole={customJobRole}
                    onPredefinedChange={(roles) => {
                      setPredefinedRoles(roles);
                      setWorkError(null);
                    }}
                    onOtherSelectedChange={(selected) => {
                      setOtherRoleSelected(selected);
                      setWorkError(null);
                    }}
                    onCustomRoleChange={(value) => {
                      setCustomJobRole(value);
                      setWorkError(null);
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Years of Experience"
                    type="number"
                    placeholder="e.g., 3"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                    Experience Description
                  </label>
                  <textarea
                    className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 placeholder:text-charcoal-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[80px]"
                    placeholder="Brief description of your work history..."
                    value={experience}
                    maxLength={EXPERIENCE_DESCRIPTION_MAX_LENGTH}
                    onChange={(e) => {
                      setExperience(e.target.value);
                      setWorkError(null);
                    }}
                  />
                  <div className="flex justify-end mt-1">
                    <CharacterCount
                      current={experience.length}
                      max={EXPERIENCE_DESCRIPTION_MAX_LENGTH}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                    Languages
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                          ${
                            languages.includes(lang)
                              ? "bg-primary-600 text-white"
                              : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                          }
                        `}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                    Bio
                  </label>
                  <textarea
                    className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 placeholder:text-charcoal-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[100px]"
                    placeholder="Tell recruiters about yourself..."
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      setWorkError(null);
                    }}
                    maxLength={BIO_MAX_LENGTH}
                  />
                  <div className="flex justify-end mt-1">
                    <CharacterCount current={bio.length} max={BIO_MAX_LENGTH} />
                  </div>
                </div>

                {workError ? (
                  <p className="text-error text-sm">{workError}</p>
                ) : null}

                <div className="pt-2">
                  <Button
                    onClick={handleSaveWorkDetails}
                    loading={saving === "work"}
                  >
                    Save Work Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-charcoal-400 text-sm mb-4">
                  Contact details are only visible to recruiters with Top Talent
                  access. All fields are optional.
                </p>
                <Input
                  label="LINE ID"
                  placeholder="Your LINE ID (optional)"
                  value={lineId}
                  maxLength={LINE_ID_MAX_LENGTH}
                  onChange={(e) => {
                    setLineId(e.target.value);
                    setContactError(null);
                  }}
                />
                <Input
                  label="WhatsApp"
                  placeholder="Your WhatsApp number (optional)"
                  value={whatsApp}
                  maxLength={WHATSAPP_MAX_LENGTH}
                  onChange={(e) => {
                    setWhatsApp(e.target.value);
                    setContactError(null);
                  }}
                />
                <Input
                  label="Phone"
                  placeholder="Your phone number (optional)"
                  value={phone}
                  maxLength={PHONE_NUMBER_MAX_LENGTH}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setContactError(null);
                  }}
                />
                {contactError ? (
                  <p className="text-error text-sm">{contactError}</p>
                ) : null}
                <div className="pt-2">
                  <Button
                    onClick={handleSaveContact}
                    loading={saving === "contact"}
                  >
                    Save Contact Info
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
