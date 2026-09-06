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
import { DTCStore as Store } from "./store.js";
import { getSchema } from "./forms/FormWizard";
import { fmtDate } from "../utils/format";
import {
  Icon, Button, Stamp, Input, Select, RecordRow, EmptyState,
  // @ts-ignore - design system is untyped JSX
} from "../design/index.js";

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
    <div>
      {records.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 190 }}>
            <Input
              placeholder={`Search ${subjectName ? `${subjectName}'s` : ""} documents`}
              value={q}
              onChange={(e: any) => setQ(e.target.value)}
              iconLeft={<Icon name="search" size={17} />}
            />
          </div>
          {years.length > 1 && (
            <div style={{ width: 140 }}>
              <Select
                value={year}
                onChange={(e: any) => setYear(e.target.value)}
                options={[{ value: "all", label: "All years" }, ...years.map((y) => ({ value: y, label: y }))]}
              />
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={records.length === 0 ? "Nothing filed yet" : "Nothing matches that"}
          description={records.length === 0
            ? emptyHint || "Completed forms are filed here automatically."
            : "Try a different search, or clear the year filter."}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {filtered.map((sub: any) => {
            const schema = getSchema(sub.schemaKey);
            const needsCorrection = sub.status === "needsCorrection";
            return (
              <RecordRow
                key={sub.id}
                icon={<Icon name={needsCorrection ? "alert" : "file"} size={17} />}
                title={schema ? schema.name : sub.templateName || sub.schemaKey}
                subtitle={[
                  sub.submittedAt ? fmtDate(String(sub.submittedAt).slice(0, 10)) : "—",
                  // On a client's file, who completed it matters; on a staff
                  // member's own file, that would just repeat their name.
                  subjectType === "client" && sub.caregiverName ? sub.caregiverName : null,
                ].filter(Boolean).join(" · ")}
                stamp={
                  <Stamp tone={needsCorrection ? "warning" : sub.status === "reviewed" ? "success" : "neutral"}>
                    {needsCorrection ? "Correction" : sub.status === "reviewed" ? "Reviewed" : "Filed"}
                  </Stamp>
                }
                accentEdge={needsCorrection}
                onClick={onOpen ? () => onOpen(sub) : undefined}
                actions={
                  // The filed PDF is the document itself, so it gets a real
                  // control rather than being one more status word.
                  sub.pdfUrl ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      iconRight={<Icon name="download" size={15} />}
                      onClick={(e: any) => { e.stopPropagation(); window.open(sub.pdfUrl, "_blank", "noopener"); }}
                    >
                      PDF
                    </Button>
                  ) : sub.pdfPending ? (
                    <span
                      title="The record is saved; its PDF has not been generated yet."
                      style={{ fontSize: 12, color: "var(--text-quiet)" }}
                    >
                      PDF pending
                    </span>
                  ) : null
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
