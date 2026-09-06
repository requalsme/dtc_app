// What the helper says, per screen.
//
// Written here rather than generated, so the character can never be
// confidently wrong about how this app works. Each screen gets a short title
// and a few tips; anything that is not written down is simply not claimed.
//
// Keep the voice the same as the rest of the app: plain, specific, and about
// what the thing does rather than how to click it.

export const HELP = {
  templates: {
    title: "Templates",
    tips: [
      {
        heading: "What a template is",
        body: "A template is the blank form — the questions themselves. Filling one in creates a submission, which is the answered copy filed against a client or an employee. Editing a template changes what future submissions ask; it never changes ones already filed.",
      },
      {
        heading: "Draft and published",
        body: "A draft is only visible here. Publishing makes the form available to whoever is assigned to complete it, so nothing reaches staff by accident. You can unpublish at any time — existing submissions are unaffected.",
      },
      {
        heading: "Forms that came from paper",
        body: "A form read in from a PDF keeps the original page. Open it and you'll see the scan with each field drawn over the spot it was read from, so answers can be printed back onto the real document rather than a lookalike.",
      },
      {
        heading: "Making a new one",
        body: "Start a form gives you four routes: read one in from a PDF, begin from a familiar shape like a visit note, copy a form that already works, or start blank.",
      },
    ],
  },

  import: {
    title: "Reading a form in from a PDF",
    tips: [
      {
        heading: "What happens to the file",
        body: "The page is read for questions — a prompt followed by space to write in. Those become fields you can edit. The original PDF is kept alongside the template, and it is the document that gets filled and signed, not a recreation of it.",
      },
      {
        heading: "Two kinds of PDF",
        body: "Some PDFs already carry proper form boxes; the federal I-9 is one. Those are read exactly. Most forms are flat printed layouts, and those are read from the position of the text — which works well on real forms and not at all on policy manuals, by design.",
      },
      {
        heading: "Check what came through",
        body: "Detection is good, not perfect. Open the draft and look down the fields before publishing: delete anything that isn't a real question, and fix any answer type that came out wrong. A wrong field becomes a question the form asks forever.",
      },
      {
        heading: "If nothing is found",
        body: "A document that is mostly prose — a manual, a policy packet — will produce few fields or none. That is usually correct: those are documents to read and sign rather than forms to fill. Add a signature field and publish it as an acknowledgement.",
      },
    ],
  },

  builder: {
    title: "Building a form",
    tips: [
      {
        heading: "Sections and questions",
        body: "Sections group questions under a heading, the way a printed form has blocks. Click any question to open its settings beside the form, so you can see the effect of a change while you make it.",
      },
      {
        heading: "Answer types matter",
        body: "The type decides what the person filling it in actually gets — a date picker, a phone keypad, a signature pad. Picking the right one is the difference between a form that is quick on a phone and one that is not.",
      },
      {
        heading: "Nothing is live until you publish",
        body: "Save draft keeps your work without exposing it to anyone. Publish is the step that makes the form real, and it runs a short check first.",
      },
    ],
  },
};
