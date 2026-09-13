export {
  getInterestContextForWorker,
  getInterestsForWorkerProfile,
  getPublishedOpeningsForRecruiter,
  getRecruiterVenueInfo,
  type InterestContextForWorker,
  type RecruiterDisplayContext,
  type OpeningTag,
  type RecruiterVenueInfo,
} from "./context";

export {
  resolveOpeningAttachment,
  isOpeningVisibleToWorkers,
  canWorkerAccessInterestContext,
} from "./opening-attachment";

export const EMPTY_STATE_COPY = {
  recruiterNoOpenings: "No openings yet",
  recruiterNoOpeningsCta: "Add openings to start hiring",
  workerNoOpenings: "No openings at this venue right now",
  workerNoInterests: "No interest yet — keep your profile fresh",
} as const;
