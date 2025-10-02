import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Plus, Trash2, GripVertical, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Block, Row, BlockType } from "@/types";
import { PickFixedBillsDialog } from "@/components/PickFixedBillsDialog";
import { ApplyFlowTemplateDialog } from "@/components/ApplyFlowTemplateDialog";
import { DuplicateBlockDialog } from "@/components/DuplicateBlockDialog";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import { DatePickerField } from "@/components/shared/DatePickerField";
import { OwnerSelect } from "@/components/shared/OwnerSelect";
import { CategorySelect } from "@/components/shared/CategorySelect";

interface EditBlockDialogProps {
  block: Block | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (block: Block) => void;
  availableToAllocate?: number; // Band's Expected Income - Expected Fixed
}

export function EditBlockDialog({ block, open, onOpenChange, onDelete, availableToAllocate }: EditBlockDialogProps) {
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

  const blockType = block.type as BlockType;
  const currentBand = bands.find(b => b.id === block.bandId);

  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [showInsertBills, setShowInsertBills] = useState(false);
  const [showApplyAllocation, setShowApplyAllocation] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  
  // Flow allocation state
  const [basisSource, setBasisSource] = useState<'band' | 'manual'>('band');
  const [manualBasis, setManualBasis] = useState<number>(0);
  
  // Computed basis based on source
  const allocationBasis = blockType === 'Flow' 
    ? (basisSource === 'band' ? (availableToAllocate || 0) : manualBasis)
    : 0;

  useEffect(() => {
    if (open && block) {
      setRows(block.rows);
      setTitle(block.title);
      setDate(block.date);
      
      // Initialize basis source for Flow blocks
      if (blockType === 'Flow') {
        if (availableToAllocate !== undefined) {
          setBasisSource('band');
        } else {
          setBasisSource('manual');
          setManualBasis(0);
        }
      }
    }
  }, [open, block, availableToAllocate, blockType]);

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
      date: startOfDay(date),
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
      if (!row.amount || row.amount <= 0) {
        toast.error("All rows must have a positive amount");
        return;
      }
      if (blockType === 'Income' && !row.toBaseId) {
        toast.error("Income rows must have a destination (To Base)");
        return;
      }
      if (blockType === 'Fixed Bill' && !row.fromBaseId) {
        toast.error("Fixed Bill rows must have a source (From Base)");
        return;
      }
      if (blockType === 'Flow') {
        if (!row.fromBaseId) {
          toast.error("Flow rows must have a source (From Base)");
          return;
        }
        // Category is optional for Flow rows
        // Validate basis for % rows
        if (row.flowMode === '%') {
          if (!allocationBasis || allocationBasis <= 0) {
            toast.error("Allocation Basis is required for percentage-based rows");
            return;
          }
        }
      }
    }

    updateBlock(block.id, { rows, title: title.trim(), date });
    toast.success("Block updated");
    onOpenChange(false);
  };

  const handleDuplicate = () => {
    setShowDuplicate(true);
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
            <div className="flex gap-4">
              <div className={blockType === 'Flow' ? 'flex-1 grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30' : 'flex-1 grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30'}>
              
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DatePickerField
                    value={date}
                    onChange={setDate}
                    bandStart={currentBand?.startDate}
                    bandEnd={currentBand?.endDate}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Allocation Basis Panel (Flow only) */}
              {blockType === 'Flow' && (
                <div className="w-[280px] p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Allocation Basis</Label>
                    <Badge variant="secondary" className="text-xs">Used for % rows</Badge>
                  </div>
                  
                  {availableToAllocate !== undefined && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Band Available</Label>
                      <div className="px-3 py-2 rounded-md bg-background text-sm font-medium">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(availableToAllocate)}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Basis Source</Label>
                    <Select value={basisSource} onValueChange={(v: 'band' | 'manual') => setBasisSource(v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableToAllocate !== undefined && (
                          <SelectItem value="band">Band Available</SelectItem>
                        )}
                        <SelectItem value="manual">Manual Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {basisSource === 'manual' && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Manual Basis</Label>
                      <Input
                        type="number"
                        value={manualBasis}
                        onChange={(e) => setManualBasis(parseFloat(e.target.value) || 0)}
                        placeholder="Enter amount"
                        className="h-9"
                      />
                    </div>
                  )}
                  
                  <div className="pt-2 border-t space-y-1">
                    <Label className="text-xs text-muted-foreground">Active Basis</Label>
                    <div className="px-3 py-2 rounded-md bg-primary/10 text-sm font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(allocationBasis)}
                    </div>
                  </div>
                </div>
              )}
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
                          <OwnerSelect 
                            value={row.owner} 
                            onValueChange={(v) => updateRow(row.id, { owner: v })}
                            className="h-8"
                          />
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
                          <CategorySelect
                            value={row.category || ""}
                            onValueChange={(v) => updateRow(row.id, { category: v })}
                            placeholder={blockType === 'Flow' ? "Required" : "Optional"}
                            required={blockType === 'Flow'}
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <DatePickerField
                            value={row.date}
                            onChange={(d) => updateRow(row.id, { date: startOfDay(d) })}
                            bandStart={currentBand?.startDate}
                            bandEnd={currentBand?.endDate}
                            className="h-8 w-[130px]"
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

            {/* Footer Totals / Flow Summary */}
            {blockType === 'Flow' ? (
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Flow Summary</span>
                  <span className="text-sm text-muted-foreground">{rows.length} row(s)</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Basis</p>
                    <p className="text-lg font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(allocationBasis)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Allocated</p>
                    <p className="text-lg font-bold text-accent">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateFlowAllocated())}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                    <p className={`text-lg font-bold ${calculateFlowRemaining() >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateFlowRemaining())}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex gap-6">
                  <div>
                    <span className="text-sm text-muted-foreground">Total:</span>
                    <span className="ml-2 text-lg font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateTotal())}
                    </span>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{rows.length} row(s)</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDelete}>
                Delete Block
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDuplicate}>
                Duplicate to...
              </Button>
              <Button variant="outline" onClick={() => setShowSaveAsTemplate(true)}>
                <FileText className="w-4 h-4 mr-2" />
                Save to Library
              </Button>
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

      {/* Duplicate Block Dialog */}
      <DuplicateBlockDialog
        open={showDuplicate}
        onOpenChange={setShowDuplicate}
        block={block}
      />

      {/* Save as Template Dialog */}
      <SaveAsTemplateDialog
        open={showSaveAsTemplate}
        onOpenChange={setShowSaveAsTemplate}
        block={block ? {
          ...block,
          title,
          date,
          rows,
          allocationBasisValue: blockType === 'Flow' ? allocationBasis : undefined,
        } : null}
      />
    </>
  );
}
