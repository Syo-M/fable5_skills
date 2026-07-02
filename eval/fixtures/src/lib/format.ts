export function formatCurrency(amount: number, currency = 'JPY'): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency }).format(amount);
}
