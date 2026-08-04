// New Hire Packet forms.
//
// SOURCE: "Dtc Forms/Dare to Care Home Care - New Hire Packet.pdf" (30 pages,
// 2026-07-27). That packet is authoritative and supersedes the older standalone
// "New Hire Paperwork.pdf" (22 pages, 2026-06-28).
//
// Policy bodies are transcribed from the packet rather than summarised, so the
// filed PDF shows the employee the same words they signed against.
//
// Two items from the packet are NOT here because they already exist as verified
// schemas in schemas.js: Workplace Violence Policy Acknowledgement (item 13) and
// Emergency Preparedness Plan (item 16). Item 18 is a list of confidential
// documents (W-4, I-9, E-Verify, CAPS, background check) handled outside the app.

const SIG = (id, label = "Employee Signature") => ({
  id, label, type: "signature", required: true,
  autofill: { source: "logged-in employee", from: "currentUser", confidence: 0.96, safe: false },
});
const DATE = (id, label = "Date") => ({
  id, label, type: "date", required: true,
  autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true },
});
const NAME = (id, label = "Employee Name") => ({
  id, label, type: "text", required: true,
  autofill: { source: "logged-in employee", from: "currentUser", confidence: 0.95, safe: true },
});

// ── Section 1 — Job Descriptions ───────────────────────────────────────────
// The packet notes: "Only the job description matching the new hire's assigned
// role needs to be signed — the others are for reference." They are therefore
// three separate assignable forms rather than one combined document.

export const homemakerJobDescription = {
  key: "homemakerJobDescription",
  name: "Homemaker Job Description",
  category: "Onboarding",
  version: 1,
  estMin: 4,
  icon: "home",
  description: "Non-medical household support — no hands-on personal care.",
  subject: "self",
  completedBy: ["newHire", "caregiver", "officeManager", "admin"],
  interpretation: {
    purpose: "Confirm the employee has read and accepted the Homemaker role and its limits.",
    cadence: "Once, at hire, for staff assigned to the Homemaker role",
  },
  sections: [
    {
      id: "hjd_body",
      title: "Homemaker Job Description",
      fields: [
        { id: "hjd_text", type: "policyText", label: "Homemaker Job Description",
          body:
            "Reports to: Supervisor\n\n" +
            "Job Summary\n" +
            "Responsible for providing care and services for agency clients, including routine light house cleaning, meal preparation, dishwashing, bed making and companionship.\n\n" +
            "Responsibilities\n" +
            "• Follow Agency policies and procedures.\n" +
            "• Perform duties under the supervision of the HCA Manager and designee.\n" +
            "• Provide non-medical homemaker services for assigned clients.\n" +
            "• Report any observed environmental concerns or changes in the consumer's status that may impact safety or security to the HCA.\n" +
            "• Complete appropriate service notes for each visit, including confirmation of services provided and time in/out, per HCA policy.\n" +
            "• Duties include routine light house cleaning, companionship, meal preparation, dishwashing, and bed making; teaching of tasks to the consumer; and assisting clients with activities outside the home, such as shopping or laundry.\n\n" +
            "Will NOT Perform\n" +
            "• Skilled home health services.\n" +
            "• Personal care services such as bathing, dressing, or shaving.\n" +
            "• Administering medications, lotions, etc.\n" +
            "• Household repairs or maintenance.\n" +
            "• Cutting fingernails or toenails of any client.\n\n" +
            "Qualifications\n" +
            "• High school diploma or GED required.\n" +
            "• 1+ years of relevant caregiving experience or related.\n" +
            "• Demonstrated ability to multi-task and prioritize tasks without guidance.\n" +
            "• Demonstrated ability to read, write, and speak English.\n" +
            "• Must be able to lift, pull, push, and carry 25 pounds; must be able to bend, twist, stoop, kneel, and reach.",
        },
      ],
    },
    {
      id: "hjd_ack",
      title: "Acknowledgement",
      fields: [
        { id: "hjd_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I, the undersigned, have read and understand the Homemaker Job Description and agree to perform the functions of the role." },
        ] },
        SIG("hjd_sig"),
        DATE("hjd_date"),
      ],
    },
  ],
};

export const pcwJobDescription = {
  key: "pcwJobDescription",
  name: "Personal Care Worker Job Description",
  category: "Onboarding",
  version: 1,
  estMin: 4,
  icon: "users",
  description: "Everything a Homemaker does, plus hands-on personal care tasks within state limits.",
  subject: "self",
  completedBy: ["newHire", "caregiver", "officeManager", "admin"],
  interpretation: {
    purpose: "Confirm the employee has read and accepted the Personal Care Worker role.",
    cadence: "Once, at hire, for staff assigned to the PCW role",
  },
  sections: [
    {
      id: "pjd_body",
      title: "Personal Care Worker Job Description",
      fields: [
        { id: "pjd_text", type: "policyText", label: "Personal Care Worker Job Description",
          body:
            "Reports to: Supervisor\n\n" +
            "Job Summary\n" +
            "Responsible for providing care and services for agency clients, including routine light house cleaning, meal preparation, dishwashing, bed making, and companionship. In addition, responsible for performing personal care tasks, including skin care, ambulation, bathing, dressing, and transfers.\n\n" +
            "Responsibilities\n" +
            "• Provide non-medical homemaker services for assigned clients, and all duties and responsibilities of the Homemaker position.\n" +
            "• Report any observed environmental concerns or changes in the consumer's status that may impact safety or security to the HCA.\n" +
            "• Complete appropriate service notes for each visit, including confirmation of services provided and time in/out, per HCA policy.\n" +
            "• Observe and maintain the home environment in accordance with the service plan to ensure the safety and security of the consumer.\n" +
            "• Report any observed or stated changes in the consumer's physical, cognitive, and/or developmental status.\n" +
            "• Assist with non-medical activities of daily living, personal care, and any other assignments included in the service plan.\n" +
            "• Perform duties outlined in 6 CCR 1011-1 Chapter 26, Section 7.4(F), including: skin care, ambulation, bathing, dressing, exercise, feeding, hair care, mouth care, nail care, positioning, shaving, toileting, transfers, medication assistance, respiratory care, accompaniment, protective oversight, and respite care.\n" +
            "• Other duties as assigned by the Supervisor.\n\n" +
            "Qualifications\n" +
            "• High school diploma or GED required.\n" +
            "• 1+ years of relevant caregiving experience or related.\n" +
            "• Demonstrated ability to multi-task and prioritize tasks without guidance.\n" +
            "• Demonstrated ability to read, write, and speak English.\n" +
            "• Must be able to lift, pull, push, and carry 25 pounds; must be able to bend, twist, stoop, kneel, and reach.\n" +
            "• Completed orientation and training, including competency evaluation.",
        },
      ],
    },
    {
      id: "pjd_ack",
      title: "Acknowledgement",
      fields: [
        { id: "pjd_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I, the undersigned, have read and understand the Personal Care Worker Job Description and agree to perform the functions of the role." },
        ] },
        SIG("pjd_sig"),
        DATE("pjd_date"),
      ],
    },
  ],
};

export const ihssAttendantJobDescription = {
  key: "ihssAttendantJobDescription",
  name: "IHSS Attendant / Personal Care Attendant Job Description",
  category: "Onboarding",
  version: 1,
  estMin: 6,
  icon: "shield",
  description: "The IHSS-specific PCW role, including delegated health maintenance activities under RN direction.",
  subject: "self",
  completedBy: ["newHire", "caregiver", "officeManager", "admin"],
  interpretation: {
    purpose: "Confirm the employee has read and accepted the IHSS Attendant role, including delegated health maintenance.",
    cadence: "Once, at hire, for staff assigned to IHSS clients",
  },
  sections: [
    {
      id: "ijd_body",
      title: "IHSS Attendant / Personal Care Attendant Job Description",
      fields: [
        { id: "ijd_text", type: "policyText", label: "Position Details & Summary",
          body:
            "Company: Dare to Care Home Care\n" +
            "Location: Aurora and surrounding service areas\n" +
            "Employment Type: Full-Time, Part-Time, PRN/As Needed\n" +
            "Reports To: RN Supervisor and Agency Administrator\n" +
            "Pay Range: Based on experience, client assignment, and payer source eligibility.\n\n" +
            "Position Summary\n" +
            "The IHSS Attendant provides non-medical personal care, health maintenance, and supportive services to clients in their homes to help them maintain independence, dignity, safety, and quality of life. Services are provided in accordance with the client's authorized care plan, agency policies, state regulations, and Medicaid program requirements. The IHSS Attendant works under the supervision of the agency's Registered Nurse and administrative staff and is responsible for reporting changes in the client's condition or environment promptly.",
        },
        { id: "ijd_duties", type: "policyText", label: "Responsibilities",
          body:
            "Personal Care Assistance\n" +
            "Bathing, grooming, and personal hygiene; dressing and undressing; toileting and incontinence care; oral care and skin care; assistance with transfers, positioning, and ambulation; mobility assistance and fall prevention support.\n\n" +
            "Health Maintenance Activities (under RN direction)\n" +
            "Medication reminders and assistance with self-administration as permitted; assistance with prescribed exercises and range-of-motion activities; assistance with medical equipment and assistive devices; observation and reporting of changes in condition; monitoring and documenting vital signs when delegated and trained; preventive skin care and pressure relief measures; delegated routine health maintenance tasks authorized in the care plan; reinforcement of health education from licensed professionals; immediate reporting of concerns to the RN Supervisor.\n\n" +
            "Homemaker Services\n" +
            "Light housekeeping (sweeping/mopping, laundry and linens, dishwashing, cleaning bathrooms/kitchens, taking out trash); maintaining a clean and safe environment.\n\n" +
            "Nutrition Support\n" +
            "Meal preparation per preferences/restrictions; feeding assistance when authorized; encouraging adequate hydration and nutrition.\n\n" +
            "Medication Assistance\n" +
            "Reminders as permitted by regulation and policy; observing and reporting side effects or concerns.\n\n" +
            "Observation and Reporting\n" +
            "Monitoring and reporting changes in physical condition, mental status, behavior, safety concerns, and home environment concerns; reporting incidents, injuries, falls, or emergencies immediately.\n\n" +
            "Documentation\n" +
            "Completing all required visit documentation accurately and timely; recording services provided each shift; submitting timesheets and visit records per policy; documenting delegated health maintenance activities.",
        },
        { id: "ijd_quals", type: "policyText", label: "Qualifications, Physical Requirements & Competencies",
          body:
            "Qualifications\n" +
            "• Minimum age of 18 years.\n" +
            "• High school diploma or GED preferred.\n" +
            "• Ability to read, write, and communicate effectively in English.\n" +
            "• Ability to follow written and verbal instructions.\n" +
            "• Ability to maintain client confidentiality and professionalism.\n" +
            "• Ability to pass background screening as required by state regulations.\n" +
            "• Valid driver's license and reliable transportation preferred.\n" +
            "• Current CPR and First Aid certification preferred.\n" +
            "• Preferred: previous experience in home care or healthcare settings; experience with elderly clients, individuals with disabilities, or chronic conditions; CNA certification preferred but not required; completion of agency-approved Health Maintenance Activity training preferred.\n\n" +
            "Physical Requirements\n" +
            "• Lift, transfer, push, and pull up to 50 pounds with assistance.\n" +
            "• Stand, walk, bend, kneel, stoop, and reach for extended periods.\n" +
            "• Safely perform transfers and mobility assistance using proper body mechanics.\n" +
            "• Safely assist with delegated health maintenance activities and assistive equipment.\n" +
            "• Work in a variety of home environments.\n\n" +
            "Required Competencies\n" +
            "• Compassion and respect for clients.\n" +
            "• Dependability and punctuality.\n" +
            "• Professional communication.\n" +
            "• Good judgment and problem-solving.\n" +
            "• Ability to work independently.\n" +
            "• Confidentiality and HIPAA adherence.\n" +
            "• Commitment to client rights, dignity, and person-centered care.\n\n" +
            "Work Environment\n" +
            "Client homes and community settings; may encounter pets, stairs, varying temperatures, and household conditions.\n\n" +
            "Equal Opportunity\n" +
            "Dare to Care Home Care is an equal opportunity employer and does not discriminate based on race, color, religion, sex, national origin, age, disability, veteran status, or any other protected status.",
        },
      ],
    },
    {
      id: "ijd_ack",
      title: "Acknowledgement",
      fields: [
        { id: "ijd_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I, the undersigned, have read and understand the IHSS Attendant / Personal Care Attendant Job Description and agree to perform the functions of the role." },
        ] },
        NAME("ijd_name"),
        SIG("ijd_sig"),
        DATE("ijd_date"),
      ],
    },
  ],
};

// ── Section 5 — Competency Validation ──────────────────────────────────────
// Packet pages 27-29. This is the gate on working unsupervised, so it is the
// single most consequential form in the packet.
//
// The paper form is a grid: ~30 skills x (Observation Date | Competent |
// Comments). Rendering 90 inputs on a phone is unusable, and a repeating "add a
// row" table would let an evaluator silently skip skills - the opposite of what
// a competency check is for. Instead every skill is listed as a checkbox, so
// what has NOT been validated is visible at a glance, with an observation date
// and comments per skill group. Unchecked means "not yet validated", which is
// exactly the question this form exists to answer.
export const competencyValidation = {
  key: "competencyValidation",
  name: "Personal Care Competency & Skills Validation",
  category: "Onboarding",
  version: 1,
  estMin: 15,
  icon: "checkCircle",
  description: "Hands-on skills sign-off, task by task, before a caregiver works unsupervised.",
  subject: "self",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Record that an evaluator observed each skill performed safely and correctly.",
    cadence: "At hire, before working unsupervised; repeat if competency is in question",
  },
  sections: [
    {
      id: "cv_who",
      title: "Employee & evaluator",
      fields: [
        NAME("cv_employee"),
        DATE("cv_date"),
        { id: "cv_evaluator", label: "Supervisor / Evaluator Name", type: "text", required: true,
          autofill: { source: "logged-in user", from: "currentUser", confidence: 0.95, safe: true } },
      ],
    },
    {
      id: "cv_personal",
      title: "Personal care & household skills",
      fields: [
        { id: "cv_personal_note", type: "policyText", label: "How to complete this",
          body: "Check each skill only after observing the employee perform it safely and correctly. Anything left unchecked is treated as not yet validated." },
        { id: "cv_personal_obs_date", label: "Observation Date", type: "date", required: true },
        { id: "cv_bathing", label: "Bathing", type: "checkbox", required: false, options: [
          { label: "Bed Bath" }, { label: "Tub / Shower" }, { label: "Sponge Bath" },
        ] },
        { id: "cv_dressing", label: "Dressing", type: "checkbox", required: false, options: [
          { label: "Dressing Assistance" },
        ] },
        { id: "cv_bedmaking", label: "Bed Making", type: "checkbox", required: false, options: [
          { label: "Bed Making" },
        ] },
        { id: "cv_hair", label: "Hair Care", type: "checkbox", required: false, options: [
          { label: "Tub / Shower" }, { label: "Bed" },
        ] },
        { id: "cv_oral", label: "Oral Care", type: "checkbox", required: false, options: [
          { label: "Denture Care" }, { label: "Toothbrush" },
        ] },
        { id: "cv_nail", label: "Nail Care", type: "checkbox", required: false, options: [
          { label: "Filing" }, { label: "Cleaning" },
        ] },
        { id: "cv_shaving", label: "Shaving", type: "checkbox", required: false, options: [
          { label: "Electric" }, { label: "Safety Razor" },
        ] },
        { id: "cv_ambulation", label: "Ambulation", type: "checkbox", required: false, options: [
          { label: "Crutches" }, { label: "Walker" }, { label: "Cane" }, { label: "Gait Belt" },
        ] },
        { id: "cv_infection", label: "Infection Control", type: "checkbox", required: false, options: [
          { label: "Handwashing / Hygiene" },
        ] },
        { id: "cv_personal_comments", label: "Comments", type: "textarea", required: false },
      ],
    },
    {
      id: "cv_health",
      title: "Health maintenance & safety skills",
      fields: [
        { id: "cv_health_obs_date", label: "Observation Date", type: "date", required: true },
        { id: "cv_gloves", label: "Gloves", type: "checkbox", required: false, options: [
          { label: "Don / Doff" }, { label: "Proper Use" },
        ] },
        { id: "cv_toileting", label: "Urinal / Commode / Bed Pan", type: "checkbox", required: false, options: [
          { label: "Incontinence Care" }, { label: "Proper Placement" },
        ] },
        { id: "cv_catheter", label: "Catheter Care", type: "checkbox", required: false, options: [
          { label: "Perineal Care" }, { label: "Empty Bag" },
        ] },
        { id: "cv_positioning", label: "Positioning", type: "checkbox", required: false, options: [
          { label: "Bed" }, { label: "Chair" },
        ] },
        { id: "cv_transfers", label: "Transfers", type: "checkbox", required: false, options: [
          { label: "Hoyer" }, { label: "Gait Belt" },
        ] },
        { id: "cv_other_skills", label: "Additional skills", type: "checkbox", required: false, options: [
          { label: "Nutrition & Hydration" },
          { label: "Medication Reminders" },
          { label: "Safety & Hazards" },
          { label: "Privacy & Dignity" },
        ] },
        { id: "cv_health_comments", label: "Comments", type: "textarea", required: false },
      ],
    },
    {
      id: "cv_signoff",
      title: "Evaluator sign-off",
      fields: [
        { id: "cv_statement", type: "policyText", label: "Validation statement",
          body: "Competency is validated when the employee demonstrates the skill safely and correctly, as observed and confirmed by the supervising evaluator on the date noted." },
        { id: "cv_sup_sig", label: "Supervisor Signature", type: "signature", required: true,
          autofill: { source: "logged-in user", from: "currentUser", confidence: 0.96, safe: false } },
        DATE("cv_sup_date"),
      ],
    },
  ],
};

// ── Section 2 — Onboarding & Availability ──────────────────────────────────

export const orientationChecklist = {
  key: "orientationChecklist",
  name: "Orientation / Training Checklist Sign-Off",
  category: "Onboarding",
  version: 1,
  estMin: 8,
  icon: "checkCircle",
  description: "Running sign-off confirming each orientation topic and document was covered.",
  subject: "self",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Evidence that required orientation topics were delivered and documents handed over.",
    cadence: "Once, at hire",
  },
  sections: [
    {
      id: "oc_who",
      title: "Employee",
      fields: [
        NAME("oc_name"),
        { id: "oc_position", label: "Position", type: "text", required: true },
        { id: "oc_hire_date", label: "Date of Hire", type: "date", required: true },
      ],
    },
    {
      id: "oc_welcome",
      title: "Welcome to our company",
      fields: [
        { id: "oc_welcome_items", label: "Topics covered", type: "checkbox", required: false, options: [
          { label: "Company History / Mission" },
          { label: "Picture / Name Badge / Dress Code" },
          { label: "Organizational Chart and Caregiver Supervision" },
          { label: "Homemaker / Personal Care Worker Job Description, Duties & Responsibilities" },
        ] },
        { id: "oc_roles_text", type: "policyText", label: "Role summaries covered",
          body:
            "Homemaker: routine light house cleaning, meal preparation, dishwashing, bed making, assistance completing activities outside the home such as shopping or laundry, companionship, and encouragement of reading, writing, and activities that stimulate the mind.\n\n" +
            "Personal Care Worker: assistance with non-medical activities of daily living, personal care, bathing, skin care, hair care, nail care, mouth care, shaving, dressing, feeding, assistance with ambulation, exercises and transfers, positioning, bladder care, bowel care, medication reminders, and protective oversight.",
        },
      ],
    },
    {
      id: "oc_training",
      title: "Training topics",
      fields: [
        { id: "oc_training_items", label: "Training topics covered", type: "checkbox", required: false, options: [
          { label: "Description and scope of agency services." },
          { label: "Differences between personal care, nurse aide, and health care in the home." },
          { label: "Behavior management techniques and the promotion of consumer dignity, independence, self-determination, choice, and rights, including abuse and neglect prevention and reporting requirements." },
          { label: "Disaster and emergency procedures." },
          { label: "Infection control using universal precautions." },
          { label: "Basic first aid and home safety." },
          { label: "Personal care training and observation." },
          { label: "Assistance with non-medical activities of daily living, personal care, bathing, skin care, hair care, nail care, mouth care, shaving, dressing, feeding, assistance with ambulation, exercises and transfers, positioning, bladder care, bowel care, medication reminders, and protective oversight." },
        ] },
      ],
    },
    {
      id: "oc_docs",
      title: "Documents provided",
      fields: [
        { id: "oc_docs_items", label: "Documents provided", type: "checkbox", required: false, options: [
          { label: "Employee Handbook" },
          { label: "Enrollment / Orientation in EMR Software" },
          { label: "Payroll / Direct Deposit Enrollment" },
          { label: "401(k) / PTO / Time-Off Requests / Attendance" },
          { label: "Dress Code" },
          { label: "Client Confidentiality / Personal Information / HIPAA" },
          { label: "Client In-Home Binder — Client Care Plan, Incident Report, Care Plan Notes, Communication Log" },
        ] },
      ],
    },
    {
      id: "oc_sign",
      title: "Acknowledgement",
      fields: [
        { id: "oc_ack", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I have received the above orientation on the topics listed above." },
        ] },
        SIG("oc_sig"),
        DATE("oc_date"),
      ],
    },
  ],
};

export const caregiverAvailability = {
  key: "caregiverAvailability",
  name: "Caregiver Availability & Emergency Contact Information",
  category: "Onboarding",
  version: 1,
  estMin: 6,
  icon: "clock",
  description: "Contact info, allergies, and weekly availability used for scheduling.",
  subject: "self",
  completedBy: ["newHire", "caregiver", "officeManager", "admin"],
  interpretation: {
    purpose: "Capture scheduling availability and emergency contact details.",
    cadence: "At hire, and whenever availability changes",
  },
  sections: [
    {
      id: "ca_contact",
      title: "Contact information",
      fields: [
        { id: "ca_note", type: "policyText", label: "Please print clearly",
          body: "This information is used for scheduling and emergency contact." },
        NAME("ca_name", "Employee Full Name"),
        DATE("ca_date"),
        { id: "ca_address", label: "Address", type: "text", required: true },
        { id: "ca_email", label: "Email Address", type: "text", required: true },
        { id: "ca_cell", label: "Cell Phone", type: "text", required: true },
        { id: "ca_home_phone", label: "Home Phone", type: "text", required: false },
        { id: "ca_allergies", label: "Allergies (including pets, smoking)", type: "textarea", required: false },
      ],
    },
    {
      id: "ca_emergency",
      title: "Emergency contact",
      fields: [
        { id: "ca_ec_name", label: "Emergency Contact Name", type: "text", required: true },
        { id: "ca_ec_rel", label: "Relationship", type: "text", required: true },
        { id: "ca_ec_phone", label: "Phone", type: "text", required: true },
        { id: "ca_ec_address", label: "Address, if different", type: "text", required: false },
      ],
    },
    {
      id: "ca_availability",
      title: "Availability",
      fields: [
        { id: "ca_hours_wanted", label: "Hours wanting / week", type: "text", required: false },
        // The paper grid is AM/PM/Overnights x Mon-Sun. Captured as one checkbox
        // group per period so the same information survives on a phone.
        { id: "ca_am", label: "Available — AM", type: "checkbox", required: false, options: [
          { label: "Mon" }, { label: "Tue" }, { label: "Wed" }, { label: "Thu" }, { label: "Fri" }, { label: "Sat" }, { label: "Sun" },
        ] },
        { id: "ca_pm", label: "Available — PM", type: "checkbox", required: false, options: [
          { label: "Mon" }, { label: "Tue" }, { label: "Wed" }, { label: "Thu" }, { label: "Fri" }, { label: "Sat" }, { label: "Sun" },
        ] },
        { id: "ca_overnight", label: "Available — Overnights", type: "checkbox", required: false, options: [
          { label: "Mon" }, { label: "Tue" }, { label: "Wed" }, { label: "Thu" }, { label: "Fri" }, { label: "Sat" }, { label: "Sun" },
        ] },
        { id: "ca_comments", label: "Comments on availability", type: "textarea", required: false },
        { id: "ca_bilingual", label: "Are you bilingual?", type: "radio", required: false, options: [{ label: "No" }, { label: "Yes" }] },
        { id: "ca_bilingual_lang", label: "If yes, which languages?", type: "text", required: false },
        { id: "ca_nights", label: "Interested in night shifts?", type: "radio", required: false, options: [{ label: "Yes" }, { label: "No" }] },
        { id: "ca_transport", label: "Reliable transportation to and from client homes?", type: "radio", required: true, options: [{ label: "Yes" }, { label: "No" }] },
      ],
    },
    {
      id: "ca_sign",
      title: "Signature",
      fields: [
        SIG("ca_sig", "Applicant Signature"),
        DATE("ca_sig_date"),
      ],
    },
  ],
};

// ── Section 3 — Policies, Rules & Acknowledgements ─────────────────────────

export const rulesOfTheRoad = {
  key: "rulesOfTheRoad",
  name: "Caregiver Rules of the Road",
  category: "Policy",
  version: 1,
  estMin: 6,
  icon: "alert",
  description: "Day-to-day conduct expectations agreed to for every shift.",
  subject: "self",
  completedBy: ["newHire", "caregiver", "officeManager", "admin"],
  interpretation: {
    purpose: "Confirm the caregiver has read and agreed to shift conduct rules.",
    cadence: "At hire",
  },
  sections: [
    {
      id: "rr_body",
      title: "Caregiver Rules of the Road",
      fields: [
        { id: "rr_text", type: "policyText", label: "Caregivers are expected to follow the policies below for every shift.",
          body:
            "Arrive on Time — Plan to arrive 5 minutes early — 10 minutes early for a meet-and-greet with a new client. If running late, call the office, not the client directly. Chronic lateness is not tolerated; tardies are tracked and addressed with coaching and/or progressive discipline.\n\n" +
            "Accepting & Working Shifts — Once you accept a shift, you are responsible for showing up on time. Only an Office Staff Member can cancel a shift. Not showing up without office confirmation is a \"No Call No Show\" and considered voluntary resignation. All shift changes go through the office, never directly with clients.\n\n" +
            "Calling Off a Shift — Emergencies happen, but you must still call off through the office to prevent client abandonment. Multiple last-minute call-offs are treated as a No Call No Show and considered voluntary resignation.\n\n" +
            "Care Plans — Know your client's care plan before every shift. Check for updates with your assigned login, and confirm a printed care plan is in the home. Notify the office immediately if one is missing or outdated.\n\n" +
            "Email & Communications — Payroll updates, required trainings, mandatory meetings, and shift offers are often sent by email or text. Check and respond to office communications regularly.\n\n" +
            "Weekend Hours — All caregivers share in a weekend coverage rotation. It is not acceptable to be unavailable every weekend.\n\n" +
            "Dress Code — Clean, neat, professional attire: matching scrubs, or collared tops/blouses with long slacks or khakis in black or white. Scrubs required for personal care shifts. No jeans, tank tops, low-cut/see-through tops, or shorts. Closed-toe shoes only — no sandals or flip-flops. No strong perfumes; minimal jewelry; hair clean and conservatively styled.\n\n" +
            "Name Badges — Must be worn on duty at all times.\n\n" +
            "Be Professional — Represent the agency respectfully and capably at all times, first and foremost as an employee of Dare to Care Home Care.\n\n" +
            "Support the Office — Raise concerns or disagreements directly with your supervising Office Staff Member, never with or in front of clients, families, or other caregivers.\n\n" +
            "Client Privacy — No caregiver family, friends, or pets may visit a client's home, and clients may never be brought to a caregiver's home. If getting a ride to work, ask to be dropped off a block away, not at the client's door.\n\n" +
            "Professional Boundaries — Do not share personal financial, political, or religious information with clients. No off-shift contact with clients or families. No gifts or money accepted from clients. Violations may result in discipline up to termination.\n\n" +
            "No Client Transport — Caregivers may not transport clients in a personal or agency vehicle for any reason. This is a firm liability policy. If a client needs transportation, contact the office to arrange it.",
        },
      ],
    },
    {
      id: "rr_ack",
      title: "Agreement",
      fields: [
        { id: "rr_ack_box", label: "Agreement", type: "checkbox", required: true, options: [
          { label: "I agree to follow these Caregiver Rules of the Road." },
        ] },
        SIG("rr_sig"),
        DATE("rr_date"),
      ],
    },
  ],
};

export const employeeHandbookAck = {
  key: "employeeHandbookAck",
  name: "Acknowledgment of Receipt of Employee Handbook",
  category: "Policy",
  version: 1,
  estMin: 3,
  icon: "fileText",
  description: "Confirms receipt of the Employee Handbook and the at-will employment relationship.",
  subject: "self",
  completedBy: ["newHire", "caregiver", "officeManager", "admin"],
  interpretation: {
    purpose: "Evidence the employee received the handbook and understands at-will employment.",
    cadence: "At hire, and on handbook revision",
  },
  sections: [
    {
      id: "eh_body",
      title: "Acknowledgement statement",
      fields: [
        { id: "eh_atwill", type: "policyText", label: "At-will employment",
          body: "At-will employment: either Dare to Care Home Care or the employee may terminate the relationship at any time, with or without cause or notice." },
        { id: "eh_text", type: "policyText", label: "Acknowledgement Statement",
          body:
            "The Employee Handbook contains important information about Dare to Care Home Care, and I understand that I should consult my supervisor regarding any questions not answered in the handbook. I have entered into my employment relationship with the Company voluntarily and understand that there is no specified length of employment. Accordingly, either Dare to Care Home Care or I can terminate the relationship at will, at any time, with or without cause, and with or without advance notice.\n\n" +
            "Since the information, policies, and benefits described in this handbook are subject to change at any time, I acknowledge that revisions to the handbook may occur, except to the Company's policy of employment-at-will. All such changes will generally be communicated through official notices, and I understand that revised information may supersede, modify, or eliminate existing policies.\n\n" +
            "Furthermore, I understand that this handbook is neither a contract of employment nor a legally binding agreement.",
        },
      ],
    },
    {
      id: "eh_ack",
      title: "Acknowledgement",
      fields: [
        { id: "eh_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I received a copy of the Employee Handbook on the date indicated below. I understand that I am expected to read the entire handbook." },
        ] },
        NAME("eh_name"),
        SIG("eh_sig"),
        DATE("eh_date"),
      ],
    },
  ],
};

export const policiesReceipt = {
  key: "policiesReceipt",
  name: "Receipt of Policies and Procedures",
  category: "Policy",
  version: 1,
  estMin: 5,
  icon: "fileText",
  description: "Sign-off confirming agency orientation covered all required regulatory topics.",
  // Signed by the agency staff member who delivered orientation, but it is
  // evidence about the employee, so it files on the employee's record.
  subject: "self",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Record that all 15 regulatory orientation topics were covered and handouts provided.",
    cadence: "Once, at hire",
  },
  sections: [
    {
      id: "pr_body",
      title: "Topics covered during orientation",
      fields: [
        { id: "pr_text", type: "policyText", label: "Staff member completed agency Orientation. Below are topics covered during Orientation:",
          body:
            "(1) Employee duties and responsibilities.\n" +
            "(2) A description of the services provided by the agency.\n" +
            "(3) The differences in personal care, nurse aide care, and health care in the home, including limiting factors for the provision of personal care.\n" +
            "(4) Consumer rights, including freedom from abuse or neglect, and confidentiality of consumer records, personal, financial, and health information.\n" +
            "(5) Hand washing and infection control.\n" +
            "(6) Assignment and supervision of services.\n" +
            "(7) Observation, reporting, and documentation of consumer status and the service furnished.\n" +
            "(8) Emergency response policies and emergency contact numbers for the agency and for the individual consumer assigned.\n" +
            "(9) Training and competency evaluation of appropriate and safe techniques in all personal care tasks for each assigned task, conducted before completion of initial training.\n" +
            "(10) Communication skills with consumers such as those who have a hearing deficit, dementia, or other special needs.\n" +
            "(11) Appropriate training in accordance with the needs of special needs populations served by the agency, including communication and behavior management techniques.\n" +
            "(12) Appropriate and safe techniques in personal care tasks prior to assignment, including bathing, skin care, hair care, nail care, mouth care, shaving, dressing, feeding, assistance with ambulation, exercises and transfers, positioning, bladder care, bowel care, medication reminding, homemaking tasks, and protective oversight.\n" +
            "(13) Recognizing emergencies and knowledge of emergency procedures including basic first aid, home and fire safety.\n" +
            "(14) The role of, and coordination with, other community service providers.\n" +
            "(15) Maintenance of a clean, safe, and healthy environment, including appropriate cleaning techniques and sanitary meal preparation.",
        },
        { id: "pr_handouts", type: "policyText", label: "Policies and handouts reviewed and provided",
          body:
            "Personal Care Worker Job Description; Types of Services Provided by the Agency; Differences Between Personal Care, Nurse Aide Care and Health Care in the Home; Direct Care Allowed and Non-Allowed Tasks; Written Notice of Home Care Consumer Rights; Infection Control Policy; Hand Washing Return Demonstration Checklist; Personal Care Worker Qualifications, Assignment & Supervision Policy; Consumer Service Visit Log; Emergency Contact Numbers; Personal Care Worker Competency Evaluation; Effective Communication with Our Senior Population; Effective Communication Strategies; Understanding and Responding to Dementia-Related Behavior; Appropriate and Safe Techniques for Personal Care Tasks; Emergency Preparedness Plan; Basic First Aid Training Agenda; Home & Fire Safety Training Agenda; A Clean, Safe and Healthy Home Training Agenda.",
        },
      ],
    },
    {
      id: "pr_sign",
      title: "Agency sign-off",
      fields: [
        { id: "pr_employee", label: "Employee Name", type: "text", required: true },
        { id: "pr_sig", label: "Agency Staff Signature", type: "signature", required: true,
          autofill: { source: "logged-in user", from: "currentUser", confidence: 0.96, safe: false } },
        DATE("pr_date"),
      ],
    },
  ],
};

// Packet items 9 and 10 are listed separately in the table of contents but are a
// single continuous document in the packet body (pages 16-18) ending in one
// signature, so they are one form here.
export const careScopeAndTasks = {
  key: "careScopeAndTasks",
  name: "Differences Between Care Types & Direct Care Allowed/Non-Allowed Tasks",
  category: "Policy",
  version: 1,
  estMin: 10,
  icon: "shield",
  description: "Where a Personal Care Worker's scope ends and skilled home health begins.",
  subject: "self",
  completedBy: ["newHire", "caregiver", "officeManager", "admin"],
  interpretation: {
    purpose: "Confirm the caregiver understands scope limits and which tasks require skilled home health.",
    cadence: "At hire",
  },
  sections: [
    {
      id: "cs_diff",
      title: "Differences between personal care, nurse aide care and health care",
      fields: [
        { id: "cs_intro", type: "policyText", label: "Agency scope",
          body:
            "Dare to Care Home Care recognizes that there are differences in personal care, nurse aide care, and health care in the home, including limiting factors for the provision of personal care. The agency holds a Class B License from the Colorado Department of Public Health and Environment and is able to provide only personal care services — not skilled healthcare services.",
        },
        { id: "cs_cna", type: "policyText", label: "CNA compared with Personal Care Worker",
          body:
            "Education & Training — CNA: Requires a GED or high school diploma, plus a specific training program generally consisting of 75 to 100 hours of course instruction. Personal Care Worker: Typically requires a GED or high school diploma. There is no formalized certification program; qualifies for employment through experience providing non-medical services.\n\n" +
            "Certification — CNA: Must qualify for a certification exam organized by an approved learning institution and pass a certified test to obtain a state CNA license, renewed on an ongoing basis. Personal Care Worker: There is no state-certified license for personal care workers.\n\n" +
            "Job Duties — CNA: Offers fundamental basic medical care, typically under the direction of RNs or LPNs — vital signs, medication equipment, surgery prep, transfers, activities of daily living, showers, etc. Personal Care Worker: Performs non-medical tasks for consumers who typically require less care. Does not perform medical tasks and is not under the direction of medical personnel.\n\n" +
            "Typical duties that can be performed by Personal Care Workers include activities of daily living: bathing, skin care, hair care, nail care, mouth care, shaving, dressing, feeding, assistance with ambulation, exercises and transfers, positioning, bladder care, bowel care, medication reminders, and protective oversight.\n\n" +
            "If a consumer is experiencing a change of condition where skilled home health services might be needed, the Personal Care Worker is to contact the agency office to discuss the change in condition. Agency staff will discuss the consumer's needs and provide instruction to the personal care worker, as well as discuss any needed changes with the consumer by phone, email, or in person.",
        },
      ],
    },
    {
      id: "cs_tasks",
      title: "Direct care allowed and non-allowed tasks",
      fields: [
        { id: "cs_tasks_text", type: "policyText", label: "Task-by-task scope",
          body:
            "1. Skin Care — May: general assistance when skin is unbroken and chronic problems are not active; preventative, non-medicated lotions/solutions only. Requires skilled home health: wound care beyond basic first aid, dressing changes, prescription medication application, skilled observation/reporting.\n\n" +
            "2. Ambulation — May: assist when the consumer can balance and bear weight, including with an assistive device the consumer is independent with.\n\n" +
            "3. Bathing — May: assist when the consumer can balance and bear weight (except lift-device transfers). Requires skilled: consumers with skilled skin care or dressing needs before, during, or after bathing.\n\n" +
            "4. Dressing — May: ordinary clothing and support stockings (ace bandages, non-prescription anti-embolic/pressure stockings) after training and an annual competency evaluation.\n\n" +
            "5. Exercise — May: encourage normal bodily movement; remind the consumer to perform ordered exercise. Requires skilled: prescribed exercise plans or passive range of motion.\n\n" +
            "6. Feeding — May: assist when the consumer can chew/swallow independently and sit upright. Requires skilled: syringe/tube feeding, IV nutrition, or high choking risk.\n\n" +
            "7. Hair Care — May: shampooing, drying, combing, styling; OTC medicated shampoo only with training and annual competency evaluation. Requires skilled: prescription shampoo.\n\n" +
            "8. Mouth Care — May: denture care and basic oral hygiene. Requires skilled: consumers who are unconscious, have difficulty swallowing, or are at risk of choking/aspiration.\n\n" +
            "9. Nail Care — May: soaking nails, pushing back cuticles without utensils, filing nails. Requires skilled: nail trimming; consumers with circulatory problems or loss of sensation.\n\n" +
            "10. Positioning — May: simple alignment in bed/wheelchair/furniture when the consumer can indicate a change is needed. Requires skilled: positioning tied to skilled skin care concerns; may not be independently assigned.\n\n" +
            "11. Shaving — May: electric or safety razor only.\n\n" +
            "12. Toileting — May: to/from bathroom, bedpans/urinals/commodes, pericare, incontinence care, emptying urinary/ostomy bags (absent skilled skin needs). Requires skilled: catheter insertion/removal, external catheter care, digital stimulation, suppositories, enemas.\n\n" +
            "13. Transfers — May: when the consumer can stand, pivot, and assist; trained use of adaptive equipment (wheelchairs, tub seats, grab bars, gait belts); lift-device transfers only with demonstrated competency. Requires skilled: transfers where the consumer cannot assist at all.\n\n" +
            "14. Medication Assistance — May: reminders only, for medications pre-selected and stored in a marked medication minder; report irregularities immediately. Requires skilled: medication set-up / pre-selection.\n\n" +
            "15. Respiratory Care — May: temporarily remove/replace a cannula or mask for shaving/washing the face; set oxygen flow when changing tanks per written instruction if trained and competency-demonstrated. Requires skilled: postural drainage, cupping, adjusting oxygen flow within parameters, nasal/endotracheal/tracheal suctioning.\n\n" +
            "16. Accompaniment — May: medical appointments, banking, errands, shopping when all related care is unskilled personal care.\n\n" +
            "17. Protective Oversight — May: stand-by assistance with personal care tasks; wandering-prevention workers must be trained in intervention/redirection techniques.\n\n" +
            "18. Respite Care — May: in the consumer's home per the service plan. Requires skilled: any respite involving skilled home health services.\n\n" +
            "In addition, the agency shall not allow personal care workers to:\n" +
            "• Perform skilled home health services per agency policy.\n" +
            "• Perform or provide medication set-up for a consumer.\n" +
            "• Perform other actions specifically prohibited by agency policy, regulations, or law.",
        },
      ],
    },
    {
      id: "cs_ack",
      title: "Acknowledgement",
      fields: [
        { id: "cs_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I have read and understand the differences between personal care, nurse aide care and health care in the home, and the direct care tasks I am and am not allowed to perform." },
        ] },
        SIG("cs_sig"),
        DATE("cs_date"),
      ],
    },
  ],
};

export const missedVisitsPolicy = {
  key: "missedVisitsPolicy",
  name: "Missed Visits Policy",
  category: "Policy",
  version: 1,
  estMin: 3,
  icon: "alert",
  description: "What happens, and who gets called, when a scheduled visit is missed. 6 CCR 1011-1 Chapter 26, 5.14.",
  subject: "self",
  completedBy: ["newHire", "caregiver", "officeManager", "admin", "client"],
  interpretation: {
    purpose: "Confirm understanding of missed-visit notification and back-up coverage rules.",
    cadence: "At hire",
  },
  sections: [
    {
      id: "mv_body",
      title: "Missed Visits Policy",
      fields: [
        { id: "mv_text", type: "policyText", label: "Missed Visits Policy",
          body:
            "Dare to Care Home Care shall have a mechanism for informing the consumer about scheduled visits in accordance with Dare to Care Home Care policy. Documentation shall be maintained and alterations in the schedule shall be provided to the consumer in advance of any changes, where possible related to an employee call-off.\n\n" +
            "If you must miss a scheduled visit: notify the agency at least two hours before the scheduled visit by calling your immediate supervisor.\n\n" +
            "Dare to Care Home Care's policy shall address processes for planning coverage of personnel illness, vacation, holidays, and unexpected voluntary or involuntary termination of employment.\n\n" +
            "Consumer and Care Providers\n" +
            "If the consumer does not respond to let personnel in the home for at least two hours of the scheduled visit, Dare to Care Home Care's attempts to ensure the safety of the consumer and the outcome of each attempt shall be documented.\n\n" +
            "If There Is a Missed Visit\n" +
            "Services missed shall be provided as agreed upon by the consumer and Dare to Care Home Care.\n\n" +
            "If Dare to Care Home Care admits consumers with needs that require care or services to be delivered at specific times or parts of the day, the agency shall ensure qualified personnel in sufficient quantity are employed, or have other effective back-up plans, to ensure the needs of the consumer are met.\n\n" +
            "The back-up plan for scheduled services that cannot be delivered shall not include calling for an ambulance or other emergency services unless emergency services would have been warranted even if the scheduled personnel had been in the home and had delivered services.\n\n" +
            "Reference: 6 CCR 1011-1 Chapter 26, 5.14",
        },
      ],
    },
    {
      id: "mv_ack",
      title: "Acknowledgement",
      fields: [
        { id: "mv_name", label: "Employee or Client Name", type: "text", required: true },
        { id: "mv_sig", label: "Signature", type: "signature", required: true },
        DATE("mv_date"),
      ],
    },
  ],
};

export const fluVaccineStatement = {
  key: "fluVaccineStatement",
  name: "Flu Vaccine (Influenza) Information Statement",
  category: "Policy",
  version: 1,
  estMin: 4,
  icon: "pill",
  description: "Vaccine information statement and annual acknowledgement for flu season.",
  subject: "self",
  completedBy: ["newHire", "caregiver", "officeManager", "admin"],
  interpretation: {
    purpose: "Evidence that staff received the influenza Vaccine Information Statement.",
    // The agency must report its annual vaccination rate to CDPHE by Dec 31.
    cadence: "Annually, each flu season",
  },
  sections: [
    {
      id: "fv_body",
      title: "Vaccine information statement",
      fields: [
        { id: "fv_text", type: "policyText", label: "Can a flu vaccine give you flu?",
          body:
            "No, a flu vaccine cannot cause flu illness. Flu vaccines given with a needle (flu shots) are currently made in two ways: with flu vaccine viruses that have been killed (inactivated) and are therefore not infectious, or with proteins from a flu virus (as with recombinant influenza vaccine). Nasal spray vaccine is made with weakened (attenuated) live flu viruses, which also cannot cause flu illness — these viruses are cold-adapted and designed to reproduce only at the cooler temperatures found in the nose, not in the lungs or other areas where warmer temperatures exist.\n\n" +
            "What Side Effects Can Occur After Getting a Flu Vaccine?\n" +
            "While a flu vaccine cannot give you flu illness, different side effects may be associated with a flu shot or a nasal spray flu vaccine. These side effects are usually mild and short-lasting, especially compared to symptoms of the flu.\n\n" +
            "A flu shot: The viruses in a flu shot are killed (inactivated), so you cannot get the flu from a flu shot. Some minor side effects that may occur are soreness, redness, and/or swelling where the shot was given, headache (low grade), fever, muscle aches, nausea, and fatigue.\n\n" +
            "The nasal spray: The viruses in the nasal spray vaccine are weakened and do not cause the severe symptoms often associated with influenza illness. In adults, side effects may include funny nose, headache, sore throat, and cough.\n\n" +
            "Availability of Influenza Immunization\n" +
            "Influenza vaccines are available for administration during flu season, typically from October through March each year. The agency will make available vaccine options and notify staff each year.\n\n" +
            "Importance of Adhering to Standard Precautions\n" +
            "The single best way to reduce the risk of seasonal flu and its potentially serious complications is to get vaccinated, but good health habits like avoiding people who are sick, covering your cough, and washing your hands often can help stop the spread of germs and prevent respiratory illnesses like flu. Practicing standard precautions is critical to reducing the risk of seasonal flu, including:\n" +
            "• Avoiding close contact with others.\n" +
            "• Staying home when you are sick.\n" +
            "• Covering your nose and mouth.\n" +
            "• Cleaning your hands.\n" +
            "• Avoiding touching your eyes, nose, and mouth.\n\n" +
            "The agency shall track and report the annual influenza vaccination rate for its employees through December 31st of each year and is required to report to the Colorado Department of Public Health and Environment.",
        },
      ],
    },
    {
      id: "fv_ack",
      title: "Statement",
      fields: [
        { id: "fv_ack_box", label: "Statement", type: "checkbox", required: true, options: [
          { label: "I have read or have had explained to me the information contained in the Vaccine Information Statement (VIS) Influenza. I have had a chance to ask questions that were answered to my satisfaction." },
        ] },
        NAME("fv_name"),
        SIG("fv_sig", "Staff Signature"),
        DATE("fv_date"),
      ],
    },
  ],
};

export const newHireForms = {
  homemakerJobDescription,
  pcwJobDescription,
  ihssAttendantJobDescription,
  orientationChecklist,
  caregiverAvailability,
  rulesOfTheRoad,
  employeeHandbookAck,
  policiesReceipt,
  careScopeAndTasks,
  missedVisitsPolicy,
  fluVaccineStatement,
  competencyValidation,
};
