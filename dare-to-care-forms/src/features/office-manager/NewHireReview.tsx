// ── NewHireReview ──────────────────────────────────────────────────────────
//
// One screen per new hire showing everything about them in one place — the
// packet forms as they're signed, and the course certificates as they land from
// courses.daretocarehomecare.com. Both update live, so the office manager can
// watch onboarding fill in rather than chasing paperwork and emails separately.
//
// It also holds the two decisions only a person should make:
//
//   1. Release training. Courses are the last thing before being hired on, so
//      they stay locked until the paperwork is in AND someone releases them.
//      The packet landing is not by itself permission to start training.
//   2. Verify and hire on. Once forms and certificates are complete, promoting
//      the person to caregiver is a deliberate act, recorded against whoever
//      did it.
//
// Both buttons say why they are unavailable rather than simply being dead —
// an office manager who cannot tell whether a control is broken or merely not
// yet applicable will go and ask somebody, which is the cost of a silent
// disabled state.

import { useEffect, useState } from "react";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
import { FiledDocuments } from "../../components/FiledDocuments";
import { packetProgress, paperworkComplete } from "../new-hire/packet";
import { fmtDate } from "../../utils/format";
import {
  Icon, Button, Stamp, MonoLabel, Panel, RecordRow, EmptyState, Chip, Text,
  // @ts-ignore - design system is untyped JSX
} from "../../design/index.js";
// @ts-ignore - untyped JSX
import { SheetHeader, useAreaLabel } from "../../console/Chrome.jsx";

// Must match window.DTC_COURSES on the course site — this is how a certificate
// is matched back to the module it proves.
const REQUIRED_COURSES = [
  { id: "emergency", title: "Emergency Preparedness & Disaster Planning" },
  { id: "home-safety", title: "Home Safety" },
  { id: "abuse", title: "Abuse & Neglect Prevention" },
  { id: "first-aid", title: "Basic First Aid" },
  { id: "infection", title: "Infection Control & Universal Precautions" },
  { id: "rights", title: "Consumer Rights & Behavior Management" },
];

export function NewHireReview({ onToast }: { onToast: (m: string) => void }) {
  const area = useAreaLabel();
  const [, force] = useState(0);
  const [openHire, setOpenHire] = useState<any>(null);
  const [busy, setBusy] = useState("");
  useEffect(() => Store.subscribe(() => force((v) => v + 1)), []);

  const newHires = Store.getUsers().filter((u: any) => u.role === "newHire");

  const statusOf = (hire: any) => {
    const filed = new Set<string>(
      Store.submissionsForSubject("staff", hire.id)
        .filter((s: any) => s.status !== "needsCorrection")
        .map((s: any) => String(s.schemaKey)),
    );
    const certs = Store.certificatesForUser ? Store.certificatesForUser(hire) : [];
    const passed = new Set(certs.map((c: any) => c.courseId));
    // Counted in requirements, not files: the packet holds two job descriptions
    // and asks for one, so counting keys reported 11 of 12 forever.
    const forms = packetProgress(filed);
    return {
      filed,
      formsDone: forms.done,
      formsTotal: forms.total,
      paperworkDone: paperworkComplete(filed),
      certs,
      passed,
      coursesDone: REQUIRED_COURSES.filter((c) => passed.has(c.id)).length,
      coursesTotal: REQUIRED_COURSES.length,
      released: !!hire.coursesUnlockedAt,
    };
  };

  const releaseTraining = async (hire: any) => {
    setBusy(hire.id);
    try {
      await Store.updateUser(hire.id, {
        coursesUnlockedAt: new Date().toISOString(),
        coursesUnlockedBy: Store.currentUser?.name || "Office Manager",
      });
      onToast(`Training released for ${hire.name}`);
    } catch (err: any) {
      onToast(err?.message || "Could not release training");
    } finally { setBusy(""); }
  };

  const hireOn = async (hire: any) => {
    setBusy(hire.id);
    try {
      await Store.updateUser(hire.id, {
        role: "caregiver",
        onboardingVerifiedAt: new Date().toISOString(),
        onboardingVerifiedBy: Store.currentUser?.name || "Office Manager",
      });
      onToast(`${hire.name} is now a caregiver`);
      setOpenHire(null);
    } catch (err: any) {
      onToast(err?.message || "Could not hire");
    } finally { setBusy(""); }
  };

  // ── One hire, in detail ──────────────────────────────────────────────────
  if (openHire) {
    const hire = newHires.find((h: any) => h.id === openHire.id) || openHire;
    const s = statusOf(hire);
    const ready = s.paperworkDone && s.coursesDone === s.coursesTotal;
    const working = busy === hire.id;

    return (
      <>
        <SheetHeader
          eyebrow={`${area} / New hires / ${hire.name}`}
          title={hire.name}
          lead={`${s.formsDone} of ${s.formsTotal} forms signed · ${s.coursesDone} of ${s.coursesTotal} courses passed · training ${s.released ? "released" : "not yet released"}.`}
          actions={
            <>
              <Button variant="outline" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={() => setOpenHire(null)}>
                All new hires
              </Button>
              {!s.released && (
                <Button
                  variant="secondary"
                  disabled={!s.paperworkDone || working}
                  iconLeft={<Icon name="lock" size={16} />}
                  onClick={() => releaseTraining(hire)}
                >
                  {working ? "Working…" : "Release training"}
                </Button>
              )}
              <Button disabled={!ready || working} iconLeft={<Icon name="check" size={16} />} onClick={() => hireOn(hire)}>
                {working ? "Working…" : "Verify & hire on"}
              </Button>
            </>
          }
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
          <Stamp tone={s.paperworkDone ? "success" : "neutral"}>
            {s.paperworkDone ? "Paperwork in" : "Paperwork pending"}
          </Stamp>
          <Stamp tone={s.released ? "success" : "neutral"}>
            {s.released ? "Training released" : "Training locked"}
          </Stamp>
          {ready && <Stamp tone="brand">Ready to hire on</Stamp>}
          {hire.email && <Chip icon={<Icon name="send" size={14} />}>{hire.email}</Chip>}
        </div>

        {/* Why a control is unavailable, said once and in plain words. */}
        {!ready && (
          <Panel tone="sunken" padding={18} style={{ marginBottom: 30, maxWidth: 760 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: "var(--text-secondary)", flex: "0 0 auto", marginTop: 1 }}>
                <Icon name="clock" size={18} />
              </span>
              <Text role="body" color="secondary" style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                {!s.paperworkDone
                  ? `${hire.name} still has paperwork to sign, so training can't be released yet.`
                  : !s.released
                    ? "The packet is signed. Releasing training is your call — it opens the courses on the training site."
                    : `Training is released. ${hire.name} can be hired on once all ${s.coursesTotal} certificates are back.`}
              </Text>
            </div>
          </Panel>
        )}

        <div className="split" style={{ alignItems: "start" }}>
          <section>
            <MonoLabel rule style={{ marginBottom: 12 }}>Signed paperwork</MonoLabel>
            <FiledDocuments
              subjectType="staff"
              subjectId={hire.id}
              subjectName={hire.name}
              emptyHint={`${hire.name} hasn't filed any paperwork yet.`}
            />
          </section>

          <aside>
            <MonoLabel rule count={`${s.coursesDone}/${s.coursesTotal}`} style={{ marginBottom: 12 }}>
              Course certificates
            </MonoLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {REQUIRED_COURSES.map((c) => {
                const cert = s.certs.find((x: any) => x.courseId === c.id);
                return (
                  <RecordRow
                    key={c.id}
                    icon={<Icon name={cert ? "award" : s.released ? "clock" : "lock"} size={17} />}
                    title={c.title}
                    subtitle={cert && cert.score != null ? `Score ${cert.score}` : ""}
                    meta={cert && cert.date ? fmtDate(String(cert.date).slice(0, 10)) : ""}
                    stamp={
                      cert
                        ? <Stamp tone="success">Passed</Stamp>
                        : <Stamp tone="neutral">{s.released ? "Not yet" : "Locked"}</Stamp>
                    }
                    accentEdge={!!cert}
                  />
                );
              })}
            </div>
          </aside>
        </div>
      </>
    );
  }

  // ── Roster ───────────────────────────────────────────────────────────────
  const readyCount = newHires.filter((h: any) => {
    const s = statusOf(h);
    return s.paperworkDone && s.coursesDone === s.coursesTotal;
  }).length;

  return (
    <>
      <SheetHeader
        eyebrow={`${area} / New hires`}
        title="New hires"
        lead={
          newHires.length === 0
            ? "Nobody is onboarding right now."
            : `${newHires.length} ${newHires.length === 1 ? "person is" : "people are"} working through onboarding.${
                readyCount > 0 ? ` ${readyCount} ready to hire on.` : ""
              }`
        }
      />

      {newHires.length === 0 ? (
        <EmptyState
          title="Nobody is onboarding"
          description="Create a new hire from the Team screen to start a packet."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 880 }}>
          {newHires.map((h: any) => {
            const s = statusOf(h);
            const ready = s.paperworkDone && s.coursesDone === s.coursesTotal;
            return (
              <RecordRow
                key={h.id}
                icon={<Icon name="users" size={17} />}
                title={h.name}
                subtitle={[
                  h.email,
                  `${s.formsDone}/${s.formsTotal} forms`,
                  `${s.coursesDone}/${s.coursesTotal} courses`,
                  s.released ? "training released" : "training locked",
                ].filter(Boolean).join(" · ")}
                stamp={
                  ready
                    ? <Stamp tone="brand">Ready</Stamp>
                    : s.paperworkDone
                      ? <Stamp tone="info">In training</Stamp>
                      : <Stamp tone="neutral">Paperwork</Stamp>
                }
                accentEdge={ready}
                onClick={() => setOpenHire(h)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
