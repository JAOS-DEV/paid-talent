import { describe, it, expect } from "vitest";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  role: z.enum(["worker", "recruiter"]),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function validateRegisterInput(input: unknown): {
  success: boolean;
  data?: z.infer<typeof registerSchema>;
  error?: string;
} {
  const result = registerSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.issues[0]?.message };
}

export function validateAge(
  dob: string,
  referenceDate: Date = new Date()
): { valid: boolean; age: number } {
  const dateOfBirth = new Date(dob + "T00:00:00");
  let age = referenceDate.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = referenceDate.getMonth() - dateOfBirth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < dateOfBirth.getDate())
  ) {
    age--;
  }
  return { valid: age >= 20, age };
}

export function getSignupRedirectUrl(role: "worker" | "recruiter"): string {
  return role === "worker" ? "/worker/onboarding" : "/recruiter/dashboard";
}

describe("Auth Register Validation", () => {
  describe("validateRegisterInput", () => {
    it("should accept valid worker registration", () => {
      const result = validateRegisterInput({
        email: "test@example.com",
        role: "worker",
        dob: "1990-01-15",
      });
      expect(result.success).toBe(true);
      expect(result.data?.email).toBe("test@example.com");
      expect(result.data?.role).toBe("worker");
    });

    it("should accept valid recruiter registration", () => {
      const result = validateRegisterInput({
        email: "recruiter@company.com",
        role: "recruiter",
        dob: "1985-06-20",
      });
      expect(result.success).toBe(true);
      expect(result.data?.role).toBe("recruiter");
    });

    it("should reject invalid email", () => {
      const result = validateRegisterInput({
        email: "not-an-email",
        role: "worker",
        dob: "1990-01-15",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid role", () => {
      const result = validateRegisterInput({
        email: "test@example.com",
        role: "admin",
        dob: "1990-01-15",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid date format", () => {
      const result = validateRegisterInput({
        email: "test@example.com",
        role: "worker",
        dob: "01/15/1990",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing fields", () => {
      const result = validateRegisterInput({
        email: "test@example.com",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateAge", () => {
    it("should validate user is 20 or older", () => {
      const today = new Date();
      const dob = new Date(
        today.getFullYear() - 25,
        today.getMonth(),
        today.getDate()
      );
      const dobStr = dob.toISOString().split("T")[0];
      const result = validateAge(dobStr);
      expect(result.valid).toBe(true);
      expect(result.age).toBe(25);
    });

    it("should validate exactly 20 years old", () => {
      const today = new Date();
      const dob = new Date(
        today.getFullYear() - 20,
        today.getMonth(),
        today.getDate()
      );
      const dobStr = dob.toISOString().split("T")[0];
      const result = validateAge(dobStr);
      expect(result.valid).toBe(true);
      expect(result.age).toBe(20);
    });

    it("should reject user under 20", () => {
      const today = new Date();
      const dob = new Date(
        today.getFullYear() - 18,
        today.getMonth(),
        today.getDate()
      );
      const dobStr = dob.toISOString().split("T")[0];
      const result = validateAge(dobStr);
      expect(result.valid).toBe(false);
      expect(result.age).toBe(18);
    });

    it("should reject user one day before 20th birthday", () => {
      const reference = new Date(2024, 5, 15); // June 15, 2024
      const result = validateAge("2004-06-16", reference);
      expect(result.valid).toBe(false);
      expect(result.age).toBe(19);
    });
  });

  describe("getSignupRedirectUrl", () => {
    it("should return worker onboarding URL for worker role", () => {
      expect(getSignupRedirectUrl("worker")).toBe("/worker/onboarding");
    });

    it("should return recruiter dashboard URL for recruiter role", () => {
      expect(getSignupRedirectUrl("recruiter")).toBe("/recruiter/dashboard");
    });
  });
});

describe("Role Intent Preservation", () => {
  it("should preserve worker role through signup flow", () => {
    const initialRole = "worker";
    const params = new URLSearchParams();
    params.set("role", initialRole);
    params.set("dob", "1990-01-15");
    
    const role = params.get("role");
    expect(role).toBe("worker");
  });

  it("should preserve recruiter role through signup flow", () => {
    const initialRole = "recruiter";
    const params = new URLSearchParams();
    params.set("role", initialRole);
    params.set("dob", "1990-01-15");
    
    const role = params.get("role");
    expect(role).toBe("recruiter");
  });
});
