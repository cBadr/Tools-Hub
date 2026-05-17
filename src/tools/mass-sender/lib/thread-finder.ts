import { ImapFlow } from "imapflow";
import type { EmailAccount } from "./types";
import { decrypt } from "@/tools/email-extractor/lib/crypto";
import { refreshGoogleToken } from "@/tools/email-extractor/lib/oauth";

export interface ThreadInfo {
  messageId: string;
  subject: string;
}

async function buildImapClient(account: EmailAccount): Promise<ImapFlow> {
  if (account.oauth_provider === "google") {
    let token = account.oauth_access_token_enc ? decrypt(account.oauth_access_token_enc) : "";
    const expires = account.oauth_expires_at ? new Date(account.oauth_expires_at) : new Date(0);
    if (!token || expires <= new Date()) {
      if (!account.oauth_refresh_token_enc) throw new Error("No refresh token");
      const refreshed = await refreshGoogleToken(decrypt(account.oauth_refresh_token_enc));
      token = refreshed.accessToken;
    }
    return new ImapFlow({
      host:          "imap.gmail.com",
      port:          993,
      secure:        true,
      auth:          { user: account.email, accessToken: token },
      logger:        false,
      tls:           { rejectUnauthorized: false },
      socketTimeout: 20000,
    });
  }

  if (account.oauth_provider === "microsoft") {
    let token = account.oauth_access_token_enc ? decrypt(account.oauth_access_token_enc) : "";
    const expires = account.oauth_expires_at ? new Date(account.oauth_expires_at) : new Date(0);
    if (!token || expires <= new Date()) {
      if (!account.oauth_refresh_token_enc) throw new Error("No refresh token");
      const { refreshMicrosoftToken } = await import("@/tools/email-extractor/lib/oauth");
      const refreshed = await refreshMicrosoftToken(decrypt(account.oauth_refresh_token_enc));
      token = refreshed.accessToken;
    }
    return new ImapFlow({
      host:          "outlook.office365.com",
      port:          993,
      secure:        true,
      auth:          { user: account.email, accessToken: token },
      logger:        false,
      tls:           { rejectUnauthorized: false },
      socketTimeout: 20000,
    });
  }

  // IMAP/password
  return new ImapFlow({
    host:          account.imap_host,
    port:          account.imap_port ?? 993,
    secure:        account.imap_tls ?? true,
    auth:          {
      user: account.email,
      pass: account.credentials_enc ? decrypt(account.credentials_enc) : "",
    },
    logger:        false,
    tls:           { rejectUnauthorized: false },
    socketTimeout: 20000,
  });
}

export async function findThread(
  account: EmailAccount,
  contactEmail: string,
  folder = "all",
  timeoutMs = 15000,
): Promise<ThreadInfo | null> {
  const client = await buildImapClient(account);

  return new Promise<ThreadInfo | null>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(null); try { void client.logout(); } catch { /* ignore */ } }
    }, timeoutMs);

    const done = (v: ThreadInfo | null) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(v);
        void client.logout().catch(() => {});
      }
    };

    void (async () => {
      await client.connect();

      const foldersToSearch = folder === "all"
        ? ["[Gmail]/All Mail", "INBOX", "SENT"]
        : [folder];

      for (const box of foldersToSearch) {
        try {
          const lock = await client.getMailboxLock(box).catch(() => null);
          if (!lock) continue;

          try {
            const uidsResult = await client.search({
              or: [{ to: contactEmail }, { from: contactEmail }],
            });

            // uidsResult can be false (no results) or number[] in imapflow
            const uids: number[] = Array.isArray(uidsResult) ? uidsResult : [];
            if (uids.length === 0) continue;

            const latestUid = Math.max(...uids);
            let foundMsgId: string | undefined;
            let foundSubject: string | undefined;

            for await (const msg of client.fetch([latestUid], { envelope: true, uid: true })) {
              foundMsgId   = msg.envelope?.messageId;
              foundSubject = msg.envelope?.subject ?? "";
            }

            if (foundMsgId) {
              done({ messageId: foundMsgId, subject: foundSubject ?? "" });
              return;
            }
          } finally {
            lock.release();
          }
        } catch { /* try next folder */ }
      }

      done(null);
    })().catch(() => done(null));
  });
}
