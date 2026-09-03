// Types for trainingModules.js.
//
// The list itself stays a plain .js module on purpose: it is edited alongside
// dtccourses/course-data.js by whoever adds a course, and keeping it free of
// TypeScript syntax means that edit needs no build knowledge. This file gives
// its consumers real types without changing that.
//
// (Pre-existing: NewHirePortal.tsx mapped over this list and tripped
// noImplicitAny, which failed `tsc -b` before the Supabase migration too.)

export interface TrainingModule {
  /** Must match an entry in window.DTC_COURSES exactly — that is how a
   *  completed certificate is matched back to an onboarding step. */
  id: string;
  title: string;
  desc: string;
  minutes: number;
}

export declare const TRAINING_MODULES: TrainingModule[];
