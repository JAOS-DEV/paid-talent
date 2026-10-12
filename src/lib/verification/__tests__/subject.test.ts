import { describe, expect, it } from "vitest";
import {
  recruiterVerificationSubject,
  workerVerificationSubject,
} from "../subject";

describe("verification subject adapters", () => {
  it("maps worker eventFk to workerProfileId", () => {
    expect(workerVerificationSubject.eventFk("worker-profile-1")).toEqual({
      workerProfileId: "worker-profile-1",
    });
    expect(workerVerificationSubject.type).toBe("worker");
    expect(workerVerificationSubject.actorType).toBe("worker");
    expect(workerVerificationSubject.profileNotFoundError).toBe(
      "Worker profile not found"
    );
  });

  it("maps recruiter eventFk to recruiterProfileId", () => {
    expect(recruiterVerificationSubject.eventFk("recruiter-profile-1")).toEqual(
      {
        recruiterProfileId: "recruiter-profile-1",
      }
    );
    expect(recruiterVerificationSubject.type).toBe("recruiter");
    expect(recruiterVerificationSubject.actorType).toBe("recruiter");
    expect(recruiterVerificationSubject.profileNotFoundError).toBe(
      "Recruiter profile not found"
    );
  });
});
