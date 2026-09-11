import { getAllExpenses } from "./expenseRepository";
import { getAllIncomes } from "./incomeRepository";
import { getCodSales } from "./saleRepository";
import { getCodReturns } from "./returnRepository";

export interface WalletBalances {
  cashBalance: number;
  transferBalance: number;
  codOutstanding: number;
}

/**
 * All-time wallet balances, independent of any date filter:
 * - cash/transfer: running total of income minus expenses for that bucket
 * - codOutstanding: COD sales not yet collected (collected COD folds into transfer)
 */
export async function getWalletBalances(shopId: string): Promise<WalletBalances> {
  const [allExpenses, allIncomes, codSales, codReturns] = await Promise.all([
    getAllExpenses(shopId),
    getAllIncomes(shopId),
    getCodSales(shopId),
    getCodReturns(shopId),
  ]);

  const sumBy = <T,>(list: T[], pick: (x: T) => number, match: (x: T) => boolean) =>
    list.filter(match).reduce((s, x) => s + pick(x), 0);

  const expCashAll = sumBy(allExpenses, (e) => e.amount, (e) => (e.paymentType ?? "cash") === "cash");
  const expTransferAll = sumBy(allExpenses, (e) => e.amount, (e) => e.paymentType === "transfer");
  const incCashAll = sumBy(allIncomes, (i) => i.amount, (i) => i.paymentType === "cash");
  const incTransferAll = sumBy(allIncomes, (i) => i.amount, (i) => i.paymentType === "transfer");
  const incCodAll = sumBy(allIncomes, (i) => i.amount, (i) => i.paymentType === "cod");
  const codSalesTotal = codSales.reduce((s, sale) => s + sale.total, 0);
  const codReturnsTotal = codReturns.reduce((s, r) => s + r.sellingPrice * r.quantity, 0);

  return {
    cashBalance: incCashAll - expCashAll,
    transferBalance: incTransferAll - expTransferAll + incCodAll,
    codOutstanding: codSalesTotal - incCodAll - codReturnsTotal,
  };
}
