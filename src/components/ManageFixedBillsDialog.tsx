import { useState, useMemo, useEffect } from "react";
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
import { Plus, Trash2, Search, Undo } from "lucide-react";
import { getDisplayValue } from "@/lib/displayUtils";
import { billsLibrary, type BillItem } from "@/lib/billsLibrary";

interface ManageFixedBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageFixedBillsDialog({ open, onOpenChange }: ManageFixedBillsDialogProps) {
  const bases = useStore((state) => state.bases);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);
  const addToMasterList = useStore((state) => state.addToMasterList);

  const [bills, setBills] = useState<BillItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBill, setEditingBill] = useState<BillItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    ownerId: "",
    vendor: "",
    fromBaseId: "",
    defaultAmount: 0,
    defaultCategoryId: "",
    dueDay: 1 as number | 'Last',
    autopay: false,
    notes: "",
  });

  // Load bills from library
  useEffect(() => {
    if (open) {
      setBills(billsLibrary.all());
    }
  }, [open, refreshKey]);

  // Filter bills by search term
  const filteredBills = useMemo(() => {
    if (!searchTerm) return bills;
    const search = searchTerm.toLowerCase();
    return bills.filter(
      (bill) => {
        const owner = owners.find(o => o === bill.ownerId) || bill.ownerId;
        const category = categories.find(c => c === bill.defaultCategoryId) || bill.defaultCategoryId || '';
        return owner.toLowerCase().includes(search) ||
          bill.vendor.toLowerCase().includes(search) ||
          category.toLowerCase().includes(search);
      }
    );
  }, [bills, searchTerm, owners, categories]);

  // Sort bills by active status, then by vendor name
  const sortedBills = useMemo(() => {
    return [...filteredBills].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.vendor.localeCompare(b.vendor);
    });
  }, [filteredBills]);

  const resetForm = () => {
    setFormData({
      ownerId: "",
      vendor: "",
      fromBaseId: "",
      defaultAmount: 0,
      defaultCategoryId: "",
      dueDay: 1,
      autopay: false,
      notes: "",
    });
    setEditingBill(null);
    setShowAddForm(false);
  };

  const handleSaveBill = () => {
    if (!formData.ownerId || !formData.vendor || !formData.fromBaseId) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Add to master lists if new
    if (!owners.includes(formData.ownerId)) {
      addToMasterList('owners', formData.ownerId);
    }
    if (formData.defaultCategoryId && !categories.includes(formData.defaultCategoryId)) {
      addToMasterList('categories', formData.defaultCategoryId);
    }

    const saved = billsLibrary.upsert({
      id: editingBill?.id,
      ...formData,
      active: true,
    });

    toast.success(editingBill ? "Bill updated" : "Bill added");
    resetForm();
    setRefreshKey(k => k + 1);
  };

  const handleEditBill = (bill: BillItem) => {
    setEditingBill(bill);
    setFormData({
      ownerId: bill.ownerId,
      vendor: bill.vendor,
      fromBaseId: bill.fromBaseId || "",
      defaultAmount: bill.defaultAmount,
      defaultCategoryId: bill.defaultCategoryId || "",
      dueDay: bill.dueDay,
      autopay: bill.autopay || false,
      notes: bill.notes || "",
    });
    setShowAddForm(true);
  };

  const handleDeleteBill = (id: string, vendor: string) => {
    billsLibrary.softDelete(id);
    setRefreshKey(k => k + 1);
    
    toast.success(
      <div className="flex items-center justify-between w-full gap-4">
        <span>Deleted bill: {vendor}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            billsLibrary.restore(id);
            setRefreshKey(k => k + 1);
            toast.success('Bill restored');
            toast.dismiss();
          }}
        >
          <Undo className="w-3 h-3 mr-1" />
          Undo
        </Button>
      </div>,
      { duration: 7000, closeButton: true }
    );
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
          <DialogTitle>Manage Bills</DialogTitle>
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

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <h3 className="font-semibold">{editingBill ? 'Edit Bill' : 'New Bill'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Owner *</Label>
                  <Select value={formData.ownerId} onValueChange={(v) => setFormData({ ...formData, ownerId: v })}>
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
                  <Label>Vendor *</Label>
                  <Input
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    placeholder="e.g., Electric Company"
                  />
                </div>

                <div>
                  <Label>From Base *</Label>
                  <Select value={formData.fromBaseId} onValueChange={(v) => setFormData({ ...formData, fromBaseId: v })}>
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
                  <Label>Default Amount *</Label>
                  <Input
                    type="number"
                    value={formData.defaultAmount}
                    onChange={(e) => setFormData({ ...formData, defaultAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Due Day *</Label>
                  <Select
                    value={String(formData.dueDay)}
                    onValueChange={(v) => setFormData({ ...formData, dueDay: v === 'Last' ? 'Last' : parseInt(v) })}
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
                  <Select value={formData.defaultCategoryId} onValueChange={(v) => setFormData({ ...formData, defaultCategoryId: v })}>
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
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autopay"
                    checked={formData.autopay}
                    onCheckedChange={(checked) => setFormData({ ...formData, autopay: checked === true })}
                  />
                  <Label htmlFor="autopay" className="cursor-pointer">Autopay</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveBill}>{editingBill ? 'Save Changes' : 'Add Bill'}</Button>
                <Button variant="ghost" onClick={resetForm}>Cancel</Button>
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
                  sortedBills.map((bill) => {
                    const ownerName = owners.find(o => o === bill.ownerId) || bill.ownerId;
                    const baseName = bases.find((b) => b.id === bill.fromBaseId)?.name || "Unknown";
                    const categoryName = bill.defaultCategoryId 
                      ? (categories.find(c => c === bill.defaultCategoryId) || bill.defaultCategoryId)
                      : "-";
                    
                    return (
                      <TableRow key={bill.id}>
                        <TableCell>
                          <Checkbox
                            checked={bill.active}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                billsLibrary.restore(bill.id);
                              } else {
                                billsLibrary.softDelete(bill.id);
                              }
                              setRefreshKey(k => k + 1);
                            }}
                          />
                        </TableCell>
                        <TableCell>{getDisplayValue(ownerName)}</TableCell>
                        <TableCell className="font-medium">{getDisplayValue(bill.vendor)}</TableCell>
                        <TableCell>{baseName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(bill.defaultAmount)}</TableCell>
                        <TableCell>{bill.dueDay === 'Last' ? 'Last Day' : bill.dueDay}</TableCell>
                        <TableCell className="text-muted-foreground">{categoryName}</TableCell>
                        <TableCell>{bill.autopay ? "✓" : "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditBill(bill)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBill(bill.id, bill.vendor)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
