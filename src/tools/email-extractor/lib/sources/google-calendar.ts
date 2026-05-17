import { isValidEmailSyntax } from "../extract";
import type { SourceItem } from "./google-contacts";

interface CalendarEvent {
  start?: { dateTime?: string; date?: string };
  attendees?: { email?: string; displayName?: string }[];
  organizer?: { email?: string; displayName?: string };
}

export async function extractGoogleCalendar(accessToken: string): Promise<SourceItem[]> {
  const items: SourceItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("maxResults", "2500");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("fields", "items(summary,start,attendees,organizer),nextPageToken");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) break;
    const data = await res.json();
    pageToken = data.nextPageToken;

    for (const event of (data.items ?? []) as CalendarEvent[]) {
      const subject = (event as any).summary ?? "";
      const date = event.start?.dateTime?.slice(0, 10) ?? event.start?.date ?? new Date().toISOString().slice(0, 10);

      const participants: Array<{ email?: string; displayName?: string }> = [
        ...(event.attendees ?? []),
        ...(event.organizer ? [event.organizer] : []),
      ];

      for (const p of participants) {
        const email = (p.email ?? "").toLowerCase().trim();
        if (email && isValidEmailSyntax(email)) {
          items.push({ type: "email", value: email, sourceFolder: "calendar", sourceSubject: subject, sourceFrom: p.displayName ?? "", sourceDate: date });
        }
      }
    }
  } while (pageToken);

  return items;
}
