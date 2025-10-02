import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Calendar as CalendarIcon, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { BlockType, Row } from "@/types";

interface CreateBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId: string;
  bandInfo: { title: string; startDate: Date; endDate: Date };
  blockType: BlockType; // Preselected type
}

export function CreateBlockDialog({ open, onOpenChange, bandId, bandInfo, blockType }: CreateBlockDialogProps) {
  const bases = useStore((state) => state.bases);
  const library = useStore((state) => state.library);
  const owners = useStore((state) => state.owners);
  const categories = useStore((state) => state.categories);
  const vendors = useStore((state) => state.vendors);
  const flowTypes = useStore((state) => state.flowTypes);
  const addBlock = useStore((state) => state.addBlock);
  const saveToLibrary = useStore((state) => state.saveToLibrary);
  const addToMasterList = useStore((state) => state.addToMasterList);

  const [activeTab, setActiveTab] = useState<"new" | "templates">("new");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [defaultOwner, setDefaultOwner] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  
  // Flow allocation state
  const [allocationBasis, setAllocationBasis] = useState<number>(0);

  // Initialize when dialog opens
  useEffect(() => {
    if (open) {
      setDate(bandInfo.startDate);
      setTitle(`${blockType} - ${bandInfo.title}`);
      setDefaultOwner(owners[0] || "");
      if (rows.length === 0) {
        addRow();
      }
    }
  }, [open, bandInfo, blockType]);

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
      date: date,
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

  const validateAndSave = (saveToLib: boolean = false) => {
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
      if (row.amount <= 0) {
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
        if (!row.category?.trim()) {
          toast.error("Flow rows must have a category");
          return;
        }
      }
    }

    if (saveToLib) {
      // Save to library
      addBlock({
        type: blockType,
        title: title.trim(),
        date: new Date(),
        tags: [],
        rows: rows,
        bandId: '', // Empty bandId indicates it's a template
        isTemplate: true,
      });
      toast.success("Saved to library");
    } else {
      // Insert into band
      addBlock({
        type: blockType,
        title: title.trim(),
        date,
        tags: [],
        rows: rows,
        bandId,
      });
      toast.success("Block created");
      resetForm();
      onOpenChange(false);
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
    setDate(bandInfo.startDate);
    setRows([]);
    setAllocationBasis(0);
  };

  const filteredTemplates = library.filter((t) => t.type === blockType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create {blockType} Block</DialogTitle>
          <DialogDescription>
            Creating in {bandInfo.title} • {format(bandInfo.startDate, 'MMM d')} - {format(bandInfo.endDate, 'MMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "new" | "templates")}>
          <TabsList>
            <TabsTrigger value="new">New Block</TabsTrigger>
            <TabsTrigger value="templates">Templates ({filteredTemplates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            {/* Block Header Fields */}
            <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(date, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Default Owner</Label>
                <Select value={defaultOwner} onValueChange={setDefaultOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Transactions</Label>
                <Button size="sm" onClick={addRow}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Row
                </Button>
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
                          <Select value={row.owner} onValueChange={(v) => updateRow(row.id, { owner: v })}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {owners.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <Input
                            className="h-8"
                            value={row.category || ""}
                            onChange={(e) => updateRow(row.id, { category: e.target.value })}
                            placeholder="Optional"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="date"
                            className="h-8"
                            value={format(row.date, 'yyyy-MM-dd')}
                            onChange={(e) => updateRow(row.id, { date: new Date(e.target.value) })}
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

            {/* Footer Totals */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex gap-6">
                <div>
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="ml-2 text-lg font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateTotal())}
                  </span>
                </div>
                {blockType === 'Flow' && allocationBasis > 0 && (
                  <>
                    <div>
                      <span className="text-sm text-muted-foreground">Allocated:</span>
                      <span className="ml-2 text-lg font-bold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateFlowAllocated())}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Remaining:</span>
                      <span className="ml-2 text-lg font-bold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateFlowRemaining())}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{rows.length} row(s)</span>
            </div>
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
                            <span>{[...new Set(template.rows.map(r => r.owner))].join(', ')}</span>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => validateAndSave(true)}>
            Save to Library
          </Button>
          <Button onClick={() => validateAndSave(false)}>
            Save & Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
