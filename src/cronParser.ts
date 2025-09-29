// cronParser.ts: A TypeScript class for parsing regular and Quartz cron expressions
// Supports parsing, translating to English, and finding next/previous execution times

import { DateTime } from 'luxon';

// Enum for months to replace string-based month mapping
enum Month {
  JAN = 1, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP, OCT, NOV, DEC
}

// Enum for days of the week to replace string-based day mapping
enum DayOfWeek {
  SUN = 0, MON, TUE, WED, THU, FRI, SAT
}

// Constants for human-readable day and month names
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Mapping objects for month and day-of-week string to enum values
const monthMap: Record<string, number> = {
  JAN: Month.JAN,
  FEB: Month.FEB,
  MAR: Month.MAR,
  APR: Month.APR,
  MAY: Month.MAY,
  JUN: Month.JUN,
  JUL: Month.JUL,
  AUG: Month.AUG,
  SEP: Month.SEP,
  OCT: Month.OCT,
  NOV: Month.NOV,
  DEC: Month.DEC,
};

const dayMap: Record<string, number> = {
  SUN: DayOfWeek.SUN,
  MON: DayOfWeek.MON,
  TUE: DayOfWeek.TUE,
  WED: DayOfWeek.WED,
  THU: DayOfWeek.THU,
  FRI: DayOfWeek.FRI,
  SAT: DayOfWeek.SAT,
};

// Interface for cron field values and optional step
interface CronField {
  values: number[];
  step?: number;
}

// Interface for day-of-month modifiers (e.g., L, W, LW)
interface DayOfMonthModifiers {
  lastDay: boolean;
  lastDayOffset: number;
  lastWeekday: boolean;
  nearestWeekday: boolean;
}

// Interface for day-of-week modifiers (e.g., #n, L)
interface DayOfWeekModifiers {
  nthDay: number;
  lastDay: boolean;
}

// Custom error for cron-specific parsing issues
class CronError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CronError';
  }
}

export class CronParser {
  private timezone: string;
  private seconds: CronField = { values: [0] };
  private minutes: CronField = { values: [] };
  private hours: CronField = { values: [] };
  private daysOfMonth: CronField = { values: [] };
  private months: CronField = { values: [] };
  private daysOfWeek: CronField = { values: [] };
  private years: CronField = { values: [] };
  private dayOfMonthModifiers: DayOfMonthModifiers = {
    lastDay: false,
    lastDayOffset: 0,
    lastWeekday: false,
    nearestWeekday: false,
  };
  private dayOfWeekModifiers: DayOfWeekModifiers = {
    nthDay: 0,
    lastDay: false,
  };
  private cronString: string; // Store cron string for logging

  constructor(cronString: string, timezone: string) {
    this.cronString = cronString;
    this.timezone = timezone;
    this.parse(cronString);
  }

  private normalizeField(field: string, type: 'month' | 'dayofweek'): string {
    field = field.toUpperCase();
    if (type === 'month') {
      return field.replace(/JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/g, (m) => monthMap[m].toString());
    }
    if (type === 'dayofweek') {
      return field.replace(/SUN|MON|TUE|WED|THU|FRI|SAT/g, (m) => dayMap[m].toString()).replace(/7/g, '0');
    }
    return field;
  }

  private parseField(field: string, min: number, max: number): CronField {
    if (field === '*') {
      return { values: Array.from({ length: max - min + 1 }, (_, i) => min + i) };
    }
    if (field.includes('/')) {
      const [rangeStr, stepStr] = field.split('/');
      const step = parseInt(stepStr, 10);
      if (step === 0) throw new CronError(`Invalid step value in ${field}`);
      if (rangeStr.includes(',')) {
        const ranges = rangeStr.split(',');
        const values = ranges.flatMap(range => {
          if (range.includes('-')) {
            const [start, end] = this.parseRange(range, min, max);
            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
          }
          const value = parseInt(range, 10);
          if (isNaN(value) || value < min || value > max) {
            throw new CronError(`Invalid value ${range} for range ${min}-${max}`);
          }
          return [value];
        });
        const steppedValues: number[] = [];
        for (let i = values[0]; i <= max; i += step) {
          if (values.includes(i)) steppedValues.push(i);
        }
        return { values: steppedValues.sort((a, b) => a - b), step };
      }
      const range = rangeStr === '*' ? `${min}-${max}` : rangeStr;
      const [start, end] = this.parseRange(range, min, max);
      const values: number[] = [];
      for (let i = start; i <= end; i += step) {
        values.push(i);
      }
      return { values, step };
    }
    if (field.includes(',')) {
      const values = field.split(',')
        .flatMap(part => this.parseField(part, min, max).values)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort((a, b) => a - b);
      return { values };
    }
    if (field.includes('-')) {
      const [start, end] = this.parseRange(field, min, max);
      return { values: Array.from({ length: end - start + 1 }, (_, i) => start + i) };
    }
    const value = parseInt(field, 10);
    if (isNaN(value) || value < min || value > max) {
      throw new CronError(`Invalid value ${field} for range ${min}-${max}`);
    }
    return { values: [value] };
  }

  private parseRange(range: string, min: number, max: number): [number, number] {
    const [startStr, endStr] = range.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      throw new CronError(`Invalid range ${range} for ${min}-${max}`);
    }
    return [start, end];
  }

  private parse(cronString: string): void {
    const fields = cronString.trim().split(/\s+/);
    if (fields.length < 5 || fields.length > 7) {
      throw new CronError('Invalid number of fields in cron string');
    }
    if (fields[3] !== '?' && fields[3] !== '*' && fields[5] !== '?' && fields[5] !== '*') {
      throw new CronError('Both day-of-month and day-of-week cannot be specified unless one is * or ?');
    }
    let idx = 0;
    this.seconds = fields.length > 5 ? this.parseField(fields[idx++], 0, 59) : { values: [0] };
    this.minutes = this.parseField(fields[idx++], 0, 59);
    this.hours = this.parseField(fields[idx++], 0, 23);
    this.parseDayOfMonth(fields[idx++]);
    this.parseMonth(fields[idx++]);
    this.parseDayOfWeek(fields[idx++]);
    if (fields.length === 7) {
      this.years = this.parseField(fields[idx++], 1970, 2099);
    }
  }

  private parseDayOfMonth(field: string): void {
    if (field === '?') return;
    let value = this.normalizeField(field, 'dayofmonth' as any);
    if (value.endsWith('W')) {
      value = value.slice(0, -1);
      if (value === 'L') {
        this.dayOfMonthModifiers.lastWeekday = true;
      } else {
        this.dayOfMonthModifiers.nearestWeekday = true;
        this.daysOfMonth = this.parseField(value, 1, 31);
      }
      return;
    }
    if (value.startsWith('L-')) {
      this.dayOfMonthModifiers.lastDay = true;
      this.dayOfMonthModifiers.lastDayOffset = parseInt(value.slice(2), 10);
      return;
    }
    if (value === 'L') {
      this.dayOfMonthModifiers.lastDay = true;
      return;
    }
    this.daysOfMonth = this.parseField(value, 1, 31);

    // Validate day-of-month against months
    if (this.daysOfMonth.values.length > 0 && this.months.values.length > 0) {
      const maxDaysInMonth: Record<number, number> = {
        1: 31, // January
        2: 29, // February (leap year)
        3: 31, // March
        4: 30, // April
        5: 31, // May
        6: 30, // June
        7: 31, // July
        8: 31, // August
        9: 30, // September
        10: 31, // October
        11: 30, // November
        12: 31 // December
      };
      for (const day of this.daysOfMonth.values) {
        for (const month of this.months.values) {
          if (month === 2 && day === 29) {
            // February 29 is valid only in leap years, handled in getDayOfMonthSet
            continue;
          }
          if (day > maxDaysInMonth[month]) {
            throw new CronError(`Invalid date: day ${day} is not valid for month ${monthNames[month - 1]}`);
          }
        }
      }
    }
  }

  private parseMonth(field: string): void {
    this.months = this.parseField(this.normalizeField(field, 'month'), 1, 12);
  }

  private parseDayOfWeek(field: string): void {
    if (field === '?') return;
    field = this.normalizeField(field, 'dayofweek');
    if (field.endsWith('L')) {
      this.dayOfWeekModifiers.lastDay = true;
      this.daysOfWeek = this.parseField(field.slice(0, -1), 0, 6);
      return;
    }
    if (field.includes('#')) {
      const [dayStr, nStr] = field.split('#');
      this.dayOfWeekModifiers.nthDay = parseInt(nStr, 10);
      if (this.dayOfWeekModifiers.nthDay < 1 || this.dayOfWeekModifiers.nthDay > 5) {
        throw new CronError('Invalid nth value for day of week');
      }
      this.daysOfWeek = this.parseField(dayStr, 0, 6);
      return;
    }
    this.daysOfWeek = this.parseField(field, 0, 6);
  }

  private getNextValue(vals: number[], val: number): number | undefined {
    return vals.find(v => v >= val) ?? vals[0];
  }

  private getPreviousValue(vals: number[], val: number): number | undefined {
    return vals.slice().reverse().find(v => v <= val) ?? vals[vals.length - 1];
  }

  private getDayOfMonthSet(year: number, month: number): number[] {
    const dt = DateTime.fromObject({ year, month }, { zone: this.timezone });
    if (dt.invalidReason) {
      console.debug(`[getDayOfMonthSet] Invalid date for ${year}-${month}`);
      return [];
    }
    const ldom = dt.daysInMonth ?? 30;

    if (this.dayOfMonthModifiers.lastDay) {
      const day = ldom - this.dayOfMonthModifiers.lastDayOffset;
      console.debug(`[getDayOfMonthSet] Last day modifier: ${day}`);
      return day >= 1 ? [day] : [];
    }

    if (this.dayOfMonthModifiers.lastWeekday) {
      let testDt = DateTime.fromObject({ year, month, day: ldom }, { zone: this.timezone });
      let dow = testDt.weekday % 7;
      if (testDt.weekday === 7) dow = 0;
      const offset = dow === 6 ? 1 : dow === 0 ? 2 : 0;
      console.debug(`[getDayOfMonthSet] Last weekday: ${ldom - offset}`);
      return [ldom - offset];
    }

    if (this.dayOfMonthModifiers.nearestWeekday) {
      const target = this.daysOfMonth.values[0] ?? 1;
      let testDt = DateTime.fromObject({ year, month, day: target }, { zone: this.timezone });
      if (testDt.invalidReason) {
        console.debug(`[getDayOfMonthSet] Invalid nearest weekday target: ${target}`);
        return [];
      }
      let dow = testDt.weekday % 7;
      if (testDt.weekday === 7) dow = 0;
      let candidate = target;
      if (dow === 6) candidate--;
      else if (dow === 0) candidate++;
      candidate = Math.max(1, Math.min(ldom, candidate));
      console.debug(`[getDayOfMonthSet] Nearest weekday to ${target}: ${candidate}`);
      return [candidate];
    }

    const allDays = Array.from({ length: ldom }, (_, i) => i + 1);
    if (this.daysOfMonth.values.length === 0) {
      if (this.daysOfWeek.values.length > 0 || this.dayOfWeekModifiers.nthDay || this.dayOfWeekModifiers.lastDay) {
        const validDays = allDays.filter(day => {
          const testDt = DateTime.fromObject({ year, month, day }, { zone: this.timezone });
          return this.isDayOfWeekSatisfied(testDt);
        });
        console.debug(`[getDayOfMonthSet] Filtered days for ${year}-${month}: ${validDays}`);
        return validDays;
      }
      console.debug(`[getDayOfMonthSet] All days for ${year}-${month}: ${allDays}`);
      return allDays;
    }
    const filteredDays = this.daysOfMonth.values.filter(d => {
      if (month === 2 && d === 29) {
        const isLeapYear = DateTime.fromObject({ year, month: 2, day: 1 }, { zone: this.timezone }).daysInMonth === 29;
        return isLeapYear ? d <= ldom : false;
      }
      return d <= ldom;
    });
    console.debug(`[getDayOfMonthSet] Filtered days of month for ${year}-${month}: ${filteredDays}`);
    return filteredDays;
  }

  private isDayOfWeekSatisfied(dt: DateTime): boolean {
    if (dt.invalidReason) {
      console.debug(`[isDayOfWeekSatisfied] Invalid date: ${dt.toISO()}`);
      return false;
    }
    let dow = dt.weekday % 7;
    if (dt.weekday === 7) dow = 0;
    if (this.dayOfWeekModifiers.nthDay) {
      if (dow !== this.daysOfWeek.values[0]) {
        console.debug(`[isDayOfWeekSatisfied] Day ${dt.day} is not dow ${this.daysOfWeek.values[0]}`);
        return false;
      }
      const week = Math.floor((dt.day - 1) / 7) + 1;
      const satisfied = week === this.dayOfWeekModifiers.nthDay && week <= 5;
      console.debug(`[isDayOfWeekSatisfied] nthDay check: ${dt.day}, week ${week}, nth ${this.dayOfWeekModifiers.nthDay}, satisfied: ${satisfied}`);
      return satisfied;
    }
    if (this.dayOfWeekModifiers.lastDay) {
      const ldom = dt.daysInMonth ?? 30;
      let testDt = DateTime.fromObject({ year: dt.year, month: dt.month, day: ldom }, { zone: this.timezone });
      let targetDow = this.daysOfWeek.values[0];
      let currentDow = testDt.weekday % 7;
      if (testDt.weekday === 7) currentDow = 0;
      while (currentDow !== targetDow && testDt.day > 1) {
        testDt = testDt.minus({ days: 1 });
        currentDow = testDt.weekday % 7;
        if (testDt.weekday === 7) currentDow = 0;
      }
      const satisfied = dt.day === testDt.day && currentDow === targetDow;
      console.debug(`[isDayOfWeekSatisfied] Last day check: ${dt.day}, last dow day ${testDt.day}, satisfied: ${satisfied}`);
      return satisfied;
    }
    const satisfied = this.daysOfWeek.values.length === 0 || this.daysOfWeek.values.includes(dow);
    console.debug(`[isDayOfWeekSatisfied] Simple dow check: ${dow}, values ${this.daysOfWeek.values}, satisfied: ${satisfied}`);
    return satisfied;
  }

  public isMatch(dt: DateTime): boolean {
    const d = dt.setZone(this.timezone);
    console.debug(`[isMatch] Checking date: ${d.toISO()} for cron: ${this.cronString}`);

    if (d.invalidReason) {
      console.debug(`[isMatch] Invalid date: ${d.toISO()}`);
      return false;
    }

    // Check year
    const yearMatch = this.years.values.length === 0 || this.years.values.includes(d.year);
    if (!yearMatch) {
      console.debug(`[isMatch] Year ${d.year} does not match ${this.years.values}`);
      return false;
    }

    // Check month
    const monthMatch = this.months.values.length === 0 || this.months.values.includes(d.month);
    if (!monthMatch) {
      console.debug(`[isMatch] Month ${d.month} does not match ${this.months.values}`);
      return false;
    }

    // Check day-of-month
    const daySet = this.getDayOfMonthSet(d.year, d.month);
    const dayMatch = daySet.includes(d.day);
    if (!dayMatch) {
      console.debug(`[isMatch] Day ${d.day} does not match ${daySet}`);
      return false;
    }

    // Check day-of-week
    const dowMatch = this.isDayOfWeekSatisfied(d);
    if (!dowMatch) {
      console.debug(`[isMatch] Day-of-week does not match for ${d.toISO()}`);
      return false;
    }

    // Check hour
    const hourMatch = this.hours.values.length === 0 || this.hours.values.includes(d.hour);
    if (!hourMatch) {
      console.debug(`[isMatch] Hour ${d.hour} does not match ${this.hours.values}`);
      return false;
    }

    // Check minute
    const minuteMatch = this.minutes.values.length === 0 || this.minutes.values.includes(d.minute);
    if (!minuteMatch) {
      console.debug(`[isMatch] Minute ${d.minute} does not match ${this.minutes.values}`);
      return false;
    }

    // Check second
    const secondMatch = this.seconds.values.length === 0 || this.seconds.values.includes(d.second);
    if (!secondMatch) {
      console.debug(`[isMatch] Second ${d.second} does not match ${this.seconds.values}`);
      return false;
    }

    console.debug(`[isMatch] Date ${d.toISO()} matches cron ${this.cronString}`);
    return true;
  }

  private getNextFireTime(after: DateTime): DateTime | null {
    let d = after.setZone(this.timezone);
    let iter = 0;
    const maxIter = 10000;
    const maxYear = this.years.values.length ? Math.max(...this.years.values) : 2099;

    console.debug(`[getNextFireTime] Cron: ${this.cronString}, Start: ${d.toISO()}, MaxYear: ${maxYear}`);

    while (iter < maxIter && d.year <= maxYear) {
      iter++;

      // Year
      const yearValues = this.years.values.length ? this.years.values : Array.from({ length: maxYear - 1970 + 1 }, (_, i) => 1970 + i);
      let nextYear = this.getNextValue(yearValues, d.year);
      if (nextYear === undefined) {
        console.debug(`[getNextFireTime] No next year found, returning null`);
        return null;
      }
      const yearChanged = nextYear !== d.year;

      // Month
      const monthValues = this.months.values.length ? this.months.values : Array.from({ length: 12 }, (_, i) => i + 1);
      let nextMonth = yearChanged ? monthValues[0] : this.getNextValue(monthValues, d.month) ?? monthValues[0];
      const monthChanged = nextMonth !== d.month || yearChanged;

      // Day
      const daySet = this.getDayOfMonthSet(nextYear, nextMonth);
      if (daySet.length === 0) {
        console.debug(`[getNextFireTime] No valid days in ${nextYear}-${nextMonth}, advancing year`);
        const nextYearVal = this.getNextValue(yearValues, nextYear + 1);
        if (nextYearVal === undefined || nextYearVal > maxYear) {
          console.debug(`[getNextFireTime] No further years available, returning null`);
          return null;
        }
        nextYear = nextYearVal;
        d = DateTime.fromObject({ year: nextYear, month: monthValues[0], day: 1, hour: 0, minute: 0, second: 0 }, { zone: this.timezone });
        console.debug(`[getNextFireTime] Advancing to ${nextYear}-${monthValues[0]}`);
        continue;
      }
      let nextDay = monthChanged ? daySet[0] : this.getNextValue(daySet, d.day) ?? daySet[0];
      const dayChanged = nextDay !== d.day || monthChanged;

      // Hour
      const hourValues = this.hours.values.length ? this.hours.values : Array.from({ length: 24 }, (_, i) => i);
      let nextHour = dayChanged ? hourValues[0] : this.getNextValue(hourValues, d.hour) ?? hourValues[0];
      if (nextHour === undefined) {
        console.debug(`[getNextFireTime] No next hour found, advancing day`);
        const nextDayVal = this.getNextValue(daySet, nextDay + 1);
        if (nextDayVal === undefined) {
          console.debug(`[getNextFireTime] No next day found, advancing year`);
          const nextYearVal = this.getNextValue(yearValues, nextYear + 1);
          if (nextYearVal === undefined || nextYearVal > maxYear) {
            console.debug(`[getNextFireTime] No further years available, returning null`);
            return null;
          }
          nextYear = nextYearVal;
          nextMonth = monthValues[0];
          d = DateTime.fromObject({ year: nextYear, month: nextMonth, day: 1, hour: 0, minute: 0, second: 0 }, { zone: this.timezone });
          console.debug(`[getNextFireTime] Advancing to ${nextYear}-${nextMonth}`);
          continue;
        }
        nextDay = nextDayVal;
        d = DateTime.fromObject({ year: nextYear, month: nextMonth, day: nextDay, hour: 0, minute: 0, second: 0 }, { zone: this.timezone });
        console.debug(`[getNextFireTime] Advancing to day ${nextDay}`);
        continue;
      }
      const hourChanged = nextHour !== d.hour || dayChanged;

      // Minute
      const minuteValues = this.minutes.values.length ? this.minutes.values : Array.from({ length: 60 }, (_, i) => i);
      let nextMinute = hourChanged ? minuteValues[0] : this.getNextValue(minuteValues, d.minute) ?? minuteValues[0];
      if (nextMinute === undefined) {
        console.debug(`[getNextFireTime] No next minute found, advancing hour`);
        const nextHourVal = this.getNextValue(hourValues, nextHour + 1);
        if (nextHourVal === undefined) {
          console.debug(`[getNextFireTime] No next hour found, advancing day`);
          const nextDayVal = this.getNextValue(daySet, nextDay + 1);
          if (nextDayVal === undefined) {
            console.debug(`[getNextFireTime] No next day found, advancing year`);
            const nextYearVal = this.getNextValue(yearValues, nextYear + 1);
            if (nextYearVal === undefined || nextYearVal > maxYear) {
              console.debug(`[getNextFireTime] No further years available, returning null`);
              return null;
            }
            nextYear = nextYearVal;
            nextMonth = monthValues[0];
            d = DateTime.fromObject({ year: nextYear, month: nextMonth, day: 1, hour: 0, minute: 0, second: 0 }, { zone: this.timezone });
            console.debug(`[getNextFireTime] Advancing to ${nextYear}-${nextMonth}`);
            continue;
          }
          nextDay = nextDayVal;
          d = DateTime.fromObject({ year: nextYear, month: nextMonth, day: nextDay, hour: 0, minute: 0, second: 0 }, { zone: this.timezone });
          console.debug(`[getNextFireTime] Advancing to day ${nextDay}`);
          continue;
        }
        nextHour = nextHourVal;
        d = DateTime.fromObject({ year: nextYear, month: nextMonth, day: nextDay, hour: nextHour, minute: 0, second: 0 }, { zone: this.timezone });
        console.debug(`[getNextFireTime] Advancing to hour ${nextHour}`);
        continue;
      }
      const minuteChanged = nextMinute !== d.minute || hourChanged;

      // Second
      const secondValues = this.seconds.values.length ? this.seconds.values : Array.from({ length: 60 }, (_, i) => i);
      let nextSecond = minuteChanged ? secondValues[0] : this.getNextValue(secondValues, d.second + 1) ?? secondValues[0];
      if (nextSecond === undefined) {
        console.debug(`[getNextFireTime] No next second found, advancing minute`);
        const nextMinuteVal = this.getNextValue(minuteValues, nextMinute + 1);
        if (nextMinuteVal === undefined) {
          console.debug(`[getNextFireTime] No next minute found, advancing hour`);
          const nextHourVal = this.getNextValue(hourValues, nextHour + 1);
          if (nextHourVal === undefined) {
            console.debug(`[getNextFireTime] No next hour found, advancing day`);
            const nextDayVal = this.getNextValue(daySet, nextDay + 1);
            if (nextDayVal === undefined) {
              console.debug(`[getNextFireTime] No next day found, advancing year`);
              const nextYearVal = this.getNextValue(yearValues, nextYear + 1);
              if (nextYearVal === undefined || nextYearVal > maxYear) {
                console.debug(`[getNextFireTime] No further years available, returning null`);
                return null;
              }
              nextYear = nextYearVal;
              nextMonth = monthValues[0];
              d = DateTime.fromObject({ year: nextYear, month: nextMonth, day: 1, hour: 0, minute: 0, second: 0 }, { zone: this.timezone });
              console.debug(`[getNextFireTime] Advancing to ${nextYear}-${nextMonth}`);
              continue;
            }
            nextDay = nextDayVal;
            d = DateTime.fromObject({ year: nextYear, month: nextMonth, day: nextDay, hour: 0, minute: 0, second: 0 }, { zone: this.timezone });
            console.debug(`[getNextFireTime] Advancing to day ${nextDay}`);
            continue;
          }
          nextHour = nextHourVal;
          d = DateTime.fromObject({ year: nextYear, month: nextMonth, day: nextDay, hour: nextHour, minute: 0, second: 0 }, { zone: this.timezone });
          console.debug(`[getNextFireTime] Advancing to hour ${nextHour}`);
          continue;
        }
        nextMinute = nextMinuteVal;
        d = DateTime.fromObject({ year: nextYear, month: nextMonth, day: nextDay, hour: nextHour, minute: nextMinute, second: 0 }, { zone: this.timezone });
        console.debug(`[getNextFireTime] Advancing to minute ${nextMinute}`);
        continue;
      }

      // Create candidate date
      d = DateTime.fromObject({
        year: nextYear,
        month: nextMonth,
        day: nextDay,
        hour: nextHour,
        minute: nextMinute,
        second: nextSecond
      }, { zone: this.timezone });
      console.debug(`[getNextFireTime] Checking candidate: ${d.toISO()}`);

      // Check if candidate matches
      if (this.isMatch(d)) {
        console.debug(`[getNextFireTime] Match found: ${d.toISO()}`);
        return d;
      }

      // Advance to next possible time
      console.debug(`[getNextFireTime] No match for ${d.toISO()}, advancing`);
      d = d.plus({ seconds: 1 }).startOf('second');
      console.debug(`[getNextFireTime] Iter ${iter}: Advancing to ${d.toISO()}`);
    }
    console.debug(`[getNextFireTime] No match found after ${iter} iterations`);
    return null;
  }

  private getPreviousFireTime(before: DateTime): DateTime | null {
    let d = before.setZone(this.timezone).minus({ seconds: 1 }).endOf('second');
    let iter = 0;
    const maxIter = 10000;
    const minYear = this.years.values.length ? Math.min(...this.years.values) : 1970;

    console.debug(`[getPreviousFireTime] Cron: ${this.cronString}, Start: ${d.toISO()}, MinYear: ${minYear}`);

    while (iter < maxIter && d.year >= minYear) {
      iter++;

      // Year
      const yearValues = this.years.values.length ? this.years.values : Array.from({ length: 2099 - 1970 + 1 }, (_, i) => 1970 + i);
      let prevYear = this.getPreviousValue(yearValues, d.year);
      if (prevYear === undefined) {
        console.debug(`[getPreviousFireTime] No previous year found, returning null`);
        return null;
      }
      const yearChanged = prevYear < d.year;

      // Month
      const monthValues = this.months.values.length ? this.months.values : Array.from({ length: 12 }, (_, i) => i + 1);
      let prevMonth = yearChanged ? monthValues[monthValues.length - 1] : this.getPreviousValue(monthValues, d.month) ?? monthValues[monthValues.length - 1];
      const monthChanged = prevMonth < d.month || yearChanged;

      // Day
      const daySet = this.getDayOfMonthSet(prevYear, prevMonth);
      if (daySet.length === 0) {
        console.debug(`[getPreviousFireTime] No valid days in ${prevYear}-${prevMonth}, advancing year`);
        const prevYearVal = this.getPreviousValue(yearValues, prevYear - 1);
        if (prevYearVal === undefined || prevYearVal < minYear) {
          console.debug(`[getPreviousFireTime] No further years available, returning null`);
          return null;
        }
        prevYear = prevYearVal;
        prevMonth = monthValues[monthValues.length - 1];
        d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: DateTime.fromObject({ year: prevYear, month: prevMonth }, { zone: this.timezone }).daysInMonth ?? 30, hour: 23, minute: 59, second: 59 }, { zone: this.timezone });
        console.debug(`[getPreviousFireTime] Advancing to ${prevYear}-${prevMonth}`);
        continue;
      }
      let prevDay = monthChanged ? daySet[daySet.length - 1] : this.getPreviousValue(daySet, d.day) ?? daySet[daySet.length - 1];
      const dayChanged = prevDay < d.day || monthChanged;

      // Hour
      const hourValues = this.hours.values.length ? this.hours.values : Array.from({ length: 24 }, (_, i) => i);
      let prevHour = dayChanged ? hourValues[hourValues.length - 1] : this.getPreviousValue(hourValues, d.hour) ?? hourValues[hourValues.length - 1];
      if (prevHour === undefined) {
        console.debug(`[getPreviousFireTime] No previous hour found, advancing day`);
        const prevDayVal = this.getPreviousValue(daySet, prevDay - 1);
        if (prevDayVal === undefined) {
          console.debug(`[getPreviousFireTime] No previous day found, advancing month`);
          const prevMonthVal = this.getPreviousValue(monthValues, prevMonth - 1);
          if (prevMonthVal === undefined) {
            console.debug(`[getPreviousFireTime] No previous month found, advancing year`);
            const prevYearVal = this.getPreviousValue(yearValues, prevYear - 1);
            if (prevYearVal === undefined || prevYearVal < minYear) {
              console.debug(`[getPreviousFireTime] No further years available, returning null`);
              return null;
            }
            prevYear = prevYearVal;
            prevMonth = monthValues[monthValues.length - 1];
          } else {
            prevMonth = prevMonthVal;
          }
          d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: DateTime.fromObject({ year: prevYear, month: prevMonth }, { zone: this.timezone }).daysInMonth ?? 30, hour: 23, minute: 59, second: 59 }, { zone: this.timezone });
          console.debug(`[getPreviousFireTime] Advancing to ${prevYear}-${prevMonth}`);
          continue;
        }
        prevDay = prevDayVal;
        d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: prevDay, hour: 23, minute: 59, second: 59 }, { zone: this.timezone });
        console.debug(`[getPreviousFireTime] Advancing to day ${prevDay}`);
        continue;
      }
      const hourChanged = prevHour < d.hour || dayChanged;

      // Minute
      const minuteValues = this.minutes.values.length ? this.minutes.values : Array.from({ length: 60 }, (_, i) => i);
      let prevMinute = hourChanged ? minuteValues[minuteValues.length - 1] : this.getPreviousValue(minuteValues, d.minute) ?? minuteValues[minuteValues.length - 1];
      if (prevMinute === undefined) {
        console.debug(`[getPreviousFireTime] No previous minute found, advancing hour`);
        const prevHourVal = this.getPreviousValue(hourValues, prevHour - 1);
        if (prevHourVal === undefined) {
          console.debug(`[getPreviousFireTime] No previous hour found, advancing day`);
          const prevDayVal = this.getPreviousValue(daySet, prevDay - 1);
          if (prevDayVal === undefined) {
            console.debug(`[getPreviousFireTime] No previous day found, advancing month`);
            const prevMonthVal = this.getPreviousValue(monthValues, prevMonth - 1);
            if (prevMonthVal === undefined) {
              console.debug(`[getPreviousFireTime] No previous month found, advancing year`);
              const prevYearVal = this.getPreviousValue(yearValues, prevYear - 1);
              if (prevYearVal === undefined || prevYearVal < minYear) {
                console.debug(`[getPreviousFireTime] No further years available, returning null`);
                return null;
              }
              prevYear = prevYearVal;
              prevMonth = monthValues[monthValues.length - 1];
            } else {
              prevMonth = prevMonthVal;
            }
            d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: DateTime.fromObject({ year: prevYear, month: prevMonth }, { zone: this.timezone }).daysInMonth ?? 30, hour: 23, minute: 59, second: 59 }, { zone: this.timezone });
            console.debug(`[getPreviousFireTime] Advancing to ${prevYear}-${prevMonth}`);
            continue;
          }
          prevDay = prevDayVal;
          d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: prevDay, hour: 23, minute: 59, second: 59 }, { zone: this.timezone });
          console.debug(`[getPreviousFireTime] Advancing to day ${prevDay}`);
          continue;
        }
        prevHour = prevHourVal;
        d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: prevDay, hour: prevHour, minute: 59, second: 59 }, { zone: this.timezone });
        console.debug(`[getPreviousFireTime] Advancing to hour ${prevHour}`);
        continue;
      }
      const minuteChanged = prevMinute < d.minute || hourChanged;

      // Second
      const secondValues = this.seconds.values.length ? this.seconds.values : Array.from({ length: 60 }, (_, i) => i);
      let prevSecond = minuteChanged ? secondValues[secondValues.length - 1] : this.getPreviousValue(secondValues, d.second) ?? secondValues[secondValues.length - 1];
      if (prevSecond === undefined) {
        console.debug(`[getPreviousFireTime] No previous second found, advancing minute`);
        const prevMinuteVal = this.getPreviousValue(minuteValues, prevMinute - 1);
        if (prevMinuteVal === undefined) {
          console.debug(`[getPreviousFireTime] No previous minute found, advancing hour`);
          const prevHourVal = this.getPreviousValue(hourValues, prevHour - 1);
          if (prevHourVal === undefined) {
            console.debug(`[getPreviousFireTime] No previous hour found, advancing day`);
            const prevDayVal = this.getPreviousValue(daySet, prevDay - 1);
            if (prevDayVal === undefined) {
              console.debug(`[getPreviousFireTime] No previous day found, advancing month`);
              const prevMonthVal = this.getPreviousValue(monthValues, prevMonth - 1);
              if (prevMonthVal === undefined) {
                console.debug(`[getPreviousFireTime] No previous month found, advancing year`);
                const prevYearVal = this.getPreviousValue(yearValues, prevYear - 1);
                if (prevYearVal === undefined || prevYearVal < minYear) {
                  console.debug(`[getPreviousFireTime] No further years available, returning null`);
                  return null;
                }
                prevYear = prevYearVal;
                prevMonth = monthValues[monthValues.length - 1];
              } else {
                prevMonth = prevMonthVal;
              }
              d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: DateTime.fromObject({ year: prevYear, month: prevMonth }, { zone: this.timezone }).daysInMonth ?? 30, hour: 23, minute: 59, second: 59 }, { zone: this.timezone });
              console.debug(`[getPreviousFireTime] Advancing to ${prevYear}-${prevMonth}`);
              continue;
            }
            prevDay = prevDayVal;
            d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: prevDay, hour: 23, minute: 59, second: 59 }, { zone: this.timezone });
            console.debug(`[getPreviousFireTime] Advancing to day ${prevDay}`);
            continue;
          }
          prevHour = prevHourVal;
          d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: prevDay, hour: prevHour, minute: 59, second: 59 }, { zone: this.timezone });
          console.debug(`[getPreviousFireTime] Advancing to hour ${prevHour}`);
          continue;
        }
        prevMinute = prevMinuteVal;
        d = DateTime.fromObject({ year: prevYear, month: prevMonth, day: prevDay, hour: prevHour, minute: prevMinute, second: 59 }, { zone: this.timezone });
        console.debug(`[getPreviousFireTime] Advancing to minute ${prevMinute}`);
        continue;
      }

      // Create candidate date
      d = DateTime.fromObject({
        year: prevYear,
        month: prevMonth,
        day: prevDay,
        hour: prevHour,
        minute: prevMinute,
        second: prevSecond
      }, { zone: this.timezone });
      console.debug(`[getPreviousFireTime] Checking candidate: ${d.toISO()}`);

      // Check if candidate matches
      if (this.isMatch(d)) {
        console.debug(`[getPreviousFireTime] Match found: ${d.toISO()}`);
        return d;
      }

      // Advance to previous possible time
      console.debug(`[getPreviousFireTime] No match for ${d.toISO()}, advancing`);
      d = d.minus({ seconds: 1 }).endOf('second');
      console.debug(`[getPreviousFireTime] Iter ${iter}: Advancing to ${d.toISO()}`);
    }
    console.debug(`[getPreviousFireTime] No match found after ${iter} iterations`);
    return null;
  }

  public next(from?: DateTime): number {
    const start = from ? from.setZone(this.timezone) : DateTime.now().setZone(this.timezone);
    const nextDt = this.getNextFireTime(start);
    if (!nextDt) {
      throw new CronError('No next execution time found');
    }
    return nextDt.toUnixInteger();
  }

  public previous(from?: DateTime): number {
    const start = from ? from.setZone(this.timezone) : DateTime.now().setZone(this.timezone);
    const prevDt = this.getPreviousFireTime(start);
    if (!prevDt) {
      throw new CronError('No previous execution time found');
    }
    return prevDt.toUnixInteger();
  }

  public translate(): string {
    const parts: string[] = [];

    const isMidnight = this.seconds.values.length === 1 && this.seconds.values[0] === 0 &&
                       this.minutes.values.length === 1 && this.minutes.values[0] === 0 &&
                       this.hours.values.length === 1 && this.hours.values[0] === 0;

    if (this.seconds.step || this.seconds.values.length > 1 || (this.seconds.values.length === 1 && this.seconds.values[0] !== 0)) {
      parts.push(this.describeSeconds());
    }

    if (this.minutes.step || this.minutes.values.length > 1 || (this.minutes.values.length === 1 && this.minutes.values[0] !== 0)) {
      parts.push(this.describeMinutes());
    }

    if (isMidnight && !this.seconds.step && !this.minutes.step) {
      parts.push('at midnight');
    } else if (this.hours.step || this.hours.values.length < 24) {
      parts.push(this.describeHours());
    } else if (parts.length === 0 && !this.daysOfMonth.values.length && !this.dayOfWeekModifiers.nthDay && !this.dayOfWeekModifiers.lastDay && !this.daysOfWeek.values.length && !this.months.values.length && !this.years.values.length) {
      parts.push('every hour');
    }

    const isFeb29 = this.daysOfMonth.values.length === 1 && this.daysOfMonth.values[0] === 29 && this.months.values.length === 1 && this.months.values[0] === 2;
    if (this.dayOfMonthModifiers.lastDay || this.dayOfMonthModifiers.lastWeekday ||
        this.dayOfMonthModifiers.nearestWeekday || this.daysOfMonth.values.length > 0 || isFeb29) {
      if (isFeb29) {
        parts.push('on the 29th of February');
      } else {
        parts.push(this.describeDaysOfMonth());
      }
    } else if (!this.daysOfWeek.values.length && !this.dayOfWeekModifiers.nthDay && !this.dayOfWeekModifiers.lastDay && !this.months.values.length && !this.years.values.length) {
      parts.push('every day');
    }

    if (this.months.values.length < 12 && !isFeb29) {
      parts.push(this.describeMonths());
    }

    if (this.dayOfWeekModifiers.nthDay || this.dayOfWeekModifiers.lastDay || this.daysOfWeek.values.length > 0) {
      parts.push(this.describeDaysOfWeek());
    }

    if (this.years.values.length > 0) {
      parts.push(this.describeYears());
    }

    const result = parts.filter(p => p).join(', ');
    return result || 'every second';
  }

  private describeField({ values, step }: CronField, name: string, min: number, max: number, formatter?: (value: number) => string): string {
    const displayValues: string[] = values.map(v => {
      if (formatter) {
        return formatter(v);
      }
      if (name === 'day' && !step) {
        const suffixes = ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'];
        const suffix = v % 100 >= 11 && v % 100 <= 13 ? 'th' : suffixes[v % 10];
        return `${v}${suffix}`;
      }
      return String(v);
    });
    if (!values.length) return '';
    if (values.length === max - min + 1 && !step) {
      return '';
    }
    if (step) {
      const fullRange = Math.floor((max - min) / step) + 1;
      if (values.length === fullRange) {
        return `every ${step} ${name}s`;
      }
      return `every ${step} ${name}s from ${displayValues[0]} to ${displayValues[displayValues.length - 1]}`;
    }
    if (values.length === 1) {
      return name === 'day' ? `on the ${displayValues[0]} of the month` : `at ${name} ${displayValues[0]}` + (name === 'second' ? ' of every minute' : '');
    }
    return name === 'day' ? `on the ${displayValues.join(' and ')} of the month` : `at ${name}s ${displayValues.join(' and ')}`;
  }

  private describeSeconds(): string {
    return this.describeField(this.seconds, 'second', 0, 59);
  }

  private describeMinutes(): string {
    return this.describeField(this.minutes, 'minute', 0, 59);
  }

  private describeHours(): string {
    if (this.hours.values.length === 1 && this.minutes.values.length === 1 && !this.hours.step && !this.minutes.step) {
      const hour = this.hours.values[0];
      const minute = this.minutes.values[0];
      const period = hour < 12 ? 'AM' : 'PM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const displayMinute = minute < 10 ? `0${minute}` : minute;
      return `at time ${displayHour}:${displayMinute} ${period}`;
    }
    return this.describeField(this.hours, 'hour', 0, 23);
  }

  private describeDaysOfMonth(): string {
    if (this.dayOfMonthModifiers.lastDay) {
      return this.dayOfMonthModifiers.lastDayOffset
        ? `on the ${this.dayOfMonthModifiers.lastDayOffset}th-to-last day of the month`
        : 'on the last day of the month';
    }
    if (this.dayOfMonthModifiers.lastWeekday) {
      return 'on the last weekday of the month';
    }
    if (this.dayOfMonthModifiers.nearestWeekday) {
      return `on the nearest weekday to the ${this.daysOfMonth.values[0]}${this.daysOfMonth.values[0] % 10 === 1 ? 'st' : this.daysOfMonth.values[0] % 10 === 2 ? 'nd' : this.daysOfMonth.values[0] % 10 === 3 ? 'rd' : 'th'} of the month`;
    }
    if (this.daysOfMonth.values.length > 15 && this.daysOfMonth.step) {
      return `on every ${this.daysOfMonth.step} days from the ${this.daysOfMonth.values[0]}${this.daysOfMonth.values[0] % 10 === 1 ? 'st' : this.daysOfMonth.values[0] % 10 === 2 ? 'nd' : this.daysOfMonth.values[0] % 10 === 3 ? 'rd' : 'th'} to the ${this.daysOfMonth.values[this.daysOfMonth.values.length - 1]}${this.daysOfMonth.values[this.daysOfMonth.values.length - 1] % 10 === 1 ? 'st' : this.daysOfMonth.values[this.daysOfMonth.values.length - 1] % 10 === 2 ? 'nd' : this.daysOfMonth.values[this.daysOfMonth.values.length - 1] % 10 === 3 ? 'rd' : 'th'}`;
    }
    return this.describeField(this.daysOfMonth, 'day', 1, 31);
  }

  private describeMonths(): string {
    return this.describeField(this.months, 'month', 1, 12, (m) => monthNames[m - 1]);
  }

  private describeDaysOfWeek(): string {
    if (this.dayOfWeekModifiers.nthDay) {
      const ordinals = ['first', 'second', 'third', 'fourth', 'fifth'];
      return `on the ${ordinals[this.dayOfWeekModifiers.nthDay - 1]} ${dayNames[this.daysOfWeek.values[0]]} of the month`;
    }
    if (this.dayOfWeekModifiers.lastDay) {
      return `on the last ${dayNames[this.daysOfWeek.values[0]]} of the month`;
    }
    return this.describeField(this.daysOfWeek, 'day', 0, 6, (d) => dayNames[d]);
  }

  private describeYears(): string {
    return this.describeField(this.years, 'year', 1970, 2099);
  }
}
