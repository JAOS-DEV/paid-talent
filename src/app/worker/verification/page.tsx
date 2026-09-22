"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { Button, Badge } from "@/components/ui";
import { LiveLivenessRecorder } from "@/components/verification/LiveLivenessRecorder";
import type { VerificationStatus, DocType } from "@/lib/db/schema";
import {
  LIVE_CAMERA_CONSTRAINTS,
  UNSUPPORTED_LIVE_RECORDING_MESSAGE,
  classifyGetUserMediaError,
  isLiveRecordingApiAvailable,
  messageForLiveRecordingError,
  stopMediaStream,
  type LivenessUploadContentType,
} from "@/lib/verification/liveness-recording";

interface ChallengeCode {
  code: string;
  displayCode: string;
  issuedAt: string;
  expiresAt: string;
  isExpired?: boolean;
}

type VerificationStep =
  | "id"
  | "id_uploaded"
  | "video"
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
  const t = useTranslations("worker.verificationFlow");
  const common = useTranslations("common");
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-charcoal-950/80"
        onClick={onClose}
      />
      <div className="relative bg-charcoal-900 rounded-xl p-6 max-w-sm w-full border border-charcoal-700">
        <h3 className="text-lg font-semibold text-charcoal-100 mb-3">
          {t("whyTitle")}
        </h3>
        <div className="space-y-3 text-charcoal-400 text-sm">
          <p>
            {t("whyBody")}
          </p>
          <p>{t("whyListIntro")}</p>
          <ul className="list-disc list-inside space-y-1 text-charcoal-500">
            <li>{t("whyIdentity")}</li>
            <li>{t("whyAge")}</li>
            <li>{t("whyReal")}</li>
          </ul>
          <p className="text-charcoal-500">{t("whyRetention")}</p>
        </div>
        <Button fullWidth className="mt-4" onClick={onClose}>
          {common("gotIt")}
        </Button>
      </div>
    </div>
  );
}

function StartAgainButton({ onClick }: { onClick: () => void }): React.ReactElement {
  const t = useTranslations("worker.verificationFlow");
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-center text-xs text-charcoal-500 hover:text-charcoal-300 pt-1"
    >
      {t("startAgain")}
    </button>
  );
}

export default function WorkerVerificationPage(): React.ReactElement {
  const t = useTranslations("worker.verificationFlow");
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<VerificationStep>("id");
  const [showWhyModal, setShowWhyModal] = useState(false);

  const [challengeCode, setChallengeCode] = useState<ChallengeCode | null>(
    null
  );
  const [docType, setDocType] = useState<DocType>("passport");
  const [idDocumentKey, setIdDocumentKey] = useState<string | null>(null);
  const [livenessVideoKey, setLivenessVideoKey] = useState<string | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [challengeExpired, setChallengeExpired] = useState(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const releaseCamera = useCallback((): void => {
    stopMediaStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraStream(null);
  }, []);

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
        } else {
          setCurrentStep("id");
        }
      }
    } catch (err) {
      console.error("Failed to fetch verification status:", err);
    } finally {
      setLoading(false);
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
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [session, fetchVerificationStatus]);

  useEffect(() => {
    return () => {
      stopMediaStream(cameraStreamRef.current);
    };
  }, []);

  if (status === "loading" || (session?.user?.role === "worker" && loading)) {
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

  function handleStartAgain(): void {
    releaseCamera();
    setIdDocumentKey(null);
    setLivenessVideoKey(null);
    setChallengeCode(null);
    setChallengeExpired(false);
    setError(null);
    setCurrentStep("id");
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
        throw new Error(data.error || "Failed to upload ID");
      }

      const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload ID photo. Please try again.");
      }

      setIdDocumentKey(data.key);
      setCurrentStep("id_uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIdUploading(false);
    }
  }

  async function handleContinueToVideo(): Promise<void> {
    if (!idDocumentKey) {
      setError("Please upload your ID first.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/worker/verification/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idDocumentKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setChallengeCode(data.challenge);
        const expiresAtMs = data.challenge?.expiresAt
          ? new Date(data.challenge.expiresAt).getTime()
          : 0;
        setChallengeExpired(expiresAtMs > 0 && expiresAtMs <= Date.now());
        setCurrentStep("video");
      } else {
        setError(data.error || "Failed to start video verification");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefreshChallenge(): Promise<void> {
    await handleContinueToVideo();
  }

  async function handleOpenCamera(): Promise<void> {
    setError(null);

    if (
      challengeCode &&
      new Date(challengeCode.expiresAt).getTime() <= Date.now()
    ) {
      setChallengeExpired(true);
      setError("Challenge code has expired. Please request a new one.");
      return;
    }

    if (!isLiveRecordingApiAvailable()) {
      setError(UNSUPPORTED_LIVE_RECORDING_MESSAGE);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        LIVE_CAMERA_CONSTRAINTS
      );
      const previous = cameraStreamRef.current;
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setCurrentStep("recording");
      stopMediaStream(previous);
    } catch (err) {
      setError(
        messageForLiveRecordingError(classifyGetUserMediaError(err))
      );
    }
  }

  async function handleReacquireCamera(): Promise<void> {
    setError(null);

    if (!isLiveRecordingApiAvailable()) {
      releaseCamera();
      setCurrentStep("video");
      setError(UNSUPPORTED_LIVE_RECORDING_MESSAGE);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        LIVE_CAMERA_CONSTRAINTS
      );
      const previous = cameraStreamRef.current;
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      stopMediaStream(previous);
    } catch (err) {
      releaseCamera();
      setCurrentStep("video");
      setError(
        messageForLiveRecordingError(classifyGetUserMediaError(err))
      );
    }
  }

  async function handleVideoRecorded(
    blob: Blob,
    contentType: LivenessUploadContentType
  ): Promise<void> {
    if (!idDocumentKey) {
      setError("Please upload your ID first.");
      return;
    }

    setError(null);
    setVideoUploading(true);
    try {
      const res = await fetch("/api/worker/verification/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "liveness_video",
          contentType,
          idDocumentKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload video");
      }

      const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload verification video. Please try again.");
      }

      releaseCamera();
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
      } else if (data.details) {
        setError(
          Array.isArray(data.details)
            ? data.details.join(". ")
            : data.error || "Submission failed"
        );
      } else {
        setError(data.error || "Submission failed");
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
      void handleIdUpload(file);
    }
  }

  function renderIdStep(): React.ReactNode {
    return (
      <div className="space-y-5" data-testid="verification-id-step">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            {t("heading")}
          </h1>
          <p className="text-primary-400 mt-2 text-sm font-medium">
            {t("stepOf", { current: 1, total: 2 })}
          </p>
          <p className="text-charcoal-100 mt-2 font-medium">{t("uploadIdTitle")}</p>
          <p className="text-charcoal-400 mt-1.5 text-sm">
            {t("uploadIdBody")}
          </p>
        </div>

        <select
          className="w-full px-4 py-3 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
          aria-label={t("documentType")}
        >
          {DOC_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(
                opt.value === "passport"
                  ? "docPassport"
                  : opt.value === "thai_id"
                    ? "docThaiId"
                    : opt.value === "drivers_license"
                      ? "docLicense"
                      : "docOther"
              )}
            </option>
          ))}
        </select>

        <label className="block">
          <div className="bg-charcoal-800 border border-charcoal-600 rounded-xl p-4 text-center cursor-pointer hover:border-primary-500/50 transition-colors">
            {idUploading ? (
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                <span className="text-charcoal-300 text-sm">{t("uploadingId")}</span>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-5 h-5 text-primary-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-charcoal-100 font-medium text-sm">
                  {t("uploadIdPhoto")}
                </p>
                <p className="text-charcoal-500 text-xs mt-0.5">
                  {t("imageTypes")}
                </p>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleIdFileChange}
            disabled={idUploading}
            data-testid="verification-id-file-input"
          />
        </label>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="text-center pt-3 border-t border-charcoal-800">
          <p className="text-charcoal-500 text-xs">
            {t("usedForChecks")}
          </p>
          <button
            onClick={() => setShowWhyModal(true)}
            className="text-primary-400 text-xs mt-1.5 hover:text-primary-300 transition-colors"
          >
            {t("whyWeAsk")}
          </button>
        </div>
      </div>
    );
  }

  function renderIdUploadedStep(): React.ReactNode {
    return (
      <div className="space-y-5" data-testid="verification-id-uploaded-step">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            {t("heading")}
          </h1>
          <p className="text-primary-400 mt-2 text-sm font-medium">
            {t("stepOf", { current: 1, total: 2 })}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <svg
            className="w-4 h-4 text-green-400 flex-shrink-0"
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
          <span className="text-green-300 text-sm">{t("idUploaded")}</span>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <Button
          fullWidth
          onClick={() => void handleContinueToVideo()}
          loading={submitting}
        >
          {t("continueToVideo")}
        </Button>
        <StartAgainButton onClick={handleStartAgain} />
      </div>
    );
  }

  function renderVideoStep(): React.ReactNode {
    const displayCode = challengeCode?.displayCode || challengeCode?.code || "";
    const isExpired = challengeExpired;

    return (
      <div className="space-y-5" data-testid="verification-video-step">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            {t("heading")}
          </h1>
          <p className="text-primary-400 mt-2 text-sm font-medium">
            {t("stepOf", { current: 2, total: 2 })}
          </p>
          <p className="text-charcoal-100 mt-2 font-medium">
            {t("recordVideoTitle")}
          </p>
        </div>

        <div className="space-y-2.5 px-2">
          <ChecklistItem text={t("holdId")} />
          <ChecklistItem text={t("keepVisible")} />
          <ChecklistItem text={t("readCode")} />
        </div>

        <div className="bg-charcoal-900 border border-primary-500 rounded-xl px-5 py-4 text-center">
          <p className="text-charcoal-400 text-[10px] uppercase tracking-wider mb-1">
            {t("sayThisCode")}
          </p>
          <p
            className="text-4xl font-mono font-bold text-primary-400 tracking-[0.2em]"
            data-testid="challenge-code"
          >
            {displayCode || "------"}
          </p>
        </div>

        {(error || isExpired) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">
              {isExpired
                ? t("codeExpired")
                : error}
            </p>
          </div>
        )}

        {isExpired ? (
          <Button
            fullWidth
            onClick={() => void handleRefreshChallenge()}
            loading={submitting}
          >
            {t("getNewCode")}
          </Button>
        ) : (
          <Button fullWidth onClick={() => void handleOpenCamera()}>
            {t("openCamera")}
          </Button>
        )}

        <StartAgainButton onClick={handleStartAgain} />

        <div className="text-center pt-3 border-t border-charcoal-800">
          <p className="text-charcoal-500 text-xs">
            {t("usedForChecks")}
          </p>
          <button
            onClick={() => setShowWhyModal(true)}
            className="text-primary-400 text-xs mt-1.5 hover:text-primary-300 transition-colors"
          >
            {t("whyWeAsk")}
          </button>
        </div>
      </div>
    );
  }

  function renderRecordingStep(): React.ReactNode {
    if (!cameraStream) {
      return renderVideoStep();
    }

    return (
      <div className="space-y-5" data-testid="verification-recording-step">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            {t("heading")}
          </h1>
          <p className="text-primary-400 mt-2 text-sm font-medium">
            {t("stepOf", { current: 2, total: 2 })}
          </p>
        </div>

        <LiveLivenessRecorder
          stream={cameraStream}
          challengeDisplayCode={
            challengeCode?.displayCode || challengeCode?.code || ""
          }
          uploading={videoUploading}
          onRecorded={(blob, contentType) => {
            void handleVideoRecorded(blob, contentType);
          }}
          onCancel={() => {
            releaseCamera();
            setCurrentStep("video");
          }}
          onError={(message) => setError(message)}
          onReacquireCamera={() => {
            void handleReacquireCamera();
          }}
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <StartAgainButton onClick={handleStartAgain} />
      </div>
    );
  }

  function renderReviewStep(): React.ReactNode {
    return (
      <div className="space-y-6" data-testid="verification-review-step">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-charcoal-100">
            {t("readyTitle")}
          </h1>
          <p className="text-charcoal-400 mt-2">
            {t("readyBody")}
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
            <span className="text-green-300 text-sm">{t("idDocumentUploaded")}</span>
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
              {t("videoRecorded")}
            </span>
          </div>
        </div>

        <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
          <p className="text-charcoal-300 text-sm">
            <span className="text-charcoal-400">{t("documentTypeLabel")}</span>{" "}
            {t(
              docType === "passport"
                ? "docPassport"
                : docType === "thai_id"
                  ? "docThaiId"
                  : docType === "drivers_license"
                    ? "docLicense"
                    : "docOther"
            )}
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
            onClick={() => void handleSubmitVerification()}
            loading={submitting}
          >
            {t("submit")}
          </Button>
          <StartAgainButton onClick={handleStartAgain} />
        </div>

        <div className="text-center pt-2 border-t border-charcoal-800">
          <p className="text-charcoal-500 text-xs">
            {t("usedForChecks")}
          </p>
        </div>
      </div>
    );
  }

  function renderPendingStep(): React.ReactNode {
    return (
      <div className="space-y-6" data-testid="verification-pending-step">
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
            {t("pendingTitle")}
          </h1>
          <p className="text-charcoal-400 mt-2">{t("pendingBody")}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-charcoal-400">{t("status")}</span>
            <Badge variant="warning">{t("underReview")}</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-charcoal-400">{t("profileVisibility")}</span>
            <Badge variant="default">{t("notLive")}</Badge>
          </div>
        </div>

        <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
          <p className="text-charcoal-400 text-sm">
            {t("pendingNote")}
          </p>
        </div>

        <Button
          variant="outline"
          fullWidth
          onClick={() => router.push("/worker/dashboard")}
        >
          {t("returnToDashboard")}
        </Button>
      </div>
    );
  }

  function renderVerifiedStep(): React.ReactNode {
    return (
      <div className="space-y-6" data-testid="verification-verified-step">
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
            {t("verifiedTitle")}
          </h1>
          <p className="text-charcoal-400 mt-2">{t("verifiedBody")}</p>
        </div>

        <Button fullWidth onClick={() => router.push("/worker/dashboard")}>
          {t("goToDashboard")}
        </Button>
      </div>
    );
  }

  function renderRejectedStep(): React.ReactNode {
    return (
      <div className="space-y-6" data-testid="verification-rejected-step">
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
            {t("rejectedTitle")}
          </h1>
          <p className="text-charcoal-400 mt-2">{t("rejectedBody")}</p>
        </div>

        <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
          <p className="text-charcoal-300 text-sm font-medium mb-2">
            {t("commonIssues")}
          </p>
          <ul className="text-charcoal-400 text-sm space-y-1 list-disc list-inside">
            <li>{t("issueUnclear")}</li>
            <li>{t("issueFace")}</li>
            <li>{t("issueCode")}</li>
            <li>{t("issueMismatch")}</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button fullWidth onClick={handleStartAgain}>
            {t("tryAgain")}
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => router.push("/worker/dashboard")}
          >
            {t("returnToDashboard")}
          </Button>
        </div>
      </div>
    );
  }

  function renderCurrentStep(): React.ReactNode {
    switch (currentStep) {
      case "id":
        return renderIdStep();
      case "id_uploaded":
        return renderIdUploadedStep();
      case "video":
        return renderVideoStep();
      case "recording":
        return renderRecordingStep();
      case "review":
        return renderReviewStep();
      case "pending":
        return renderPendingStep();
      case "verified":
        return renderVerifiedStep();
      case "rejected":
        return renderRejectedStep();
      default:
        return renderIdStep();
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
