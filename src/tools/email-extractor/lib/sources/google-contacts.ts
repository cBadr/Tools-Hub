import { isValidEmailSyntax, isValidPhoneSyntax } from "../extract";

export interface SourceItem {
  type: "email" | "phone";
  value: string;
  sourceFolder: string;
  sourceSubject: string;
  sourceFrom: string;
  sourceDate: string;
}

interface PeopleConnection {
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string }[];
  names?: { displayName?: string }[];
}

export async function extractGoogleContacts(accessToken: string): Promise<SourceItem[]> {
  const items: SourceItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://people.googleapis.com/v1/people/me/connections");
    url.searchParams.set("personFields", "emailAddresses,phoneNumbers,names");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) break;
    const data = await res.json();
    pageToken = data.nextPageToken;

    for (const person of (data.connections ?? []) as PeopleConnection[]) {
      const name = person.names?.[0]?.displayName ?? "";
      const date = new Date().toISOString().slice(0, 10);

      for (const e of person.emailAddresses ?? []) {
        const email = (e.value ?? "").toLowerCase().trim();
        if (email && isValidEmailSyntax(email)) {
          items.push({ type: "email", value: email, sourceFolder: "contacts", sourceSubject: name, sourceFrom: name, sourceDate: date });
        }
      }
      for (const p of person.phoneNumbers ?? []) {
        const phone = (p.value ?? "").trim();
        if (phone && isValidPhoneSyntax(phone)) {
          items.push({ type: "phone", value: phone, sourceFolder: "contacts", sourceSubject: name, sourceFrom: name, sourceDate: date });
        }
      }
    }
  } while (pageToken);

  return items;
}
