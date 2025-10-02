import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

type DeletedType = 'block' | 'row' | 'base' | 'band' | 'template' | 'schedule' | 'fixed-bill';

const DELETE_LABELS: Record<DeletedType, string> = {
  block: 'Block deleted',
  row: 'Transaction deleted',
  base: 'Base deleted',
  band: 'Pay period deleted',
  template: 'Template deleted',
  schedule: 'Schedule deleted',
  'fixed-bill': 'Fixed bill deleted',
};

export function showUndoToast(type: DeletedType, historyId: string, itemName?: string) {
  const label = DELETE_LABELS[type];
  const description = itemName ? `${label}: ${itemName}` : label;

  toast.success(
    <div className="flex items-center justify-between w-full gap-4">
      <span>{description}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          const undoDelete = useStore.getState().undoDelete;
          const success = undoDelete(historyId);
          if (success) {
            toast.success('Restored successfully');
          } else {
            toast.error("Couldn't undo. This item was permanently removed.");
          }
          toast.dismiss();
        }}
      >
        Undo
      </Button>
    </div>,
    {
      duration: 7000,
      closeButton: true,
    }
  );
}
