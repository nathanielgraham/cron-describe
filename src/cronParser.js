"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronParser = void 0;
// src/cronParser.ts
var luxon_1 = require("luxon");
var CronError = /** @class */ (function (_super) {
    __extends(CronError, _super);
    function CronError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return CronError;
}(Error));
var CronParser = /** @class */ (function () {
    function CronParser(cronExpression, timeZone) {
        if (timeZone === void 0) { timeZone = 'UTC'; }
        this.lastDayOfMonth = false;
        this.lastDayOfWeek = null;
        this.lastWeekday = false;
        this.nearestWeekday = null;
        this.nthDayOfWeek = null;
        console.log("[DEBUG] Parsing cron: ".concat(cronExpression, ", timezone: ").concat(timeZone));
        this.timeZone = timeZone;
        var parts = cronExpression.trim().split(/\s+/);
        if (parts.length < 5 || parts.length > 7) {
            throw new CronError('Invalid cron expression: must have 5-7 fields');
        }
        var offset = 0;
        this.secondSet = [0];
        if (parts.length >= 6) {
            this.secondSet = this.parseField(parts[0], 0, 59);
            offset = 1;
            console.log("[DEBUG] Parsed seconds: ".concat(JSON.stringify(this.secondSet)));
        }
        this.minuteSet = this.parseField(parts[offset], 0, 59);
        this.hourSet = this.parseField(parts[offset + 1], 0, 23);
        this.dayOfMonthSet = this.parseField(parts[offset + 2], 1, 31, true);
        this.monthSet = this.parseField(parts[offset + 3], 1, 12, false, ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']);
        this.dayOfWeekSet = this.parseField(parts[offset + 4], 1, 7, true, ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
        this.yearSet = parts.length === offset + 6 ? this.parseField(parts[offset + 5], 1970, 2099) : [luxon_1.DateTime.now().year];
        console.log("[DEBUG] Parsed fields: ".concat(JSON.stringify({ second: this.secondSet, minute: this.minuteSet, hour: this.hourSet, dayOfMonth: this.dayOfMonthSet, month: this.monthSet, dayOfWeek: this.dayOfWeekSet, year: this.yearSet })));
        if (this.dayOfMonthSet !== null && this.dayOfWeekSet !== null && !this.lastDayOfMonth && !this.nthDayOfWeek && !this.nearestWeekday && !this.lastWeekday) {
            throw new CronError('Both day-of-month and day-of-week cannot be specified unless one is * or ?');
        }
        if (this.dayOfMonthSet && this.monthSet) {
            for (var _i = 0, _a = this.monthSet; _i < _a.length; _i++) {
                var m = _a[_i];
                var maxD = 31;
                if (m === 2)
                    maxD = 29;
                if ([4, 6, 9, 11].includes(m))
                    maxD = 30;
                for (var _b = 0, _c = this.dayOfMonthSet; _b < _c.length; _b++) {
                    var d = _c[_b];
                    if (d > maxD) {
                        throw new CronError("Invalid date: day ".concat(d, " is not valid for month ").concat(m));
                    }
                }
            }
        }
    }
    CronParser.prototype.parseField = function (field, min, max, allowSpecial, aliases) {
        if (allowSpecial === void 0) { allowSpecial = false; }
        console.log("[DEBUG] Parsing field: ".concat(field, ", min: ").concat(min, ", max: ").concat(max, ", allowSpecial: ").concat(allowSpecial));
        if (field === '*' || field === '?') {
            console.log("[DEBUG] Field is wildcard: ".concat(field));
            return null;
        }
        field = aliases ? this.resolveAliases(field, aliases) : field;
        console.log("[DEBUG] After aliases: ".concat(field));
        if (allowSpecial) {
            if (field === 'L') {
                this.lastDayOfMonth = true;
                console.log("[DEBUG] Set lastDayOfMonth: true");
                return null;
            }
            else if (field === 'LW') {
                this.lastWeekday = true;
                console.log("[DEBUG] Set lastWeekday: true");
                return null;
            }
            else if (field.includes('L-')) {
                var offset = parseInt(field.split('L-')[1], 10);
                if (isNaN(offset) || offset < 0)
                    throw new CronError("Invalid L offset: ".concat(field));
                this.lastDayOfMonth = true;
                console.log("[DEBUG] Set lastDayOfMonth with offset: ".concat(offset));
                return [offset];
            }
            else if (field.endsWith('L') && allowSpecial) {
                var day = parseInt(field.slice(0, -1), 10);
                if (isNaN(day) || day < 1 || day > 7)
                    throw new CronError("Invalid L day-of-week: ".concat(field));
                this.lastDayOfMonth = true;
                this.lastDayOfWeek = day;
                console.log("[DEBUG] Set lastDayOfMonth and lastDayOfWeek: ".concat(day));
                return null;
            }
            else if (field.includes('W')) {
                var day = parseInt(field.replace('W', ''), 10);
                if (isNaN(day) || day < 1 || day > 31)
                    throw new CronError("Invalid W day: ".concat(field));
                this.nearestWeekday = day;
                console.log("[DEBUG] Set nearestWeekday: ".concat(day));
                return null;
            }
            else if (field.includes('#')) {
                var _a = field.split('#').map(function (v) { return parseInt(v, 10); }), day = _a[0], nth = _a[1];
                if (isNaN(day) || isNaN(nth) || day < 1 || day > 7 || nth < 1 || nth > 5) {
                    throw new CronError("Invalid #n notation: ".concat(field));
                }
                this.nthDayOfWeek = { day: day, nth: nth };
                console.log("[DEBUG] Set nthDayOfWeek: ".concat(JSON.stringify(this.nthDayOfWeek)));
                return null;
            }
        }
        var values = [];
        var parts = field.split(',');
        for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
            var part = parts_1[_i];
            console.log("[DEBUG] Parsing part: ".concat(part));
            if (part.includes('/')) {
                var _b = part.split('/'), range = _b[0], step = _b[1];
                var stepValue = parseInt(step, 10);
                if (isNaN(stepValue) || stepValue <= 0)
                    throw new CronError("Invalid step value: ".concat(step));
                var _c = range === '*' ? [min, max] : range.includes('-') ? range.split('-').map(function (v) { return parseInt(v, 10); }) : [parseInt(range, 10) || min, max], start = _c[0], end = _c[1];
                if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
                    throw new CronError("Invalid range: ".concat(range));
                }
                for (var i = start; i <= end; i += stepValue) {
                    values.push(i);
                }
                console.log("[DEBUG] Step parsed: start=".concat(start, ", end=").concat(end, ", step=").concat(stepValue, ", values=").concat(values));
            }
            else if (part.includes('-')) {
                var _d = part.split('-').map(function (v) { return parseInt(v, 10); }), start = _d[0], end = _d[1];
                if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
                    throw new CronError("Invalid range: ".concat(part));
                }
                for (var i = start; i <= end; i++) {
                    values.push(i);
                }
                console.log("[DEBUG] Range parsed: start=".concat(start, ", end=").concat(end, ", values=").concat(values));
            }
            else {
                var num = parseInt(part, 10);
                if (isNaN(num) || num < min || num > max)
                    throw new CronError("Invalid value: ".concat(part));
                values.push(num);
                console.log("[DEBUG] Single value parsed: ".concat(num));
            }
        }
        var result = values.length > 0 ? __spreadArray([], new Set(values), true).sort(function (a, b) { return a - b; }) : null;
        console.log("[DEBUG] Final parsed values: ".concat(JSON.stringify(result)));
        return result;
    };
    CronParser.prototype.resolveAliases = function (field, aliases) {
        var aliasMap = {
            JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
            SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7
        };
        var result = aliases.reduce(function (acc, alias) { return acc.replace(new RegExp("\\b".concat(alias, "\\b"), 'gi'), aliasMap[alias].toString()); }, field);
        console.log("[DEBUG] Resolved aliases: ".concat(field, " -> ").concat(result));
        return result;
    };
    CronParser.prototype.getNextFireTime = function (startTime) {
        if (startTime === void 0) { startTime = luxon_1.DateTime.now(); }
        var current = startTime instanceof luxon_1.DateTime ? startTime : luxon_1.DateTime.fromJSDate(startTime, { zone: this.timeZone });
        current = current.set({ millisecond: 0 });
        console.log("[DEBUG] getNextFireTime start: ".concat(current.toISO(), ", expr: ").concat(JSON.stringify({ second: this.secondSet, minute: this.minuteSet, hour: this.hourSet, dayOfMonth: this.dayOfMonthSet, month: this.monthSet, dayOfWeek: this.dayOfWeekSet, year: this.yearSet })));
        var iterations = 0;
        var maxIterations = 10000;
        while (iterations++ < maxIterations) {
            if (this.secondSet)
                current = current.set({ second: 0 });
            if (this.minuteSet)
                current = current.set({ minute: 0 });
            if (this.hourSet)
                current = current.set({ hour: 0 });
            if (this.dayOfMonthSet || this.dayOfWeekSet || this.lastDayOfMonth || this.lastWeekday || this.nearestWeekday || this.nthDayOfWeek) {
                current = current.set({ day: 1 });
            }
            console.log("[DEBUG] Iteration ".concat(iterations, ": ").concat(current.toISO()));
            while (this.yearSet && !this.yearSet.includes(current.year)) {
                current = this.incrementYears(current);
                console.log("[DEBUG] Incremented year to ".concat(current.year));
            }
            while (this.monthSet && !this.monthSet.includes(current.month)) {
                current = this.incrementMonths(current);
                console.log("[DEBUG] Incremented month to ".concat(current.month));
            }
            var dayMatched = false;
            var currentMonth = current.month;
            while (!dayMatched) {
                var dom = current.day;
                var dow = current.weekday;
                console.log("[DEBUG] Checking day: dom=".concat(dom, ", dow=").concat(dow, ", month=").concat(current.month));
                if (this.lastDayOfMonth) {
                    var effectiveDom = this.getLastDayOfMonth(current);
                    if (this.lastDayOfWeek) {
                        var temp = current.set({ day: effectiveDom });
                        while (temp.weekday !== this.lastDayOfWeek) {
                            temp = temp.minus({ days: 1 });
                        }
                        effectiveDom = temp.day;
                    }
                    else if (this.dayOfMonthSet) {
                        effectiveDom -= this.dayOfMonthSet[0];
                    }
                    if (dom === effectiveDom)
                        dayMatched = true;
                }
                else if (this.lastWeekday) {
                    var effectiveDom = this.getLastDayOfMonth(current);
                    effectiveDom = this.getNearestWeekday(current.set({ day: effectiveDom }), effectiveDom);
                    if (dom === effectiveDom)
                        dayMatched = true;
                }
                else if (this.nearestWeekday) {
                    var weekday = this.getNearestWeekday(current, this.nearestWeekday);
                    if (dom === weekday)
                        dayMatched = true;
                }
                else if (this.nthDayOfWeek) {
                    var nthDay = this.getNthDayOfWeek(current, this.nthDayOfWeek.day, this.nthDayOfWeek.nth);
                    if (nthDay === null) {
                        console.log("[DEBUG] No nth day in month, incrementing month");
                        current = this.incrementMonths(current);
                        continue;
                    }
                    if (dom === nthDay)
                        dayMatched = true;
                }
                else if (this.dayOfMonthSet && this.dayOfMonthSet.includes(dom)) {
                    dayMatched = true;
                }
                else if (this.dayOfWeekSet && this.dayOfWeekSet.includes(dow)) {
                    dayMatched = true;
                }
                if (!dayMatched) {
                    current = this.incrementDays(current);
                    console.log("[DEBUG] Day not matched, incremented to ".concat(current.toISO()));
                    continue;
                }
                if (current.month !== currentMonth) {
                    current = this.incrementMonths(current);
                    console.log("[DEBUG] Month rollover detected, incremented to ".concat(current.toISO()));
                    continue;
                }
                break;
            }
            while (this.hourSet && !this.hourSet.includes(current.hour)) {
                current = this.incrementHours(current);
                console.log("[DEBUG] Incremented hour to ".concat(current.hour));
            }
            while (this.minuteSet && !this.minuteSet.includes(current.minute)) {
                current = this.incrementMinutes(current);
                console.log("[DEBUG] Incremented minute to ".concat(current.minute));
            }
            while (this.secondSet && !this.secondSet.includes(current.second)) {
                current = this.incrementSeconds(current);
                console.log("[DEBUG] Incremented second to ".concat(current.second));
            }
            if ((!this.yearSet || this.yearSet.includes(current.year)) &&
                (!this.monthSet || this.monthSet.includes(current.month))) {
                console.log("[DEBUG] Found valid fire time: ".concat(current.toISO()));
                return current.toJSDate();
            }
            current = this.incrementSeconds(current);
            console.log("[DEBUG] No match, incremented to ".concat(current.toISO()));
        }
        throw new CronError('Infinite loop detected in getNextFireTime; unreachable schedule?');
    };
    CronParser.prototype.getPreviousFireTime = function (startTime) {
        if (startTime === void 0) { startTime = luxon_1.DateTime.now(); }
        var current = startTime instanceof luxon_1.DateTime ? startTime : luxon_1.DateTime.fromJSDate(startTime, { zone: this.timeZone });
        current = current.set({ millisecond: 0, second: 59 });
        console.log("[DEBUG] getPreviousFireTime start: ".concat(current.toISO(), ", expr: ").concat(JSON.stringify({ second: this.secondSet, minute: this.minuteSet, hour: this.hourSet, dayOfMonth: this.dayOfMonthSet, month: this.monthSet, dayOfWeek: this.dayOfWeekSet, year: this.yearSet })));
        var iterations = 0;
        var maxIterations = 10000;
        while (iterations++ < maxIterations) {
            console.log("[DEBUG] Iteration ".concat(iterations, ": ").concat(current.toISO()));
            while (this.yearSet && !this.yearSet.includes(current.year)) {
                current = this.decrementYears(current);
                console.log("[DEBUG] Decremented year to ".concat(current.year));
            }
            while (this.monthSet && !this.monthSet.includes(current.month)) {
                current = this.decrementMonths(current);
                console.log("[DEBUG] Decremented month to ".concat(current.month));
            }
            var dayMatched = false;
            var currentMonth = current.month;
            while (!dayMatched) {
                var dom = current.day;
                var dow = current.weekday;
                console.log("[DEBUG] Checking day: dom=".concat(dom, ", dow=").concat(dow, ", month=").concat(current.month));
                if (this.lastDayOfMonth) {
                    var effectiveDom = this.getLastDayOfMonth(current);
                    if (this.lastDayOfWeek) {
                        var temp = current.set({ day: effectiveDom });
                        while (temp.weekday !== this.lastDayOfWeek) {
                            temp = temp.minus({ days: 1 });
                        }
                        effectiveDom = temp.day;
                    }
                    else if (this.dayOfMonthSet) {
                        effectiveDom -= this.dayOfMonthSet[0];
                    }
                    if (dom === effectiveDom)
                        dayMatched = true;
                }
                else if (this.lastWeekday) {
                    var effectiveDom = this.getLastDayOfMonth(current);
                    effectiveDom = this.getNearestWeekday(current.set({ day: effectiveDom }), effectiveDom);
                    if (dom === effectiveDom)
                        dayMatched = true;
                }
                else if (this.nearestWeekday) {
                    var weekday = this.getNearestWeekday(current, this.nearestWeekday);
                    if (dom === weekday)
                        dayMatched = true;
                }
                else if (this.nthDayOfWeek) {
                    var nthDay = this.getNthDayOfWeek(current, this.nthDayOfWeek.day, this.nthDayOfWeek.nth);
                    if (nthDay === null) {
                        console.log("[DEBUG] No nth day in month, decrementing month");
                        current = this.decrementMonths(current);
                        continue;
                    }
                    if (dom === nthDay)
                        dayMatched = true;
                }
                else if (this.dayOfMonthSet && this.dayOfMonthSet.includes(dom)) {
                    dayMatched = true;
                }
                else if (this.dayOfWeekSet && this.dayOfWeekSet.includes(dow)) {
                    dayMatched = true;
                }
                if (!dayMatched) {
                    current = this.decrementDays(current);
                    console.log("[DEBUG] Day not matched, decremented to ".concat(current.toISO()));
                    continue;
                }
                if (current.month !== currentMonth) {
                    current = this.decrementMonths(current);
                    console.log("[DEBUG] Month rollover detected, decremented to ".concat(current.toISO()));
                    continue;
                }
                break;
            }
            while (this.hourSet && !this.hourSet.includes(current.hour)) {
                current = this.decrementHours(current);
                console.log("[DEBUG] Decremented hour to ".concat(current.hour));
            }
            while (this.minuteSet && !this.minuteSet.includes(current.minute)) {
                current = this.decrementMinutes(current);
                console.log("[DEBUG] Decremented minute to ".concat(current.minute));
            }
            while (this.secondSet && !this.secondSet.includes(current.second)) {
                current = this.decrementSeconds(current);
                console.log("[DEBUG] Decremented second to ".concat(current.second));
            }
            if ((!this.yearSet || this.yearSet.includes(current.year)) &&
                (!this.monthSet || this.monthSet.includes(current.month))) {
                console.log("[DEBUG] Found valid fire time: ".concat(current.toISO()));
                return current.toJSDate();
            }
            current = this.decrementSeconds(current);
            console.log("[DEBUG] No match, decremented to ".concat(current.toISO()));
        }
        throw new CronError('No previous execution time found');
    };
    CronParser.prototype.getLastDayOfMonth = function (current) {
        return current.daysInMonth;
    };
    CronParser.prototype.getNearestWeekday = function (current, targetDay) {
        var temp = current.set({ day: targetDay });
        var dow = temp.weekday;
        var maxDay = this.getLastDayOfMonth(current);
        if (dow === 7)
            return Math.min(targetDay + 1, maxDay); // Sunday -> Monday
        if (dow === 6)
            return Math.max(targetDay - 1, 1); // Saturday -> Friday
        return targetDay;
    };
    CronParser.prototype.getNthDayOfWeek = function (current, dayOfWeek, nth) {
        var count = 0;
        for (var day = 1; day <= this.getLastDayOfMonth(current); day++) {
            var temp = current.set({ day: day });
            if (temp.weekday === dayOfWeek) {
                count++;
                if (count === nth)
                    return day;
            }
        }
        return null;
    };
    CronParser.prototype.incrementSeconds = function (current) {
        return current.plus({ seconds: 1 });
    };
    CronParser.prototype.incrementMinutes = function (current) {
        return current.plus({ minutes: 1 });
    };
    CronParser.prototype.incrementHours = function (current) {
        return current.plus({ hours: 1 });
    };
    CronParser.prototype.incrementDays = function (current) {
        return current.plus({ days: 1 });
    };
    CronParser.prototype.incrementMonths = function (current) {
        return current.plus({ months: 1 }).set({ day: 1 });
    };
    CronParser.prototype.incrementYears = function (current) {
        return current.plus({ years: 1 }).set({ month: 1, day: 1 });
    };
    CronParser.prototype.decrementSeconds = function (current) {
        return current.minus({ seconds: 1 });
    };
    CronParser.prototype.decrementMinutes = function (current) {
        return current.minus({ minutes: 1 });
    };
    CronParser.prototype.decrementHours = function (current) {
        return current.minus({ hours: 1 });
    };
    CronParser.prototype.decrementDays = function (current) {
        return current.minus({ days: 1 });
    };
    CronParser.prototype.decrementMonths = function (current) {
        return current.minus({ months: 1 }).set({ day: this.getLastDayOfMonth(current) });
    };
    CronParser.prototype.decrementYears = function (current) {
        return current.minus({ years: 1 });
    };
    CronParser.prototype.translate = function () {
        var _a, _b, _c, _d, _e, _f, _g;
        var parts = [];
        var timeStr = '';
        if (this.hourSet && this.hourSet.length === 1) {
            var hour = this.hourSet[0];
            var ampm = hour >= 12 ? 'PM' : 'AM';
            var displayHour = hour % 12 || 12;
            timeStr = "at time ".concat(displayHour, ":").concat(((_b = (_a = this.minuteSet) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.toString().padStart(2, '0')) || '00').concat(this.secondSet && this.secondSet[0] !== 0 ? ":".concat(this.secondSet[0].toString().padStart(2, '0')) : '', " ").concat(ampm);
        }
        else if ((_c = this.hourSet) === null || _c === void 0 ? void 0 : _c.length) {
            timeStr = "at hours ".concat(this.hourSet.join(', '));
        }
        else {
            timeStr = 'every hour';
        }
        if (((_d = this.minuteSet) === null || _d === void 0 ? void 0 : _d.length) === 1) {
            timeStr = "at minute ".concat(this.minuteSet[0]).concat(timeStr ? ", ".concat(timeStr) : '');
        }
        else if ((_e = this.minuteSet) === null || _e === void 0 ? void 0 : _e.length) {
            timeStr = "at minutes ".concat(this.minuteSet.join(', ')).concat(timeStr ? ", ".concat(timeStr) : '');
        }
        if (((_f = this.secondSet) === null || _f === void 0 ? void 0 : _f.length) === 1 && this.secondSet[0] !== 0) {
            timeStr = "at second ".concat(this.secondSet[0]).concat(timeStr ? ", ".concat(timeStr) : '');
        }
        else if (((_g = this.secondSet) === null || _g === void 0 ? void 0 : _g.length) && this.secondSet[0] !== 0) {
            timeStr = "at seconds ".concat(this.secondSet.join(', ')).concat(timeStr ? ", ".concat(timeStr) : '');
        }
        if (timeStr)
            parts.push(timeStr);
        var dayStr = '';
        if (this.lastDayOfMonth) {
            dayStr = 'on the last day of the month';
            if (this.lastDayOfWeek) {
                var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                dayStr = "on the last ".concat(days[this.lastDayOfWeek - 1], " of the month");
            }
        }
        else if (this.lastWeekday) {
            dayStr = 'on the last weekday of the month';
        }
        else if (this.nearestWeekday) {
            dayStr = "on the nearest weekday to the ".concat(this.nearestWeekday, "th of the month");
        }
        else if (this.nthDayOfWeek) {
            var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            var nth = ['first', 'second', 'third', 'fourth', 'fifth'][this.nthDayOfWeek.nth - 1];
            dayStr = "on the ".concat(nth, " ").concat(days[this.nthDayOfWeek.day - 1], " of the month");
        }
        else if (this.dayOfMonthSet) {
            dayStr = "on the ".concat(this.dayOfMonthSet.join(' and '), "th of the month");
        }
        else if (this.dayOfWeekSet) {
            var days_1 = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            dayStr = "on days ".concat(this.dayOfWeekSet.map(function (d) { return days_1[d - 1]; }).join(', '));
        }
        if (this.monthSet && this.monthSet.length === 1 && dayStr.includes('of the month')) {
            var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            dayStr = dayStr.replace('of the month', "of ".concat(months[this.monthSet[0] - 1]));
            parts.push(dayStr);
        }
        else {
            if (dayStr)
                parts.push(dayStr);
            if (this.monthSet && this.monthSet.length < 12) {
                var months_1 = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                parts.push("in ".concat(this.monthSet.length === 1 ? months_1[this.monthSet[0] - 1] : "months ".concat(this.monthSet.map(function (m) { return months_1[m - 1]; }).join(', '))));
            }
        }
        if (this.yearSet && this.yearSet.length === 1) {
            parts.push("in year ".concat(this.yearSet[0]));
        }
        return parts.join(', ');
    };
    CronParser.prototype.toUnixInteger = function (date) {
        var dt = date instanceof luxon_1.DateTime ? date : luxon_1.DateTime.fromJSDate(date);
        return Math.floor(dt.toUTC().toMillis() / 1000);
    };
    CronParser.prototype.next = function (from) {
        return this.toUnixInteger(this.getNextFireTime(from));
    };
    CronParser.prototype.previous = function (from) {
        return this.toUnixInteger(this.getPreviousFireTime(from));
    };
    return CronParser;
}());
exports.CronParser = CronParser;
exports.default = CronParser;
