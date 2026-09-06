// The new hire's own screen — the whole of onboarding, in the order it happens.
//
// WHY THIS SCREEN IS DIFFERENT FROM THE OTHERS
// Everyone else using this app is at work. A new hire is not yet: they have no
// clients, no history, and no idea what this software is. They are here to be
// told what to do next, do it, and find out whether it worked. So the screen is
// organised around a single question — whose move is it right now — rather than
// around the data it happens to hold.
//
// That question has four possible answers and the page states exactly one of
// them at all times: finish your paperwork, wait for your office manager to
// release training, finish your training, or wait to be verified. Two of those
// are waiting states where the next move is somebody else's, and saying so
// plainly is the whole point — a new hire staring at a screen with nothing to
// click and no explanation assumes the system is broken.
//
// WHAT IS DELIBERATELY NOT SELF-SERVE
// Training is released by a person, not by a rule. Paperwork being complete is
// necessary but not sufficient: an office manager reviews it and releases the
// courses. Course completion likewise cannot be claimed here — a step is done
// only when a real certificate comes back from the course site.

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
// @ts-ignore
import { DTCStore as Store } from "../../components/store";
// @ts-ignore
import { TRAINING_MODULES } from "../../components/trainingModules";
import { FormWizard, RecordViewer, getSchema } from "../../components/forms/FormWizard";
import { fmtDate } from "../../utils/format";
// The packet lives in its own module because the office manager's review
// screen has to count it exactly the same way this one does.
import { NEW_HIRE_FORM_KEYS, buildRequirements, paperworkComplete } from "./packet";
import {
  Icon, Button, Stamp, MonoLabel, Panel, RecordRow, DocumentSlot, Chip, Text, Dialog,
  // @ts-ignore - design system is untyped JSX
} from "../../design/index.js";
// @ts-ignore - untyped JSX
import { SheetHeader } from "../../console/Chrome.jsx";

export { NEW_HIRE_FORM_KEYS, paperworkComplete };

type OnboardingStep = {
  id: string;
  title: string;
  desc: string;
  duration: string;
  icon: string;
  training?: boolean;
  requiresForms?: boolean;
};

const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome orientation",
    desc: "Review the company overview, mission, and your role at Dare to Care Home Care.",
    duration: "15 min",
    icon: "hands",
  },
  {
    id: "paperwork",
    title: "Complete your paperwork",
    desc: "File your required new-hire forms and policy acknowledgements below.",
    duration: "30 min",
    icon: "fileText",
    requiresForms: true,
  },
  ...TRAINING_MODULES.map((m: any) => ({
    id: m.id,
    title: m.title,
    desc: m.desc,
    duration: `${m.minutes} min video + quiz`,
    icon: "video",
    training: true,
  })),
  {
    id: "shadow",
    title: "Shadow a senior caregiver",
    desc: "Observe an experienced caregiver on a real visit before your first solo shift.",
    duration: "4 hours",
    icon: "users",
  },
];

/** A plain horizontal meter. The figure beside it is the thing people read. */
function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: "var(--font-figure)", fontSize: 30, lineHeight: 1,
          color: "var(--text-brand)", fontVariantNumeric: "tabular-nums",
        }}>{pct}%</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {done} of {total} steps
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 7, borderRadius: "var(--radius-pill)",
          background: "var(--surface-sunken)", overflow: "hidden",
        }}
      >
        <div style={{
          width: `${pct}%`, height: "100%",
          background: "var(--brand-primary)",
          borderRadius: "var(--radius-pill)",
          transition: "width var(--duration-slow, 400ms) var(--ease-standard)",
        }} />
      </div>
    </div>
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
  const requirements = useMemo(() => buildRequirements(filedFormKeys), [filedFormKeys]);
  const paperworkDone = paperworkComplete(filedFormKeys);

  // Courses are the last thing before being hired on, so they are not self-serve.
  // Two gates, both required: the paperwork has to be in, AND an office manager
  // or above has to release training for this person. Releasing is a deliberate
  // act by the governing body, not something that happens automatically when the
  // last form lands.
  const coursesReleased = !!(user as any)?.coursesUnlockedAt;
  const coursesUnlocked = paperworkDone && coursesReleased;

  const coursesDone = TRAINING_MODULES.every((m: any) => passedCourseIds.has(m.id));
  const coursesRemaining = TRAINING_MODULES.filter((m: any) => !passedCourseIds.has(m.id)).length;
  // Counted from requirements, not from raw keys: the two job descriptions are
  // one requirement, and counting both overstated what is left to do.
  const formsRemaining = requirements.filter((r) => !r.done).length;

  // Exactly one message, always present, describing whose move it is now.
  const nextStep: { title: string; detail: string; waiting?: boolean } = (() => {
    if (!paperworkDone) {
      return {
        title: `Finish your paperwork — ${formsRemaining} form${formsRemaining === 1 ? "" : "s"} left`,
        detail:
          "Work through the forms below. They're the New Hire Packet — job description, policies, and acknowledgements. You can stop and come back; each one saves when you submit it.",
      };
    }
    if (!coursesReleased) {
      return {
        title: "Waiting on your office manager",
        detail:
          "Your paperwork is complete and has gone to your office manager to check over. Once they've reviewed it they'll release your training courses, and this page will update on its own. Nothing else is needed from you right now.",
        waiting: true,
      };
    }
    if (!coursesDone) {
      return {
        title: `Complete your training — ${coursesRemaining} course${coursesRemaining === 1 ? "" : "s"} left`,
        detail:
          "Your training has been released. Open each course below; your certificate comes back here automatically when you pass, so there's nothing to send in.",
      };
    }
    return {
      title: "All done — waiting to be verified",
      detail:
        "Your paperwork and all of your course certificates are in. Your office manager reviews them and confirms your hire. Once they do, you'll move to the caregiver portal automatically. Nothing further is needed from you.",
      waiting: true,
    };
  })();

  const isStepDone = (step: OnboardingStep) => {
    if (step.id === "welcome") return true; // orientation is informational; nothing to file
    if (step.training) return passedCourseIds.has(step.id);
    if (step.requiresForms) return paperworkDone;
    return false; // "shadow" is signed off by an admin/office manager, not self-reported
  };

  const totalSteps = onboardingSteps.length;
  const completedCount = onboardingSteps.filter(isStepDone).length;
  const allDone = completedCount === totalSteps;

  // Open the course site as the same signed-in profile (no second login), deep
  // linked to the specific module so the training step and the course site stay
  // in sync — completion flows back automatically as a certificate.
  const openCourseModule = async (courseId: string) => {
    // Belt and braces: the buttons are disabled when locked, but never hand out
    // a course-site handoff token for someone who hasn't been released.
    if (!coursesUnlocked) return;
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

  const firstName = user?.name?.split(" ")[0] || "there";
  const nextFormKey = requirements.find((r) => !r.done)?.keys[0];

  return (
    <>
      <SheetHeader
        eyebrow="New hire / Onboarding"
        title={`Welcome, ${firstName}`}
        lead="Everything you need to do before your first shift, in the order it happens. Work at your own pace — each step saves as you go."
      />

      {/* Whose move is it. This is the most important element on the screen and
          is the reason the page exists, so it leads and it is never absent. */}
      <Panel
        accentEdge
        tone={nextStep.waiting ? "sunken" : "default"}
        padding={22}
        style={{ marginBottom: 30, maxWidth: 760 }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{
            display: "grid", placeItems: "center", width: 38, height: 38, flex: "0 0 auto",
            borderRadius: "var(--radius-sm)",
            background: nextStep.waiting ? "var(--surface-sunken)" : "var(--surface-accent)",
            color: nextStep.waiting ? "var(--text-secondary)" : "var(--brand-accent)",
          }}>
            <Icon name={nextStep.waiting ? "clock" : "sparkle"} size={19} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-body)", marginBottom: 6 }}>
              {nextStep.title}
            </div>
            <Text role="body" color="secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
              {nextStep.detail}
            </Text>
            {!nextStep.waiting && !paperworkDone && nextFormKey && (
              <Button
                style={{ marginTop: 16 }}
                iconRight={<Icon name="chevron" size={16} />}
                onClick={() => setWizardKey(nextFormKey)}
              >
                Continue where you left off
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <div className="split" style={{ alignItems: "start" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <div>
            <MonoLabel rule count={requirements.length} style={{ marginBottom: 14 }}>
              Your paperwork
            </MonoLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {requirements.map((req, i) => {
                // An either/or requirement names both forms, because which one
                // applies depends on the role this person was hired into and
                // the packet expects them to know which is theirs.
                const schemas = req.keys.map((k) => getSchema(k)).filter(Boolean);
                if (schemas.length === 0) return null;
                const filedKey = req.keys.find((k) => filedFormKeys.has(k));
                const name = req.either
                  ? schemas.map((s: any) => s.name).join("  or  ")
                  : schemas[0].name;
                return (
                  <DocumentSlot
                    key={req.id}
                    index={i + 1}
                    name={name}
                    state={req.done ? "filed" : "missing"}
                    meta={
                      req.done
                        ? (getSchema(filedKey!) as any)?.name
                        : req.either
                          ? "Sign whichever matches your role"
                          : schemas[0].description
                    }
                    action={
                      req.done ? null : (
                        <Button size="sm" variant="outline" onClick={() => setWizardKey(req.keys[0])}>
                          Fill out
                        </Button>
                      )
                    }
                  />
                );
              })}
            </div>
          </div>

          <div>
            <MonoLabel rule count={totalSteps} style={{ marginBottom: 14 }}>
              Onboarding checklist
            </MonoLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {onboardingSteps.map((step) => {
                const done = isStepDone(step);
                // Training modules can be taken in any order (same as the course
                // site); only "shadow" waits on everything else being real.
                const locked =
                  !done && step.id === "shadow" &&
                  !onboardingSteps.filter((s) => s.id !== "shadow").every(isStepDone);
                const trainingBlocked = !!step.training && !done && !coursesUnlocked;

                let note: string | null = null;
                if (step.id === "shadow") {
                  note = done ? "Confirmed" : locked ? "Unlocks after training" : "Signed off by your office manager";
                } else if (trainingBlocked) {
                  note = paperworkDone
                    ? "Waiting on your office manager to release training"
                    : "Finish your paperwork first";
                }

                const showAction = !locked && step.id !== "shadow" && !trainingBlocked && !done;

                return (
                  <RecordRow
                    key={step.id}
                    icon={<Icon name={done ? "checkCircle" : locked || trainingBlocked ? "lock" : step.icon} size={17} />}
                    title={step.title}
                    subtitle={step.desc}
                    meta={step.duration}
                    stamp={
                      done ? <Stamp tone="success">Done</Stamp>
                        : locked || trainingBlocked ? <Stamp tone="neutral">Locked</Stamp>
                          : <Stamp tone="brand">To do</Stamp>
                    }
                    accentEdge={done}
                    actions={
                      showAction ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={opening === step.id}
                          onClick={() => {
                            if (step.training) { void openCourseModule(step.id); return; }
                            if (step.requiresForms && nextFormKey) setWizardKey(nextFormKey);
                          }}
                        >
                          {opening === step.id ? "Opening…" : step.training ? "Start course" : step.requiresForms ? "Fill out" : "Begin"}
                        </Button>
                      ) : note ? (
                        <span style={{
                          fontSize: 12, color: "var(--text-quiet)", textAlign: "right",
                          maxWidth: 160, display: "block", lineHeight: 1.45,
                        }}>{note}</span>
                      ) : null
                    }
                  />
                );
              })}
            </div>
          </div>

          {myForms.length > 0 && (
            <div>
              <MonoLabel rule count={myForms.length} style={{ marginBottom: 14 }}>
                What you have filed
              </MonoLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {myForms.map((sub: any) => {
                  const schema = getSchema(sub.schemaKey);
                  return (
                    <RecordRow
                      key={sub.id}
                      icon={<Icon name="file" size={17} />}
                      title={(schema as any)?.name || sub.schemaKey}
                      subtitle={sub.submittedAt ? fmtDate(sub.submittedAt.slice(0, 10)) : ""}
                      stamp={<Stamp tone="success">Filed</Stamp>}
                      onClick={() => setViewing(sub)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel label="Your progress">
            <Progress done={completedCount} total={totalSteps} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
              <Chip icon={<Icon name="fileText" size={13} />}>
                {formsRemaining === 0 ? "Paperwork done" : `${formsRemaining} form${formsRemaining === 1 ? "" : "s"} left`}
              </Chip>
              <Chip icon={<Icon name="video" size={13} />}>
                {coursesDone ? "Training done" : `${coursesRemaining} course${coursesRemaining === 1 ? "" : "s"} left`}
              </Chip>
            </div>
          </Panel>

          <Panel label="Training certificates" labelRight={<Stamp tone="neutral" leaf={false}>{String(myCerts.length)}</Stamp>}>
            {myCerts.length === 0 ? (
              <Text role="body" color="quiet" style={{ fontSize: 13, lineHeight: 1.6 }}>
                Certificates appear here on their own once you pass a course. There is nothing to send in.
              </Text>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {myCerts.map((c: any) => (
                  <RecordRow
                    key={c.id}
                    icon={<Icon name="award" size={17} />}
                    title={c.courseTitle || c.courseId}
                    subtitle={[
                      c.score != null ? `${c.score}%` : null,
                      c.date ? fmtDate(String(c.date).slice(0, 10)) : null,
                    ].filter(Boolean).join(" · ")}
                    stamp={<Stamp tone="success">Passed</Stamp>}
                  />
                ))}
              </div>
            )}
          </Panel>

          {allDone && (
            <Panel tone="accent" padding={22}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ color: "var(--brand-accent)", flex: "0 0 auto" }}>
                  <Icon name="leaf" size={22} />
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-brand)", marginBottom: 6 }}>
                    Onboarding complete
                  </div>
                  <Text role="body" color="secondary" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                    Your office manager reviews everything and confirms your hire. You'll move to the caregiver
                    portal automatically once they do.
                  </Text>
                </div>
              </div>
            </Panel>
          )}
        </aside>
      </div>

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

      <Dialog
        open={!!formDone}
        title="Form submitted"
        description={formDone ? `${formDone} has been filed.` : ""}
        icon={<Icon name="checkCircle" size={20} />}
        onClose={() => setFormDone(null)}
        footer={<Button onClick={() => setFormDone(null)}>Done</Button>}
      >
        <Text role="body" color="secondary" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          {formsRemaining > 0
            ? `${formsRemaining} form${formsRemaining === 1 ? "" : "s"} left before your paperwork is complete.`
            : "That was the last one — your paperwork now goes to your office manager."}
        </Text>
      </Dialog>

      {viewing && <RecordViewer sub={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
