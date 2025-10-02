import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";
import { Plus, Trash2, AlertTriangle, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { COLOR_PALETTE, hasGoodContrast } from "@/lib/colorUtils";
import type { Base } from "@/types";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { showUndoToast } from "@/lib/undoToast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ManageBasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SortableBaseItemProps {
  base: Base;
  isEditing: boolean;
  isSelected: boolean;
  onEdit: (base: Base) => void;
  onDelete: () => void;
  onToggleSelect: (id: string) => void;
}

function SortableBaseItem({ base, isEditing, isSelected, onEdit, onDelete, onToggleSelect }: SortableBaseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: base.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
        isEditing ? 'ring-2 ring-primary' : ''
      } ${isSelected ? 'bg-muted' : ''}`}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(base.id)}
          className="mt-1"
        />
        <button
          className="touch-none cursor-grab active:cursor-grabbing mt-1 p-1 hover:bg-muted rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{base.name}</p>
            {base.tagColor && (
              <div
                className="w-3 h-3 rounded-full border"
                style={{ backgroundColor: base.tagColor }}
                title="Tag color"
              />
            )}
          </div>
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
            onClick={() => onEdit(base)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ManageBasesDialog({ open, onOpenChange }: ManageBasesDialogProps) {
  const bases = useStore((state) => state.bases);
  const blocks = useStore((state) => state.blocks);
  const baseTypes = useStore((state) => state.baseTypes);
  const institutions = useStore((state) => state.institutions);
  const groupBasesByType = useStore((state) => state.groupBasesByType);
  const addBase = useStore((state) => state.addBase);
  const updateBase = useStore((state) => state.updateBase);
  const deleteBase = useStore((state) => state.deleteBase);
  const reorderBases = useStore((state) => state.reorderBases);
  const toggleGroupByType = useStore((state) => state.toggleGroupByType);
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
    tagColor: "",
  });
  const [customColor, setCustomColor] = useState("");
  const [selectedBases, setSelectedBases] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteResults, setDeleteResults] = useState<{
    deletable: Base[];
    blocked: Array<{ base: Base; rowCount: number; blockCount: number }>;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [baseToDelete, setBaseToDelete] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sort bases by sortOrder, then by createdAt
  const sortedBases = useMemo(() => {
    return [...bases].sort((a, b) => {
      const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }, [bases]);

  // Group bases by type if enabled
  const groupedBases = useMemo(() => {
    if (!groupBasesByType) {
      return { 'All Bases': sortedBases };
    }

    const groups: Record<string, Base[]> = {};
    baseTypes.forEach(type => {
      groups[type] = [];
    });

    sortedBases.forEach(base => {
      if (groups[base.type]) {
        groups[base.type].push(base);
      } else {
        if (!groups['Other']) groups['Other'] = [];
        groups['Other'].push(base);
      }
    });

    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) delete groups[key];
    });

    return groups;
  }, [sortedBases, groupBasesByType, baseTypes]);

  const handleDragEnd = (event: DragEndEvent, groupType?: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    if (groupBasesByType && groupType) {
      // Reordering within a group
      const groupBases = groupedBases[groupType];
      const oldIndex = groupBases.findIndex(b => b.id === active.id);
      const newIndex = groupBases.findIndex(b => b.id === over.id);
      
      const reorderedGroup = arrayMove(groupBases, oldIndex, newIndex);
      
      // Rebuild the full order
      const newOrder: string[] = [];
      Object.entries(groupedBases).forEach(([type, bases]) => {
        if (type === groupType) {
          newOrder.push(...reorderedGroup.map(b => b.id));
        } else {
          newOrder.push(...bases.map(b => b.id));
        }
      });
      
      reorderBases(newOrder);
    } else {
      // Free-form reordering
      const oldIndex = sortedBases.findIndex(b => b.id === active.id);
      const newIndex = sortedBases.findIndex(b => b.id === over.id);
      
      const reordered = arrayMove(sortedBases, oldIndex, newIndex);
      reorderBases(reordered.map(b => b.id));
    }
  };

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
      tagColor: formData.tagColor || undefined,
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
      tagColor: "",
    });
    setCustomColor("");
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
      tagColor: base.tagColor || "",
    });
    setCustomColor(base.tagColor && !COLOR_PALETTE.find(c => c.value === base.tagColor) ? base.tagColor : "");
    setEditingId(base.id);
  };

  const handleDelete = () => {
    if (!baseToDelete) return;
    
    const base = bases.find(b => b.id === baseToDelete);
    const historyId = deleteBase(baseToDelete);
    
    if (editingId === baseToDelete) {
      resetForm();
    }
    
    setShowDeleteConfirm(false);
    setBaseToDelete(null);
    
    showUndoToast('base', historyId, base?.name);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedBases(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllInGroup = (groupBases: Base[]) => {
    setSelectedBases(prev => {
      const next = new Set(prev);
      groupBases.forEach(base => next.add(base.id));
      return next;
    });
  };

  const handleBulkDelete = () => {
    // Precheck: which bases are referenced?
    const basesToDelete = bases.filter(b => selectedBases.has(b.id));
    const deletable: Base[] = [];
    const blocked: Array<{ base: Base; rowCount: number; blockCount: number }> = [];

    basesToDelete.forEach(base => {
      // Check if any rows reference this base
      let rowCount = 0;
      const blockIds = new Set<string>();
      
      blocks.forEach(block => {
        block.rows.forEach(row => {
          if (row.fromBaseId === base.id || row.toBaseId === base.id) {
            rowCount++;
            blockIds.add(block.id);
          }
        });
      });

      if (rowCount > 0) {
        blocked.push({ base, rowCount, blockCount: blockIds.size });
      } else {
        deletable.push(base);
      }
    });

    setDeleteResults({ deletable, blocked });
    setShowDeleteDialog(true);
  };

  const handleConfirmBulkDelete = () => {
    if (!deleteResults) return;

    deleteResults.deletable.forEach(base => {
      deleteBase(base.id);
    });

    const deletedCount = deleteResults.deletable.length;
    const blockedCount = deleteResults.blocked.length;

    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} base(s)${blockedCount > 0 ? `. ${blockedCount} blocked.` : ''}`);
    } else if (blockedCount > 0) {
      toast.info(`No bases deleted. ${blockedCount} blocked by references.`);
    }

    setSelectedBases(new Set());
    setShowDeleteDialog(false);
    setDeleteResults(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Bases</DialogTitle>
            <DialogDescription>
              Create and manage your financial accounts
            </DialogDescription>
          </DialogHeader>

          {/* Bulk Actions Bar */}
          {selectedBases.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
              <span className="text-sm font-medium">{selectedBases.size} selected</span>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedBases(new Set())}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          )}

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
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => {
                    if (value === "__ADD_NEW__") {
                      const newType = prompt("Enter new base type:");
                      if (newType?.trim()) {
                        const trimmedType = newType.trim();
                        if (!baseTypes.includes(trimmedType)) {
                          addToMasterList('baseTypes', trimmedType);
                        }
                        setFormData({ ...formData, type: trimmedType });
                        toast.success("New type added");
                      }
                    } else {
                      setFormData({ ...formData, type: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {baseTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                    <SelectItem value="__ADD_NEW__">
                      <Plus className="w-3 h-3 inline mr-1" />
                      Add new...
                    </SelectItem>
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

              <div className="space-y-2">
                <Label>Type Color (optional)</Label>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`w-10 h-10 rounded-md border-2 transition-all ${
                        formData.tagColor === color.value ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => {
                        setFormData({ ...formData, tagColor: color.value });
                        setCustomColor("");
                      }}
                      title={color.name}
                    />
                  ))}
                </div>
                
                {/* Custom color input */}
                <div className="flex gap-2 items-center pt-2">
                  <Input
                    type="text"
                    placeholder="#000000"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      if (e.target.value.match(/^#[0-9A-F]{6}$/i)) {
                        setFormData({ ...formData, tagColor: e.target.value });
                      }
                    }}
                    className="flex-1"
                  />
                  {formData.tagColor && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormData({ ...formData, tagColor: "" });
                        setCustomColor("");
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Contrast warning */}
                {formData.tagColor && (() => {
                  const { isGood, ratio, suggestedColor } = hasGoodContrast(formData.tagColor, false);
                  return !isGood ? (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/20 text-xs">
                      <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Low contrast (ratio: {ratio.toFixed(2)}:1)</p>
                        <p className="text-muted-foreground">May be hard to read. Try: {suggestedColor}</p>
                        {suggestedColor && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-1"
                            onClick={() => setFormData({ ...formData, tagColor: suggestedColor })}
                          >
                            Use suggested
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : null;
                })()}
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
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Existing Bases</h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="group-by-type" className="text-sm">Group by Type</Label>
                <Switch
                  id="group-by-type"
                  checked={groupBasesByType}
                  onCheckedChange={toggleGroupByType}
                />
              </div>
            </div>

            {selectedBases.size === 0 && groupBasesByType && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const allIds = new Set<string>();
                  Object.values(groupedBases).forEach(group => {
                    group.forEach(base => allIds.add(base.id));
                  });
                  setSelectedBases(allIds);
                }}
              >
                Select All
              </Button>
            )}

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {bases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No bases created yet
                </p>
              ) : (
                Object.entries(groupedBases).map(([groupType, groupBases]) => (
                  <div key={groupType} className="space-y-2">
                    {groupBasesByType && (
                      <div className="flex items-center justify-between px-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          {groupType}
                        </h4>
                        {selectedBases.size === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelectAllInGroup(groupBases)}
                          >
                            Select all in group
                          </Button>
                        )}
                      </div>
                    )}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(event, groupType)}
                    >
                      <SortableContext
                        items={groupBases.map(b => b.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {groupBases.map((base) => (
                  <SortableBaseItem
                    key={base.id}
                    base={base}
                    isEditing={editingId === base.id}
                    isSelected={selectedBases.has(base.id)}
                    onEdit={handleEdit}
                    onDelete={() => {
                      setBaseToDelete(base.id);
                      setShowDeleteConfirm(true);
                    }}
                    onToggleSelect={handleToggleSelect}
                  />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Results Dialog */}
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Bulk Delete Results</AlertDialogTitle>
          <AlertDialogDescription>
            Review which bases can be deleted
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteResults && (
          <div className="space-y-4">
            {deleteResults.deletable.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-success">Deletable ({deleteResults.deletable.length})</h4>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {deleteResults.deletable.map(base => (
                    <div key={base.id} className="p-2 border rounded text-sm">
                      <span className="font-medium">{base.name}</span>
                      <span className="text-muted-foreground ml-2">({base.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {deleteResults.blocked.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-destructive">Blocked ({deleteResults.blocked.length})</h4>
                <p className="text-sm text-muted-foreground">
                  These bases cannot be deleted because they are referenced by rows
                </p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {deleteResults.blocked.map(({ base, rowCount, blockCount }) => (
                    <div key={base.id} className="p-3 border rounded space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{base.name}</span>
                        <span className="text-muted-foreground text-xs">({base.type})</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Referenced by {rowCount} row(s) in {blockCount} block(s)
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {deleteResults && deleteResults.deletable.length > 0 && (
            <Button variant="destructive" onClick={handleConfirmBulkDelete}>
              Delete {deleteResults.deletable.length} Base(s)
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
