import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Base } from "@/types";

interface ManageBasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageBasesDialog({ open, onOpenChange }: ManageBasesDialogProps) {
  const bases = useStore((state) => state.bases);
  const baseTypes = useStore((state) => state.baseTypes);
  const institutions = useStore((state) => state.institutions);
  const addBase = useStore((state) => state.addBase);
  const updateBase = useStore((state) => state.updateBase);
  const deleteBase = useStore((state) => state.deleteBase);
  const addToMasterList = useStore((state) => state.addToMasterList);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "Checking",
    institution: "",
    identifier: "",
    balance: "0",
    currency: "USD",
    tags: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    const baseData = {
      name: formData.name.trim(),
      type: formData.type,
      institution: formData.institution.trim() || undefined,
      identifier: formData.identifier.trim() || undefined,
      balance: parseFloat(formData.balance) || 0,
      currency: formData.currency,
      tags: formData.tags,
    };

    if (editingId) {
      updateBase(editingId, baseData);
      toast.success("Base updated");
    } else {
      addBase(baseData);
      toast.success("Base created");
    }

    // Add institution to master list if new
    if (formData.institution.trim() && !institutions.includes(formData.institution.trim())) {
      addToMasterList('institutions', formData.institution.trim());
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "Checking",
      institution: "",
      identifier: "",
      balance: "0",
      currency: "USD",
      tags: [],
    });
    setEditingId(null);
  };

  const handleEdit = (base: Base) => {
    setFormData({
      name: base.name,
      type: base.type,
      institution: base.institution || "",
      identifier: base.identifier || "",
      balance: base.balance.toString(),
      currency: base.currency,
      tags: base.tags,
    });
    setEditingId(base.id);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this base?")) {
      deleteBase(id);
      toast.success("Base deleted");
      if (editingId === id) {
        resetForm();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Bases</DialogTitle>
          <DialogDescription>
            Create and manage your financial accounts
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">{editingId ? "Edit Base" : "New Base"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Checking"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {baseTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution">Institution</Label>
                <Input
                  id="institution"
                  value={formData.institution}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  placeholder="e.g., Chase Bank"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="identifier">Identifier</Label>
                <Input
                  id="identifier"
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                  placeholder="e.g., Last 4 digits"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="balance">Balance *</Label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  <Plus className="w-4 h-4 mr-2" />
                  {editingId ? "Update" : "Create"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="space-y-4">
            <h3 className="font-semibold">Existing Bases</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {bases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No bases created yet
                </p>
              ) : (
                bases.map((base) => (
                  <div
                    key={base.id}
                    className={`p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                      editingId === base.id ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{base.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {base.type} • ${base.balance.toFixed(2)}
                        </p>
                        {base.institution && (
                          <p className="text-xs text-muted-foreground">{base.institution}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(base)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(base.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
