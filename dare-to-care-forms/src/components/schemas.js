// @ts-ignore
import { getStoredUser } from "../app/auth-storage.js";

const TODAY_ISO = new Date().toISOString().slice(0, 10);


const schemas = {
  fallRisk: {
    key: "fallRisk",
    name: "Fall Risk Assessment",
    category: "Clinical",
    version: 2,
    estMin: 3,
    icon: "activity",
    description: "High risk if 6 or more factors are applicable.",
    subject: "client",
    completedBy: ["caregiver", "officeManager"],
    interpretation: {
      purpose: "Identify fall-risk factors, implement interventions, and document the client's fall risk level.",
      cadence: "On intake and after any change in condition",
    },
    sections: [
      {
        id: "fr_id",
        title: "Client identification",
        fields: [
          { id: "fr_client", label: "Client Name", type: "text", required: true, autofill: { source: "client profile", from: "name", confidence: 0.98, safe: true } },
          { id: "fr_date", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
          { id: "fr_staff", label: "Staff Name", type: "text", required: true, autofill: { source: "logged-in caregiver", from: "currentUser", confidence: 0.95, safe: true } },
        ],
      },
      {
        id: "fr_note",
        title: "Instructions",
        fields: [
          { id: "fr_policy", type: "policyText", label: "Fall Risk Assessment", body: "If 6 or more factors are applicable, the client is HIGH RISK. Interventions are implemented based on the client's condition." },
        ],
      },
      {
        id: "fr_factors",
        title: "Risk factors — check all that apply",
        fields: [
          { id: "fr_factors_list", label: "Applicable factors", type: "checkbox", required: false, options: [
            { label: "Fall within last 12 months" },
            { label: "Muscle weakness" },
            { label: "Unsteady gait" },
            { label: "Connected to tubing (O2, IV, other)" },
            { label: "Use of assistive device" },
            { label: "Balance deficit / dizziness" },
            { label: "Urinary incontinency / urgency" },
            { label: "Confusion" },
            { label: "Impaired memory / judgement" },
            { label: "Seizure disorder" },
            { label: "More than 4 medications" },
            { label: "Use of psychotropic, diuretic drugs" },
            { label: "Bathroom grab bar(s) present" },
            { label: "Toilet seat low" },
            { label: "Poor light" },
          ] },
        ],
      },
      {
        id: "fr_interv",
        title: "Interventions",
        fields: [
          { id: "fr_interv_list", label: "Interventions done", type: "checkbox", required: false, options: [
            { label: "Evaluate cause" },
            { label: "Request assistance" },
            { label: "Awareness" },
            { label: "Appropriate use advice" },
            { label: "Change position slowly" },
            { label: "Commode" },
            { label: "Review medications" },
            { label: "Written instructions" },
            { label: "Precautions education" },
            { label: "Elevated toilet seat" },
            { label: "Extra lighting" },
          ] },
          { id: "fr_addl", label: "Additional interventions", type: "textarea", required: false, placeholder: "Document any additional interventions..." },
        ],
      },
      {
        id: "fr_signoff",
        title: "Risk level & sign-off",
        fields: [
          { id: "fr_level", label: "Fall risk level", type: "radio", required: true, options: [
            { label: "Standard risk (fewer than 6 factors)" },
            { label: "HIGH RISK (6 or more factors)" },
          ] },
          { id: "fr_sig", label: "Staff signature", type: "signature", required: true, autofill: { source: "logged-in caregiver", from: "currentUser", confidence: 0.96, safe: false } },
          { id: "fr_sigdate", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
        ],
      },
    ],
  },
  medicationList: {
    key: "medicationList",
    name: "Medication List",
    category: "Clinical",
    version: 2,
    estMin: 4,
    icon: "pill",
    description: "Current medications for the client.",
    subject: "client",
    completedBy: ["caregiver", "officeManager"],
    interpretation: {
      purpose: "Maintain the client's current medication list.",
      cadence: "On admission and at each medication change",
    },
    sections: [
      {
        id: "ms1",
        title: "Client",
        fields: [
          { id: "ml_client", label: "Client Name", type: "text", required: true, autofill: { source: "client profile", from: "name", confidence: 0.98, safe: true } },
          { id: "ml_year", label: "Year", type: "text", required: true, placeholder: "e.g. 2026" },
        ],
      },
      {
        id: "ms2",
        title: "Medications",
        fields: [
          {
            id: "ml_table",
            label: "Medication list",
            type: "table",
            required: true,
            columns: [
              { id: "name", label: "Medication Name", type: "text", width: 1.4 },
              { id: "dose", label: "Dose", type: "text", width: 0.7 },
              { id: "freq", label: "Frequency", type: "text", width: 0.9 },
              { id: "reason", label: "Reason for Taking", type: "text", width: 1.2 },
              { id: "notes", label: "Comments", type: "text", width: 1.2 },
            ],
          },
        ],
      },
    ],
  },
  workplaceViolence: {
    key: "workplaceViolence",
    name: "Workplace Violence Policy Acknowledgement",
    category: "Policy",
    version: 2,
    estMin: 3,
    icon: "shield",
    description: "Employee acknowledgement and compliance statement.",
    subject: "self",
    completedBy: ["caregiver", "officeManager", "admin"],
    interpretation: {
      purpose: "Confirm the employee has received, read, and understood the Workplace Violence Policy.",
      cadence: "At hire and annually",
    },
    sections: [
      {
        id: "ws1",
        title: "Workplace Violence Policy",
        fields: [
          {
            id: "wf1",
            type: "policyText",
            label: "Workplace Violence Policy Acknowledgement",
            body:
              "Purpose and Scope\n" +
              "Dare To Care Home Care is committed to maintaining a safe, respectful, and professional work environment for employees, clients, customers, visitors, and any other individuals who may be present at a work site. Workplace violence, threats, harassment, intimidation, and other disruptive or threatening conduct are not tolerated.\n\n" +
              "Policy Definition\n" +
              "Workplace violence is any act or threat of physical violence, harassment, intimidation, or other threatening behavior that occurs at a work site. Workplace violence may include verbal abuse, physical assault, threats, coercion, stalking, intimidation, or homicide. It is a serious safety concern and may involve employees, clients, customers, visitors, or individuals with a personal relationship to an employee.\n\n" +
              "Types of Workplace Violence\n" +
              "Type 1 - Criminal Intent: The individual has no legitimate relationship to the workplace. Violence may occur during crimes such as robbery, trespassing, or other unlawful activity.\n" +
              "Type 2 - Customer/Client: The individual has a legitimate relationship with the workplace and becomes violent while receiving services or interacting with staff.\n" +
              "Type 3 - Worker-on-Worker: A current or former employee threatens, harasses, intimidates, or attacks another employee.\n" +
              "Type 4 - Personal Relationship: The individual has a personal relationship with an employee and brings threatening or violent behavior into the workplace.\n\n" +
              "Workplace Violence Risk Awareness\n" +
              "Workplace violence remains a recognized safety concern across many industries. In 2023, 740 workplace fatalities were caused by violent acts, including 458 homicides. Healthcare, retail, and transportation workers may face higher exposure due to direct public contact, work performed in private homes or community settings, and variable work environments.\n\n" +
              "Prevention and Reporting Expectations\n" +
              "• Employees are expected to follow the agency's zero-tolerance policy for all forms of workplace violence.\n" +
              "• Employees must report threats, harassment, intimidation, unsafe conduct, or violent incidents promptly to agency management.\n" +
              "• Employees should follow agency procedures for de-escalation, emergency response, and communication during safety concerns.\n" +
              "• Reports may be made without retaliation. Confidentiality will be maintained to the extent reasonably possible while allowing the agency to investigate and respond appropriately.\n" +
              "• Employees should contact emergency services immediately when there is an immediate threat to safety.\n\n" +
              "Prohibited Conduct\n" +
              "• Any act or threat of workplace violence as defined by this policy.\n" +
              "• Possession, use, display, or threat of unauthorized weapons while working or representing the agency.\n" +
              "• Harassment, intimidation, coercion, retaliation, or misuse of authority.\n" +
              "• False or misleading reports made for the purpose of abusing the reporting process.",
          },
        ],
      },
      {
        id: "ws2",
        title: "Employee Acknowledgement",
        fields: [
          { id: "wf2", label: "Acknowledgement", type: "checkbox", required: true, options: [{ label: "By signing below, I acknowledge that I have received, read, and understand the Workplace Violence Policy. I agree to comply with the policy, follow agency safety procedures, and promptly report workplace violence concerns or incidents. I understand that violations of this policy may result in disciplinary action, up to and including termination of employment." }] },
          { id: "wf4", label: "Name", type: "text", required: true, autofill: { source: "logged-in employee", from: "currentUser", confidence: 0.95, safe: true } },
          { id: "wf5", label: "Signature", type: "signature", required: true, autofill: { source: "logged-in employee", from: "currentUser", confidence: 0.96, safe: false } },
          { id: "wf6", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
        ],
      },
    ],
  },
  caregiverActivity: {
    key: "caregiverActivity",
    name: "Caregiver Activity Report",
    category: "Visit",
    version: 1,
    estMin: 4,
    icon: "clock",
    description: "Shift / visit log of tasks performed and time on site.",
    subject: "client",
    completedBy: ["caregiver", "officeManager"],
    interpretation: {
      purpose: "Document tasks completed and hours for a client visit.",
      cadence: "Every shift",
    },
    sections: [
      {
        id: "as1",
        title: "Visit details",
        fields: [
          { id: "af1", label: "Client full name", type: "text", required: true, autofill: { source: "client profile", from: "name", confidence: 0.98, safe: true } },
          { id: "af2", label: "Visit date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
          { id: "af3", label: "Time in", type: "text", required: true, placeholder: "9:00 AM" },
          { id: "af4", label: "Time out", type: "text", required: true, placeholder: "1:00 PM" },
        ],
      },
      {
        id: "as2",
        title: "Tasks performed",
        fields: [
          { id: "af5", label: "Personal care & ADLs", type: "checkbox", required: true, options: [{ label: "Bathing / hygiene" }, { label: "Dressing / grooming" }, { label: "Mobility / transfers" }, { label: "Toileting" }, { label: "Meal preparation" }, { label: "Medication reminders" }, { label: "Light housekeeping" }, { label: "Companionship" }] },
          { id: "af6", label: "Notes / observations", type: "textarea", required: false, placeholder: "Changes in condition, concerns, follow-ups..." },
        ],
      },
      {
        id: "as3",
        title: "Sign-off",
        fields: [
          { id: "af7", label: "Caregiver signature", type: "signature", required: true, autofill: { source: "logged-in caregiver", from: "currentUser", confidence: 0.96, safe: false } },
          { id: "af8", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
        ],
      },
    ],
  },
  supervisoryVisit: {
    key: "supervisoryVisit",
    name: "Supervisory Visit Form",
    category: "Supervisory",
    version: 1,
    estMin: 5,
    icon: "users",
    description: "Periodic supervisory visit documenting care quality and compliance.",
    subject: "client",
    completedBy: ["officeManager", "admin"],
    interpretation: {
      purpose: "Record a supervisor's on-site review of care delivery.",
      cadence: "Every 60 to 90 days per client",
    },
    sections: [
      {
        id: "vs1",
        title: "Visit details",
        fields: [
          { id: "vf1", label: "Client full name", type: "text", required: true, autofill: { source: "client profile", from: "name", confidence: 0.98, safe: true } },
          { id: "vf2", label: "Visit date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
          { id: "vf3", label: "Caregiver reviewed", type: "text", required: true },
        ],
      },
      {
        id: "vs2",
        title: "Quality review",
        fields: [
          { id: "vf4", label: "Care plan being followed", type: "radio", required: true, options: [{ label: "Yes" }, { label: "Partially" }, { label: "No" }] },
          { id: "vf5", label: "Client satisfaction", type: "radio", required: true, options: [{ label: "Satisfied" }, { label: "Neutral" }, { label: "Concerns noted" }] },
          { id: "vf6", label: "Home environment safe", type: "radio", required: true, options: [{ label: "Yes" }, { label: "Issues found" }] },
          { id: "vf7", label: "Findings & corrective actions", type: "textarea", required: false, placeholder: "Document findings and any actions taken..." },
        ],
      },
      {
        id: "vs3",
        title: "Sign-off",
        fields: [
          { id: "vf8", label: "Supervisor signature", type: "signature", required: true, autofill: { source: "logged-in user", from: "currentUser", confidence: 0.9, safe: false } },
          { id: "vf9", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
        ],
      },
    ],
  },
  clientCarePlanReview: {
    key: "clientCarePlanReview",
    name: "Review of Client Care Plan",
    category: "Policy",
    version: 1,
    estMin: 2,
    icon: "fileText",
    description: "Employee Care Plan Review Acknowledgement.",
    subject: "self",
    completedBy: ["caregiver", "officeManager"],
    interpretation: {
      purpose: "Verify the employee understands how to access, review, and respond to a client's care plan.",
      cadence: "At hire and at each care plan change",
    },
    sections: [
      {
        id: "ccpr1",
        title: "Review of Client Care Plan",
        fields: [
          {
            id: "ccpr_body",
            type: "policyText",
            label: "Employee Care Plan Review Acknowledgement",
            body:
              "This form verifies that employees understand how to access, review, and respond to a client's care plan, and that they know the correct procedure for reporting or implementing any updates.\n\n" +
              "Purpose of Review\n" +
              "• Understanding where and how to locate the client care plan.\n" +
              "• Knowing what steps to take when updates or changes are required.\n" +
              "• Ensuring all changes are communicated to the appropriate parties.\n" +
              "• Maintaining compliance with agency policies and client safety standards.\n\n" +
              "By signing below, I confirm that I have reviewed the client care plan process, understand my responsibilities, and agree to follow all established procedures regarding documentation and communication.",
          },
        ],
      },
      {
        id: "ccpr2",
        title: "Acknowledgement",
        fields: [
          { id: "ccpr_ack", label: "Acknowledgement", type: "checkbox", required: true, options: [{ label: "I confirm that I have reviewed the client care plan process, understand my responsibilities, and agree to follow all established procedures regarding documentation and communication." }] },
          { id: "ccpr_name", label: "Employee Name", type: "text", required: true, autofill: { source: "logged-in employee", from: "currentUser", confidence: 0.95, safe: true } },
          { id: "ccpr_sig", label: "Signature", type: "signature", required: true, autofill: { source: "logged-in employee", from: "currentUser", confidence: 0.96, safe: false } },
          { id: "ccpr_date", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
        ],
      },
    ],
  },
  emergencyPreparedness: {
    key: "emergencyPreparedness",
    name: "Emergency Preparedness Plan (EPP)",
    category: "Policy",
    version: 1,
    estMin: 4,
    icon: "alert",
    description: "Staff Emergency Preparedness Plan (EPP) Education acknowledgement.",
    subject: "self",
    completedBy: ["caregiver", "officeManager", "newHire"],
    interpretation: {
      purpose: "Confirm staff have been educated on the Emergency Preparedness Plan.",
      cadence: "At hire and annually",
    },
    sections: [
      {
        id: "epp1",
        title: "Emergency Preparedness Plan (EPP)",
        fields: [
          {
            id: "epp_body",
            type: "policyText",
            label: "Staff Emergency Preparedness Plan (EPP) Education",
            body:
              "Dare to Care Home Care has established an Emergency Preparedness Plan (EPP) designed to manage consumers' care and services in response to the consequences of natural disasters or other emergencies that disrupt Dare to Care Home Care's ability to provide care and services or threatens the lives or safety of its consumers.\n\n" +
              "The Emergency Preparedness Plan includes the provisions for the management of all staff who are designated to be involved in emergency measures, including the assignment of responsibilities and functions. All staff are informed of their duties and responsible for implementing the emergency preparedness plan.\n\n" +
              "Education for consumers, caregivers, and families on how to handle care and treatment, safety, and/or well-being during and following instances of natural (disease outbreak, tornado, flood, blizzard, fire, etc.) and other disasters or other similar situations appropriate to the needs of the consumer.\n\n" +
              "Plan Maintenance: Dare to Care Home Care will review its emergency preparedness plan after any incident response and on an annual basis and incorporate into policy any substantive changes.\n\n" +
              "Staff Access: A master copy of the EPP will be maintained by Dare to Care Home Care Manager in office. The plan will be available for review by all employees.\n\n" +
              "Emergency Situations\n" +
              "Emergency situations could include, but are not limited to, the following: pandemic, disease outbreak, active shooter, tornado, blizzard, flood, fire, civil unrest, gas leak, IT system outage, seasonal influenza, etc.\n\n" +
              "Emergency Response Procedure\n" +
              "In the event of an emergency situation, staff should follow the steps below. If there is any question on the course of action, staff should always contact Dare to Care Home Care directly.\n" +
              "1. Ensure the client is safe and away from the emergency. This could include moving the client to either the highest level in the home for emergencies like a flood or water leak, moving the client to the lowest level in the home for emergencies like a tornado/thunder storm/natural disaster. Staff are to contact 911 in an immediate emergency and then contact Dare to Care Home Care for next steps.\n" +
              "2. Do not leave the client's home until receiving direction from Dare to Care Home Care.\n" +
              "3. Ensure your cell phone and client phone are working properly, if possible, depending on the emergency, so you are able to receive communication from Dare to Care Home Care.\n" +
              "4. Availability: If you are not on assignment with a client, contact Dare to Care Home Care to let them know your availability to help.\n" +
              "5. Follow the direction and assignments provided by the Dare to Care Home Care administrative staff, and wait to hear from Dare to Care Home Care that the emergency situation has concluded.\n\n" +
              "Dare to Care Home Care Contact Information\n" +
              "2851 S Parker Rd, 440 Aurora, CO 80014 | 720 842-2153",
          },
        ],
      },
      {
        id: "epp2",
        title: "Staff Acknowledgement",
        fields: [
          { id: "epp_ack", label: "Acknowledgement", type: "checkbox", required: true, options: [{ label: "I have received education on the Emergency Preparedness Plan and understand my responsibilities during an emergency." }] },
          { id: "epp_name", label: "Staff Name", type: "text", required: true, autofill: { source: "logged-in employee", from: "currentUser", confidence: 0.95, safe: true } },
          { id: "epp_sig", label: "Staff Signature", type: "signature", required: true, autofill: { source: "logged-in employee", from: "currentUser", confidence: 0.96, safe: false } },
          { id: "epp_date", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
        ],
      },
    ],
  },
  clientEmergencyContacts: {
    key: "clientEmergencyContacts",
    name: "Emergency Contacts",
    category: "Client",
    version: 1,
    estMin: 3,
    icon: "users",
    description: "Keep your emergency contacts and physician information up to date.",
    subject: "self",
    completedBy: ["client"],
    interpretation: { purpose: "Maintain current emergency contact and physician information.", cadence: "At admission and whenever it changes" },
    sections: [
      {
        id: "cec1",
        title: "Primary emergency contact",
        fields: [
          { id: "cec_name1", label: "Full name", type: "text", required: true },
          { id: "cec_rel1", label: "Relationship", type: "text", required: true },
          { id: "cec_phone1", label: "Phone number", type: "text", required: true },
        ],
      },
      {
        id: "cec2",
        title: "Secondary emergency contact",
        fields: [
          { id: "cec_name2", label: "Full name", type: "text", required: false },
          { id: "cec_rel2", label: "Relationship", type: "text", required: false },
          { id: "cec_phone2", label: "Phone number", type: "text", required: false },
        ],
      },
      {
        id: "cec3",
        title: "Medical",
        fields: [
          { id: "cec_phys", label: "Primary care physician", type: "text", required: false },
          { id: "cec_physphone", label: "Physician phone", type: "text", required: false },
          { id: "cec_allergies", label: "Allergies", type: "textarea", required: false, placeholder: "List any allergies and reactions..." },
          { id: "cec_sig", label: "Signature", type: "signature", required: true, autofill: { source: "logged-in client", from: "currentUser", confidence: 0.9, safe: false } },
          { id: "cec_date", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
        ],
      },
    ],
  },
  clientCarePreferences: {
    key: "clientCarePreferences",
    name: "Care Preferences",
    category: "Client",
    version: 1,
    estMin: 3,
    icon: "home",
    description: "Tell us your daily preferences, routine, and any special requests.",
    subject: "self",
    completedBy: ["client"],
    interpretation: { purpose: "Capture the client's daily care preferences and routine.", cadence: "At admission and whenever preferences change" },
    sections: [
      {
        id: "ccp1",
        title: "Daily routine",
        fields: [
          { id: "ccp_wake", label: "Preferred wake time", type: "time", required: false },
          { id: "ccp_bed", label: "Preferred bedtime", type: "time", required: false },
          { id: "ccp_bath", label: "Bathing preference", type: "radio", required: false, options: [{ label: "Morning" }, { label: "Evening" }, { label: "No preference" }] },
          { id: "ccp_diet", label: "Dietary preferences or restrictions", type: "textarea", required: false, placeholder: "Foods you prefer or must avoid..." },
          { id: "ccp_special", label: "Special requests", type: "textarea", required: false, placeholder: "Anything else we should know about your care..." },
        ],
      },
      {
        id: "ccp2",
        title: "Sign-off",
        fields: [
          { id: "ccp_sig", label: "Signature", type: "signature", required: true, autofill: { source: "logged-in client", from: "currentUser", confidence: 0.9, safe: false } },
          { id: "ccp_date", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
        ],
      },
    ],
  },
  clientSatisfaction: {
    key: "clientSatisfaction",
    name: "Satisfaction Survey",
    category: "Client",
    version: 1,
    estMin: 2,
    icon: "checkCircle",
    description: "Share feedback about your recent care visits.",
    subject: "self",
    completedBy: ["client"],
    interpretation: { purpose: "Gather client feedback on care quality.", cadence: "Any time" },
    sections: [
      {
        id: "csat1",
        title: "Your feedback",
        fields: [
          { id: "csat_overall", label: "Overall, how satisfied are you with your care?", type: "radio", required: true, options: [{ label: "Very satisfied" }, { label: "Satisfied" }, { label: "Neutral" }, { label: "Dissatisfied" }] },
          { id: "csat_plan", label: "Does your caregiver follow your care plan?", type: "radio", required: true, options: [{ label: "Yes" }, { label: "No" }, { label: "Unsure" }] },
          { id: "csat_ontime", label: "Does your caregiver arrive on time?", type: "radio", required: false, options: [{ label: "Always" }, { label: "Usually" }, { label: "Sometimes" }, { label: "Rarely" }] },
          { id: "csat_comments", label: "Additional comments", type: "textarea", required: false, placeholder: "Tell us more about your experience..." },
        ],
      },
      {
        id: "csat2",
        title: "Sign-off",
        fields: [
          { id: "csat_name", label: "Your name", type: "text", required: false, autofill: { source: "logged-in client", from: "currentUser", confidence: 0.9, safe: true } },
          { id: "csat_date", label: "Date", type: "date", required: true, autofill: { source: "today's date", from: "today", confidence: 0.99, safe: true } },
        ],
      },
    ],
  },
};

const formMeta = {
  fallRisk: { subject: "client" },
  medicationList: { subject: "client" },
  workplaceViolence: { subject: "self" },
  caregiverActivity: { subject: "client" },
  supervisoryVisit: { subject: "client" },
  clientCarePlanReview: { subject: "self" },
  emergencyPreparedness: { subject: "self" },
  clientEmergencyContacts: { subject: "self" },
  clientCarePreferences: { subject: "self" },
  clientSatisfaction: { subject: "self" },
};

function resolveAutofill(field, ctx) {
  const autofill = field.autofill;
  if (!autofill) {
    return null;
  }

  if (autofill.from === "today") {
    return TODAY_ISO;
  }

  if (autofill.from === "currentUser") {
    return ctx.currentUser ? ctx.currentUser.name || ctx.currentUser.label || "" : "";
  }

  if (ctx.client && autofill.from in ctx.client) {
    return ctx.client[autofill.from];
  }

  return null;
}

function computeScore(schema, values) {
  let total = 0;

  schema.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.type !== "radio" || !Array.isArray(field.options)) {
        return;
      }

      const selected = values[field.id];
      const option = field.options.find((item) => item.label === selected);
      if (option && typeof option.score === "number") {
        total += option.score;
      }
    });
  });

  let tier = null;
  if (schema.tiers) {
    tier = schema.tiers.find((item) => total <= item.max) || schema.tiers[schema.tiers.length - 1];
  }

  return { total, tier };
}

function hasScoring(schema) {
  return schema.sections.some((section) => section.fields.some((field) => field.type === "computed"));
}

function invalidFieldsInSection(section, values) {
  const invalid = [];

  section.fields.forEach((field) => {
    if (!field.required) {
      return;
    }

    const value = values[field.id];
    if (field.type === "checkbox") {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        invalid.push(field.id);
      }
      return;
    }

    if (field.type === "table") {
      if (!Array.isArray(value) || !value.some((row) => Object.values(row || {}).some(Boolean))) {
        invalid.push(field.id);
      }
      return;
    }

    if (field.type === "signature") {
      if (!value) {
        invalid.push(field.id);
      }
      return;
    }

    if (value === undefined || value === null || String(value).trim() === "") {
      invalid.push(field.id);
    }
  });

  return invalid;
}

export const DTC = {
  TODAY_ISO,
  get currentUser() {
    return getStoredUser();
  },
  schemas,
  formMeta,
  resolveAutofill,
  computeScore,
  hasScoring,
  invalidFieldsInSection,
  formList: Object.keys(schemas),
};
