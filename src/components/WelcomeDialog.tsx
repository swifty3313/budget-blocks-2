import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { addMonths, startOfMonth, endOfMonth } from "date-fns";
import { resetApp } from "@/lib/resetApp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
  const addBase = useStore((state) => state.addBase);
  const addBand = useStore((state) => state.addBand);
  const addBlock = useStore((state) => state.addBlock);
  const addToMasterList = useStore((state) => state.addToMasterList);

  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleLoadSampleData = () => {
    setLoading(true);

    // Add sample owner
    addToMasterList('owners', 'You');
    addToMasterList('categories', 'Groceries');
    addToMasterList('categories', 'Utilities');
    addToMasterList('categories', 'Rent');
    addToMasterList('vendors', 'Landlord');
    addToMasterList('vendors', 'Electric Company');

    // Add sample bases - need to capture the actual IDs from the state after adding
    const checkingBase = {
      name: "Main Checking",
      type: "Checking" as const,
      institution: "Sample Bank",
      identifier: "1234",
      balance: 2500.00,
      currency: "USD",
      tags: ["primary"],
    };

    const savingsBase = {
      name: "Emergency Savings",
      type: "Savings" as const,
      institution: "Sample Bank",
      identifier: "5678",
      balance: 10000.00,
      currency: "USD",
      tags: ["emergency"],
    };

    const creditBase = {
      name: "Credit Card",
      type: "Credit" as const,
      institution: "Card Company",
      identifier: "9012",
      balance: -450.00,
      currency: "USD",
      tags: [],
    };

    addBase(checkingBase);
    addBase(savingsBase);
    addBase(creditBase);

    // Generate 3 monthly pay periods
    const now = new Date();
    for (let i = -1; i <= 1; i++) {
      const date = addMonths(now, i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      addBand({
        title: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        startDate: start,
        endDate: end,
        order: i + 1,
      });
    }

    // Note: Sample blocks would need actual base IDs, so we'll skip adding them
    // Users will need to create their own blocks after bases are set up

    toast.success("Sample data loaded! Create your first block to get started.");
    setLoading(false);
    onOpenChange(false);
  };

  const handleStartFresh = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmReset = async () => {
    setShowResetConfirm(false);
    setResetting(true);

    try {
      await resetApp();
      toast.success("Data cleared. Starting fresh!");
      onOpenChange(false);
      
      // Small delay to allow toast to show before potential page refresh
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Reset failed:', error);
      toast.error("Could not reset. Please refresh the page and try again.");
      setResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Welcome to Budget Blocks!
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Your Notion-style personal finance planner
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <h3 className="font-semibold">How Budget Blocks works:</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="font-medium">Bases</p>
                  <p className="text-sm text-muted-foreground">
                    Your accounts where money lives (checking, savings, credit cards)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="font-medium">Blocks</p>
                  <p className="text-sm text-muted-foreground">
                    Groups of transactions - Income, Fixed Bills, or Flow (custom)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="font-medium">Pay Period Bands</p>
                  <p className="text-sm text-muted-foreground">
                    Time containers that organize your blocks by date
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="font-medium">Execute Transactions</p>
                  <p className="text-sm text-muted-foreground">
                    Check off transactions as they happen to update your actual balances
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h4 className="font-semibold">Get started quickly:</h4>
            <p className="text-sm text-muted-foreground">
              Load sample data to explore the app, or start fresh and create your own setup.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleStartFresh}
            disabled={resetting || loading}
          >
            {resetting ? "Clearing..." : "Start Fresh"}
          </Button>
          <Button onClick={handleLoadSampleData} disabled={loading || resetting}>
            <Sparkles className="w-4 h-4 mr-2" />
            Load Sample Data
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start fresh?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your local data including bases, blocks, pay periods, and templates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
