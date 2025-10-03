import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2, FileText } from "lucide-react";
import { DuplicateBlockDialog } from "@/components/DuplicateBlockDialog";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import type { Block } from "@/types";

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
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lastCreatedBlock, setLastCreatedBlock] = useState<Block | null>(null);

  // Initialize with band start date and first owner
  useEffect(() => {
    if (open) {
      setDate(bandInfo.startDate);
      if (owners.length > 0) {
        setOwner(owners[0]);
      }
    }
  }, [open, bandInfo, owners]);

  const handleSaveChanges = () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Create empty Income block
    const newBlock = addBlock({
      type: 'Income',
      title: title.trim(),
      date,
      tags: [],
      rows: [],
      bandId,
    });

    const block: Block = {
      id: '',
      type: 'Income',
      title: title.trim(),
      date,
      tags: [],
      rows: [],
      bandId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setLastCreatedBlock(block);
    toast.success("Income block created. Use Manage to add income rows.");
    
    // Reset form
    resetForm();
    onOpenChange(false);
  };

  const handleSaveToLibrary = () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    addBlock({
      type: 'Income',
      title: title.trim(),
      date: new Date(),
      tags: [],
      rows: [],
      bandId: '',
      isTemplate: true,
    });

    toast.success("Saved as template");
  };

  const resetForm = () => {
    setTitle("");
    setDate(bandInfo.startDate);
    setOwner(owners[0] || "");
  };

  return (
    <>
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
                  <SelectValue placeholder="Select owner (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="destructive" 
                      disabled
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Block
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Nothing to delete yet</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      disabled
                    >
                      Duplicate to...
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save the block first to duplicate it</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" onClick={handleSaveToLibrary}>
                <FileText className="w-4 h-4 mr-2" />
                Save as Template
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveChanges}>
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Block Dialog */}
      <DuplicateBlockDialog
        open={showDuplicate}
        onOpenChange={setShowDuplicate}
        block={lastCreatedBlock}
      />

      {/* Save as Template Dialog */}
      <SaveAsTemplateDialog
        open={showSaveAsTemplate}
        onOpenChange={setShowSaveAsTemplate}
        block={lastCreatedBlock}
      />

      {/* Delete Confirmation Dialog - disabled in create */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={() => {}}
        type="block"
        contextInfo=""
      />
    </>
  );
}
