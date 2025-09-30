"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cronParser_1 = require("../src/cronParser");
const luxon_1 = require("luxon");
describe('CronParser', () => {
    const timeZone = 'UTC';
    const timeZoneNY = 'America/New_York';
    const from = luxon_1.DateTime.fromISO('2025-09-28T12:00:00', { zone: timeZone });
    test('regular cron: every hour at :00:00', () => {
        const parser = new cronParser_1.CronParser('0 * * * *', timeZone);
        expect(parser.next(from)).toBe(1759064400); // 2025-09-28T13:00:00Z
        expect(parser.previous(from)).toBe(1759057200); // 2025-09-28T11:00:00Z
        expect(parser.translate()).toBe('every hour');
    });
    test('quartz: every day at 00:00:00', () => {
        const parser = new cronParser_1.CronParser('0 0 0 * * ?', timeZone);
        expect(parser.next(from)).toBe(1759104000); // 2025-09-29T00:00:00Z
        expect(parser.previous(from)).toBe(1759017600); // 2025-09-28T00:00:00Z
        expect(parser.translate()).toBe('at midnight, every day');
    });
    test('last day of month at 00:00:00', () => {
        const parser = new cronParser_1.CronParser('0 0 0 L * ?', timeZone);
        expect(parser.next(from)).toBe(1759190400); // 2025-09-30T00:00:00Z
        expect(parser.previous(from)).toBe(1756598400); // 2025-08-31T00:00:00Z
        expect(parser.translate()).toBe('at midnight, on the last day of the month');
    });
    test('last Friday of month at 00:00:00', () => {
        const parser = new cronParser_1.CronParser('0 0 0 ? * 5L', timeZone);
        expect(parser.next(from)).toBe(1761868800); // 2025-10-31T00:00:00Z
        expect(parser.previous(from)).toBe(1758844800); // 2025-09-26T00:00:00Z
        expect(parser.translate()).toBe('at midnight, on the last Friday of the month');
    });
    test('second Tuesday of month at 00:00:00', () => {
        const parser = new cronParser_1.CronParser('0 0 0 ? * 2#2', timeZone);
        expect(parser.next(from)).toBe(1760400000); // 2025-10-14T00:00:00Z
        expect(parser.previous(from)).toBe(1757376000); // 2025-09-09T00:00:00Z
        expect(parser.translate()).toBe('at midnight, on the second Tuesday of the month');
    });
    test('nearest weekday to 26th at 00:00:00', () => {
        const parser = new cronParser_1.CronParser('0 0 0 26W * ?', timeZone);
        expect(parser.next(from)).toBe(1761523200); // 2025-10-27T00:00:00Z
        expect(parser.previous(from)).toBe(1758844800); // 2025-09-26T00:00:00Z
        expect(parser.translate()).toBe('at midnight, on the nearest weekday to the 26th of the month');
    });
    test('last weekday of month at 00:00:00', () => {
        const parser = new cronParser_1.CronParser('0 0 0 LW * ?', timeZone);
        expect(parser.next(from)).toBe(1759190400); // 2025-09-30T00:00:00Z
        expect(parser.previous(from)).toBe(1756425600); // 2025-08-29T00:00:00Z
        expect(parser.translate()).toBe('at midnight, on the last weekday of the month');
    });
    test('every 15 minutes', () => {
        const parser = new cronParser_1.CronParser('0 */15 * * * ?', timeZone);
        expect(parser.next(from)).toBe(1759061700); // 2025-09-28T12:15:00Z
        expect(parser.previous(from)).toBe(1759059900); // 2025-09-28T11:45:00Z
        expect(parser.translate()).toBe('every 15 minutes');
    });
    test('every Monday in January', () => {
        const parser = new cronParser_1.CronParser('0 0 0 ? JAN MON', timeZone);
        expect(parser.next(from)).toBe(1767571200); // 2026-01-05T00:00:00Z
        expect(parser.previous(from)).toBe(1737936000); // 2025-01-27T00:00:00Z
        expect(parser.translate()).toBe('at midnight, in January, on days Monday');
    });
    test('invalid cron expression', () => {
        expect(() => new cronParser_1.CronParser('0 0 0 1 * 1,2', timeZone)).toThrow('Both day-of-month and day-of-week cannot be specified unless one is * or ?');
    });
    test('every 5 seconds', () => {
        const parser = new cronParser_1.CronParser('*/5 * * * * ?', timeZone);
        expect(parser.next(from)).toBe(1759060805); // 2025-09-28T12:00:05Z
        expect(parser.previous(from)).toBe(1759060795); // 2025-09-28T11:59:55Z
        expect(parser.translate()).toBe('every 5 seconds');
    });
    test('specific days of the month: 1st and 15th at 12:00:00', () => {
        const parser = new cronParser_1.CronParser('0 0 12 1,15 * ?', timeZone);
        expect(parser.next(from)).toBe(1759320000); // 2025-10-01T12:00:00Z
        expect(parser.previous(from)).toBe(1757937600); // 2025-09-15T12:00:00Z
        expect(parser.translate()).toBe('at time 12:00 PM, on the 1st and 15th of the month');
    });
    test('third Wednesday in March and April', () => {
        const parser = new cronParser_1.CronParser('0 0 0 ? MAR,APR WED#3', timeZone);
        expect(parser.next(from)).toBe(1742342400); // 2025-03-19T00:00:00Z
        expect(parser.previous(from)).toBe(1713312000); // 2024-04-17T00:00:00Z
        expect(parser.translate()).toBe('at midnight, in months March and April, on the third Wednesday of the month');
    });
    test('common: daily at 08:30:00', () => {
        const parser = new cronParser_1.CronParser('0 30 8 * * ?', timeZone);
        expect(parser.next(from)).toBe(1759134600); // 2025-09-29T08:30:00Z
        expect(parser.previous(from)).toBe(1759048200); // 2025-09-28T08:30:00Z
        expect(parser.translate()).toBe('at time 8:30 AM, every day');
    });
    test('common: weekly on Wednesday at 14:00:00', () => {
        const parser = new cronParser_1.CronParser('0 0 14 ? * WED', timeZone);
        expect(parser.next(from)).toBe(1759327200); // 2025-10-01T14:00:00Z
        expect(parser.previous(from)).toBe(1758722400); // 2025-09-24T14:00:00Z
        expect(parser.translate()).toBe('at time 2:00 PM, on days Wednesday');
    });
    test('common: yearly on February 29th at 00:00:00 (leap year)', () => {
        const parser = new cronParser_1.CronParser('0 0 0 29 FEB ?', timeZone);
        expect(parser.next(from)).toBe(1835395200); // 2028-02-29T00:00:00Z
        expect(parser.previous(from)).toBe(1709164800); // 2024-02-29T00:00:00Z
        expect(parser.translate()).toBe('at midnight, on the 29th of February');
    });
    test('obscure: last second of every minute', () => {
        const parser = new cronParser_1.CronParser('59 * * * * ?', timeZone);
        expect(parser.next(from)).toBe(1759060859); // 2025-09-28T12:00:59Z
        expect(parser.previous(from)).toBe(1759060799); // 2025-09-28T11:59:59Z
        expect(parser.translate()).toBe('at second 59 of every minute');
    });
    test('obscure: only in 2025 on April 1st at 12:00:00', () => {
        const parser = new cronParser_1.CronParser('0 0 12 1 APR ? 2025', timeZone);
        expect(parser.next(from)).toBe(1743508800); // 2025-04-01T12:00:00Z
        expect(parser.previous(from)).toBe(1743508800); // 2025-04-01T12:00:00Z
        expect(parser.translate()).toBe('at time 12:00 PM, on the 1st of April, in year 2025');
    });
    test('obscure: every even minute on odd days in even months', () => {
        const parser = new cronParser_1.CronParser('0 */2 * 1-31/2 */2 ?', timeZone);
        expect(parser.next(from)).toBe(1759320000); // 2025-10-01T12:00:00Z
        expect(parser.previous(from)).toBe(1756684680); // 2025-08-31T23:58:00Z
        expect(parser.translate()).toBe('every 2 minutes, on every 2 days from the 1st to the 31st, in every 2 months');
    });
    test('edge: invalid step value', () => {
        expect(() => new cronParser_1.CronParser('0 */0 * * * ?', timeZone)).toThrow('Invalid step value');
    });
    test('edge: February 29 in non-leap year', () => {
        const parser = new cronParser_1.CronParser('0 0 0 29 FEB ?', timeZone);
        expect(parser.next(from)).toBe(1835395200); // 2028-02-29T00:00:00Z
        expect(parser.previous(from)).toBe(1709164800); // 2024-02-29T00:00:00Z
        expect(parser.translate()).toBe('at midnight, on the 29th of February');
    });
    test('edge: maximum values (59 59 23 31 12 ? 2099)', () => {
        const parser = new cronParser_1.CronParser('59 59 23 31 12 ? 2099', timeZone);
        expect(parser.next(from)).toBe(4102444799); // 2099-12-31T23:59:59Z
        expect(parser.previous(from)).toBe(4102444799); // 2099-12-31T23:59:59Z
        expect(parser.translate()).toBe('at time 11:59:59 PM, on the 31st of December, in year 2099');
    });
    test('edge: invalid month value', () => {
        expect(() => new cronParser_1.CronParser('0 0 0 * 13 ?', timeZone)).toThrow('Invalid value');
    });
    test('edge: invalid day-of-week value', () => {
        expect(() => new cronParser_1.CronParser('0 0 0 ? * 8', timeZone)).toThrow('Invalid value');
    });
    test('edge: invalid nth value for day-of-week', () => {
        expect(() => new cronParser_1.CronParser('0 0 0 ? * MON#6', timeZone)).toThrow('Invalid nth value for day of week');
    });
    test('complex: specific minutes with step interval', () => {
        const parser = new cronParser_1.CronParser('0 0,30/15 * * * ?', timeZone);
        expect(parser.next(from)).toBe(1759061700); // 2025-09-28T12:15:00Z
        expect(parser.previous(from)).toBe(1759060800); // 2025-09-28T12:00:00Z
        expect(parser.translate()).toBe('at minutes 0, 30, 45 every hour');
    });
    test('complex: large step interval for seconds', () => {
        const parser = new cronParser_1.CronParser('*/59 * * * * ?', timeZone);
        expect(parser.next(from)).toBe(1759060859); // 2025-09-28T12:00:59Z
        expect(parser.previous(from)).toBe(1759060799); // 2025-09-28T11:59:59Z
        expect(parser.translate()).toBe('every 59 seconds');
    });
    test('timezone: every day at 08:00:00 in America/New_York', () => {
        const parser = new cronParser_1.CronParser('0 0 8 * * ?', timeZoneNY);
        const fromNY = luxon_1.DateTime.fromISO('2025-09-28T12:00:00', { zone: timeZoneNY });
        const next = parser.next(fromNY);
        const prev = parser.previous(fromNY);
        const nextDate = luxon_1.DateTime.fromSeconds(next, { zone: 'UTC' }).setZone(timeZoneNY);
        const prevDate = luxon_1.DateTime.fromSeconds(prev, { zone: 'UTC' }).setZone(timeZoneNY);
        expect(nextDate.toISO()).toBe('2025-09-29T08:00:00.000-04:00'); // 2025-09-29T12:00:00Z
        expect(prevDate.toISO()).toBe('2025-09-28T08:00:00.000-04:00'); // 2025-09-28T12:00:00Z
        expect(parser.translate()).toBe('at time 8:00 AM, every day');
    });
    test('edge: invalid date (31st of February)', () => {
        expect(() => new cronParser_1.CronParser('0 0 0 31 FEB ?', timeZone)).toThrow('Invalid date: day 31 is not valid for month February');
    });
    test('complex: every 2 hours on specific days and months', () => {
        const parser = new cronParser_1.CronParser('0 0 */2 1,15 JAN,FEB ?', timeZone);
        expect(parser.next(from)).toBe(1767820800); // 2026-01-15T00:00:00Z
        expect(parser.previous(from)).toBe(1736980800); // 2025-01-15T22:00:00Z
        expect(parser.translate()).toBe('every 2 hours, on the 1st and 15th of the month, in months January and February');
    });
    test('edge: fifth Monday in short month', () => {
        const parser = new cronParser_1.CronParser('0 0 0 ? FEB MON#5', timeZone);
        expect(parser.next(from)).toBe(1835481600); // 2028-03-01T00:00:00Z
        expect(parser.previous(from)).toBe(1709251200); // 2024-03-01T00:00:00Z
        expect(parser.translate()).toBe('at midnight, on the fifth Monday of the month, in February');
    });
});
