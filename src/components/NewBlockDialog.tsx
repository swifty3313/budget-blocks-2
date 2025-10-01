import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Calendar, Pencil, Info, FileText } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { ApplyFlowTemplateDialog } from "@/components/ApplyFlowTemplateDialog";
import type { BlockType, Row } from "@/types";

interface NewBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId?: string; // If opened from within a band
  bandInfo?: { title: string; startDate: Date; endDate: Date }; // Band context
  initialBasis?: number; // Prefilled allocation basis from Calculator
  basisSource?: 'calculator'; // Source of the basis value
  availableToAllocate?: number; // Band's available to allocate value
}

export function NewBlockDialog({ open, onOpenChange, bandId, bandInfo, initialBasis, basisSource, availableToAllocate }: NewBlockDialogProps) {
  const bases = useStore((state) => state.bases);
  const bands = useStore((state) => state.bands);
  const library = useStore((state) => state.library);
  const removeFromLibrary = useStore((state) => state.removeFromLibrary);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);
  const vendors = useStore((state) => state.vendors);
  const flowTypes = useStore((state) => state.flowTypes);
  const addBlock = useStore((state) => state.addBlock);
  const saveToLibrary = useStore((state) => state.saveToLibrary);
  const addToMasterList = useStore((state) => state.addToMasterList);

  const [activeTab, setActiveTab] = useState<"new" | "templates">("new");
  const [blockType, setBlockType] = useState<BlockType>("Income");
  
  const [title, setTitle] = useState("");
  const [selectedBandId, setSelectedBandId] = useState<string>(bandId || "");
  const [executeImmediately, setExecuteImmediately] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  
  // Flow allocation state
  const [allocationBasis, setAllocationBasis] = useState<number>(0);
  const [basisMode, setBasisMode] = useState<'manual' | 'band' | 'calculator'>('manual');
  const [enforceFullAllocation, setEnforceFullAllocation] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showApplyFlowTemplate, setShowApplyFlowTemplate] = useState(false);
  const [selectedFlowTemplate, setSelectedFlowTemplate] = useState<any>(null);
  const [lastInsertedBlockId, setLastInsertedBlockId] = useState<string | null>(null);
  
  // Compact mode state with localStorage persistence
  const [isCompact, setIsCompact] = useState(() => {
    const stored = localStorage.getItem('flow-modal-compact');
    return stored ? JSON.parse(stored) : false;
  });
  
  const [rows, setRows] = useState<Row[]>([]);

  // Initialize with empty row when dialog opens
  useEffect(() => {
    if (open && rows.length === 0) {
      const defaultDate = bandInfo?.startDate || new Date();
      addRow(defaultDate);
    }
    // Default to templates tab when opened from a band, unless coming from Calculator
    if (open && bandId && !basisSource) {
      setActiveTab("templates");
    } else if (open) {
      setActiveTab("new");
    }
    
    // If coming from Calculator, set Flow type and prefill basis
    if (open && basisSource === 'calculator' && initialBasis !== undefined) {
      setBlockType('Flow');
      setAllocationBasis(initialBasis);
      setBasisMode('calculator');
      setActiveTab("new");
    }
  }, [open, basisSource, initialBasis]);
  
  // Update allocation basis when band available changes
  useEffect(() => {
    if (basisMode === 'band' && availableToAllocate !== undefined) {
      setAllocationBasis(availableToAllocate);
    }
  }, [basisMode, availableToAllocate]);

  // Update selected band when bandId prop changes
  useEffect(() => {
    if (bandId) {
      setSelectedBandId(bandId);
    }
  }, [bandId]);

  const getDefaultRowDate = (): Date => {
    if (bandInfo) return bandInfo.startDate;
    if (selectedBandId) {
      const band = bands.find(b => b.id === selectedBandId);
      if (band) return band.startDate;
    }
    return new Date();
  };

  const addRow = (date?: Date) => {
    const lastRow = rows[rows.length - 1];
    const defaultDate = date || getDefaultRowDate();
    
    setRows([
      ...rows,
      {
        id: uuidv4(),
        date: defaultDate,
        owner: lastRow?.owner || "",
        source: lastRow?.source || "",
        fromBaseId: lastRow?.fromBaseId,
        toBaseId: lastRow?.toBaseId,
        amount: 0,
        flowMode: blockType === 'Flow' ? 'Fixed' : undefined,
        flowValue: 0,
        type: lastRow?.type,
        category: lastRow?.category,
        notes: "",
        executed: executeImmediately,
      },
    ]);
  };

  const updateRow = (id: string, updates: Partial<Row>) => {
    setRows(prev => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter((r) => r.id !== id));
    } else {
      toast.error("At least one row is required");
    }
  };

  const handleAddToMasterList = (type: 'owners' | 'vendors' | 'categories' | 'flowTypes', value: string) => {
    if (!value.trim()) return;
    
    const list = type === 'owners' ? owners : 
                 type === 'vendors' ? vendors :
                 type === 'categories' ? categories : flowTypes;
    
    if (!list.includes(value.trim())) {
      addToMasterList(type, value.trim());
      toast.success(`${value} added`);
      return true;
    }
    return false;
  };

  const setAllRowDates = (date: Date) => {
    setRows(rows.map(r => ({ ...r, date })));
    toast.success("All row dates updated");
  };

  const setAllRowOwners = (owner: string) => {
    setRows(rows.map(r => ({ ...r, owner })));
    toast.success("All row owners updated");
  };

  const handleSave = (saveToLib: boolean = false, insert: boolean = true) => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (rows.length === 0) {
      toast.error("Please add at least one row");
      return;
    }

    // Validate all rows have required fields
    for (const row of rows) {
      if (!row.owner.trim()) {
        toast.error("All rows must have an owner");
        return;
      }
      
      // Type-specific validation
      if (blockType === 'Income' && !row.toBaseId) {
        toast.error("Income rows must have a destination (To Base)");
        return;
      }
      if (blockType === 'Fixed Bill') {
        if (!row.fromBaseId) {
          toast.error("Fixed Bill rows must have a source (From Base)");
          return;
        }
        if (row.amount <= 0) {
          toast.error("All rows must have a valid amount");
          return;
        }
      }
      if (blockType === 'Flow') {
        if (!row.fromBaseId) {
          toast.error("Flow rows must have a source (From Base)");
          return;
        }
        if (!row.type?.trim()) {
          toast.error("Flow rows must have a type (Transfer, Payment, etc.)");
          return;
        }
        // Category is optional for Flow blocks
        // Flow-specific validation
        const hasPercentRows = rows.some(r => r.flowMode === '%');
        if (hasPercentRows && !allocationBasis) {
          toast.error("Allocation Basis is required when using % rows");
          return;
        }
        if (!row.flowValue || row.flowValue <= 0) {
          toast.error("All Flow rows must have a valid Mode value");
          return;
        }
        // Calculate amount for validation
        const calculatedAmount = row.flowMode === '%' 
          ? (row.flowValue / 100) * allocationBasis 
          : row.flowValue;
        if (calculatedAmount <= 0) {
          toast.error("All calculated amounts must be positive");
          return;
        }
      } else {
        // Non-flow blocks need amount validation
        if (row.amount <= 0) {
          toast.error("All rows must have a valid amount");
          return;
        }
      }
    }
    
    // Enforce full allocation if enabled
    if (blockType === 'Flow' && enforceFullAllocation) {
      const totalAllocated = rows.reduce((sum, r) => sum + r.amount, 0);
      if (Math.abs(totalAllocated - allocationBasis) > 0.01) {
        toast.error(`Allocated (${formatCurrency(totalAllocated)}) must equal Basis (${formatCurrency(allocationBasis)})`);
        return;
      }
    }

    // Determine block date (use first row's date or current date)
    const blockDate = rows[0]?.date || new Date();

    const blockData = {
      type: blockType,
      title: title.trim(),
      date: blockDate,
      tags: [],
      rows: rows.map(r => ({
        ...r,
        executed: executeImmediately ? true : r.executed,
      })),
      ...(selectedBandId && !bandId ? { bandId: selectedBandId } : {}),
    };

    // If editing a template, update it
    if (editingTemplateId) {
      saveToLibrary({ 
        ...blockData, 
        id: editingTemplateId,
        isTemplate: true,
        createdAt: library.find(t => t.id === editingTemplateId)?.createdAt || new Date(),
        updatedAt: new Date() 
      } as any);
      toast.success("Template updated");
      resetForm();
      onOpenChange(false);
      return;
    }

    if (insert) {
      addBlock(blockData);
      toast.success("Block created");
    }

    if (saveToLib) {
      saveToLibrary({ 
        ...blockData, 
        id: uuidv4(), 
        isTemplate: true,
        createdAt: new Date(), 
        updatedAt: new Date() 
      } as any);
      toast.success("Saved to library");
    }

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setTitle("");
    setSelectedBandId(bandId || "");
    setExecuteImmediately(false);
    setRows([]);
    setBlockType("Income");
    setActiveTab("new");
    setEditingTemplateId(null);
    setAllocationBasis(0);
    setBasisMode('manual');
    setEnforceFullAllocation(false);
    setSelectedTemplateId("");
    // Don't reset isCompact - it persists across sessions
  };

  const handleInsertTemplate = (template: any) => {
    // If Flow template, open selective apply dialog
    if (template.type === 'Flow') {
      setSelectedFlowTemplate(template);
      setShowApplyFlowTemplate(true);
      return;
    }

    // For other types, insert directly
    const instanceDate = bandInfo?.startDate || new Date();
    const newBlockId = uuidv4();
    addBlock({
      ...template,
      id: newBlockId,
      isTemplate: false,
      bandId: bandId,
      date: instanceDate,
      rows: template.rows.map((r: any) => ({
        ...r,
        id: uuidv4(),
        date: instanceDate,
        executed: false,
      })),
    });
    
    setLastInsertedBlockId(newBlockId);
    
    // Show snackbar with Insert again and Undo
    toast.success(
      <div className="flex items-center justify-between gap-4 w-full">
        <span>Inserted '{template.title}' ({template.rows.length} rows)</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleInsertTemplate(template)}
            className="h-7 text-xs"
          >
            Insert again
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (newBlockId) {
                const deleteBlock = useStore.getState().deleteBlock;
                deleteBlock(newBlockId);
                toast.info("Insertion undone");
              }
            }}
            className="h-7 text-xs"
          >
            Undo
          </Button>
        </div>
      </div>,
      { duration: 5000 }
    );
    
    onOpenChange(false);
  };

  const handleApplyFlowTemplate = (rows: Row[]) => {
    if (!selectedFlowTemplate) return;

    const instanceDate = bandInfo?.startDate || new Date();
    const newBlockId = uuidv4();
    
    addBlock({
      type: 'Flow',
      title: selectedFlowTemplate.title,
      date: instanceDate,
      tags: [],
      rows: rows,
      bandId: bandId,
      id: newBlockId,
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    setLastInsertedBlockId(newBlockId);
    
    toast.success(
      <div className="flex items-center justify-between gap-4 w-full">
        <span>Inserted '{selectedFlowTemplate.title}' ({rows.length} rows)</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedFlowTemplate(selectedFlowTemplate);
              setShowApplyFlowTemplate(true);
            }}
            className="h-7 text-xs"
          >
            Insert again
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (newBlockId) {
                const deleteBlock = useStore.getState().deleteBlock;
                deleteBlock(newBlockId);
                toast.info("Insertion undone");
              }
            }}
            className="h-7 text-xs"
          >
            Undo
          </Button>
        </div>
      </div>,
      { duration: 5000 }
    );
    
    setShowApplyFlowTemplate(false);
    setSelectedFlowTemplate(null);
    onOpenChange(false);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplateId(template.id);
    setBlockType(template.type);
    setTitle(template.title);
    setRows(template.rows.map((r: any) => ({ ...r, id: uuidv4() })));
    setActiveTab("new");
  };

  const applyTemplate = (templateId: string) => {
    const template = library.find(t => t.id === templateId);
    if (!template) return;

    // Insert template rows with new IDs and default date
    const instanceDate = bandInfo?.startDate || getDefaultRowDate();
    const templateRows = template.rows.map((r: any) => ({
      ...r,
      id: uuidv4(),
      date: instanceDate,
      executed: false,
    }));

    setRows(templateRows);
    
    // Basis handling: Calculator wins if present, otherwise check template
    // If coming from Calculator, allocationBasis is already set and should not be overridden
    if (basisSource !== 'calculator') {
      // Template might have a saved basis mode/value - for now we'll keep the current basis
      // In the future, templates could store their own basis preference
    }
    
    toast.success(`Applied template: ${template.title}`);
  };

  const getBlockTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Income': 'bg-success/10 text-success border-success/20',
      'Fixed Bill': 'bg-warning/10 text-warning border-warning/20',
      'Flow': 'bg-accent/10 text-accent border-accent/20',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  
  // Calculate Flow allocation summary
  const allocatedAmount = blockType === 'Flow' ? rows.reduce((sum, r) => sum + r.amount, 0) : 0;
  const remainingAmount = allocationBasis - allocatedAmount;
  
  // Recalculate amounts when flow values change
  useEffect(() => {
    if (blockType === 'Flow') {
      setRows(prevRows => prevRows.map(row => {
        if (row.flowMode === '%' && row.flowValue && allocationBasis) {
          return { ...row, amount: (row.flowValue / 100) * allocationBasis };
        } else if (row.flowMode === 'Fixed' && row.flowValue) {
          return { ...row, amount: row.flowValue };
        }
        return row;
      }));
    }
  }, [allocationBasis, blockType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTemplateId ? "Edit Template" : "New Block"}</DialogTitle>
          <DialogDescription>
            {editingTemplateId 
              ? "Update this template. Changes will affect future inserts only."
              : bandInfo 
                ? `Creating in ${bandInfo.title} (${format(bandInfo.startDate, 'MMM d')} - ${format(bandInfo.endDate, 'MMM d, yyyy')})`
                : "Create a new income, fixed bill, or flow block"
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New Block</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            {/* Block Type Selection */}
            <div className="space-y-2">
              <Label>Block Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['Income', 'Fixed Bill', 'Flow'] as BlockType[]).map((type) => (
                  <Button
                    key={type}
                    variant={blockType === type ? "default" : "outline"}
                    onClick={() => setBlockType(type)}
                    className="w-full"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Flow Header Overview */}
            {blockType === 'Flow' && (
              <div className="p-4 border rounded-lg bg-accent/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">Flow Allocation Overview</h4>
                    {basisSource === 'calculator' && (
                      <Badge variant="outline" className="text-xs">
                        Basis from Calculator
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="compact-toggle" className="text-xs text-muted-foreground cursor-pointer">
                      Compact columns
                    </Label>
                    <Switch
                      id="compact-toggle"
                      checked={isCompact}
                      onCheckedChange={(checked) => {
                        setIsCompact(checked);
                        localStorage.setItem('flow-modal-compact', JSON.stringify(checked));
                      }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  {/* Available to Allocate */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Available to Allocate</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Band's Expected Income − Expected Fixed</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="px-3 py-2 rounded-md bg-muted/30 border text-sm font-medium">
                      {availableToAllocate !== undefined ? formatCurrency(availableToAllocate) : 'N/A'}
                    </div>
                  </div>

                  {/* Allocation Basis */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Allocation Basis</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Used to calculate % rows</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={allocationBasis || ""}
                        onChange={(e) => {
                          setAllocationBasis(parseFloat(e.target.value) || 0);
                          setBasisMode('manual');
                        }}
                        className="text-sm font-medium"
                      />
                      <Select value={basisMode} onValueChange={(v) => {
                        setBasisMode(v as any);
                        if (v === 'band' && availableToAllocate !== undefined) {
                          setAllocationBasis(availableToAllocate);
                        }
                      }}>
                        <SelectTrigger className="w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="band">Band Avail</SelectItem>
                          <SelectItem value="calculator">Calculator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Allocated */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Allocated</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Sum of all row amounts</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="px-3 py-2 rounded-md bg-muted/30 border text-sm font-medium">
                      {formatCurrency(allocatedAmount)}
                    </div>
                  </div>

                  {/* Remaining */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Remaining</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Basis − Allocated</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className={`px-3 py-2 rounded-md border text-sm font-medium ${
                      remainingAmount < 0 ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted/30'
                    }`}>
                      {formatCurrency(remainingAmount)}
                    </div>
                  </div>
                </div>

                {/* Enforce Full Allocation */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enforceFullAllocation"
                    checked={enforceFullAllocation}
                    onCheckedChange={(checked) => setEnforceFullAllocation(checked as boolean)}
                  />
                  <Label htmlFor="enforceFullAllocation" className="text-xs cursor-pointer">
                    Enforce full allocation (Allocated must equal Basis)
                  </Label>
                </div>
              </div>
            )}

            {/* Start from Template - Flow only */}
            {blockType === 'Flow' && (
              <div className="p-3 border rounded-lg bg-muted/10 space-y-2">
                <Label className="text-xs font-medium">Start from</Label>
                <div className="flex gap-2">
                  <Select 
                    value={selectedTemplateId || "none"} 
                    onValueChange={(value) => {
                      setSelectedTemplateId(value === "none" ? "" : value);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="None (blank)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (blank)</SelectItem>
                      {library
                        .filter(t => t.type === 'Flow')
                        .map((template) => {
                          const rowCount = template.rows.length;
                          const total = template.rows.reduce((sum, r) => sum + r.amount, 0);
                          return (
                            <SelectItem key={template.id} value={template.id}>
                              {template.title} ({rowCount} rows, {formatCurrency(total)})
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedTemplateId}
                    onClick={() => {
                      if (selectedTemplateId) {
                        applyTemplate(selectedTemplateId);
                      }
                    }}
                  >
                    Apply Template
                  </Button>
                </div>
                {library.filter(t => t.type === 'Flow').length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No Flow templates saved yet. Create a Flow block and save it to your library.
                  </p>
                )}
              </div>
            )}

            {/* Block-level Fields */}
            <div className="grid md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="title">Block Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    blockType === 'Income' ? "e.g., Colin Income" :
                    blockType === 'Fixed Bill' ? "e.g., Pay Period 1" :
                    "e.g., Goal Transfers"
                  }
                />
              </div>

              {!bandInfo && (
                <div className="space-y-2">
                  <Label htmlFor="payPeriod">Pay Period</Label>
                  <Select value={selectedBandId || "NONE"} onValueChange={(value) => setSelectedBandId(value === "NONE" ? "" : value)}>
                    <SelectTrigger id="payPeriod">
                      <SelectValue placeholder="Select pay period (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No pay period</SelectItem>
                      {bands.map((band) => (
                        <SelectItem key={band.id} value={band.id}>
                          {band.title} ({format(band.startDate, 'MMM d')} - {format(band.endDate, 'MMM d, yyyy')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="executeImmediately"
                  checked={executeImmediately}
                  onCheckedChange={(checked) => setExecuteImmediately(checked as boolean)}
                />
                <Label htmlFor="executeImmediately" className="cursor-pointer">
                  Execute all rows immediately
                </Label>
              </div>
            </div>

            {/* Quick Fill Controls */}
            {rows.length > 1 && (
              <div className="flex gap-2 p-3 border rounded-lg bg-muted/20">
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-xs whitespace-nowrap">Fill all:</Label>
                  <Select onValueChange={setAllRowOwners}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Owner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((owner) => (
                        <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    className="h-8 text-xs w-36"
                    onChange={(e) => e.target.value && setAllRowDates(new Date(e.target.value))}
                  />
                </div>
              </div>
            )}

            {/* Transactions List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Transactions</Label>
                <Button size="sm" variant="outline" onClick={() => addRow()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Row
                </Button>
              </div>

              {/* Scrollable container - vertical only */}
              <div className="border rounded-lg max-h-[500px] overflow-y-auto">
                <div className={`space-y-2 ${isCompact ? 'p-1' : 'p-2'}`}>
                  {rows.map((row, idx) => (
                    <Card key={row.id} className={isCompact ? 'p-2' : 'p-3'}>
                      <div className={`grid grid-cols-12 items-start ${isCompact ? 'gap-1 text-xs' : 'gap-2'}`}>
                        {/* Owner */}
                        <div className={`space-y-1 ${isCompact ? 'col-span-2' : 'col-span-2'}`}>
                          <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                            {isCompact ? 'Owner' : 'Owner'} *
                          </Label>
                          <Select
                            value={row.owner}
                            onValueChange={(value) => {
                              if (value === "__ADD_NEW__") {
                                const newOwner = prompt("Enter new owner:");
                                if (newOwner && handleAddToMasterList('owners', newOwner)) {
                                  updateRow(row.id, { owner: newOwner.trim() });
                                }
                              } else {
                                updateRow(row.id, { owner: value });
                              }
                            }}
                          >
                            <SelectTrigger className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {owners.map((owner) => (
                                <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                              ))}
                              <SelectItem value="__ADD_NEW__">
                                <Plus className="w-3 h-3 inline mr-1" />
                                Add new...
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Source/Vendor */}
                        <div className={`space-y-1 ${isCompact ? 'col-span-2' : 'col-span-2'}`}>
                          <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                            {isCompact ? 'Src' : blockType === 'Income' ? 'Source' : 
                             blockType === 'Fixed Bill' ? 'Vendor' : 
                             'Source/Desc'}
                          </Label>
                          <Input
                            value={row.source || ""}
                            onChange={(e) => updateRow(row.id, { source: e.target.value })}
                            placeholder={
                              blockType === 'Income' ? "Source" :
                              blockType === 'Fixed Bill' ? "Vendor" :
                              "Description"
                            }
                            className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}
                          />
                        </div>

                        {/* From Base */}
                        {(blockType === 'Fixed Bill' || blockType === 'Flow') && (
                          <div className={`space-y-1 ${isCompact ? 'col-span-2' : 'col-span-2'}`}>
                            <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                              {isCompact ? 'From' : 'From Base'} *
                            </Label>
                            <Select
                              value={row.fromBaseId || ""}
                              onValueChange={(value) => updateRow(row.id, { fromBaseId: value })}
                            >
                              <SelectTrigger className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}>
                                <SelectValue placeholder="From" />
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
                        )}

                        {/* To Base */}
                        {(blockType === 'Income' || blockType === 'Flow') && (
                          <div className={`space-y-1 ${isCompact ? 'col-span-2' : 'col-span-2'}`}>
                            <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                              {isCompact ? 'To' : blockType === 'Income' ? 'To Base *' : 'To Base'}
                              {blockType === 'Income' && ' *'}
                            </Label>
                            <Select
                              value={row.toBaseId || ""}
                              onValueChange={(value) => updateRow(row.id, { toBaseId: value })}
                            >
                              <SelectTrigger className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}>
                                <SelectValue placeholder={blockType === 'Flow' ? "To (opt)" : "To"} />
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
                        )}

                        {/* Mode & Value & Amount (Flow only) */}
                        {blockType === 'Flow' && (
                          <>
                            <div className="col-span-1 space-y-1">
                              <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                                {isCompact ? 'Mod' : 'Mode'} *
                              </Label>
                              <Select
                                value={row.flowMode || 'Fixed'}
                                onValueChange={(value: 'Fixed' | '%') => {
                                  const newAmount = value === '%' && row.flowValue 
                                    ? (row.flowValue / 100) * allocationBasis 
                                    : row.flowValue || 0;
                                  updateRow(row.id, { flowMode: value, amount: newAmount });
                                }}
                              >
                                <SelectTrigger className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Fixed">$</SelectItem>
                                  <SelectItem value="%">%</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-1 space-y-1">
                              <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                                {isCompact ? 'Val' : 'Value'} *
                              </Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={row.flowValue || ""}
                                onChange={(e) => {
                                  const rawValue = e.target.value;
                                  // Allow empty, digits, single decimal point
                                  if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
                                    const numValue = parseFloat(rawValue) || 0;
                                    // Validate percent range
                                    if (row.flowMode === '%' && numValue > 100) return;
                                    
                                    const newAmount = row.flowMode === '%' 
                                      ? (numValue / 100) * allocationBasis 
                                      : numValue;
                                    updateRow(row.id, { flowValue: numValue, amount: newAmount });
                                  }
                                }}
                                onBlur={(e) => {
                                  const numValue = parseFloat(e.target.value) || 0;
                                  if (row.flowMode === '%' && (numValue < 0 || numValue > 100)) {
                                    toast.error("Percent must be between 0 and 100");
                                    updateRow(row.id, { flowValue: 0, amount: 0 });
                                  }
                                }}
                                placeholder={row.flowMode === '%' ? "0.0" : "0.00"}
                                className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}
                              />
                            </div>
                            <div className="col-span-1 space-y-1">
                              <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                                {isCompact ? 'Amt' : '$ Amount'}
                              </Label>
                              <div className={`${isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'} px-2 flex items-center font-medium text-muted-foreground border rounded-md bg-muted/30`}>
                                {formatCurrency(row.amount || 0)}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Amount (non-Flow) */}
                        {blockType !== 'Flow' && (
                          <div className="col-span-2 space-y-1">
                            <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Amount *</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={row.amount || ""}
                              onChange={(e) => {
                                const rawValue = e.target.value;
                                if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
                                  updateRow(row.id, { amount: parseFloat(rawValue) || 0 });
                                }
                              }}
                              className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}
                            />
                          </div>
                        )}

                        {/* Flow Type (Flow only) */}
                        {blockType === 'Flow' && (
                          <div className="col-span-1 space-y-1">
                            <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                              {isCompact ? 'Typ' : 'Type'} *
                            </Label>
                            <Select
                              value={row.type || ""}
                              onValueChange={(value) => {
                                if (value === "__ADD_NEW__") {
                                  const newType = prompt("Enter new flow type:");
                                  if (newType && handleAddToMasterList('flowTypes', newType)) {
                                    updateRow(row.id, { type: newType.trim() });
                                  }
                                } else {
                                  updateRow(row.id, { type: value });
                                }
                              }}
                            >
                              <SelectTrigger className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}>
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {flowTypes.map((type) => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                                <SelectItem value="__ADD_NEW__">
                                  <Plus className="w-3 h-3 inline mr-1" />
                                  Add new...
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Category */}
                        <div className="col-span-1 space-y-1">
                          <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                            {isCompact ? 'Cat' : 'Category'}
                          </Label>
                          <Select
                            value={row.category || ""}
                            onValueChange={(value) => {
                              if (value === "__ADD_NEW__") {
                                const newCat = prompt("Enter new category:");
                                if (newCat && handleAddToMasterList('categories', newCat)) {
                                  updateRow(row.id, { category: newCat.trim() });
                                }
                              } else {
                                updateRow(row.id, { category: value });
                              }
                            }}
                          >
                            <SelectTrigger className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}>
                              <SelectValue placeholder="Optional" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                              <SelectItem value="__ADD_NEW__">
                                <Plus className="w-3 h-3 inline mr-1" />
                                Add new...
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Date */}
                        <div className="col-span-1 space-y-1">
                          <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                            {isCompact ? 'Dt' : 'Date'} *
                          </Label>
                          <Input
                            type="date"
                            value={row.date ? format(row.date, 'yyyy-MM-dd') : ''}
                            onChange={(e) => updateRow(row.id, { date: new Date(e.target.value) })}
                            className={isCompact ? 'h-7 text-[11px]' : 'h-8 text-xs'}
                          />
                        </div>

                        {/* Notes - Compact: icon popover, Standard: input */}
                        {isCompact ? (
                          <div className="col-span-1 space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Note</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-full p-0"
                                >
                                  <FileText className={`w-3 h-3 ${row.notes ? 'text-primary' : 'text-muted-foreground'}`} />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2">
                                <Label className="text-xs mb-1 block">Notes</Label>
                                <textarea
                                  value={row.notes || ""}
                                  onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                                  placeholder="Optional notes..."
                                  className="w-full min-h-[60px] p-2 text-xs border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        ) : (
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs text-muted-foreground">Notes</Label>
                            <Input
                              value={row.notes || ""}
                              onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                              placeholder="Optional"
                              className="h-8 text-xs"
                            />
                          </div>
                        )}

                        {/* Execute & Delete */}
                        <div className="col-span-1 space-y-1">
                          <Label className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                            {isCompact ? 'Ex' : 'Execute'}
                          </Label>
                          <div className={`flex items-center gap-1 ${isCompact ? 'h-7' : 'h-8'}`}>
                            <Checkbox
                              checked={row.executed}
                              onCheckedChange={(checked) => updateRow(row.id, { executed: checked as boolean })}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteRow(row.id)}
                              disabled={rows.length === 1}
                              className={`p-0 ml-auto ${isCompact ? 'h-5 w-5' : 'h-6 w-6'}`}
                            >
                              <Trash2 className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Sticky Footer with Total */}
                <div className="sticky bottom-0 bg-muted/90 backdrop-blur-sm border-t p-3">
                  <div className="flex justify-between items-center font-semibold text-sm">
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            {library.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground mb-4">
                  No templates saved yet. Create blocks and save them to your library for quick reuse.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {library.map((template) => {
                  // Calculate total - for Flow templates with %, show "est." with assumed basis
                  const hasPercentRows = template.type === 'Flow' && template.rows.some(r => r.flowMode === '%');
                  const assumedBasis = availableToAllocate || 1000; // Use band available or default
                  
                  const total = template.rows.reduce((sum, row) => {
                    if (template.type === 'Flow' && row.flowMode === '%' && row.flowValue) {
                      return sum + (row.flowValue / 100 * assumedBasis);
                    }
                    return sum + (row.amount || 0);
                  }, 0);

                  return (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2 px-3 pt-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm leading-tight truncate">{template.title}</CardTitle>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className={`${getBlockTypeColor(template.type)} text-xs px-1 py-0`}>
                                {template.type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">
                            Total {hasPercentRows && '(est.)'}
                          </span>
                          <span className="text-sm font-bold">{formatCurrency(total)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p className="truncate">Owners: {[...new Set(template.rows.map(r => r.owner))].join(', ')}</p>
                          <p>{template.rows.length} row(s)</p>
                        </div>
                        <div className="flex gap-1 pt-1">
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleInsertTemplate(template)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Insert
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => {
                              if (confirm("Remove this template from library?")) {
                                removeFromLibrary(template.id);
                                toast.success("Template removed");
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          {editingTemplateId ? (
            <Button onClick={() => handleSave(false, false)}>
              Update Template
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleSave(true, false)}>
                Save to Library
              </Button>
              <Button variant="outline" onClick={() => handleSave(true, true)}>
                Save & Insert + Library
              </Button>
              <Button onClick={() => handleSave(false, true)}>Save & Insert</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Apply Flow Template Dialog */}
      <ApplyFlowTemplateDialog
        open={showApplyFlowTemplate}
        onOpenChange={setShowApplyFlowTemplate}
        template={selectedFlowTemplate}
        onInsert={handleApplyFlowTemplate}
        bandInfo={bandInfo}
        initialBasis={initialBasis}
        availableToAllocate={availableToAllocate}
      />
    </Dialog>
  );
}
