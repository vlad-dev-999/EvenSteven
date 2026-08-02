/**
 * Minimum-transfer settlement engine.
 *
 * Given a map of member balances (positive = creditor, negative = debtor),
 * returns the smallest set of transfers that settles all debts.
 *
 * Uses a greedy algorithm:
 * 1. Sort creditors (descending) and debtors (ascending by balance).
 * 2. Match the largest debtor with the largest creditor.
 * 3. Create a transfer for min(|debtor|, creditor).
 * 4. Reduce both balances; repeat until all are settled.
 */
export interface BalanceEntry {
  memberId: number;
  memberName: string;
  net: number; // positive = creditor, negative = debtor
}

export interface Transfer {
  fromMemberId: number;
  fromMemberName: string;
  toMemberId: number;
  toMemberName: string;
  amount: number;
}

export function computeSettlements(balances: BalanceEntry[]): Transfer[] {
  const EPSILON = 1; // ignore rounding differences < 1 cent

  const creditors: BalanceEntry[] = balances
    .filter((b) => b.net > EPSILON)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.net - a.net);

  const debtors: BalanceEntry[] = balances
    .filter((b) => b.net < -EPSILON)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.net - b.net); // most negative first

  const transfers: Transfer[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.net, -debtor.net);

    if (amount > EPSILON) {
      transfers.push({
        fromMemberId: debtor.memberId,
        fromMemberName: debtor.memberName,
        toMemberId: creditor.memberId,
        toMemberName: creditor.memberName,
        amount: Math.round(amount),
      });
    }

    creditor.net -= amount;
    debtor.net += amount;

    if (Math.abs(creditor.net) <= EPSILON) ci++;
    if (Math.abs(debtor.net) <= EPSILON) di++;
  }

  return transfers;
}
