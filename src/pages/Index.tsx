import { useState, useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { KPIPanel } from "@/components/KPIPanel";
import { BaseBlocksPanel } from "@/components/BaseBlocksPanel";
import { LedgerPanel } from "@/components/LedgerPanel";
import { ManagePayPeriodsDialog } from "@/components/ManagePayPeriodsDialog";
import { NewBlockDialog } from "@/components/NewBlockDialog";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { useStore } from "@/lib/store";

const Index = () => {
  const [newBlockOpen, setNewBlockOpen] = useState(false);
  const [newBlockBandId, setNewBlockBandId] = useState<string | undefined>();
  const [newBlockBandInfo, setNewBlockBandInfo] = useState<{ title: string; startDate: Date; endDate: Date } | undefined>();
  const [managePeriodsOpen, setManagePeriodsOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const bases = useStore((state) => state.bases);
  const bands = useStore((state) => state.bands);

  // Show welcome dialog if no data exists
  useEffect(() => {
    if (bases.length === 0 && bands.length === 0) {
      setWelcomeOpen(true);
    }
  }, []);

  const handleNewBlock = (bandId?: string, bandInfo?: { title: string; startDate: Date; endDate: Date }) => {
    setNewBlockBandId(bandId);
    setNewBlockBandInfo(bandInfo);
    setNewBlockOpen(true);
  };

  const handleNewBlockClose = (open: boolean) => {
    setNewBlockOpen(open);
    if (!open) {
      setNewBlockBandId(undefined);
      setNewBlockBandInfo(undefined);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar 
        onNewBlock={() => handleNewBlock()}
        onManagePeriods={() => setManagePeriodsOpen(true)}
      />
      
      <div className="container mx-auto px-4 py-8 space-y-8">
        <KPIPanel />
        <BaseBlocksPanel />
        <LedgerPanel onNewBlockInBand={handleNewBlock} />
      </div>

      <WelcomeDialog 
        open={welcomeOpen} 
        onOpenChange={setWelcomeOpen} 
      />
      <ManagePayPeriodsDialog 
        open={managePeriodsOpen} 
        onOpenChange={setManagePeriodsOpen} 
      />
      <NewBlockDialog 
        open={newBlockOpen} 
        onOpenChange={handleNewBlockClose}
        bandId={newBlockBandId}
        bandInfo={newBlockBandInfo}
      />
    </div>
  );
};

export default Index;
