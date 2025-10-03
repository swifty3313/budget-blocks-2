import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Search, Settings } from "lucide-react";
import { addDays, getDaysInMonth, lastDayOfMonth, setDate } from "date-fns";
import type { PayPeriodBand, FixedBill, Row } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { getDisplayValue } from "@/lib/displayUtils";

interface PickFixedBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  band: PayPeriodBand | null;
  onInsert: (rows: Row[]) => void;
  onManageLibrary: () => void;
}

export function PickFixedBillsDialog({ open, onOpenChange, band, onInsert, onManageLibrary }: PickFixedBillsDialogProps) {
  const fixedBills = useStore((state) => state.fixedBills);
  const bases = useStore((state) => state.bases);

  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  // Compute the actual date for a bill's due day within the band
  const computeDateInBand = (dueDay: number | 'Last', bandStart: Date, bandEnd: Date): Date | null => {
    const startYear = bandStart.getFullYear();
    const startMonth = bandStart.getMonth();
    const endYear = bandEnd.getFullYear();
    const endMonth = bandEnd.getMonth();

    // Try to find the due day in the band's date range
    const tryMonths = [
      { year: startYear, month: startMonth },
      { year: endYear, month: endMonth },
    ];

    for (const { year, month } of tryMonths) {
      let targetDate: Date;
      
      if (dueDay === 'Last') {
        targetDate = lastDayOfMonth(new Date(year, month, 1));
      } else {
        const daysInMonth = getDaysInMonth(new Date(year, month, 1));
        const actualDay = Math.min(dueDay, daysInMonth);
        targetDate = new Date(year, month, actualDay);
      }

      // Check if this date falls within the band
      if (targetDate >= bandStart && targetDate <= bandEnd) {
        return targetDate;
      }
    }

    // If not found in band, return null (not in this band)
    return null;
  };

  // Filter and enrich bills with computed dates
  const enrichedBills = useMemo(() => {
    if (!band) return [];

    const active = fixedBills.filter((bill) => bill.active);
    const search = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? active.filter(
          (bill) =>
            bill.owner.toLowerCase().includes(search) ||
            bill.vendor.toLowerCase().includes(search) ||
            bill.category?.toLowerCase().includes(search)
        )
      : active;

    return filtered.map((bill) => {
      const dateInBand = computeDateInBand(bill.dueDay, band.startDate, band.endDate);
      return {
        ...bill,
        dateInBand,
        isInBand: dateInBand !== null,
      };
    });
  }, [fixedBills, band, searchTerm]);

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
      // Use computed date if in band, otherwise use band start
      const date = bill.dateInBand || band.startDate;
      
      return {
        id: uuidv4(),
        date,
        owner: bill.owner,
        source: bill.vendor,
        fromBaseId: bill.fromBaseId,
        amount: bill.defaultAmount,
        category: bill.category,
        notes: bill.notes || undefined,
        executed: false,
      };
    });

    onInsert(rows);
    toast.success(`Inserted ${rows.length} bill(s)`);
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
              Manage Library
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
                        : "No active bills in library. Manage library to add bills."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedBillIds.has(bill.id)}
                          onCheckedChange={() => handleToggleSelect(bill.id)}
                        />
                      </TableCell>
                      <TableCell>{getDisplayValue(bill.owner)}</TableCell>
                      <TableCell className="font-medium">{getDisplayValue(bill.vendor)}</TableCell>
                      <TableCell>
                        {bases.find((b) => b.id === bill.fromBaseId)?.name || "Unknown"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(bill.defaultAmount)}</TableCell>
                      <TableCell>{bill.dueDay === 'Last' ? 'Last Day' : bill.dueDay}</TableCell>
                      <TableCell>
                        {bill.isInBand ? (
                          <span>{formatDate(bill.dateInBand!)}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Not in band
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{getDisplayValue(bill.category, "-")}</TableCell>
                      <TableCell>{bill.autopay ? "✓" : "-"}</TableCell>
                    </TableRow>
                  ))
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
