import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";
import { Search, Edit, Copy, Trash2, DollarSign, Receipt, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import type { Block } from "@/types";

interface ManageTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageTemplatesDialog({ open, onOpenChange }: ManageTemplatesDialogProps) {
  const library = useStore((state) => state.library);
  const removeFromLibrary = useStore((state) => state.removeFromLibrary);
  const updateTemplate = useStore((state) => state.updateTemplate);
  const duplicateTemplate = useStore((state) => state.duplicateTemplate);
  
  const [activeTab, setActiveTab] = useState<"income" | "fixed" | "flow">("income");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Filter templates by type and search
  const filteredTemplates = useMemo(() => {
    const typeMap = {
      income: 'Income',
      fixed: 'Fixed Bill',
      flow: 'Flow'
    };
    
    const byType = library.filter(t => t.type === typeMap[activeTab]);
    
    if (!searchQuery.trim()) return byType;
    
    const query = searchQuery.toLowerCase();
    return byType.filter(t => 
      t.title.toLowerCase().includes(query) ||
      t.rows.some(r => 
        r.owner?.toLowerCase().includes(query) ||
        r.source?.toLowerCase().includes(query) ||
        r.category?.toLowerCase().includes(query)
      )
    );
  }, [library, activeTab, searchQuery]);

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'Income': return DollarSign;
      case 'Fixed Bill': return Receipt;
      case 'Flow': return ArrowLeftRight;
      default: return DollarSign;
    }
  };

  const getBlockColor = (type: string) => {
    switch (type) {
      case 'Income': return 'text-success';
      case 'Fixed Bill': return 'text-warning';
      case 'Flow': return 'text-accent';
      default: return 'text-muted-foreground';
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTemplates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTemplates.map(t => t.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleDeleteSingle = (id: string) => {
    setTemplateToDelete(id);
    setShowDeleteConfirm(true);
  };

  const handleDeleteMultiple = () => {
    if (selectedIds.size === 0) {
      toast.error("No templates selected");
      return;
    }
    setTemplateToDelete(null);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (templateToDelete) {
      // Single delete
      const historyId = removeFromLibrary(templateToDelete);
      const template = library.find(t => t.id === templateToDelete);
      toast.success(`Deleted "${template?.title || 'template'}"`);
    } else {
      // Multiple delete
      selectedIds.forEach(id => removeFromLibrary(id));
      toast.success(`Deleted ${selectedIds.size} template(s)`);
      setSelectedIds(new Set());
    }
    setShowDeleteConfirm(false);
    setTemplateToDelete(null);
  };

  const handleEdit = (template: Block) => {
    toast.info("Full template editor coming soon - use rename for now");
  };

  const handleDuplicate = (template: Block) => {
    duplicateTemplate(template.id);
    toast.success(`Duplicated "${template.title}"`);
  };

  const handleStartRename = (template: Block) => {
    setRenamingId(template.id);
    setRenameValue(template.title);
  };

  const handleSaveRename = (id: string) => {
    if (!renameValue.trim()) {
      toast.error("Title cannot be empty");
      return;
    }
    updateTemplate(id, { title: renameValue.trim() });
    toast.success("Template renamed");
    setRenamingId(null);
    setRenameValue("");
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const calculateTotal = (rows: any[]) => {
    return rows.reduce((sum, r) => sum + r.amount, 0);
  };

  const incomeTemplates = library.filter(t => t.type === 'Income');
  const fixedTemplates = library.filter(t => t.type === 'Fixed Bill');
  const flowTemplates = library.filter(t => t.type === 'Flow');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Templates</DialogTitle>
            <DialogDescription>
              Edit, rename, duplicate, or delete your saved block templates
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="income">
                Income
                {incomeTemplates.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {incomeTemplates.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="fixed">
                Fixed Bills
                {fixedTemplates.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {fixedTemplates.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="flow">
                Flow
                {flowTemplates.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {flowTemplates.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="space-y-3 mt-4 flex-1 flex flex-col overflow-hidden">
              {/* Search and bulk actions */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="pl-9"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAll}
                  disabled={filteredTemplates.length === 0}
                >
                  {selectedIds.size === filteredTemplates.length ? "Deselect All" : "Select All"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteMultiple}
                  disabled={selectedIds.size === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedIds.size})
                </Button>
              </div>

              {/* Templates list */}
              <TabsContent value={activeTab} className="flex-1 overflow-auto mt-0">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No templates found" : "No templates yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTemplates.map((template) => {
                      const Icon = getBlockIcon(template.type);
                      const color = getBlockColor(template.type);
                      const isRenaming = renamingId === template.id;
                      
                      return (
                        <div
                          key={template.id}
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          {/* Checkbox */}
                          <Checkbox
                            checked={selectedIds.has(template.id)}
                            onCheckedChange={() => handleToggleSelect(template.id)}
                          />

                          {/* Icon */}
                          <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {isRenaming ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename(template.id);
                                    if (e.key === 'Escape') handleCancelRename();
                                  }}
                                  className="h-8"
                                  autoFocus
                                />
                                <Button size="sm" onClick={() => handleSaveRename(template.id)}>
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleCancelRename}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-sm truncate">{template.title}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {formatCurrency(calculateTotal(template.rows))}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {template.rows.length} row{template.rows.length !== 1 ? 's' : ''}
                                  {template.updatedAt && ` • Updated ${format(template.updatedAt, 'MMM d, yyyy')}`}
                                </p>
                              </>
                            )}
                          </div>

                          {/* Actions */}
                          {!isRenaming && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(template)}
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartRename(template)}
                                title="Rename"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDuplicate(template)}
                                title="Duplicate"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteSingle(template.id)}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={confirmDelete}
        type="template"
        contextInfo={
          templateToDelete
            ? library.find(t => t.id === templateToDelete)?.title
            : `${selectedIds.size} template(s)`
        }
      />
    </>
  );
}
