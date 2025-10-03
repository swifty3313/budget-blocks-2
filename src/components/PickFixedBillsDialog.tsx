import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Search, Settings, AlertCircle } from "lucide-react";
import type { PayPeriodBand, Row } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { getDisplayValue } from "@/lib/displayUtils";
import { billsLibrary, type BillItem } from "@/lib/billsLibrary";
import { billDateInBand } from "@/lib/billDateUtils";

interface PickFixedBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  band: PayPeriodBand | null;
  onInsert: (rows: Row[]) => void;
  onManageLibrary: () => void;
  refreshTrigger?: number;
}

export function PickFixedBillsDialog({ open, onOpenChange, band, onInsert, onManageLibrary, refreshTrigger }: PickFixedBillsDialogProps) {
  const bases = useStore((state) => state.bases);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);

  const [bills, setBills] = useState<BillItem[]>([]);
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  // Load bills from library
  useEffect(() => {
    if (open) {
      setBills(billsLibrary.all());
    }
  }, [open, refreshTrigger]);

  // Filter and enrich bills with computed dates
  const enrichedBills = useMemo(() => {
    if (!band) return [];

    return bills
      .filter((b) => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        const owner = owners.find(o => o === b.ownerId) || b.ownerId;
        const category = categories.find(c => c === b.defaultCategoryId) || b.defaultCategoryId || '';
        return (
          owner.toLowerCase().includes(search) ||
          b.vendor.toLowerCase().includes(search) ||
          category.toLowerCase().includes(search)
        );
      })
      .map((bill) => {
        const { date, inBand } = billDateInBand(band.startDate, band.endDate, bill.dueDay);
        return {
          ...bill,
          dateInBand: date,
          isInBand: inBand,
        };
      });
  }, [bills, band, searchTerm, owners, categories]);

  // Sort: in-band first, then by vendor name
  const sortedBills = useMemo(() => {
    return [...enrichedBills].sort((a, b) => {
      if (a.isInBand !== b.isInBand) return a.isInBand ? -1 : 1;
      return a.vendor.localeCompare(b.vendor);
    });
  }, [enrichedBills]);

  // Select all in-band bills
  const handleSelectAllInBand = () => {
    const inBandIds = sortedBills.filter((b) => b.isInBand).map((b) => b.id);
    setSelectedBillIds(new Set(inBandIds));
  };

  const handleSelectNone = () => {
    setSelectedBillIds(new Set());
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedBillIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedBillIds(newSet);
  };

  const handleInsertSelected = () => {
    if (selectedBillIds.size === 0) {
      toast.error("No bills selected");
      return;
    }

    if (!band) return;

    const selectedBills = sortedBills.filter((b) => selectedBillIds.has(b.id));
    
    const rows: Row[] = selectedBills.map((bill) => {
      // Use computed date if in band, otherwise use band start date
      const date = bill.dateInBand || band.startDate;
      
      return {
        id: uuidv4(),
        date,
        owner: owners.find(o => o === bill.ownerId) || bill.ownerId,
        source: bill.vendor,
        fromBaseId: bill.fromBaseId,
        amount: bill.defaultAmount,
        category: bill.defaultCategoryId || undefined,
        notes: bill.notes || undefined,
        executed: false,
      };
    });

    onInsert(rows);
    toast.success(`Inserted ${rows.length} bill(s) into block`);
    setSelectedBillIds(new Set());
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

  if (!band) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Pick Bills for {band.title}
          </DialogTitle>
          <DialogDescription>
            {formatDate(band.startDate)} – {formatDate(band.endDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter by owner, vendor, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSelectAllInBand}>
              Select All In Band
            </Button>
            <Button variant="outline" size="sm" onClick={handleSelectNone}>
              Select None
            </Button>
            <Button variant="ghost" size="sm" onClick={onManageLibrary}>
              <Settings className="w-4 h-4 mr-2" />
              Manage Bills
            </Button>
          </div>

          {/* Bills Table */}
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
                  <TableHead>Date in Band</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Autopay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {searchTerm
                        ? "No bills match your filter"
                        : "No bills yet. Click 'Manage Bills' to add recurring expenses."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedBills.map((bill) => {
                    const ownerName = owners.find(o => o === bill.ownerId) || bill.ownerId;
                    const categoryName = bill.defaultCategoryId 
                      ? (categories.find(c => c === bill.defaultCategoryId) || bill.defaultCategoryId)
                      : '—';
                    
                    return (
                      <TableRow key={bill.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedBillIds.has(bill.id)}
                            onCheckedChange={() => handleToggleSelect(bill.id)}
                          />
                        </TableCell>
                        <TableCell>{ownerName}</TableCell>
                        <TableCell className="font-medium">{bill.vendor}</TableCell>
                        <TableCell>
                          {bases.find((b) => b.id === bill.fromBaseId)?.name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(bill.defaultAmount)}</TableCell>
                        <TableCell>{bill.dueDay === 'Last' ? 'Last Day' : bill.dueDay}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {bill.dateInBand ? formatDate(bill.dateInBand) : '—'}
                            {!bill.isInBand && selectedBillIds.has(bill.id) && (
                              <Badge variant="outline" className="text-xs">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Out of band
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {categoryName}
                        </TableCell>
                        <TableCell className="text-center">
                          {bill.autopay ? '✓' : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedBillIds.size} selected (of {sortedBills.length} total)
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInsertSelected} disabled={selectedBillIds.size === 0}>
            Insert Selected ({selectedBillIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
