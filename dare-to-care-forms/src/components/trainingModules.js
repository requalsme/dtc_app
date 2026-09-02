// The single source of truth, on the dtc-app side, for which caregiver
// training courses exist. Every id/title here must match an entry in
// window.DTC_COURSES in the dtccourses repo exactly — that's how a
// completed course certificate (from courses.daretocarehomecare.com) gets
// matched back to onboarding steps and the admin training-progress view.
//
// To add a new course: add it to dtccourses/course-data.js first, then add
// the matching entry here. This is the only other place it needs to go —
// NewHirePortal (onboarding gate) and admin.jsx (Certificates panel) both
// import this same list instead of keeping their own copies.
export const TRAINING_MODULES = [
  { id: "emergency", title: "Emergency Preparedness & Disaster Planning", desc: "Proactive plans, risk assessment, supplies, and communication to keep clients safe during unexpected events.", minutes: 4 },
  { id: "home-safety", title: "Home Safety", desc: "Prevent accidents and create a secure environment — hazards, bathroom and kitchen safety, and medication management.", minutes: 3 },
  { id: "abuse", title: "Abuse & Neglect Prevention", desc: "Identify high-risk situations, recognize warning signs, and protect clients from abuse, neglect, and exploitation.", minutes: 3 },
  { id: "first-aid", title: "Basic First Aid", desc: "Handle common emergencies — cuts, burns, choking, bleeding — and know when to call for professional help.", minutes: 4 },
  { id: "infection", title: "Infection Control & Universal Precautions", desc: "Standard precautions for every client — hand hygiene, PPE, sharps safety, and proper cleaning and disinfection.", minutes: 6 },
  { id: "rights", title: "Consumer Rights & Behavior Management", desc: "Uphold client rights and ethical behavior management — privacy, informed consent, choice, dignity, and respect.", minutes: 5 },
  { id: "ihss", title: "Colorado IHSS Training", desc: "An IHSS orientation — attendant roles, Care Plan boundaries, Workday learning, and specialized training.", minutes: 7 },
];
