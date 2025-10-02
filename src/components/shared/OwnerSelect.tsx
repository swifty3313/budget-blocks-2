import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface OwnerSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function OwnerSelect({ value, onValueChange, className, placeholder = "Select owner" }: OwnerSelectProps) {
  const owners = useStore((state) => state.owners);
  const addToMasterList = useStore((state) => state.addToMasterList);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");

  const handleAddOwner = () => {
    const trimmed = newOwnerName.trim();
    if (!trimmed) {
      toast.error("Owner name cannot be empty");
      return;
    }

    // Case-insensitive duplicate check
    const exists = owners.some(o => o.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }

    addToMasterList('owners', trimmed);
    onValueChange(trimmed);
    toast.success(`Added owner "${trimmed}"`);
    setNewOwnerName("");
    setShowAddDialog(false);
  };

  return (
    <>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {owners.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
          <button
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={(e) => {
              e.preventDefault();
              setShowAddDialog(true);
            }}
          >
            <Plus className="absolute left-2 h-4 w-4" />
            Add new owner...
          </button>
        </SelectContent>
      </Select>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Owner</DialogTitle>
            <DialogDescription>
              Enter the name of the new owner
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Owner Name *</Label>
              <Input
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                placeholder="e.g., John Doe"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOwner();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddOwner}>
              Add Owner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
