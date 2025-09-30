// src/test-manual.ts
import { CronParser, CronError } from './cronParser';
import { DateTime } from 'luxon';

const from = DateTime.fromISO('2025-02-01T00:00:00Z', { zone: 'UTC' });

try {
  const parser = new CronParser('0 0 0 ? FEB MON#5', 'UTC');
  const next = parser.getNextFireTime(from);
  console.log('Next fire (MON#5):', DateTime.fromJSDate(next, { zone: 'UTC' }).toISO());
} catch (e: unknown) {
  const error = e as Error;
  console.error('Error (MON#5):', error.message);
}

try {
  const parser = new CronParser('0 0 0 31 FEB ?', 'UTC');
  console.log('This should throw for Feb 31');
} catch (e: unknown) {
  const error = e as Error;
  console.error('Error (Feb 31):', error.message);
}

try {
  const parser = new CronParser('0 0 0 26W * ?', 'UTC');
  const next = parser.getNextFireTime(DateTime.fromISO('2025-09-01T00:00:00Z', { zone: 'UTC' }));
  console.log('Next fire (26W):', DateTime.fromJSDate(next, { zone: 'UTC' }).toISO());
} catch (e: unknown) {
  const error = e as Error;
  console.error('Error (26W):', error.message);
}

try {
  const parser = new CronParser('0 0 8 * * ?', 'America/New_York');
  const next = parser.getNextFireTime(DateTime.fromISO('2025-09-28T00:00:00Z', { zone: 'UTC' }));
  console.log('Next fire (daily 8:00 NY):', DateTime.fromJSDate(next, { zone: 'America/New_York' }).toISO());
} catch (e: unknown) {
  const error = e as Error;
  console.error('Error (daily 8:00 NY):', error.message);
}

try {
  const parser = new CronParser('0 */15 * * * ?', 'UTC');
  const next = parser.getNextFireTime(from);
  console.log('Next fire (every 15 min):', DateTime.fromJSDate(next, { zone: 'UTC' }).toISO());
} catch (e: unknown) {
  const error = e as Error;
  console.error('Error (every 15 min):', error.message);
}
