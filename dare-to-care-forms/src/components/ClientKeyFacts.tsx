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
import {
  Icon, Panel, Text, EmptyState,
  // @ts-ignore - design system is untyped JSX
} from "../design/index.js";

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
      <EmptyState
        title="Nothing to summarise yet"
        description="Once the intake packet or a care plan is filed, the details worth knowing at a glance are gathered here automatically."
      />
    );
  }

  if (found.length === 0) {
    return (
      <EmptyState
        title="No intake details yet"
        description={`${subs.length} form${subs.length === 1 ? "" : "s"} filed, but none of them captured the intake details — those come from the Client Assessment or the Client Care Plan.`}
      />
    );
  }

  return (
    <Panel padding={0}>
      {found.map((f, i) => (
        <div
          key={f.label}
          style={{
            display: "flex",
            gap: 14,
            padding: "11px 16px",
            borderTop: i ? "1px solid var(--border-hair)" : "none",
            alignItems: "baseline",
            // An allergy or a DNR is the reason this panel exists, so it is
            // marked on the row rather than left to be found in the text.
            background: f.alert ? "var(--warning-bg)" : "transparent",
          }}
        >
          <span style={{ minWidth: 150, flex: "none", fontSize: 12.5, color: "var(--text-secondary)" }}>
            {f.label}
          </span>
          <span style={{
            flex: 1,
            fontSize: 13.5,
            fontWeight: 600,
            color: f.alert ? "var(--status-warning)" : "var(--text-body)",
            whiteSpace: "pre-wrap",
          }}>
            {f.alert && <Icon name="alert" size={13} style={{ marginRight: 6, verticalAlign: "-2px" }} />}
            {f.value}
          </span>
          {/* Provenance: which filed form this came from, so it can be checked. */}
          <span style={{ flex: "none", fontSize: 11.5, color: "var(--text-quiet)", textAlign: "right", maxWidth: 170 }}>
            {f.fromForm}
            {f.fromDate ? ` · ${fmtDate(f.fromDate)}` : ""}
          </span>
        </div>
      ))}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-hair)" }}>
        <Text role="body" color="quiet" style={{ fontSize: 12, lineHeight: 1.6 }}>
          Read from filed forms — always the most recent value. To correct one of these, file an
          updated form rather than editing it here.
        </Text>
      </div>
    </Panel>
  );
}
