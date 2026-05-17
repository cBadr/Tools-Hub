import nodemailer from "nodemailer";
import type { EmailAccount, LiveProxy } from "./types";
import { decrypt } from "@/tools/email-extractor/lib/crypto";
import type { SendOptions } from "./sender-gmail";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

function buildProxyAgent(proxy: LiveProxy) {
  const creds = proxy.username ? `${proxy.username}:${proxy.password}@` : "";
  const uri   = `${proxy.type}://${creds}${proxy.host}:${proxy.port}`;
  if (proxy.type === "socks4" || proxy.type === "socks5") {
    return new SocksProxyAgent(uri);
  }
  return new HttpsProxyAgent(uri);
}

export async function sendViaSmtp(
  account: EmailAccount,
  opts: SendOptions,
  proxy?: LiveProxy,
): Promise<{ messageId: string }> {
  if (!account.imap_host) {
    throw new Error("SMTP host not configured for account");
  }

  const password = account.credentials_enc ? decrypt(account.credentials_enc) : "";
  const socketOptions = proxy ? { agent: buildProxyAgent(proxy) } : undefined;

  // Derive SMTP port from IMAP port heuristic (993→465, 143→587)
  const smtpPort = account.imap_port === 993 ? 465 : 587;

  const transport = nodemailer.createTransport({
    host:    account.imap_host,
    port:    smtpPort,
    secure:  smtpPort === 465,
    auth:    { user: account.email, pass: password },
    ...(socketOptions ? { socketOptions } : {}),
    connectionTimeout: 15000,
    greetingTimeout:   10000,
  });

  const info = await transport.sendMail({
    from:     account.label ? `"${account.label}" <${account.email}>` : account.email,
    to:       opts.to,
    subject:  opts.subject,
    html:     opts.bodyHtml,
    text:     opts.bodyText,
    headers:  {
      ...(opts.inReplyTo    ? { "In-Reply-To": opts.inReplyTo }    : {}),
      ...(opts.references   ? { References: opts.references }       : {}),
      ...(opts.unsubscribeUrl ? { "List-Unsubscribe": `<${opts.unsubscribeUrl}>` } : {}),
    },
  });

  return { messageId: (info.messageId as string) ?? `<${crypto.randomUUID()}@toolshub.app>` };
}
