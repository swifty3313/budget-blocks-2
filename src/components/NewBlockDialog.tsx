import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import type { BlockType, Row } from "@/types";

interface NewBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewBlockDialog({ open, onOpenChange }: NewBlockDialogProps) {
  const bases = useStore((state) => state.bases);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);
  const vendors = useStore((state) => state.vendors);
  const addBlock = useStore((state) => state.addBlock);
  const saveToLibrary = useStore((state) => state.saveToLibrary);
  const addToMasterList = useStore((state) => state.addToMasterList);

  const [activeTab, setActiveTab] = useState<"new" | "templates">("new");
  const [blockType, setBlockType] = useState<BlockType>("Income");
  
  const [formData, setFormData] = useState({
    title: "",
    date: new Date().toISOString().split('T')[0],
    owner: "",
    source: "",
    tags: [] as string[],
  });

  const [rows, setRows] = useState<Row[]>([
    {
      id: uuidv4(),
      date: new Date(),
      owner: "",
      amount: 0,
      executed: false,
    },
  ]);

  const [newOwner, setNewOwner] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newVendor, setNewVendor] = useState("");

  const addRow = () => {
    setRows([
      ...rows,
      {
        id: uuidv4(),
        date: new Date(),
        owner: formData.owner,
        amount: 0,
        executed: false,
      },
    ]);
  };

  const updateRow = (id: string, updates: Partial<Row>) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter((r) => r.id !== id));
    }
  };

  const handleAddOwner = () => {
    if (newOwner.trim() && !owners.includes(newOwner.trim())) {
      addToMasterList('owners', newOwner.trim());
      setFormData({ ...formData, owner: newOwner.trim() });
      setNewOwner("");
      toast.success("Owner added");
    }
  };

  const handleAddCategory = (rowId: string) => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      addToMasterList('categories', newCategory.trim());
      updateRow(rowId, { category: newCategory.trim() });
      setNewCategory("");
      toast.success("Category added");
    }
  };

  const handleAddVendor = () => {
    if (newVendor.trim() && !vendors.includes(newVendor.trim())) {
      addToMasterList('vendors', newVendor.trim());
      setFormData({ ...formData, source: newVendor.trim() });
      setNewVendor("");
      toast.success("Vendor added");
    }
  };

  const handleSave = (saveToLib: boolean = false, insert: boolean = true) => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!formData.owner.trim()) {
      toast.error("Please select an owner");
      return;
    }

    if (rows.length === 0 || rows.some((r) => r.amount <= 0)) {
      toast.error("Please add at least one row with a valid amount");
      return;
    }

    const blockData = {
      type: blockType,
      title: formData.title.trim(),
      date: new Date(formData.date),
      owner: formData.owner,
      source: formData.source || undefined,
      tags: formData.tags,
      rows: rows.map((r) => ({
        ...r,
        owner: r.owner || formData.owner,
        date: new Date(formData.date),
      })),
    };

    if (insert) {
      addBlock(blockData);
      toast.success("Block created");
    }

    if (saveToLib) {
      saveToLibrary({ ...blockData, id: uuidv4(), createdAt: new Date(), updatedAt: new Date() } as any);
      toast.success("Saved to library");
    }

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      date: new Date().toISOString().split('T')[0],
      owner: "",
      source: "",
      tags: [],
    });
    setRows([
      {
        id: uuidv4(),
        date: new Date(),
        owner: "",
        amount: 0,
        executed: false,
      },
    ]);
  };

  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Block</DialogTitle>
          <DialogDescription>Create a new income, fixed bill, or flow block</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New Block</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            {/* Block Type Selection */}
            <div className="space-y-2">
              <Label>Block Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['Income', 'Fixed Bill', 'Flow'] as BlockType[]).map((type) => (
                  <Button
                    key={type}
                    variant={blockType === type ? "default" : "outline"}
                    onClick={() => setBlockType(type)}
                    className="w-full"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Common Fields */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Salary, Rent, Transfer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner">Owner *</Label>
                <div className="flex gap-2">
                  <Select value={formData.owner} onValueChange={(value) => setFormData({ ...formData, owner: value })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((owner) => (
                        <SelectItem key={owner} value={owner}>
                          {owner}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Add new"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOwner())}
                    className="w-32"
                  />
                  <Button size="sm" onClick={handleAddOwner}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {blockType === 'Fixed Bill' && (
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor/Source</Label>
                  <div className="flex gap-2">
                    <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor} value={vendor}>
                            {vendor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Add new"
                      value={newVendor}
                      onChange={(e) => setNewVendor(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVendor())}
                      className="w-32"
                    />
                    <Button size="sm" onClick={handleAddVendor}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Rows Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Transactions</Label>
                <Button size="sm" variant="outline" onClick={addRow}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Row
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {blockType === 'Income' && <th className="text-left p-2 font-medium">To Base</th>}
                      {blockType === 'Fixed Bill' && <th className="text-left p-2 font-medium">From Base</th>}
                      {blockType === 'Flow' && (
                        <>
                          <th className="text-left p-2 font-medium">From Base</th>
                          <th className="text-left p-2 font-medium">To Base</th>
                        </>
                      )}
                      <th className="text-left p-2 font-medium">Amount</th>
                      <th className="text-left p-2 font-medium">Category</th>
                      <th className="text-left p-2 font-medium">Notes</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t">
                        {blockType === 'Income' && (
                          <td className="p-2">
                            <Select
                              value={row.toBaseId || ""}
                              onValueChange={(value) => updateRow(row.id, { toBaseId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {bases.map((base) => (
                                  <SelectItem key={base.id} value={base.id}>
                                    {base.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        {blockType === 'Fixed Bill' && (
                          <td className="p-2">
                            <Select
                              value={row.fromBaseId || ""}
                              onValueChange={(value) => updateRow(row.id, { fromBaseId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {bases.map((base) => (
                                  <SelectItem key={base.id} value={base.id}>
                                    {base.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        {blockType === 'Flow' && (
                          <>
                            <td className="p-2">
                              <Select
                                value={row.fromBaseId || ""}
                                onValueChange={(value) => updateRow(row.id, { fromBaseId: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="From" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bases.map((base) => (
                                    <SelectItem key={base.id} value={base.id}>
                                      {base.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Select
                                value={row.toBaseId || ""}
                                onValueChange={(value) => updateRow(row.id, { toBaseId: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="To" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bases.map((base) => (
                                    <SelectItem key={base.id} value={base.id}>
                                      {base.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </>
                        )}
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.amount || ""}
                            onChange={(e) => updateRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                            className="w-24"
                          />
                        </td>
                        <td className="p-2">
                          <Select
                            value={row.category || ""}
                            onValueChange={(value) => updateRow(row.id, { category: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Optional" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            value={row.notes || ""}
                            onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                            placeholder="Optional"
                            className="w-32"
                          />
                        </td>
                        <td className="p-2">
                          {rows.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteRow(row.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50 font-semibold">
                    <tr>
                      <td colSpan={blockType === 'Flow' ? 3 : 2} className="p-2 text-right">
                        Total:
                      </td>
                      <td className="p-2">${total.toFixed(2)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <p className="text-sm text-muted-foreground text-center py-8">
              Template selection coming soon. For now, use the New Block tab.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleSave(true, false)}>
            Save to Library
          </Button>
          <Button variant="outline" onClick={() => handleSave(true, true)}>
            Save & Insert + Library
          </Button>
          <Button onClick={() => handleSave(false, true)}>Save & Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
