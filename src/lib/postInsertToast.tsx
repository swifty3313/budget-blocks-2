import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Block, BlockType } from "@/types";

interface PostInsertToastOptions {
  block: Block;
  blockType: BlockType;
  blockTitle: string;
  onSaveAsTemplate: () => void;
  onDontOfferAgain: () => void;
}

export function showPostInsertToast({ block, blockType, blockTitle, onSaveAsTemplate, onDontOfferAgain }: PostInsertToastOptions) {
  toast.success(
    <div className="flex flex-col gap-2 w-full">
      <div className="font-semibold">Saved '{blockTitle}' to the ledger.</div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSaveAsTemplate();
            toast.dismiss();
          }}
        >
          Save as Template
        </Button>
        <button
          className="text-xs text-muted-foreground hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onDontOfferAgain();
            toast.dismiss();
          }}
        >
          Don't offer this again for {blockType}
        </button>
      </div>
    </div>,
    {
      duration: 8000,
      closeButton: true,
    }
  );
}
