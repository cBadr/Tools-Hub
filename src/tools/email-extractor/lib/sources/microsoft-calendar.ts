import { isValidEmailSyntax } from "../extract";
import type { SourceItem } from "./google-contacts";

interface GraphEvent {
  subject?: string;
  start?: { dateTime?: string };
  attendees?: { emailAddress?: { address?: string; name?: string } }[];
  organizer?: { emailAddress?: { address?: string; name?: string } };
}

export async function extractMicrosoftCalendar(accessToken: string): Promise<SourceItem[]> {
  const items: SourceItem[] = [];
  let nextLink: string | undefined = "https://graph.microsoft.com/v1.0/me/events?$select=subject,start,attendees,organizer&$top=999";

  while (nextLink) {
    const res: Response = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) break;
    const data: { value?: GraphEvent[]; "@odata.nextLink"?: string } = await res.json();
    nextLink = data["@odata.nextLink"];

    for (const event of (data.value ?? []) as GraphEvent[]) {
      const subject = event.subject ?? "";
      const date = event.start?.dateTime?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

      const participants = [
        ...(event.attendees ?? []).map((a) => a.emailAddress),
        event.organizer?.emailAddress,
      ].filter(Boolean) as { address?: string; name?: string }[];

      for (const p of participants) {
        const email = (p.address ?? "").toLowerCase().trim();
        if (email && isValidEmailSyntax(email)) {
          items.push({ type: "email", value: email, sourceFolder: "calendar", sourceSubject: subject, sourceFrom: p.name ?? "", sourceDate: date });
        }
      }
    }
  }

  return items;
}
