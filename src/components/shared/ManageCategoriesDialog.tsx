import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStore } from "@/lib/store";
import { GripVertical, MoreVertical, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { showUndoToast } from "@/lib/undoToast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ManageCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e'
];

interface SortableCategoryRowProps {
  categoryId: string;
  name: string;
  color: string;
  usageCount: number;
  onRename: (id: string, newName: string) => void;
  onColorChange: (id: string, color: string) => void;
  onDelete: (id: string) => void;
}

function SortableCategoryRow({ categoryId, name, color, usageCount, onRename, onColorChange, onDelete }: SortableCategoryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: categoryId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveRename = () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Category name cannot be empty");
      return;
    }
    onRename(categoryId, trimmed);
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-6 h-6 rounded-full border-2 border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
            title="Change color"
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="grid grid-cols-6 gap-2">
            {DEFAULT_COLORS.map(c => (
              <button
                key={c}
                className="w-8 h-8 rounded-full border-2 border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => onColorChange(categoryId, c)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {isEditing ? (
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSaveRename();
            } else if (e.key === 'Escape') {
              setEditName(name);
              setIsEditing(false);
            }
          }}
          onBlur={handleSaveRename}
          className="flex-1 h-8"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="flex-1 text-left text-sm font-medium hover:text-primary transition-colors"
        >
          {name}
        </button>
      )}

      <span className="text-xs text-muted-foreground">
        {usageCount} {usageCount === 1 ? 'use' : 'uses'}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(categoryId)}
            className="text-destructive focus:text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ManageCategoriesDialog({ open, onOpenChange }: ManageCategoriesDialogProps) {
  const categories = useStore((state) => state.categoryEntities);
  const blocks = useStore((state) => state.blocks);
  const library = useStore((state) => state.library);
  const addCategory = useStore((state) => state.addCategory);
  const updateCategory = useStore((state) => state.updateCategory);
  const deleteCategory = useStore((state) => state.deleteCategory);
  const reorderCategories = useStore((state) => state.reorderCategories);

  const [searchQuery, setSearchQuery] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [reassignOption, setReassignOption] = useState<'reassign' | 'clear'>('clear');
  const [reassignToId, setReassignToId] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate usage counts
  const usageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Count in blocks
    blocks.forEach(block => {
      block.rows.forEach(row => {
        if (row.category) {
          counts[row.category] = (counts[row.category] || 0) + 1;
        }
      });
    });

    // Count in templates
    library.forEach(template => {
      template.rows.forEach(row => {
        if (row.category) {
          counts[row.category] = (counts[row.category] || 0) + 1;
        }
      });
    });

    return counts;
  }, [blocks, library]);

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    return categories
      .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [categories, searchQuery]);

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.error("Category name cannot be empty");
      return;
    }

    const exists = categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }

    addCategory(trimmed);
    toast.success(`Added category "${trimmed}"`);
    setNewCategoryName("");
  };

  const handleRename = (id: string, newName: string) => {
    const exists = categories.some(c => c.id !== id && c.name.toLowerCase() === newName.toLowerCase());
    if (exists) {
      toast.error(`"${newName}" already exists`);
      return;
    }

    updateCategory(id, { name: newName });
    toast.success("Category renamed");
  };

  const handleColorChange = (id: string, color: string) => {
    updateCategory(id, { color });
  };

  const handleDeleteClick = (id: string) => {
    const usageCount = usageCounts[id] || 0;
    
    if (usageCount > 0) {
      setDeleteTargetId(id);
      setReassignOption('clear');
      setReassignToId("");
      setShowDeleteConfirm(true);
    } else {
      // No usage, delete immediately
      const historyId = deleteCategory(id, undefined);
      const category = categories.find(c => c.id === id);
      showUndoToast('category' as any, historyId, category?.name);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;
    
    if (reassignOption === 'reassign' && !reassignToId) {
      toast.error("Please select a category to reassign to");
      return;
    }

    const historyId = deleteCategory(
      deleteTargetId,
      reassignOption === 'reassign' ? reassignToId : null
    );
    const category = categories.find(c => c.id === deleteTargetId);
    showUndoToast('category' as any, historyId, category?.name);
    
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
    setReassignToId("");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredCategories.findIndex(c => c.id === active.id);
    const newIndex = filteredCategories.findIndex(c => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...filteredCategories];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    reorderCategories(reordered.map(c => c.id));
  };

  const deleteTarget = deleteTargetId ? categories.find(c => c.id === deleteTargetId) : null;
  const deleteUsageCount = deleteTargetId ? (usageCounts[deleteTargetId] || 0) : 0;
  const reassignOptions = categories.filter(c => c.id !== deleteTargetId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category list */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredCategories.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {filteredCategories.map(category => (
                      <SortableCategoryRow
                        key={category.id}
                        categoryId={category.id}
                        name={category.name}
                        color={category.color}
                        usageCount={usageCounts[category.id] || 0}
                        onRename={handleRename}
                        onColorChange={handleColorChange}
                        onDelete={handleDeleteClick}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {filteredCategories.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No categories found
                </div>
              )}
            </ScrollArea>

            {/* Add new category */}
            <div className="flex gap-2 pt-2 border-t">
              <Input
                placeholder="New category name..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <Button onClick={handleAddCategory} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation with reassignment or clear */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this category?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will affect {deleteUsageCount} row{deleteUsageCount !== 1 ? 's' : ''}.
              {deleteTarget && <span className="block mt-2 font-medium text-foreground">Category: {deleteTarget.name}</span>}
            </p>
            <div className="space-y-3">
              <label className="text-sm font-medium">Choose action *</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reassign"
                    checked={reassignOption === 'clear'}
                    onChange={() => setReassignOption('clear')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Clear category (set to none)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reassign"
                    checked={reassignOption === 'reassign'}
                    onChange={() => setReassignOption('reassign')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Reassign to another category</span>
                </label>
              </div>
              
              {reassignOption === 'reassign' && (
                <Select value={reassignToId} onValueChange={setReassignToId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {reassignOptions.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={reassignOption === 'reassign' && !reassignToId}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
