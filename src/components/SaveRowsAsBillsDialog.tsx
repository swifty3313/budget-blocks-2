import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import type { Row } from "@/types";
import { getDisplayValue } from "@/lib/displayUtils";

interface SaveRowsAsBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Row[];
}

export function SaveRowsAsBillsDialog({ open, onOpenChange, rows }: SaveRowsAsBillsDialogProps) {
  const fixedBills = useStore((state) => state.fixedBills);
  const bases = useStore((state) => state.bases);
  const addFixedBill = useStore((state) => state.addFixedBill);
  const updateFixedBill = useStore((state) => state.updateFixedBill);

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      // Select all rows by default
      setSelectedRowIds(new Set(rows.map(r => r.id)));
    }
  }, [open, rows]);

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedRowIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRowIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedRowIds.size === rows.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(rows.map(r => r.id)));
    }
  };

  const extractDueDay = (date: Date): number | 'Last' => {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    
    if (day === lastDayOfMonth) {
      return 'Last';
    }
    return day;
  };

  const handleSave = () => {
    if (selectedRowIds.size === 0) {
      toast.error("No rows selected");
      return;
    }

    const selectedRows = rows.filter(r => selectedRowIds.has(r.id));
    let added = 0;
    let updated = 0;

    selectedRows.forEach(row => {
      const dueDay = extractDueDay(row.date);
      
      // Check if a bill with same owner, vendor (source), and fromBaseId exists
      const existingBill = fixedBills.find(bill => 
        bill.owner === row.owner &&
        bill.vendor === row.source &&
        bill.fromBaseId === row.fromBaseId &&
        bill.dueDay === dueDay
      );

      if (existingBill) {
        // Update existing bill
        updateFixedBill(existingBill.id, {
          defaultAmount: row.amount,
          category: row.category,
          notes: row.notes,
          active: true,
        });
        updated++;
      } else {
        // Add new bill
        addFixedBill({
          owner: row.owner,
          vendor: row.source || 'Unnamed Vendor',
          fromBaseId: row.fromBaseId,
          defaultAmount: row.amount,
          dueDay,
          category: row.category,
          notes: row.notes,
          autopay: false,
          active: true,
        });
        added++;
      }
    });

    toast.success(`Saved ${added + updated} bill(s) (${added} new, ${updated} updated)`);
    setSelectedRowIds(new Set());
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getBaseName = (baseId?: string) => {
    if (!baseId) return "—";
    const base = bases.find(b => b.id === baseId);
    return base ? base.name : "—";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save Rows as Bills</DialogTitle>
          <DialogDescription>
            Select rows to save as reusable bill templates in your library
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedRowIds.size === rows.length ? "Deselect All" : "Select All"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedRowIds.size} of {rows.length} selected
            </span>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <span className="sr-only">Include</span>
                  </TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>From Base</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Due Day</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No rows to save
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRowIds.has(row.id)}
                          onCheckedChange={() => handleToggleSelect(row.id)}
                        />
                      </TableCell>
                      <TableCell>{getDisplayValue(row.owner)}</TableCell>
                      <TableCell className="font-medium">{getDisplayValue(row.source, "Unnamed")}</TableCell>
                      <TableCell>{getBaseName(row.fromBaseId)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                      <TableCell>
                        {extractDueDay(row.date) === 'Last' ? 'Last Day' : extractDueDay(row.date)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{getDisplayValue(row.category, "—")}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{getDisplayValue(row.notes, "—")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: If a bill with the same owner, vendor, base, and due day already exists, it will be updated with the new amount and category.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={selectedRowIds.size === 0}>
            Save to Bills Library ({selectedRowIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
