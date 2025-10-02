import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { format, isWithinInterval } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { CalendarIcon } from "lucide-react";
import type { Row } from "@/types";

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

  const [owner, setOwner] = useState("");
  const [source, setSource] = useState("");
  const [fromBaseId, setFromBaseId] = useState("");
  const [toBaseId, setToBaseId] = useState("");
  const [mode, setMode] = useState<'Fixed' | '%'>('Fixed');
  const [value, setValue] = useState<number>(0);
  const [category, setCategory] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [dateInput, setDateInput] = useState("");
  const [notes, setNotes] = useState("");
  const [execute, setExecute] = useState(false);

  // Initialize with band start date and first owner
  useEffect(() => {
    if (open) {
      setDate(bandInfo.startDate);
      setDateInput(format(bandInfo.startDate, 'MM/dd/yyyy'));
      if (owners.length > 0) {
        setOwner(owners[0]);
      }
    }
  }, [open, bandInfo, owners]);

  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    // Try to parse MM/DD/YYYY
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [_, month, day, year] = match;
      const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(parsed.getTime())) {
        setDate(parsed);
      }
    }
  };

  const isDateOutsideBand = !isWithinInterval(date, { start: bandInfo.startDate, end: bandInfo.endDate });

  const handleQuickDateSet = (targetDate: Date) => {
    setDate(targetDate);
    setDateInput(format(targetDate, 'MM/dd/yyyy'));
  };

  const handleSave = (executeImmediately: boolean = false) => {
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

    // Create Flow block
    addBlock({
      type: 'Flow',
      title: source,
      date,
      tags: [],
      rows: [row],
      bandId,
    });

    toast.success(executeImmediately ? "Expense added and executed" : "Expense added");
    
    // Reset form
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setOwner(owners[0] || "");
    setSource("");
    setFromBaseId("");
    setToBaseId("");
    setMode('Fixed');
    setValue(0);
    setCategory("");
    setDate(bandInfo.startDate);
    setDateInput(format(bandInfo.startDate, 'MM/dd/yyyy'));
    setNotes("");
    setExecute(false);
  };

  return (
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
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {owners.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date *</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && handleQuickDateSet(d)}
                    initialFocus
                  />
                  <div className="p-3 border-t flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleQuickDateSet(new Date())}>
                      Today
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleQuickDateSet(bandInfo.startDate)}>
                      Band Start
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleQuickDateSet(bandInfo.endDate)}>
                      Band End
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Input
                placeholder="MM/DD/YYYY"
                value={dateInput}
                onChange={(e) => handleDateInputChange(e.target.value)}
                className="flex-1"
              />
            </div>
            {isDateOutsideBand && (
              <div className="flex items-center gap-2 text-xs text-warning">
                <span>⚠️ Date is outside this band</span>
                <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => handleQuickDateSet(bandInfo.startDate)}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleSave(false)}>
            Save
          </Button>
          <Button onClick={() => handleSave(true)}>
            Save & Execute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
