import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import type { Block, Row } from "@/types";
import { getDisplayValue } from "@/lib/displayUtils";

interface ApplyFlowTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Block | null;
  onInsert: (rows: Row[]) => void;
  bandInfo?: { title: string; startDate: Date; endDate: Date };
  initialBasis?: number;
  availableToAllocate?: number;
}

export function ApplyFlowTemplateDialog({
  open,
  onOpenChange,
  template,
  onInsert,
  bandInfo,
  initialBasis,
  availableToAllocate,
}: ApplyFlowTemplateDialogProps) {
  const bases = useStore((state) => state.bases);
  
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [allocationBasis, setAllocationBasis] = useState<number>(0);
  const [autoFillEnabled, setAutoFillEnabled] = useState(false);
  const [autoFillRowId, setAutoFillRowId] = useState<string>("");

  // Initialize basis and select all rows when dialog opens
  useEffect(() => {
    if (open && template) {
      setSelectedRowIds(new Set(template.rows.map(r => r.id)));
      
      // Determine initial basis: Calculator > Band Available > 0
      if (initialBasis !== undefined) {
        setAllocationBasis(initialBasis);
      } else if (availableToAllocate !== undefined) {
        setAllocationBasis(availableToAllocate);
      } else {
        setAllocationBasis(0);
      }
    }
  }, [open, template, initialBasis, availableToAllocate]);

  if (!template) return null;

  const handleToggleRow = (rowId: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedRowIds(new Set(template.rows.map(r => r.id)));
  };

  const handleSelectNone = () => {
    setSelectedRowIds(new Set());
  };

  // Calculate allocated and remaining amounts
  const selectedRows = template.rows.filter(r => selectedRowIds.has(r.id));
  
  const rowsWithCalculatedAmounts = useMemo(() => {
    return selectedRows.map(row => {
      const amount = row.flowMode === '%' 
        ? (row.flowValue || 0) / 100 * allocationBasis 
        : (row.flowValue || 0);
      return { ...row, amount };
    });
  }, [selectedRows, allocationBasis]);

  const allocated = rowsWithCalculatedAmounts.reduce((sum, r) => sum + r.amount, 0);
  const remaining = allocationBasis - allocated;

  // Apply auto-fill to selected row
  useEffect(() => {
    if (autoFillEnabled && autoFillRowId && remaining !== 0) {
      // This is a visual indicator only - actual implementation would update the row
      // For now, we'll show the remaining in the UI
    }
  }, [autoFillEnabled, autoFillRowId, remaining]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleInsert = () => {
    if (selectedRowIds.size === 0) {
      toast.error("Please select at least one row");
      return;
    }

    const defaultDate = bandInfo?.startDate || new Date();
    
    // Create new row instances with calculated amounts
    const newRows: Row[] = rowsWithCalculatedAmounts.map(row => {
      let finalAmount = row.amount;
      
      // Apply auto-fill remaining to selected row
      if (autoFillEnabled && autoFillRowId === row.id && remaining !== 0) {
        finalAmount = row.amount + remaining;
      }

      return {
        ...row,
        id: uuidv4(),
        date: defaultDate,
        amount: finalAmount,
        executed: false,
      };
    });

    onInsert(newRows);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply Allocation Template: {template.title}</DialogTitle>
          <DialogDescription>
            {bandInfo 
              ? `Select rows to insert into ${bandInfo.title}`
              : "Select which rows to include from this template"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Allocation Basis */}
          <div className="p-4 border rounded-lg bg-accent/5 space-y-3">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Allocation Basis</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={allocationBasis || ""}
                  onChange={(e) => setAllocationBasis(parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm font-semibold"
                />
                {initialBasis !== undefined && (
                  <p className="text-xs text-muted-foreground">From Calculator</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Allocated</Label>
                <div className="h-8 px-3 flex items-center font-semibold text-sm border rounded-md bg-success/10 text-success">
                  {formatCurrency(allocated)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Remaining</Label>
                <div className={`h-8 px-3 flex items-center font-semibold text-sm border rounded-md ${
                  Math.abs(remaining) < 0.01 ? 'bg-success/10 text-success' : 
                  remaining > 0 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                }`}>
                  {formatCurrency(remaining)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Selected Rows</Label>
                <div className="h-8 px-3 flex items-center font-semibold text-sm border rounded-md bg-muted">
                  {selectedRowIds.size} of {template.rows.length}
                </div>
              </div>
            </div>

            {/* Auto-fill Remaining */}
            <div className="flex items-center gap-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-fill"
                  checked={autoFillEnabled}
                  onCheckedChange={setAutoFillEnabled}
                />
                <Label htmlFor="auto-fill" className="text-sm cursor-pointer">
                  Auto-fill remaining into row:
                </Label>
              </div>
              <select
                value={autoFillRowId}
                onChange={(e) => setAutoFillRowId(e.target.value)}
                disabled={!autoFillEnabled}
                className="h-8 px-2 text-sm border rounded-md disabled:opacity-50"
              >
                <option value="">Select row...</option>
                {selectedRows.map(row => (
                  <option key={row.id} value={row.id}>
                    {getDisplayValue(row.source, "Unnamed")} ({getDisplayValue(row.owner)})
                  </option>
                ))}
              </select>
              {autoFillEnabled && autoFillRowId && (
                <Badge variant="outline" className="text-xs">
                  Will add {formatCurrency(remaining)} to selected row
                </Badge>
              )}
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button size="sm" variant="outline" onClick={handleSelectNone}>
              Select None
            </Button>
          </div>

          {/* Rows Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Include</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {template.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No rows in template
                    </TableCell>
                  </TableRow>
                ) : (
                  template.rows.map((row) => {
                    const isSelected = selectedRowIds.has(row.id);
                    const calculatedAmount = row.flowMode === '%' 
                      ? (row.flowValue || 0) / 100 * allocationBasis 
                      : (row.flowValue || 0);
                    
                    return (
                      <TableRow key={row.id} className={!isSelected ? "opacity-50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleRow(row.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{getDisplayValue(row.owner)}</TableCell>
                        <TableCell>{getDisplayValue(row.source, "-")}</TableCell>
                        <TableCell>
                          {bases.find(b => b.id === row.fromBaseId)?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {row.toBaseId ? bases.find(b => b.id === row.toBaseId)?.name || "-" : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getDisplayValue(row.type, "-")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {getDisplayValue(row.category, "-")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {row.flowMode === '%' ? '%' : '$'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {row.flowMode === '%' ? `${row.flowValue}%` : formatCurrency(row.flowValue || 0)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(calculatedAmount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.notes || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={selectedRowIds.size === 0}>
            Insert Selected ({selectedRowIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
