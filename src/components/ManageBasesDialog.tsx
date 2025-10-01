import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { Plus, Trash2, AlertTriangle, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { COLOR_PALETTE, hasGoodContrast } from "@/lib/colorUtils";
import type { Base } from "@/types";
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
  onEdit: (base: Base) => void;
  onDelete: (id: string) => void;
}

function SortableBaseItem({ base, isEditing, onEdit, onDelete }: SortableBaseItemProps) {
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
      }`}
    >
      <div className="flex items-start gap-2">
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
            onClick={() => onDelete(base.id)}
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

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {bases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No bases created yet
                </p>
              ) : (
                Object.entries(groupedBases).map(([groupType, groupBases]) => (
                  <div key={groupType} className="space-y-2">
                    {groupBasesByType && (
                      <h4 className="text-sm font-medium text-muted-foreground px-2">
                        {groupType}
                      </h4>
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
                              onEdit={handleEdit}
                              onDelete={handleDelete}
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
  );
}
