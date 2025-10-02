import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { format, addDays, differenceInDays, startOfDay } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Block, PayPeriodBand, Row } from "@/types";

interface DuplicateBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: Block | null;
}

export function DuplicateBlockDialog({ open, onOpenChange, block }: DuplicateBlockDialogProps) {
  const bands = useStore((state) => state.bands);
  const addBlock = useStore((state) => state.addBlock);

  const [selectedBandIds, setSelectedBandIds] = useState<Set<string>>(new Set());
  const [dateStrategy, setDateStrategy] = useState<'keep' | 'shift'>('shift');

  if (!block) return null;

  // Filter to upcoming bands (exclude current band)
  const upcomingBands = useMemo(() => {
    const today = startOfDay(new Date());
    return bands
      .filter(b => b.id !== block.bandId && b.startDate >= today)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [bands, block.bandId]);

  const handleToggleBand = (bandId: string) => {
    const newSet = new Set(selectedBandIds);
    if (newSet.has(bandId)) {
      newSet.delete(bandId);
    } else {
      newSet.add(bandId);
    }
    setSelectedBandIds(newSet);
  };

  const handleSelectAll = () => {
    setSelectedBandIds(new Set(upcomingBands.map(b => b.id)));
  };

  const handleSelectNone = () => {
    setSelectedBandIds(new Set());
  };

  const handleDuplicate = () => {
    if (selectedBandIds.size === 0) {
      toast.error("Please select at least one target band");
      return;
    }

    const sourceBand = bands.find(b => b.id === block.bandId);
    if (!sourceBand) {
      toast.error("Source band not found");
      return;
    }

    let duplicatedCount = 0;
    const bandTitles: string[] = [];

    selectedBandIds.forEach(targetBandId => {
      const targetBand = bands.find(b => b.id === targetBandId);
      if (!targetBand) return;

      // Process rows based on date strategy
      const newRows: Row[] = block.rows.map(row => {
        let newDate = row.date;

        if (dateStrategy === 'shift') {
          // Calculate offset from block date in source band
          const offsetDays = differenceInDays(row.date, block.date);
          
          // Apply offset to target band's start date
          let shiftedDate = addDays(targetBand.startDate, offsetDays);
          
          // Clamp to target band boundaries
          if (shiftedDate < targetBand.startDate) {
            shiftedDate = targetBand.startDate;
          } else if (shiftedDate > targetBand.endDate) {
            shiftedDate = targetBand.endDate;
          }
          
          newDate = shiftedDate;
        } else {
          // Keep dates as-is (might be outside target band)
          newDate = row.date;
        }

        return {
          ...row,
          id: uuidv4(),
          date: newDate,
          executed: false, // Never auto-execute duplicated rows
        };
      });

      // Create new block in target band
      addBlock({
        type: block.type,
        title: block.title,
        date: dateStrategy === 'shift' ? targetBand.startDate : block.date,
        tags: block.tags || [],
        rows: newRows,
        bandId: targetBand.id,
      });

      duplicatedCount++;
      bandTitles.push(targetBand.title);
    });

    toast.success(`Duplicated to ${duplicatedCount} band(s): ${bandTitles.join(', ')}`);
    setSelectedBandIds(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Duplicate Block to Other Bands</DialogTitle>
          <DialogDescription>
            Source: {block.type} • {block.title} • {block.rows.length} row(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Date Strategy */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="font-semibold">Date Handling</Label>
            <RadioGroup value={dateStrategy} onValueChange={(v) => setDateStrategy(v as 'keep' | 'shift')}>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="shift" id="shift" />
                <div className="space-y-1">
                  <Label htmlFor="shift" className="cursor-pointer font-medium">
                    Shift dates to target band
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Preserves relative offsets; clamps to band boundaries if needed
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="keep" id="keep" />
                <div className="space-y-1">
                  <Label htmlFor="keep" className="cursor-pointer font-medium">
                    Keep row dates (exact copy)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Dates may fall outside target band ranges
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Target Bands Selector */}
          <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Select Target Bands</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSelectNone}>
                  Select None
                </Button>
              </div>
            </div>

            {upcomingBands.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground border rounded-lg">
                No upcoming bands available for duplication
              </div>
            ) : (
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4 space-y-2">
                  {upcomingBands.map(band => (
                    <div
                      key={band.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleToggleBand(band.id)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          checked={selectedBandIds.has(band.id)}
                          onCheckedChange={() => handleToggleBand(band.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{band.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(band.startDate, 'MMM d')} – {format(band.endDate, 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {format(band.startDate, 'MMM yyyy')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="text-sm text-muted-foreground">
              {selectedBandIds.size} band(s) selected
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={selectedBandIds.size === 0}>
            Duplicate to {selectedBandIds.size} band(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
