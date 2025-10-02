import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Library, Plus, Copy } from "lucide-react";
import { format } from "date-fns";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { showUndoToast } from "@/lib/undoToast";
import { useState } from "react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

const getBlockTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    'Income': 'bg-success/10 text-success border-success/20',
    'Fixed Bill': 'bg-warning/10 text-warning border-warning/20',
    'Flow': 'bg-accent/10 text-accent border-accent/20',
  };
  return colors[type] || 'bg-muted text-muted-foreground';
};

export function BlockLibraryPanel() {
  const library = useStore((state) => state.library);
  const addBlock = useStore((state) => state.addBlock);
  const removeFromLibrary = useStore((state) => state.removeFromLibrary);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleInsertTemplate = (template: any) => {
    // Create a new block instance from the template
    addBlock({
      ...template,
      isTemplate: false,
      date: new Date(), // Use current date, will be assigned to band
    });
  };

  const handleDeleteTemplate = () => {
    if (!templateToDelete) return;
    
    const template = library.find(t => t.id === templateToDelete);
    const historyId = removeFromLibrary(templateToDelete);
    
    setShowDeleteConfirm(false);
    setTemplateToDelete(null);
    
    showUndoToast('template', historyId, template?.title);
  };

  if (library.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Block Library</h2>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Library className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              No templates saved yet. Create blocks and save them to your library for quick reuse.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Block Library</h2>
        <p className="text-sm text-muted-foreground">{library.length} templates</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {library.map((template) => {
          const total = template.rows.reduce((sum, row) => sum + row.amount, 0);

          return (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{template.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getBlockTypeColor(template.type)}>
                        {template.type}
                      </Badge>
                      {template.recurrence && (
                        <Badge variant="outline" className="text-xs">
                          {template.recurrence.frequency}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-xl font-bold">{formatCurrency(total)}</span>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Owners: {[...new Set(template.rows.map(r => r.owner))].join(', ')}</p>
                  <p>{template.rows.length} transaction(s)</p>
                  {template.recurrence && (
                    <p className="mt-1">
                      Recurs: {format(template.recurrence.startDate, 'MMM d, yyyy')}
                      {template.recurrence.endDate && ` - ${format(template.recurrence.endDate, 'MMM d, yyyy')}`}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleInsertTemplate(template)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Insert
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTemplateToDelete(template.id);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteTemplate}
        type="template"
        contextInfo={library.find(t => t.id === templateToDelete)?.title}
      />
    </div>
  );
}
