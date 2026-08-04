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
 * @param {string} token
 * @param {string} mailbox   user principal name of the shared mailbox
 * @param {string} since     ISO timestamp
 * @param {number} [limit]
 */
export async function listMessagesSince(token, mailbox, since, limit = 50) {
  const params = new URLSearchParams({
    $filter: `receivedDateTime gt ${since}`,
    $orderby: "receivedDateTime asc",
    $top: String(Math.min(limit, 100)),
    $select: "id,subject,receivedDateTime,from,hasAttachments,bodyPreview,internetMessageId",
  });
  const page = await graphGet(
    token,
    `/users/${encodeURIComponent(mailbox)}/messages?${params}`,
  );
  return page.value || [];
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
