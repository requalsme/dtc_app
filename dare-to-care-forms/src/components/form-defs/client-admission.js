// Client Admission Packet forms.
//
// SOURCE: "Dtc Forms/Dare to Care Home Care - Client Admission Packet.pdf"
// (29 pages, 2026-07-27). Authoritative — it supersedes the older standalone
// forms of the same name.
//
// Policy and notice bodies are transcribed rather than summarised, so the filed
// PDF shows the client the same words they signed against.
//
// Packet items already covered by existing schemas and therefore NOT rebuilt
// here: Fall Risk Assessment (item 9 -> `fallRisk`) and Client Care Plan
// (items 10-11 -> `clientCarePlan`). Item 21 lists documents provided
// separately (Rate Sheet, Credit Card Authorization, Use of Client Vehicle),
// which are their own standalone PDFs.
//
// Where the packet's table of contents splits one continuous document across
// several numbered entries, it is built as ONE form — the packet body carries a
// single signature, and inventing extra signature pages would misrepresent it.

const CLIENT_SIG = (id, label = "Client / Authorized Representative Signature") => ({
  id, label, type: "signature", required: true,
});
const AGENCY_SIG = (id, label = "Agency Representative Signature") => ({
  id, label, type: "signature", required: true,
  autofill: { source: "logged-in user", from: "currentUser", confidence: 0.96, safe: false },
});
const DATE = (id, label = "Date") => ({
  id, label, type: "date", required: true,
  autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true },
});

// ── Section 1 — Welcome & Service Agreement ────────────────────────────────

export const welcomeLetter = {
  key: "welcomeLetter",
  name: "Welcome Letter",
  category: "Admission",
  version: 1,
  estMin: 2,
  icon: "home",
  description: "A personal welcome from the agency, and how to reach us.",
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Provide the client with the agency welcome, office hours, and complaint route.",
    cadence: "Once, at admission",
  },
  sections: [
    {
      id: "wl_body",
      title: "Welcome",
      fields: [
        { id: "wl_text", type: "policyText", label: "Welcome to Dare to Care Home Care",
          body:
            "Welcome to Dare to Care Home Care, and thank you for choosing us as your home care provider. Our mission is to be the foremost provider of meaningful and results-oriented home care connections for seniors and their loved ones. Our vision is to arm today's spectrum of caregivers with hope, high-impact resources, and the promise of a better tomorrow.\n\n" +
            "At Dare to Care Home Care, we develop a personalized care plan that directs the care and services we provide to you as a client. We want to work together with you and your family to ensure the highest level of care is provided by trained caregivers.\n\n" +
            "Our caregivers are provided training in order to provide our clients with quality, person-centered care. We strive to have consistency in your care team, but staff may have days off that can conflict with scheduled shifts. Our office staff works diligently to ensure the caregiver coming to your home can meet your care needs.\n\n" +
            "OFFICE HOURS\n" +
            "Our office is open Monday through Friday between the hours of 8:30 a.m. and 5 p.m. Our On-Call Supervisor is available after these hours 24 hours per day, 365 days per year by calling our main phone number.\n\n" +
            "We strive to provide meaningful services to each client, but it is possible that you may have a complaint about our staff or services. Please contact our office at 720-842-2153 to express feedback and complaints.\n\n" +
            "There are many home care choices out there, and we sincerely thank you for choosing Dare to Care Home Care. We look forward to working with you.\n\n" +
            "Dare to Care Home Care\n2851 S Parker Rd, Suite 440, Aurora, CO 80014\n(720) 842-2153",
        },
      ],
    },
    {
      id: "wl_ack",
      title: "Receipt",
      fields: [
        { id: "wl_ack_box", label: "Receipt", type: "checkbox", required: true, options: [
          { label: "I have received the Welcome Letter." },
        ] },
        CLIENT_SIG("wl_sig"),
        DATE("wl_date"),
      ],
    },
  ],
};

// Packet TOC items 2, 3 and 4 are one continuous agreement (pages 5-8) with a
// single signature block at the end.
export const homeCareServicesAgreement = {
  key: "homeCareServicesAgreement",
  name: "Home Care Services Agreement",
  category: "Admission",
  version: 1,
  estMin: 15,
  icon: "fileText",
  description: "Client information, term of service, rates, schedule, and agreement terms.",
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "The contract under which the agency provides services, including rates and weekly schedule.",
    cadence: "At admission; schedule reviewed at least annually or when care needs change",
  },
  sections: [
    {
      id: "sa_intro",
      title: "Agreement",
      fields: [
        { id: "sa_intro_text", type: "policyText", label: "Home Care Services Agreement",
          body: "This Home Care Services Agreement (\"Agreement\") sets forth the terms and conditions under which Dare to Care Home Care (\"Agency\") will provide services to the Client identified below. By the Client's or Authorized Representative's signature on the final page of this Agreement, and/or receipt of services, whichever is first, Client agrees to the terms and conditions in this Agreement." },
      ],
    },
    {
      id: "sa_client",
      title: "Client information",
      fields: [
        { id: "sa_first", label: "First Name", type: "text", required: true, autofill: { source: "client profile", from: "firstName", confidence: 0.95, safe: true } },
        { id: "sa_last", label: "Last Name", type: "text", required: true, autofill: { source: "client profile", from: "lastName", confidence: 0.95, safe: true } },
        { id: "sa_address", label: "Service Address", type: "text", required: true, autofill: { source: "client profile", from: "address", confidence: 0.9, safe: true } },
        { id: "sa_city", label: "City", type: "text", required: true, autofill: { source: "client profile", from: "city", confidence: 0.9, safe: true } },
        { id: "sa_state", label: "State", type: "text", required: true },
        { id: "sa_zip", label: "Zip", type: "text", required: true, autofill: { source: "client profile", from: "zip", confidence: 0.9, safe: true } },
        { id: "sa_phone", label: "Phone Number", type: "text", required: true, autofill: { source: "client profile", from: "phone", confidence: 0.9, safe: true } },
        { id: "sa_dob", label: "Date of Birth", type: "date", required: true, autofill: { source: "client profile", from: "dob", confidence: 0.97, safe: true } },
        { id: "sa_start", label: "Anticipated Start of Care Date", type: "date", required: true },
        { id: "sa_email", label: "Email", type: "text", required: false },
      ],
    },
    {
      id: "sa_terms1",
      title: "Term & services",
      fields: [
        { id: "sa_terms_text", type: "policyText", label: "Term & Services",
          body:
            "(1) Term of Agreement. The term of this Agreement will start on the first day that Client receives any service from Agency (the \"Effective Date\") and will continue on an as-needed basis until the Agreement is terminated by either party, as provided in this Agreement.\n\n" +
            "(2) Services Provided. Agency will provide to Client the services and care outlined in the Client's Care Plan (\"Services\"), at one or more of the rates below. Full rate detail is provided on the separate Client Service Rate Sheet. Services will be provided by employees of the Agency at the Client's home and/or specified service address (\"Location\").",
        },
        { id: "sa_rates", label: "Rates", type: "table", required: false,
          rowLabel: "Rate", addLabel: "Add rate",
          wideColumns: ["service"],
          columns: [
            { id: "service", label: "Service Type", type: "select", options: ["Homemaker", "Personal Care", "24/7 Care", "Other"] },
            { id: "rate", label: "$ Rate / Hour", type: "text" },
          ] },
      ],
    },
    {
      id: "sa_schedule",
      title: "Scheduling",
      fields: [
        { id: "sa_sched_text", type: "policyText", label: "Changes & Scheduling",
          body:
            "(3) Changes to Services. Changes to Services may be initiated by Client and/or his/her representative through a phone call or written communication to the Agency. The Agency requires notice of two (2) calendar days prior to a change of an ongoing schedule.\n\n" +
            "(4) Scheduling. Services will be provided for the hours and days requested by Client, and in accordance with the terms of this Agreement. Agency will schedule employees based on the hours of care requested by the Client. Below is a description of anticipated services to be provided and expected frequency and duration of services.",
        },
        { id: "sa_sched_rows", label: "Weekly schedule", type: "table", required: false,
          rowLabel: "Day", addLabel: "Add day",
          wideColumns: ["services"],
          columns: [
            { id: "day", label: "Day", type: "select", options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
            { id: "times", label: "Shift Times / Hours", type: "text" },
            { id: "services", label: "Service(s) Requested", type: "text" },
          ] },
        { id: "sa_total_hours", label: "Total anticipated weekly hours", type: "text", required: false },
        { id: "sa_consistency", type: "policyText", label: "A note on consistency",
          body: "Changes to this schedule follow the notice requirements above — contact the office to make adjustments. This schedule is reviewed with the Client and updated at least annually, or whenever care needs change.\n\nWe strive to keep the same caregiver(s) assigned to your care whenever possible, but staff may occasionally have days off that conflict with a scheduled shift. Our office works to ensure the caregiver coming to your home can meet your care needs." },
      ],
    },
    {
      id: "sa_terms2",
      title: "Additional terms",
      fields: [
        { id: "sa_terms2_text", type: "policyText", label: "Additional Terms",
          body:
            "(5) Private / Direct Hiring. The Client may not privately/directly hire an Agency employee for a period of 180 days following the date that employee last provided services for Client. In the event the Client breaks this condition, a replacement fee of $5,000 is due to the Agency immediately upon employment of that individual.\n\n" +
            "(6) Supplies & Equipment. The Client is responsible for supplying all supplies (e.g. cleaning, personal care) and equipment which may be necessary in the provision of services. Additional charges may apply if the Agency provides supplies and/or equipment.\n\n" +
            "(7) Care Planning. The Client will be included in developing a Care Plan. The Personal Care Worker will provide home care service(s) requested by, and agreed to by, the Client, Authorized Representative, and the Agency. The Agency shall make reasonable accommodation of Client's needs and preferences, except where the health and safety of the Personal Care Worker is at risk.\n\n" +
            "(8) Questions. You may contact the Agency office with questions, feedback, or complaints about services. In the event of a medical emergency, you should call 911 immediately.\n\n" +
            "Dare to Care Home Care\n2851 S Parker Rd, Suite 440, Aurora, CO 80014\n(720) 842-2153",
        },
      ],
    },
    {
      id: "sa_ack",
      title: "Acknowledgement & signatures",
      fields: [
        { id: "sa_ack_text", type: "policyText", label: "Acknowledgement",
          body: "By signing this agreement, the Client or Authorized Representative agrees to have received and understood the following policies and/or documents. If I have any questions about these documents, I will contact the Agency immediately. I understand that by signing this Agreement, I have read, reviewed, and am in agreement with the terms." },
        { id: "sa_docs", label: "Documents received", type: "checkbox", required: true, options: [
          { label: "Welcome Letter" },
          { label: "Home Care Services Agreement" },
          { label: "Client Service Rate Sheet / Credit Card Authorization Form (if applicable)" },
          { label: "Client Care Plan" },
          { label: "Written Notice of Home Care Consumer Rights" },
          { label: "Agency Disclosure Notice" },
          { label: "Consumer Confidentiality Notice / HIPAA" },
          { label: "Advance Directives Notice" },
          { label: "Financial Obligations & Billing Notice" },
          { label: "Emergency Preparedness Plan Information" },
          { label: "Use of Client Vehicle Authorization" },
        ] },
        CLIENT_SIG("sa_client_sig"),
        DATE("sa_client_date"),
        AGENCY_SIG("sa_agency_sig"),
        DATE("sa_agency_date"),
      ],
    },
  ],
};

// ── Section 2 — Assessment ─────────────────────────────────────────────────
// Packet TOC items 5-8 (pages 9-13) are one assessment document ending in a
// single agency signature.
export const clientAssessment = {
  key: "clientAssessment",
  name: "Client Assessment",
  category: "Admission",
  version: 1,
  estMin: 20,
  icon: "activity",
  description: "Personal, legal, financial, functional and medical intake assessment.",
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Build a full picture of the client's situation, risks and medical history at intake.",
    cadence: "At admission, and on significant change in condition",
  },
  sections: [
    {
      id: "cas_personal",
      title: "Personal & contact information",
      fields: [
        { id: "cas_last", label: "Client Last Name", type: "text", required: true, autofill: { source: "client profile", from: "lastName", confidence: 0.95, safe: true } },
        { id: "cas_first", label: "First Name", type: "text", required: true, autofill: { source: "client profile", from: "firstName", confidence: 0.95, safe: true } },
        { id: "cas_dob", label: "Date of Birth", type: "date", required: true, autofill: { source: "client profile", from: "dob", confidence: 0.97, safe: true } },
        { id: "cas_phone", label: "Phone Number", type: "text", required: false },
        { id: "cas_address", label: "Service Address", type: "text", required: false },
        { id: "cas_city", label: "City", type: "text", required: false },
        { id: "cas_zip", label: "Zip", type: "text", required: false },
        { id: "cas_email", label: "Email", type: "text", required: false },
        { id: "cas_height", label: "Height", type: "text", required: false },
        { id: "cas_weight", label: "Weight", type: "text", required: false },
        { id: "cas_gender", label: "Gender", type: "radio", required: false, options: [{ label: "M" }, { label: "F" }] },
        { id: "cas_marital", label: "Marital Status", type: "radio", required: false, options: [
          { label: "Single" }, { label: "Married" }, { label: "Divorced" }, { label: "Widowed" },
        ] },
        { id: "cas_spouse", label: "Spouse", type: "text", required: false },
        { id: "cas_lives_with", label: "Lives With", type: "text", required: false },
        { id: "cas_religion", label: "Religion", type: "text", required: false },
        { id: "cas_services", label: "Attends Services", type: "radio", required: false, options: [{ label: "Yes" }, { label: "No" }] },
        { id: "cas_emergency", label: "Emergency Contact (Name / Phone / Email)", type: "textarea", required: true },
        { id: "cas_language", label: "Language", type: "text", required: false },
        { id: "cas_profession", label: "Past Profession", type: "text", required: false },
        { id: "cas_pets", label: "Pets", type: "text", required: false },
      ],
    },
    {
      id: "cas_legal",
      title: "Legal & financial information",
      fields: [
        { id: "cas_poa", label: "Durable Power of Attorney", type: "text", required: false },
        { id: "cas_poa_copy", label: "Copy of POA obtained", type: "radio", required: false, options: [{ label: "Yes" }, { label: "No" }] },
        { id: "cas_surrogate", label: "Health Surrogate", type: "text", required: false },
        { id: "cas_dnr", label: "DNR", type: "radio", required: false, options: [{ label: "Yes" }, { label: "No" }] },
        { id: "cas_dnr_onsite", label: "DNR on sight?", type: "text", required: false },
        { id: "cas_responsible", label: "Responsible for payments", type: "radio", required: false, options: [
          { label: "Client" }, { label: "Spouse" }, { label: "POA" },
        ] },
        { id: "cas_payment_method", label: "Payment Method", type: "radio", required: false, options: [
          { label: "Checks" }, { label: "ACH" }, { label: "Credit Card" }, { label: "Other" },
        ] },
        { id: "cas_deposit_quoted", label: "Deposit check quoted (rate × weekly hours × 2)", type: "text", required: false },
        { id: "cas_deposit_obtained", label: "Deposit check obtained", type: "radio", required: false, options: [{ label: "Yes" }, { label: "No" }] },
        { id: "cas_ltc", label: "Long term care insurance?", type: "radio", required: false, options: [{ label: "Yes" }, { label: "No" }] },
        { id: "cas_aob", label: "Assignment of benefits?", type: "radio", required: false, options: [{ label: "Yes" }, { label: "No" }] },
        { id: "cas_policy", label: "Policy / Claim #", type: "text", required: false },
        { id: "cas_case_manager", label: "Case Manager", type: "text", required: false },
        { id: "cas_case_phone", label: "Case Manager Phone", type: "text", required: false },
        { id: "cas_veteran", label: "Eligible veteran or spouse?", type: "radio", required: false, options: [{ label: "Yes" }, { label: "No" }] },
        { id: "cas_service_dates", label: "Service dates (from / to)", type: "text", required: false },
      ],
    },
    {
      id: "cas_functional",
      title: "Functional limitations",
      fields: [
        { id: "cas_limitations", label: "Functional limitations", type: "checkbox", required: false, options: [
          { label: "Speech" }, { label: "Hearing" }, { label: "Legally Blind" },
          { label: "Incontinence (Bowel / Bladder)" }, { label: "Protective Briefs" }, { label: "Catheter" },
          { label: "Ambulation (cane, walker, wheelchair)" }, { label: "Paralysis" }, { label: "Contractures" },
          { label: "Endurance" }, { label: "Shower Chair" }, { label: "Oxygen" }, { label: "Bedside Commode" },
        ] },
      ],
    },
    {
      id: "cas_contacts",
      title: "Medical contacts",
      fields: [
        { id: "cas_physician", label: "Physician", type: "text", required: false, autofill: { source: "client profile", from: "physician", confidence: 0.9, safe: true } },
        { id: "cas_physician_phone", label: "Physician Phone", type: "text", required: false },
        { id: "cas_therapist", label: "Therapist", type: "text", required: false },
        { id: "cas_therapist_phone", label: "Therapist Phone", type: "text", required: false },
        { id: "cas_hospital", label: "Preferred Hospital", type: "text", required: false },
      ],
    },
    {
      id: "cas_history",
      title: "Health history by system",
      fields: [
        { id: "cas_cardio", label: "Cardiovascular", type: "checkbox", required: false, options: [
          { label: "Hypertension" }, { label: "Anemia" }, { label: "Palpitations" }, { label: "Stroke" },
          { label: "Pacemaker" }, { label: "Heart Attack" }, { label: "Edema" }, { label: "Other" },
        ] },
        { id: "cas_resp", label: "Respiratory", type: "checkbox", required: false, options: [
          { label: "Cough" }, { label: "Sputum" }, { label: "Blood" }, { label: "Tracheotomy" },
          { label: "Emphysema" }, { label: "Ventilator" }, { label: "Asthma" }, { label: "COPD" }, { label: "Other" },
        ] },
        { id: "cas_urinary", label: "Continence / Urinary", type: "checkbox", required: false, options: [
          { label: "Incontinence" }, { label: "Kidney Stones" }, { label: "Catheter" }, { label: "Renal / Bladder" },
          { label: "Prostate Problems" }, { label: "Uterine Problems" }, { label: "Other" },
        ] },
        { id: "cas_gi", label: "Gastrointestinal", type: "checkbox", required: false, options: [
          { label: "Nausea" }, { label: "Weight Loss / Gain" }, { label: "Hemorrhoids" }, { label: "Constipation" },
          { label: "Laxative Use" }, { label: "Heartburn" }, { label: "Intestinal Gas" },
          { label: "Chewing / Swallowing Issues" }, { label: "Ulcer" }, { label: "Hernia" },
          { label: "Dentures (Full, Partial, Upper, Lower)" }, { label: "Other" },
        ] },
        { id: "cas_neuro", label: "Neurological", type: "checkbox", required: false, options: [
          { label: "Headaches" }, { label: "Orientation / Dizziness" }, { label: "Dementia / Alzheimer's" },
          { label: "Sensory Loss" }, { label: "Seizures" }, { label: "Memory Loss" }, { label: "Paralysis" },
          { label: "Slurring" }, { label: "Other" },
        ] },
        { id: "cas_musculo", label: "Musculoskeletal / Skin", type: "checkbox", required: false, options: [
          { label: "Balance Problems" }, { label: "Arthritis" }, { label: "Prosthesis" }, { label: "Spasms" },
          { label: "Atrophy" }, { label: "Joint Replacement" }, { label: "Bruises / Cause" }, { label: "Frail" },
          { label: "Other" },
        ] },
        { id: "cas_pain", label: "Pain intensity (1 mild – 5 intolerable)", type: "select", required: false, options: [
          { label: "1" }, { label: "2" }, { label: "3" }, { label: "4" }, { label: "5" },
        ] },
        { id: "cas_pain_location", label: "Location of pain", type: "text", required: false },
        { id: "cas_medications", label: "Medications", type: "textarea", required: false },
        { id: "cas_notes", label: "Notes / Comments", type: "textarea", required: false },
      ],
    },
    {
      id: "cas_sign",
      title: "Sign-off",
      fields: [
        AGENCY_SIG("cas_sig"),
        DATE("cas_date"),
      ],
    },
  ],
};

// ── Section 3 — Rights & Disclosures ───────────────────────────────────────

export const consumerRights = {
  key: "consumerRights",
  name: "Written Notice of Home Care Consumer Rights",
  category: "Admission",
  version: 1,
  estMin: 6,
  icon: "shield",
  description: "The twelve rights guaranteed to every home care consumer, and how to file a complaint.",
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Required disclosure of consumer rights, attested to both orally and in writing.",
    cadence: "At admission",
  },
  sections: [
    {
      id: "cr_body",
      title: "Your rights",
      fields: [
        { id: "cr_text", type: "policyText", label: "Consumer Rights",
          body:
            "As a consumer of home care and services, you are entitled to receive notification of the following rights both orally and in writing. You have the right to exercise the following rights without retribution or retaliation from HCA staff:\n\n" +
            "(1) Receive written information concerning the HCA's policies on advance directives, including a description of applicable state law.\n" +
            "(2) Receive information about the care and services to be furnished, the disciplines that will furnish care, the frequency of proposed visits in advance, and receive information about any changes in the care and services to be furnished.\n" +
            "(3) Receive care and services from the HCA without discrimination based upon personal, cultural, or ethnic preference, disabilities, or whether you have formulated an advance directive.\n" +
            "(4) Authorize a representative to exercise your rights as a consumer of home care.\n" +
            "(5) Be informed of the full name, licensure status, staff position, and employer of all persons supplying, staffing, or supervising the care and services you receive.\n" +
            "(6) Be informed and participate in planning care and services, and receive care and services from staff who are properly trained and competent to perform their duties.\n" +
            "(7) Refuse treatment within the confines of the law and be informed of the consequences of such action.\n" +
            "(8) Participate in experimental research only upon your voluntary written consent.\n" +
            "(9) Have you and your property treated with respect, and be free from neglect, financial exploitation, and verbal, physical, and psychological abuse including humiliation, intimidation, or punishment.\n" +
            "(10) Be free from involuntary confinement, and from physical or chemical restraints.\n" +
            "(11) Be ensured of the confidentiality of all of your records, communications, and personal information, and be informed of the HCA's policies and procedures regarding disclosure of clinical information and records.\n" +
            "(12) Express complaints verbally or in writing about services or care that is or is not furnished, or about the lack of respect for your person or property by anyone who is furnishing services on behalf of the HCA.",
        },
        { id: "cr_complaint", type: "policyText", label: "If you believe your rights have been violated",
          body:
            "You may contact the HCA directly:\n" +
            "Dare to Care Home Care, 2851 S Parker Rd, Suite 440, Aurora, CO 80014\n" +
            "HCA Manager Re'Jane Branch — 720-842-2153\n\n" +
            "You may also file a complaint with the Health Facilities and Emergency Medical Services Division of the Colorado Department of Public Health and Environment:\n" +
            "4300 Cherry Creek Drive South, Denver, CO 80246 | 303-692-2910 or 1-800-842-8826",
        },
      ],
    },
    {
      id: "cr_ack",
      title: "Attestation",
      fields: [
        { id: "cr_ack_box", label: "Attestation", type: "checkbox", required: true, options: [
          { label: "I attest to verbal and written receipt of the aforementioned notice of rights." },
        ] },
        CLIENT_SIG("cr_client_sig", "Consumer or Authorized Representative Signature"),
        DATE("cr_client_date"),
        AGENCY_SIG("cr_hca_sig", "HCA Representative Signature"),
        DATE("cr_hca_date"),
      ],
    },
  ],
};

export const agencyDisclosure = {
  key: "agencyDisclosure",
  name: "Agency Disclosure Notice",
  category: "Admission",
  version: 1,
  estMin: 4,
  icon: "layers",
  description: "How responsibilities are divided between the consumer, the worker, and the agency.",
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Required disclosure of who is responsible for employment, supervision, supplies and liability.",
    cadence: "At admission",
  },
  sections: [
    {
      id: "ad_body",
      title: "Disclosure",
      fields: [
        { id: "ad_type", label: "Agency Type", type: "radio", required: true, options: [
          { label: "Home Care Placement" }, { label: "Home Health Care" }, { label: "Personal Care (Non-Medical)" },
        ] },
        { id: "ad_text", type: "policyText", label: "Division of responsibilities",
          body:
            "Each home care agency or home care placement agency is required to inform the consumer of the responsibilities of the agency, the home care worker, and the consumer regarding the employment and duties of each. The Agency is the employer of record for all staff providing direct care services and is responsible for all items marked \"HCA\" below.\n\n" +
            "HCA (Agency) responsibility:\n" +
            "• Employment, supervision, scheduling & assignment of duties for the home care worker\n" +
            "• Hiring, firing, and discipline of the home care worker\n" +
            "• Training and ensuring qualifications that meet the consumer's needs\n" +
            "• Liability for the home care worker while in the consumer's home\n" +
            "• Payroll, employment, Social Security & unemployment taxes for the home care worker\n" +
            "• General liability\n\n" +
            "Consumer responsibility:\n" +
            "• Provision of supplies or materials used in providing services",
        },
      ],
    },
    {
      id: "ad_ack",
      title: "Acknowledgement",
      fields: [
        { id: "ad_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I have received and understand the Agency Disclosure Notice." },
        ] },
        CLIENT_SIG("ad_sig"),
        DATE("ad_date"),
      ],
    },
  ],
};

// ── Section 4 — Privacy & Confidentiality ──────────────────────────────────

export const consumerConfidentiality = {
  key: "consumerConfidentiality",
  name: "Consumer Confidentiality Notice / HIPAA",
  category: "Admission",
  version: 1,
  estMin: 4,
  icon: "lock",
  description: "How consumer records and information are protected and, when necessary, disclosed.",
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Explain confidentiality practices and the circumstances permitting disclosure.",
    cadence: "At admission",
  },
  sections: [
    {
      id: "cc_body",
      title: "Confidentiality notice",
      fields: [
        { id: "cc_text", type: "policyText", label: "Consumer Confidentiality Notice",
          body:
            "The Agency strives to ensure confidentiality of consumer records, personal, and financial information. This includes providing consumer information only to appropriate staff members and protected record storage procedures. The Agency shall not refuse to share consumer care information unless the consumer has chosen to refuse coordination with external HCAs.\n\n" +
            "When Disclosure May Be Necessary\n" +
            "• If requested by the Client and/or Authorized Representative.\n" +
            "• In external coordination with other agencies, companies, providers, clinicians, or other health care professionals for the purpose of providing care services or products related to your care.\n" +
            "• An emergent situation that needs immediate information to provide healthcare services.\n" +
            "• If required by law or process to disclose information to a law enforcement or government HCA.\n" +
            "• Providing information to family members or interested parties approved by the Client or appointed representative.\n\n" +
            "Additionally, for the handling of PHI (Personal Health Information) under HIPAA Privacy Practices, please review the Notice of Provider Privacy Practices in this section.\n\n" +
            "Questions about the confidentiality of your records may be directed to:\n" +
            "Dare to Care Home Care, 2851 S Parker Rd, Suite 440, Aurora, CO 80014\n(720) 842-2153",
        },
      ],
    },
    {
      id: "cc_ack",
      title: "Acknowledgement",
      fields: [
        { id: "cc_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I have received and understand the Consumer Confidentiality Notice." },
        ] },
        CLIENT_SIG("cc_sig"),
        DATE("cc_date"),
      ],
    },
  ],
};

// Packet TOC items 15-17 are one HIPAA notice (pages 21-23) with a single
// acknowledgement of receipt at the end.
export const privacyPracticesNotice = {
  key: "privacyPracticesNotice",
  name: "Notice of Provider Privacy Practices (HIPAA)",
  category: "Admission",
  version: 1,
  estMin: 10,
  icon: "lock",
  description: "The federally required HIPAA privacy notice, provided and acknowledged at first service.",
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Deliver the HIPAA Notice of Privacy Practices and record the client's acknowledgement of receipt.",
    cadence: "At first service; re-issued if the notice materially changes",
  },
  sections: [
    {
      id: "pp_obligations",
      title: "Our obligations & how we use information",
      fields: [
        { id: "pp_header", type: "policyText", label: "Please review this notice carefully",
          body:
            "THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND YOUR RIGHTS WITH RESPECT TO THIS INFORMATION. PLEASE REVIEW THIS NOTICE CAREFULLY.\n\n" +
            "Dare to Care Home Care must maintain the privacy of your personal health information and give you this notice describing our legal duties and privacy practices concerning your personal health information, as required by the HIPAA Privacy Rule. Questions about this notice may be directed to our Privacy Officer (\"POX\"), whose contact information appears at the end of this Notice under Complaints.\n\n" +
            "Our Obligations\n" +
            "We are required by law to: maintain the privacy of personal health information; give you this notice of our legal duties and privacy practices; and follow the terms of our notice currently in effect.",
        },
        { id: "pp_uses", type: "policyText", label: "How we may use and disclose protected health information",
          body:
            "Except as described below, we will use and disclose Protected Health Information (\"PHI\") only with your written permission, which you may revoke at any time in writing.\n\n" +
            "For Treatment: We may disclose PHI to doctors, nurses, technicians, or others involved in your care who need the information to provide treatment.\n\n" +
            "For Payment: We may use and disclose PHI so that we or others may bill and receive payment from you, an insurance company, or a third party for services received.\n\n" +
            "For Health Care Operations: We may use PHI for quality evaluation, audits, attorneys or professional advisors, and sharing with entities that have a relationship with you (e.g., your health plan) for their own operations.\n\n" +
            "Appointment Reminders, Treatment Alternatives, and Related Services: We may contact you about appointments, treatment alternatives, or health-related benefits and services.\n\n" +
            "Individuals Involved in Your Care or Payment: Unless you object, we may disclose PHI to family, relatives, friends, or others involved in your care or payment for care, or as we determine is in your best interest if you are unable to agree or object.\n\n" +
            "Disaster Relief: We may disclose PHI to disaster relief organizations to coordinate care or notify family of your location or condition.\n\n" +
            "Research: Under certain circumstances and after a special approval process, we may use or disclose PHI for health-related research.",
        },
        { id: "pp_special", type: "policyText", label: "Special situations",
          body:
            "As Required by Law; to avert a serious threat to health or safety; in connection with our business associates who perform functions on our behalf (legal, debt collection, data processing, billing, satisfaction surveys, blended care models), all of whom are contractually obligated to protect your information; organ and tissue donation coordination; military and veterans' affairs as required by command authorities; workers' compensation programs; public health activities (disease control, births/deaths, abuse/neglect reporting, product recalls, exposure risk, and suspected abuse or domestic violence); health oversight activities (audits, investigations, licensure); data breach notification; lawsuits and disputes (in response to court orders or, with notice/protective efforts, subpoenas); law enforcement requests under specific legal circumstances; coroners, medical examiners, and funeral directors; national security and intelligence activities; protective services for the President and other officials; and disclosures to correctional institutions or law enforcement for inmates in custody.\n\n" +
            "Uses and Disclosures Requiring an Opportunity to Object\n" +
            "Where practical, we will provide an opportunity to object to a disclosure, or use professional judgment to determine that you do not object.\n\n" +
            "Your Written Authorization Is Required For Other Uses and Disclosures\n" +
            "Uses and disclosures of PHI for marketing purposes, and disclosures that constitute a sale of PHI, require your written authorization, which may be revoked at any time (except for disclosures already made in reliance on it).",
        },
      ],
    },
    {
      id: "pp_rights",
      title: "Your rights",
      fields: [
        { id: "pp_rights_text", type: "policyText", label: "Your Rights",
          body:
            "Inspect & Copy — Request, in writing, to inspect and copy PHI used to make decisions about your care or payment. We have up to 30 days to respond and may charge a reasonable copying fee.\n\n" +
            "Electronic Copy — Request an electronic copy of an electronic medical record, provided in the form or format you request when readily producible.\n\n" +
            "Notice of Breach — Be notified upon a breach of your unsecured PHI.\n\n" +
            "Amend — Request, in writing, that PHI you believe is incorrect or incomplete be amended, for as long as we maintain it.\n\n" +
            "Accounting of Disclosures — Request, in writing, a list of certain disclosures made for purposes other than treatment, payment, or operations.\n\n" +
            "Request Restrictions — Request a restriction on PHI used or disclosed for treatment, payment, or operations; we must agree if it concerns an item you paid for out-of-pocket in full.\n\n" +
            "Confidential Communications — Request, in writing, to be contacted about medical matters in a specific way or location — we will accommodate reasonable requests.\n\n" +
            "Paper Copy — Request a paper copy of this Notice at any time, even if you agreed to receive it electronically.\n\n" +
            "Changes to This Notice\n" +
            "We reserve the right to change this Notice and apply it to PHI we already have as well as information received in the future. The current Notice, with its effective date on the first page, is posted at our office.\n\n" +
            "Complaints\n" +
            "If you believe your privacy rights have been violated, you may file a written complaint with our office or with the U.S. Department of Health and Human Services Office of Civil Rights, using the address on your Home Care Services Agreement. You will not be penalized for filing a complaint.",
        },
      ],
    },
    {
      id: "pp_ack",
      title: "Acknowledgement of receipt",
      fields: [
        { id: "pp_ack_text", type: "policyText", label: "Acknowledgement of Receipt",
          body: "By signing below, you acknowledge that Dare to Care Home Care has given you a copy of its Notice of Provider Privacy Practices, and has had the chance to discuss any concerns or questions about the privacy of your health information. If your first date of service was due to an emergency, we will obtain this signature as soon as possible after the emergency." },
        { id: "pp_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I have received the Dare to Care Home Care Privacy Notice." },
          { label: "Dare to Care Home Care has given me the chance to discuss my concerns and questions about the privacy of my health information." },
        ] },
        CLIENT_SIG("pp_sig"),
        DATE("pp_date"),
      ],
    },
  ],
};

// ── Section 5 — Policies & Emergency Preparedness ──────────────────────────

export const advanceDirectivesNotice = {
  key: "advanceDirectivesNotice",
  name: "Advance Directives Notice",
  category: "Admission",
  version: 1,
  estMin: 5,
  icon: "fileText",
  description: "Your right to an advance directive, and the Colorado MOST form.",
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Inform the client of their right to make (or not make) an advance directive.",
    cadence: "At admission",
  },
  sections: [
    {
      id: "adn_body",
      title: "Advance directives",
      fields: [
        { id: "adn_text", type: "policyText", label: "Advance Directives Notice",
          body:
            "Our Agency believes it is important for clients to be able to express preferences about health care decisions, as well as designate an agent to make health care decisions when the client cannot make or communicate them.\n\n" +
            "Our Agency complies with the Colorado Medical Decision Treatment Act by recognizing the right of competent adults to accept or reject medical treatment. Colorado law does not require a consumer to make an advance directive — it is the Client's and/or Authorized Representative's choice to make one at any time. Our Agency will not condition the provision of care, or otherwise discriminate against a Client, based on whether they have an advance directive.\n\n" +
            "The MOST Form\n" +
            "A recognized format to express preferences and health decisions in Colorado is the Medical Orders for Scope of Treatment (MOST) Form — a 1-page, 2-sided document that consolidates and summarizes patient preferences for key life-sustaining treatments: CPR, medical interventions, and artificially administered nutrition. The program was established by C.R.S. 18.7 in Colorado in 2010.\n\n" +
            "• Intended for patients at risk for a life-threatening clinical event due to a serious life-limiting medical condition, which may include advanced frailty.\n" +
            "• Completed by a health care professional in conversation with the patient or authorized health care agent, then signed by the patient/agent and a physician, APN, or PA.\n" +
            "• The physician/APN/PA signature translates patient preferences into medical orders.\n" +
            "• The MOST form \"travels\" with the patient and must be honored in any setting — hospital, clinic, day surgery, long-term care facility, hospice, or home.\n" +
            "• Always voluntary — a healthcare facility may not require a MOST form as a condition of admission or treatment (C.R.S. 15-18.7-108).\n" +
            "• Endorsed as part of the National POLST Program.",
        },
        { id: "adn_has", label: "Does the client have an advance directive?", type: "radio", required: true, options: [
          { label: "Yes" }, { label: "No" },
        ] },
      ],
    },
    {
      id: "adn_ack",
      title: "Acknowledgement",
      fields: [
        { id: "adn_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I have received and understand the Advance Directives Notice." },
        ] },
        CLIENT_SIG("adn_sig"),
        DATE("adn_date"),
      ],
    },
  ],
};

export const financialBillingNotice = {
  key: "financialBillingNotice",
  name: "Financial Obligations & Billing Notice",
  category: "Admission",
  version: 1,
  estMin: 4,
  icon: "fileText",
  description: "Accepted payment sources and how the agency communicates billing changes.",
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Record the client's payment source and confirm billing-change notice terms.",
    cadence: "At admission, and on change of payment source",
  },
  sections: [
    {
      id: "fb_body",
      title: "Payment source",
      fields: [
        { id: "fb_intro", type: "policyText", label: "Financial Obligations & Billing Notice",
          body: "The company strives to provide the highest level of care and services to our clients. In order to provide excellent care, we appreciate timely payment for services provided. Below are potential sources of payment — by checking the identified source and signing this notice, you agree to the payment method." },
        { id: "fb_source", label: "Source of payment", type: "checkbox", required: true, options: [
          { label: "Client / Authorized Representative Personal Funds" },
          { label: "Medical Insurance Company" },
          { label: "Long Term Care Insurance Company" },
          { label: "Other" },
        ] },
        { id: "fb_source_detail", label: "Insurance company / other — please specify", type: "text", required: false },
        { id: "fb_ltc_note", type: "policyText", label: "Long term care insurance",
          body: "The company will provide billing and documentation to a long term care insurance company as a courtesy, but it is ultimately the Client's or Authorized Representative's responsibility for payment." },
        { id: "fb_changes", type: "policyText", label: "How we communicate changes",
          body:
            "• If the company implements a scheduled rate increase to all consumers, we will provide written notice to each affected consumer at least thirty (30) days before implementation.\n" +
            "• The company will advise the consumer of any individual changes, orally and in writing, as soon as possible, but no later than five (5) business days from the date the company becomes aware of the change.\n" +
            "• The company shall not assume power of attorney or guardianship over a consumer, require a consumer to endorse checks over to the HCA, or require a consumer to execute or assign a loan, advance, financial interest, mortgage, or other property in exchange for future services.",
        },
      ],
    },
    {
      id: "fb_ack",
      title: "Acknowledgement",
      fields: [
        // The paper form asks for initials here rather than a full signature.
        { id: "fb_initials", label: "Client / Authorized Representative Initials", type: "text", required: true },
        CLIENT_SIG("fb_sig"),
        DATE("fb_date"),
      ],
    },
  ],
};

export const eppClientInfo = {
  key: "eppClientInfo",
  name: "Emergency Preparedness Plan Information (Client)",
  category: "Admission",
  version: 1,
  estMin: 5,
  icon: "alert",
  description: "How the agency plans for, and responds to, disasters and other emergencies.",
  // Distinct from `emergencyPreparedness`, which is the STAFF education and
  // acknowledgement in the New Hire Packet. This is the client-facing version.
  subject: "client",
  completedBy: ["officeManager", "admin"],
  interpretation: {
    purpose: "Inform the client how the agency prepares for and responds to emergencies.",
    cadence: "At admission",
  },
  sections: [
    {
      id: "ec_body",
      title: "Emergency preparedness",
      fields: [
        { id: "ec_text", type: "policyText", label: "Emergency Preparedness Plan Information",
          body:
            "The Agency has established an Emergency Preparedness Plan (EPP) designed to manage consumers' care and services in response to natural disasters or other emergencies that disrupt the Agency's ability to provide care, or threaten the lives or safety of its consumers.\n\n" +
            "The EPP includes provisions for the management of all staff designated to be involved in emergency measures, including assignment of responsibilities and functions, and education for consumers, caregivers, and families on handling care, treatment, safety, and well-being during and following a disaster. The Agency reviews its EPP after any incident response and on an annual basis, incorporating any substantive changes. A master copy is maintained by the HCA Manager and available for review by all employees.\n\n" +
            "Emergency situations could include, but are not limited to: pandemic, disease outbreak, active shooter, tornado, blizzard, flood, fire, civil unrest, gas leak, IT system outage, or seasonal influenza.",
        },
        { id: "ec_process", type: "policyText", label: "The Agency's 8-Step EPP Process",
          body:
            "1. Review Agency performance objectives for the emergency preparedness plan.\n" +
            "2. Conduct a Risk Assessment to identify potential emergency scenarios.\n" +
            "3. Develop an emergency plan and life-saving action plans (shelter in place, evacuation, etc.) to manage consumers' care in response to a disruptive emergency.\n" +
            "4. Establish an Incident Command System, identifying all staff involved in emergency measures and their responsibilities.\n" +
            "5. Assess the availability and capability of resources for incident stabilization — local care partners, public health agencies, fire and medical services, and utilities.\n" +
            "6. Inform staff of their duties for implementing the plan, and provide adequate staff education so staff safety is assured.\n" +
            "7. Provide education for consumers, caregivers, and families on handling care, treatment, safety, and well-being during and following a disaster.\n" +
            "8. Review each incident and the EPP annually, and implement changes as needed.\n\n" +
            "Agency EPP Objectives\n" +
            "• Ensure the safety and well-being of all clients and staff members.\n" +
            "• Utilize an all-hazards approach to be prepared for potential emergencies.\n" +
            "• Maintain continuity of care for clients.\n" +
            "• Coordinate and communicate with community partners.\n" +
            "• Appropriately utilize available resources.\n" +
            "• Continue business operations and maintain Agency financial viability.\n\n" +
            "Questions about our Emergency Preparedness Plan:\n" +
            "2851 S Parker Rd, Suite 440, Aurora, CO 80014\n(720) 842-2153",
        },
      ],
    },
    {
      id: "ec_ack",
      title: "Acknowledgement",
      fields: [
        { id: "ec_ack_box", label: "Acknowledgement", type: "checkbox", required: true, options: [
          { label: "I have received and understand the Emergency Preparedness Plan Information." },
        ] },
        CLIENT_SIG("ec_sig"),
        DATE("ec_date"),
      ],
    },
  ],
};

export const clientAdmissionForms = {
  welcomeLetter,
  homeCareServicesAgreement,
  clientAssessment,
  consumerRights,
  agencyDisclosure,
  consumerConfidentiality,
  privacyPracticesNotice,
  advanceDirectivesNotice,
  financialBillingNotice,
  eppClientInfo,
};
