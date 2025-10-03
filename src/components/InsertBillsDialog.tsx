import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { showErrorToast } from "@/lib/toastUtils";
import { billDateInBand } from "@/lib/billDateUtils";
import type { PayPeriodBand, Row } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { OwnerSelect } from "@/components/shared/OwnerSelect";
import { CategorySelect } from "@/components/shared/CategorySelect";

interface InsertBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  band: PayPeriodBand;
  onInsert: (rows: Row[]) => void;
}

interface BillRow {
  id: string;
  ownerId: string;
  vendor: string;
  fromBaseId: string;
  amount: number;
  dueDay: number;
  categoryId?: string;
  autopay: boolean;
  notes?: string;
  errors?: {
    ownerId?: string;
    vendor?: string;
    fromBaseId?: string;
    amount?: string;
    dueDay?: string;
  };
}

export function InsertBillsDialog({ open, onOpenChange, band, onInsert }: InsertBillsDialogProps) {
  const bases = useStore((state) => state.bases);
  const owners = useStore((state) => state.owners);

  const [billRows, setBillRows] = useState<BillRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Compute date in band for each row
  const enrichedRows = useMemo(() => {
    return billRows.map((row) => {
      const { date, inBand } = billDateInBand(band.startDate, band.endDate, row.dueDay);
      return {
        ...row,
        dateInBand: date,
        isInBand: inBand,
      };
    });
  }, [billRows, band]);

  const handleAddRow = () => {
    const newRow: BillRow = {
      id: uuidv4(),
      ownerId: owners[0] || "",
      vendor: "",
      fromBaseId: bases[0]?.id || "",
      amount: 0,
      dueDay: 1,
      categoryId: undefined,
      autopay: false,
      notes: "",
    };
    setBillRows([newRow, ...billRows]);
  };

  const handleSelectAll = () => {
    const allIds = billRows.map((r) => r.id);
    setSelectedRowIds(new Set(allIds));
  };

  const handleSelectNone = () => {
    setSelectedRowIds(new Set());
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedRowIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRowIds(newSet);
  };

  const handleDeleteRow = (id: string) => {
    setBillRows(billRows.filter((r) => r.id !== id));
    const newSet = new Set(selectedRowIds);
    newSet.delete(id);
    setSelectedRowIds(newSet);
  };

  const updateRowField = <K extends keyof BillRow>(id: string, field: K, value: BillRow[K]) => {
    setBillRows(billRows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const validateRow = (row: BillRow): boolean => {
    const errors: BillRow["errors"] = {};
    
    if (!row.ownerId) errors.ownerId = "Required";
    if (!row.vendor.trim()) errors.vendor = "Required";
    if (!row.fromBaseId) errors.fromBaseId = "Required";
    if (row.amount < 0) errors.amount = "Must be ≥ 0";
    if (row.dueDay < 1 || row.dueDay > 31) errors.dueDay = "1-31";

    if (Object.keys(errors).length > 0) {
      updateRowField(row.id, "errors", errors);
      return false;
    }
    
    updateRowField(row.id, "errors", undefined);
    return true;
  };

  const handleInsertSelected = () => {
    if (selectedRowIds.size === 0) {
      showErrorToast("No bills selected");
      return;
    }

    const selectedRows = enrichedRows.filter((r) => selectedRowIds.has(r.id));
    
    // Validate all selected rows
    let allValid = true;
    for (const row of selectedRows) {
      if (!validateRow(row)) {
        allValid = false;
      }
    }

    if (!allValid) {
      showErrorToast("Please fix errors in selected rows");
      return;
    }

    const rows: Row[] = selectedRows.map((row) => {
      const date = row.dateInBand || band.startDate;
      
      return {
        id: uuidv4(),
        date,
        owner: row.ownerId,
        source: row.vendor,
        fromBaseId: row.fromBaseId,
        amount: row.amount,
        category: row.categoryId,
        notes: row.notes,
        executed: false,
      };
    });

    onInsert(rows);
    toast.success(`Inserted ${rows.length} bill(s) into block`);
    setBillRows([]);
    setSelectedRowIds(new Set());
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Insert Bills for {band.title}</DialogTitle>
          <DialogDescription>
            {formatDate(band.startDate)} – {formatDate(band.endDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 py-2">
          <Button onClick={handleAddRow} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Row
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleSelectNone}>
              Select None
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedRowIds.size === billRows.length && billRows.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleSelectAll();
                      } else {
                        handleSelectNone();
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="min-w-[150px]">Owner *</TableHead>
                <TableHead className="min-w-[150px]">Vendor *</TableHead>
                <TableHead className="min-w-[150px]">From Base *</TableHead>
                <TableHead className="min-w-[120px]">Amount *</TableHead>
                <TableHead className="min-w-[100px]">Due Day *</TableHead>
                <TableHead className="min-w-[150px]">Date in Band</TableHead>
                <TableHead className="min-w-[150px]">Category</TableHead>
                <TableHead className="w-[80px]">Autopay</TableHead>
                <TableHead className="min-w-[200px]">Notes</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    Click "Add Row" to create your first bill entry
                  </TableCell>
                </TableRow>
              ) : (
                enrichedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRowIds.has(row.id)}
                        onCheckedChange={() => handleToggleSelect(row.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <OwnerSelect
                        value={row.ownerId}
                        onValueChange={(v) => updateRowField(row.id, "ownerId", v)}
                      />
                      {row.errors?.ownerId && (
                        <p className="text-xs text-destructive mt-1">{row.errors.ownerId}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.vendor}
                        onChange={(e) => updateRowField(row.id, "vendor", e.target.value)}
                        placeholder="Vendor name"
                        className={row.errors?.vendor ? "border-destructive" : ""}
                      />
                      {row.errors?.vendor && (
                        <p className="text-xs text-destructive mt-1">{row.errors.vendor}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.fromBaseId}
                        onValueChange={(v) => updateRowField(row.id, "fromBaseId", v)}
                      >
                        <SelectTrigger className={row.errors?.fromBaseId ? "border-destructive" : ""}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {bases.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {row.errors?.fromBaseId && (
                        <p className="text-xs text-destructive mt-1">{row.errors.fromBaseId}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.amount}
                        onChange={(e) => updateRowField(row.id, "amount", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        step="0.01"
                        className={row.errors?.amount ? "border-destructive" : ""}
                      />
                      {row.errors?.amount && (
                        <p className="text-xs text-destructive mt-1">{row.errors.amount}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.dueDay}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          updateRowField(row.id, "dueDay", Math.max(1, Math.min(31, val)));
                        }}
                        min={1}
                        max={31}
                        className={row.errors?.dueDay ? "border-destructive" : ""}
                      />
                      {row.errors?.dueDay && (
                        <p className="text-xs text-destructive mt-1">{row.errors.dueDay}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {row.dateInBand ? formatDate(row.dateInBand) : "—"}
                        </span>
                        {!row.isInBand && (
                          <Badge variant="outline" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Not in band
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CategorySelect
                        value={row.categoryId || ""}
                        onValueChange={(v) => updateRowField(row.id, "categoryId", v || undefined)}
                        placeholder="Optional"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={row.autopay}
                        onCheckedChange={(checked) => updateRowField(row.id, "autopay", checked === true)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.notes || ""}
                        onChange={(e) => updateRowField(row.id, "notes", e.target.value || undefined)}
                        placeholder="Optional"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRow(row.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedRowIds.size} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertSelected} disabled={selectedRowIds.size === 0}>
              Insert Selected ({selectedRowIds.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
