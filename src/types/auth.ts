import { type DefaultSession } from "next-auth";

export type UserRole = "worker" | "recruiter";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: UserRole;
      ageVerified: boolean;
      signupPending?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    ageVerified: boolean;
    signupPending?: boolean;
  }
}

export interface OnboardingData {
  role: UserRole;
  dateOfBirth: string;
  ageConfirmed: boolean;
}
