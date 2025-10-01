import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Calendar, RefreshCw, Edit2, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, addMonths, addDays, startOfMonth, endOfMonth, lastDayOfMonth, setDate } from "date-fns";
import type { PayPeriodBand, PaySchedule } from "@/types";

interface ManagePayPeriodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FrequencyType = 'Monthly' | 'Semi-Monthly' | 'Bi-Weekly' | 'Weekly';
type AttributionRule = 'end-month' | 'start-month' | 'shift-plus-1';

interface BandOverlap {
  band1: PayPeriodBand;
  band2: PayPeriodBand;
}

// Helper to calculate display month from a band based on attribution rule
const calculateDisplayMonth = (band: PayPeriodBand, rule: AttributionRule = 'end-month'): string => {
  let displayDate: Date;
  
  if (rule === 'start-month') {
    displayDate = band.startDate;
  } else if (rule === 'end-month') {
    displayDate = band.endDate;
  } else { // 'shift-plus-1'
    displayDate = addMonths(band.endDate, 1);
  }
  
  return format(displayDate, 'yyyy-MM');
};

// Helper to get day of month accounting for "Last"
const getDayOfMonth = (year: number, month: number, day: number | 'Last'): Date => {
  if (day === 'Last') {
    return lastDayOfMonth(new Date(year, month, 1));
  }
  return setDate(new Date(year, month, 1), day);
};

export function ManagePayPeriodsDialog({ open, onOpenChange }: ManagePayPeriodsDialogProps) {
  const bands = useStore((state) => state.bands);
  const schedules = useStore((state) => state.schedules);
  const addBand = useStore((state) => state.addBand);
  const updateBand = useStore((state) => state.updateBand);
  const deleteBand = useStore((state) => state.deleteBand);
  const addSchedule = useStore((state) => state.addSchedule);
  const updateSchedule = useStore((state) => state.updateSchedule);
  const deleteSchedule = useStore((state) => state.deleteSchedule);
  const reassignBlocksToBands = useStore((state) => state.reassignBlocksToBands);

  const [editingBandId, setEditingBandId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingStartDate, setEditingStartDate] = useState("");
  const [editingEndDate, setEditingEndDate] = useState("");

  // Schedule form state
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<FrequencyType>('Monthly');
  const [scheduleAnchorDate, setScheduleAnchorDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleAnchorDay, setScheduleAnchorDay] = useState<number | 'Last'>(15);
  const [scheduleSemiDay1, setScheduleSemiDay1] = useState<number | 'Last'>(1);
  const [scheduleSemiDay2, setScheduleSemiDay2] = useState<number | 'Last'>(15);
  const [scheduleAttributionRule, setScheduleAttributionRule] = useState<AttributionRule>('end-month');
  const [scheduleSemiSecondAsNextMonth, setScheduleSemiSecondAsNextMonth] = useState(false);

  // Overlap resolution
  const [showOverlapDialog, setShowOverlapDialog] = useState(false);

  // Sorted bands
  const sortedBands = useMemo(() => {
    return [...bands].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [bands]);

  // Detect overlaps
  const overlaps = useMemo((): BandOverlap[] => {
    const detected: BandOverlap[] = [];
    for (let i = 0; i < sortedBands.length - 1; i++) {
      for (let j = i + 1; j < sortedBands.length; j++) {
        const band1 = sortedBands[i];
        const band2 = sortedBands[j];
        
        // Check if dates overlap
        if (
          (band1.startDate <= band2.endDate && band1.endDate >= band2.startDate) ||
          (band2.startDate <= band1.endDate && band2.endDate >= band1.startDate)
        ) {
          detected.push({ band1, band2 });
        }
      }
    }
    return detected;
  }, [sortedBands]);

  const handleGenerateFromSchedule = (schedule: PaySchedule, monthsCount: number = 6) => {
    const now = new Date();
    const periods: Omit<PayPeriodBand, 'id'>[] = [];
    const rule = schedule.attributionRule || 'end-month';

    if (schedule.frequency === 'Monthly') {
      const anchorDay = schedule.anchorDay || 1;
      
      for (let i = -3; i < monthsCount - 3; i++) {
        const currentMonth = addMonths(now, i);
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        
        // Band runs from anchor day to day before next anchor
        const start = getDayOfMonth(year, month, anchorDay);
        const nextMonth = addMonths(currentMonth, 1);
        const nextMonthYear = nextMonth.getFullYear();
        const nextMonthMonth = nextMonth.getMonth();
        const nextAnchor = getDayOfMonth(nextMonthYear, nextMonthMonth, anchorDay);
        const end = addDays(nextAnchor, -1);
        
        const band: Omit<PayPeriodBand, 'id'> = {
          title: `${format(currentMonth, 'MMM yyyy')}`,
          startDate: start,
          endDate: end,
          order: i + 100,
          sourceScheduleId: schedule.id,
          attributionRule: rule,
        };
        
        band.displayMonth = calculateDisplayMonth(band as PayPeriodBand, rule);
        periods.push(band);
      }
    } else if (schedule.frequency === 'Semi-Monthly') {
      const day1 = schedule.semiMonthlyDay1 || 1;
      const day2 = schedule.semiMonthlyDay2 || 15;
      const secondAsNext = schedule.semiSecondAsNextMonth || false;
      
      for (let monthOffset = -3; monthOffset < monthsCount - 3; monthOffset++) {
        const currentMonth = addMonths(now, monthOffset);
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        
        // First period: day1 to (day2 - 1)
        const firstStart = getDayOfMonth(year, month, day1);
        let firstEnd: Date;
        
        if (day2 === 'Last') {
          firstEnd = addDays(lastDayOfMonth(currentMonth), -1);
        } else {
          firstEnd = addDays(getDayOfMonth(year, month, day2), -1);
        }
        
        const band1: Omit<PayPeriodBand, 'id'> = {
          title: `${format(currentMonth, 'MMM yyyy')} (1st half)`,
          startDate: firstStart,
          endDate: firstEnd,
          order: monthOffset * 2 + 100,
          sourceScheduleId: schedule.id,
          attributionRule: rule,
        };
        band1.displayMonth = calculateDisplayMonth(band1 as PayPeriodBand, rule);
        periods.push(band1);
        
        // Second period: day2 to end of month (or to day1-1 of next month if crossing boundary)
        const secondStart = getDayOfMonth(year, month, day2);
        const nextMonth = addMonths(currentMonth, 1);
        const nextYear = nextMonth.getFullYear();
        const nextMonthNum = nextMonth.getMonth();
        const nextDay1 = getDayOfMonth(nextYear, nextMonthNum, day1);
        const secondEnd = addDays(nextDay1, -1);
        
        let effectiveRule = rule;
        // If "second as next month" is enabled, override to shift+1 or adjust
        if (secondAsNext) {
          effectiveRule = 'shift-plus-1';
        }
        
        const band2: Omit<PayPeriodBand, 'id'> = {
          title: secondAsNext 
            ? `${format(nextMonth, 'MMM yyyy')} (PP1)` 
            : `${format(currentMonth, 'MMM yyyy')} (2nd half)`,
          startDate: secondStart,
          endDate: secondEnd,
          order: monthOffset * 2 + 101,
          sourceScheduleId: schedule.id,
          attributionRule: effectiveRule,
        };
        band2.displayMonth = calculateDisplayMonth(band2 as PayPeriodBand, effectiveRule);
        periods.push(band2);
      }
    } else if (schedule.frequency === 'Bi-Weekly') {
      const anchor = schedule.anchorDate ? new Date(schedule.anchorDate) : new Date();
      for (let i = -3; i < monthsCount - 3; i++) {
        const start = addWeeks(anchor, i * 2);
        const end = addDays(addWeeks(start, 2), -1);
        
        const band: Omit<PayPeriodBand, 'id'> = {
          title: `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`,
          startDate: start,
          endDate: end,
          order: i + 100,
          sourceScheduleId: schedule.id,
          attributionRule: rule,
        };
        band.displayMonth = calculateDisplayMonth(band as PayPeriodBand, rule);
        periods.push(band);
      }
    } else if (schedule.frequency === 'Weekly') {
      const anchor = schedule.anchorDate ? new Date(schedule.anchorDate) : new Date();
      for (let i = -3; i < monthsCount; i++) {
        const start = addWeeks(anchor, i);
        const end = addDays(start, 6);
        
        const band: Omit<PayPeriodBand, 'id'> = {
          title: `Week of ${format(start, 'MMM d, yyyy')}`,
          startDate: start,
          endDate: end,
          order: i + 100,
          sourceScheduleId: schedule.id,
          attributionRule: rule,
        };
        band.displayMonth = calculateDisplayMonth(band as PayPeriodBand, rule);
        periods.push(band);
      }
    }

    // Dedupe: skip if same start & end already exists
    const existingSet = new Set(
      bands.map(b => `${b.startDate.getTime()}-${b.endDate.getTime()}`)
    );

    let addedCount = 0;
    periods.forEach((period) => {
      const key = `${period.startDate.getTime()}-${period.endDate.getTime()}`;
      if (!existingSet.has(key)) {
        addBand(period);
        addedCount++;
      }
    });

    toast.success(`Generated ${addedCount} periods from schedule "${schedule.name}"`);
  };

  const handleSaveSchedule = () => {
    if (!scheduleName.trim()) {
      toast.error("Please enter a schedule name");
      return;
    }

    const scheduleData: Omit<PaySchedule, 'id' | 'createdAt'> = {
      name: scheduleName.trim(),
      frequency: scheduleFrequency,
      anchorDate: scheduleFrequency === 'Weekly' || scheduleFrequency === 'Bi-Weekly' 
        ? new Date(scheduleAnchorDate) 
        : undefined,
      anchorDay: scheduleFrequency === 'Monthly' ? scheduleAnchorDay : undefined,
      semiMonthlyDay1: scheduleFrequency === 'Semi-Monthly' ? scheduleSemiDay1 : undefined,
      semiMonthlyDay2: scheduleFrequency === 'Semi-Monthly' ? scheduleSemiDay2 : undefined,
      attributionRule: scheduleAttributionRule,
      semiSecondAsNextMonth: scheduleFrequency === 'Semi-Monthly' ? scheduleSemiSecondAsNextMonth : undefined,
    };

    if (editingScheduleId) {
      updateSchedule(editingScheduleId, scheduleData);
      toast.success("Schedule updated");
    } else {
      addSchedule(scheduleData);
      toast.success("Schedule created");
    }

    setShowScheduleDialog(false);
    resetScheduleForm();
  };

  const resetScheduleForm = () => {
    setEditingScheduleId(null);
    setScheduleName("");
    setScheduleFrequency('Monthly');
    setScheduleAnchorDate(format(new Date(), 'yyyy-MM-dd'));
    setScheduleAnchorDay(15);
    setScheduleSemiDay1(1);
    setScheduleSemiDay2(15);
    setScheduleAttributionRule('end-month');
    setScheduleSemiSecondAsNextMonth(false);
  };

  const handleEditSchedule = (schedule: PaySchedule) => {
    setEditingScheduleId(schedule.id);
    setScheduleName(schedule.name);
    setScheduleFrequency(schedule.frequency);
    if (schedule.anchorDate) {
      setScheduleAnchorDate(format(schedule.anchorDate, 'yyyy-MM-dd'));
    }
    if (schedule.anchorDay !== undefined) {
      setScheduleAnchorDay(schedule.anchorDay);
    }
    if (schedule.semiMonthlyDay1 !== undefined) {
      setScheduleSemiDay1(schedule.semiMonthlyDay1);
    }
    if (schedule.semiMonthlyDay2 !== undefined) {
      setScheduleSemiDay2(schedule.semiMonthlyDay2);
    }
    if (schedule.attributionRule) {
      setScheduleAttributionRule(schedule.attributionRule);
    }
    if (schedule.semiSecondAsNextMonth !== undefined) {
      setScheduleSemiSecondAsNextMonth(schedule.semiSecondAsNextMonth);
    }
    setShowScheduleDialog(true);
  };

  const handleDuplicateSchedule = (schedule: PaySchedule) => {
    addSchedule({
      name: `${schedule.name} (Copy)`,
      frequency: schedule.frequency,
      anchorDate: schedule.anchorDate,
      anchorDay: schedule.anchorDay,
      semiMonthlyDay1: schedule.semiMonthlyDay1,
      semiMonthlyDay2: schedule.semiMonthlyDay2,
      attributionRule: schedule.attributionRule,
      semiSecondAsNextMonth: schedule.semiSecondAsNextMonth,
    });
    toast.success("Schedule duplicated");
  };

  const handleStartEditBand = (band: PayPeriodBand) => {
    setEditingBandId(band.id);
    setEditingTitle(band.title);
    setEditingStartDate(format(band.startDate, 'yyyy-MM-dd'));
    setEditingEndDate(format(band.endDate, 'yyyy-MM-dd'));
  };

  const handleSaveEditBand = () => {
    if (!editingBandId) return;

    if (!editingTitle.trim() || !editingStartDate || !editingEndDate) {
      toast.error("Please fill in all fields");
      return;
    }

    const start = new Date(editingStartDate);
    const end = new Date(editingEndDate);

    if (start >= end) {
      toast.error("End date must be after start date");
      return;
    }

    const currentBand = bands.find(b => b.id === editingBandId);
    const rule = currentBand?.attributionRule || 'end-month';
    
    const updatedBand: Partial<PayPeriodBand> = {
      title: editingTitle.trim(),
      startDate: start,
      endDate: end,
    };
    
    // Recalculate display month
    updatedBand.displayMonth = calculateDisplayMonth(
      { ...currentBand!, ...updatedBand } as PayPeriodBand,
      rule
    );

    updateBand(editingBandId, updatedBand);

    setEditingBandId(null);
    toast.success("Band updated");

    // Check if display month changed
    if (currentBand && currentBand.displayMonth !== updatedBand.displayMonth) {
      toast.info(`Band moved to ${format(new Date(updatedBand.displayMonth + '-01'), 'MMMM yyyy')} per attribution rule`);
    }

    // Reassign blocks
    const count = reassignBlocksToBands();
    if (count > 0) {
      toast.info(`${count} block(s) reassigned to new bands`);
    }
  };

  const handleMonthlyRenumber = () => {
    // Group by displayMonth (use displayMonth if available, otherwise calculate from endDate)
    const byMonth = new Map<string, PayPeriodBand[]>();

    sortedBands.forEach((band) => {
      const monthKey = band.displayMonth || format(band.endDate, 'yyyy-MM');
      if (!byMonth.has(monthKey)) {
        byMonth.set(monthKey, []);
      }
      byMonth.get(monthKey)!.push(band);
    });

    let updatedCount = 0;
    byMonth.forEach((bandsInMonth, monthKey) => {
      const sortedInMonth = [...bandsInMonth].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      sortedInMonth.forEach((band, index) => {
        const newTitle = `PP${index + 1}`;
        if (band.title !== newTitle) {
          updateBand(band.id, { title: newTitle });
          updatedCount++;
        }
      });
    });

    toast.success(`Renumbered ${updatedCount} band(s) per display month`);
  };

  const handleResolveOverlap = (overlap: BandOverlap, action: 'adjust-earlier' | 'adjust-later' | 'keep') => {
    const { band1, band2 } = overlap;

    if (action === 'adjust-earlier') {
      // Adjust band1 end to be day before band2 start
      const updates: Partial<PayPeriodBand> = {
        endDate: addDays(band2.startDate, -1),
      };
      // Recalculate display month
      updates.displayMonth = calculateDisplayMonth(
        { ...band1, ...updates } as PayPeriodBand,
        band1.attributionRule || 'end-month'
      );
      updateBand(band1.id, updates);
      toast.success("Earlier band adjusted");
    } else if (action === 'adjust-later') {
      // Adjust band2 start to be day after band1 end
      const updates: Partial<PayPeriodBand> = {
        startDate: addDays(band1.endDate, 1),
      };
      // Recalculate display month
      updates.displayMonth = calculateDisplayMonth(
        { ...band2, ...updates } as PayPeriodBand,
        band2.attributionRule || 'end-month'
      );
      updateBand(band2.id, updates);
      toast.success("Later band adjusted");
    }
    // 'keep' does nothing
  };

  const handleSaveAndClose = () => {
    const count = reassignBlocksToBands();
    if (count > 0) {
      toast.info(`${count} block(s) reassigned to bands`);
    }
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Pay Periods</DialogTitle>
            <DialogDescription>
              Create schedules and generate pay period bands
            </DialogDescription>
          </DialogHeader>

          {/* Top Toolbar */}
          <div className="flex items-center gap-2 border-b pb-3">
            <Button variant="outline" onClick={handleMonthlyRenumber}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Monthly Renumber
            </Button>
            {overlaps.length > 0 && (
              <Button variant="outline" onClick={() => setShowOverlapDialog(true)}>
                <AlertTriangle className="w-4 h-4 mr-2 text-yellow-600" />
                {overlaps.length} Overlap(s)
              </Button>
            )}
            <div className="flex-1" />
            <Button onClick={handleSaveAndClose}>Save & Close</Button>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden grid md:grid-cols-[300px_1fr] gap-4">
            {/* Schedules Panel */}
            <div className="border rounded-lg p-4 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Schedules</h3>
                <Button size="sm" onClick={() => {
                  resetScheduleForm();
                  setShowScheduleDialog(true);
                }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No schedules yet
                </p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="border rounded p-2 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{schedule.name}</p>
                          <p className="text-xs text-muted-foreground">{schedule.frequency}</p>
                          {schedule.attributionRule && (
                            <p className="text-xs text-muted-foreground capitalize">
                              {schedule.attributionRule.replace('-', ' ')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEditSchedule(schedule)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDuplicateSchedule(schedule)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                            if (confirm("Delete this schedule?")) {
                              deleteSchedule(schedule.id);
                              toast.success("Schedule deleted");
                            }
                          }}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        onClick={() => handleGenerateFromSchedule(schedule)}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        Generate & Append
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bands Table */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 border-b bg-muted/50">
                <h3 className="font-semibold">Pay Period Bands ({sortedBands.length})</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {sortedBands.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No bands created yet. Create a schedule and generate bands.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Display Month</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBands.map((band) => (
                        <TableRow key={band.id}>
                          <TableCell>
                            {editingBandId === band.id ? (
                              <Input
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              <span className="font-medium">{band.title}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingBandId === band.id ? (
                              <Input
                                type="date"
                                value={editingStartDate}
                                onChange={(e) => setEditingStartDate(e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              format(band.startDate, 'MMM d, yyyy')
                            )}
                          </TableCell>
                          <TableCell>
                            {editingBandId === band.id ? (
                              <Input
                                type="date"
                                value={editingEndDate}
                                onChange={(e) => setEditingEndDate(e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              format(band.endDate, 'MMM d, yyyy')
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {band.displayMonth 
                              ? format(new Date(band.displayMonth + '-01'), 'MMM yyyy')
                              : format(band.endDate, 'MMM yyyy')
                            }
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {band.sourceScheduleId 
                              ? schedules.find(s => s.id === band.sourceScheduleId)?.name || 'Deleted'
                              : 'Manual'
                            }
                          </TableCell>
                          <TableCell>
                            {editingBandId === band.id ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={handleSaveEditBand}>
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingBandId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleStartEditBand(band)}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => {
                                  if (confirm("Delete this band? Blocks will be unassigned.")) {
                                    deleteBand(band.id);
                                    toast.success("Band deleted");
                                  }
                                }}>
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingScheduleId ? 'Edit Schedule' : 'New Schedule'}</DialogTitle>
            <DialogDescription>
              Define a recurring pay period schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scheduleName">Schedule Name *</Label>
              <Input
                id="scheduleName"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="e.g., My Bi-Weekly Pay"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduleFrequency">Frequency *</Label>
              <Select value={scheduleFrequency} onValueChange={(v) => setScheduleFrequency(v as FrequencyType)}>
                <SelectTrigger id="scheduleFrequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Semi-Monthly">Semi-Monthly</SelectItem>
                  <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleFrequency === 'Monthly' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="anchorDay">Anchor Day *</Label>
                  <p className="text-xs text-muted-foreground">Band runs from anchor day to day before next anchor</p>
                  <Select 
                    value={scheduleAnchorDay === 'Last' ? 'Last' : scheduleAnchorDay.toString()} 
                    onValueChange={(v) => setScheduleAnchorDay(v === 'Last' ? 'Last' : parseInt(v))}
                  >
                    <SelectTrigger id="anchorDay">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : day === 21 ? '21st' : day === 22 ? '22nd' : day === 23 ? '23rd' : day === 31 ? '31st' : `${day}th`}
                        </SelectItem>
                      ))}
                      <SelectItem value="Last">Last Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {scheduleFrequency === 'Semi-Monthly' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="semiDay1">First Anchor Day *</Label>
                  <Select 
                    value={scheduleSemiDay1 === 'Last' ? 'Last' : scheduleSemiDay1.toString()} 
                    onValueChange={(v) => setScheduleSemiDay1(v === 'Last' ? 'Last' : parseInt(v))}
                  >
                    <SelectTrigger id="semiDay1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : day === 21 ? '21st' : day === 22 ? '22nd' : day === 23 ? '23rd' : day === 31 ? '31st' : `${day}th`}
                        </SelectItem>
                      ))}
                      <SelectItem value="Last">Last Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="semiDay2">Second Anchor Day *</Label>
                  <Select 
                    value={scheduleSemiDay2 === 'Last' ? 'Last' : scheduleSemiDay2.toString()} 
                    onValueChange={(v) => setScheduleSemiDay2(v === 'Last' ? 'Last' : parseInt(v))}
                  >
                    <SelectTrigger id="semiDay2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : day === 21 ? '21st' : day === 22 ? '22nd' : day === 23 ? '23rd' : day === 31 ? '31st' : `${day}th`}
                        </SelectItem>
                      ))}
                      <SelectItem value="Last">Last Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch 
                    id="semiSecondAsNext"
                    checked={scheduleSemiSecondAsNextMonth}
                    onCheckedChange={setScheduleSemiSecondAsNextMonth}
                  />
                  <Label htmlFor="semiSecondAsNext" className="text-sm cursor-pointer">
                    Treat second anchor as next month's PP1
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  When enabled, the second period (e.g., last day → 14th) will appear under the following month
                </p>
              </>
            )}

            {(scheduleFrequency === 'Weekly' || scheduleFrequency === 'Bi-Weekly') && (
              <div className="space-y-2">
                <Label htmlFor="scheduleAnchor">Anchor Date (First Payday) *</Label>
                <Input
                  id="scheduleAnchor"
                  type="date"
                  value={scheduleAnchorDate}
                  onChange={(e) => setScheduleAnchorDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2 pt-2 border-t">
              <Label>Attribution Rule</Label>
              <p className="text-xs text-muted-foreground">
                Determines which month the band appears under in the Ledger
              </p>
              <RadioGroup value={scheduleAttributionRule} onValueChange={(v) => setScheduleAttributionRule(v as AttributionRule)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="end-month" id="attr-end" />
                  <Label htmlFor="attr-end" className="font-normal cursor-pointer">
                    End-month (band shows under month containing end date)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="start-month" id="attr-start" />
                  <Label htmlFor="attr-start" className="font-normal cursor-pointer">
                    Start-month (band shows under month containing start date)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="shift-plus-1" id="attr-shift" />
                  <Label htmlFor="attr-shift" className="font-normal cursor-pointer">
                    Shift +1 month (band shows under month after end date)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchedule}>
              {editingScheduleId ? 'Update' : 'Create'} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overlap Resolution Dialog */}
      <Dialog open={showOverlapDialog} onOpenChange={setShowOverlapDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolve Overlapping Bands</DialogTitle>
            <DialogDescription>
              {overlaps.length} overlapping band pair(s) detected
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {overlaps.map((overlap, index) => (
              <Alert key={index}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Overlap {index + 1}</p>
                    <div className="text-sm space-y-1">
                      <p>
                        <strong>{overlap.band1.title}:</strong> {format(overlap.band1.startDate, 'MMM d')} - {format(overlap.band1.endDate, 'MMM d, yyyy')}
                      </p>
                      <p>
                        <strong>{overlap.band2.title}:</strong> {format(overlap.band2.startDate, 'MMM d')} - {format(overlap.band2.endDate, 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleResolveOverlap(overlap, 'adjust-earlier')}
                      >
                        Adjust Earlier Band
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleResolveOverlap(overlap, 'adjust-later')}
                      >
                        Adjust Later Band
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleResolveOverlap(overlap, 'keep')}
                      >
                        Keep Both
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowOverlapDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
