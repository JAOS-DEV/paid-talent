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
  updateProfileName,
  updateProfileRoles,
  updateProfileExperience,
  updateProfileLanguages,
  updateProfileBio,
  updateProfileLocation,
  updateProfileContact,
} from "@/app/worker/actions";
import {
  JOB_ROLE_OPTIONS,
  LANGUAGE_OPTIONS,
  AVAILABILITY_OPTIONS,
  getProfileCompleteness,
  INCOMPLETE_PROFILE_REDIRECT_THRESHOLD,
} from "@/lib/profile";
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

export default function WorkerProfilePage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [jobRoles, setJobRoles] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [availability, setAvailability] = useState("");
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [currency, setCurrency] = useState("USD");
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

  useEffect(() => {
    async function fetchProfile(): Promise<void> {
      try {
        const res = await fetch("/api/worker/profile");
        if (res.ok) {
          const data = await res.json();
          const p = data.profile as WorkerProfile | null;
          if (p) {
            setProfile(p);
            setDisplayName(p.displayName || "");
            setLocation(p.location || "");
            setArea(p.area || "");
            setBio(p.bio || "");
            setJobRoles((p.jobRoles as string[]) || []);
            setExperience(p.experience || "");
            setExperienceYears(p.experienceYears?.toString() || "");
            setLanguages((p.languages as string[]) || []);
            setAvailability(p.availability || "");
            setPayMin(p.expectedPayMin?.toString() || "");
            setPayMax(p.expectedPayMax?.toString() || "");
            setCurrency(p.payCurrency || "USD");
            setLineId(p.lineId || "");
            setWhatsApp(p.whatsappNumber || "");
            setPhone(p.phoneNumber || "");
            setPhotoUrl(p.photoUrl);
            setPhotoPreviewFailed(false);

            const completeness = getProfileCompleteness(p);
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

    if (!session?.user?.id) {
      return;
    }

    if (session.user.role !== "worker") {
      router.replace("/auth/signin");
      return;
    }

    fetchProfile();
  }, [session, router]);

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
    try {
      await updateProfileName({ displayName });
      await updateProfileLocation({
        location,
        area: area || undefined,
        availability,
        expectedPayMin: payMin ? parseInt(payMin, 10) : undefined,
        expectedPayMax: payMax ? parseInt(payMax, 10) : undefined,
        payCurrency: currency,
      });
      showSuccess("Basic info saved");
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveWorkDetails(): Promise<void> {
    setSaving("work");
    try {
      await updateProfileRoles({ jobRoles });
      await updateProfileExperience({
        experience: experience || undefined,
        experienceYears: experienceYears
          ? parseInt(experienceYears, 10)
          : undefined,
      });
      await updateProfileLanguages({ languages });
      await updateProfileBio({ bio });
      showSuccess("Work details saved");
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveContact(): Promise<void> {
    setSaving("contact");
    try {
      await updateProfileContact({
        lineId: lineId || undefined,
        whatsappNumber: whatsApp || undefined,
        phoneNumber: phone || undefined,
      });
      showSuccess("Contact info saved");
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(null);
    }
  }

  function toggleRole(role: string): void {
    setJobRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
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

  const completeness = getProfileCompleteness(profile);
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
                <CardTitle>Profile Photo</CardTitle>
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
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Display Name"
                  placeholder="How you want to be called"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <Input
                  label="Location"
                  placeholder="City, Country"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <Input
                  label="Area"
                  placeholder="Your primary work area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />

                <div>
                  <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                    Availability
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABILITY_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAvailability(option)}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                          ${
                            availability === option
                              ? "bg-primary-600 text-white"
                              : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                          }
                        `}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

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
                      <option value="USD">USD</option>
                      <option value="THB">THB</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="JPY">JPY</option>
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
                  <div className="flex flex-wrap gap-2">
                    {JOB_ROLE_OPTIONS.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                          ${
                            jobRoles.includes(role)
                              ? "bg-primary-600 text-white"
                              : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                          }
                        `}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
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
                    onChange={(e) => setExperience(e.target.value)}
                  />
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
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                  />
                  <p className="text-charcoal-500 text-xs mt-1">
                    {bio.length}/500 characters
                  </p>
                </div>

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
                  onChange={(e) => setLineId(e.target.value)}
                />
                <Input
                  label="WhatsApp"
                  placeholder="Your WhatsApp number (optional)"
                  value={whatsApp}
                  onChange={(e) => setWhatsApp(e.target.value)}
                />
                <Input
                  label="Phone"
                  placeholder="Your phone number (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
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
