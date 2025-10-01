import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Calendar, RefreshCw, Edit2, Copy, AlertTriangle, Settings, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, addMonths, addDays, startOfMonth, endOfMonth, lastDayOfMonth, setDate, subMonths } from "date-fns";
import { generateCompositeBands } from "@/lib/compositePaydays";
import { BandSettingsDialog } from "@/components/BandSettingsDialog";
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
  const blocks = useStore((state) => state.blocks);
  const schedules = useStore((state) => state.schedules);
  const addBand = useStore((state) => state.addBand);
  const updateBand = useStore((state) => state.updateBand);
  const deleteBand = useStore((state) => state.deleteBand);
  const deleteBlock = useStore((state) => state.deleteBlock);
  const moveBlockToBand = useStore((state) => state.moveBlockToBand);
  const addSchedule = useStore((state) => state.addSchedule);
  const updateSchedule = useStore((state) => state.updateSchedule);
  const deleteSchedule = useStore((state) => state.deleteSchedule);
  const reassignBlocksToBands = useStore((state) => state.reassignBlocksToBands);

  const [editingBandId, setEditingBandId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingStartDate, setEditingStartDate] = useState("");
  const [editingEndDate, setEditingEndDate] = useState("");

  // Band Settings modal
  const [bandSettingsId, setBandSettingsId] = useState<string | null>(null);
  const [selectedBands, setSelectedBands] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleteAction, setBulkDeleteAction] = useState<'move' | 'delete'>('move');
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState("");
  const [bandsWithBlocks, setBandsWithBlocks] = useState<Array<{ bandId: string; blockCount: number; hasExecuted: boolean }>>([]);

  // Composite mode
  const [compositeMode, setCompositeMode] = useState(false);
  const [compositePreviews, setCompositePreviews] = useState<Array<{
    startDate: Date;
    endDate: Date;
    sourcePaydays: Array<{ scheduleId: string; scheduleName: string; type: string }>;
    tempTitle: string;
  }>>([]);
  const [excludedPaydays, setExcludedPaydays] = useState<Set<string>>(new Set());
  const [includeLeadIn, setIncludeLeadIn] = useState(true);

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

  const handleToggleBandSelect = (bandId: string) => {
    setSelectedBands(prev => {
      const next = new Set(prev);
      if (next.has(bandId)) {
        next.delete(bandId);
      } else {
        next.add(bandId);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    // Check which selected bands have blocks
    const bandsInfo = Array.from(selectedBands).map(bandId => {
      const bandBlocks = blocks.filter(b => b.bandId === bandId);
      const hasExecuted = bandBlocks.some(b => b.rows.some(r => r.executed));
      return {
        bandId,
        blockCount: bandBlocks.length,
        hasExecuted,
      };
    });

    const bandsWithBlocksData = bandsInfo.filter(b => b.blockCount > 0);
    setBandsWithBlocks(bandsWithBlocksData);
    
    if (bandsWithBlocksData.length > 0) {
      setShowBulkDeleteDialog(true);
    } else {
      // No blocks, just delete
      handleConfirmBulkDelete('move');
    }
  };

  const handleConfirmBulkDelete = (action: 'move' | 'delete') => {
    const requiresDoubleConfirm = bandsWithBlocks.some(b => b.hasExecuted) && action === 'delete';
    
    if (requiresDoubleConfirm && bulkDeleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    // Process deletion
    Array.from(selectedBands).forEach(bandId => {
      const bandBlocks = blocks.filter(b => b.bandId === bandId);
      
      if (action === 'move') {
        // Move blocks to unassigned
        bandBlocks.forEach(block => {
          moveBlockToBand(block.id, undefined as any);
        });
      } else {
        // Delete blocks
        bandBlocks.forEach(block => {
          deleteBlock(block.id);
        });
      }
      
      // Delete band
      deleteBand(bandId);
    });

    const deletedCount = selectedBands.size;
    const movedCount = action === 'move' ? bandsWithBlocks.reduce((sum, b) => sum + b.blockCount, 0) : 0;
    const deletedBlockCount = action === 'delete' ? bandsWithBlocks.reduce((sum, b) => sum + b.blockCount, 0) : 0;

    if (action === 'move' && movedCount > 0) {
      toast.success(`Deleted ${deletedCount} band(s). ${movedCount} block(s) moved to Unassigned.`);
    } else if (action === 'delete' && deletedBlockCount > 0) {
      toast.success(`Deleted ${deletedCount} band(s) and ${deletedBlockCount} block(s).`);
    } else {
      toast.success(`Deleted ${deletedCount} band(s).`);
    }

    // Reset state
    setSelectedBands(new Set());
    setShowBulkDeleteDialog(false);
    setBulkDeleteAction('move');
    setBulkDeleteConfirmText("");
    setBandsWithBlocks([]);

    // Recompute
    const count = reassignBlocksToBands();
    if (count > 0) {
      toast.info(`${count} block(s) reassigned to bands`);
    }
  };

  const handleOpenBandSettings = (band: PayPeriodBand) => {
    setBandSettingsId(band.id);
  };

  const handleToggleLock = (bandId: string) => {
    const band = bands.find(b => b.id === bandId);
    if (!band) return;
    
    updateBand(bandId, { locked: !band.locked });
    toast.success(band.locked ? "Band unlocked" : "Band locked");
  };

  const handleGenerateComposite = () => {
    if (schedules.length === 0) {
      toast.error("Please create at least one schedule first");
      return;
    }

    const now = new Date();
    const startRange = subMonths(now, 3);
    const endRange = addMonths(now, 9);

    const compositeBands = generateCompositeBands(
      schedules,
      startRange,
      endRange,
      excludedPaydays,
      includeLeadIn
    );

    const previews = compositeBands.map((band, index) => {
      const sourceNames = band.sourcePaydays.map(p => `${p.scheduleName} (${p.type})`).join(', ');
      return {
        ...band,
        tempTitle: `Period ${index + 1}`,
      };
    });

    setCompositePreviews(previews);
    toast.success(`Generated ${previews.length} composite bands`);
  };

  const handleApplyComposite = () => {
    if (compositePreviews.length === 0) {
      toast.error("Please generate composite bands first");
      return;
    }

    // Get locked bands
    const lockedBands = bands.filter(b => b.locked);

    // Delete unlocked bands
    bands.filter(b => !b.locked).forEach(b => deleteBand(b.id));

    // Add new composite bands
    let addedCount = 0;
    compositePreviews.forEach((preview, index) => {
      const rule = schedules[0]?.attributionRule || 'end-month';
      
      const band: Omit<PayPeriodBand, 'id'> = {
        title: preview.tempTitle,
        startDate: preview.startDate,
        endDate: preview.endDate,
        order: index,
        attributionRule: rule,
        displayMonth: calculateDisplayMonth({
          startDate: preview.startDate,
          endDate: preview.endDate,
        } as PayPeriodBand, rule),
        compositePaydays: preview.sourcePaydays.map(p => p.scheduleId),
      };
      
      addBand(band);
      addedCount++;
    });

    toast.success(`Applied ${addedCount} composite bands. ${lockedBands.length} bands kept locked.`);
    
    // Reassign blocks
    const count = reassignBlocksToBands();
    if (count > 0) {
      toast.info(`${count} block(s) reassigned to bands`);
    }

    setCompositePreviews([]);
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

          {/* Composite Mode Toggle */}
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
            <Switch
              id="composite-mode"
              checked={compositeMode}
              onCheckedChange={setCompositeMode}
            />
            <Label htmlFor="composite-mode" className="cursor-pointer flex-1">
              Compose bands from combined paydays (gap-based)
            </Label>
            {compositeMode && (
              <Badge variant="secondary">Composite Mode</Badge>
            )}
          </div>

          {/* Top Toolbar */}
          <div className="flex items-center gap-2 border-b pb-3">
            {selectedBands.size > 0 ? (
              <>
                <span className="text-sm font-medium">{selectedBands.size} selected</span>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setSelectedBands(new Set())}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </>
            ) : compositeMode ? (
              <>
                <Button variant="outline" onClick={handleGenerateComposite}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate Composite
                </Button>
                {compositePreviews.length > 0 && (
                  <Button onClick={handleApplyComposite}>
                    <Plus className="w-4 h-4 mr-2" />
                    Apply Composite Bands
                  </Button>
                )}
                <div className="flex-1" />
                <Button onClick={handleSaveAndClose}>Save & Close</Button>
              </>
            ) : (
              <>
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
              </>
            )}
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
                      {!compositeMode && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full"
                          onClick={() => handleGenerateFromSchedule(schedule)}
                        >
                          <Calendar className="w-3 h-3 mr-1" />
                          Generate & Append
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bands Table or Composite Preview */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              {compositeMode && compositePreviews.length > 0 ? (
                <>
                  <div className="p-3 border-b bg-muted/50">
                    <h3 className="font-semibold">Composite Preview ({compositePreviews.length})</h3>
                    <p className="text-xs text-muted-foreground">
                      Bands generated from combined paydays • Non-overlapping
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Source Paydays</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compositePreviews.map((preview, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <span className="font-medium">{preview.tempTitle}</span>
                            </TableCell>
                            <TableCell>
                              {format(preview.startDate, 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              {format(preview.endDate, 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-wrap gap-1">
                                {preview.sourcePaydays.map((payday, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {payday.scheduleName}: {payday.type}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <>
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
                            <TableHead className="w-[40px]"></TableHead>
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
                                <Checkbox
                                  checked={selectedBands.has(band.id)}
                                  onCheckedChange={() => handleToggleBandSelect(band.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{band.title}</span>
                                  {band.locked && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Lock className="w-3 h-3" />
                                    </Badge>
                                  )}
                                  {band.compositePaydays && band.compositePaydays.length > 1 && (
                                    <Badge variant="outline" className="text-xs">
                                      Composite
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {format(band.startDate, 'MMM d, yyyy')}
                              </TableCell>
                              <TableCell>
                                {format(band.endDate, 'MMM d, yyyy')}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {band.displayMonth 
                                  ? format(new Date(band.displayMonth + '-01'), 'MMM yyyy')
                                  : format(band.endDate, 'MMM yyyy')
                                }
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {band.compositePaydays ? (
                                  <span className="text-xs">Multiple</span>
                                ) : band.sourceScheduleId ? (
                                  schedules.find(s => s.id === band.sourceScheduleId)?.name || 'Deleted'
                                ) : (
                                  'Manual'
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => handleToggleLock(band.id)}
                                    title={band.locked ? "Unlock band" : "Lock band"}
                                  >
                                    {band.locked ? (
                                      <Lock className="w-4 h-4" />
                                    ) : (
                                      <Unlock className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => handleOpenBandSettings(band)}
                                    title="Band Settings"
                                  >
                                    <Settings className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Band Settings Dialog */}
      <BandSettingsDialog
        bandId={bandSettingsId}
        open={bandSettingsId !== null}
        onOpenChange={(open) => !open && setBandSettingsId(null)}
      />

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bands with Blocks</AlertDialogTitle>
            <AlertDialogDescription>
              {bandsWithBlocks.length > 0 && (
                <>
                  {selectedBands.size === 1 ? 'This band contains' : 'These bands contain'}{' '}
                  {bandsWithBlocks.reduce((sum, b) => sum + b.blockCount, 0)} block(s).
                  Choose an action:
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <RadioGroup value={bulkDeleteAction} onValueChange={(v) => setBulkDeleteAction(v as 'move' | 'delete')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="move" id="move" />
                <Label htmlFor="move" className="font-normal cursor-pointer">
                  Move blocks to "Unassigned" (recommended)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delete" id="delete" />
                <Label htmlFor="delete" className="font-normal cursor-pointer text-destructive">
                  Delete blocks too (danger)
                </Label>
              </div>
            </RadioGroup>

            {bulkDeleteAction === 'delete' && bandsWithBlocks.some(b => b.hasExecuted) && (
              <div className="space-y-2 p-3 bg-destructive/10 border border-destructive/20 rounded">
                <p className="text-sm font-medium text-destructive">
                  Warning: Some blocks have executed rows
                </p>
                <p className="text-sm text-muted-foreground">
                  Type <strong>DELETE</strong> to confirm deletion
                </p>
                <Input
                  value={bulkDeleteConfirmText}
                  onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                />
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowBulkDeleteDialog(false);
              setBulkDeleteAction('move');
              setBulkDeleteConfirmText("");
              setSelectedBands(new Set());
            }}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => handleConfirmBulkDelete(bulkDeleteAction)}
            >
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
