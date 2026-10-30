// A label can reveal an omitted payment, but cannot tell us its amount.
// Keep the imported amounts intact and ask the household to review them.
const excludesMortgage = label => /\b(?:excluding|excludes?|without)\s+(?:the\s+)?mortgage\b/i.test(label);
const mortgage = label => /\bmortgage\b/i.test(label);
export const mortgageWarning = 'Mortgage payment may be missing. An expense explicitly excludes the mortgage, but no separate mortgage expense covers all of those months. Add the payment in Budget, or confirm it is already included elsewhere, before relying on the projection.';

export function missingMortgage(engine, year) {
  const list = engine.budgetItemsForYear(year);
  const excluded = list.filter(item => excludesMortgage(item.expense));
  const payments = list.filter(item => mortgage(item.expense) && !excludesMortgage(item.expense));
  return Array.from({length:12}, (_, month) => month).some(month =>
    excluded.some(item => engine.budgetAmountForMonth(item, year, month) > 0) &&
    !payments.some(item => engine.budgetAmountForMonth(item, year, month) > 0));
}

export function mortgageNotice(engine, year) {
  return missingMortgage(engine, year) ? `<p class="warning mortgage-warning" role="alert">${mortgageWarning}</p>` : '';
}
