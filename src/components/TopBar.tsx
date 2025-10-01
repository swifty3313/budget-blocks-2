import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, Settings } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

interface TopBarProps {
  onNewBlock: () => void;
  onManagePeriods: () => void;
}

export function TopBar({ onNewBlock, onManagePeriods }: TopBarProps) {
  const exportData = useStore((state) => state.exportData);
  const importData = useStore((state) => state.importData);

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

  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Budget Blocks
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={onManagePeriods}>
              <Settings className="w-4 h-4 mr-2" />
              Pay Periods
            </Button>
            <Button onClick={onNewBlock}>
              <Plus className="w-4 h-4 mr-2" />
              New Block
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
