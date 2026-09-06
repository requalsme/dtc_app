// What a client sees.
//
// The narrowest surface in the app, and the one used by the people least
// likely to want software. A client is elderly more often than not, may be
// using a tablet somebody else set up, and is here for one of two reasons:
// to fill something in, or to check that something they already sent arrived.
// So there are two lists and a phone number, and nothing else.
//
// Client forms render directly rather than waiting on an admin to publish
// them, so the portal is never empty of things to do.

import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthContext";
// @ts-ignore - JS module without types
import { DTCStore as Store } from "../../components/store";
import { FormWizard, RecordViewer, getSchema } from "../../components/forms/FormWizard";
import { fmtDate } from "../../utils/format";
import {
  Icon, Button, Stamp, MonoLabel, Panel, RecordRow, EmptyState, Text, Dialog,
  // @ts-ignore - design system is untyped JSX
} from "../../design/index.js";
// @ts-ignore - untyped JSX
import { SheetHeader } from "../../console/Chrome.jsx";

// Client-facing forms. These render directly (no admin publish needed) so the
// portal is always usable. More Admission Packet documents will be added here.
const CLIENT_FORM_KEYS = ["clientCarePreferences", "clientEmergencyContacts", "clientSatisfaction"];

const OFFICE_PHONE = "(720) 842-2153";

export default function ClientPortal() {
  const { user } = useAuth();
  const [wizardKey, setWizardKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [done, setDone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);

  useEffect(() => {
    void Store.refresh().catch(() => {});
    const update = () => {
      const uid = user?.id;
      // A client's own forms are filed with clientId === their own uid (see
      // submit() below). caregiverId is the staff field — filtering on it here
      // meant this list could only ever show a client their own HR paperwork,
      // which clients don't have, so it was permanently empty in production.
      setSubmissions(Store.getSubmissions().filter((s: any) => s.clientId === uid));
    };
    update();
    return Store.subscribe(update);
  }, [user?.id]);

  const submit = async ({ schema, values, score }: any) => {
    setSubmitting(true);
    try {
      await Store.addSubmission({
        schemaKey: schema.key,
        // Was hardcoded to null, which meant subjectForSubmission() found
        // neither a clientId nor a caregiverId and returned null — the PDF
        // was never generated or filed, silently. The client's own uid IS the
        // client id here (they're signed in as themselves), so this is what
        // actually identifies whose file the record belongs in.
        clientId: user?.id || null,
        clientName: user?.name || null,
        values,
        score,
      });
      setWizardKey(null);
      setDone(schema.name);
    } finally {
      setSubmitting(false);
    }
  };

  const available = CLIENT_FORM_KEYS.map((key) => ({ key, schema: getSchema(key) })).filter((f) => f.schema);

  return (
    <>
      <SheetHeader
        eyebrow="Client"
        title={`Hello, ${user?.name?.split(" ")[0] || "there"}`}
        lead="Your forms and documents. Fill anything in at your own pace — or call the office and we'll do it with you."
      />

      <div className="split" style={{ alignItems: "start" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div>
            <MonoLabel rule count={available.length} style={{ marginBottom: 12 }}>Your forms</MonoLabel>
            {available.length === 0 ? (
              <EmptyState title="No forms right now" description="There is nothing for you to fill in at the moment." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {available.map(({ key, schema }) => (
                  <RecordRow
                    key={key}
                    icon={<Icon name="file" size={17} />}
                    title={schema.name}
                    subtitle={schema.description}
                    stamp={<Stamp tone="brand">Start</Stamp>}
                    onClick={() => setWizardKey(key)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <MonoLabel rule count={submissions.length} style={{ marginBottom: 12 }}>What you have sent</MonoLabel>
            {submissions.length === 0 ? (
              <Text role="body" color="quiet" style={{ fontSize: 13.5 }}>
                Nothing yet. Anything you fill in will be listed here so you can check it arrived.
              </Text>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {submissions.map((sub: any) => {
                  const schema = getSchema(sub.schemaKey);
                  return (
                    <RecordRow
                      key={sub.id}
                      icon={<Icon name="checkCircle" size={17} />}
                      title={schema?.name || sub.schemaKey}
                      subtitle={sub.submittedAt ? fmtDate(sub.submittedAt.slice(0, 10)) : "—"}
                      stamp={<Stamp tone="success">Received</Stamp>}
                      onClick={() => setViewing(sub)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside>
          {/* A phone number, not a contact form. Someone who cannot work out a
              screen needs a person, and this is the most likely reason a client
              opens this page at all. */}
          <Panel tone="accent" padding={22}>
            <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
              <span style={{ color: "var(--brand-accent)", flex: "0 0 auto", marginTop: 2 }}>
                <Icon name="hands" size={22} />
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-brand)", marginBottom: 6 }}>
                  Need a hand?
                </div>
                <Text role="body" color="secondary" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                  Call the office to speak with your care coordinator, change your schedule, or ask
                  anything about your care plan. We can fill any of these in with you over the phone.
                </Text>
                <a
                  href={`tel:${OFFICE_PHONE.replace(/\D/g, "")}`}
                  style={{
                    display: "inline-block", marginTop: 14,
                    fontFamily: "var(--font-figure)", fontSize: 21,
                    color: "var(--text-brand)", textDecoration: "none",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {OFFICE_PHONE}
                </a>
              </div>
            </div>
          </Panel>
        </aside>
      </div>

      {wizardKey && (
        <FormWizard
          schemaKey={wizardKey}
          autoApply
          onClose={() => setWizardKey(null)}
          onSubmit={submit}
          submitLabel={submitting ? "Filing..." : "Submit & file"}
          isSubmitting={submitting}
        />
      )}

      <Dialog
        open={!!done}
        title="Thank you"
        description={done ? `${done} has been sent to your care team.` : ""}
        icon={<Icon name="checkCircle" size={20} />}
        onClose={() => setDone(null)}
        footer={<Button onClick={() => setDone(null)}>Done</Button>}
      >
        <Text role="body" color="secondary" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          There is nothing else you need to do. You can see it any time under “What you have sent”.
        </Text>
      </Dialog>

      {viewing && <RecordViewer sub={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
