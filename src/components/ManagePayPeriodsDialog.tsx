import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Calendar, RefreshCw, Edit2, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, addMonths, addDays, startOfMonth, endOfMonth, lastDayOfMonth, differenceInDays } from "date-fns";
import type { PayPeriodBand, PaySchedule } from "@/types";

interface ManagePayPeriodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FrequencyType = 'Monthly' | 'Semi-Monthly' | 'Bi-Weekly' | 'Weekly';

interface BandOverlap {
  band1: PayPeriodBand;
  band2: PayPeriodBand;
}

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
  const [scheduleSemiDay1, setScheduleSemiDay1] = useState(1);
  const [scheduleSemiDay2, setScheduleSemiDay2] = useState(15);

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

    if (schedule.frequency === 'Monthly') {
      for (let i = -3; i < monthsCount - 3; i++) {
        const date = addMonths(now, i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        
        periods.push({
          title: format(date, 'MMMM yyyy'),
          startDate: start,
          endDate: end,
          order: i + 100,
          sourceScheduleId: schedule.id,
        });
      }
    } else if (schedule.frequency === 'Semi-Monthly') {
      const day1 = schedule.semiMonthlyDay1 ?? 1;
      const day2 = schedule.semiMonthlyDay2 ?? 15;
      
      for (let monthOffset = -3; monthOffset < monthsCount - 3; monthOffset++) {
        const currentMonth = addMonths(now, monthOffset);
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        
        // First period
        let firstStart = new Date(year, month, day1);
        let firstEnd: Date;
        
        if (day2 === 0) {
          const lastDay = lastDayOfMonth(currentMonth);
          firstEnd = addDays(lastDay, -1);
        } else {
          firstEnd = new Date(year, month, day2 - 1);
        }
        
        periods.push({
          title: `${format(currentMonth, 'MMM yyyy')} (1st half)`,
          startDate: firstStart,
          endDate: firstEnd,
          order: monthOffset * 2 + 100,
          sourceScheduleId: schedule.id,
        });
        
        // Second period
        let secondStart: Date;
        if (day2 === 0) {
          secondStart = lastDayOfMonth(currentMonth);
        } else {
          secondStart = new Date(year, month, day2);
        }
        const secondEnd = lastDayOfMonth(currentMonth);
        
        periods.push({
          title: `${format(currentMonth, 'MMM yyyy')} (2nd half)`,
          startDate: secondStart,
          endDate: secondEnd,
          order: monthOffset * 2 + 101,
          sourceScheduleId: schedule.id,
        });
      }
    } else if (schedule.frequency === 'Bi-Weekly') {
      const anchor = schedule.anchorDate ? new Date(schedule.anchorDate) : new Date();
      for (let i = -3; i < monthsCount - 3; i++) {
        const start = addWeeks(anchor, i * 2);
        const end = addDays(addWeeks(start, 2), -1);
        
        periods.push({
          title: `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`,
          startDate: start,
          endDate: end,
          order: i + 100,
          sourceScheduleId: schedule.id,
        });
      }
    } else if (schedule.frequency === 'Weekly') {
      const anchor = schedule.anchorDate ? new Date(schedule.anchorDate) : new Date();
      for (let i = -3; i < monthsCount; i++) {
        const start = addWeeks(anchor, i);
        const end = addDays(start, 6);
        
        periods.push({
          title: `Week of ${format(start, 'MMM d, yyyy')}`,
          startDate: start,
          endDate: end,
          order: i + 100,
          sourceScheduleId: schedule.id,
        });
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
      semiMonthlyDay1: scheduleFrequency === 'Semi-Monthly' ? scheduleSemiDay1 : undefined,
      semiMonthlyDay2: scheduleFrequency === 'Semi-Monthly' ? scheduleSemiDay2 : undefined,
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
    setScheduleSemiDay1(1);
    setScheduleSemiDay2(15);
  };

  const handleEditSchedule = (schedule: PaySchedule) => {
    setEditingScheduleId(schedule.id);
    setScheduleName(schedule.name);
    setScheduleFrequency(schedule.frequency);
    if (schedule.anchorDate) {
      setScheduleAnchorDate(format(schedule.anchorDate, 'yyyy-MM-dd'));
    }
    if (schedule.semiMonthlyDay1 !== undefined) {
      setScheduleSemiDay1(schedule.semiMonthlyDay1);
    }
    if (schedule.semiMonthlyDay2 !== undefined) {
      setScheduleSemiDay2(schedule.semiMonthlyDay2);
    }
    setShowScheduleDialog(true);
  };

  const handleDuplicateSchedule = (schedule: PaySchedule) => {
    addSchedule({
      name: `${schedule.name} (Copy)`,
      frequency: schedule.frequency,
      anchorDate: schedule.anchorDate,
      semiMonthlyDay1: schedule.semiMonthlyDay1,
      semiMonthlyDay2: schedule.semiMonthlyDay2,
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

    updateBand(editingBandId, {
      title: editingTitle.trim(),
      startDate: start,
      endDate: end,
    });

    setEditingBandId(null);
    toast.success("Band updated");

    // Reassign blocks
    const count = reassignBlocksToBands();
    if (count > 0) {
      toast.info(`${count} block(s) reassigned to new bands`);
    }
  };

  const handleMonthlyRenumber = () => {
    const byMonth = new Map<string, PayPeriodBand[]>();

    sortedBands.forEach((band) => {
      const monthKey = format(band.startDate, 'yyyy-MM');
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

    toast.success(`Renumbered ${updatedCount} band(s)`);
  };

  const handleResolveOverlap = (overlap: BandOverlap, action: 'adjust-earlier' | 'adjust-later' | 'keep') => {
    const { band1, band2 } = overlap;

    if (action === 'adjust-earlier') {
      // Adjust band1 end to be day before band2 start
      updateBand(band1.id, {
        endDate: addDays(band2.startDate, -1),
      });
      toast.success("Earlier band adjusted");
    } else if (action === 'adjust-later') {
      // Adjust band2 start to be day after band1 end
      updateBand(band2.id, {
        startDate: addDays(band1.endDate, 1),
      });
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
        <DialogContent className="max-w-md">
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

            {scheduleFrequency === 'Semi-Monthly' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="semiDay1">First Payment Day</Label>
                  <Select value={scheduleSemiDay1.toString()} onValueChange={(v) => setScheduleSemiDay1(parseInt(v))}>
                    <SelectTrigger id="semiDay1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="semiDay2">Second Payment Day</Label>
                  <Select value={scheduleSemiDay2.toString()} onValueChange={(v) => setScheduleSemiDay2(parseInt(v))}>
                    <SelectTrigger id="semiDay2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                        </SelectItem>
                      ))}
                      <SelectItem value="0">Last day of month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {(scheduleFrequency === 'Weekly' || scheduleFrequency === 'Bi-Weekly') && (
              <div className="space-y-2">
                <Label htmlFor="scheduleAnchor">Anchor Date (First Payday)</Label>
                <Input
                  id="scheduleAnchor"
                  type="date"
                  value={scheduleAnchorDate}
                  onChange={(e) => setScheduleAnchorDate(e.target.value)}
                />
              </div>
            )}
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
