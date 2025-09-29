# cron-describe

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

A lightweight TypeScript library for parsing cron expressions and calculating the next fire time. Supports standard Quartz cron format with fields for minute, hour, day-of-month, month, day-of-week, and optional year. Handles edge cases like leap years, invalid dates, and day field exclusivity (one must be `?`).

This project is under active development, with a focus on robust test coverage and performance optimization for next-fire-time calculations.

## Features

- **Full Cron Parsing**: Supports basic numeric lists, with extensibility for ranges (`1-5`), steps (`*/15`), and wildcards (`*`).
- **Next Fire Time Calculation**: Efficiently computes the subsequent execution date from a given start time, preventing infinite loops.
- **Error Handling**: Throws `CronError` for invalid expressions, conflicting fields, or unreachable schedules.
- **Leap Year Support**: Validates February 29th and month/day boundaries.
- **Test-Driven**: Comprehensive Jest suite covering standard cases, edges, and invalids.

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/nathanielgraham/cron-describe.git
   cd cron-describe
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run tests:
   ```
   npm test
   ```

## Usage

### Basic Parsing and Next Fire Time

```typescript
import { CronParser, CronError } from './cronParser';

// Parse a cron expression
const parser = new CronParser('0 0 12 * * ?');  // Every day at noon

// Get the next fire time after a start date
const nextFire = parser.getNextFireTime(new Date('2025-09-29T00:00:00Z'));
console.log(nextFire.toISOString());  // e.g., '2025-09-29T12:00:00.000Z'

// Handles errors
try {
  const invalidParser = new CronParser('0 0 0 29 FEB ? 2025');  // Non-leap year
  invalidParser.getNextFireTime(new Date('2025-01-01'));
} catch (error) {
  console.error(error instanceof CronError ? error.message : 'Unknown error');
  // Output: "No valid fire time found within reasonable bounds" or parse-time error
}
```

### Supported Cron Format

- **Fields**: `minute hour dayOfMonth month dayOfWeek [year]`
- **Values**:
  - Minute/Hour: 0-59 / 0-23
  - DayOfMonth: 1-31 or `?` (if using dayOfWeek)
  - Month: 1-12, JAN-DEC, or `*`
  - DayOfWeek: 1-7 (1=MON), SUN-SAT, or `?` (if using dayOfMonth)
  - Year: Optional, defaults to current year
- **Exclusivity Rule**: Exactly one of `dayOfMonth` or `dayOfWeek` must be `?`.

For advanced formats (ranges, steps), extend the `parseSet` method in `cronParser.ts`.

## Project Structure

```
cron-describe/
├── src/
│   └── cronParser.ts     # Core parser and scheduler logic
├── tests/
│   └── cronParser.test.ts # Jest test suite
├── package.json          # Dependencies (Jest, TypeScript)
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Development

- **Build**: `tsc` (or use `npm run build` if scripted).
- **Testing**: `npm test` runs Jest with coverage.
- **Linting**: Add ESLint for code quality (not yet configured).

Contributions welcome! Fork, branch, and submit PRs for features like full range/step support or Node.js integration.

## License

MIT License - see [LICENSE](LICENSE) (add one if not present).
