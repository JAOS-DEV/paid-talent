"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";

export default function WorkerProfilePage(): React.ReactElement {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session || session.user.role !== "worker") {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-charcoal-100">
              Edit Profile
            </h1>
            <p className="text-charcoal-400 mt-1">
              Complete your profile to attract more recruiters
            </p>
          </div>

          <div className="space-y-6">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Profile Photo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-6">
                  <div className="w-24 h-24 rounded-full bg-charcoal-700 flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-charcoal-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <Button variant="outline" size="sm">
                      Upload Photo
                    </Button>
                    <p className="text-charcoal-500 text-xs mt-2">
                      JPG, PNG or WebP. Max 5MB.
                    </p>
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
                />
                <Input label="Location" placeholder="City, Country" />
                <Input label="Area" placeholder="Your primary work area" />
                <div>
                  <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                    Bio
                  </label>
                  <textarea
                    className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 placeholder:text-charcoal-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[100px]"
                    placeholder="Tell recruiters about yourself..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Work Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Job Roles"
                  placeholder="e.g., Bartender, Server, Host"
                  helperText="Comma-separated list of roles you can fill"
                />
                <Input label="Experience" placeholder="e.g., 5 years" />
                <Input
                  label="Languages"
                  placeholder="e.g., English, Thai, Japanese"
                  helperText="Comma-separated list of languages you speak"
                />
                <Input
                  label="Availability"
                  placeholder="e.g., Weekends, Full-time, Part-time"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    label="Expected Pay (Min)"
                    placeholder="Minimum"
                  />
                  <Input
                    type="number"
                    label="Expected Pay (Max)"
                    placeholder="Maximum"
                  />
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
                <Input label="LINE ID" placeholder="Your LINE ID (optional)" />
                <Input
                  label="WhatsApp"
                  placeholder="Your WhatsApp number (optional)"
                />
                <Input
                  label="Phone"
                  placeholder="Your phone number (optional)"
                />
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-4">
              <Button variant="outline">Cancel</Button>
              <Button>Save Profile</Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
