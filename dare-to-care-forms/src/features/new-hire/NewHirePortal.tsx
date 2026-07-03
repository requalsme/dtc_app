import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthContext";
// @ts-ignore
import { DTCStore as Store } from "../../components/store";
// @ts-ignore
import { Icon } from "../../components/fields";
import { VideoPlayer } from "../../components/ui/VideoPlayer";
import { FormWizard, RecordViewer, getSchema } from "../../components/forms/FormWizard";
import { fmtDate } from "../../utils/format";

// Real acknowledgement forms new hires must complete (verbatim schemas).
const NEW_HIRE_FORM_KEYS = ["workplaceViolence", "emergencyPreparedness", "clientCarePlanReview"];

const onboardingSteps = [
  {
    id: "welcome",
    title: "Welcome orientation",
    desc: "Review the company overview, mission, and your role at DARE to Care Home Care.",
    duration: "15 min",
  },
  {
    id: "paperwork",
    title: "Complete your paperwork",
    desc: "Fill out your W-4, direct deposit form, emergency contacts, and signed policies.",
    duration: "30 min",
    formKey: "new_hire_paperwork",
  },
  {
    id: "emergency",
    title: "Emergency Preparedness & Disaster Planning",
    desc: "Required training: learn protocols for emergencies in home care settings.",
    duration: "45 min",
    training: true,
  },
  {
    id: "home_safety",
    title: "Home Safety",
    desc: "Identify and mitigate hazards in client homes to keep clients and yourself safe.",
    duration: "30 min",
    training: true,
  },
  {
    id: "first_aid",
    title: "First Aid & Basic Life Safety",
    desc: "Understand first aid principles and when to call emergency services.",
    duration: "60 min",
    training: true,
  },
  {
    id: "infection",
    title: "Infection Control",
    desc: "Best practices for preventing the spread of illness in home care environments.",
    duration: "30 min",
    training: true,
  },
  {
    id: "consumer_rights",
    title: "Consumer Rights & Responsibilities",
    desc: "Understand client rights and how to uphold dignity, privacy, and autonomy.",
    duration: "20 min",
    training: true,
  },
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
  const [completed, setCompleted] = useState<Set<string>>(new Set(["welcome"]));
  const [activeVideoStep, setActiveVideoStep] = useState<typeof onboardingSteps[number] | null>(null);
  const [marking, setMarking] = useState(false);
  const [wizardKey, setWizardKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [formDone, setFormDone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [myForms, setMyForms] = useState<any[]>([]);
  const [myCerts, setMyCerts] = useState<any[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    Store.getMyTrainingProgress()
      .then((progress: Record<string, string>) => {
        if (cancelled) return;
        setCompleted((prev) => new Set([...prev, ...Object.keys(progress)]));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const totalSteps = onboardingSteps.length;
  const completedCount = completed.size;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  const markDone = (id: string) => {
    setCompleted((prev) => new Set([...prev, id]));
  };

  const completeTraining = async (moduleId: string) => {
    setMarking(true);
    try {
      await Store.completeTrainingModule(moduleId);
      markDone(moduleId);
      setActiveVideoStep(null);
    } catch {
      // leave the modal open so the new hire can retry
    } finally {
      setMarking(false);
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
          const isDone = completed.has(step.id);
          const isLocked = !isDone && idx > 0 && !completed.has(onboardingSteps[idx - 1].id);

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
              {!isLocked && (
                <button
                  className={`newhire-step-action ${isDone ? "is-done" : ""}`}
                  onClick={() => {
                    if (isDone) return;
                    if (step.training) { setActiveVideoStep(step); return; }
                    // Persist non-video steps too, so progress survives a refresh.
                    void completeTraining(step.id);
                  }}
                  disabled={isDone}
                >
                  {isDone ? "Done ✓" : step.training ? "Start" : step.formKey ? "Fill out" : "Begin"}
                </button>
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

      {activeVideoStep && (
        <div className="modal-overlay" onClick={() => setActiveVideoStep(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-head">
              <h3>{activeVideoStep.title}</h3>
              <button className="modal-close" onClick={() => setActiveVideoStep(null)}>×</button>
            </div>
            <div className="modal-body">
              <VideoPlayer 
                key={activeVideoStep.id} 
                storagePath={`courses/${activeVideoStep.id}.mp4`} 
                onEnded={() => completeTraining(activeVideoStep.id)} 
              />
            </div>
            <div className="modal-foot">
              <button className="dbtn dbtn-ghost" onClick={() => setActiveVideoStep(null)} disabled={marking}>Close</button>
              <button className="dbtn dbtn-primary" onClick={() => completeTraining(activeVideoStep.id)} disabled={marking}>
                {marking ? "Saving…" : "Mark as complete"}
              </button>
            </div>
          </div>
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
