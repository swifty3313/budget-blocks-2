export function billDateInBand(
  bandStart: Date,
  bandEnd: Date,
  dueDay: number | 'Last'
): { date: Date | null; inBand: boolean } {
  const d = new Date(bandStart);

  if (dueDay === 'Last') {
    // Last day of the month
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      date: last,
      inBand: last >= bandStart && last <= bandEnd,
    };
  } else {
    // Specific day of month
    const candidate = new Date(d.getFullYear(), d.getMonth(), dueDay);
    return {
      date: candidate,
      inBand: candidate >= bandStart && candidate <= bandEnd,
    };
  }
}

export function extractDueDay(date: Date): number | 'Last' {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  if (day === lastDayOfMonth) {
    return 'Last';
  }
  return day;
}
