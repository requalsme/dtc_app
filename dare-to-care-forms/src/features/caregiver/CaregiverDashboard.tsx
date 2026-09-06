// The caregiver's four screens: today, forms, records, clients.
//
// This is the most-used surface in the product — a caregiver opens it between
// visits, often on a phone, often in someone's front room. So it is organised
// by urgency rather than by data type: what is late, what is due, what was
// sent back to be fixed, and only then everything else.
//
// Corrections lead deliberately. A submission that came back needs the same
// person to reopen it, and if that is buried under a list of completed work it
// does not get done.

import { useEffect, useState, useCallback } from "react";
// @ts-ignore
import { DTCStore as Store } from "../../components/store";
// @ts-ignore
import { DTC as D } from "../../components/schemas";
import { FormWizard, RecordViewer, getSchema } from "../../components/forms/FormWizard";
import { fmtDate, todayLong } from "../../utils/format";
import {
  Icon, Button, Stamp, MonoLabel, Panel, Input, Select, RecordRow,
  EmptyState, Chip, Text, MetricTile, Dialog,
  // @ts-ignore - design system is untyped JSX
} from "../../design/index.js";
// @ts-ignore - untyped JSX
import { SheetHeader } from "../../console/Chrome.jsx";

// ── Helpers ────────────────────────────────────────────────────────────────

function isLate(dueDateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr); due.setHours(0, 0, 0, 0);
  return due < today;
}

function isDueToday(dueDateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr); due.setHours(0, 0, 0, 0);
  return due.getTime() === today.getTime();
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/** One publishable form, as something you start rather than something you read. */
function FormRow({ schemaKey, onStart }: { schemaKey: string; onStart: () => void }) {
  const schema = getSchema(schemaKey);
  if (!schema) return null;
  return (
    <RecordRow
      icon={<Icon name={schema.category === "Policy" ? "shield" : "file"} size={17} />}
      title={schema.name}
      subtitle={`${schema.category} · ${schema.estMin} min · ${schema.sections.length} ${schema.sections.length === 1 ? "step" : "steps"}`}
      stamp={<Stamp tone="brand">Start</Stamp>}
      onClick={onStart}
    />
  );
}

// ── Today ──────────────────────────────────────────────────────────────────

function TodayTab({ tasks, onStartTask, submissions }: any) {
  const currentUser = Store.currentUser;
  const clients = Store.clients;

  const dueTasks = tasks.filter((t: any) =>
    (t.status === "pending" || t.status === "in_progress") &&
    (isDueToday(t.dueDate) || isLate(t.dueDate))
  );
  const corrections = submissions.filter((s: any) => s.status === "needsCorrection");
  const upcoming = tasks.filter((t: any) =>
    t.status === "pending" && !isDueToday(t.dueDate) && !isLate(t.dueDate)
  );
  const totalDue = dueTasks.length + corrections.length;
  const published = Store.publishedKeysFor("caregiver");

  return (
    <>
      <SheetHeader
        eyebrow={todayLong}
        title={`${greeting()}, ${currentUser ? currentUser.name.split(" ")[0] : "there"}`}
        lead={
          totalDue === 0
            ? "Nothing is due today. Anything that comes in will show up here."
            : `${totalDue} ${totalDue === 1 ? "thing needs" : "things need"} your attention today.`
        }
      />

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 12, marginBottom: 34, maxWidth: 700,
      }}>
        <MetricTile label="Due today" value={totalDue} tone={totalDue > 0 ? "alert" : "default"} />
        <MetricTile label="My clients" value={clients.length} />
        <MetricTile label="Filed" value={submissions.length} />
      </div>

      <div className="split" style={{ alignItems: "start" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {corrections.length > 0 && (
            <div>
              <MonoLabel rule count={corrections.length} style={{ marginBottom: 12 }}>
                Sent back to you
              </MonoLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {corrections.map((sub: any) => {
                  const schema = getSchema(sub.schemaKey);
                  return (
                    <RecordRow
                      key={sub.id}
                      icon={<Icon name="alert" size={17} />}
                      title={schema?.name || sub.schemaKey}
                      subtitle={[
                        sub.clientName || "Employee form",
                        sub.correctionNote ? `“${sub.correctionNote}”` : null,
                      ].filter(Boolean).join(" · ")}
                      stamp={<Stamp tone="warning">Fix</Stamp>}
                      accentEdge
                      onClick={() => onStartTask("resubmit", sub)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {dueTasks.length > 0 && (
            <div>
              <MonoLabel rule count={dueTasks.length} style={{ marginBottom: 12 }}>Due today</MonoLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {dueTasks.map((task: any) => {
                  const late = isLate(task.dueDate);
                  return (
                    <RecordRow
                      key={task.id}
                      icon={<Icon name={late ? "alert" : "clock"} size={17} />}
                      title={task.title}
                      subtitle={[task.clientName || "All caregivers", task.recurrence].filter(Boolean).join(" · ")}
                      stamp={<Stamp tone={late ? "error" : "brand"}>{late ? "Late" : "Today"}</Stamp>}
                      accentEdge={late}
                      onClick={() => onStartTask("task", task)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {totalDue === 0 && (
            <EmptyState
              title="All caught up"
              description="Nothing is due today. Anything assigned to you will appear here."
            />
          )}

          {upcoming.length > 0 && (
            <div>
              <MonoLabel rule count={upcoming.length} style={{ marginBottom: 12 }}>Coming up</MonoLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {upcoming.slice(0, 4).map((task: any) => (
                  <RecordRow
                    key={task.id}
                    icon={<Icon name="calendar" size={17} />}
                    title={task.title}
                    subtitle={task.clientName || "All caregivers"}
                    meta={fmtDate(task.dueDate)}
                    onClick={() => onStartTask("task", task)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <aside>
          <MonoLabel rule count={published.length} style={{ marginBottom: 12 }}>Start a form</MonoLabel>
          {published.length === 0 ? (
            <Text role="body" color="quiet" style={{ fontSize: 13.5 }}>
              No forms have been published for you yet.
            </Text>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {published.map((key: string) => (
                <FormRow key={key} schemaKey={key} onStart={() => onStartTask("schema", { schemaKey: key })} />
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

// ── Forms ──────────────────────────────────────────────────────────────────

function FormsTab({ onStart }: any) {
  const published = Store.publishedKeysFor("caregiver");
  return (
    <>
      <SheetHeader
        eyebrow="Caregiver / Forms"
        title="Available forms"
        lead="Everything published for your role. Each one saves as you go, so you can stop and come back."
      />
      {published.length === 0 ? (
        <EmptyState
          title="No forms yet"
          description="Nothing has been published for caregivers. Your office manager publishes forms from the templates library."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 820 }}>
          {published.map((key: string) => (
            <FormRow key={key} schemaKey={key} onStart={() => onStart(key, null)} />
          ))}
        </div>
      )}
    </>
  );
}

// ── Records ────────────────────────────────────────────────────────────────

function RecordsTab({ submissions, onOpen }: any) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const queued = Store.getQueuedSubmissions ? Store.getQueuedSubmissions() : [];

  const filtered = submissions.filter((sub: any) => {
    if (filter === "corrections" && sub.status !== "needsCorrection") return false;
    if (filter === "reviewed" && sub.status !== "reviewed") return false;
    if (filter === "filed" && sub.status === "needsCorrection") return false;
    if (search) {
      const q = search.toLowerCase();
      const schema = getSchema(sub.schemaKey);
      const name = schema?.name || sub.schemaKey;
      if (!name.toLowerCase().includes(q) && !sub.clientName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalCount = queued.length + submissions.length;

  return (
    <>
      <SheetHeader
        eyebrow="Caregiver / Records"
        title="My records"
        lead="Every form you have filed, with the signed document it produced."
      />

      {totalCount > 0 && (
        <div style={{ display: "flex", gap: 12, margin: "0 0 26px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ width: 300 }}>
            <Input
              placeholder="Search forms or clients"
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              iconLeft={<Icon name="search" size={17} />}
            />
          </div>
          <div style={{ width: 190 }}>
            <Select
              value={filter}
              onChange={(e: any) => setFilter(e.target.value)}
              options={[
                { value: "all", label: "All records" },
                { value: "corrections", label: "Needs correction" },
                { value: "reviewed", label: "Reviewed" },
                { value: "filed", label: "Filed" },
              ]}
            />
          </div>
          <span style={{ flex: 1 }} />
          <MonoLabel count={totalCount}>Total</MonoLabel>
        </div>
      )}

      {/* Work done with no signal. It is on this device and nowhere else yet,
          which is worth saying plainly rather than showing as ordinary. */}
      {queued.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <MonoLabel rule count={queued.length} style={{ marginBottom: 12 }}>Waiting to upload</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {queued.map((item: any) => {
              const schema = getSchema(item.schemaKey);
              return (
                <RecordRow
                  key={item.id}
                  icon={<Icon name="wifi" size={17} />}
                  title={schema?.name || item.schemaKey}
                  subtitle={[item.clientName, `queued ${fmtDate(item.queuedAt?.slice(0, 10))}`].filter(Boolean).join(" · ")}
                  stamp={<Stamp tone="warning">Pending</Stamp>}
                  accentEdge
                />
              );
            })}
          </div>
          <Text role="body" color="quiet" style={{ fontSize: 12.5, marginTop: 10, display: "block" }}>
            These send on their own once you have a connection.
          </Text>
        </div>
      )}

      {submissions.length === 0 && queued.length === 0 ? (
        <EmptyState
          title="No records yet"
          description="Forms you complete will appear here, each with its signed PDF."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing matches that" description="Try a different search, or clear the filter." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 880 }}>
          {filtered.map((sub: any) => {
            const schema = getSchema(sub.schemaKey);
            const needsCorrection = sub.status === "needsCorrection";
            return (
              <RecordRow
                key={sub.id}
                icon={<Icon name={needsCorrection ? "alert" : "file"} size={17} />}
                title={schema ? schema.name : sub.schemaKey}
                subtitle={[
                  sub.clientName,
                  needsCorrection && sub.correctionNote ? `“${sub.correctionNote}”` : null,
                ].filter(Boolean).join(" · ")}
                meta={sub.submittedAt ? fmtDate(sub.submittedAt.slice(0, 10)) : "—"}
                stamp={
                  <Stamp tone={needsCorrection ? "warning" : sub.status === "reviewed" ? "success" : "neutral"}>
                    {needsCorrection ? "Correction" : sub.status === "reviewed" ? "Reviewed" : "Filed"}
                  </Stamp>
                }
                accentEdge={needsCorrection}
                onClick={() => onOpen(sub)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Clients ────────────────────────────────────────────────────────────────

function ClientsTab() {
  const clients = Store.clients;
  return (
    <>
      <SheetHeader
        eyebrow="Caregiver / Clients"
        title="My clients"
        lead="The people assigned to you, with the details you need before a visit."
      />
      {clients.length === 0 ? (
        <EmptyState
          title="No clients assigned"
          description="Your office manager assigns clients to you. They'll appear here."
        />
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 14, maxWidth: 940,
        }}>
          {clients.map((client: any) => (
            <Panel key={client.id} padding={20}>
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start", marginBottom: 14 }}>
                <span style={{
                  display: "grid", placeItems: "center", width: 40, height: 40, flex: "0 0 auto",
                  borderRadius: "var(--radius-pill)", background: "var(--surface-accent)",
                  color: "var(--brand-accent)", fontFamily: "var(--font-label)",
                  fontSize: 13, fontWeight: 600,
                }}>{client.initials}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--text-body)" }}>{client.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-quiet)", marginTop: 2 }}>
                    DOB {fmtDate(client.dob)} · MRN {client.mrn}
                  </div>
                </div>
              </div>

              {/* Allergies lead because they are the thing that changes what a
                  caregiver does in the next hour. */}
              {client.allergies && (
                <div style={{ marginBottom: 12 }}>
                  <Chip icon={<Icon name="alert" size={13} />}>Allergies: {client.allergies}</Chip>
                </div>
              )}

              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {client.physician && <div>{client.physician}</div>}
                {client.phone && <div>{client.phone}</div>}
              </div>

              {client.notes && (
                <Text role="body" color="quiet" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 12, display: "block" }}>
                  {client.notes}
                </Text>
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function CaregiverDashboard({ page = "today", onNav }: { page: string; onNav: (p: string) => void }) {
  const [wizard, setWizard] = useState<any>(null);
  const [resubmitting, setResubmitting] = useState<any>(null); // submission being corrected
  const [submissions, setSubmissions] = useState<any[]>(() =>
    Store.getSubmissions().filter((s: any) => s.caregiverId === D.currentUser?.id)
  );
  const [tasks, setTasks] = useState<any[]>(() =>
    Store.getTasks().filter((t: any) => t.assignedToId === D.currentUser?.id)
  );
  const [done, setDone] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null); // task being fulfilled

  useEffect(() => {
    void Store.refresh().catch(() => {});
    return Store.subscribe(() => {
      const currentId = D.currentUser?.id;
      setSubmissions(Store.getSubmissions().filter((s: any) => s.caregiverId === currentId));
      setTasks(Store.getTasks().filter((t: any) => t.assignedToId === currentId));
    });
  }, []);

  // Start a form from a task, schema key, or resubmit
  const handleStartTask = useCallback((type: string, data: any) => {
    if (type === "resubmit") {
      // Open wizard pre-filled with previous values for correction
      setResubmitting(data);
      const client = data.clientId ? Store.clients.find((c: any) => c.id === data.clientId) : null;
      setWizard({ schemaKey: data.schemaKey, client, prefillValues: data.values, correctionSub: data });
    } else if (type === "task") {
      const client = data.clientId ? Store.clients.find((c: any) => c.id === data.clientId) : null;
      setActiveTask(data);
      setWizard({ schemaKey: data.schemaKey, client });
    } else {
      // Direct schema start
      setWizard({ schemaKey: data.schemaKey, client: null });
    }
  }, []);

  const startForm = (schemaKey: string, client: any) => setWizard({ schemaKey, client });

  const submit = async ({ schema, values, score, client, sheetEl }: any) => {
    setIsSubmitting(true);
    try {
      if (resubmitting) {
        // Resubmit corrected form
        const resaved = await Store.resubmitSubmission(resubmitting.id, {
          schemaKey: schema.key,
          clientId: client ? client.id : null,
          clientName: client ? client.name : null,
          values, score,
        });
        // Re-file so the stored PDF always reflects the corrected version.
        await Store.fileSubmissionPdf(
          { ...resubmitting, ...resaved, clientId: client ? client.id : null, clientName: client ? client.name : null },
          sheetEl,
        );
        setResubmitting(null);
      } else {
        const saved = await Store.addSubmission({
          schemaKey: schema.key,
          clientId: client ? client.id : null,
          clientName: client ? client.name : null,
          values, score,
        });
        // File the approved document against the client (or, for staff-subject
        // forms, the signer) while the rendered sheet is still mounted.
        await Store.fileSubmissionPdf(saved, sheetEl);
        // Mark task complete if started from a task
        if (activeTask) {
          await Store.updateTask(activeTask.id, { status: "completed", completedAt: new Date().toISOString() });
          setActiveTask(null);
        }
      }
      setWizard(null);
      setDone({ schema, client });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show correction resubmit view for a submission
  const openCorrectionView = (sub: any) => {
    setViewing(null);
    handleStartTask("resubmit", sub);
  };

  return (
    <>
      {page === "today" && <TodayTab onStart={startForm} onStartTask={handleStartTask} submissions={submissions} tasks={tasks} />}
      {page === "forms" && <FormsTab onStart={startForm} />}
      {page === "records" && <RecordsTab submissions={submissions} onOpen={(sub: any) => setViewing(sub)} />}
      {page === "clients" && <ClientsTab />}

      {wizard ? (
        <FormWizard
          schemaKey={wizard.schemaKey}
          initialClient={wizard.client}
          prefillValues={wizard.prefillValues}
          correctionNote={wizard.correctionSub?.correctionNote}
          autoApply
          onClose={() => { setWizard(null); setResubmitting(null); setActiveTask(null); }}
          onSubmit={submit}
          submitLabel={isSubmitting ? (resubmitting ? "Resubmitting..." : "Filing...") : (resubmitting ? "Resubmit corrected form" : "Submit & file")}
          isSubmitting={isSubmitting}
          isResubmit={!!resubmitting}
        />
      ) : null}

      <Dialog
        open={!!done}
        title="Form submitted"
        description={done ? `${done.schema.name}${done.client ? ` for ${done.client.name}` : ""} has been filed with its signed PDF.` : ""}
        icon={<Icon name="checkCircle" size={20} />}
        onClose={() => { setDone(null); if (onNav) onNav("today"); }}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDone(null); if (onNav) onNav("today"); }}>
              Back to today
            </Button>
            <Button onClick={() => { setDone(null); if (onNav) onNav("records"); }}>
              View my records
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-quiet)" }}>
          <Icon name="lock" size={14} />
          <span>Audit event recorded · PDF generated</span>
        </div>
      </Dialog>

      {viewing ? (
        <RecordViewer
          sub={viewing}
          onClose={() => setViewing(null)}
          onResubmit={viewing.status === "needsCorrection" ? openCorrectionView : undefined}
        />
      ) : null}
    </>
  );
}
