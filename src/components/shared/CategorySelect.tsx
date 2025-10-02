import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { Settings } from "lucide-react";
import { ManageCategoriesDialog } from "./ManageCategoriesDialog";

interface CategorySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export function CategorySelect({ 
  value, 
  onValueChange, 
  className, 
  placeholder = "Select category",
  required = false
}: CategorySelectProps) {
  const categoryEntities = useStore((state) => state.categoryEntities);
  const [showManageDialog, setShowManageDialog] = useState(false);

  // Sort by order
  const sortedCategories = [...categoryEntities].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {sortedCategories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </div>
            </SelectItem>
          ))}
          <button
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={(e) => {
              e.preventDefault();
              setShowManageDialog(true);
            }}
          >
            <Settings className="absolute left-2 h-4 w-4" />
            Manage categories...
          </button>
        </SelectContent>
      </Select>

      <ManageCategoriesDialog
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
      />
    </>
  );
}
