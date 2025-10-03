import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useStore } from "@/lib/store";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import type { PayPeriodBand } from "@/types";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { showUndoToast } from "@/lib/undoToast";
import { parseDateInput } from "@/lib/dateOnly";

interface BandSettingsDialogProps {
  bandId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AttributionRule = 'end-month' | 'start-month' | 'shift-plus-1';

// Helper to calculate display month from a band based on attribution rule
const calculateDisplayMonth = (band: PayPeriodBand, rule: AttributionRule = 'end-month'): string => {
  let displayDate: Date;
  
  if (rule === 'start-month') {
    displayDate = band.startDate;
  } else if (rule === 'end-month') {
    displayDate = band.endDate;
  } else { // 'shift-plus-1'
    displayDate = addDays(band.endDate, 30); // Approximate month shift
  }
  
  return format(displayDate, 'yyyy-MM');
};

export function BandSettingsDialog({ bandId, open, onOpenChange }: BandSettingsDialogProps) {
  const bands = useStore((state) => state.bands);
  const blocks = useStore((state) => state.blocks);
  const updateBand = useStore((state) => state.updateBand);
  const deleteBand = useStore((state) => state.deleteBand);
  const deleteBlock = useStore((state) => state.deleteBlock);
  const moveBlockToBand = useStore((state) => state.moveBlockToBand);
  const reassignBlocksToBands = useStore((state) => state.reassignBlocksToBands);

  const currentBand = bandId ? bands.find(b => b.id === bandId) : null;

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSimpleDeleteConfirm, setShowSimpleDeleteConfirm] = useState(false);
  const [deleteAction, setDeleteAction] = useState<'move' | 'delete'>('move');
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Update local state when band or dialog opens
  useEffect(() => {
    if (open && currentBand) {
      setTitle(currentBand.title);
      setStartDate(format(currentBand.startDate, 'yyyy-MM-dd'));
      setEndDate(format(currentBand.endDate, 'yyyy-MM-dd'));
    }
  }, [open, currentBand]);

  const handleSave = () => {
    if (!bandId || !currentBand) return;

    if (!title.trim() || !startDate || !endDate) {
      toast.error("Please fill in all fields");
      return;
    }

    // Parse dates using local timezone (avoid UTC conversion)
    const [startY, startM, startD] = startDate.split('-').map(Number);
    const start = new Date(startY, startM - 1, startD); // Local midnight
    
    const [endY, endM, endD] = endDate.split('-').map(Number);
    const end = new Date(endY, endM - 1, endD); // Local midnight

    if (start >= end) {
      toast.error("End date must be after start date");
      return;
    }

    const rule = currentBand.attributionRule || 'end-month';
    
    const updatedBand: Partial<PayPeriodBand> = {
      title: title.trim(),
      startDate: start,
      endDate: end,
    };
    
    // Recalculate display month
    updatedBand.displayMonth = calculateDisplayMonth(
      { ...currentBand, ...updatedBand } as PayPeriodBand,
      rule
    );

    updateBand(bandId, updatedBand);

    onOpenChange(false);
    toast.success("Band updated");

    // Check if display month changed
    if (currentBand.displayMonth !== updatedBand.displayMonth) {
      toast.info(`Band moved to ${format(new Date(updatedBand.displayMonth + '-01'), 'MMMM yyyy')} per attribution rule`);
    }

    // Reassign blocks
    const count = reassignBlocksToBands();
    if (count > 0) {
      toast.info(`${count} block(s) reassigned to new bands`);
    }
  };

  const handleDeleteClick = () => {
    if (!bandId) return;

    const bandBlocks = blocks.filter(b => b.bandId === bandId);

    if (bandBlocks.length > 0) {
      // Show block handling dialog
      setShowDeleteDialog(true);
    } else {
      // No blocks, show simple delete confirm
      setShowSimpleDeleteConfirm(true);
    }
  };

  const handleSimpleDelete = () => {
    if (!bandId) return;
    
    const historyId = deleteBand(bandId);
    showUndoToast('band', historyId, currentBand?.title);
    onOpenChange(false);
  };

  const handleConfirmDelete = () => {
    if (!bandId) return;

    const bandBlocks = blocks.filter(b => b.bandId === bandId);
    const hasExecuted = bandBlocks.some(b => b.rows.some(r => r.executed));
    const requiresDoubleConfirm = hasExecuted && deleteAction === 'delete';
    
    if (requiresDoubleConfirm && deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    if (deleteAction === 'move') {
      // Move blocks to unassigned
      bandBlocks.forEach(block => {
        moveBlockToBand(block.id, undefined as any);
      });
      toast.success(`${bandBlocks.length} block(s) moved to Unassigned.`);
    } else {
      // Delete blocks
      bandBlocks.forEach(block => {
        deleteBlock(block.id);
      });
      toast.success(`${bandBlocks.length} block(s) deleted.`);
    }
    
    // Delete band
    const historyId = deleteBand(bandId);
    showUndoToast('band', historyId, currentBand?.title);

    // Reset state
    setShowDeleteDialog(false);
    setDeleteAction('move');
    setDeleteConfirmText("");
    onOpenChange(false);

    // Recompute
    const count = reassignBlocksToBands();
    if (count > 0) {
      toast.info(`${count} block(s) reassigned to bands`);
    }
  };

  return (
    <>
      <Dialog open={open && !showDeleteDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Band Settings</DialogTitle>
            <DialogDescription>
              Edit band details or delete the band
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="band-title">Title *</Label>
              <Input
                id="band-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="band-start">Start Date *</Label>
              <Input
                id="band-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="band-end">End Date *</Label>
              <Input
                id="band-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Danger Zone</p>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Band
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simple Delete Confirmation */}
      <DeleteConfirmDialog
        open={showSimpleDeleteConfirm}
        onOpenChange={setShowSimpleDeleteConfirm}
        onConfirm={handleSimpleDelete}
        type="band"
      />

      {/* Delete Confirmation Dialog for bands with blocks */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Band with Blocks</AlertDialogTitle>
            <AlertDialogDescription>
              This band contains {blocks.filter(b => b.bandId === bandId).length} block(s).
              Choose an action:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <RadioGroup value={deleteAction} onValueChange={(v) => setDeleteAction(v as 'move' | 'delete')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="move" id="move-blocks" />
                <Label htmlFor="move-blocks" className="font-normal cursor-pointer">
                  Move blocks to "Unassigned" (recommended)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delete" id="delete-blocks" />
                <Label htmlFor="delete-blocks" className="font-normal cursor-pointer text-destructive">
                  Delete blocks too (danger)
                </Label>
              </div>
            </RadioGroup>

            {deleteAction === 'delete' && blocks.filter(b => b.bandId === bandId).some(b => b.rows.some(r => r.executed)) && (
              <div className="space-y-2 p-3 bg-destructive/10 border border-destructive/20 rounded">
                <p className="text-sm font-medium text-destructive">
                  Warning: Some blocks have executed rows
                </p>
                <p className="text-sm text-muted-foreground">
                  Type <strong>DELETE</strong> to confirm deletion
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                />
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setDeleteAction('move');
              setDeleteConfirmText("");
            }}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
