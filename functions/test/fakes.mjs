// Stand-ins for Supabase (Postgres + Storage) and Microsoft Graph.
//
// These exist so the ingestion pipeline can be run end-to-end without a tenant,
// a client secret, or a single real document. That matters more here than in
// most projects: the things this pipeline gets wrong — a watermark that skips a
// message, a dedupe key that lets the same authorization queue twice, a budget
// that stops in the wrong place — are all invisible from the outside. A quiet
// queue and a broken queue look identical until a survey.
//
// They are deliberately shallow. Only the handful of calls the pipeline
// actually makes are implemented, and anything unimplemented throws rather than
// quietly returning undefined, so a fake that has drifted behind the real code
// fails loudly instead of passing a test that means nothing.

import { fromRow, toRow } from "../src/records.mjs";

/**
 * In-memory Postgres, supporting only what queue/poll/roster/resolve use.
 *
 * Rows are stored in their real shape — promoted columns alongside a `data`
 * jsonb — rather than as flat documents, because the split between the two is
 * exactly the thing most likely to be got wrong. A fake that stored flat
 * documents would pass even if the production code wrote `status` into jsonb
 * where an RLS policy could never see it.
 */
export function fakeSupabase(seed = {}) {
  // { tableName: { id: rowObject } }
  const store = {};
  for (const [table, rows] of Object.entries(structuredClone(seed))) {
    store[table] = {};
    for (const [id, doc] of Object.entries(rows)) {
      // Seeds are written as documents, for readability in the tests.
      store[table][id] = { id, ...toRow(table, doc), ...promotedSeed(table, doc) };
    }
  }

  // clients/users seeds use `name`, which is a real column on both tables.
  function promotedSeed(table, doc) {
    if (table === "clients" || table === "users") return { name: doc.name };
    return {};
  }

  const rowsOf = (table) => Object.values(store[table] || {});

  function builder(table) {
    const state = { filters: [], limit: null };

    const api = {
      select() {
        return api;
      },
      eq(field, value) {
        state.filters.push([field, value]);
        return api;
      },
      limit(n) {
        state.limit = n;
        return api;
      },
      then(resolve) {
        // Awaiting the builder directly runs the query — the same behaviour
        // supabase-js gives via its thenable builder.
        return Promise.resolve(run()).then(resolve);
      },
      async maybeSingle() {
        const { data, error } = run();
        return { data: data[0] ?? null, error };
      },
      async single() {
        const { data, error } = run();
        if (!error && data.length !== 1) {
          return { data: null, error: { message: `expected exactly one row, got ${data.length}` } };
        }
        return { data: data[0] ?? null, error };
      },
      async insert(row) {
        const rows = Array.isArray(row) ? row : [row];
        store[table] ||= {};
        for (const r of rows) {
          if (r.id in store[table]) {
            return { data: null, error: { message: `duplicate key: ${r.id}` } };
          }
          store[table][r.id] = structuredClone(r);
        }
        return { data: rows, error: null };
      },
      async upsert(row) {
        const rows = Array.isArray(row) ? row : [row];
        store[table] ||= {};
        for (const r of rows) {
          store[table][r.id] = { ...(store[table][r.id] || {}), ...structuredClone(r) };
        }
        return { data: rows, error: null };
      },
      update(patch) {
        // update() is filtered by a chained .eq(), so the write happens when
        // the builder is awaited rather than immediately.
        const write = () => {
          const { data } = run();
          for (const row of data) {
            store[table][row.id] = { ...row, ...structuredClone(patch) };
          }
          return { data, error: null };
        };
        return {
          eq(field, value) {
            state.filters.push([field, value]);
            return { then: (resolve) => Promise.resolve(write()).then(resolve) };
          },
        };
      },
    };

    function run() {
      let rows = rowsOf(table).filter((row) =>
        state.filters.every(([field, value]) => {
          // The one operator form the production code uses beyond plain
          // equality: matching a key inside the jsonb document.
          const jsonMatch = /^data->>(.+)$/.exec(field);
          if (jsonMatch) return row.data?.[jsonMatch[1]] === value;
          return row[field] === value;
        }),
      );
      if (state.limit !== null) rows = rows.slice(0, state.limit);
      return { data: structuredClone(rows), error: null };
    }

    return api;
  }

  return {
    from: builder,
    storage: fakeStorage(),
    /** Test-only window onto what was written, as flat documents. */
    _dump: () => structuredClone(store),
    _collection: (table) => rowsOf(table).map((row) => fromRow(table, structuredClone(row))),
  };
}

/** In-memory Storage. Records uploads; never touches a network. */
export function fakeStorage() {
  const buckets = new Map();

  return {
    from(bucket) {
      if (!buckets.has(bucket)) buckets.set(bucket, new Map());
      const objects = buckets.get(bucket);
      return {
        async upload(path, body, opts = {}) {
          if (objects.has(path) && !opts.upsert) {
            return { data: null, error: { message: "object already exists" } };
          }
          objects.set(path, { bytes: body?.length ?? body?.size ?? 0, ...opts });
          return { data: { path }, error: null };
        },
        async download(path) {
          if (!objects.has(path)) return { data: null, error: { message: "not found" } };
          return { data: Buffer.from("pdf-bytes"), error: null };
        },
        async createSignedUrl(path) {
          if (!objects.has(path)) return { data: null, error: { message: "not found" } };
          return { data: { signedUrl: `https://fake.storage/${bucket}/${path}?token=fake` }, error: null };
        },
      };
    },
    async listBuckets() {
      return { data: [...buckets.keys()].map((name) => ({ name })), error: null };
    },
    _objects: (bucket) => Object.fromEntries(buckets.get(bucket) || new Map()),
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
