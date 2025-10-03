import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { ManageBasesDialog } from "@/components/ManageBasesDialog";
import { ManagePayPeriodsDialog } from "@/components/ManagePayPeriodsDialog";
import { ManageTemplatesDialog } from "@/components/ManageTemplatesDialog";
import { ManageBillsDialog } from "@/components/ManageBillsDialog";
import { ManageOwnersDialog } from "@/components/shared/ManageOwnersDialog";
import { ManageCategoriesDialog } from "@/components/shared/ManageCategoriesDialog";
import { UndoHistoryPanel } from "@/components/UndoHistoryPanel";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<"bases" | "periods" | "templates" | "bills" | "owners" | "categories" | "data" | "history">("bases");
  
  const bases = useStore((state) => state.bases);
  const bands = useStore((state) => state.bands);
  const library = useStore((state) => state.library);
  const fixedBills = useStore((state) => state.fixedBills);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);
  const undoHistory = useStore((state) => state.undoHistory);
  const exportData = useStore((state) => state.exportData);
  const importData = useStore((state) => state.importData);
  
  const [showBasesDialog, setShowBasesDialog] = useState(false);
  const [showPeriodsDialog, setShowPeriodsDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [showBillsDialog, setShowBillsDialog] = useState(false);
  const [showOwnersDialog, setShowOwnersDialog] = useState(false);
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-blocks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully");
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          importData(json);
          toast.success("Data imported successfully");
        } catch (error) {
          toast.error("Failed to import data");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const activeBills = fixedBills.filter(b => b.active);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage all your app settings and data in one place
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="bases">
                Bases
                {bases.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {bases.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="periods">
                Pay Periods
                {bands.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {bands.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="templates">
                Templates
                {library.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {library.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="bills">
                Bills
                {activeBills.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {activeBills.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="owners">
                Owners
                {owners.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {owners.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="categories">
                Categories
                {categories.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {categories.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">
                Undo History
                {undoHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {undoHistory.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto mt-4">
              <TabsContent value="bases" className="m-0">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage your financial accounts (checking, savings, credit cards, etc.)
                  </p>
                  <Button onClick={() => setShowBasesDialog(true)}>
                    Open Bases Manager
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="periods" className="m-0">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage pay periods, schedules, and bands
                  </p>
                  <Button onClick={() => setShowPeriodsDialog(true)}>
                    Open Pay Periods Manager
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="templates" className="m-0">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage saved block templates (Income, Fixed Bills, Flow)
                  </p>
                  <Button onClick={() => setShowTemplatesDialog(true)}>
                    Open Templates Manager
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="bills" className="m-0">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage your library of expected fixed bills
                  </p>
                  <Button onClick={() => setShowBillsDialog(true)}>
                    Open Bills Manager
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="owners" className="m-0">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage owners/people associated with transactions
                  </p>
                  <Button onClick={() => setShowOwnersDialog(true)}>
                    Open Owners Manager
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="categories" className="m-0">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage transaction categories for organizing expenses
                  </p>
                  <Button onClick={() => setShowCategoriesDialog(true)}>
                    Open Categories Manager
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="history" className="m-0">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Restore recently deleted items
                  </p>
                  <UndoHistoryPanel />
                </div>
              </TabsContent>

              <TabsContent value="data" className="m-0">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Import or export all your Budget Blocks data
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleImport}>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </Button>
                    <Button variant="outline" onClick={handleExport}>
                      <Download className="w-4 h-4 mr-2" />
                      Export Data
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      <ManageBasesDialog open={showBasesDialog} onOpenChange={setShowBasesDialog} />
      <ManagePayPeriodsDialog open={showPeriodsDialog} onOpenChange={setShowPeriodsDialog} />
      <ManageTemplatesDialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog} />
      <ManageBillsDialog open={showBillsDialog} onOpenChange={setShowBillsDialog} />
      <ManageOwnersDialog open={showOwnersDialog} onOpenChange={setShowOwnersDialog} />
      <ManageCategoriesDialog open={showCategoriesDialog} onOpenChange={setShowCategoriesDialog} />
    </>
  );
}
