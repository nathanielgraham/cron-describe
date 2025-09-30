// src/cronParser.ts
import { DateTime } from 'luxon';

export class CronError extends Error {}

export class CronParser {
  private secondSet: number[] | null;
  private minuteSet: number[] | null;
  private hourSet: number[] | null;
  private dayOfMonthSet: number[] | null;
  private monthSet: number[] | null;
  private dayOfWeekSet: number[] | null;
  private yearSet: number[] | null;
  private timeZone: string;
  private lastDayOfMonth: boolean = false;
  private lastDayOfWeek: number | null = null;
  private lastWeekday: boolean = false;
  private nearestWeekday: number | null = null;
  private nthDayOfWeek: { day: number; nth: number } | null = null;
  private cronExpression: string;

  constructor(cronExpression: string, timeZone: string = 'UTC') {
    this.cronExpression = cronExpression;
    console.log(`[DEBUG] Parsing cron: ${cronExpression}, timezone: ${timeZone}`);
    this.timeZone = timeZone;
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 7) {
      throw new CronError('Invalid cron expression: must have 5-7 fields');
    }

    let offset = 0;
    this.secondSet = [0];
    if (parts.length >= 6) {
      this.secondSet = this.parseField(parts[0], 0, 59);
      offset = 1;
      console.log(`[DEBUG] Parsed seconds: ${JSON.stringify(this.secondSet)}`);
    }

    this.minuteSet = this.parseField(parts[offset], 0, 59);
    this.hourSet = this.parseField(parts[offset + 1], 0, 23);
    this.dayOfMonthSet = this.parseField(parts[offset + 2], 1, 31, true);
    this.monthSet = this.parseField(parts[offset + 3], 1, 12, false, ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']);
    this.dayOfWeekSet = this.parseField(parts[offset + 4], 1, 7, true, ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
    this.yearSet = parts.length === offset + 6 ? this.parseField(parts[offset + 5], 1970, 2099) : null;

    console.log(`[DEBUG] Parsed fields: ${JSON.stringify({ second: this.secondSet, minute: this.minuteSet, hour: this.hourSet, dayOfMonth: this.dayOfMonthSet, month: this.monthSet, dayOfWeek: this.dayOfWeekSet, year: this.yearSet })}`);

    if (!this.isValid()) {
      throw new CronError('Invalid cron pattern');
    }
  }

  private parseField(field: string, min: number, max: number, allowSpecial: boolean = false, aliases?: string[]): number[] | null {
    console.log(`[DEBUG] Parsing field: ${field}, min: ${min}, max: ${max}, allowSpecial: ${allowSpecial}`);
    if (field === '*' || field === '?') {
      console.log(`[DEBUG] Field is wildcard: ${field}`);
      return null;
    }

    field = aliases ? this.resolveAliases(field, aliases) : field;
    console.log(`[DEBUG] After aliases: ${field}`);

    if (allowSpecial) {
      if (field === 'L') {
        this.lastDayOfMonth = true;
        console.log(`[DEBUG] Set lastDayOfMonth: true`);
        return null;
      } else if (field === 'LW') {
        this.lastWeekday = true;
        console.log(`[DEBUG] Set lastWeekday: true`);
        return null;
      } else if (field.includes('L-')) {
        const offset = parseInt(field.split('L-')[1], 10);
        if (isNaN(offset) || offset < 0) throw new CronError(`Invalid L offset: ${field}`);
        this.lastDayOfMonth = true;
        console.log(`[DEBUG] Set lastDayOfMonth with offset: ${offset}`);
        return [offset];
      } else if (field.endsWith('L') && allowSpecial) {
        const day = parseInt(field.slice(0, -1), 10);
        if (isNaN(day) || day < 1 || day > 7) throw new CronError(`Invalid L day-of-week: ${field}`);
        this.lastDayOfMonth = true;
        this.lastDayOfWeek = day;
        console.log(`[DEBUG] Set lastDayOfMonth and lastDayOfWeek: ${day}`);
        return null;
      } else if (field.includes('W')) {
        const day = parseInt(field.replace('W', ''), 10);
        if (isNaN(day) || day < 1 || day > 31) throw new CronError(`Invalid W day: ${field}`);
        this.nearestWeekday = day;
        console.log(`[DEBUG] Set nearestWeekday: ${day}`);
        return null;
      } else if (field.includes('#')) {
        const [day, nth] = field.split('#').map(v => parseInt(v, 10));
        if (isNaN(day) || isNaN(nth) || day < 1 || day > 7 || nth < 1 || nth > 5) {
          throw new CronError(`Invalid #n notation: ${field}`);
        }
        this.nthDayOfWeek = { day, nth };
        console.log(`[DEBUG] Set nthDayOfWeek: ${JSON.stringify(this.nthDayOfWeek)}`);
        return null;
      }
    }

    const values: number[] = [];
    const parts = field.split(',');
    for (const part of parts) {
      console.log(`[DEBUG] Parsing part: ${part}`);
      if (part.includes('/')) {
        const [range, step] = part.split('/');
        const stepValue = parseInt(step, 10);
        if (isNaN(stepValue) || stepValue <= 0) throw new CronError(`Invalid step value: ${step}`);
        const [start, end] = range === '*' ? [min, max] : range.includes('-') ? range.split('-').map(v => parseInt(v, 10)) : [parseInt(range, 10) || min, max];
        if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
          throw new CronError(`Invalid range: ${range}`);
        }
        for (let i = start; i <= end; i += stepValue) {
          values.push(i);
        }
        console.log(`[DEBUG] Step parsed: start=${start}, end=${end}, step=${stepValue}, values=${values}`);
      } else if (part.includes('-')) {
        const [start, end] = part.split('-').map(v => parseInt(v, 10));
        if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
          throw new CronError(`Invalid range: ${part}`);
        }
        for (let i = start; i <= end; i++) {
          values.push(i);
        }
        console.log(`[DEBUG] Range parsed: start=${start}, end=${end}, values=${values}`);
      } else {
        const num = parseInt(part, 10);
        if (isNaN(num) || num < min || num > max) throw new CronError(`Invalid value: ${part}`);
        values.push(num);
        console.log(`[DEBUG] Single value parsed: ${num}`);
      }
    }

    const result = values.length > 0 ? values.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b) : null;
    console.log(`[DEBUG] Final parsed values: ${JSON.stringify(result)}`);
    return result;
  }

  private resolveAliases(field: string, aliases: string[]): string {
    const aliasMap: { [key: string]: number } = {
      JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
      SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7
    };
    const result = aliases.reduce((acc, alias) => acc.replace(new RegExp(`\\b${alias}\\b`, 'gi'), aliasMap[alias].toString()), field);
    console.log(`[DEBUG] Resolved aliases: ${field} -> ${result}`);
    return result;
  }

  isValid(): boolean {
    // Check day-of-month and month compatibility
    if (this.dayOfMonthSet && this.monthSet) {
      for (const m of this.monthSet) {
        let maxD = 31;
        if (m === 2) maxD = 28; // Strict check, leap years handled in getNextFireTime
        if ([4, 6, 9, 11].includes(m)) maxD = 30;
        for (const d of this.dayOfMonthSet) {
          if (d > maxD) {
            console.log(`[DEBUG] Invalid date: day ${d} is not valid for month ${m}`);
            return false;
          }
        }
      }
    }

    // Check day-of-month and day-of-week constraints
    if (this.dayOfMonthSet !== null && this.dayOfWeekSet !== null && !this.lastDayOfMonth && !this.nthDayOfWeek && !this.nearestWeekday && !this.lastWeekday) {
      console.log(`[DEBUG] Invalid: both day-of-month and day-of-week specified without wildcards`);
      return false;
    }

    // Check year range
    if (this.yearSet) {
      for (const y of this.yearSet) {
        if (y < 1970 || y > 2099) {
          console.log(`[DEBUG] Invalid year: ${y} outside range 1970-2099`);
          return false;
        }
      }
    }

    // Check Quartz notations
    if (this.nearestWeekday && this.dayOfMonthSet) {
      console.log(`[DEBUG] Invalid: nearestWeekday (W) cannot be combined with dayOfMonthSet`);
      return false;
    }

    if (this.lastDayOfWeek && this.dayOfMonthSet && !this.lastDayOfMonth) {
      console.log(`[DEBUG] Invalid: lastDayOfWeek (L) cannot be combined with dayOfMonthSet without lastDayOfMonth`);
      return false;
    }

    return true;
  }

  getNextFireTime(startTime: Date | DateTime = DateTime.now()): Date {
    let current = startTime instanceof DateTime ? startTime : DateTime.fromJSDate(startTime, { zone: this.timeZone });
    current = current.set({ millisecond: 0 });
    console.log(`[DEBUG] getNextFireTime start: ${current.toISO()}, expr: ${this.cronExpression}`);

    let iterations = 0;
    const maxIterations = 10000;
    let daysCheckedInMonth = 0;
    const maxDaysInMonth = 31;
    const maxYear = this.yearSet ? Math.max(...this.yearSet) : 2099;
    const startYear = current.year;
    const maxYearSpan = 10;

    while (iterations++ < maxIterations) {
      if (current.year > startYear + maxYearSpan || current.year > maxYear) {
        console.log(`[DEBUG] Exceeded max year ${Math.min(startYear + maxYearSpan, maxYear)} for expr: ${this.cronExpression}`);
        throw new CronError(`No valid fire time found within ${maxYearSpan} years or before ${maxYear + 1} for expression: ${this.cronExpression}`);
      }

      // Set time fields
      if (this.secondSet) {
        const currentSecond = current.second;
        const nextSecond = this.secondSet.find(s => s > currentSecond) ?? this.secondSet[0];
        current = current.set({ second: nextSecond });
        if (nextSecond <= currentSecond) {
          current = this.incrementMinutes(current);
        }
        console.log(`[DEBUG] Set second to ${current.second}, expr: ${this.cronExpression}`);
      }
      if (this.minuteSet) {
        const currentMinute = current.minute;
        const nextMinute = this.minuteSet.find(m => m > currentMinute) ?? this.minuteSet[0];
        current = current.set({ minute: nextMinute });
        if (nextMinute <= currentMinute) {
          current = this.incrementHours(current);
        }
        console.log(`[DEBUG] Set minute to ${current.minute}, expr: ${this.cronExpression}`);
      }
      if (this.hourSet) {
        const currentHour = current.hour;
        const nextHour = this.hourSet.find(h => h > currentHour) ?? this.hourSet[0];
        current = current.set({ hour: nextHour });
        if (nextHour <= currentHour) {
          current = this.incrementDays(current);
        }
        console.log(`[DEBUG] Set hour to ${current.hour}, expr: ${this.cronExpression}`);
      }

      console.log(`[DEBUG] Iteration ${iterations}: ${current.toISO()}, expr: ${this.cronExpression}`);

      // Check for unconstrained days
      if (!this.dayOfMonthSet && !this.dayOfWeekSet && !this.lastDayOfMonth && !this.lastWeekday && !this.nearestWeekday && !this.nthDayOfWeek) {
        console.log(`[DEBUG] No day constraints, accepting current day: ${current.toISO()}, expr: ${this.cronExpression}`);
        if (!this.yearSet || this.yearSet.includes(current.year)) {
          if (!this.monthSet || this.monthSet.includes(current.month)) {
            console.log(`[DEBUG] Found valid fire time: ${current.toISO()}, expr: ${this.cronExpression}`);
            return current.toJSDate();
          }
        }
      }

      // Reset day if constraints exist
      if (this.dayOfMonthSet || this.dayOfWeekSet || this.lastDayOfMonth || this.lastWeekday || this.nearestWeekday || this.nthDayOfWeek) {
        current = current.set({ day: 1 });
        daysCheckedInMonth = 0;
      }

      while (this.yearSet && !this.yearSet.includes(current.year)) {
        current = this.incrementYears(current);
        console.log(`[DEBUG] Incremented year to ${current.year}, expr: ${this.cronExpression}`);
        if (current.year > maxYear) {
          throw new CronError(`No valid year found before ${maxYear + 1} for expression: ${this.cronExpression}`);
        }
      }

      let monthAdvanced = false;
      while (this.monthSet && !this.monthSet.includes(current.month)) {
        current = this.incrementMonths(current);
        monthAdvanced = true;
        console.log(`[DEBUG] Incremented month to ${current.month}, expr: ${this.cronExpression}`);
        daysCheckedInMonth = 0;
      }

      let dayMatched = false;
      let currentMonth = current.month;
      while (!dayMatched) {
        if (daysCheckedInMonth++ >= maxDaysInMonth) {
          console.log(`[DEBUG] No valid day in month ${current.month} for expr: ${this.cronExpression}`);
          if (this.monthSet && this.monthSet.length === 1) {
            // If monthSet is restricted (e.g., [2] for FEB), advance to next year
            current = this.incrementYears(current);
            current = current.set({ month: this.monthSet[0], day: 1 });
            console.log(`[DEBUG] Restricted monthSet, advanced to next year: ${current.toISO()}, expr: ${this.cronExpression}`);
          } else {
            current = this.incrementMonths(current);
          }
          daysCheckedInMonth = 0;
          continue;
        }

        const dom = current.day;
        const dow = current.weekday;

        console.log(`[DEBUG] Checking day: dom=${dom}, dow=${dow}, month=${current.month}, expr: ${this.cronExpression}`);

        // Validate day for leap years if month is February
        if (this.dayOfMonthSet && this.monthSet && this.monthSet.includes(2)) {
          const maxD = current.isInLeapYear ? 29 : 28;
          if (this.dayOfMonthSet.includes(dom) && dom > maxD) {
            throw new CronError(`Invalid date: day ${dom} is not valid for month 2 in ${current.year}`);
          }
        }

        if (this.lastDayOfMonth) {
          let effectiveDom = this.getLastDayOfMonth(current);
          if (this.lastDayOfWeek) {
            let temp = current.set({ day: effectiveDom });
            while (temp.weekday !== this.lastDayOfWeek && temp.day > 1) {
              temp = temp.minus({ days: 1 });
            }
            effectiveDom = temp.day;
          } else if (this.dayOfMonthSet) {
            effectiveDom -= this.dayOfMonthSet[0];
          }
          if (dom === effectiveDom) dayMatched = true;
        } else if (this.lastWeekday) {
          let effectiveDom = this.getLastDayOfMonth(current);
          effectiveDom = this.getNearestWeekday(current.set({ day: effectiveDom }), effectiveDom);
          if (dom === effectiveDom) dayMatched = true;
        } else if (this.nearestWeekday) {
          const weekday = this.getNearestWeekday(current, this.nearestWeekday);
          if (dom === weekday) dayMatched = true;
        } else if (this.nthDayOfWeek) {
          let nthDay = this.getNthDayOfWeek(current, this.nthDayOfWeek.day, this.nthDayOfWeek.nth);
          if (nthDay === null) {
            console.log(`[DEBUG] No nth day in month, incrementing month for expr: ${this.cronExpression}`);
            if (this.monthSet && this.monthSet.length === 1) {
              // Restricted month (e.g., FEB), advance to next year
              current = this.incrementYears(current);
              current = current.set({ month: this.monthSet[0], day: 1 });
              console.log(`[DEBUG] Restricted monthSet, advanced to next year: ${current.toISO()}, expr: ${this.cronExpression}`);
            } else {
              current = this.incrementMonths(current);
            }
            daysCheckedInMonth = 0;
            continue;
          }
          if (dom === nthDay) dayMatched = true;
        } else if (this.dayOfMonthSet && this.dayOfMonthSet.includes(dom)) {
          dayMatched = true;
        } else if (this.dayOfWeekSet && this.dayOfWeekSet.includes(dow)) {
          dayMatched = true;
        }

        if (!dayMatched) {
          current = this.incrementDays(current);
          console.log(`[DEBUG] Day not matched, incremented to ${current.toISO()}, expr: ${this.cronExpression}`);
          continue;
        }

        if (current.month !== currentMonth && !monthAdvanced) {
          if (this.monthSet && this.monthSet.length === 1) {
            current = this.incrementYears(current);
            current = current.set({ month: this.monthSet[0], day: 1 });
            console.log(`[DEBUG] Restricted monthSet, advanced to next year: ${current.toISO()}, expr: ${this.cronExpression}`);
          } else {
            current = this.incrementMonths(current);
            console.log(`[DEBUG] Month rollover detected, incremented to ${current.toISO()}, expr: ${this.cronExpression}`);
          }
          daysCheckedInMonth = 0;
          continue;
        }

        break;
      }

      if (current.year > maxYear) {
        console.log(`[DEBUG] Exceeded max year ${maxYear} after time checks for expr: ${this.cronExpression}`);
        throw new CronError(`No valid fire time found before ${maxYear + 1} for expression: ${this.cronExpression}`);
      }

      if (!this.yearSet || this.yearSet.includes(current.year)) {
        if (!this.monthSet || this.monthSet.includes(current.month)) {
          console.log(`[DEBUG] Found valid fire time: ${current.toISO()}, expr: ${this.cronExpression}`);
          return current.toJSDate();
        }
      }

      current = this.incrementSeconds(current);
      console.log(`[DEBUG] No match, incremented to ${current.toISO()}, expr: ${this.cronExpression}`);
    }

    throw new CronError(`Infinite loop detected in getNextFireTime for expression: ${this.cronExpression}`);
  }

  getPreviousFireTime(startTime: Date | DateTime = DateTime.now()): Date {
    let current = startTime instanceof DateTime ? startTime : DateTime.fromJSDate(startTime, { zone: this.timeZone });
    current = current.set({ millisecond: 0 });
    console.log(`[DEBUG] getPreviousFireTime start: ${current.toISO()}, expr: ${this.cronExpression}`);

    let iterations = 0;
    const maxIterations = 10000;
    let daysCheckedInMonth = 0;
    const maxDaysInMonth = 31;
    const minYear = this.yearSet ? Math.min(...this.yearSet) : 1970;
    const startYear = current.year;
    const minYearSpan = startYear - 10;

    while (iterations++ < maxIterations) {
      if (current.year < minYearSpan || current.year < minYear) {
        console.log(`[DEBUG] Below min year ${Math.max(minYearSpan, minYear)} for expr: ${this.cronExpression}`);
        throw new CronError(`No valid fire time found before ${Math.max(minYearSpan, minYear)} for expression: ${this.cronExpression}`);
      }

      console.log(`[DEBUG] Iteration ${iterations}: ${current.toISO()}, expr: ${this.cronExpression}`);

      // Set time fields
      if (this.secondSet) {
        const currentSecond = current.second;
        const prevSecond = this.secondSet.filter(s => s < currentSecond).pop() ?? this.secondSet[this.secondSet.length - 1];
        current = current.set({ second: prevSecond });
        if (prevSecond >= currentSecond) {
          current = this.decrementMinutes(current);
        }
        console.log(`[DEBUG] Set second to ${current.second}, expr: ${this.cronExpression}`);
      }
      if (this.minuteSet) {
        const currentMinute = current.minute;
        const prevMinute = this.minuteSet.filter(m => m < currentMinute).pop() ?? this.minuteSet[this.minuteSet.length - 1];
        current = current.set({ minute: prevMinute });
        if (prevMinute >= currentMinute) {
          current = this.decrementHours(current);
        }
        console.log(`[DEBUG] Set minute to ${current.minute}, expr: ${this.cronExpression}`);
      }
      if (this.hourSet) {
        const currentHour = current.hour;
        const prevHour = this.hourSet.filter(h => h < currentHour).pop() ?? this.hourSet[this.hourSet.length - 1];
        current = current.set({ hour: prevHour });
        if (prevHour >= currentHour) {
          current = this.decrementDays(current);
        }
        console.log(`[DEBUG] Set hour to ${current.hour}, expr: ${this.cronExpression}`);
      }

      // Check for unconstrained days
      if (!this.dayOfMonthSet && !this.dayOfWeekSet && !this.lastDayOfMonth && !this.lastWeekday && !this.nearestWeekday && !this.nthDayOfWeek) {
        console.log(`[DEBUG] No day constraints, accepting current day: ${current.toISO()}, expr: ${this.cronExpression}`);
        if (!this.yearSet || this.yearSet.includes(current.year)) {
          if (!this.monthSet || this.monthSet.includes(current.month)) {
            console.log(`[DEBUG] Found valid fire time: ${current.toISO()}, expr: ${this.cronExpression}`);
            return current.toJSDate();
          }
        }
      }

      while (this.yearSet && !this.yearSet.includes(current.year)) {
        current = this.decrementYears(current);
        console.log(`[DEBUG] Decremented year to ${current.year}, expr: ${this.cronExpression}`);
        if (current.year < minYear) {
          throw new CronError(`No valid year found before ${minYear} for expression: ${this.cronExpression}`);
        }
      }

      let monthAdvanced = false;
      while (this.monthSet && !this.monthSet.includes(current.month)) {
        current = this.decrementMonths(current);
        monthAdvanced = true;
        console.log(`[DEBUG] Decremented month to ${current.month}, expr: ${this.cronExpression}`);
        daysCheckedInMonth = 0;
      }

      let dayMatched = false;
      let currentMonth = current.month;
      while (!dayMatched) {
        if (daysCheckedInMonth++ >= maxDaysInMonth) {
          console.log(`[DEBUG] No valid day in month ${current.month} for expr: ${this.cronExpression}`);
          if (this.monthSet && this.monthSet.length === 1) {
            // If monthSet is restricted (e.g., [2] for FEB), advance to previous year
            current = this.decrementYears(current);
            current = current.set({ month: this.monthSet[0], day: this.getLastDayOfMonth(current) });
            console.log(`[DEBUG] Restricted monthSet, advanced to previous year: ${current.toISO()}, expr: ${this.cronExpression}`);
          } else {
            current = this.decrementMonths(current);
          }
          daysCheckedInMonth = 0;
          continue;
        }

        const dom = current.day;
        const dow = current.weekday;

        console.log(`[DEBUG] Checking day: dom=${dom}, dow=${dow}, month=${current.month}, expr: ${this.cronExpression}`);

        // Validate day for leap years if month is February
        if (this.dayOfMonthSet && this.monthSet && this.monthSet.includes(2)) {
          const maxD = current.isInLeapYear ? 29 : 28;
          if (this.dayOfMonthSet.includes(dom) && dom > maxD) {
            throw new CronError(`Invalid date: day ${dom} is not valid for month 2 in ${current.year}`);
          }
        }

        if (this.lastDayOfMonth) {
          let effectiveDom = this.getLastDayOfMonth(current);
          if (this.lastDayOfWeek) {
            let temp = current.set({ day: effectiveDom });
            while (temp.weekday !== this.lastDayOfWeek && temp.day > 1) {
              temp = temp.minus({ days: 1 });
            }
            effectiveDom = temp.day;
          } else if (this.dayOfMonthSet) {
            effectiveDom -= this.dayOfMonthSet[0];
          }
          if (dom === effectiveDom) dayMatched = true;
        } else if (this.lastWeekday) {
          let effectiveDom = this.getLastDayOfMonth(current);
          effectiveDom = this.getNearestWeekday(current.set({ day: effectiveDom }), effectiveDom);
          if (dom === effectiveDom) dayMatched = true;
        } else if (this.nearestWeekday) {
          const weekday = this.getNearestWeekday(current, this.nearestWeekday);
          if (dom === weekday) dayMatched = true;
        } else if (this.nthDayOfWeek) {
          let nthDay = this.getNthDayOfWeek(current, this.nthDayOfWeek.day, this.nthDayOfWeek.nth);
          if (nthDay === null) {
            console.log(`[DEBUG] No nth day in month, decrementing month for expr: ${this.cronExpression}`);
            if (this.monthSet && this.monthSet.length === 1) {
              current = this.decrementYears(current);
              current = current.set({ month: this.monthSet[0], day: this.getLastDayOfMonth(current) });
              console.log(`[DEBUG] Restricted monthSet, advanced to previous year: ${current.toISO()}, expr: ${this.cronExpression}`);
            } else {
              current = this.decrementMonths(current);
            }
            daysCheckedInMonth = 0;
            continue;
          }
          if (dom === nthDay) dayMatched = true;
        } else if (this.dayOfMonthSet && this.dayOfMonthSet.includes(dom)) {
          dayMatched = true;
        } else if (this.dayOfWeekSet && this.dayOfWeekSet.includes(dow)) {
          dayMatched = true;
        }

        if (!dayMatched) {
          current = this.decrementDays(current);
          console.log(`[DEBUG] Day not matched, decremented to ${current.toISO()}, expr: ${this.cronExpression}`);
          continue;
        }

        if (current.month !== currentMonth && !monthAdvanced) {
          if (this.monthSet && this.monthSet.length === 1) {
            current = this.decrementYears(current);
            current = current.set({ month: this.monthSet[0], day: this.getLastDayOfMonth(current) });
            console.log(`[DEBUG] Restricted monthSet, advanced to previous year: ${current.toISO()}, expr: ${this.cronExpression}`);
          } else {
            current = this.decrementMonths(current);
            console.log(`[DEBUG] Month rollover detected, decremented to ${current.toISO()}, expr: ${this.cronExpression}`);
          }
          daysCheckedInMonth = 0;
          continue;
        }

        break;
      }

      if (current.year < minYear) {
        console.log(`[DEBUG] Below min year ${minYear} after time checks for expr: ${this.cronExpression}`);
        throw new CronError(`No valid fire time found before ${minYear} for expression: ${this.cronExpression}`);
      }

      if (!this.yearSet || this.yearSet.includes(current.year)) {
        if (!this.monthSet || this.monthSet.includes(current.month)) {
          console.log(`[DEBUG] Found valid fire time: ${current.toISO()}, expr: ${this.cronExpression}`);
          return current.toJSDate();
        }
      }

      current = this.decrementSeconds(current);
      console.log(`[DEBUG] No match, decremented to ${current.toISO()}, expr: ${this.cronExpression}`);
    }

    throw new CronError(`No previous execution time found for expression: ${this.cronExpression}`);
  }

  private getLastDayOfMonth(current: DateTime): number {
    return current.daysInMonth!;
  }

  private getNearestWeekday(current: DateTime, targetDay: number): number {
    const temp = current.set({ day: targetDay });
    const dow = temp.weekday;
    const maxDay = this.getLastDayOfMonth(current);
    if (dow === 7) return Math.min(targetDay + 1, maxDay); // Sunday -> Monday
    if (dow === 6) return Math.max(targetDay - 1, 1); // Saturday -> Friday
    return targetDay;
  }

  private getNthDayOfWeek(current: DateTime, dayOfWeek: number, nth: number): number | null {
    let count = 0;
    for (let day = 1; day <= this.getLastDayOfMonth(current); day++) {
      const temp = current.set({ day });
      if (temp.weekday === dayOfWeek) {
        count++;
        if (count === nth) return day;
      }
    }
    return null;
  }

  private incrementSeconds(current: DateTime): DateTime {
    return current.plus({ seconds: 1 });
  }

  private incrementMinutes(current: DateTime): DateTime {
    return current.plus({ minutes: 1 });
  }

  private incrementHours(current: DateTime): DateTime {
    return current.plus({ hours: 1 });
  }

  private incrementDays(current: DateTime): DateTime {
    return current.plus({ days: 1 });
  }

  private incrementMonths(current: DateTime): DateTime {
    return current.plus({ months: 1 }).set({ day: 1 });
  }

  private incrementYears(current: DateTime): DateTime {
    return current.plus({ years: 1 }).set({ month: 1, day: 1 });
  }

  private decrementSeconds(current: DateTime): DateTime {
    return current.minus({ seconds: 1 });
  }

  private decrementMinutes(current: DateTime): DateTime {
    return current.minus({ minutes: 1 });
  }

  private decrementHours(current: DateTime): DateTime {
    return current.minus({ hours: 1 });
  }

  private decrementDays(current: DateTime): DateTime {
    return current.minus({ days: 1 });
  }

  private decrementMonths(current: DateTime): DateTime {
    return current.minus({ months: 1 }).set({ day: this.getLastDayOfMonth(current) });
  }

  private decrementYears(current: DateTime): DateTime {
    return current.minus({ years: 1 });
  }

  translate(): string {
    const parts: string[] = [];

    let timeStr = '';
    if (this.hourSet && this.hourSet.length === 1) {
      const hour = this.hourSet[0];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      timeStr = `at time ${displayHour}:${this.minuteSet?.[0]?.toString().padStart(2, '0') || '00'}${this.secondSet && this.secondSet[0] !== 0 ? `:${this.secondSet[0].toString().padStart(2, '0')}` : ''} ${ampm}`;
    } else if (this.hourSet?.length) {
      timeStr = `at hours ${this.hourSet.join(', ')}`;
    } else {
      timeStr = 'every hour';
    }
    if (this.minuteSet?.length === 1) {
      timeStr = `at minute ${this.minuteSet[0]}${timeStr ? `, ${timeStr}` : ''}`;
    } else if (this.minuteSet?.length) {
      timeStr = `at minutes ${this.minuteSet.join(', ')}${timeStr ? `, ${timeStr}` : ''}`;
    }
    if (this.secondSet?.length === 1 && this.secondSet[0] !== 0) {
      timeStr = `at second ${this.secondSet[0]}${timeStr ? `, ${timeStr}` : ''}`;
    } else if (this.secondSet?.length && this.secondSet[0] !== 0) {
      timeStr = `at seconds ${this.secondSet.join(', ')}${timeStr ? `, ${timeStr}` : ''}`;
    }
    if (timeStr) parts.push(timeStr);

    let dayStr = '';
    if (this.lastDayOfMonth) {
      dayStr = 'on the last day of the month';
      if (this.lastDayOfWeek) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        dayStr = `on the last ${days[this.lastDayOfWeek - 1]} of the month`;
      }
    } else if (this.lastWeekday) {
      dayStr = 'on the last weekday of the month';
    } else if (this.nearestWeekday) {
      dayStr = `on the nearest weekday to the ${this.nearestWeekday}th of the month`;
    } else if (this.nthDayOfWeek) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const nth = ['first', 'second', 'third', 'fourth', 'fifth'][this.nthDayOfWeek.nth - 1];
      dayStr = `on the ${nth} ${days[this.nthDayOfWeek.day - 1]} of the month`;
    } else if (this.dayOfMonthSet) {
      dayStr = `on the ${this.dayOfMonthSet.join(' and ')}th of the month`;
    } else if (this.dayOfWeekSet) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dayStr = `on days ${this.dayOfWeekSet.map(d => days[d - 1]).join(', ')}`;
    } else {
      dayStr = 'every day';
    }

    if (this.monthSet && this.monthSet.length === 1 && dayStr.includes('of the month')) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      dayStr = dayStr.replace('of the month', `of ${months[this.monthSet[0] - 1]}`);
      parts.push(dayStr);
    } else {
      if (dayStr) parts.push(dayStr);
      if (this.monthSet && this.monthSet.length < 12) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        parts.push(`in ${this.monthSet.length === 1 ? months[this.monthSet[0] - 1] : `months ${this.monthSet.map(m => months[m - 1]).join(', ')}`}`);
      }
    }

    if (this.yearSet && this.yearSet.length === 1) {
      parts.push(`in year ${this.yearSet[0]}`);
    }

    return parts.join(', ');
  }

  toUnixInteger(date: Date | DateTime): number {
    const dt = date instanceof DateTime ? date : DateTime.fromJSDate(date);
    return Math.floor(dt.toUTC().toMillis() / 1000);
  }

  next(from: Date | DateTime): number {
    return this.toUnixInteger(this.getNextFireTime(from));
  }

  previous(from: Date | DateTime): number {
    return this.toUnixInteger(this.getPreviousFireTime(from));
  }
}

export default CronParser;
