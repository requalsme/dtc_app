// What a complete file looks like — for a caregiver, and for a client.
//
// This is the "folder checklist": the list Rejane and Raina keep on paper of
// everything that has to be in someone's folder before that folder is complete.
// It is deliberately DATA rather than logic, for the same reason the forms are:
// the paper checklist was already out of date when it was described to me, and
// it will go out of date again. Anything that changes yearly should be editable
// without touching code.
//
// -------------------------------------------------------------------------
// The one idea that makes this work
// -------------------------------------------------------------------------
// A checklist line doesn't care HOW it got satisfied. It can be satisfied by:
//
//   form    — a digital form the app already generates and files
//   upload  — a scan or photo somebody attaches (licence, I-9, CBI result)
//   certs   — course certificates arriving from the course site
//
// That's what lets paper and digital coexist instead of fighting. Someone
// hired on paper has an uploaded scan where a digitally-hired person has a
// signed form, and both files read as complete. No special case, no separate
// "paper person" mode.
//
// -------------------------------------------------------------------------
// Deliberate decisions worth not undoing
// -------------------------------------------------------------------------
// 1. THE CERTIFICATE COUNT IS NOT SIX. It is six today. Raina asked explicitly
//    that it not be locked in, because more courses are coming. So the
//    certificate line counts whatever the course site currently offers rather
//    than checking for a fixed number.
//
// 2. FORMER PEOPLE STILL HAVE FILES. Requirement was a full database of every
//    current AND past caregiver and client. Nobody is deleted — they're marked
//    inactive and their file is preserved exactly as it was. A surveyor can ask
//    about someone who left three years ago.
//
// 3. RENEWING ITEMS EXPIRE, THEY DON'T DISAPPEAR. An annual recertification
//    that lapsed is not the same as one that was never done. The first is a
//    compliance problem to chase; the second is an onboarding gap. They look
//    different here on purpose.
//
// 4. "REQUIRED" AND "COMPLETE" ARE NOT THE SAME QUESTION. Some items are
//    genuinely optional or situational. Only required items can block a file
//    from reading as complete.

export const SATISFIED_BY = {
  FORM: "form",
  UPLOAD: "upload",
  CERTS: "certs",
};

// Renewal intervals, in months. Null means "once, forever".
export const RENEWS = {
  NEVER: null,
  ANNUAL: 12,
};

// ---------------------------------------------------------------------------
// CAREGIVER FILE
// ---------------------------------------------------------------------------

export const caregiverChecklist = {
  key: "caregiver",
  label: "Caregiver file",
  appliesTo: ["newHire", "caregiver", "officeManager", "admin"],
  groups: [
    {
      key: "application",
      label: "Applications & identity",
      items: [
        {
          id: "jobApplication",
          label: "Employment application",
          note: "From the job application site, or a scan if they applied in person.",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "capsApplication",
          label: "CAPS application",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "homeCareApplication",
          label: "Home care application",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "photoId",
          label: "Photo identification",
          note: "Driver's licence, passport, or other government ID.",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "i9",
          label: "I-9 paperwork",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
      ],
    },
    {
      key: "vetting",
      label: "Vetting & background",
      // These four arrive by email, not by anyone filling in a form. They are
      // the reason the inbound review queue exists — and the reason it never
      // files automatically. A background check landing in the wrong person's
      // file is about the worst filing error available here.
      items: [
        {
          id: "referenceChecks",
          label: "Reference checks",
          note: "Copy, print or scan of the completed reference checks.",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "capsResult",
          label: "CAPS result",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "doraResult",
          label: "DORA result",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "cbiResult",
          label: "CBI result",
          note: "Colorado Bureau of Investigation background check.",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "everify",
          label: "E-Verify",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
      ],
    },
    {
      key: "packet",
      label: "New hire packet",
      // Every one of these already exists as a digital form. They can ALSO be
      // satisfied by an upload, which is how somebody who signed the packet on
      // paper gets a complete file without re-signing everything.
      items: [
        {
          id: "jobDescription",
          label: "Signed job description",
          note: "Homemaker, PCW or IHSS attendant — whichever applies to them.",
          satisfiedBy: {
            type: SATISFIED_BY.FORM,
            anyOf: ["homemakerJobDescription", "pcwJobDescription", "ihssAttendantJobDescription"],
          },
          required: true,
          renews: RENEWS.NEVER,
        },
        { id: "orientationChecklist", label: "Orientation / training checklist", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "orientationChecklist" }, required: true, renews: RENEWS.NEVER },
        { id: "caregiverAvailability", label: "Availability", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "caregiverAvailability" }, required: true, renews: RENEWS.NEVER },
        { id: "rulesOfTheRoad", label: "Rules of the road", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "rulesOfTheRoad" }, required: true, renews: RENEWS.NEVER },
        { id: "employeeHandbookAck", label: "Employee handbook acknowledgement", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "employeeHandbookAck" }, required: true, renews: RENEWS.NEVER },
        { id: "policiesReceipt", label: "Policies receipt", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "policiesReceipt" }, required: true, renews: RENEWS.NEVER },
        { id: "careScopeAndTasks", label: "Scope of care & allowed tasks", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "careScopeAndTasks" }, required: true, renews: RENEWS.NEVER },
        { id: "missedVisitsPolicy", label: "Missed visits policy", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "missedVisitsPolicy" }, required: true, renews: RENEWS.NEVER },
        { id: "fluVaccineStatement", label: "Influenza vaccine statement", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "fluVaccineStatement" }, required: true, renews: RENEWS.NEVER },
      ],
    },
    {
      key: "competency",
      label: "Competency & training",
      items: [
        {
          id: "skillsChecklist",
          label: "Skills checklist",
          note: "Personal care competency & skills validation.",
          satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "competencyValidation" },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "courseCertificates",
          label: "Course certificates",
          // NOT a fixed six. `all` means "however many the course site currently
          // offers" — so adding a seventh course automatically raises the bar
          // rather than silently leaving everyone short.
          note: "All current modules from the course site.",
          satisfiedBy: { type: SATISFIED_BY.CERTS, require: "all" },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "annualRecertification",
          label: "Annual recertification",
          note: "The same modules retaken each year. Lapses rather than vanishes.",
          satisfiedBy: { type: SATISFIED_BY.CERTS, require: "all" },
          required: true,
          renews: RENEWS.ANNUAL,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// CLIENT FILE
// ---------------------------------------------------------------------------

export const clientChecklist = {
  key: "client",
  label: "Client file",
  appliesTo: ["client"],
  groups: [
    {
      key: "atAGlance",
      label: "At a glance",
      items: [
        {
          id: "infoCard",
          label: "Info card",
          note: "Name, address, phone, email and the rest of the contact detail.",
          satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "eppClientInfo" },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "faceSheet",
          label: "Face sheet",
          // Not a document — a view. It reads allergies, DNR status and
          // emergency contacts back out of the filed forms, so it can't go
          // stale the way a typed-up copy would. Complete when the paperwork
          // it reads from is complete.
          note: "Allergies, DNR and emergency contacts, read live from the filed paperwork.",
          satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "clientAssessment" },
          required: true,
          renews: RENEWS.NEVER,
        },
      ],
    },
    {
      key: "admission",
      label: "Admission packet",
      items: [
        { id: "welcomeLetter", label: "Welcome letter", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "welcomeLetter" }, required: true, renews: RENEWS.NEVER },
        { id: "homeCareServicesAgreement", label: "Home care services agreement", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "homeCareServicesAgreement" }, required: true, renews: RENEWS.NEVER },
        { id: "clientAssessment", label: "Client assessment", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "clientAssessment" }, required: true, renews: RENEWS.NEVER },
        { id: "consumerRights", label: "Consumer rights", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "consumerRights" }, required: true, renews: RENEWS.NEVER },
        { id: "agencyDisclosure", label: "Agency disclosure", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "agencyDisclosure" }, required: true, renews: RENEWS.NEVER },
        { id: "consumerConfidentiality", label: "Consumer confidentiality", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "consumerConfidentiality" }, required: true, renews: RENEWS.NEVER },
        { id: "privacyPracticesNotice", label: "Notice of privacy practices", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "privacyPracticesNotice" }, required: true, renews: RENEWS.NEVER },
        { id: "advanceDirectivesNotice", label: "Advance directives notice", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "advanceDirectivesNotice" }, required: true, renews: RENEWS.NEVER },
        { id: "financialBillingNotice", label: "Financial & billing notice", satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "financialBillingNotice" }, required: true, renews: RENEWS.NEVER },
      ],
    },
    {
      key: "care",
      label: "Care & medical",
      items: [
        {
          id: "carePlan",
          label: "Care plan",
          satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "clientCarePlan" },
          required: true,
          renews: RENEWS.ANNUAL,
        },
        {
          id: "medicationList",
          label: "Medication list",
          note: "No digital form for this yet — upload until there is one.",
          satisfiedBy: { type: SATISFIED_BY.UPLOAD },
          required: true,
          renews: RENEWS.NEVER,
        },
        {
          id: "fallRisk",
          label: "Fall risk assessment",
          satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "fallRisk" },
          required: false,
          renews: RENEWS.ANNUAL,
        },
      ],
    },
    {
      key: "ongoing",
      label: "Ongoing",
      items: [
        {
          id: "supervisoryVisit",
          label: "Supervisory visits",
          // Files under the CLIENT, not the caregiver — the decision Rejane
          // made on the call and reversed herself on. The compliance question
          // is whether THIS PERSON was visited every 90 days.
          note: "Every 90 days. Files here, not under the caregiver.",
          satisfiedBy: { type: SATISFIED_BY.FORM, schemaKey: "supervisoryVisit" },
          required: true,
          renews: 3,
        },
      ],
    },
  ],
};

export const checklists = {
  caregiver: caregiverChecklist,
  client: clientChecklist,
};

/** Flatten a checklist to a plain list of items, each carrying its group. */
export function checklistItems(checklist) {
  if (!checklist) return [];
  return checklist.groups.flatMap((g) =>
    g.items.map((it) => ({ ...it, groupKey: g.key, groupLabel: g.label })),
  );
}

/** The checklist that applies to a person, by their role. */
export function checklistFor(subjectType) {
  return subjectType === "client" ? clientChecklist : caregiverChecklist;
}
