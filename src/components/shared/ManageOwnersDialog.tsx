import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStore } from "@/lib/store";
import { GripVertical, MoreVertical, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { showUndoToast } from "@/lib/undoToast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ManageOwnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SortableOwnerRowProps {
  ownerId: string;
  name: string;
  usageCount: number;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

function SortableOwnerRow({ ownerId, name, usageCount, onRename, onDelete }: SortableOwnerRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ownerId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveRename = () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Owner name cannot be empty");
      return;
    }
    onRename(ownerId, trimmed);
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
            onClick={() => onDelete(ownerId)}
            className="text-destructive focus:text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ManageOwnersDialog({ open, onOpenChange }: ManageOwnersDialogProps) {
  const owners = useStore((state) => state.ownerEntities);
  const blocks = useStore((state) => state.blocks);
  const library = useStore((state) => state.library);
  const addOwner = useStore((state) => state.addOwner);
  const updateOwner = useStore((state) => state.updateOwner);
  const deleteOwner = useStore((state) => state.deleteOwner);
  const reorderOwners = useStore((state) => state.reorderOwners);

  const [searchQuery, setSearchQuery] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
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
        if (row.owner) {
          counts[row.owner] = (counts[row.owner] || 0) + 1;
        }
      });
    });

    // Count in templates
    library.forEach(template => {
      template.rows.forEach(row => {
        if (row.owner) {
          counts[row.owner] = (counts[row.owner] || 0) + 1;
        }
      });
    });

    return counts;
  }, [blocks, library]);

  // Filter and sort owners
  const filteredOwners = useMemo(() => {
    return owners
      .filter(o => o.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [owners, searchQuery]);

  const handleAddOwner = () => {
    const trimmed = newOwnerName.trim();
    if (!trimmed) {
      toast.error("Owner name cannot be empty");
      return;
    }

    const exists = owners.some(o => o.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }

    addOwner(trimmed);
    toast.success(`Added owner "${trimmed}"`);
    setNewOwnerName("");
  };

  const handleRename = (id: string, newName: string) => {
    const exists = owners.some(o => o.id !== id && o.name.toLowerCase() === newName.toLowerCase());
    if (exists) {
      toast.error(`"${newName}" already exists`);
      return;
    }

    updateOwner(id, { name: newName });
    toast.success("Owner renamed");
  };

  const handleDeleteClick = (id: string) => {
    const usageCount = usageCounts[id] || 0;
    
    if (usageCount > 0) {
      setDeleteTargetId(id);
      setReassignToId("");
      setShowDeleteConfirm(true);
    } else {
      // No usage, delete immediately
      const historyId = deleteOwner(id, undefined);
      const owner = owners.find(o => o.id === id);
      showUndoToast('owner' as any, historyId, owner?.name);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId || !reassignToId) {
      toast.error("Please select an owner to reassign to");
      return;
    }

    const historyId = deleteOwner(deleteTargetId, reassignToId);
    const owner = owners.find(o => o.id === deleteTargetId);
    showUndoToast('owner' as any, historyId, owner?.name);
    
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
    setReassignToId("");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredOwners.findIndex(o => o.id === active.id);
    const newIndex = filteredOwners.findIndex(o => o.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...filteredOwners];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    reorderOwners(reordered.map(o => o.id));
  };

  const deleteTarget = deleteTargetId ? owners.find(o => o.id === deleteTargetId) : null;
  const deleteUsageCount = deleteTargetId ? (usageCounts[deleteTargetId] || 0) : 0;
  const reassignOptions = owners.filter(o => o.id !== deleteTargetId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Owners</DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search owners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Owner list */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredOwners.map(o => o.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {filteredOwners.map(owner => (
                      <SortableOwnerRow
                        key={owner.id}
                        ownerId={owner.id}
                        name={owner.name}
                        usageCount={usageCounts[owner.id] || 0}
                        onRename={handleRename}
                        onDelete={handleDeleteClick}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {filteredOwners.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No owners found
                </div>
              )}
            </ScrollArea>

            {/* Add new owner */}
            <div className="flex gap-2 pt-2 border-t">
              <Input
                placeholder="New owner name..."
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOwner();
                  }
                }}
              />
              <Button onClick={handleAddOwner} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation with reassignment */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this owner?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will affect {deleteUsageCount} row{deleteUsageCount !== 1 ? 's' : ''}.
              {deleteTarget && <span className="block mt-2 font-medium text-foreground">Owner: {deleteTarget.name}</span>}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reassign to *</label>
              <Select value={reassignToId} onValueChange={setReassignToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {reassignOptions.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!reassignToId}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
