import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
// @ts-ignore
import { DTCStore as Store } from "../../components/store";
// @ts-ignore
import { Icon } from "../../components/fields";
import { FormWizard, RecordViewer, getSchema } from "../../components/forms/FormWizard";
import { fmtDate } from "../../utils/format";

// Real acknowledgement forms new hires must complete (verbatim schemas).
const NEW_HIRE_FORM_KEYS = ["workplaceViolence", "emergencyPreparedness", "clientCarePlanReview"];

// These ids/titles must match window.DTC_COURSES in the dtccourses repo exactly —
// they're how a completed course certificate gets matched back to a checklist step.
const TRAINING_MODULES = [
  { id: "emergency", title: "Emergency Preparedness & Disaster Planning", desc: "Proactive plans, risk assessment, supplies, and communication to keep clients safe during unexpected events.", minutes: 4 },
  { id: "home-safety", title: "Home Safety", desc: "Prevent accidents and create a secure environment — hazards, bathroom and kitchen safety, and medication management.", minutes: 3 },
  { id: "abuse", title: "Abuse & Neglect Prevention", desc: "Identify high-risk situations, recognize warning signs, and protect clients from abuse, neglect, and exploitation.", minutes: 3 },
  { id: "first-aid", title: "Basic First Aid", desc: "Handle common emergencies — cuts, burns, choking, bleeding — and know when to call for professional help.", minutes: 4 },
  { id: "infection", title: "Infection Control & Universal Precautions", desc: "Standard precautions for every client — hand hygiene, PPE, sharps safety, and proper cleaning and disinfection.", minutes: 6 },
  { id: "rights", title: "Consumer Rights & Behavior Management", desc: "Uphold client rights and ethical behavior management — privacy, informed consent, choice, dignity, and respect.", minutes: 5 },
];

type OnboardingStep = {
  id: string;
  title: string;
  desc: string;
  duration: string;
  training?: boolean;
  requiresForms?: boolean;
};

const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome orientation",
    desc: "Review the company overview, mission, and your role at DARE to Care Home Care.",
    duration: "15 min",
  },
  {
    id: "paperwork",
    title: "Complete your paperwork",
    desc: "File your required new-hire forms and policy acknowledgements below.",
    duration: "30 min",
    requiresForms: true,
  },
  ...TRAINING_MODULES.map((m) => ({
    id: m.id,
    title: m.title,
    desc: m.desc,
    duration: `${m.minutes} min video + quiz`,
    training: true,
  })),
  {
    id: "shadow",
    title: "Shadow a senior caregiver",
    desc: "Observe an experienced caregiver on a real visit before your first solo shift.",
    duration: "4 hours",
  },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  );
}

export default function NewHirePortal() {
  const { user } = useAuth();
  const [wizardKey, setWizardKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [formDone, setFormDone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [myForms, setMyForms] = useState<any[]>([]);
  const [myCerts, setMyCerts] = useState<any[]>([]);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    void Store.refresh().catch(() => {});
    const update = () => {
      const uid = user?.id;
      setMyForms(Store.getSubmissions().filter((s: any) => s.caregiverId === uid));
      setMyCerts(Store.certificatesForUser ? Store.certificatesForUser(user) : []);
    };
    update();
    return Store.subscribe(update);
  }, [user?.id]);

  const submitForm = async ({ schema, values, score }: any) => {
    setSubmitting(true);
    try {
      await Store.addSubmission({ schemaKey: schema.key, clientId: null, clientName: user?.name || null, values, score });
      setWizardKey(null);
      setFormDone(schema.name);
    } finally {
      setSubmitting(false);
    }
  };

  // A training step is done only when a real certificate exists from the course
  // site — no separate in-app "mark complete," so onboarding always reflects
  // what the person actually finished on courses.daretocarehomecare.com.
  const passedCourseIds = useMemo(() => new Set(myCerts.map((c: any) => c.courseId)), [myCerts]);
  const filedFormKeys = useMemo(() => new Set(myForms.map((f: any) => f.schemaKey)), [myForms]);
  const paperworkDone = NEW_HIRE_FORM_KEYS.every((k) => filedFormKeys.has(k));

  const isStepDone = (step: any) => {
    if (step.id === "welcome") return true; // orientation is informational; nothing to file
    if (step.training) return passedCourseIds.has(step.id);
    if (step.requiresForms) return paperworkDone;
    return false; // "shadow" is signed off by an admin/office manager, not self-reported
  };

  const totalSteps = onboardingSteps.length;
  const completedCount = onboardingSteps.filter(isStepDone).length;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  // Open the course site as the same signed-in profile (no second login), deep
  // linked to the specific module so the training step and the course site stay
  // in sync — completion flows back automatically as a certificate.
  const openCourseModule = async (courseId: string) => {
    setOpening(courseId);
    const win = window.open("about:blank", "_blank");
    try {
      const token = await Store.createCourseHandoff();
      const params = new URLSearchParams();
      if (token) params.set("h", token);
      params.set("course", courseId);
      const dest = `https://courses.daretocarehomecare.com?${params.toString()}`;
      if (win) win.location.href = dest;
      else window.open(dest, "_blank");
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="newhire-portal">
      {/* Hero */}
      <div className="newhire-hero">
        <div className="newhire-hero-eyebrow">New Hire Onboarding</div>
        <h1>Welcome, {user?.name?.split(" ")[0] || "there"}!</h1>
        <p>
          We're glad you're here. Complete each step below at your own pace — you'll have full access to the caregiver portal once your onboarding is finished.
        </p>
      </div>

      {/* Progress */}
      <div className="newhire-progress-card">
        <div className="newhire-progress-label">
          Your progress — {completedCount} of {totalSteps} steps completed
        </div>
        <div className="newhire-progress-bar">
          <div className="newhire-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="newhire-progress-pct">{progressPct}% complete</div>
      </div>

      {/* Steps */}
      <div className="newhire-section-title">Onboarding checklist</div>
      <div className="newhire-steps">
        {onboardingSteps.map((step, idx) => {
          const isDone = isStepDone(step);
          // Training modules can be taken in any order (same as the course site);
          // only "shadow" waits on everything else being real.
          const isLocked = !isDone && step.id === "shadow" && !onboardingSteps.filter((s) => s.id !== "shadow").every(isStepDone);

          return (
            <div
              key={step.id}
              className={`newhire-step ${isDone ? "is-done" : ""} ${isLocked ? "locked" : ""}`}
            >
              <div className="newhire-step-num">
                {isDone ? <CheckIcon /> : isLocked ? <LockIcon /> : idx + 1}
              </div>
              <div className="newhire-step-body">
                <strong>{step.title}</strong>
                <span>{step.desc}</span>
                {step.duration && (
                  <span style={{ display: "block", marginTop: 6, fontSize: 11, color: "var(--accent-2)", fontWeight: 700 }}>
                    ⏱ {step.duration}
                  </span>
                )}
              </div>
              {!isLocked && step.id !== "shadow" && (
                <button
                  className={`newhire-step-action ${isDone ? "is-done" : ""}`}
                  onClick={() => {
                    if (isDone) return;
                    if (step.training) { void openCourseModule(step.id); return; }
                    if (step.requiresForms) {
                      const nextKey = NEW_HIRE_FORM_KEYS.find((k) => !filedFormKeys.has(k));
                      if (nextKey) setWizardKey(nextKey);
                      return;
                    }
                  }}
                  disabled={isDone || opening === step.id}
                >
                  {isDone ? "Done ✓" : opening === step.id ? "Opening…" : step.training ? "Start on courses site" : step.requiresForms ? "Fill out" : "Begin"}
                </button>
              )}
              {step.id === "shadow" && (
                <span style={{ fontSize: 11.5, color: "var(--ink-3)", flexShrink: 0, textAlign: "right", maxWidth: 120 }}>
                  {isDone ? "Confirmed ✓" : isLocked ? "Unlocks after training" : "Signed off by your office manager"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Required forms & acknowledgements */}
      <div className="newhire-section-title">Required forms &amp; acknowledgements</div>
      <div className="client-forms-grid">
        {NEW_HIRE_FORM_KEYS.map((key) => {
          const schema = getSchema(key);
          if (!schema) return null;
          const filed = myForms.some((s: any) => s.schemaKey === key);
          return (
            <button key={key} className="client-form-card" onClick={() => setWizardKey(key)}>
              <div className="client-form-icon"><Icon n={schema.icon || "file"} s={22} /></div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <strong>{schema.name}</strong>
                <span>{schema.description}</span>
              </div>
              {filed
                ? <span className="stat ok" style={{ flexShrink: 0 }}>Filed ✓</span>
                : <Icon n="chevron" s={16} style={{ color: "var(--ink-4)", flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {myForms.length > 0 && (
        <>
          <div className="newhire-section-title">Your submitted forms</div>
          <div className="card" style={{ padding: "4px 16px" }}>
            {myForms.map((sub: any) => {
              const schema = getSchema(sub.schemaKey);
              return (
                <button className="subrow" key={sub.id} onClick={() => setViewing(sub)}>
                  <span className="si"><Icon n={schema?.icon || "file"} s={18} /></span>
                  <span className="sinfo">
                    <span className="nm">{schema?.name || sub.schemaKey}</span>
                    <span className="meta">{sub.submittedAt ? fmtDate(sub.submittedAt.slice(0, 10)) : "—"}</span>
                  </span>
                  <span className="stat">Filed</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {myCerts.length > 0 && (
        <>
          <div className="newhire-section-title">Your training certificates</div>
          <div className="card" style={{ padding: "4px 16px" }}>
            {myCerts.map((c: any) => (
              <div className="subrow" key={c.id}>
                <span className="si"><Icon n="checkCircle" s={18} /></span>
                <span className="sinfo">
                  <span className="nm">{c.courseTitle || c.courseId}</span>
                  <span className="meta">
                    {c.score != null ? `${c.score}% · ` : ""}
                    {c.date ? fmtDate(String(c.date).slice(0, 10)) : ""} · from courses.daretocarehomecare.com
                  </span>
                </span>
                <span className="stat ok">Passed</span>
              </div>
            ))}
          </div>
        </>
      )}

      {progressPct === 100 && (
        <div style={{
          marginTop: 28,
          padding: "24px 28px",
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(47,138,104,0.12), rgba(47,138,104,0.06))",
          border: "1px solid rgba(47,138,104,0.25)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
          <strong style={{ display: "block", fontSize: 18, marginBottom: 8 }}>Onboarding complete!</strong>
          <span style={{ color: "var(--ink-3)", fontSize: 13 }}>
            Your administrator will review your progress and upgrade your account to full caregiver access.
          </span>
        </div>
      )}

      {wizardKey && (
        <FormWizard
          schemaKey={wizardKey}
          autoApply
          onClose={() => setWizardKey(null)}
          onSubmit={submitForm}
          submitLabel={submitting ? "Filing..." : "Submit & file"}
          isSubmitting={submitting}
        />
      )}

      {formDone && (
        <div className="done">
          <div className="badge-ok"><Icon n="check" s={38} sw={2.6} /></div>
          <h3>Form submitted</h3>
          <p>{formDone} has been filed.</p>
          <div className="acts">
            <button className="btn btn-primary btn-block" onClick={() => setFormDone(null)}>Done</button>
          </div>
        </div>
      )}

      {viewing && <RecordViewer sub={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
