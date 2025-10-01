import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";

interface AddIncomeBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId: string;
  bandInfo: { title: string; startDate: Date; endDate: Date };
}

export function AddIncomeBlockDialog({ open, onOpenChange, bandId, bandInfo }: AddIncomeBlockDialogProps) {
  const owners = useStore((state) => state.owners);
  const addBlock = useStore((state) => state.addBlock);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [owner, setOwner] = useState("");

  // Initialize with band start date and first owner
  useEffect(() => {
    if (open) {
      setDate(bandInfo.startDate);
      if (owners.length > 0) {
        setOwner(owners[0]);
      }
    }
  }, [open, bandInfo, owners]);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Create empty Income block
    addBlock({
      type: 'Income',
      title: title.trim(),
      date,
      tags: [],
      rows: [], // Start empty
      bandId,
    });

    toast.success("Income block created. Use Manage to add income rows.");
    
    // Reset form
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setTitle("");
    setDate(bandInfo.startDate);
    setOwner(owners[0] || "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Income Block</DialogTitle>
          <DialogDescription>
            Create a new income block in {bandInfo.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Paycheck"
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

          {/* Owner (optional) */}
          <div className="space-y-2">
            <Label>Owner (Optional)</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {owners.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
