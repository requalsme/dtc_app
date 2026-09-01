// Retired page-narration copy, kept here (not rendered) as source material for a
// future in-app help/guide bot rather than shown inline on every page. See the
// "UI cleanup" note from Raina, 2026-09-01: the app was explaining itself to the
// user on every screen instead of just being usable — this is where that
// explanatory text went instead of the trash, in case a help popup wants it later.
export const RETIRED_PAGE_COPY = {
  "dashboard.admin.hero": {
    kicker: "Admin command",
    heading: "Keep every form, client, and audit trail moving in sync.",
    body: "Published templates are live to caregivers, finished records are stored as signed PDFs, and the compliance trail stays visible in one place.",
  },
  "dashboard.office.hero": {
    kicker: "Office oversight",
    heading: "Watch the daily filing pulse and close the loop on every visit record.",
    body: "Submissions, corrections, and signed PDFs stay centralized so the office can review quickly and keep the care timeline complete.",
  },
  "templates.page": "Digitized forms move from import to editable draft to published workflow.",
  "templates.upload": "Upload any PDF to create an editable template backed by a structured schema, or start from the reference library below.",
  "users.page": "Manage accounts across all roles — caregivers, office staff, new hires, and clients.",
  "clients.page": "Manage the directory that powers autofill, assignments, and stored records.",
  "clients.addForm": "Create a new client profile and assign caregivers.",
  "audit.page": "Immutable record of sign-ins, submissions, reviews, and template changes.",
  "certificates.page": "Training completions from courses.daretocarehomecare.com. Match each certificate to the right team member.",
} as const;
