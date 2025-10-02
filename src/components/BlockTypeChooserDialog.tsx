import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DollarSign, Receipt, ArrowLeftRight, ShoppingCart } from "lucide-react";
import type { BlockType } from "@/types";

interface BlockTypeChooserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: BlockType | 'Transaction') => void;
  bandTitle?: string;
}

export function BlockTypeChooserDialog({ 
  open, 
  onOpenChange, 
  onSelectType,
  bandTitle 
}: BlockTypeChooserDialogProps) {
  const blockTypes = [
    {
      type: 'Income' as const,
      icon: DollarSign,
      title: 'Add Income Block',
      description: 'Track expected income sources',
      color: 'text-success',
      bgColor: 'bg-success/10 hover:bg-success/20',
    },
    {
      type: 'Fixed Bill' as const,
      icon: Receipt,
      title: 'Add Fixed Block',
      description: 'Manage recurring bills and fixed expenses',
      color: 'text-warning',
      bgColor: 'bg-warning/10 hover:bg-warning/20',
    },
    {
      type: 'Flow' as const,
      icon: ArrowLeftRight,
      title: 'Add Flow Block',
      description: 'Allocate funds across accounts',
      color: 'text-accent',
      bgColor: 'bg-accent/10 hover:bg-accent/20',
    },
    {
      type: 'Transaction' as const,
      icon: ShoppingCart,
      title: 'Add Transaction',
      description: 'Quick one-off transaction entry',
      color: 'text-primary',
      bgColor: 'bg-primary/10 hover:bg-primary/20',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create First Block</DialogTitle>
          <DialogDescription>
            {bandTitle ? `Choose a block type for ${bandTitle}` : 'Choose a block type to get started'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {blockTypes.map(({ type, icon: Icon, title, description, color, bgColor }) => (
            <Button
              key={type}
              variant="outline"
              className={`h-auto flex-col items-start p-4 space-y-2 ${bgColor} border-2 transition-all`}
              onClick={() => {
                onSelectType(type);
                onOpenChange(false);
              }}
            >
              <div className="flex items-center gap-2 w-full">
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="font-semibold text-left">{title}</span>
              </div>
              <p className="text-xs text-muted-foreground text-left">
                {description}
              </p>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
