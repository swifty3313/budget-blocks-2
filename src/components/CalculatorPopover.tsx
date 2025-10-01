import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

interface CalculatorPopoverProps {
  availableToAllocate: number;
  bandId: string;
  bandTitle: string;
  onUseAsBasis?: (result: number) => void;
}

export function CalculatorPopover({ 
  availableToAllocate, 
  bandId, 
  bandTitle,
  onUseAsBasis 
}: CalculatorPopoverProps) {
  const bases = useStore((state) => state.bases);
  const [selectedBaseId, setSelectedBaseId] = useState<string>("");
  const [manualAdjustment, setManualAdjustment] = useState<number>(0);
  const [open, setOpen] = useState(false);

  const selectedBase = bases.find(b => b.id === selectedBaseId);
  const baseBalance = selectedBase?.balance || 0;
  const sumResult = availableToAllocate + baseBalance + manualAdjustment;

  const handleCopyResult = () => {
    navigator.clipboard.writeText(sumResult.toFixed(2));
    toast.success("Result copied to clipboard");
  };

  const handleUseAsBasis = () => {
    if (onUseAsBasis) {
      onUseAsBasis(sumResult);
      setOpen(false);
      toast.success("Opening Flow block with allocation basis");
    }
  };

  const handleReset = () => {
    setSelectedBaseId("");
    setManualAdjustment(0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          size="sm" 
          variant="outline"
          className="gap-2"
        >
          <Calculator className="w-4 h-4" />
          Calculator
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start" side="bottom">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-1">Quick Calculator</h4>
            <p className="text-xs text-muted-foreground">{bandTitle}</p>
          </div>

          {/* Available to Allocate */}
          <div className="space-y-1.5">
            <Label className="text-xs">Available to Allocate</Label>
            <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">
              {formatCurrency(availableToAllocate)}
            </div>
          </div>

          {/* Base Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Base</Label>
            <Select value={selectedBaseId} onValueChange={setSelectedBaseId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select a base..." />
              </SelectTrigger>
              <SelectContent>
                {bases.map((base) => (
                  <SelectItem key={base.id} value={base.id}>
                    {base.name} ({base.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base Balance */}
          {selectedBaseId && (
            <div className="space-y-1.5">
              <Label className="text-xs">Base Current Balance</Label>
              <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">
                {formatCurrency(baseBalance)}
              </div>
            </div>
          )}

          {/* Manual Adjustment */}
          <div className="space-y-1.5">
            <Label className="text-xs">Manual Adjustment (optional)</Label>
            <Input
              type="number"
              step="0.01"
              value={manualAdjustment || ""}
              onChange={(e) => setManualAdjustment(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="text-sm"
            />
          </div>

          {/* Sum Result */}
          <div className="space-y-1.5 pt-2 border-t">
            <Label className="text-xs font-semibold">Sum Result</Label>
            <div className="px-3 py-3 rounded-md bg-primary/10 border-2 border-primary/20 text-lg font-bold text-center">
              {formatCurrency(sumResult)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyResult}
              className="flex-1 gap-2"
            >
              <Copy className="w-3 h-3" />
              Copy
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handleUseAsBasis}
              className="flex-1 gap-2"
              disabled={!onUseAsBasis}
            >
              <ArrowRight className="w-3 h-3" />
              Use as Basis
            </Button>
          </div>

          {/* Reset */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="w-full text-xs"
          >
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
