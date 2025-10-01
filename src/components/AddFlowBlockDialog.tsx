import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { format } from "date-fns";

interface AddFlowBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId: string;
  bandInfo: { title: string; startDate: Date; endDate: Date };
}

export function AddFlowBlockDialog({ open, onOpenChange, bandId, bandInfo }: AddFlowBlockDialogProps) {
  const addBlock = useStore((state) => state.addBlock);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());

  // Initialize with band start date
  useEffect(() => {
    if (open) {
      setDate(bandInfo.startDate);
      setTitle(`Allocations - ${bandInfo.title}`);
    }
  }, [open, bandInfo]);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Create empty Flow block
    addBlock({
      type: 'Flow',
      title: title.trim(),
      date,
      tags: [],
      rows: [], // Start empty
      bandId,
    });

    toast.success("Flow block created. Use Manage to add allocations.");
    
    // Reset form
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setTitle(`Allocations - ${bandInfo.title}`);
    setDate(bandInfo.startDate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Flow Block</DialogTitle>
          <DialogDescription>
            Create a new flow/allocation block in {bandInfo.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Allocations - March 2025"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={format(date, 'yyyy-MM-dd')}
              onChange={(e) => setDate(new Date(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Create Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
