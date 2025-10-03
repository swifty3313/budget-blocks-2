import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { WelcomeDialog } from "@/components/WelcomeDialog";

interface TopBarProps {
  // Actions removed - now in LedgerPanel
}

export function TopBar({}: TopBarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  return (
    <>
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Budget Blocks
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SettingsDialog 
        open={showSettings} 
        onOpenChange={setShowSettings}
        onRestartOnboarding={() => setShowWelcome(true)}
      />
      <WelcomeDialog open={showWelcome} onOpenChange={setShowWelcome} />
    </>
  );
}
