import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type DeleteableType = 'block' | 'row' | 'base' | 'band' | 'template' | 'schedule' | 'fixed-bill';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  type: DeleteableType;
  contextInfo?: string;
}

const DIALOG_CONFIG: Record<DeleteableType, { title: string; body: string }> = {
  block: {
    title: 'Delete this block?',
    body: 'This removes the block and all its rows from this pay period.',
  },
  row: {
    title: 'Delete this row?',
    body: 'This removes the selected transaction from this block.',
  },
  base: {
    title: 'Delete this base?',
    body: 'This removes the base from your list. (No ledger rows are deleted.)',
  },
  band: {
    title: 'Delete this pay period band?',
    body: 'This removes the band and any blocks inside it.',
  },
  template: {
    title: 'Delete this template?',
    body: 'This removes the template from your library.',
  },
  schedule: {
    title: 'Delete this schedule?',
    body: 'This removes the schedule from your list.',
  },
  'fixed-bill': {
    title: 'Delete this fixed bill?',
    body: 'This removes the bill from your library.',
  },
};

export function DeleteConfirmDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  type,
  contextInfo 
}: DeleteConfirmDialogProps) {
  const config = DIALOG_CONFIG[type];

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {config.body}
            {contextInfo && (
              <span className="block mt-2 font-medium text-foreground">{contextInfo}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            autoFocus
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
