import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Plus, Trash2, GripVertical, FileText, Settings } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { BlockType, Row, Block } from "@/types";
import { DatePickerField } from "@/components/shared/DatePickerField";
import { OwnerSelect } from "@/components/shared/OwnerSelect";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { PickFixedBillsDialog } from "@/components/PickFixedBillsDialog";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import { DuplicateBlockDialog } from "@/components/DuplicateBlockDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { showPostInsertToast } from "@/lib/postInsertToast";
import { joinDisplayValues } from "@/lib/displayUtils";
import { ManageTemplatesDialog } from "@/components/ManageTemplatesDialog";

interface CreateBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId: string;
  bandInfo: { title: string; startDate: Date; endDate: Date };
  blockType: BlockType; // Preselected type
  availableToAllocate?: number; // Band's Expected Income - Expected Fixed
  calculatorBasis?: number; // Pre-filled basis if launched from calculator
}

export function CreateBlockDialog({ open, onOpenChange, bandId, bandInfo, blockType, availableToAllocate, calculatorBasis }: CreateBlockDialogProps) {
  const bases = useStore((state) => state.bases);
  const library = useStore((state) => state.library);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);
  const vendors = useStore((state) => state.vendors);
  const flowTypes = useStore((state) => state.flowTypes);
  const addBlock = useStore((state) => state.addBlock);
  const saveToLibrary = useStore((state) => state.saveToLibrary);
  const addToMasterList = useStore((state) => state.addToMasterList);
  const templatePreferences = useStore((state) => state.templatePreferences);
  const updateTemplatePreference = useStore((state) => state.updateTemplatePreference);

  const [activeTab, setActiveTab] = useState<"new" | "templates">("new");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [defaultOwner, setDefaultOwner] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [showInsertBills, setShowInsertBills] = useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [lastInsertedBlock, setLastInsertedBlock] = useState<Block | null>(null);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showManageTemplates, setShowManageTemplates] = useState(false);
  
  // Flow allocation state
  const [basisSource, setBasisSource] = useState<'band' | 'manual' | 'calculator'>('band');
  const [manualBasis, setManualBasis] = useState<number>(0);
  
  // Computed basis based on source
  const allocationBasis = blockType === 'Flow' 
    ? (basisSource === 'band' ? (availableToAllocate || 0) 
       : basisSource === 'calculator' ? (calculatorBasis || 0)
       : manualBasis)
    : 0;

  // Initialize when dialog opens
  useEffect(() => {
    if (open) {
      setDate(startOfDay(bandInfo.startDate));
      setTitle(`${blockType} - ${bandInfo.title}`);
      setDefaultOwner(owners[0] || "");
      if (rows.length === 0) {
        addRow();
      }
      
      // Set initial basis source for Flow blocks
      if (blockType === 'Flow') {
        if (calculatorBasis !== undefined && calculatorBasis > 0) {
          setBasisSource('calculator');
        } else if (availableToAllocate !== undefined) {
          setBasisSource('band');
        } else {
          setBasisSource('manual');
          setManualBasis(0);
        }
      }
    }
  }, [open, bandInfo, blockType, calculatorBasis, availableToAllocate]);

  const addRow = () => {
    const newRow: Row = {
      id: uuidv4(),
      owner: defaultOwner,
      source: "",
      fromBaseId: "",
      toBaseId: "",
      amount: 0,
      type: blockType === 'Flow' ? 'Transfer' : undefined,
      category: "",
      date: startOfDay(date),
      notes: "",
      executed: false,
      flowMode: blockType === 'Flow' ? 'Fixed' : undefined,
      flowValue: blockType === 'Flow' ? 0 : undefined,
    };
    setRows([...rows, newRow]);
  };

  const deleteRow = (rowId: string) => {
    if (rows.length === 1) {
      toast.error("Block must have at least one row");
      return;
    }
    setRows(rows.filter((r) => r.id !== rowId));
  };

  const updateRow = (rowId: string, updates: Partial<Row>) => {
    setRows(rows.map((r) => (r.id === rowId ? { ...r, ...updates } : r)));
  };

  const handleAddToMasterList = (list: 'owners' | 'categories' | 'vendors' | 'flowTypes', value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    addToMasterList(list, trimmed);
    toast.success(`Added "${trimmed}" to ${list}`);
  };

  const handleInsertBills = (newRows: Row[]) => {
    setRows([...rows, ...newRows]);
    setShowInsertBills(false);
    toast.success(`Inserted ${newRows.length} bill(s)`);
  };

  const calculateTotal = () => {
    return rows.reduce((sum, row) => sum + row.amount, 0);
  };

  const calculateFlowAllocated = () => {
    if (blockType !== 'Flow') return 0;
    return rows.reduce((sum, row) => {
      if (row.flowMode === 'Fixed') return sum + (row.flowValue || 0);
      if (row.flowMode === '%') return sum + (allocationBasis * ((row.flowValue || 0) / 100));
      return sum;
    }, 0);
  };

  const calculateFlowRemaining = () => {
    return allocationBasis - calculateFlowAllocated();
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveChanges = async () => {
    if (isSaving) return;

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Validate rows
    for (const row of rows) {
      if (!row.owner?.trim()) {
        toast.error("All rows must have an owner");
        return;
      }
      if (!row.amount || row.amount <= 0) {
        toast.error("All rows must have a positive amount");
        return;
      }
      if (blockType === 'Income' && !row.toBaseId) {
        toast.error("Income rows must have a destination (To Base)");
        return;
      }
      if (blockType === 'Fixed Bill' && !row.fromBaseId) {
        toast.error("Fixed Bill rows must have a source (From Base)");
        return;
      }
      if (blockType === 'Flow') {
        if (!row.fromBaseId) {
          toast.error("Flow rows must have a source (From Base)");
          return;
        }
        if (row.flowMode === '%') {
          if (!allocationBasis || allocationBasis <= 0) {
            toast.error("Allocation Basis is required for percentage-based rows");
            return;
          }
        }
      }
    }

    setIsSaving(true);

    try {
      if (!bandId) {
        toast.error("No band selected - cannot insert block");
        return;
      }
      
      console.debug('createBlockAndInsert payload', {
        bandId,
        type: blockType,
        title: title.trim(),
        date,
        rowCount: rows.length,
      });

      addBlock({
        type: blockType,
        title: title.trim(),
        date,
        tags: [],
        rows: rows,
        bandId,
      });
      
      const insertedBlock: Block = {
        id: '',
        type: blockType,
        title: title.trim(),
        date,
        tags: [],
        rows: rows,
        bandId,
        createdAt: new Date(),
        updatedAt: new Date(),
        allocationBasisValue: basisSource === 'calculator' ? calculatorBasis : (basisSource === 'manual' ? manualBasis : undefined),
      };
      
      toast.success("Block created");
      resetForm();
      onOpenChange(false);
      
      const shouldOffer = 
        (blockType === 'Income' && !templatePreferences.dontOfferForIncome) ||
        (blockType === 'Fixed Bill' && !templatePreferences.dontOfferForFixed) ||
        (blockType === 'Flow' && !templatePreferences.dontOfferForFlow);
        
      if (shouldOffer) {
        setLastInsertedBlock(insertedBlock);
        setTimeout(() => {
          showPostInsertToast({
            block: insertedBlock,
            blockType,
            blockTitle: title.trim(),
            onSaveAsTemplate: () => {
              setSaveTemplateDialogOpen(true);
            },
            onDontOfferAgain: () => {
              updateTemplatePreference(blockType, true);
              toast.info(`Won't offer template save for ${blockType} blocks anymore`);
            },
          });
        }, 300);
      }
    } catch (error) {
      console.error('Failed to save block', error);
      toast.error(`Couldn't create block: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (isSaving) return;

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Validate rows
    for (const row of rows) {
      if (!row.owner?.trim()) {
        toast.error("All rows must have an owner");
        return;
      }
      if (!row.amount || row.amount <= 0) {
        toast.error("All rows must have a positive amount");
        return;
      }
    }

    setIsSaving(true);

    try {
      console.debug('Saving to library', { type: blockType, title: title.trim(), rowCount: rows.length });
      addBlock({
        type: blockType,
        title: title.trim(),
        date: new Date(),
        tags: [],
        rows: rows,
        bandId: '',
        isTemplate: true,
      });
      toast.success("Saved to library");
    } catch (error) {
      console.error('Failed to save to library', error);
      toast.error(`Couldn't save to library: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInsertTemplate = (templateId: string) => {
    const template = library.find((t) => t.id === templateId);
    if (!template) return;

    // Populate the transactions table with template rows
    setRows(template.rows.map(row => ({
      ...row,
      id: uuidv4(),
      date: date, // Use current date
      executed: false,
    })));
    setTitle(template.title);
    setActiveTab("new");
    toast.success("Template loaded into editor");
  };

  const resetForm = () => {
    setTitle(`${blockType} - ${bandInfo.title}`);
    setDate(startOfDay(bandInfo.startDate));
    setRows([]);
    setBasisSource('band');
    setManualBasis(0);
  };

  const filteredTemplates = library.filter((t) => t.type === blockType);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create {blockType} Block</DialogTitle>
          <DialogDescription>
            Creating in {bandInfo.title} • {format(bandInfo.startDate, 'MMM d')} - {format(bandInfo.endDate, 'MMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "new" | "templates")}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="new">New Block</TabsTrigger>
              <TabsTrigger value="templates">Templates ({filteredTemplates.length})</TabsTrigger>
            </TabsList>
            {activeTab === "templates" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowManageTemplates(true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage
              </Button>
            )}
          </div>

          <TabsContent value="new" className="space-y-4 mt-4">
            {/* Block Header Fields */}
            <div className="flex gap-4">
              <div className="flex-1 grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Paycheck, Bills, Allocations"
                />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <DatePickerField
                  value={date}
                  onChange={setDate}
                  bandStart={bandInfo.startDate}
                  bandEnd={bandInfo.endDate}
                  className="w-full"
                />
              </div>

                <div className="space-y-2">
                  <Label>Default Owner</Label>
                  <OwnerSelect value={defaultOwner} onValueChange={setDefaultOwner} placeholder="Select owner (optional)" />
                </div>
              </div>

              {/* Allocation Basis Panel (Flow only) */}
              {blockType === 'Flow' && (
                <div className="w-[280px] p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Allocation Basis</Label>
                    <Badge variant="secondary" className="text-xs">Used for % rows</Badge>
                  </div>
                  
                  {availableToAllocate !== undefined && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Band Available</Label>
                      <div className="px-3 py-2 rounded-md bg-background text-sm font-medium">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(availableToAllocate)}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Basis Source</Label>
                    <Select value={basisSource} onValueChange={(v: 'band' | 'manual' | 'calculator') => setBasisSource(v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableToAllocate !== undefined && (
                          <SelectItem value="band">Band Available</SelectItem>
                        )}
                        {calculatorBasis !== undefined && calculatorBasis > 0 && (
                          <SelectItem value="calculator">From Calculator</SelectItem>
                        )}
                        <SelectItem value="manual">Manual Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {basisSource === 'manual' && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Manual Basis</Label>
                      <Input
                        type="number"
                        value={manualBasis}
                        onChange={(e) => setManualBasis(parseFloat(e.target.value) || 0)}
                        placeholder="Enter amount"
                        className="h-9"
                      />
                    </div>
                  )}
                  
                  {basisSource === 'calculator' && calculatorBasis !== undefined && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Calculator Value</Label>
                      <div className="px-3 py-2 rounded-md bg-background text-sm font-medium">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculatorBasis)}
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t space-y-1">
                    <Label className="text-xs text-muted-foreground">Active Basis</Label>
                    <div className="px-3 py-2 rounded-md bg-primary/10 text-sm font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(allocationBasis)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Transactions Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Transactions</Label>
                <div className="flex gap-2">
                  {blockType === 'Fixed Bill' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowInsertBills(true)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Insert Bills
                    </Button>
                  )}
                  <Button size="sm" onClick={addRow}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Row
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium w-8"></th>
                      <th className="text-left p-2 font-medium">Owner</th>
                      {blockType === 'Income' && <th className="text-left p-2 font-medium">Source</th>}
                      {blockType === 'Fixed Bill' && <th className="text-left p-2 font-medium">Vendor</th>}
                      {blockType === 'Income' && <th className="text-left p-2 font-medium">To Base</th>}
                      {blockType === 'Fixed Bill' && <th className="text-left p-2 font-medium">From Base</th>}
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium">From Base</th>}
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium">To Base</th>}
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium">Mode</th>}
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium">Value</th>}
                      <th className="text-left p-2 font-medium">Amount</th>
                      <th className="text-left p-2 font-medium">Category</th>
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-left p-2 font-medium">Notes</th>
                      <th className="text-center p-2 font-medium w-12">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.id} className="border-t hover:bg-muted/30">
                        <td className="p-2">
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                        </td>
                        <td className="p-2">
                          <OwnerSelect 
                            value={row.owner} 
                            onValueChange={(v) => updateRow(row.id, { owner: v })}
                            className="h-8"
                          />
                        </td>
                        {(blockType === 'Income' || blockType === 'Fixed Bill') && (
                          <td className="p-2">
                            <Input
                              className="h-8"
                              value={row.source || ""}
                              onChange={(e) => updateRow(row.id, { source: e.target.value })}
                              placeholder={blockType === 'Income' ? "Employer" : "Vendor"}
                            />
                          </td>
                        )}
                        {blockType === 'Income' && (
                          <td className="p-2">
                            <Select value={row.toBaseId} onValueChange={(v) => updateRow(row.id, { toBaseId: v })}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {bases.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        {blockType === 'Fixed Bill' && (
                          <td className="p-2">
                            <Select value={row.fromBaseId} onValueChange={(v) => updateRow(row.id, { fromBaseId: v })}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {bases.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        {blockType === 'Flow' && (
                          <>
                            <td className="p-2">
                              <Select value={row.fromBaseId} onValueChange={(v) => updateRow(row.id, { fromBaseId: v })}>
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {bases.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Select value={row.toBaseId} onValueChange={(v) => updateRow(row.id, { toBaseId: v })}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Optional" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bases.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Select value={row.flowMode} onValueChange={(v: 'Fixed' | '%') => updateRow(row.id, { flowMode: v })}>
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Fixed">Fixed</SelectItem>
                                  <SelectItem value="%">%</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                className="h-8"
                                value={row.flowValue || 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  updateRow(row.id, { 
                                    flowValue: val,
                                    amount: row.flowMode === 'Fixed' ? val : (allocationBasis * val / 100)
                                  });
                                }}
                              />
                            </td>
                          </>
                        )}
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-8"
                            value={row.amount}
                            onChange={(e) => updateRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-2">
                          <CategorySelect
                            value={row.category || ""}
                            onValueChange={(v) => updateRow(row.id, { category: v })}
                            placeholder={blockType === 'Flow' ? "Required" : "Optional"}
                            required={blockType === 'Flow'}
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <DatePickerField
                            value={row.date}
                            onChange={(d) => updateRow(row.id, { date: startOfDay(d) })}
                            bandStart={bandInfo.startDate}
                            bandEnd={bandInfo.endDate}
                            className="h-8 w-[130px]"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8"
                            value={row.notes || ""}
                            onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                            placeholder="Optional"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteRow(row.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Totals / Flow Summary */}
            {blockType === 'Flow' ? (
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Flow Summary</span>
                  <span className="text-sm text-muted-foreground">{rows.length} row(s)</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Basis</p>
                    <p className="text-lg font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(allocationBasis)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Allocated</p>
                    <p className="text-lg font-bold text-accent">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateFlowAllocated())}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                    <p className={`text-lg font-bold ${calculateFlowRemaining() >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateFlowRemaining())}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex gap-6">
                  <div>
                    <span className="text-sm text-muted-foreground">Total:</span>
                    <span className="ml-2 text-lg font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateTotal())}
                    </span>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{rows.length} row(s)</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-3 mt-4">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No {blockType} templates saved yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{template.title}</CardTitle>
                          <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{template.rows.length} rows</span>
                            <span>•</span>
                            <span>{joinDisplayValues([...new Set(template.rows.map(r => r.owner))])}</span>
                          </div>
                        </div>
                        <Badge>{template.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm font-semibold">
                        Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                          template.rows.reduce((sum, r) => sum + r.amount, 0)
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1"
                          onClick={() => handleInsertTemplate(template.id)}
                        >
                          Insert
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button 
                      variant="destructive" 
                      disabled
                      className="cursor-not-allowed opacity-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Block
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Nothing to delete yet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDuplicate(true)} disabled={isSaving}>
              Duplicate to...
            </Button>
            <Button variant="outline" onClick={handleSaveToLibrary} disabled={isSaving}>
              <FileText className="w-4 h-4 mr-2" />
              Save to Library
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <SaveAsTemplateDialog
      open={saveTemplateDialogOpen}
      onOpenChange={setSaveTemplateDialogOpen}
      block={lastInsertedBlock}
    />
    
    {/* Duplicate Block Dialog */}
    <DuplicateBlockDialog
      open={showDuplicate}
      onOpenChange={setShowDuplicate}
      block={{
        id: '',
        title,
        date,
        rows,
        type: blockType,
        bandId,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
    />
    
    {/* Insert Bills Dialog (Fixed Bill only) */}
    <PickFixedBillsDialog
      open={showInsertBills}
      onOpenChange={setShowInsertBills}
      band={bandId ? {
        id: bandId,
        title: bandInfo.title,
        startDate: bandInfo.startDate,
        endDate: bandInfo.endDate,
        order: 0,
      } : null}
      onInsert={handleInsertBills}
      onManageLibrary={() => {}}
    />

    <ManageTemplatesDialog
      open={showManageTemplates}
      onOpenChange={setShowManageTemplates}
    />
    </>
  );
}
