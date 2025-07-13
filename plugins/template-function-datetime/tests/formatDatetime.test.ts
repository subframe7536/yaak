import { describe, expect, it } from 'vitest';
import { formatDatetime } from '../src/index';

describe('formatDatetime', () => {
  it('formats current date with default format', async () => {
    const result = await formatDatetime({});
    expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });

  it('formats a specific date', async () => {
    const result = await formatDatetime({
      date: '2025-07-13 12:34:56',
      fmtInput: 'YYYY-MM-DD HH:mm:ss',
      fmtOutput: 'YYYY/MM/DD HH:mm:ss',
    });
    expect(result).toBe('2025/07/13 12:34:56');
  });

  it('applies calc operations', async () => {
    const result = await formatDatetime({
      date: '2025-07-13 12:00:00',
      fmtInput: 'YYYY-MM-DD HH:mm:ss',
      calc: '+1d, +2h',
      fmtOutput: 'YYYY-MM-DD HH:mm:ss',
    });
    expect(result).toBe('2025-07-14 14:00:00');
  });

  it('applies negative calc operations', async () => {
    const result = await formatDatetime({
      date: '2025-07-13 12:00:00',
      fmtInput: 'YYYY-MM-DD HH:mm:ss',
      calc: '-1d, -2h',
      fmtOutput: 'YYYY-MM-DD HH:mm:ss',
    });
    expect(result).toBe('2025-07-12 10:00:00');
  });

  it('throws error for invalid unit', async () => {
    await expect(
      formatDatetime({
        date: '2025-07-13 12:00:00',
        fmtInput: 'YYYY-MM-DD HH:mm:ss',
        calc: '+1x',
        fmtOutput: 'YYYY-MM-DD HH:mm:ss',
      }),
    ).rejects.toThrow('Invalid unit: x');
  });
});
