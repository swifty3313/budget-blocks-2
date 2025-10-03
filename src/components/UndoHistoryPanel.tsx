import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Undo2, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function UndoHistoryPanel() {
  const undoHistory = useStore((state) => state.undoHistory);
  const undoDelete = useStore((state) => state.undoDelete);
  const clearUndoHistory = useStore((state) => state.clearUndoHistory);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleUndo = (historyId: string, label: string) => {
    const success = undoDelete(historyId);
    if (success) {
      toast.success(`Restored: ${label}`);
    } else {
      toast.error("Couldn't undo. This item was permanently removed.");
    }
  };

  const handleClearAll = () => {
    if (undoHistory.length === 0) return;
    
    if (confirm(`Clear all ${undoHistory.length} items from undo history? This cannot be undone.`)) {
      clearUndoHistory();
      toast.success("Undo history cleared");
    }
  };

  const getEntityTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      block: "Block",
      row: "Transaction",
      base: "Base",
      band: "Pay Period",
      template: "Template",
      schedule: "Schedule",
      "fixed-bill": "Fixed Bill",
      owner: "Owner",
      category: "Category",
    };
    return labels[type] || type;
  };

  const getEntityTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "block":
      case "template":
        return "default";
      case "base":
      case "band":
        return "secondary";
      case "row":
      case "fixed-bill":
        return "outline";
      default:
        return "outline";
    }
  };

  if (undoHistory.length === 0) {
    return (
      <Alert>
        <History className="h-4 w-4" />
        <AlertDescription>
          No undo history available. When you delete items, they'll appear here for quick restoration.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {undoHistory.length} item{undoHistory.length !== 1 ? 's' : ''} in undo history
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClearAll}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </Button>
      </div>

      <ScrollArea className="h-[400px] rounded-md border p-4">
        <div className="space-y-2">
          {undoHistory
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <History className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getEntityTypeBadgeVariant(item.entity.type)}>
                      {getEntityTypeLabel(item.entity.type)}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {item.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deleted {format(item.timestamp, 'MMM d, yyyy • h:mm a')}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant={hoveredId === item.id ? "default" : "ghost"}
                  onClick={() => handleUndo(item.id, item.label)}
                >
                  <Undo2 className="w-4 h-4 mr-2" />
                  Restore
                </Button>
              </div>
            ))}
        </div>
      </ScrollArea>

      <Alert>
        <AlertDescription className="text-xs">
          Undo history is stored in your browser and will be cleared when you close the app or clear browser data.
        </AlertDescription>
      </Alert>
    </div>
  );
}
