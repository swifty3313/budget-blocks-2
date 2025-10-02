import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Calendar as CalendarIcon, GripVertical, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Block, Row, BlockType } from "@/types";
import { PickFixedBillsDialog } from "@/components/PickFixedBillsDialog";
import { ApplyFlowTemplateDialog } from "@/components/ApplyFlowTemplateDialog";

interface EditBlockDialogProps {
  block: Block | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (block: Block) => void;
}

export function EditBlockDialog({ block, open, onOpenChange, onDelete }: EditBlockDialogProps) {
  if (!block) return null;

  const bases = useStore((state) => state.bases);
  const bands = useStore((state) => state.bands);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);
  const updateBlock = useStore((state) => state.updateBlock);
  const addBlock = useStore((state) => state.addBlock);
  const executeRow = useStore((state) => state.executeRow);
  const undoExecuteRow = useStore((state) => state.undoExecuteRow);
  const addToMasterList = useStore((state) => state.addToMasterList);

  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [showInsertBills, setShowInsertBills] = useState(false);
  const [showApplyAllocation, setShowApplyAllocation] = useState(false);
  const [allocationBasis, setAllocationBasis] = useState<number>(0);

  const blockType = block.type as BlockType;
  const currentBand = bands.find(b => b.id === block.bandId);

  useEffect(() => {
    if (open && block) {
      setRows(block.rows);
      setTitle(block.title);
      setDate(block.date);
    }
  }, [open, block]);

  const addRow = () => {
    const newRow: Row = {
      id: uuidv4(),
      owner: owners[0] || "",
      source: "",
      fromBaseId: "",
      toBaseId: "",
      amount: 0,
      type: blockType === 'Flow' ? 'Transfer' : undefined,
      category: "",
      date: date,
      notes: "",
      executed: false,
      flowMode: blockType === 'Flow' ? 'Fixed' : undefined,
      flowValue: blockType === 'Flow' ? 0 : undefined,
    };
    setRows([...rows, newRow]);
  };

  const deleteRow = (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (row?.executed) {
      toast.error("Cannot delete executed rows. Un-execute first.");
      return;
    }
    if (rows.length === 1) {
      toast.error("Block must have at least one row");
      return;
    }
    setRows(rows.filter((r) => r.id !== rowId));
  };

  const updateRow = (rowId: string, updates: Partial<Row>) => {
    setRows(rows.map((r) => (r.id === rowId ? { ...r, ...updates } : r)));
  };

  const handleToggleExecute = (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    if (row.executed) {
      undoExecuteRow(block.id, rowId);
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, executed: false } : r));
    } else {
      executeRow(block.id, rowId);
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, executed: true } : r));
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    if (rows.length === 0) {
      toast.error("Block must have at least one row");
      return;
    }

    // Validation
    for (const row of rows) {
      if (!row.owner?.trim()) {
        toast.error("All rows must have an owner");
        return;
      }
      if (row.amount <= 0) {
        toast.error("All rows must have a positive amount");
        return;
      }
    }

    updateBlock(block.id, { rows, title: title.trim(), date });
    toast.success("Block updated");
    onOpenChange(false);
  };

  const handleRename = () => {
    const newTitle = prompt("Enter new title:", title);
    if (newTitle && newTitle.trim()) {
      setTitle(newTitle.trim());
    }
  };

  const handleDuplicate = () => {
    addBlock({ ...block, id: uuidv4(), rows: block.rows.map(r => ({ ...r, id: uuidv4(), executed: false })) });
    toast.success("Block duplicated");
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(block);
      onOpenChange(false);
    }
  };

  const handleInsertBills = (newRows: Row[]) => {
    setRows([...rows, ...newRows]);
    setShowInsertBills(false);
    toast.success(`Inserted ${newRows.length} bill(s)`);
  };

  const handleApplyAllocation = (newRows: Row[]) => {
    setRows([...rows, ...newRows]);
    setShowApplyAllocation(false);
    toast.success(`Inserted ${newRows.length} allocation(s)`);
  };

  const calculateTotal = () => {
    return rows.reduce((sum, row) => sum + row.amount, 0);
  };

  const calculateFlowAllocated = () => {
    if (blockType !== 'Flow') return 0;
    return rows.reduce((sum, row) => {
      if (row.flowMode === 'Fixed') return sum + (row.flowValue || 0);
      if (row.flowMode === '%') return sum + (allocationBasis * ((row.flowValue || 0) / 100));
      return sum;
    }, 0);
  };

  const calculateFlowRemaining = () => {
    return allocationBasis - calculateFlowAllocated();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Edit Block: {title}</DialogTitle>
                <DialogDescription>
                  {blockType} • {format(date, 'MMM d, yyyy')}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                {blockType === 'Fixed Bill' && currentBand && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowInsertBills(true)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Insert Bills
                  </Button>
                )}
                {blockType === 'Flow' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowApplyAllocation(true)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Apply Allocation
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Block Header Fields */}
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(date, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Transactions</Label>
                <Button size="sm" onClick={addRow}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Row
                </Button>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-center p-2 font-medium w-12">Execute</th>
                      <th className="text-left p-2 font-medium">Owner</th>
                      {blockType === 'Income' && <th className="text-left p-2 font-medium">Source</th>}
                      {blockType === 'Fixed Bill' && <th className="text-left p-2 font-medium">Vendor</th>}
                      {blockType === 'Income' && <th className="text-left p-2 font-medium">To Base</th>}
                      {blockType === 'Fixed Bill' && <th className="text-left p-2 font-medium">From Base</th>}
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium">From Base</th>}
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium">To Base</th>}
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium">Mode</th>}
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium">Value</th>}
                      <th className="text-left p-2 font-medium">Amount</th>
                      <th className="text-left p-2 font-medium">Category</th>
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-left p-2 font-medium">Notes</th>
                      <th className="text-center p-2 font-medium w-12">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t hover:bg-muted/30">
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={row.executed}
                            onCheckedChange={() => handleToggleExecute(row.id)}
                          />
                        </td>
                        <td className="p-2">
                          <Select value={row.owner} onValueChange={(v) => updateRow(row.id, { owner: v })}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {owners.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {(blockType === 'Income' || blockType === 'Fixed Bill') && (
                          <td className="p-2">
                            <Input
                              className="h-8"
                              value={row.source || ""}
                              onChange={(e) => updateRow(row.id, { source: e.target.value })}
                            />
                          </td>
                        )}
                        {blockType === 'Income' && (
                          <td className="p-2">
                            <Select value={row.toBaseId} onValueChange={(v) => updateRow(row.id, { toBaseId: v })}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {bases.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        {blockType === 'Fixed Bill' && (
                          <td className="p-2">
                            <Select value={row.fromBaseId} onValueChange={(v) => updateRow(row.id, { fromBaseId: v })}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {bases.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        {blockType === 'Flow' && (
                          <>
                            <td className="p-2">
                              <Select value={row.fromBaseId} onValueChange={(v) => updateRow(row.id, { fromBaseId: v })}>
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {bases.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Select value={row.toBaseId} onValueChange={(v) => updateRow(row.id, { toBaseId: v })}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Optional" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bases.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Select value={row.flowMode} onValueChange={(v: 'Fixed' | '%') => updateRow(row.id, { flowMode: v })}>
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Fixed">Fixed</SelectItem>
                                  <SelectItem value="%">%</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                className="h-8"
                                value={row.flowValue || 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  updateRow(row.id, { 
                                    flowValue: val,
                                    amount: row.flowMode === 'Fixed' ? val : (allocationBasis * val / 100)
                                  });
                                }}
                              />
                            </td>
                          </>
                        )}
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-8"
                            value={row.amount}
                            onChange={(e) => updateRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8"
                            value={row.category || ""}
                            onChange={(e) => updateRow(row.id, { category: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="date"
                            className="h-8"
                            value={format(row.date, 'yyyy-MM-dd')}
                            onChange={(e) => updateRow(row.id, { date: new Date(e.target.value) })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8"
                            value={row.notes || ""}
                            onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteRow(row.id)}
                            disabled={row.executed}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Totals */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex gap-6">
                <div>
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="ml-2 text-lg font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateTotal())}
                  </span>
                </div>
                {blockType === 'Flow' && allocationBasis > 0 && (
                  <>
                    <div>
                      <span className="text-sm text-muted-foreground">Allocated:</span>
                      <span className="ml-2 text-lg font-bold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateFlowAllocated())}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Remaining:</span>
                      <span className="ml-2 text-lg font-bold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateFlowRemaining())}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{rows.length} row(s)</span>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRename}>
                Rename
              </Button>
              <Button variant="outline" onClick={handleDuplicate}>
                Duplicate to...
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Block
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insert Bills Dialog (Fixed Bill only) */}
      {currentBand && (
        <PickFixedBillsDialog
          open={showInsertBills}
          onOpenChange={setShowInsertBills}
          band={currentBand}
          onInsert={handleInsertBills}
          onManageLibrary={() => {}}
        />
      )}

      {/* Apply Allocation Template Dialog (Flow only) */}
      <ApplyFlowTemplateDialog
        open={showApplyAllocation}
        onOpenChange={setShowApplyAllocation}
        template={null}
        onInsert={handleApplyAllocation}
        bandInfo={currentBand ? {
          title: currentBand.title,
          startDate: currentBand.startDate,
          endDate: currentBand.endDate,
        } : undefined}
      />
    </>
  );
}
