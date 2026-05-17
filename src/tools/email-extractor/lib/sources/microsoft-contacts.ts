import { isValidEmailSyntax, isValidPhoneSyntax } from "../extract";
import type { SourceItem } from "./google-contacts";

interface GraphContact {
  displayName?: string;
  emailAddresses?: { address?: string }[];
  mobilePhone?: string | null;
  homePhones?: string[];
  businessPhones?: string[];
}

export async function extractMicrosoftContacts(accessToken: string): Promise<SourceItem[]> {
  const items: SourceItem[] = [];
  let nextLink: string | undefined = "https://graph.microsoft.com/v1.0/me/contacts?$select=displayName,emailAddresses,mobilePhone,homePhones,businessPhones&$top=999";

  while (nextLink) {
    const res: Response = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) break;
    const data: { value?: GraphContact[]; "@odata.nextLink"?: string } = await res.json();
    nextLink = data["@odata.nextLink"];

    for (const contact of (data.value ?? []) as GraphContact[]) {
      const name = contact.displayName ?? "";
      const date = new Date().toISOString().slice(0, 10);

      for (const e of contact.emailAddresses ?? []) {
        const email = (e.address ?? "").toLowerCase().trim();
        if (email && isValidEmailSyntax(email)) {
          items.push({ type: "email", value: email, sourceFolder: "contacts", sourceSubject: name, sourceFrom: name, sourceDate: date });
        }
      }

      const phones = [
        ...(contact.mobilePhone ? [contact.mobilePhone] : []),
        ...(contact.homePhones ?? []),
        ...(contact.businessPhones ?? []),
      ];
      for (const phone of phones) {
        const p = phone.trim();
        if (p && isValidPhoneSyntax(p)) {
          items.push({ type: "phone", value: p, sourceFolder: "contacts", sourceSubject: name, sourceFrom: name, sourceDate: date });
        }
      }
    }
  }

  return items;
}
