// HCA Annual Agency Evaluation packet (Colorado Class B Non-Medical Home Care).
//
// SOURCE: "HCA_Annual_Agency_Evaluation_FILLABLE.pdf" (19 pages, uploaded
// 2026-08-09). Policy Number 1-1.7, Regulation Ch. 26, 7.1(D), Revision Date
// 10/15/2023. This is an agency-level admin document — not filed to any one
// client or caregiver record — completed by the HCA Manager/Governing Body
// once a year (plus the two companion tools below, which run more often).
//
// Three documents live in the packet and are built here as three schemas,
// since each carries its own policy number and the packet cross-references
// them as separate tools:
//   1-1.7  hcaAnnualEvaluation      — the annual evaluation itself
//   1-1.8  consumerRecordAudit      — run "on an ongoing basis, but no less
//                                     than quarterly," reused outside the
//                                     annual cycle
//   1-1.9  hcaProgramEvaluationTool — a generic per-program evaluation tool,
//                                     also reused outside the annual cycle
//
// NOT built: "Annual Operating Budget & Capital Expenditure Plan" (1-1.10).
// The packet page for it literally says "(insert Annual Operating Budget &
// Capital Expenditure Plan)" — it's a placeholder for an external financial
// document, not a form with fields of its own.
//
// Checklist rows are transcribed verbatim from the packet (same convention as
// new-hire.js / client-admission.js) so the filed PDF shows the same words
// the evaluator attested to. Y/N/N/A rows are required — this is a regulatory
// compliance document, and an unanswered row is a real gap, not a formatting
// nicety. Free-text summary fields are not required, since they're narrative.

const SIG = (id, label = "Signature") => ({
  id, label, type: "signature", required: true,
  autofill: { source: "logged-in user", from: "currentUser", confidence: 0.96, safe: false },
});
const DATE = (id, label = "Date", required = true) => ({
  id, label, type: "date", required,
  autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true },
});
const NAME = (id, label = "Name") => ({
  id, label, type: "text", required: true,
  autofill: { source: "logged-in user", from: "currentUser", confidence: 0.95, safe: true },
});
// Compliance row with Yes / No / N/A — matches the packet's three-column tables
// (Governing Body, HCA Manager, Supervisor, PCW, Policies Review, QMP, EPP, Budget).
const YNA = (id, label) => ({
  id, label, type: "radio", required: true,
  options: [{ label: "Yes" }, { label: "No" }, { label: "N/A" }],
});
// Compliance row with Yes / No only — the HCA Agency Evaluation table has no
// N/A column in the packet.
const YN = (id, label, required = true) => ({
  id, label, type: "radio", required,
  options: [{ label: "Yes" }, { label: "No" }],
});
const NOTES = (id) => ({ id, label: "Notes", type: "textarea", required: false });

export const hcaAnnualEvaluation = {
  key: "hcaAnnualEvaluation",
  name: "HCA Annual Agency Evaluation",
  category: "Compliance",
  version: 1,
  estMin: 60,
  icon: "fileText",
  description: "Annual comprehensive review of HCA operations — Governing Body, HCA Manager, Supervisor, Personal Care Worker, Policies & Procedures, QMP, Emergency Preparedness, and Operating Budget. Class B Non-Medical Home Care, Ch. 26, 7.1(D).",
  subject: "self",
  completedBy: ["admin", "officeManager"],
  interpretation: {
    purpose: "Document the HCA's comprehensive annual evaluation of its total operation, per Ch. 26, 7.1(D) and the related sections it consolidates (7.1(C), 7.2, 5.2, 5.10, 5.13, 7.8(A)).",
    cadence: "At least annually, per the HCA's own review calendar",
  },
  sections: [
    {
      id: "haa_attendance",
      title: "Attendance sheet",
      fields: [
        { id: "haa_att_year", label: "Year in Review", type: "text", required: true, placeholder: "e.g. 2026" },
        DATE("haa_att_date", "Meeting Date"),
        { id: "haa_att_time", label: "Time", type: "time", required: false },
        {
          id: "haa_att_table", label: "Attendees", type: "table", required: true,
          rowLabel: "Attendee", addLabel: "Add attendee",
          wideColumns: ["name"],
          columns: [
            { id: "name", label: "First Name, Last Name (Print)", type: "text" },
            { id: "role", label: "HCA Role", type: "text" },
            { id: "signature", label: "Signature", type: "text" },
          ],
        },
      ],
    },
    {
      id: "haa_gov",
      title: "Governing Body",
      fields: [
        { id: "haa_gov_note", type: "policyText", label: "Governing Body — Ch. 26, 7.1(C)",
          body: "The HCA will evaluate the compliance of the Governing Body based on the criteria below and by reviewing HCA Governing Body Designation, HCA Bylaws, Designation of HCA Manager & Back-Up HCA Manager, HCA Class B Policies & Procedures Checklist, HCA HCBS-PHS Policies & Procedures Checklist (if applicable), and HCA Organizational Chart, in addition to other documents as necessary." },
        YNA("haa_gov_convene", "An HCA may choose to convene a governing body that shall have legal authority and responsibility for the conduct of the HCA. If an HCA does not convene a governing body, the HCA shall designate an individual who shall have responsibility for all tasks. At least one (1) member or designee shall have knowledge of HCA operations"),
        YNA("haa_gov_bylaws", "The Governing Body shall have bylaws or a governing document that shall specify the programs and services offered by the HCA and be reviewed and revised as needed"),
        YNA("haa_gov_designate_manager", "The Governing Body shall designate and employ an HCA Manager"),
        YNA("haa_gov_policies", "The Governing Body shall develop and adopt policies and procedures for the operation and administration of the HCA, to be reviewed annually and revised as needed"),
        YNA("haa_gov_service_plan", "The Governing Body shall ensure any program or service offered by the HCA, directly or under arrangement, shall be provided in accordance with the service plan and HCA policy and procedure"),
        YNA("haa_gov_review_annual", "The Governing Body shall review the operation of the HCA at least annually"),
        YNA("haa_gov_minutes", "The Governing Body shall keep minutes of all meetings"),
        YNA("haa_gov_office", "The Governing Body shall provide and maintain a fixed office location, that provides for consumer confidentiality and a safe working environment"),
        YNA("haa_gov_org", "The Governing Body shall organize services furnished, administrative control and lines of authority for the delegation of responsibility down to the consumer care level that are clearly set forth in writing and are readily identifiable"),
        NOTES("haa_gov_notes"),
      ],
    },
    {
      id: "haa_eval",
      title: "HCA Agency Evaluation",
      fields: [
        { id: "haa_eval_note", type: "policyText", label: "HCA Agency Evaluation",
          body: "The HCA must ensure the following HCA operations are in compliance for a licensed home care agency, reviewing Business Operations Review and Business Goals & Projections as needed." },
        YN("haa_eval_comprehensive", "Did the HCA's governing body or designee conduct a comprehensive evaluation of the HCA's total operation at least annually?"),
        YN("haa_eval_findings_used", "Did the evaluation assure the appropriateness and quality of the HCA's services with findings used to verify policy implementation, to identify problems, and to establish problem resolution and policy revision as necessary, and include any findings or improvement strategies identified by the HCA's Quality Management Program?"),
        YN("haa_eval_qmp_method", "Did the HCA utilize the Quality Management Program as a method for ongoing process improvement and policy and administrative review, which includes a review of the scope of services offered, arrangements for services with other agencies or individuals, admissions and discharge policies, supervision and service plan, urgent consumer care, service records, and personnel qualifications?"),
        YN("haa_eval_consumer_involvement", "Did the HCA implement an on-going mechanism for consumer involvement to provide input and comment regarding services provided by the HCA in accordance with HCA policy?"),
        YN("haa_eval_findings_to_gb", "Were all findings from the policy and administrative review and consumer input and commentary provided to the governing body at least annually to identify trends or issues requiring consideration?"),
        YN("haa_eval_four_criteria", "Did the HCA evaluate each aspect of its total program, considering the four (4) main criteria: Appropriateness, Adequacy, Effectiveness and Efficiency?"),
        YN("haa_eval_documentation", "Did the documentation of the annual evaluation include the names and titles of the persons carrying out the evaluation, the criteria and methods used to accomplish it, and any action taken by the HCA as a result of its findings?"),
        YN("haa_eval_records_quarterly", "Did an appropriate individual representing the programs and services offered by the HCA evaluate the HCA's consumer records on an ongoing basis, but not less than quarterly?"),
        YN("haa_eval_records_sample", "Did the evaluation include a review of sample active and closed consumer records to ensure that HCA policies are followed in providing services, both directly and under arrangement, and to assure that the quality of service is satisfactory and appropriate? The review shall consist of a representative sample of all home care services provided by the HCA."),
        NOTES("haa_eval_notes"),
      ],
    },
    {
      id: "haa_manager",
      title: "HCA Manager",
      fields: [
        { id: "haa_mgr_note", type: "policyText", label: "HCA Manager — Ch. 26, 7.2",
          body: "The HCA Manager must meet the following requirements and qualifications to be in compliance for a licensed home care HCA. Reviewed against Designation of HCA Manager & Back-Up HCA Manager, training checklists and certificates, HCA Organizational Chart, policies & procedures checklists, Main Branch & Hours, and the Staff New-Hire Orientation / In-Service / Ongoing Training Calendar." },
        YNA("haa_mgr_designated", "A licensed home care HCA providing personal care services shall designate an HCA Manager to supervise the provision of those services"),
        { id: "haa_mgr_qual_header", type: "policyText", label: "The HCA Manager shall meet the following qualifications:", body: "" },
        YNA("haa_mgr_qual_age_exp", "Be at least 21 years of age, possess a high school diploma or GED, and at least one (1) year documented supervisory experience in the provision of personal care services"),
        YNA("haa_mgr_qual_comm", "Be able to communicate and understand return communication effectively in exchanges between the consumer, family representatives, and other providers"),
        YNA("haa_mgr_qual_training", "Have successfully completed an eight (8) hour HCA Manager training course. Additional related annual training that equals 12 hours shall be required in the first year and annually thereafter"),
        YNA("haa_mgr_qual_laws", "Be familiar with all applicable local, state, and federal laws and regulations concerning the operation and provision of home care services"),
        { id: "haa_mgr_resp_header", type: "policyText", label: "The HCA Manager shall be responsible for ensuring:", body: "" },
        YNA("haa_mgr_resp_compliance", "The HCA is in compliance with all applicable federal, state and local laws"),
        YNA("haa_mgr_resp_reports", "Completion, maintenance and submission of such reports and records as required by the department"),
        YNA("haa_mgr_resp_liaison", "Ongoing liaison with the governing body, staff members and the community"),
        YNA("haa_mgr_resp_orgchart", "A current organizational chart to show lines of authority down to the consumer level"),
        YNA("haa_mgr_resp_records", "Appropriate personnel, bookkeeping and administrative records and policies and procedures of the HCA"),
        YNA("haa_mgr_resp_orientation", "Orientation of new staff, regularly scheduled in-service education programs and opportunities for continuing education for the staff"),
        YNA("haa_mgr_resp_backup", "Designation in writing the qualified staff member to act in the absence of the manager"),
        YNA("haa_mgr_resp_availability", "Availability of the manager or designee for all hours that employees are providing services"),
        YNA("haa_mgr_resp_marketing", "All marketing, advertising and promotional information accurately represent the HCA and address the care, treatment and services that the HCA can provide directly or through contractual arrangement"),
        NOTES("haa_mgr_notes"),
      ],
    },
    {
      id: "haa_supervisor",
      title: "Supervisor",
      fields: [
        { id: "haa_sup_note", type: "policyText", label: "Supervisor (HCA Manager if no Supervisor) — Ch. 26, 7.8(A)",
          body: "The Supervisor(s) must meet the following requirements and qualifications to be in compliance for a licensed home care HCA. Reviewed against Designation of Supervisor, HCA Staff Ongoing Training Checklist, and Quality Management Program Quarterly Meeting Minutes (compliance for on-site supervision and assessments of consumer satisfaction)." },
        { id: "haa_sup_qual_header", type: "policyText", label: "The supervisor shall meet the following qualifications:", body: "" },
        YNA("haa_sup_qual_age", "Be at least 18 years of age"),
        YNA("haa_sup_qual_exp", "Have appropriate experience or training in the home care industry or closely related personal care services in accordance with HCA policy"),
        YNA("haa_sup_qual_training", "Have completed training in the provision of personal care services"),
        YNA("haa_sup_qual_ongoing", "Complete ongoing staff training consisting of at least six (6) topics applicable to the HCA's services every 12 months after the starting date of employment or calendar year as designated by HCA policy"),
        { id: "haa_sup_duty_header", type: "policyText", label: "The supervisor shall perform the following duties:", body: "" },
        YNA("haa_sup_duty_competency", "Prior to assignment, the HCA Manager or supervisor shall conduct a proof of competency evaluation involving HCA approved tasks, along with any other tasks that require specific hands-on application"),
        YNA("haa_sup_duty_availability", "Be available to personal care worker for questions at all times"),
        { id: "haa_sup_super_header", type: "policyText", label: "Supervision of a personal care worker shall:", body: "" },
        YNA("haa_sup_super_qualified", "Be performed by a qualified employee of the HCA who is in a designated supervisory capacity and available to the worker for questions at all times"),
        YNA("haa_sup_super_annual", "Include evaluation of each personal care worker providing services at least annually. The evaluation shall include observation of tasks performed and relationship with the consumer"),
        YNA("haa_sup_super_onsite", "Provide on-site supervision at a minimum of every three (3) months and include an assessment of consumer satisfaction with services and the personal care worker's adherence to the service plan"),
        NOTES("haa_sup_notes"),
      ],
    },
    {
      id: "haa_pcw",
      title: "Personal Care Worker",
      fields: [
        { id: "haa_pcw_note", type: "policyText", label: "Personal Care Worker",
          body: "The HCA must ensure the following requirements are provided for Personal Care Workers to be in compliance for a licensed home care HCA. Reviewed against Personal Care Worker Orientation, Personal Care Training Within First 45 Days, and the HCA Staff Ongoing Training & Evaluation Tracker." },
        YNA("haa_pcw_orientation", "All personal care staff shall complete HCA orientation and training before independently providing services to consumers"),
        YNA("haa_pcw_competency", "PCWs are provided a proof of competency evaluation involving the HCA approved tasks, along with any other tasks that require specific hands-on application"),
        YNA("haa_pcw_training", "Direct care staff training occurs and shall consist of at least six (6) topics applicable to the HCA's services every 12 months after the starting date of employment or calendar year as designated by HCA policy"),
        NOTES("haa_pcw_notes"),
      ],
    },
    {
      id: "haa_policies",
      title: "HCA Policies & Procedures Review",
      fields: [
        { id: "haa_pol_note", type: "policyText", label: "HCA Policies & Procedures Review",
          body: "The HCA will adopt, review annually and revise as needed, policies and procedures for the operation and administration of the HCA. The HCA will review the following binders for policies and procedures to ensure compliance (reviewed against the HCA Master Binder Flowchart and HCA Master Policies & Procedures Checklist). After review, list any policy updates below." },
        YNA("haa_pol_1", "1. Class B Policies & Procedures"),
        YNA("haa_pol_2", "2. Medicaid Policies & Procedures (if applicable)"),
        YNA("haa_pol_3", "3. Governing Body & HCA Manager"),
        YNA("haa_pol_4", "4. Quality Management Program"),
        YNA("haa_pol_5", "5. Emergency Preparedness Plan"),
        YNA("haa_pol_6", "6. Infection Control Binder"),
        YNA("haa_pol_7", "7. Occurrence Reporting Binder"),
        YNA("haa_pol_8", "8. Consumer Complaint Binder"),
        YNA("haa_pol_9", "9. Employee Handbook"),
        { id: "haa_pol_updated", label: "Policies Updated", type: "textarea", required: false, placeholder: "List any policies revised as part of this review..." },
        NOTES("haa_pol_notes"),
      ],
    },
    {
      id: "haa_qmp",
      title: "Quality Management Program",
      fields: [
        { id: "haa_qmp_note", type: "policyText", label: "Quality Management Program — Ch. 2, 4.1.2",
          body: "The program shall be implemented in accordance with a quality management plan that is reviewed and approved annually by the governing body. Reviewed against the Quality Management Program Policy and Quality Management Program Quarterly Meeting Minutes." },
        YNA("haa_qmp_reg_change", "Did CDPHE regulations change for QMP (Chapter 2, Section 4.1)?"),
        YNA("haa_qmp_complies", "Does the QMP still comply with CDPHE regulations?"),
        YNA("haa_qmp_deficiencies", "Has the HCA received deficiencies this year related to QMP?"),
        YNA("haa_qmp_deficiencies_corrected", "Have all deficiencies related to QMP been corrected?"),
        YNA("haa_qmp_meetings_quarterly", "Were QMP meetings held in each quarter?"),
        YNA("haa_qmp_gb_reviewed", "Did the Governing Body review QMP data listed below?"),
        YNA("haa_qmp_approved", "Upon review, is the Quality Management Plan approved by the Governing Body?"),
        { id: "haa_qmp_summary_guide", type: "policyText", label: "QMP Review Summary — how to complete this",
          body: "Summarize the year's Quality Management Program activity: what the Quality Assurance Committee worked on each quarter, the key indicators below, quality projects identified, staff education provided, vaccination compliance, client satisfaction results, and areas of improvement identified by the Governing Body." },
        { id: "haa_qmp_chart_audits", label: "Total # of chart audits performed", type: "text", required: false },
        { id: "haa_qmp_personnel_audits", label: "Total # of personnel record audits performed", type: "text", required: false },
        { id: "haa_qmp_complaints", label: "Total # of complaints", type: "text", required: false },
        { id: "haa_qmp_incidents", label: "Total # of incidents", type: "text", required: false },
        { id: "haa_qmp_hospitalizations", label: "Total # of hospitalizations", type: "text", required: false },
        { id: "haa_qmp_occ_reported", label: "Total # of occurrences reported to CDPHE", type: "text", required: false },
        { id: "haa_qmp_occ_nonreportable", label: "Total # of occurrences non-reportable to CDPHE", type: "text", required: false },
        { id: "haa_qmp_potential_errors", label: "Total # of potential errors reported by staff", type: "text", required: false },
        { id: "haa_qmp_cdphe_deficiencies_count", label: "Total # of CDPHE issued deficiencies", type: "text", required: false },
        { id: "haa_qmp_client_surveys", label: "Client satisfaction surveys (# completed)", type: "text", required: false },
        { id: "haa_qmp_personnel_surveys", label: "Personnel satisfaction surveys (# completed)", type: "text", required: false },
        { id: "haa_qmp_projects", label: "Quality Management Projects identified in review year", type: "textarea", required: false, placeholder: "e.g. 1) COVID-19 client and staff safety; 2) Dementia training; 3) Caregiver service notes documentation" },
        { id: "haa_qmp_staff_education", label: "Staff education provided as part of QMP", type: "textarea", required: false },
        { id: "haa_qmp_vaccination", label: "Vaccination compliance summary (Influenza / COVID, etc.)", type: "textarea", required: false },
        { id: "haa_qmp_satisfaction_summary", label: "Client satisfaction survey results summary", type: "textarea", required: false, placeholder: "e.g. % very satisfied, % would recommend services" },
        { id: "haa_qmp_improvement_areas", label: "Areas of improvement identified by the Governing Body", type: "textarea", required: false },
      ],
    },
    {
      id: "haa_epp",
      title: "Emergency Preparedness Plan",
      fields: [
        { id: "haa_epp_note", type: "policyText", label: "Emergency Preparedness Plan — Ch. 26, 5.10",
          body: "The HCA shall review its emergency preparedness plan after any incident response and on an annual basis, and incorporate into policy any substantive changes. Reviewed against the Emergency Preparedness Plan Policy and EPP Incident Reports." },
        YNA("haa_epp_reg_change", "Did CDPHE regulations change for EPP (Chapter 26, Section 5.10)?"),
        YNA("haa_epp_complies", "Does the EPP still comply with CDPHE regulations?"),
        YNA("haa_epp_deficiencies", "Has the HCA received deficiencies this year related to EPP?"),
        YNA("haa_epp_deficiencies_corrected", "Have all deficiencies related to EPP been corrected?"),
        YNA("haa_epp_reviewed_after_incident", "Did the HCA review EPP after any incident response?"),
        YNA("haa_epp_gb_approved", "Upon review, does the Governing Body approve of EPP?"),
        { id: "haa_epp_review", label: "EPP Review", type: "textarea", required: false },
        { id: "haa_epp_incidents", label: "EPP incidents occurred this year", type: "textarea", required: false },
        { id: "haa_epp_sections_discussed", label: "EPP sections discussed", type: "textarea", required: false },
        { id: "haa_epp_changes_proposed", label: "EPP changes proposed", type: "textarea", required: false },
      ],
    },
    {
      id: "haa_budget",
      title: "HCA Operating Budget",
      fields: [
        { id: "haa_bud_note", type: "policyText", label: "HCA Operating Budget",
          body: "The HCA has developed, implemented and reviewed a budget to be in compliance for a licensed home care HCA. Reviewed against the Annual Operating Budget and Capital Expenditure Plan." },
        YNA("haa_bud_developed", "Did the HCA develop an Annual Plan that includes an Annual Operating Budget and Capital Expenditure Plan?"),
        YNA("haa_bud_reviewed", "Was the Annual Plan reviewed, updated as needed and approved by the Governing Body at least annually?"),
        YNA("haa_bud_viable", "Does the Annual Plan provide for a viable operation of the home care HCA to provide care and services to clients?"),
        NOTES("haa_bud_notes"),
      ],
    },
    {
      id: "haa_minutes",
      title: "Meeting minutes",
      fields: [
        { id: "haa_min_note", type: "policyText", label: "HCA Annual Evaluation — Meeting Minutes", body: "" },
        DATE("haa_min_date", "Date"),
        { id: "haa_min_recorder", label: "Staff Member Recording Notes", type: "text", required: true },
        { id: "haa_min_start", label: "Start Time", type: "time", required: false },
        { id: "haa_min_body", label: "Minutes", type: "textarea", required: true, placeholder: "Who called the meeting to order, who was present, what operations were reviewed, and what was decided..." },
        { id: "haa_min_end", label: "End Time", type: "time", required: false },
      ],
    },
    {
      id: "haa_summary",
      title: "Evaluation summary",
      fields: [
        { id: "haa_sum_note", type: "policyText", label: "HCA Annual Evaluation Summary — how to complete this",
          body: "Give the year's operating stats, then summarize highlights: quality management activity, staff training completion, HCA Manager/Back-Up training hours, annual employee evaluations and on-site supervisory visits completed, occurrences reported, vaccination compliance, consumer satisfaction results, any emergency response activity, and next year's focus." },
        { id: "haa_sum_years_operating", label: "Years operating under this license", type: "text", required: false },
        { id: "haa_sum_clients_served", label: "Total number of clients served this year", type: "text", required: false },
        { id: "haa_sum_avg_clients_month", label: "Average number of clients served each month", type: "text", required: false },
        { id: "haa_sum_admissions", label: "New admissions this year", type: "text", required: false },
        { id: "haa_sum_discharges", label: "Discharges this year", type: "text", required: false },
        { id: "haa_sum_caregivers_employed", label: "Caregivers employed at end of year", type: "text", required: false },
        { id: "haa_sum_avg_employees_month", label: "Average number of employees each month", type: "text", required: false },
        { id: "haa_sum_turnover_rate", label: "Caregiver turnover rate (%)", type: "text", required: false },
        { id: "haa_sum_narrative", label: "Highlights", type: "textarea", required: true, placeholder: "Numbered list of highlights, as in the packet's sample summary..." },
      ],
    },
    {
      id: "haa_signoff",
      title: "Completion sign-off",
      fields: [
        DATE("haa_signoff_completion_date", "Evaluation Completion Date"),
        DATE("haa_signoff_submitted_date", "Date Submitted to the Governing Body"),
        { id: "haa_signoff_eval_header", type: "policyText", label: "Evaluation received and reviewed by Governing Body:", body: "" },
        SIG("haa_signoff_eval_sig", "Signature, President of Governing Body"),
        DATE("haa_signoff_eval_date", "Date"),
        { id: "haa_signoff_qmp_header", type: "policyText", label: "Quality Management Plan reviewed and approved by Governing Body:", body: "" },
        SIG("haa_signoff_qmp_sig", "Signature, President of Governing Body"),
        DATE("haa_signoff_qmp_date", "Date"),
        { id: "haa_signoff_epp_header", type: "policyText", label: "Emergency Preparedness Plan reviewed and approved by Governing Body:", body: "" },
        SIG("haa_signoff_epp_sig", "Signature, President of Governing Body"),
        DATE("haa_signoff_epp_date", "Date"),
        { id: "haa_signoff_infection_header", type: "policyText", label: "Infection Control Program:", body: "" },
        SIG("haa_signoff_infection_sig", "Signature, President of Governing Body"),
        DATE("haa_signoff_infection_date", "Date"),
        { id: "haa_signoff_manager_header", type: "policyText", label: "HCA Annual Evaluation completed by HCA:", body: "" },
        SIG("haa_signoff_manager_sig", "Signature, HCA Manager"),
        DATE("haa_signoff_manager_date", "Date"),
      ],
    },
  ],
};

// Companion tool 1-1.8 — run at least quarterly, reviewing a representative
// sample of active/closed consumer records. Filed under whoever conducts the
// audit ("self"), since a single audit can cover several consumers at once
// and the app doesn't yet support filing one submission against many client
// records.
export const consumerRecordAudit = {
  key: "consumerRecordAudit",
  name: "Consumer Record Audit",
  category: "Compliance",
  version: 1,
  estMin: 10,
  icon: "fileText",
  description: "Quarterly (or more often) review of a sample of active and closed consumer records against required documentation. Ch. 26, 7.1(D)(6).",
  subject: "self",
  completedBy: ["admin", "officeManager"],
  interpretation: {
    purpose: "Verify that a sample of consumer records contains all required documentation and that HCA policies are followed in providing services.",
    cadence: "Ongoing, no less than quarterly",
  },
  sections: [
    {
      id: "cra_intro",
      title: "Consumer record review",
      fields: [
        { id: "cra_note", type: "policyText", label: "Consumer Record Audit — Ch. 26, 7.1(D)(6)",
          body: "Appropriate qualified individuals representing the programs and services offered by the HCA shall evaluate the HCA's consumer records on an ongoing basis, but no less than quarterly. The evaluation shall include a review of sample active and closed consumer records to ensure that HCA policies are followed in providing services, both directly and under arrangement, and to assure that the quality of service is satisfactory and appropriate. The review shall consist of a representative sample of all home care services provided by the HCA." },
        DATE("cra_date", "Date"),
        {
          id: "cra_records", label: "Consumer records reviewed", type: "table", required: true,
          rowLabel: "Record", addLabel: "Add record",
          wideColumns: ["name"],
          columns: [
            { id: "name", label: "First Name, Last Name", type: "text" },
            { id: "status", label: "Record Status", type: "select", options: ["Open Record", "Closed Record"] },
          ],
        },
      ],
    },
    {
      id: "cra_docs",
      title: "Required documents present",
      fields: [
        { id: "cra_docs_note", type: "policyText", label: "Does the Consumer Record contain the following documents?", body: "" },
        YN("cra_doc_agreement", "Home Care Services Agreement"),
        YN("cra_doc_rate_sheet", "Client Service Rate Sheet"),
        YN("cra_doc_initial_plan", "Initial Client Care Plan"),
        YN("cra_doc_rights_notice", "Written Notice of Home Care Consumer Rights"),
        YN("cra_doc_disclosure", "Agency Disclosure Notice"),
        YN("cra_doc_hipaa", "Consumer Confidentiality / HIPAA"),
        YN("cra_doc_advance_directives", "Advance Directives"),
        YN("cra_doc_billing_notice", "Financial Obligations & Billing Notice"),
        YN("cra_doc_epp_info", "Emergency Preparedness Plan Information"),
        YN("cra_doc_assessment", "Client Assessment"),
        YN("cra_doc_fall_risk", "Fall Risk Assessment"),
        YN("cra_doc_services_letter", "Client Annual Services Dates and Times Review Letter"),
        YN("cra_doc_updated_plan", "Updated Client Care Plans"),
        YN("cra_doc_90day", "90 Day Supervisory Visit / Client Satisfaction Forms"),
        YN("cra_doc_progress_notes", "Daily Progress Notes"),
        YN("cra_doc_comm_log", "Client / Authorized Representative Communication Log"),
        YN("cra_doc_visit_log", "Consumer Service Visit Log"),
        { id: "cra_notes", label: "Notes", type: "textarea", required: false },
        SIG("cra_sig", "Reviewer Signature"),
        DATE("cra_sig_date", "Date"),
      ],
    },
  ],
};

// Companion tool 1-1.9 — a generic evaluation tool applied to any HCA
// program (Emergency Preparedness, QMP, Governing Body, Occurrence
// Reporting, Infection Control, Consumer Complaints, Personnel Training,
// Client Services), scored against the same four criteria the Annual
// Agency Evaluation uses.
export const hcaProgramEvaluationTool = {
  key: "hcaProgramEvaluationTool",
  name: "HCA Program Evaluation Tool",
  category: "Compliance",
  version: 1,
  estMin: 10,
  icon: "fileText",
  description: "Evaluate any HCA program (Emergency Preparedness, QMP, Governing Body, Occurrence Reporting, Infection Control, Consumer Complaints, Personnel Training, Client Services) against Appropriateness, Adequacy, Effectiveness and Efficiency. Ch. 26, 7.1(D)(4).",
  subject: "self",
  completedBy: ["admin", "officeManager"],
  interpretation: {
    purpose: "Evaluate one aspect of the HCA's total program as part of the Annual Agency Evaluation, or on its own as needed.",
    cadence: "As part of the annual evaluation, or as needed",
  },
  sections: [
    {
      id: "hpe_info",
      title: "Program evaluated",
      fields: [
        { id: "hpe_note", type: "policyText", label: "HCA Program Evaluation Tool — Ch. 26, 7.1(D)(4)",
          body: "The agency shall evaluate aspects of its total program as part of the Annual Agency Evaluation. The programs to be evaluated include, but are not limited to: Emergency Preparedness Program, Quality Management Program, Governing Body, Occurrence Reporting Program, Infection Control Program, Consumer Complaints Program, HCA Personnel Training and Policies, Client Services and Policies." },
        DATE("hpe_date", "Date"),
        { id: "hpe_program", label: "Program Evaluated", type: "select", required: true, options: [
          "Emergency Preparedness Program",
          "Quality Management Program",
          "Governing Body",
          "Occurrence Reporting Program",
          "Infection Control Program",
          "Consumer Complaints Program",
          "HCA Personnel Training and Policies",
          "Client Services and Policies",
          "Other",
        ] },
        NAME("hpe_evaluated_by", "Evaluated by"),
      ],
    },
    {
      id: "hpe_criteria",
      title: "Evaluation criteria",
      fields: [
        { id: "hpe_appropriateness", label: "Appropriateness — assurance that the area being evaluated addresses existing and/or potential problems.", type: "textarea", required: true },
        { id: "hpe_adequacy", label: "Adequacy — a determination as to whether the HCA has the capacity to overcome or minimize existing or potential problems.", type: "textarea", required: true },
        { id: "hpe_effectiveness", label: "Effectiveness — the services offered accomplish the objectives of the HCA and anticipated consumer outcomes.", type: "textarea", required: true },
        { id: "hpe_efficiency", label: "Efficiency — whether there is a minimal expenditure of resources by the HCA to achieve desired goals and anticipated consumer outcomes.", type: "textarea", required: true },
        { id: "hpe_action_taken", label: "HCA Program Action Taken", type: "textarea", required: false },
        YN("hpe_approved", "Approved by Governing Body or Representative"),
      ],
    },
    {
      id: "hpe_signoff",
      title: "Sign-off",
      fields: [
        SIG("hpe_sig", "HCA Manager or Back-Up HCA Manager Signature"),
        DATE("hpe_sig_date", "Date"),
      ],
    },
  ],
};

export const hcaAnnualEvaluationForms = {
  hcaAnnualEvaluation,
  consumerRecordAudit,
  hcaProgramEvaluationTool,
};
