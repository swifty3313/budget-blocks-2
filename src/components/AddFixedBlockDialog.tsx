import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2, FileText } from "lucide-react";
import { DuplicateBlockDialog } from "@/components/DuplicateBlockDialog";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import type { Block } from "@/types";

interface AddFixedBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId: string;
  bandInfo: { title: string; startDate: Date; endDate: Date };
}

export function AddFixedBlockDialog({ open, onOpenChange, bandId, bandInfo }: AddFixedBlockDialogProps) {
  const addBlock = useStore((state) => state.addBlock);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lastCreatedBlock, setLastCreatedBlock] = useState<Block | null>(null);

  // Initialize with band start date
  useEffect(() => {
    if (open) {
      setDate(bandInfo.startDate);
      setTitle(`Bills - ${bandInfo.title}`);
    }
  }, [open, bandInfo]);

  const handleSaveChanges = () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Create empty Fixed Bill block
    addBlock({
      type: 'Fixed Bill',
      title: title.trim(),
      date,
      tags: [],
      rows: [],
      bandId,
    });

    const block: Block = {
      id: '',
      type: 'Fixed Bill',
      title: title.trim(),
      date,
      tags: [],
      rows: [],
      bandId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setLastCreatedBlock(block);
    toast.success("Fixed Bill block created. Use Manage to add bills from library.");
    
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
      type: 'Fixed Bill',
      title: title.trim(),
      date: new Date(),
      tags: [],
      rows: [],
      bandId: '',
      isTemplate: true,
    });

    toast.success("Saved to library");
  };

  const resetForm = () => {
    setTitle(`Bills - ${bandInfo.title}`);
    setDate(bandInfo.startDate);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Fixed Bill Block</DialogTitle>
            <DialogDescription>
              Create a new fixed bill block in {bandInfo.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Bills - March 2025"
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

          <DialogFooter className="flex items-center justify-between">
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        variant="destructive" 
                        disabled
                        className="cursor-not-allowed opacity-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Block
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Nothing to delete yet</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDuplicate(true)}>
                Duplicate to...
              </Button>
              <Button variant="outline" onClick={handleSaveToLibrary}>
                <FileText className="w-4 h-4 mr-2" />
                Save to Library
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
