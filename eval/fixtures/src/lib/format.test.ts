import { describe, expect, it } from 'vitest';
import { formatCurrency } from './format';

describe('formatCurrency', () => {
  it('formats JPY without decimals', () => {
    expect(formatCurrency(1200)).toBe('￥1,200');
  });
});
