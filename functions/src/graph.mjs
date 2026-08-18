// Minimal Microsoft Graph client — enough to read one mailbox and pull
// attachments off it, and nothing else.
//
// App-only (client credentials) rather than delegated, because this runs on a
// schedule with nobody signed in. That means an admin has to grant Mail.Read as
// an *application* permission, which by default grants access to every mailbox
// in the tenant. Scope it down before deploying — see functions/README.md.
//
// No SDK dependency: three endpoints, and Node has fetch.

const LOGIN = "https://login.microsoftonline.com";
const GRAPH = "https://graph.microsoft.com/v1.0";

class GraphError extends Error {
  constructor(status, body, url) {
    super(`Graph ${status} on ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    this.name = "GraphError";
    this.status = status;
    this.body = body;
  }
}

/**
 * @param {{tenantId: string, clientId: string, clientSecret: string}} cfg
 * @returns {Promise<string>} bearer token
 */
export async function getToken({ tenantId, clientId, clientSecret }) {
  const res = await fetch(`${LOGIN}/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new GraphError(res.status, body, "token");
  return body.access_token;
}

async function graphGet(token, path) {
  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new GraphError(res.status, await res.text().catch(() => ""), url);
  }
  return res.json();
}

/**
 * Messages that arrived after `since`, oldest first.
 *
 * Ordered ascending on purpose: the watermark advances as messages are
 * processed, so a run that dies halfway resumes from the last message it
 * actually handled rather than skipping everything before the newest one.
 *
 * **`folder` is not optional in spirit.** `/users/{id}/messages` returns the
 * entire mailbox — Microsoft's reference says so plainly: "including the
 * Deleted Items and Clutter folders". Sent Items too. A poll reading that would
 * treat every attachment DTC itself sent out as a document that had just
 * arrived, and file the agency's own outgoing paperwork back onto people's
 * records. It defaults to `inbox` for that reason; pass `null` only when you
 * genuinely mean the whole mailbox, as the survey does.
 *
 * @param {string} token
 * @param {string} mailbox   user principal name of the shared mailbox
 * @param {string} since     ISO timestamp
 * @param {number} [limit]
 * @param {string|null} [folder]  well-known folder name, or null for everything
 */
export async function listMessagesSince(token, mailbox, since, limit = 50, folder = "inbox") {
  const params = new URLSearchParams({
    $filter: `receivedDateTime gt ${since}`,
    $orderby: "receivedDateTime asc",
    $top: String(Math.min(limit, 100)),
    $select:
      "id,subject,receivedDateTime,from,toRecipients,hasAttachments,bodyPreview," +
      "internetMessageId,conversationId,parentFolderId",
  });
  const scope = folder
    ? `/mailFolders/${encodeURIComponent(folder)}/messages`
    : "/messages";
  const page = await graphGet(token, `/users/${encodeURIComponent(mailbox)}${scope}?${params}`);
  return page.value || [];
}

/**
 * Attachment names, types and sizes — without downloading a single byte.
 *
 * `listAttachments` pulls `contentBytes`, which on a survey of a few hundred
 * messages means moving hundreds of megabytes of other people's PHI around for
 * no reason. This asks Graph for the metadata only. Nothing here should ever be
 * used to file a document; it exists to answer "what shape of thing arrives".
 */
export async function listAttachmentMeta(token, mailbox, messageId) {
  const params = new URLSearchParams({
    $select: "id,name,contentType,size,isInline",
    $top: "50",
  });
  const page = await graphGet(
    token,
    `/users/${encodeURIComponent(mailbox)}/messages/${messageId}/attachments?${params}`,
  );
  return (page.value || []).filter((a) => !a.isInline);
}

/**
 * Every message in a folder in a date window, following `@odata.nextLink`.
 *
 * The poll deliberately does not page — it works to a time budget and leaves
 * the rest for the next run. A survey has the opposite requirement: it runs
 * once, by hand, and a partial picture would be worse than none, because the
 * whole point is to count what actually happens.
 */
export async function listAllInFolder(token, mailbox, folder, since, { maxPages = 20 } = {}) {
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${since}`,
    $orderby: "receivedDateTime asc",
    $top: "100",
    $select:
      "id,subject,receivedDateTime,sentDateTime,from,toRecipients,hasAttachments," +
      "bodyPreview,internetMessageId,conversationId",
  });

  let url = `/users/${encodeURIComponent(mailbox)}/mailFolders/${encodeURIComponent(folder)}/messages?${params}`;
  const all = [];

  for (let page = 0; page < maxPages && url; page++) {
    const body = await graphGet(token, url);
    all.push(...(body.value || []));
    url = body["@odata.nextLink"] || null;
  }

  return all;
}

/**
 * File attachments on a message, with their bytes.
 *
 * Inline images are skipped — a signature logo is not a compliance document,
 * and queueing one wastes a reviewer's attention, which is the scarce resource
 * this whole pipeline is trying to protect.
 */
export async function listAttachments(token, mailbox, messageId) {
  const page = await graphGet(
    token,
    `/users/${encodeURIComponent(mailbox)}/messages/${messageId}/attachments`,
  );
  return (page.value || [])
    .filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment")
    .filter((a) => !a.isInline)
    .map((a) => ({
      id: a.id,
      name: a.name,
      contentType: a.contentType,
      size: a.size,
      content: Buffer.from(a.contentBytes || "", "base64"),
    }));
}

export { GraphError };
