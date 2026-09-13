"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { Button, Badge } from "@/components/ui";
import type { VerificationStatus, DocType } from "@/lib/db/schema";

interface ChallengeCode {
  code: string;
  displayCode: string;
  issuedAt: string;
  expiresAt: string;
  isExpired?: boolean;
}

type VerificationStep =
  | "intro"
  | "camera"
  | "recording"
  | "review"
  | "pending"
  | "verified"
  | "rejected";

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: "passport", label: "Passport" },
  { value: "thai_id", label: "Thai National ID" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "other", label: "Other Government ID" },
];

function CameraFrameWithCode({
  challengeCode,
}: {
  challengeCode?: string | null;
}): React.ReactElement {
  const displayCode = challengeCode
    ? challengeCode.slice(0, 4).toUpperCase()
    : null;

  return (
    <div className="relative w-full aspect-[3/4] max-w-[280px] mx-auto bg-charcoal-900 rounded-2xl overflow-hidden border-2 border-charcoal-700">
      {displayCode && (
        <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
          <div className="bg-charcoal-950/95 border border-primary-500 rounded-lg px-5 py-3 shadow-lg">
            <p className="text-charcoal-400 text-[10px] text-center uppercase tracking-wider mb-1">
              Say this code
            </p>
            <p className="text-3xl font-mono font-bold text-primary-400 tracking-[0.3em] text-center">
              {displayCode}
            </p>
          </div>
        </div>
      )}

      <svg
        viewBox="0 0 200 267"
        className="absolute inset-0 w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse
          cx="100"
          cy="100"
          rx="42"
          ry="52"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          className="text-charcoal-600"
        />
        <path
          d="M58 165 Q58 150 100 150 Q142 150 142 165 L142 210 Q142 230 100 230 Q58 230 58 210 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          className="text-charcoal-600"
          fill="none"
        />
        <g transform="translate(138, 85)">
          <rect
            x="0"
            y="0"
            width="48"
            height="65"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="5 3"
            className="text-primary-500/70"
            fill="none"
          />
          <rect
            x="4"
            y="8"
            width="16"
            height="20"
            rx="2"
            className="fill-primary-500/20"
          />
          <line
            x1="24"
            y1="12"
            x2="42"
            y2="12"
            stroke="currentColor"
            strokeWidth="1"
            className="text-primary-500/40"
          />
          <line
            x1="24"
            y1="18"
            x2="38"
            y2="18"
            stroke="currentColor"
            strokeWidth="1"
            className="text-primary-500/40"
          />
          <line
            x1="24"
            y1="24"
            x2="40"
            y2="24"
            stroke="currentColor"
            strokeWidth="1"
            className="text-primary-500/40"
          />
          <text
            x="24"
            y="50"
            className="text-[8px] fill-primary-400/60"
          >
            ID
          </text>
        </g>
      </svg>

      <div className="absolute bottom-3 left-0 right-0 text-center">
        <p className="text-charcoal-500 text-[11px]">
          Hold ID beside your face
        </p>
      </div>
    </div>
  );
}

function ChecklistItem({
  text,
  checked = false,
}: {
  text: string;
  checked?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${checked ? "bg-green-500/20 text-green-400" : "bg-charcoal-700 text-charcoal-500"}`}
      >
        {checked ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-current" />
        )}
      </div>
      <span
        className={`text-sm ${checked ? "text-charcoal-300" : "text-charcoal-400"}`}
      >
        {text}
      </span>
    </div>
  );
}

function WhyWeAskModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-charcoal-950/80"
        onClick={onClose}
      />
      <div className="relative bg-charcoal-900 rounded-xl p-6 max-w-sm w-full border border-charcoal-700">
        <h3 className="text-lg font-semibold text-charcoal-100 mb-3">
          Why we verify identity
        </h3>
        <div className="space-y-3 text-charcoal-400 text-sm">
          <p>
            Identity verification helps us maintain a trusted platform for both
            workers and recruiters.
          </p>
          <p>We verify that:</p>
          <ul className="list-disc list-inside space-y-1 text-charcoal-500">
            <li>You are who you say you are</li>
            <li>You meet our age requirement (18+)</li>
            <li>Your profile represents a real person</li>
          </ul>
          <p className="text-charcoal-500">
            Your ID and video are used only for verification and are securely
            stored with limited retention.
          </p>
        </div>
        <Button fullWidth className="mt-4" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}

export default function WorkerVerificationPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<VerificationStep>("intro");
  const [showWhyModal, setShowWhyModal] = useState(false);

  const [challengeCode, setChallengeCode] = useState<ChallengeCode | null>(
    null
  );
  const [docType, setDocType] = useState<DocType>("passport");
  const [idDocumentKey, setIdDocumentKey] = useState<string | null>(null);
  const [livenessVideoKey, setLivenessVideoKey] = useState<string | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);

  const fetchVerificationStatus = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/worker/verification");
      if (res.ok) {
        const data = await res.json();
        const s = data.verification.verificationStatus as VerificationStatus;
        if (s === "pending") {
          setCurrentStep("pending");
        } else if (s === "verified") {
          setCurrentStep("verified");
        } else if (s === "rejected") {
          setCurrentStep("rejected");
        }
      }
    } catch (err) {
      console.error("Failed to fetch verification status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChallengeCode = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/worker/verification/challenge");
      if (res.ok) {
        const data = await res.json();
        if (data.challenge) {
          setChallengeCode(data.challenge);
        }
      }
    } catch (err) {
      console.error("Failed to fetch challenge code:", err);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.role !== "worker") {
      return;
    }

    let cancelled = false;

    async function loadData(): Promise<void> {
      if (cancelled) return;
      await fetchVerificationStatus();
      if (cancelled) return;
      await fetchChallengeCode();
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [session, fetchVerificationStatus, fetchChallengeCode]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session || session.user.role !== "worker") {
    router.replace("/auth/signin");
    return <div />;
  }

  async function handleStartVerification(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/worker/verification/challenge", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setChallengeCode(data.challenge);
        setCurrentStep("camera");
      } else {
        setError(data.error || "Failed to start verification");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIdUpload(file: File): Promise<void> {
    setError(null);
    setIdUploading(true);
    try {
      const res = await fetch("/api/worker/verification/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "id_document",
          contentType: file.type,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error);
      }

      const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }

      setIdDocumentKey(data.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIdUploading(false);
    }
  }

  async function handleVideoUpload(file: File): Promise<void> {
    setError(null);
    setVideoUploading(true);
    try {
      const res = await fetch("/api/worker/verification/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "liveness_video",
          contentType: file.type,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error);
      }

      const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }

      setLivenessVideoKey(data.key);
      setCurrentStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setVideoUploading(false);
    }
  }

  async function handleSubmitVerification(): Promise<void> {
    if (!idDocumentKey || !livenessVideoKey) {
      setError("Please complete all steps");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/worker/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idDocumentKey,
          livenessVideoKey,
          docType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentStep("pending");
      } else {
        setError(data.error || "Submission failed");
        if (data.details) {
          setError(data.details.join(". "));
        }
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleIdFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) {
      handleIdUpload(file);
    }
  }

  function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) {
      handleVideoUpload(file);
    }
  }

  function renderIntroStep(): React.ReactNode {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            Verify it&apos;s you
          </h1>
          <p className="text-charcoal-400 mt-1.5 text-sm">
            Quick step to confirm your identity.
          </p>
        </div>

        <CameraFrameWithCode challengeCode={challengeCode?.code} />

        <div className="space-y-2.5 px-2">
          <ChecklistItem text="Hold ID beside face" />
          <ChecklistItem text="Keep face and ID in frame" />
          <ChecklistItem text="Read the code clearly" />
        </div>

        <div className="space-y-3 pt-2">
          <select
            className="w-full px-4 py-3 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocType)}
          >
            {DOC_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <Button
            fullWidth
            onClick={handleStartVerification}
            loading={submitting}
          >
            Start video
          </Button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="text-center pt-3 border-t border-charcoal-800">
          <p className="text-charcoal-500 text-xs">
            Used only for age and identity checks · 18+
          </p>
          <button
            onClick={() => setShowWhyModal(true)}
            className="text-primary-400 text-xs mt-1.5 hover:text-primary-300 transition-colors"
          >
            Why we ask
          </button>
        </div>
      </div>
    );
  }

  function renderCameraStep(): React.ReactNode {
    const displayCode = challengeCode
      ? challengeCode.code.slice(0, 4).toUpperCase()
      : "----";

    return (
      <div className="space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            Verify it&apos;s you
          </h1>
          <p className="text-charcoal-400 mt-1.5 text-sm">
            Upload your ID, then record a short video.
          </p>
        </div>

        <CameraFrameWithCode challengeCode={challengeCode?.code} />

        <div className="space-y-2.5 px-2">
          <ChecklistItem text="Hold ID beside face" checked={!!idDocumentKey} />
          <ChecklistItem text="Keep face and ID in frame" checked={!!idDocumentKey} />
          <ChecklistItem text="Read the code clearly" checked={!!livenessVideoKey} />
        </div>

        <div className="space-y-3">
          {!idDocumentKey ? (
            <label className="block">
              <div className="bg-charcoal-800 border border-charcoal-600 rounded-xl p-4 text-center cursor-pointer hover:border-primary-500/50 transition-colors">
                {idUploading ? (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                    <span className="text-charcoal-300 text-sm">Uploading ID...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-charcoal-100 font-medium text-sm">Upload ID photo</p>
                    <p className="text-charcoal-500 text-xs mt-0.5">JPG, PNG or WebP</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleIdFileChange}
                disabled={idUploading}
              />
            </label>
          ) : !livenessVideoKey ? (
            <label className="block">
              <div className="bg-charcoal-800 border border-charcoal-600 rounded-xl p-4 text-center cursor-pointer hover:border-primary-500/50 transition-colors">
                {videoUploading ? (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                    <span className="text-charcoal-300 text-sm">Uploading video...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-charcoal-100 font-medium text-sm">Record video</p>
                    <p className="text-charcoal-500 text-xs mt-0.5">Say code: <span className="text-primary-400 font-mono">{displayCode}</span></p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={handleVideoFileChange}
                disabled={videoUploading}
              />
            </label>
          ) : (
            <Button fullWidth onClick={() => setCurrentStep("review")}>
              Continue
            </Button>
          )}
        </div>

        {idDocumentKey && !livenessVideoKey && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-2.5">
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-300 text-xs">ID uploaded — now record your video</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <Button variant="outline" fullWidth onClick={() => {
          setIdDocumentKey(null);
          setLivenessVideoKey(null);
          setCurrentStep("intro");
        }}>
          Start over
        </Button>

        <div className="text-center pt-3 border-t border-charcoal-800">
          <p className="text-charcoal-500 text-xs">
            Used only for age and identity checks · 18+
          </p>
          <button
            onClick={() => setShowWhyModal(true)}
            className="text-primary-400 text-xs mt-1.5 hover:text-primary-300 transition-colors"
          >
            Why we ask
          </button>
        </div>
      </div>
    );
  }

  function renderReviewStep(): React.ReactNode {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            Ready to submit
          </h1>
          <p className="text-charcoal-400 mt-2">
            Review your submission before sending.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-green-300 text-sm">ID document uploaded</span>
          </div>
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-green-300 text-sm">
              Verification video recorded
            </span>
          </div>
        </div>

        <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
          <p className="text-charcoal-300 text-sm">
            <span className="text-charcoal-400">Document type:</span>{" "}
            {DOC_TYPE_OPTIONS.find((d) => d.value === docType)?.label}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            fullWidth
            onClick={handleSubmitVerification}
            loading={submitting}
          >
            Submit verification
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => setCurrentStep("camera")}
          >
            Back
          </Button>
        </div>

        <div className="text-center pt-2 border-t border-charcoal-800">
          <p className="text-charcoal-500 text-xs">
            Used only for age and identity checks · 18+
          </p>
        </div>
      </div>
    );
  }

  function renderPendingStep(): React.ReactNode {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-charcoal-100">
            Verification pending
          </h1>
          <p className="text-charcoal-400 mt-2">
            We&apos;re reviewing your submission. This usually takes 1-2
            business days.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-charcoal-400">Status</span>
            <Badge variant="warning">Under review</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-charcoal-400">Profile visibility</span>
            <Badge variant="default">Not live</Badge>
          </div>
        </div>

        <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
          <p className="text-charcoal-400 text-sm">
            Once approved, your profile will automatically become visible to
            recruiters. We&apos;ll notify you when the review is complete.
          </p>
        </div>

        <Button
          variant="outline"
          fullWidth
          onClick={() => router.push("/worker/dashboard")}
        >
          Return to dashboard
        </Button>
      </div>
    );
  }

  function renderVerifiedStep(): React.ReactNode {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-charcoal-100">
            You&apos;re verified
          </h1>
          <p className="text-charcoal-400 mt-2">
            Your identity has been confirmed. Your profile is now visible to
            recruiters.
          </p>
        </div>

        <Button fullWidth onClick={() => router.push("/worker/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  function renderRejectedStep(): React.ReactNode {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-charcoal-100">
            Verification unsuccessful
          </h1>
          <p className="text-charcoal-400 mt-2">
            We couldn&apos;t verify your identity. Please try again.
          </p>
        </div>

        <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
          <p className="text-charcoal-300 text-sm font-medium mb-2">
            Common issues:
          </p>
          <ul className="text-charcoal-400 text-sm space-y-1 list-disc list-inside">
            <li>ID photo was unclear or cut off</li>
            <li>Face wasn&apos;t visible in video</li>
            <li>Code wasn&apos;t read clearly</li>
            <li>ID didn&apos;t match the person in video</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            fullWidth
            onClick={handleStartVerification}
            loading={submitting}
          >
            Try again
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => router.push("/worker/dashboard")}
          >
            Return to dashboard
          </Button>
        </div>
      </div>
    );
  }

  function renderCurrentStep(): React.ReactNode {
    switch (currentStep) {
      case "intro":
        return renderIntroStep();
      case "camera":
      case "recording":
        return renderCameraStep();
      case "review":
        return renderReviewStep();
      case "pending":
        return renderPendingStep();
      case "verified":
        return renderVerifiedStep();
      case "rejected":
        return renderRejectedStep();
      default:
        return renderIntroStep();
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-sm mx-auto px-4">{renderCurrentStep()}</div>
      </main>

      <Footer />

      <WhyWeAskModal
        isOpen={showWhyModal}
        onClose={() => setShowWhyModal(false)}
      />
    </div>
  );
}
