import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Block, Row } from "@/types";

interface ManageBlockDialogProps {
  block: Block | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (block: Block) => void;
}

export function ManageBlockDialog({ block, open, onOpenChange, onDelete }: ManageBlockDialogProps) {
  const updateBlock = useStore((state) => state.updateBlock);
  const bases = useStore((state) => state.bases);
  const library = useStore((state) => state.library);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);
  const vendors = useStore((state) => state.vendors);
  const flowTypes = useStore((state) => state.flowTypes);
  const addToMasterList = useStore((state) => state.addToMasterList);
  const executeRow = useStore((state) => state.executeRow);
  const undoExecuteRow = useStore((state) => state.undoExecuteRow);

  const [rows, setRows] = useState<Row[]>([]);
  const [updateTemplate, setUpdateTemplate] = useState(false);

  useEffect(() => {
    if (block && open) {
      setRows(block.rows.map(row => ({ ...row })));
      setUpdateTemplate(false);
    }
  }, [block, open]);

  if (!block) return null;

  const blockType = block.type;

  const handleAddToMasterList = (type: 'owners' | 'categories' | 'vendors' | 'flowTypes', value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    addToMasterList(type, trimmed);
    return true;
  };

  const addRow = () => {
    const newRow: Row = {
      id: uuidv4(),
      date: block.date,
      owner: owners[0] || '',
      amount: 0,
      executed: false,
      source: '',
      fromBaseId: '',
      toBaseId: '',
      category: '',
      type: '',
      notes: '',
    };
    setRows([...rows, newRow]);
  };

  const deleteRow = (id: string) => {
    const row = rows.find(r => r.id === id);
    if (row?.executed) {
      toast.error("Cannot delete an executed row. Un-execute it first.");
      return;
    }
    setRows(rows.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, updates: Partial<Row>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        
        // Prevent editing critical fields if executed
        if (row.executed) {
          const protectedFields = ['amount', 'fromBaseId', 'toBaseId'];
          const hasProtectedChange = protectedFields.some(field => field in updates && updates[field as keyof Row] !== row[field as keyof Row]);
          
          if (hasProtectedChange) {
            toast.error("Un-execute this row to edit Amount or From/To Base.");
            return row;
          }
        }
        
        return { ...row, ...updates };
      })
    );
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
    // Validation
    if (rows.length === 0) {
      toast.error("Block must have at least one row");
      return;
    }

    for (const row of rows) {
      if (!row.owner?.trim()) {
        toast.error("All rows must have an owner");
        return;
      }
      if (row.amount <= 0) {
        toast.error("All rows must have a positive amount");
        return;
      }
      if (blockType === 'Income') {
        if (!row.toBaseId) {
          toast.error("Income rows must have a destination (To Base)");
          return;
        }
      }
      if (blockType === 'Fixed Bill') {
        if (!row.fromBaseId) {
          toast.error("Fixed Bill rows must have a source (From Base)");
          return;
        }
      }
      if (blockType === 'Flow') {
        if (!row.fromBaseId) {
          toast.error("Flow rows must have a source (From Base)");
          return;
        }
        if (!row.type?.trim()) {
          toast.error("Flow rows must have a type (Transfer, Payment, etc.)");
          return;
        }
        if (!row.category?.trim()) {
          toast.error("Flow rows must have a category");
          return;
        }
      }
    }

    // Update the block instance
    updateBlock(block.id, { rows });

    // Update template if requested
    if (updateTemplate && block.isTemplate === false) {
      const template = library.find(t => t.title === block.title && t.type === block.type);
      if (template) {
        updateBlock(template.id, { rows });
        toast.success("Block instance and template updated");
      } else {
        toast.success("Block instance updated");
      }
    } else {
      toast.success("Block instance updated");
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Block Instance: {block.title}</DialogTitle>
          <DialogDescription>
            Editing ledger block instance • {blockType} • {format(block.date, 'MMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rows Table */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium text-xs">Owner *</th>
                  <th className="text-left p-2 font-medium text-xs">
                    {blockType === 'Income' ? 'Source' : 
                     blockType === 'Fixed Bill' ? 'Vendor' : 
                     'Source/Desc'}
                  </th>
                  {(blockType === 'Fixed Bill' || blockType === 'Flow') && (
                    <th className="text-left p-2 font-medium text-xs">From Base *</th>
                  )}
                  {(blockType === 'Income' || blockType === 'Flow') && (
                    <th className="text-left p-2 font-medium text-xs">
                      To Base {blockType === 'Income' ? '*' : ''}
                    </th>
                  )}
                  <th className="text-left p-2 font-medium text-xs">Amount *</th>
                  {blockType === 'Flow' && <th className="text-left p-2 font-medium text-xs">Type *</th>}
                  <th className="text-left p-2 font-medium text-xs">
                    Category {blockType === 'Flow' ? '*' : ''}
                  </th>
                  <th className="text-left p-2 font-medium text-xs">Date *</th>
                  <th className="text-left p-2 font-medium text-xs">Notes</th>
                  <th className="text-left p-2 font-medium text-xs">Execute</th>
                  <th className="text-left p-2 font-medium text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    {/* Owner */}
                    <td className="p-2">
                      <Select
                        value={row.owner || ""}
                        onValueChange={(value) => {
                          if (value === "__ADD_NEW__") {
                            const newOwner = prompt("Enter new owner:");
                            if (newOwner && handleAddToMasterList('owners', newOwner)) {
                              updateRow(row.id, { owner: newOwner.trim() });
                            }
                          } else {
                            updateRow(row.id, { owner: value });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs min-w-[100px]">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {owners.map((owner) => (
                            <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                          ))}
                          <SelectItem value="__ADD_NEW__">
                            <Plus className="w-3 h-3 inline mr-1" />
                            Add new...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Source/Vendor */}
                    <td className="p-2">
                      <Input
                        value={row.source || ""}
                        onChange={(e) => updateRow(row.id, { source: e.target.value })}
                        placeholder={
                          blockType === 'Income' ? "Source" :
                          blockType === 'Fixed Bill' ? "Vendor" :
                          "Description"
                        }
                        className="h-8 text-xs min-w-[120px]"
                      />
                    </td>

                    {/* From Base (Fixed Bill & Flow) */}
                    {(blockType === 'Fixed Bill' || blockType === 'Flow') && (
                      <td className="p-2">
                        <Select
                          value={row.fromBaseId || ""}
                          onValueChange={(value) => updateRow(row.id, { fromBaseId: value })}
                          disabled={row.executed}
                        >
                          <SelectTrigger className="h-8 text-xs min-w-[120px]">
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

                    {/* To Base (Income & Flow) */}
                    {(blockType === 'Income' || blockType === 'Flow') && (
                      <td className="p-2">
                        <Select
                          value={row.toBaseId || ""}
                          onValueChange={(value) => updateRow(row.id, { toBaseId: value })}
                          disabled={row.executed}
                        >
                          <SelectTrigger className="h-8 text-xs min-w-[120px]">
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

                    {/* Amount */}
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.amount || ''}
                        onChange={(e) => updateRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs w-24"
                        disabled={row.executed}
                      />
                    </td>

                    {/* Type (Flow only) */}
                    {blockType === 'Flow' && (
                      <td className="p-2">
                        <Select
                          value={row.type || ""}
                          onValueChange={(value) => {
                            if (value === "__ADD_NEW__") {
                              const newType = prompt("Enter new flow type:");
                              if (newType && handleAddToMasterList('flowTypes', newType)) {
                                updateRow(row.id, { type: newType.trim() });
                              }
                            } else {
                              updateRow(row.id, { type: value });
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs min-w-[100px]">
                            <SelectValue placeholder="Required" />
                          </SelectTrigger>
                          <SelectContent>
                            {flowTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                            <SelectItem value="__ADD_NEW__">
                              <Plus className="w-3 h-3 inline mr-1" />
                              Add new...
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )}

                    {/* Category */}
                    <td className="p-2">
                      <Select
                        value={row.category || ""}
                        onValueChange={(value) => {
                          if (value === "__ADD_NEW__") {
                            const newCategory = prompt("Enter new category:");
                            if (newCategory && handleAddToMasterList('categories', newCategory)) {
                              updateRow(row.id, { category: newCategory.trim() });
                            }
                          } else {
                            updateRow(row.id, { category: value });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs min-w-[100px]">
                          <SelectValue placeholder={blockType === 'Flow' ? "Required" : "Optional"} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                          <SelectItem value="__ADD_NEW__">
                            <Plus className="w-3 h-3 inline mr-1" />
                            Add new...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Date */}
                    <td className="p-2">
                      <Input
                        type="date"
                        value={format(row.date, 'yyyy-MM-dd')}
                        onChange={(e) => updateRow(row.id, { date: new Date(e.target.value) })}
                        className="h-8 text-xs w-32"
                      />
                    </td>

                    {/* Notes */}
                    <td className="p-2">
                      <Input
                        value={row.notes || ""}
                        onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                        placeholder="Optional"
                        className="h-8 text-xs min-w-[120px]"
                      />
                    </td>

                    {/* Execute */}
                    <td className="p-2">
                      <Checkbox
                        checked={row.executed}
                        onCheckedChange={() => handleToggleExecute(row.id)}
                      />
                    </td>

                    {/* Delete */}
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteRow(row.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="outline" onClick={addRow} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Row
          </Button>

          {/* Update Template Option */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
            <Checkbox
              id="update-template"
              checked={updateTemplate}
              onCheckedChange={(checked) => setUpdateTemplate(checked as boolean)}
            />
            <label
              htmlFor="update-template"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Also update matching template in Library (if exists)
            </label>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button 
            variant="destructive" 
            onClick={() => {
              onOpenChange(false);
              onDelete?.(block);
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Block
          </Button>
          <div className="flex gap-2">
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
  );
}
