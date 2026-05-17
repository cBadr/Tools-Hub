import type { SupabaseClient } from "@supabase/supabase-js";

export interface AccountScore {
  accountId: string;
  email: string;
  score: number;
}

/**
 * Score every connected account for a given contact email.
 *
 * Scoring logic:
 *   emails from contact → account  ×3  (they wrote to us — strongest trust signal)
 *   emails from account → contact  ×2  (we wrote to them)
 *   shared threads                 ×1  (any interaction)
 *
 * Returns accounts sorted by score descending.
 */
export async function scoreAccountsForContact(
  supabase: SupabaseClient,
  userId: string,
  contactEmail: string,
  accountIds: string[],
): Promise<AccountScore[]> {
  if (accountIds.length === 0) return [];

  // Pull all extracted_contacts rows involving this email across all accounts
  const { data: rows } = await supabase
    .from("extracted_contacts")
    .select("source_account_id, source_from, type, value")
    .eq("user_id", userId)
    .or(`value.eq.${contactEmail},source_from.ilike.%${contactEmail}%`);

  const scores: Record<string, number> = {};
  for (const id of accountIds) scores[id] = 0;

  if (rows) {
    for (const row of rows) {
      const acctId = row.source_account_id as string | null;
      if (!acctId || !(acctId in scores)) continue;

      const srcFrom   = (row.source_from as string ?? "").toLowerCase();
      const isFromContact = srcFrom.includes(contactEmail.toLowerCase());

      if (isFromContact) {
        scores[acctId] += 3;   // contact wrote to this account
      } else {
        scores[acctId] += 2;   // account wrote to contact
      }
      scores[acctId] += 1;     // shared interaction
    }
  }

  return Object.entries(scores)
    .map(([accountId, score]) => ({ accountId, email: "", score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Assign the best account to each recipient email from the available accounts.
 * Falls back to round-robin when no history exists.
 */
export async function assignAccountsToRecipients(
  supabase: SupabaseClient,
  userId: string,
  recipientEmails: string[],
  accountIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (accountIds.length === 0) return result;

  let rrIndex = 0;

  for (const email of recipientEmails) {
    const scores = await scoreAccountsForContact(supabase, userId, email, accountIds);
    const best   = scores.find((s) => s.score > 0);
    if (best) {
      result.set(email, best.accountId);
    } else {
      result.set(email, accountIds[rrIndex % accountIds.length]);
      rrIndex++;
    }
  }

  return result;
}
