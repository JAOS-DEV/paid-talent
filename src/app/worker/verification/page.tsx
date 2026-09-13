"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@/components/ui";
import type { VerificationStatus, DocType } from "@/lib/db/schema";

interface ChallengeCode {
  code: string;
  displayCode: string;
  issuedAt: string;
  expiresAt: string;
  isExpired?: boolean;
  instructions: string;
}

interface VerificationState {
  verificationStatus: VerificationStatus;
  hasIdDocument: boolean;
  hasChallengeCode: boolean;
}

type VerificationStep = "intro" | "challenge" | "id_upload" | "video_upload" | "submit" | "pending" | "verified" | "rejected";

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: "passport", label: "Passport" },
  { value: "thai_id", label: "Thai National ID" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "other", label: "Other Government ID" },
];

export default function WorkerVerificationPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<VerificationStep>("intro");
  
  const [, setVerificationState] = useState<VerificationState | null>(null);
  const [challengeCode, setChallengeCode] = useState<ChallengeCode | null>(null);
  
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
        setVerificationState(data.verification);
        
        const s = data.verification.verificationStatus;
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

  async function handleGenerateChallenge(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/worker/verification/challenge", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setChallengeCode(data.challenge);
        setCurrentStep("challenge");
      } else {
        setError(data.error || "Failed to generate challenge code");
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
      setCurrentStep("video_upload");
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
      setCurrentStep("submit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setVideoUploading(false);
    }
  }

  async function handleSubmitVerification(): Promise<void> {
    if (!idDocumentKey || !livenessVideoKey) {
      setError("Please complete all upload steps");
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
        setVerificationState({
          verificationStatus: "pending",
          hasIdDocument: true,
          hasChallengeCode: true,
        });
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
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Identity Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
            <h3 className="font-semibold text-charcoal-100 mb-2">Why verification is required</h3>
            <p className="text-charcoal-400 text-sm">
              To protect recruiters and maintain platform trust, we require all workers to verify their identity before their profile becomes visible in search results.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-charcoal-100">What you&apos;ll need:</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-primary-400 font-medium">1</span>
                </div>
                <div>
                  <p className="text-charcoal-200 font-medium">Government-issued ID</p>
                  <p className="text-charcoal-500 text-sm">Passport, Thai National ID, or Driver&apos;s License</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-primary-400 font-medium">2</span>
                </div>
                <div>
                  <p className="text-charcoal-200 font-medium">Short liveness video</p>
                  <p className="text-charcoal-500 text-sm">Record yourself holding your ID and speaking a verification code</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="pt-4">
            <Button fullWidth onClick={handleGenerateChallenge} loading={submitting}>
              Start Verification
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderChallengeStep(): React.ReactNode {
    return (
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Step 1: Your Verification Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {challengeCode && (
            <>
              <div className="bg-charcoal-800 rounded-lg p-6 text-center border border-charcoal-700">
                <p className="text-charcoal-400 text-sm mb-2">Your Challenge Code</p>
                <p className="text-4xl font-mono font-bold text-primary-400 tracking-wider">
                  {challengeCode.displayCode}
                </p>
                <p className="text-charcoal-500 text-sm mt-3">
                  Code expires in 30 minutes
                </p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-300 text-sm font-medium mb-1">Important:</p>
                <p className="text-yellow-200/70 text-sm">
                  {challengeCode.instructions}
                </p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-charcoal-200 mb-1.5 block">
                    ID Document Type
                  </span>
                  <select
                    className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as DocType)}
                  >
                    {DOC_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Button fullWidth onClick={() => setCurrentStep("id_upload")}>
                Continue to Upload ID
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderIdUploadStep(): React.ReactNode {
    return (
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Step 2: Upload ID Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
            <p className="text-charcoal-300 text-sm">
              Upload a clear photo of your {DOC_TYPE_OPTIONS.find(d => d.value === docType)?.label || "ID document"}. 
              Make sure all text is readable and the photo is not blurry.
            </p>
          </div>

          <div className="border-2 border-dashed border-charcoal-600 rounded-lg p-8 text-center">
            {idUploading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mb-3" />
                <p className="text-charcoal-400">Uploading...</p>
              </div>
            ) : (
              <>
                <svg className="w-12 h-12 text-charcoal-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <label className="cursor-pointer">
                  <span className="text-primary-400 font-medium">Click to upload</span>
                  <span className="text-charcoal-500"> or drag and drop</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleIdFileChange}
                  />
                </label>
                <p className="text-charcoal-500 text-sm mt-2">JPG, PNG, or WebP (max 10MB)</p>
              </>
            )}
          </div>

          <Button variant="outline" fullWidth onClick={() => setCurrentStep("challenge")}>
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderVideoUploadStep(): React.ReactNode {
    return (
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Step 3: Record Liveness Video</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {idDocumentKey && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-300 text-sm">ID document uploaded successfully</span>
            </div>
          )}

          <div className="bg-charcoal-800 rounded-lg p-4 border border-charcoal-700">
            <p className="text-charcoal-200 font-medium mb-2">Your Challenge Code:</p>
            <p className="text-2xl font-mono font-bold text-primary-400">{challengeCode?.displayCode}</p>
          </div>

          <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
            <h4 className="font-medium text-charcoal-200 mb-2">Recording Instructions:</h4>
            <ol className="space-y-2 text-charcoal-400 text-sm list-decimal list-inside">
              <li>Hold your ID document next to your face</li>
              <li>Clearly say today&apos;s date</li>
              <li>Read the challenge code above out loud</li>
              <li>Keep recording for at least 5 seconds</li>
            </ol>
          </div>

          <div className="border-2 border-dashed border-charcoal-600 rounded-lg p-8 text-center">
            {videoUploading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mb-3" />
                <p className="text-charcoal-400">Uploading video...</p>
              </div>
            ) : (
              <>
                <svg className="w-12 h-12 text-charcoal-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <label className="cursor-pointer">
                  <span className="text-primary-400 font-medium">Click to upload video</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={handleVideoFileChange}
                  />
                </label>
                <p className="text-charcoal-500 text-sm mt-2">MP4, WebM, or MOV (max 50MB)</p>
              </>
            )}
          </div>

          <Button variant="outline" fullWidth onClick={() => setCurrentStep("id_upload")}>
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderSubmitStep(): React.ReactNode {
    return (
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Step 4: Review & Submit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-300 text-sm">ID document uploaded</span>
            </div>
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-300 text-sm">Liveness video uploaded</span>
            </div>
          </div>

          <div className="bg-charcoal-800/50 rounded-lg p-4 border border-charcoal-700">
            <p className="text-charcoal-200 text-sm">
              <strong>Document Type:</strong> {DOC_TYPE_OPTIONS.find(d => d.value === docType)?.label}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button fullWidth onClick={handleSubmitVerification} loading={submitting}>
              Submit for Verification
            </Button>
            <Button variant="outline" fullWidth onClick={() => setCurrentStep("video_upload")}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderPendingStep(): React.ReactNode {
    return (
      <Card padding="lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verification Pending
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-200 text-sm">
              Your verification documents are being reviewed. This usually takes 1-2 business days.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-charcoal-400">Status</span>
              <Badge variant="warning">Under Review</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-charcoal-400">Profile Visibility</span>
              <Badge variant="default">Not Live</Badge>
            </div>
          </div>

          <p className="text-charcoal-500 text-sm">
            Once approved, your profile will automatically become visible to recruiters. 
            We&apos;ll notify you when the review is complete.
          </p>

          <Button variant="outline" fullWidth onClick={() => router.push("/worker/dashboard")}>
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderVerifiedStep(): React.ReactNode {
    return (
      <Card padding="lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verification Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-200 text-sm">
              Your identity has been verified. Your profile is now visible to recruiters.
            </p>
          </div>

          <Button fullWidth onClick={() => router.push("/worker/dashboard")}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderRejectedStep(): React.ReactNode {
    return (
      <Card padding="lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verification Rejected
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-200 text-sm">
              Your verification was not approved. This could be due to:
            </p>
            <ul className="text-red-200/70 text-sm mt-2 list-disc list-inside">
              <li>Unclear or unreadable ID document</li>
              <li>Face not visible in liveness video</li>
              <li>Incorrect challenge code spoken</li>
              <li>ID document not matching video</li>
            </ul>
          </div>

          <Button fullWidth onClick={handleGenerateChallenge} loading={submitting}>
            Try Again
          </Button>
          <Button variant="outline" fullWidth onClick={() => router.push("/worker/dashboard")}>
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderCurrentStep(): React.ReactNode {
    switch (currentStep) {
      case "intro":
        return renderIntroStep();
      case "challenge":
        return renderChallengeStep();
      case "id_upload":
        return renderIdUploadStep();
      case "video_upload":
        return renderVideoUploadStep();
      case "submit":
        return renderSubmitStep();
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

  const stepLabels = ["Code", "Upload ID", "Video", "Submit"];
  const stepIndex = ["intro", "challenge", "id_upload", "video_upload", "submit"].indexOf(currentStep);
  const showProgress = stepIndex >= 0 && stepIndex < 5;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-md mx-auto px-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-charcoal-100">
              Identity Verification
            </h1>
            <p className="text-charcoal-400 mt-1">
              Verify your identity to make your profile visible
            </p>
          </div>

          {showProgress && (
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                {stepLabels.map((label, idx) => (
                  <span 
                    key={label}
                    className={`text-xs ${idx <= Math.max(0, stepIndex - 1) ? "text-primary-400" : "text-charcoal-500"}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                {stepLabels.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 flex-1 rounded-full ${
                      idx < stepIndex ? "bg-primary-500" :
                      idx === stepIndex ? "bg-primary-400" :
                      "bg-charcoal-700"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {error && !["submit", "rejected"].includes(currentStep) && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {renderCurrentStep()}
        </div>
      </main>

      <Footer />
    </div>
  );
}
