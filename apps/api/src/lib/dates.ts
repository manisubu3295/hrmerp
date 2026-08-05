// Local-timezone Date construction (`new Date(year, month - 1, 1)`) produces
// a different instant than intended once the server isn't running in UTC,
// which silently shifts month-boundary queries against UTC-normalized
// @db.Date columns. Build the range in UTC instead so it lines up with how
// those columns are actually stored, regardless of server TZ.
export function monthRangeUTC(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}
