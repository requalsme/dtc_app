// Stand-ins for Firestore, Cloud Storage and Microsoft Graph.
//
// These exist so the ingestion pipeline can be run end-to-end without a tenant,
// a client secret, or a single real document. That matters more here than in
// most projects: the things this pipeline gets wrong — a watermark that skips a
// message, a dedupe key that lets the same authorization queue twice, a budget
// that stops in the wrong place — are all invisible from the outside. A quiet
// queue and a broken queue look identical until a survey.
//
// They are deliberately shallow. Only the handful of Firestore and Storage
// calls the pipeline actually makes are implemented, and each one that isn't
// throws rather than quietly returning undefined, so a fake that has drifted
// behind the real code fails loudly instead of passing a test that means
// nothing.

/** In-memory Firestore, supporting only what queue/poll/roster use. */
export function fakeDb(seed = {}) {
  // { collectionName: { docId: data } }
  const store = structuredClone(seed);
  let autoId = 0;

  const docApi = (col, id) => ({
    id,
    get path() {
      return `${col}/${id}`;
    },
    async get() {
      const data = store[col]?.[id];
      return { exists: data !== undefined, id, data: () => data, ref: docApi(col, id) };
    },
    async set(value, opts = {}) {
      store[col] ||= {};
      store[col][id] = opts.merge ? { ...(store[col][id] || {}), ...value } : value;
    },
    async update(value) {
      store[col] ||= {};
      store[col][id] = { ...(store[col][id] || {}), ...value };
    },
  });

  const queryApi = (col, filters = [], limit = null) => ({
    where(field, op, value) {
      if (op !== "==") throw new Error(`fakeDb only implements "==", got "${op}"`);
      return queryApi(col, [...filters, [field, value]], limit);
    },
    limit(n) {
      return queryApi(col, filters, n);
    },
    async get() {
      let docs = Object.entries(store[col] || {})
        .filter(([, data]) => filters.every(([f, v]) => data?.[f] === v))
        .map(([id, data]) => ({ id, data: () => data, ref: docApi(col, id) }));
      if (limit !== null) docs = docs.slice(0, limit);
      return { empty: docs.length === 0, size: docs.length, docs };
    },
  });

  return {
    collection(col) {
      return {
        ...queryApi(col),
        doc(id) {
          return docApi(col, id ?? `auto-${String(++autoId).padStart(4, "0")}`);
        },
      };
    },
    /** Test-only window onto what was written. */
    _dump: () => structuredClone(store),
    _collection: (col) => Object.entries(store[col] || {}).map(([id, data]) => ({ id, ...data })),
  };
}

/** In-memory Storage bucket. Records saves; never touches a network. */
export function fakeBucket(name = "dtcapp-24504.firebasestorage.app") {
  const objects = new Map();
  return {
    name,
    file(path) {
      return {
        async save(content, opts = {}) {
          objects.set(path, { bytes: content?.length ?? 0, ...opts });
        },
      };
    },
    _objects: () => Object.fromEntries(objects),
  };
}

/**
 * A stand-in Microsoft Graph.
 *
 * Takes the messages it should return, so a test can describe a mailbox rather
 * than mock three functions. `delayMs` makes each attachment fetch cost
 * wall-clock time, which is the only way to exercise the poll's time budget.
 */
export function fakeGraph(messages, { delayMs = 0, failOnMessageId = null } = {}) {
  const calls = { token: 0, list: 0, attachments: [] };

  return {
    calls,
    async getToken() {
      calls.token++;
      return "fake-token";
    },
    async listMessagesSince(_token, _mailbox, since, limit, folder = "inbox") {
      calls.list++;
      calls.folders ||= [];
      calls.folders.push(folder);
      return messages
        // Sent Items and Deleted Items are in this fixture on purpose. A caller
        // asking for the inbox must not see them; a caller passing null must.
        .filter((m) => (folder ? (m.folder || "inbox") === folder : true))
        .filter((m) => m.receivedDateTime > since)
        .sort((a, b) => a.receivedDateTime.localeCompare(b.receivedDateTime))
        .slice(0, limit);
    },
    async listAttachments(_token, _mailbox, messageId) {
      calls.attachments.push(messageId);
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (messageId === failOnMessageId) throw new Error("Graph 503 (simulated)");
      const msg = messages.find((m) => m.id === messageId);
      return (msg?.attachments || []).map((a) => ({
        id: a.id,
        name: a.name,
        contentType: a.contentType || "application/pdf",
        size: a.size ?? 1024,
        content: Buffer.from(a.body || "pdf-bytes"),
      }));
    },
  };
}

/** Shorthand for building mailbox fixtures without repeating boilerplate. */
export function message(id, receivedDateTime, fields = {}) {
  const attachments = fields.attachments || [];
  return {
    id,
    // Which Outlook folder this sits in. Defaults to the inbox; set it to
    // "sentitems" to represent something the agency sent, which the poll must
    // never treat as an arrival.
    folder: fields.folder || "inbox",
    conversationId: fields.conversationId || `conv-${id}`,
    internetMessageId: `<${id}@daretocarehomecare.com>`,
    receivedDateTime,
    subject: fields.subject ?? "",
    bodyPreview: fields.body ?? "",
    from: { emailAddress: { address: fields.from ?? "casemanager@example.org" } },
    hasAttachments: attachments.length > 0,
    attachments,
  };
}
