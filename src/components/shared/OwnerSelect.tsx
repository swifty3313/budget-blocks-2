import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { Settings } from "lucide-react";
import { ManageOwnersDialog } from "./ManageOwnersDialog";

interface OwnerSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function OwnerSelect({ value, onValueChange, className, placeholder = "Select owner" }: OwnerSelectProps) {
  const ownerEntities = useStore((state) => state.ownerEntities);
  const [showManageDialog, setShowManageDialog] = useState(false);

  // Sort by order
  const sortedOwners = [...ownerEntities].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {sortedOwners.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
          ))}
          <button
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={(e) => {
              e.preventDefault();
              setShowManageDialog(true);
            }}
          >
            <Settings className="absolute left-2 h-4 w-4" />
            Manage owners...
          </button>
        </SelectContent>
      </Select>

      <ManageOwnersDialog
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
      />
    </>
  );
}
