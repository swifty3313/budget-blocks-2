import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import type { FixedBill } from "@/types";
import { getDisplayValue } from "@/lib/displayUtils";

interface ManageFixedBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageFixedBillsDialog({ open, onOpenChange }: ManageFixedBillsDialogProps) {
  const fixedBills = useStore((state) => state.fixedBills);
  const bases = useStore((state) => state.bases);
  const owners = useStore((state) => state.owners);
  const vendors = useStore((state) => state.vendors);
  const categories = useStore((state) => state.categories);
  const addFixedBill = useStore((state) => state.addFixedBill);
  const updateFixedBill = useStore((state) => state.updateFixedBill);
  const deleteFixedBill = useStore((state) => state.deleteFixedBill);
  const addToMasterList = useStore((state) => state.addToMasterList);

  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state for new bill
  const [newBill, setNewBill] = useState({
    owner: "",
    vendor: "",
    fromBaseId: "",
    defaultAmount: 0,
    category: "",
    dueDay: 1 as number | 'Last',
    autopay: false,
    notes: "",
    active: true,
  });

  // Filter bills by search term
  const filteredBills = useMemo(() => {
    if (!searchTerm) return fixedBills;
    const search = searchTerm.toLowerCase();
    return fixedBills.filter(
      (bill) =>
        bill.owner.toLowerCase().includes(search) ||
        bill.vendor.toLowerCase().includes(search) ||
        bill.category?.toLowerCase().includes(search)
    );
  }, [fixedBills, searchTerm]);

  // Sort bills by active status, then by vendor name
  const sortedBills = useMemo(() => {
    return [...filteredBills].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.vendor.localeCompare(b.vendor);
    });
  }, [filteredBills]);

  const handleAddBill = () => {
    if (!newBill.owner || !newBill.vendor || !newBill.fromBaseId) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Add to master lists if new
    if (!owners.includes(newBill.owner)) {
      addToMasterList('owners', newBill.owner);
    }
    if (!vendors.includes(newBill.vendor)) {
      addToMasterList('vendors', newBill.vendor);
    }
    if (newBill.category && !categories.includes(newBill.category)) {
      addToMasterList('categories', newBill.category);
    }

    addFixedBill(newBill);
    toast.success("Fixed bill added");
    
    // Reset form
    setNewBill({
      owner: "",
      vendor: "",
      fromBaseId: "",
      defaultAmount: 0,
      category: "",
      dueDay: 1,
      autopay: false,
      notes: "",
      active: true,
    });
    setShowAddForm(false);
  };

  const handleDeleteBill = (id: string) => {
    deleteFixedBill(id);
    toast.success("Fixed bill deleted");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const dueDayOptions = [
    ...Array.from({ length: 31 }, (_, i) => i + 1),
    'Last'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Fixed Bills Library</DialogTitle>
          <DialogDescription>
            Create and manage bill templates. Use the picker to insert bills into specific bands.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Add */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by owner, vendor, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Bill
            </Button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <h3 className="font-semibold">New Fixed Bill</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Owner *</Label>
                  <Select value={newBill.owner} onValueChange={(v) => setNewBill({ ...newBill, owner: v })}>
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

                <div>
                  <Label>Vendor/Source *</Label>
                  <Input
                    value={newBill.vendor}
                    onChange={(e) => setNewBill({ ...newBill, vendor: e.target.value })}
                    placeholder="e.g., Electric Company"
                  />
                </div>

                <div>
                  <Label>From Base *</Label>
                  <Select value={newBill.fromBaseId} onValueChange={(v) => setNewBill({ ...newBill, fromBaseId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select base" />
                    </SelectTrigger>
                    <SelectContent>
                      {bases.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Default Amount</Label>
                  <Input
                    type="number"
                    value={newBill.defaultAmount}
                    onChange={(e) => setNewBill({ ...newBill, defaultAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Due Day</Label>
                  <Select
                    value={String(newBill.dueDay)}
                    onValueChange={(v) => setNewBill({ ...newBill, dueDay: v === 'Last' ? 'Last' : parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dueDayOptions.map((day) => (
                        <SelectItem key={String(day)} value={String(day)}>
                          {day === 'Last' ? 'Last Day' : day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Category</Label>
                  <Select value={newBill.category} onValueChange={(v) => setNewBill({ ...newBill, category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newBill.notes}
                    onChange={(e) => setNewBill({ ...newBill, notes: e.target.value })}
                    placeholder="Optional notes"
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autopay-new"
                    checked={newBill.autopay}
                    onCheckedChange={(checked) => setNewBill({ ...newBill, autopay: checked === true })}
                  />
                  <Label htmlFor="autopay-new" className="cursor-pointer">Autopay</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active-new"
                    checked={newBill.active}
                    onCheckedChange={(checked) => setNewBill({ ...newBill, active: checked === true })}
                  />
                  <Label htmlFor="active-new" className="cursor-pointer">Active</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddBill}>Add Bill</Button>
                <Button variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Bills Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>From Base</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Due Day</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Autopay</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "No bills match your search" : "No bills yet. Add your first bill above."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedBills.map((bill) => (
                    <TableRow key={bill.id} className={!bill.active ? "opacity-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={bill.active}
                          onCheckedChange={(checked) =>
                            updateFixedBill(bill.id, { active: checked === true })
                          }
                        />
                      </TableCell>
                      <TableCell>{getDisplayValue(bill.owner)}</TableCell>
                      <TableCell className="font-medium">{getDisplayValue(bill.vendor)}</TableCell>
                      <TableCell>
                        {bases.find((b) => b.id === bill.fromBaseId)?.name || "Unknown"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(bill.defaultAmount)}</TableCell>
                      <TableCell>{bill.dueDay === 'Last' ? 'Last Day' : bill.dueDay}</TableCell>
                      <TableCell className="text-muted-foreground">{getDisplayValue(bill.category, "-")}</TableCell>
                      <TableCell>{bill.autopay ? "✓" : "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBill(bill.id)}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
