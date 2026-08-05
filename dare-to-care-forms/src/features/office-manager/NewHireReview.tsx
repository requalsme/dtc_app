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

import { useEffect, useState } from "react";
// @ts-ignore
import { Icon } from "../../components/fields.jsx";
// @ts-ignore
import { DTCStore as Store } from "../../components/store.js";
import { FiledDocuments } from "../../components/FiledDocuments";
import { NEW_HIRE_FORM_KEYS, paperworkComplete } from "../new-hire/NewHirePortal";
import { fmtDate } from "../../utils/format";

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
    return {
      filed,
      formsDone: NEW_HIRE_FORM_KEYS.filter((k) => filed.has(k)).length,
      formsTotal: NEW_HIRE_FORM_KEYS.length,
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

    return (
      <div>
        <div className="ds-ph">
          <div>
            <button className="btn btn-ghost" style={{ marginBottom: 8 }} onClick={() => setOpenHire(null)}>
              <Icon n="arrowLeft" s={16} /> All new hires
            </button>
            <h1>{hire.name}</h1>
            <p>
              Onboarding file — {s.formsDone} of {s.formsTotal} forms ·{" "}
              {s.coursesDone} of {s.coursesTotal} courses
              {s.released ? " · training released" : " · training not yet released"}
            </p>
          </div>
          <div className="actions">
            {!s.released && (
              <button
                className="dbtn dbtn-ghost"
                disabled={!s.paperworkDone || busy === hire.id}
                title={s.paperworkDone ? "" : "Paperwork must be complete first"}
                onClick={() => releaseTraining(hire)}
              >
                <Icon n="checkCircle" s={15} /> Release training
              </button>
            )}
            <button
              className="dbtn dbtn-primary"
              disabled={!ready || busy === hire.id}
              title={ready ? "" : "All forms and courses must be complete"}
              onClick={() => hireOn(hire)}
            >
              <Icon n="check" s={15} /> Verify &amp; hire on
            </button>
          </div>
        </div>

        <div className="ds-panel" style={{ padding: 16, marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Course certificates</div>
          {REQUIRED_COURSES.map((c) => {
            const cert = s.certs.find((x: any) => x.courseId === c.id);
            return (
              <div key={c.id} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)", alignItems: "baseline" }}>
                <span style={{ flex: 1, fontSize: 13 }}>{c.title}</span>
                {cert ? (
                  <>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      {cert.score != null ? `Score ${cert.score}` : ""}
                    </span>
                    <span className="spill pub" style={{ flex: "none" }}>
                      {cert.date ? fmtDate(String(cert.date).slice(0, 10)) : "Passed"}
                    </span>
                  </>
                ) : (
                  <span className="spill draft" style={{ flex: "none" }}>
                    {s.released ? "Not yet passed" : "Locked"}
                  </span>
                )}
              </div>
            );
          })}
          {!s.released && (
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", paddingTop: 10 }}>
              {s.paperworkDone
                ? "Paperwork is complete — training can be released."
                : "Training unlocks once the packet is signed and you release it."}
            </div>
          )}
        </div>

        <div className="ds-panel" style={{ padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Signed paperwork</div>
          <FiledDocuments
            subjectType="staff"
            subjectId={hire.id}
            subjectName={hire.name}
            emptyHint={`${hire.name} hasn't filed any paperwork yet.`}
          />
        </div>
      </div>
    );
  }

  // ── Roster ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="ds-ph">
        <div>
          <h1>New hires</h1>
          <p>Paperwork and course certificates as they arrive. Release training and hire people on from here.</p>
        </div>
      </div>

      {newHires.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          No one is onboarding right now. Create a new hire from Team to start a packet.
        </div>
      ) : (
        <div className="ds-panel">
          <table className="ds-table">
            <thead>
              <tr><th>New hire</th><th>Paperwork</th><th>Courses</th><th>Training</th><th>Ready</th></tr>
            </thead>
            <tbody>
              {newHires.map((h: any) => {
                const s = statusOf(h);
                const ready = s.paperworkDone && s.coursesDone === s.coursesTotal;
                return (
                  <tr key={h.id} style={{ cursor: "pointer" }} onClick={() => setOpenHire(h)}>
                    <td>
                      <span className="row-ic">
                        <span className="ti">{h.initials}</span>
                        <span>
                          <span className="cell-main">{h.name}</span>
                          <span className="cell-sub">{h.email}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`spill${s.paperworkDone ? " pub" : ""}`}>
                        {s.formsDone}/{s.formsTotal}
                      </span>
                    </td>
                    <td>
                      <span className={`spill${s.coursesDone === s.coursesTotal ? " pub" : ""}`}>
                        {s.coursesDone}/{s.coursesTotal}
                      </span>
                    </td>
                    <td>
                      {s.released
                        ? <span className="spill pub">Released</span>
                        : <span className="spill">Locked</span>}
                    </td>
                    <td>
                      {ready
                        ? <span className="spill pub">Ready to hire on</span>
                        : <span style={{ color: "var(--ink-3)", fontSize: 12 }}>In progress</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
