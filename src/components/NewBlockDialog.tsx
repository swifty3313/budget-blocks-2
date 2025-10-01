import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import type { BlockType, Row } from "@/types";

interface NewBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId?: string; // If opened from within a band
  bandInfo?: { title: string; startDate: Date; endDate: Date }; // Band context
}

export function NewBlockDialog({ open, onOpenChange, bandId, bandInfo }: NewBlockDialogProps) {
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
  
  const [rows, setRows] = useState<Row[]>([]);

  // Initialize with empty row when dialog opens
  useEffect(() => {
    if (open && rows.length === 0) {
      const defaultDate = bandInfo?.startDate || new Date();
      addRow(defaultDate);
    }
    // Default to templates tab when opened from a band
    if (open && bandId) {
      setActiveTab("templates");
    } else if (open) {
      setActiveTab("new");
    }
  }, [open]);

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
        type: lastRow?.type,
        category: lastRow?.category,
        notes: "",
        executed: executeImmediately,
      },
    ]);
  };

  const updateRow = (id: string, updates: Partial<Row>) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...updates } : r)));
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
      if (row.amount <= 0) {
        toast.error("All rows must have a valid amount");
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
        if (!row.category?.trim()) {
          toast.error("Flow rows must have a category");
          return;
        }
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
  };

  const handleInsertTemplate = (template: any) => {
    const instanceDate = bandInfo?.startDate || new Date();
    addBlock({
      ...template,
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
    toast.success(`${template.title} inserted`);
    onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Block</DialogTitle>
          <DialogDescription>
            {bandInfo 
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

            {/* Transactions Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Transactions</Label>
                <Button size="sm" variant="outline" onClick={() => addRow()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Row
                </Button>
              </div>

              <div className="border rounded-lg overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium text-xs">Owner *</th>
                      <th className="text-left p-2 font-medium text-xs">
                        {blockType === 'Income' ? 'Source' : 
                         blockType === 'Fixed Bill' ? 'Vendor' : 
                         'Source/Desc'}
                      </th>
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium text-xs">From Base *</th>}
                      {(blockType === 'Income' || blockType === 'Fixed Bill') && (
                        <th className="text-left p-2 font-medium text-xs">
                          {blockType === 'Income' ? 'To Base *' : 'From Base *'}
                        </th>
                      )}
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium text-xs">To Base</th>}
                      <th className="text-left p-2 font-medium text-xs">Amount *</th>
                      {blockType === 'Flow' && <th className="text-left p-2 font-medium text-xs">Type *</th>}
                      <th className="text-left p-2 font-medium text-xs">
                        Category {blockType === 'Flow' ? '*' : ''}
                      </th>
                      <th className="text-left p-2 font-medium text-xs">Date *</th>
                      <th className="text-left p-2 font-medium text-xs">Notes</th>
                      <th className="text-center p-2 font-medium text-xs">Execute</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="border-t hover:bg-muted/30">
                        {/* Owner */}
                        <td className="p-2">
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
                            <SelectTrigger className="h-8 text-xs min-w-[120px]">
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
                        </td>

                        {/* Source/Vendor */}
                        <td className="p-2">
                          <Input
                            value={row.source || ""}
                            onChange={(e) => updateRow(row.id, { source: e.target.value })}
                            placeholder={
                              blockType === 'Income' ? "Source" :
                              blockType === 'Fixed Bill' ? "Vendor" :
                              "Description"
                            }
                            className="h-8 text-xs min-w-[120px]"
                          />
                        </td>

                        {/* From Base (Fixed Bill & Flow) */}
                        {(blockType === 'Fixed Bill' || blockType === 'Flow') && (
                          <td className="p-2">
                            <Select
                              value={row.fromBaseId || ""}
                              onValueChange={(value) => updateRow(row.id, { fromBaseId: value })}
                            >
                              <SelectTrigger className="h-8 text-xs min-w-[120px]">
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
                          </td>
                        )}

                        {/* To Base (Income & Flow) */}
                        {(blockType === 'Income' || blockType === 'Flow') && (
                          <td className="p-2">
                            <Select
                              value={row.toBaseId || ""}
                              onValueChange={(value) => updateRow(row.id, { toBaseId: value })}
                            >
                              <SelectTrigger className="h-8 text-xs min-w-[120px]">
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
                          </td>
                        )}

                        {/* Amount */}
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.amount || ""}
                            onChange={(e) => updateRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs w-24"
                          />
                        </td>

                        {/* Flow Type (Flow only) */}
                        {blockType === 'Flow' && (
                          <td className="p-2">
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
                              <SelectTrigger className="h-8 text-xs min-w-[100px]">
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
                          </td>
                        )}

                        {/* Category */}
                        <td className="p-2">
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
                            <SelectTrigger className="h-8 text-xs min-w-[100px]">
                              <SelectValue placeholder={blockType === 'Flow' ? "Required" : "Optional"} />
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
                        </td>

                        {/* Date */}
                        <td className="p-2">
                          <Input
                            type="date"
                            value={row.date ? format(row.date, 'yyyy-MM-dd') : ''}
                            onChange={(e) => updateRow(row.id, { date: new Date(e.target.value) })}
                            className="h-8 text-xs w-32"
                          />
                        </td>

                        {/* Notes */}
                        <td className="p-2">
                          <Input
                            value={row.notes || ""}
                            onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                            placeholder="Optional"
                            className="h-8 text-xs min-w-[100px]"
                          />
                        </td>

                        {/* Execute Checkbox */}
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={row.executed}
                            onCheckedChange={(checked) => updateRow(row.id, { executed: checked as boolean })}
                          />
                        </td>

                        {/* Delete */}
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRow(row.id)}
                            disabled={rows.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50 font-semibold sticky bottom-0">
                    <tr>
                      <td colSpan={blockType === 'Flow' ? 4 : 3} className="p-2 text-right text-sm">
                        Total:
                      </td>
                      <td className="p-2 text-sm">${total.toFixed(2)}</td>
                      <td colSpan={blockType === 'Flow' ? 6 : 5}></td>
                    </tr>
                  </tfoot>
                </table>
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
                  const total = template.rows.reduce((sum, row) => sum + row.amount, 0);
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
                          <span className="text-xs text-muted-foreground">Total</span>
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
          <Button variant="outline" onClick={() => handleSave(true, false)}>
            Save to Library
          </Button>
          <Button variant="outline" onClick={() => handleSave(true, true)}>
            Save & Insert + Library
          </Button>
          <Button onClick={() => handleSave(false, true)}>Save & Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
