import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { isWithinInterval, startOfDay } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Row, Block } from "@/types";
import { DatePickerField } from "@/components/shared/DatePickerField";
import { OwnerSelect } from "@/components/shared/OwnerSelect";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import { showPostInsertToast } from "@/lib/postInsertToast";

interface QuickExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId: string;
  bandInfo: { title: string; startDate: Date; endDate: Date };
}

export function QuickExpenseDialog({ open, onOpenChange, bandId, bandInfo }: QuickExpenseDialogProps) {
  const bases = useStore((state) => state.bases);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);
  const addBlock = useStore((state) => state.addBlock);
  const addToMasterList = useStore((state) => state.addToMasterList);
  const templatePreferences = useStore((state) => state.templatePreferences);
  const updateTemplatePreference = useStore((state) => state.updateTemplatePreference);

  const [owner, setOwner] = useState("");
  const [source, setSource] = useState("");
  const [fromBaseId, setFromBaseId] = useState("");
  const [toBaseId, setToBaseId] = useState("");
  const [mode, setMode] = useState<'Fixed' | '%'>('Fixed');
  const [value, setValue] = useState<number>(0);
  const [category, setCategory] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [execute, setExecute] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [lastInsertedBlock, setLastInsertedBlock] = useState<Block | null>(null);

  // Initialize with band start date and first owner
  useEffect(() => {
    if (open) {
      setDate(startOfDay(bandInfo.startDate));
      if (owners.length > 0) {
        setOwner(owners[0]);
      }
    }
  }, [open, bandInfo, owners]);

  const isDateOutsideBand = !isWithinInterval(date, { start: bandInfo.startDate, end: bandInfo.endDate });

  const handleSave = async (executeImmediately: boolean = false) => {
    if (isSaving) return;
    // Validation
    if (!owner.trim()) {
      toast.error("Please select an owner");
      return;
    }
    if (!source.trim()) {
      toast.error("Please enter a source/description");
      return;
    }
    if (!fromBaseId) {
      toast.error("Please select a From Base");
      return;
    }
    if (!category.trim()) {
      toast.error("Please select a category");
      return;
    }
    if (value <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Add to master lists if new
    if (!categories.includes(category)) {
      addToMasterList('categories', category);
    }

    setIsSaving(true);

    try {
      // Create the row
      const amount = mode === 'Fixed' ? value : 0; // % mode not typical for quick expense
      const row: Row = {
        id: uuidv4(),
        date,
        owner,
        source,
        fromBaseId,
        toBaseId: toBaseId || undefined,
        amount,
        flowMode: mode,
        flowValue: value,
        type: 'Expense', // Fixed typing for quick expense
        category,
        notes,
        executed: executeImmediately,
      };

      if (!bandId) {
        toast.error("No band selected - cannot create expense");
        return;
      }

      console.debug('createBlockAndInsert payload (Quick Expense)', {
        bandId,
        type: 'Flow',
        title: source,
        date,
        rowCount: 1,
      });

      // Create Flow block
      addBlock({
        type: 'Flow',
        title: source,
        date,
        tags: [],
        rows: [row],
        bandId,
      });

      // Create the block object for the toast
      const insertedBlock: Block = {
        id: '',
        type: 'Flow',
        title: source,
        date,
        tags: [],
        rows: [row],
        bandId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      toast.success(executeImmediately ? "Expense added and executed" : "Expense added");
      
      // Reset form
      resetForm();
      onOpenChange(false);
      
      // Show post-insert snackbar if not disabled for Flow type
      if (!templatePreferences.dontOfferForFlow) {
        setLastInsertedBlock(insertedBlock);
        setTimeout(() => {
          showPostInsertToast({
            block: insertedBlock,
            blockType: 'Flow',
            blockTitle: source,
            onSaveAsTemplate: () => {
              setSaveTemplateDialogOpen(true);
            },
            onDontOfferAgain: () => {
              updateTemplatePreference('Flow', true);
              toast.info(`Won't offer template save for Flow blocks anymore`);
            },
          });
        }, 300);
      }
    } catch (error) {
      console.error('Failed to create expense', error);
      toast.error(`Couldn't create expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setOwner(owners[0] || "");
    setSource("");
    setFromBaseId("");
    setToBaseId("");
    setMode('Fixed');
    setValue(0);
    setCategory("");
    setDate(startOfDay(bandInfo.startDate));
    setNotes("");
    setExecute(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Quick Expense</DialogTitle>
          <DialogDescription>
            Log a one-off expense in {bandInfo.title}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Owner */}
          <div className="space-y-2">
            <Label>Owner *</Label>
            <OwnerSelect value={owner} onValueChange={setOwner} />
          </div>

          {/* Source/Description */}
          <div className="space-y-2">
            <Label>Source/Description *</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g., Grocery Store"
            />
          </div>

          {/* From Base */}
          <div className="space-y-2">
            <Label>From Base *</Label>
            <Select value={fromBaseId} onValueChange={setFromBaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select base" />
              </SelectTrigger>
              <SelectContent>
                {bases.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Base (Optional) */}
          <div className="space-y-2">
            <Label>To Base (Optional)</Label>
            <Select value={toBaseId} onValueChange={setToBaseId}>
              <SelectTrigger>
                <SelectValue placeholder="None (optional)" />
              </SelectTrigger>
              <SelectContent>
                {bases.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode */}
          <div className="space-y-2">
            <Label>Mode *</Label>
            <Select value={mode} onValueChange={(v: 'Fixed' | '%') => setMode(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fixed">Fixed ($)</SelectItem>
                <SelectItem value="%">Percent (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={value || ""}
              onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <CategorySelect value={category} onValueChange={setCategory} />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date *</Label>
            <DatePickerField
              value={date}
              onChange={setDate}
              bandStart={bandInfo.startDate}
              bandEnd={bandInfo.endDate}
              className="w-full"
            />
            {isDateOutsideBand && (
              <div className="flex items-center gap-2 text-xs text-warning">
                <span>⚠️ Date is outside this band</span>
                <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => setDate(startOfDay(bandInfo.startDate))}>
                  Use band start
                </Button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="col-span-2 space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
            />
          </div>

          {/* Execute */}
          <div className="col-span-2 flex items-center space-x-2">
            <Checkbox
              id="execute"
              checked={execute}
              onCheckedChange={(checked) => setExecute(checked === true)}
            />
            <Label htmlFor="execute" className="cursor-pointer">
              Execute immediately (update base balances)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save & Execute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    <SaveAsTemplateDialog
      open={saveTemplateDialogOpen}
      onOpenChange={setSaveTemplateDialogOpen}
      block={lastInsertedBlock}
    />
    </>
  );
}
