import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStore } from "@/lib/store";
import { format } from "date-fns";
import { Trash2, FileText } from "lucide-react";
import { DuplicateBlockDialog } from "@/components/DuplicateBlockDialog";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { InsertBillsDialog } from "@/components/InsertBillsDialog";
import { showCreateToast, showErrorToast } from "@/lib/toastUtils";
import type { Block, Row } from "@/types";

interface AddFixedBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId: string;
  bandInfo: { title: string; startDate: Date; endDate: Date };
}

export function AddFixedBlockDialog({ open, onOpenChange, bandId, bandInfo }: AddFixedBlockDialogProps) {
  const addBlock = useStore((state) => state.addBlock);
  const bands = useStore((state) => state.bands);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showInsertBills, setShowInsertBills] = useState(false);
  const [lastCreatedBlock, setLastCreatedBlock] = useState<Block | null>(null);

  const currentBand = bands.find(b => b.id === bandId);

  // Initialize with band start date
  useEffect(() => {
    if (open) {
      setDate(bandInfo.startDate);
      setTitle(`Bills - ${bandInfo.title}`);
      setRows([]);
    }
  }, [open, bandInfo]);

  const handleSaveChanges = () => {
    if (!title.trim()) {
      showErrorToast('Please enter a title');
      return;
    }

    // Create Fixed Bill block with any inserted rows
    addBlock({
      type: 'Fixed Bill',
      title: title.trim(),
      date,
      tags: [],
      rows,
      bandId,
    });

    const block: Block = {
      id: '',
      type: 'Fixed Bill',
      title: title.trim(),
      date,
      tags: [],
      rows,
      bandId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setLastCreatedBlock(block);
    showCreateToast('Fixed block');
    
    // Reset form
    resetForm();
    onOpenChange(false);
  };

  const handleInsertBills = (newRows: Row[]) => {
    setRows([...rows, ...newRows]);
    setShowInsertBills(false);
  };

  const handleSaveToLibrary = () => {
    if (!title.trim()) {
      showErrorToast('Please enter a title');
      return;
    }

    addBlock({
      type: 'Fixed Bill',
      title: title.trim(),
      date: new Date(),
      tags: [],
      rows,
      bandId: '',
      isTemplate: true,
    });

    showCreateToast('Template');
  };

  const resetForm = () => {
    setTitle(`Bills - ${bandInfo.title}`);
    setDate(bandInfo.startDate);
    setRows([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Create Fixed Block</DialogTitle>
                <DialogDescription>
                  Create a new fixed block in {bandInfo.title}
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowInsertBills(true)}
              >
                <FileText className="w-4 h-4 mr-2" />
                Insert Bills
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Bills - March 2025"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={format(date, 'yyyy-MM-dd')}
                  onChange={(e) => setDate(new Date(e.target.value))}
                />
              </div>
            </div>

            {/* Bills Preview */}
            {rows.length > 0 && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Bills to Insert ({rows.length})</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRows([])}
                  >
                    Clear All
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {rows.slice(0, 3).map((row, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{row.source}</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.amount)}
                      </span>
                    </div>
                  ))}
                  {rows.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      ...and {rows.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}
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

      {/* Insert Bills Dialog */}
      {currentBand && (
        <InsertBillsDialog
          open={showInsertBills}
          onOpenChange={setShowInsertBills}
          band={currentBand}
          onInsert={handleInsertBills}
        />
      )}
    </>
  );
}
