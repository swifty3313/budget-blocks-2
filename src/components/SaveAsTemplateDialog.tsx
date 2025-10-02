import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import type { Block, BlockType } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: Block | null;
}

export function SaveAsTemplateDialog({ open, onOpenChange, block }: SaveAsTemplateDialogProps) {
  const bases = useStore((state) => state.bases);
  const saveToLibrary = useStore((state) => state.saveToLibrary);

  const [templateTitle, setTemplateTitle] = useState("");
  const [includeRows, setIncludeRows] = useState(true);
  const [basisPreference, setBasisPreference] = useState<'none' | 'band' | 'manual' | 'calculator'>('none');
  const [manualBasisValue, setManualBasisValue] = useState<number>(0);

  useEffect(() => {
    if (open && block) {
      setTemplateTitle(block.title);
      setIncludeRows(true);
      setBasisPreference('none');
      setManualBasisValue(0);
    }
  }, [open, block]);

  if (!block) return null;

  const handleSave = () => {
    if (!templateTitle.trim()) {
      toast.error("Please enter a template title");
      return;
    }

    const template: Block = {
      ...block,
      title: templateTitle.trim(),
      rows: includeRows ? block.rows : [],
      isTemplate: true,
      bandId: '', // Templates have no band
      allocationBasisPreference: block.type === 'Flow' ? basisPreference : undefined,
      allocationBasisValue: (block.type === 'Flow' && (basisPreference === 'manual' || basisPreference === 'calculator')) 
        ? manualBasisValue 
        : undefined,
    };

    saveToLibrary(template);
    toast.success(`Saved to Library: ${templateTitle}`);
    onOpenChange(false);
  };

  const getBaseName = (baseId?: string) => {
    if (!baseId) return "-";
    const base = bases.find(b => b.id === baseId);
    return base ? `${base.name} (${base.type})` : "-";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Create a reusable template from this {block.type} block
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Title */}
          <div className="space-y-2">
            <Label>Template Title *</Label>
            <Input
              value={templateTitle}
              onChange={(e) => setTemplateTitle(e.target.value)}
              placeholder={`e.g., ${block.type} Template`}
            />
          </div>

          {/* Block Type (Read-only) */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="px-3 py-2 rounded-md bg-muted text-sm">
              {block.type}
            </div>
          </div>

          {/* Include Rows */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeRows"
              checked={includeRows}
              onCheckedChange={(checked) => setIncludeRows(checked === true)}
            />
            <Label htmlFor="includeRows" className="cursor-pointer">
              Include rows ({block.rows.length} row{block.rows.length !== 1 ? 's' : ''})
            </Label>
          </div>

          {/* Rows Preview */}
          {includeRows && block.rows.length > 0 && (
            <div className="space-y-2">
              <Label>Rows Preview (Read-only)</Label>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner</TableHead>
                      {block.type === 'Income' && <TableHead>Source</TableHead>}
                      {block.type === 'Fixed Bill' && <TableHead>Vendor</TableHead>}
                      {block.type === 'Flow' && <TableHead>From</TableHead>}
                      {block.type === 'Flow' && <TableHead>To</TableHead>}
                      {block.type === 'Income' && <TableHead>To Base</TableHead>}
                      {block.type === 'Fixed Bill' && <TableHead>From Base</TableHead>}
                      {block.type === 'Flow' && <TableHead>Mode</TableHead>}
                      {block.type === 'Flow' && <TableHead>Value</TableHead>}
                      {block.type !== 'Flow' && <TableHead>Amount</TableHead>}
                      <TableHead>Category</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {block.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs">{row.owner}</TableCell>
                        {block.type === 'Income' && <TableCell className="text-xs">{row.source || "-"}</TableCell>}
                        {block.type === 'Fixed Bill' && <TableCell className="text-xs">{row.source || "-"}</TableCell>}
                        {block.type === 'Flow' && <TableCell className="text-xs">{getBaseName(row.fromBaseId)}</TableCell>}
                        {block.type === 'Flow' && <TableCell className="text-xs">{getBaseName(row.toBaseId)}</TableCell>}
                        {block.type === 'Income' && <TableCell className="text-xs">{getBaseName(row.toBaseId)}</TableCell>}
                        {block.type === 'Fixed Bill' && <TableCell className="text-xs">{getBaseName(row.fromBaseId)}</TableCell>}
                        {block.type === 'Flow' && <TableCell className="text-xs">{row.flowMode || "Fixed"}</TableCell>}
                        {block.type === 'Flow' && <TableCell className="text-xs">{row.flowValue || 0}</TableCell>}
                        {block.type !== 'Flow' && <TableCell className="text-xs">${row.amount.toFixed(2)}</TableCell>}
                        <TableCell className="text-xs">{row.category || "-"}</TableCell>
                        <TableCell className="text-xs">{row.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Flow-only: Allocation Basis Preference */}
          {block.type === 'Flow' && (
            <div className="space-y-3 p-4 border rounded-md bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Allocation Basis Preference</Label>
                <Badge variant="secondary" className="text-xs">For % row previews</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose how this template should calculate % rows when inserted into a band
              </p>
              
              <RadioGroup value={basisPreference} onValueChange={(v: 'none' | 'band' | 'manual' | 'calculator') => setBasisPreference(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="basis-none" />
                  <Label htmlFor="basis-none" className="cursor-pointer">None (user chooses at insert time)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="band" id="basis-band" />
                  <Label htmlFor="basis-band" className="cursor-pointer">Band Available (Expected Income - Expected Fixed)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="basis-manual" />
                  <Label htmlFor="basis-manual" className="cursor-pointer">Manual Amount</Label>
                </div>
                {block.allocationBasisValue && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="calculator" id="basis-calculator" />
                    <Label htmlFor="basis-calculator" className="cursor-pointer">From Calculator (snapshot: ${block.allocationBasisValue.toFixed(2)})</Label>
                  </div>
                )}
              </RadioGroup>

              {(basisPreference === 'manual' || basisPreference === 'calculator') && (
                <div className="space-y-2 ml-6">
                  <Label>Basis Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualBasisValue || ""}
                    onChange={(e) => setManualBasisValue(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
