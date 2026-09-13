import { describe, it, expect } from "vitest";

export interface InterestState {
  sent: boolean;
  profileId: string | null;
  createdAt: Date | null;
}

export function getInterestButtonState(
  profileId: string,
  sentInterests: Map<string, Date>
): InterestState {
  const sentAt = sentInterests.get(profileId);
  return {
    sent: !!sentAt,
    profileId: sentAt ? profileId : null,
    createdAt: sentAt || null,
  };
}

export function shouldShowInterestSent(interestState: InterestState): boolean {
  return interestState.sent;
}

export function getButtonLabel(interestSent: boolean): string {
  return interestSent ? "Interest Sent" : "Express Interest";
}

export function getButtonVariant(interestSent: boolean): "primary" | "secondary" {
  return interestSent ? "secondary" : "primary";
}

export function isButtonDisabled(interestSent: boolean): boolean {
  return interestSent;
}

describe("Interest Button State", () => {
  describe("getInterestButtonState", () => {
    it("should return unsent state for profile without interest", () => {
      const sentInterests = new Map<string, Date>();
      const profileId = "profile-123";
      
      const state = getInterestButtonState(profileId, sentInterests);
      
      expect(state.sent).toBe(false);
      expect(state.profileId).toBeNull();
      expect(state.createdAt).toBeNull();
    });

    it("should return sent state for profile with interest", () => {
      const sentInterests = new Map<string, Date>();
      const profileId = "profile-123";
      const sentDate = new Date("2024-01-15");
      sentInterests.set(profileId, sentDate);
      
      const state = getInterestButtonState(profileId, sentInterests);
      
      expect(state.sent).toBe(true);
      expect(state.profileId).toBe(profileId);
      expect(state.createdAt).toEqual(sentDate);
    });

    it("should correctly identify unsent when other profiles have interests", () => {
      const sentInterests = new Map<string, Date>();
      sentInterests.set("other-profile", new Date());
      
      const profileId = "profile-123";
      const state = getInterestButtonState(profileId, sentInterests);
      
      expect(state.sent).toBe(false);
    });
  });

  describe("shouldShowInterestSent", () => {
    it("should return false for unsent interest", () => {
      const state: InterestState = { sent: false, profileId: null, createdAt: null };
      expect(shouldShowInterestSent(state)).toBe(false);
    });

    it("should return true for sent interest", () => {
      const state: InterestState = { 
        sent: true, 
        profileId: "profile-123", 
        createdAt: new Date() 
      };
      expect(shouldShowInterestSent(state)).toBe(true);
    });
  });

  describe("getButtonLabel", () => {
    it('should return "Express Interest" when interest not sent', () => {
      expect(getButtonLabel(false)).toBe("Express Interest");
    });

    it('should return "Interest Sent" when interest already sent', () => {
      expect(getButtonLabel(true)).toBe("Interest Sent");
    });
  });

  describe("getButtonVariant", () => {
    it('should return "primary" variant when interest not sent', () => {
      expect(getButtonVariant(false)).toBe("primary");
    });

    it('should return "secondary" variant when interest already sent', () => {
      expect(getButtonVariant(true)).toBe("secondary");
    });
  });

  describe("isButtonDisabled", () => {
    it("should not be disabled when interest not sent", () => {
      expect(isButtonDisabled(false)).toBe(false);
    });

    it("should be disabled when interest already sent", () => {
      expect(isButtonDisabled(true)).toBe(true);
    });
  });
});

describe("Fresh Recruiter Interest State", () => {
  it("should show all profiles as unsent for fresh recruiter", () => {
    const freshRecruiterInterests = new Map<string, Date>();
    const profileIds = ["profile-1", "profile-2", "profile-3"];
    
    for (const profileId of profileIds) {
      const state = getInterestButtonState(profileId, freshRecruiterInterests);
      expect(state.sent).toBe(false);
      expect(getButtonLabel(state.sent)).toBe("Express Interest");
      expect(isButtonDisabled(state.sent)).toBe(false);
    }
  });

  it("should only show sent for profiles where interest was actually expressed", () => {
    const recruiterInterests = new Map<string, Date>();
    recruiterInterests.set("profile-2", new Date());
    
    const profileIds = ["profile-1", "profile-2", "profile-3"];
    const results = profileIds.map(id => ({
      id,
      state: getInterestButtonState(id, recruiterInterests),
    }));
    
    expect(results[0].state.sent).toBe(false);
    expect(results[1].state.sent).toBe(true);
    expect(results[2].state.sent).toBe(false);
  });
});
