// ── ClientKeyFacts ─────────────────────────────────────────────────────────
//
// The information people actually need at a glance about a client — allergies,
// emergency contact, physician, DNR, dietary restrictions — is captured inside
// the intake packet and the care plan. Once those are filed it is buried in a
// multi-page document, so in practice nobody looks it up.
//
// This reads the most recent submitted value for each fact out of whatever
// forms have been filed, and shows it on the client's file with a note saying
// which form and date it came from. Nothing is duplicated into the client
// record: the filed form stays the single source of truth, this is a view over
// it. If a newer form supersedes a value, this follows automatically.

// @ts-ignore
import { DTCStore as Store } from "./store.js";
import { fmtDate } from "../utils/format";

type Fact = {
  label: string;
  /** Field ids that can hold this fact, best source first. */
  fieldIds: string[];
  /** Flag prominently when present (allergies, DNR). */
  alert?: boolean;
};

// Ordered by how urgently someone walking into the home would need it.
const FACTS: Fact[] = [
  { label: "Allergies", fieldIds: ["ccp_allergies", "cas_allergies"], alert: true },
  { label: "DNR", fieldIds: ["cas_dnr"], alert: true },
  { label: "Advance directive", fieldIds: ["ccp_advance_directive", "adn_has"] },
  { label: "Emergency contact", fieldIds: ["ccp_emergency_contact", "cas_emergency"] },
  { label: "Primary care physician", fieldIds: ["ccp_pcp", "cas_physician"] },
  { label: "Physician phone", fieldIds: ["cas_physician_phone"] },
  { label: "Preferred hospital", fieldIds: ["cas_hospital"] },
  { label: "Dietary restrictions", fieldIds: ["ccp_diet", "cas_diet"] },
  { label: "Medications", fieldIds: ["cas_medications"] },
  { label: "Functional limitations", fieldIds: ["ccp_limitations", "cas_limitations"] },
  { label: "Assistive devices", fieldIds: ["ccp_devices"] },
  { label: "Psychosocial", fieldIds: ["ccp_psychosocial"] },
  { label: "Identified problems", fieldIds: ["ccp_problems"] },
  { label: "Care goals", fieldIds: ["ccp_goals"] },
  { label: "Supervisor", fieldIds: ["ccp_supervisor"] },
];

function displayValue(v: any): string {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  return String(v);
}

export function ClientKeyFacts({ clientId }: { clientId: string }) {
  // Newest first, so the first hit for a field is the most recent value.
  const subs = Store.submissionsForSubject("client", clientId)
    .filter((s: any) => s.status !== "needsCorrection");

  const found = FACTS.map((fact) => {
    for (const sub of subs) {
      const values = sub.values || {};
      for (const fid of fact.fieldIds) {
        const val = displayValue(values[fid]);
        if (val) {
          return {
            ...fact,
            value: val,
            fromForm: sub.templateName || sub.schemaKey,
            fromDate: sub.submittedAt ? String(sub.submittedAt).slice(0, 10) : null,
          };
        }
      }
    }
    return null;
  }).filter(Boolean) as Array<Fact & { value: string; fromForm: string; fromDate: string | null }>;

  if (subs.length === 0) {
    return (
      <div className="card" style={{ padding: 16, color: "var(--ink-3)", fontSize: 13 }}>
        No forms filed yet. Once the intake packet or a care plan is completed,
        the key details are pulled together here automatically.
      </div>
    );
  }

  if (found.length === 0) {
    return (
      <div className="card" style={{ padding: 16, color: "var(--ink-3)", fontSize: 13 }}>
        {subs.length} form{subs.length === 1 ? "" : "s"} filed, but none of them
        captured the intake details yet — those come from the Client Assessment
        or Client Care Plan.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "6px 16px 12px" }}>
      {found.map((f) => (
        <div
          key={f.label}
          style={{
            display: "flex",
            gap: 12,
            padding: "9px 0",
            borderBottom: "1px solid var(--border)",
            alignItems: "baseline",
          }}
        >
          <span style={{ minWidth: 160, flex: "none", fontSize: 12, color: "var(--ink-3)" }}>
            {f.label}
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              color: f.alert ? "var(--amber)" : "var(--ink)",
              whiteSpace: "pre-wrap",
            }}
          >
            {f.value}
          </span>
          {/* Provenance: which filed form this came from, so it can be checked. */}
          <span style={{ flex: "none", fontSize: 11, color: "var(--ink-4)", textAlign: "right" }}>
            {f.fromForm}
            {f.fromDate ? ` · ${fmtDate(f.fromDate)}` : ""}
          </span>
        </div>
      ))}
      <div style={{ fontSize: 11, color: "var(--ink-4)", paddingTop: 10 }}>
        Pulled from filed forms — always the most recent value. Correct one of
        these by filing an updated form, not by editing here.
      </div>
    </div>
  );
}
