"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { Card, CardContent } from "@/components/ui";
import {
  OnboardingStepper,
  PhotoStep,
  NameStep,
  RolesStep,
  ExperienceStep,
  LanguagesStep,
  BioStep,
  LocationStep,
  ContactStep,
} from "@/components/onboarding";
import {
  getProfileCompleteness,
  getNextStepId,
  getPreviousStepId,
} from "@/lib/profile";
import type { WorkerProfile } from "@/lib/db/schema";

export default function WorkerOnboardingPage(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("photo");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile(): Promise<void> {
      try {
        const res = await fetch("/api/worker/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);

          const completeness = getProfileCompleteness(data.profile);
          setCompletedSteps(completeness.completedSteps);

          if (completeness.isComplete) {
            router.replace("/worker/dashboard");
          } else if (completeness.nextStep) {
            setCurrentStep(completeness.nextStep);
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

  const handleStepComplete = useCallback(async (): Promise<void> => {
    const res = await fetch("/api/worker/profile");
    if (res.ok) {
      const data = await res.json();
      setProfile(data.profile);
      const completeness = getProfileCompleteness(data.profile);
      setCompletedSteps(completeness.completedSteps);
    }

    const nextStep = getNextStepId(currentStep);
    if (nextStep) {
      setCurrentStep(nextStep);
    } else {
      router.push("/worker/dashboard");
    }
  }, [currentStep, router]);

  const handleBack = useCallback((): void => {
    const prevStep = getPreviousStepId(currentStep);
    if (prevStep) {
      setCurrentStep(prevStep);
    }
  }, [currentStep]);

  const handleOnboardingComplete = useCallback((): void => {
    router.push("/worker/dashboard");
  }, [router]);

  if (status === "loading" || loading || !session || session.user.role !== "worker") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  function renderCurrentStep(): React.ReactNode {
    switch (currentStep) {
      case "photo":
        return (
          <PhotoStep
            initialPhotoUrl={profile?.photoUrl ?? null}
            onComplete={handleStepComplete}
          />
        );
      case "name":
        return (
          <NameStep
            initialName={profile?.displayName ?? ""}
            onComplete={handleStepComplete}
            onBack={handleBack}
          />
        );
      case "roles":
        return (
          <RolesStep
            initialRoles={(profile?.jobRoles as string[]) ?? []}
            onComplete={handleStepComplete}
            onBack={handleBack}
          />
        );
      case "experience":
        return (
          <ExperienceStep
            initialExperience={profile?.experience ?? null}
            initialYears={profile?.experienceYears ?? null}
            onComplete={handleStepComplete}
            onBack={handleBack}
          />
        );
      case "languages":
        return (
          <LanguagesStep
            initialLanguages={(profile?.languages as string[]) ?? []}
            onComplete={handleStepComplete}
            onBack={handleBack}
          />
        );
      case "bio":
        return (
          <BioStep
            initialBio={profile?.bio ?? null}
            onComplete={handleStepComplete}
            onBack={handleBack}
          />
        );
      case "location":
        return (
          <LocationStep
            initialLocation={profile?.location ?? null}
            initialArea={profile?.area ?? null}
            initialAvailability={profile?.availability ?? null}
            initialPayMin={profile?.expectedPayMin ?? null}
            initialPayMax={profile?.expectedPayMax ?? null}
            initialPayCurrency={profile?.payCurrency ?? null}
            onComplete={handleStepComplete}
            onBack={handleBack}
          />
        );
      case "contact":
        return (
          <ContactStep
            initialLineId={profile?.lineId ?? null}
            initialWhatsApp={profile?.whatsappNumber ?? null}
            initialPhone={profile?.phoneNumber ?? null}
            onComplete={handleOnboardingComplete}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-md mx-auto px-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-charcoal-100">
              Complete Your Profile
            </h1>
            <p className="text-charcoal-400 mt-1">
              Let recruiters know who you are
            </p>
          </div>

          <Card padding="lg">
            <CardContent>
              <OnboardingStepper
                currentStepId={currentStep}
                completedSteps={completedSteps}
              />

              <div className="mt-6">{renderCurrentStep()}</div>
            </CardContent>
          </Card>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push("/worker/dashboard")}
              className="text-charcoal-500 text-sm hover:text-charcoal-300 transition-colors"
            >
              Finish later
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
