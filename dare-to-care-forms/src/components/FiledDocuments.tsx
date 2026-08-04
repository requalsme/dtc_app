// ── FiledDocuments ─────────────────────────────────────────────────────────
//
// The digital filing cabinet: every completed form filed under the name of the
// person it belongs to. Client-subject forms (care plans, supervisory visits,
// fall risk) file under the client; staff-subject forms (new-hire paperwork,
// policy acknowledgements) file under the staff member who signed them.
//
// This replaces the old habit of printing a finished form and dropping it in a
// physical folder — and the flat, ungrouped list that made the previous forms
// tool hard to search.

import { useMemo, useState } from "react";
// @ts-ignore
import { Icon } from "./fields.jsx";
// @ts-ignore
import { DTCStore as Store } from "./store.js";
import { getSchema } from "./forms/FormWizard";
import { fmtDate } from "../utils/format";

type SubjectType = "client" | "staff";

export function FiledDocuments({
  subjectType,
  subjectId,
  subjectName,
  onOpen,
  emptyHint,
}: {
  subjectType: SubjectType;
  subjectId: string;
  subjectName?: string;
  onOpen?: (sub: any) => void;
  emptyHint?: string;
}) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState("all");

  const records = useMemo(
    () => Store.submissionsForSubject(subjectType, subjectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjectType, subjectId, Store.getSubmissions().length],
  );

  const years = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r: any) => {
      if (r.submittedAt) set.add(String(r.submittedAt).slice(0, 4));
    });
    return Array.from(set).sort().reverse();
  }, [records]);

  const filtered = records.filter((sub: any) => {
    if (year !== "all" && String(sub.submittedAt || "").slice(0, 4) !== year) return false;
    if (!q.trim()) return true;
    const schema = getSchema(sub.schemaKey);
    const hay = `${schema?.name || sub.schemaKey} ${sub.templateName || ""} ${sub.caregiverName || ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="filed-docs">
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 180 }}
          placeholder={`Search ${subjectName ? `${subjectName}'s` : ""} documents`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {years.length > 1 && (
          <select className="input" style={{ maxWidth: 120 }} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          {records.length === 0
            ? emptyHint || "No documents filed yet."
            : "No documents match that search."}
        </div>
      ) : (
        <div className="card" style={{ padding: "4px 16px" }}>
          {filtered.map((sub: any) => {
            const schema = getSchema(sub.schemaKey);
            const needsCorrection = sub.status === "needsCorrection";
            return (
              <div className="subrow" key={sub.id} style={{ cursor: onOpen ? "pointer" : "default" }}>
                <span
                  className="si"
                  style={{ color: needsCorrection ? "var(--amber)" : undefined }}
                  onClick={() => onOpen && onOpen(sub)}
                >
                  <Icon n={schema ? schema.icon : "file"} s={18} />
                </span>
                <span className="sinfo" onClick={() => onOpen && onOpen(sub)}>
                  <span className="nm">{schema ? schema.name : sub.templateName || sub.schemaKey}</span>
                  <span className="meta">
                    {sub.submittedAt ? fmtDate(String(sub.submittedAt).slice(0, 10)) : "—"}
                    {/* On a client's file, who completed it matters; on a staff
                        member's own file, that would just repeat their name. */}
                    {subjectType === "client" && sub.caregiverName ? ` · ${sub.caregiverName}` : ""}
                  </span>
                </span>

                {sub.pdfUrl ? (
                  <a
                    className="stat ok"
                    href={sub.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open the filed PDF"
                    onClick={(e) => e.stopPropagation()}
                  >
                    PDF
                  </a>
                ) : sub.pdfPending ? (
                  <span className="stat warn" title="The record is saved; its PDF has not been generated yet.">
                    PDF pending
                  </span>
                ) : (
                  <span className="stat">{needsCorrection ? "Correction" : sub.status === "reviewed" ? "Reviewed" : "Filed"}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
