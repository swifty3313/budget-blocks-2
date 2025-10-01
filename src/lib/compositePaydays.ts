import { addWeeks, addMonths, addDays, lastDayOfMonth, setDate, startOfMonth, endOfMonth } from "date-fns";
import type { PaySchedule } from "@/types";

// Helper to get day of month accounting for "Last"
const getDayOfMonth = (year: number, month: number, day: number | 'Last'): Date => {
  if (day === 'Last') {
    return lastDayOfMonth(new Date(year, month, 1));
  }
  return setDate(new Date(year, month, 1), day);
};

interface Payday {
  date: Date;
  scheduleId: string;
  scheduleName: string;
  type: string; // e.g., "Semi-Monthly (Last)", "Bi-Weekly"
}

/**
 * Generate all paydays from a schedule within a date range
 */
export function generatePaydaysForSchedule(
  schedule: PaySchedule,
  startDate: Date,
  endDate: Date
): Payday[] {
  const paydays: Payday[] = [];
  const now = new Date();

  if (schedule.frequency === 'Monthly') {
    const anchorDay = schedule.anchorDay || 1;
    
    // Generate for each month in range
    let currentMonth = new Date(startDate);
    currentMonth.setDate(1); // Start at first of month
    
    while (currentMonth <= endDate) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const payday = getDayOfMonth(year, month, anchorDay);
      
      if (payday >= startDate && payday <= endDate) {
        paydays.push({
          date: payday,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          type: `Monthly (${anchorDay === 'Last' ? 'Last' : anchorDay})`,
        });
      }
      
      currentMonth = addMonths(currentMonth, 1);
    }
  } else if (schedule.frequency === 'Semi-Monthly') {
    const day1 = schedule.semiMonthlyDay1 || 1;
    const day2 = schedule.semiMonthlyDay2 || 15;
    
    let currentMonth = new Date(startDate);
    currentMonth.setDate(1);
    
    while (currentMonth <= endDate) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      // First payday
      const payday1 = getDayOfMonth(year, month, day1);
      if (payday1 >= startDate && payday1 <= endDate) {
        paydays.push({
          date: payday1,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          type: `Semi-Monthly (${day1 === 'Last' ? 'Last' : day1})`,
        });
      }
      
      // Second payday
      const payday2 = getDayOfMonth(year, month, day2);
      if (payday2 >= startDate && payday2 <= endDate) {
        paydays.push({
          date: payday2,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          type: `Semi-Monthly (${day2 === 'Last' ? 'Last' : day2})`,
        });
      }
      
      currentMonth = addMonths(currentMonth, 1);
    }
  } else if (schedule.frequency === 'Bi-Weekly') {
    const anchor = schedule.anchorDate ? new Date(schedule.anchorDate) : now;
    
    // Find first payday in range
    let currentPayday = new Date(anchor);
    
    // Go back to ensure we capture all paydays in range
    while (currentPayday > startDate) {
      currentPayday = addWeeks(currentPayday, -2);
    }
    
    // Generate forward
    while (currentPayday <= endDate) {
      if (currentPayday >= startDate) {
        paydays.push({
          date: new Date(currentPayday),
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          type: 'Bi-Weekly',
        });
      }
      currentPayday = addWeeks(currentPayday, 2);
    }
  } else if (schedule.frequency === 'Weekly') {
    const anchor = schedule.anchorDate ? new Date(schedule.anchorDate) : now;
    
    let currentPayday = new Date(anchor);
    
    while (currentPayday > startDate) {
      currentPayday = addWeeks(currentPayday, -1);
    }
    
    while (currentPayday <= endDate) {
      if (currentPayday >= startDate) {
        paydays.push({
          date: new Date(currentPayday),
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          type: 'Weekly',
        });
      }
      currentPayday = addWeeks(currentPayday, 1);
    }
  }

  return paydays;
}

/**
 * Generate composite bands from multiple schedules
 */
export function generateCompositeBands(
  schedules: PaySchedule[],
  startDate: Date,
  endDate: Date,
  excludedPaydays: Set<string> = new Set(), // Format: "scheduleId:timestamp"
  includeLeadIn: boolean = true
): Array<{
  startDate: Date;
  endDate: Date;
  sourcePaydays: Array<{ scheduleId: string; scheduleName: string; type: string }>;
}> {
  // Collect all paydays from all schedules
  const allPaydays: Payday[] = [];
  
  schedules.forEach(schedule => {
    const schedulePaydays = generatePaydaysForSchedule(schedule, startDate, endDate);
    allPaydays.push(...schedulePaydays);
  });

  // Filter out excluded paydays
  const filteredPaydays = allPaydays.filter(payday => {
    const key = `${payday.scheduleId}:${payday.date.getTime()}`;
    return !excludedPaydays.has(key);
  });

  // Sort by date and dedupe same-day paydays
  const paydayMap = new Map<number, Payday[]>();
  filteredPaydays.forEach(payday => {
    const timestamp = payday.date.getTime();
    if (!paydayMap.has(timestamp)) {
      paydayMap.set(timestamp, []);
    }
    paydayMap.get(timestamp)!.push(payday);
  });

  const sortedTimestamps = Array.from(paydayMap.keys()).sort((a, b) => a - b);
  const uniquePaydays: Array<{ date: Date; paydays: Payday[] }> = sortedTimestamps.map(ts => ({
    date: new Date(ts),
    paydays: paydayMap.get(ts)!,
  }));

  if (uniquePaydays.length === 0) {
    return [];
  }

  const bands: Array<{
    startDate: Date;
    endDate: Date;
    sourcePaydays: Array<{ scheduleId: string; scheduleName: string; type: string }>;
  }> = [];

  // Optionally add lead-in band if first payday is after start of range
  if (includeLeadIn && uniquePaydays[0].date > startDate) {
    bands.push({
      startDate: new Date(startDate),
      endDate: addDays(uniquePaydays[0].date, -1),
      sourcePaydays: [{ 
        scheduleId: 'lead-in', 
        scheduleName: 'Lead-in', 
        type: 'Before first payday' 
      }],
    });
  }

  // Create bands between consecutive paydays
  for (let i = 0; i < uniquePaydays.length - 1; i++) {
    const currentPayday = uniquePaydays[i];
    const nextPayday = uniquePaydays[i + 1];
    
    bands.push({
      startDate: new Date(currentPayday.date),
      endDate: addDays(nextPayday.date, -1),
      sourcePaydays: currentPayday.paydays.map(p => ({
        scheduleId: p.scheduleId,
        scheduleName: p.scheduleName,
        type: p.type,
      })),
    });
  }

  // Add final band from last payday to end of range
  const lastPayday = uniquePaydays[uniquePaydays.length - 1];
  if (lastPayday.date < endDate) {
    bands.push({
      startDate: new Date(lastPayday.date),
      endDate: new Date(endDate),
      sourcePaydays: lastPayday.paydays.map(p => ({
        scheduleId: p.scheduleId,
        scheduleName: p.scheduleName,
        type: p.type,
      })),
    });
  }

  return bands;
}
