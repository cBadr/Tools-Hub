import { ImapFlow } from "imapflow";
import { decrypt } from "./crypto";
import { extractEmails, extractPhones, stripHtml, decodeQuotedPrintable } from "./extract";

export interface ImapCreds {
  host: string;
  port: number;
  tls: boolean;
  email: string;
  credentialsEnc?: string | null;
  accessTokenEnc?: string | null;
}

export interface FoundContact {
  type: "email" | "phone";
  value: string;
  sourceFolder: string;
  sourceSubject: string;
  sourceFrom: string;
  sourceDate: string;
}

export interface BatchResult {
  contacts: FoundContact[];
  processedCount: number;
  hasMore: boolean;
}

function buildClient(creds: ImapCreds): ImapFlow {
  const auth = creds.accessTokenEnc
    ? { user: creds.email, accessToken: decrypt(creds.accessTokenEnc) }
    : { user: creds.email, pass: decrypt(creds.credentialsEnc!) };
  return new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.tls,
    auth,
    logger: false,
    tls: { rejectUnauthorized: false },
  });
}

export async function testConnection(creds: ImapCreds): Promise<string[]> {
  const client = buildClient(creds);
  await client.connect();
  const folders: string[] = [];
  try {
    const boxes = await client.list();
    for (const box of boxes) {
      if (!box.flags.has("\\Noselect")) {
        folders.push(box.path);
      }
    }
  } finally {
    await client.logout();
  }
  return folders;
}

export async function scanBatch(
  creds: ImapCreds,
  folder: string,
  seqFrom: number,
  batchSize: number,
  extractEm: boolean,
  extractPh: boolean,
): Promise<BatchResult> {
  const client = buildClient(creds);
  const contacts: FoundContact[] = [];
  let processedCount = 0;
  let totalInFolder = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const mb = client.mailbox as { exists?: number } | false | null;
      totalInFolder = mb ? ((mb as { exists?: number }).exists ?? 0) : 0;
      if (seqFrom > totalInFolder) {
        return { contacts: [], processedCount: 0, hasMore: false };
      }

      const seqTo = Math.min(seqFrom + batchSize - 1, totalInFolder);

      for await (const msg of client.fetch(`${seqFrom}:${seqTo}`, {
        envelope: true,
        source: true,
      })) {
        processedCount++;
        const subject  = msg.envelope?.subject ?? "";
        const fromAddr = msg.envelope?.from?.[0]?.address ?? "";
        const date     = msg.envelope?.date?.toISOString() ?? new Date().toISOString();

        const addContact = (type: "email" | "phone", value: string) =>
          contacts.push({ type, value, sourceFolder: folder, sourceSubject: subject, sourceFrom: fromAddr, sourceDate: date });

        // Envelope addresses → emails
        if (extractEm) {
          const addrs = [
            ...(msg.envelope?.from ?? []),
            ...(msg.envelope?.to ?? []),
            ...(msg.envelope?.cc ?? []),
            ...(msg.envelope?.replyTo ?? []),
          ].flatMap((a) => (a.address ? [a.address.toLowerCase()] : []));
          addrs.forEach((v) => addContact("email", v));
        }

        // Body → emails + phones
        if (msg.source) {
          const raw  = msg.source.toString("utf8", 0, 80_000);
          const text = decodeQuotedPrintable(stripHtml(raw));

          if (extractEm) {
            extractEmails(text).forEach((v) => addContact("email", v));
          }
          if (extractPh) {
            extractPhones(text).forEach((v) => addContact("phone", v));
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  const hasMore = seqFrom + batchSize - 1 < totalInFolder;
  return { contacts, processedCount, hasMore };
}
