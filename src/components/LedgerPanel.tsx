import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { ChevronDown, ChevronRight, ChevronLeft, Calendar, Settings, Trash2, Plus, Receipt, FileText } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth, differenceInMonths, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { ManageBlockDialog } from "@/components/ManageBlockDialog";
import { CalculatorPopover } from "@/components/CalculatorPopover";
import { LedgerFilterBar, type LedgerFilters } from "@/components/LedgerFilterBar";
import { BandSettingsDialog } from "@/components/BandSettingsDialog";
import { PickFixedBillsDialog } from "@/components/PickFixedBillsDialog";
import { ManageFixedBillsDialog } from "@/components/ManageFixedBillsDialog";
import { QuickExpenseDialog } from "@/components/QuickExpenseDialog";
import { CreateBlockDialog } from "@/components/CreateBlockDialog";
import { EditBlockDialog } from "@/components/EditBlockDialog";
import { BlockTypeChooserDialog } from "@/components/BlockTypeChooserDialog";
import { TemplateChooserDialog } from "@/components/TemplateChooserDialog";
import type { Block, PayPeriodBand, Row, BlockType } from "@/types";
import { v4 as uuidv4 } from "uuid";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

const getBlockTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    'Income': 'bg-success/10 text-success border-success/20',
    'Fixed Bill': 'bg-warning/10 text-warning border-warning/20',
    'Flow': 'bg-accent/10 text-accent border-accent/20',
  };
  return colors[type] || 'bg-muted text-muted-foreground';
};

// Helper to calculate block total
const calculateBlockTotal = (rows: any[]): number => {
  return rows.reduce((sum, row) => sum + row.amount, 0);
};

export function LedgerPanel({ 
  onNewBlockInBand,
  onNewBlock,
  onManagePeriods
}: { 
  onNewBlockInBand?: (
    bandId: string, 
    bandInfo: { title: string; startDate: Date; endDate: Date },
    initialBasis?: number,
    basisSource?: 'calculator',
    availableToAllocate?: number
  ) => void;
  onNewBlock?: () => void;
  onManagePeriods?: () => void;
}) {
  const bands = useStore((state) => state.bands);
  const blocks = useStore((state) => state.blocks);
  const deleteBlock = useStore((state) => state.deleteBlock);
  const executeRow = useStore((state) => state.executeRow);
  const undoExecuteRow = useStore((state) => state.undoExecuteRow);
  const bases = useStore((state) => state.bases);
  const addBlock = useStore((state) => state.addBlock);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showArchived, setShowArchived] = useState(false);
  const [bandSettingsId, setBandSettingsId] = useState<string | null>(null);
  const [pickBillsBand, setPickBillsBand] = useState<PayPeriodBand | null>(null);
  const [showManageBills, setShowManageBills] = useState(false);
  const [quickExpenseBand, setQuickExpenseBand] = useState<{ id: string; title: string; startDate: Date; endDate: Date } | null>(null);
  const [lastInsertedBlockId, setLastInsertedBlockId] = useState<string | null>(null);
  const [createBlockBand, setCreateBlockBand] = useState<{ id: string; title: string; startDate: Date; endDate: Date; type: BlockType; availableToAllocate?: number } | null>(null);
  const [blockTypeChooserBand, setBlockTypeChooserBand] = useState<{ id: string; title: string; startDate: Date; endDate: Date; availableToAllocate?: number } | null>(null);
  const [templateChooserBand, setTemplateChooserBand] = useState<{ id: string; title: string; startDate: Date; endDate: Date; availableToAllocate?: number } | null>(null);
  
  
  // Filter state - persisted to localStorage
  const [filters, setFilters] = useState<LedgerFilters>(() => {
    const stored = localStorage.getItem('ledger-filters');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          dateRange: {
            ...parsed.dateRange,
            from: new Date(parsed.dateRange.from),
            to: new Date(parsed.dateRange.to),
          },
        };
      } catch {
        // Fall through to default
      }
    }
    const now = new Date();
    return {
      dateRange: {
        from: startOfMonth(now),
        to: endOfMonth(now),
        preset: 'This month',
      },
      owners: [],
      accounts: [],
      types: [],
      status: 'all' as const,
      search: '',
    };
  });

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem('ledger-filters', JSON.stringify(filters));
  }, [filters]);

  // Sync selected month with date range filter
  useEffect(() => {
    if (filters.dateRange.preset === 'This month') {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      if (
        filters.dateRange.from.getTime() !== monthStart.getTime() ||
        filters.dateRange.to.getTime() !== monthEnd.getTime()
      ) {
        setFilters(prev => ({
          ...prev,
          dateRange: {
            from: monthStart,
            to: monthEnd,
            preset: 'This month',
          },
        }));
      }
    }
  }, [selectedMonth]);

  // Get unique months from bands (use displayMonth if available)
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    bands.forEach((band) => {
      if (band.displayMonth) {
        monthSet.add(band.displayMonth);
      } else {
        const monthKey = format(band.startDate, 'yyyy-MM');
        monthSet.add(monthKey);
      }
    });
    return Array.from(monthSet).sort().reverse();
  }, [bands]);

  // Helper function to check if a row matches filters
  const rowMatchesFilters = (row: any, block: Block) => {
    // Owner filter
    if (filters.owners.length > 0 && !filters.owners.includes(row.owner)) {
      return false;
    }

    // Account filter (from/to base)
    if (filters.accounts.length > 0) {
      const hasMatchingAccount = 
        (row.fromBaseId && filters.accounts.includes(row.fromBaseId)) ||
        (row.toBaseId && filters.accounts.includes(row.toBaseId));
      if (!hasMatchingAccount) return false;
    }

    // Type filter
    if (filters.types.length > 0 && !filters.types.includes(block.type)) {
      return false;
    }

    // Status filter
    if (filters.status === 'executed' && !row.executed) return false;
    if (filters.status === 'planned' && row.executed) return false;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesTitle = block.title.toLowerCase().includes(searchLower);
      const matchesSource = row.source?.toLowerCase().includes(searchLower);
      const matchesNotes = row.notes?.toLowerCase().includes(searchLower);
      if (!matchesTitle && !matchesSource && !matchesNotes) return false;
    }

    return true;
  };

  // Helper function to check if a block matches filters (any row matches)
  const blockMatchesFilters = (block: Block) => {
    // Date range filter
    const blockDate = block.date;
    if (!isWithinInterval(blockDate, { start: filters.dateRange.from, end: filters.dateRange.to })) {
      return false;
    }

    // Check if any row matches other filters
    return block.rows.some(row => rowMatchesFilters(row, block));
  };

  const bandSummaries = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const selectedMonthKey = format(selectedMonth, 'yyyy-MM');
    
    return bands
      .filter((band) => {
        // Use displayMonth if available, otherwise fall back to checking date overlap
        if (band.displayMonth) {
          if (band.displayMonth !== selectedMonthKey) return false;
        } else {
          // Fallback: filter by selected month (bands that overlap with the month)
          const overlapsMonth = band.startDate <= monthEnd && band.endDate >= monthStart;
          if (!overlapsMonth) return false;
        }
        
        return true;
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((band) => {
        const bandBlocks = blocks.filter((b) => b.bandId === band.id);
        
        // Calculate unfiltered totals (always show true band totals)
        const expectedIncome = bandBlocks
          .filter((b) => b.type === 'Income')
          .reduce((sum, b) => sum + calculateBlockTotal(b.rows), 0);

        const expectedFixed = bandBlocks
          .filter((b) => b.type === 'Fixed Bill')
          .reduce((sum, b) => sum + calculateBlockTotal(b.rows), 0);

        const availableToAllocate = expectedIncome - expectedFixed;

        const executedCount = bandBlocks.reduce(
          (count, b) => count + b.rows.filter((r) => r.executed).length,
          0
        );

        return {
          bandId: band.id,
          title: band.title,
          startDate: band.startDate,
          endDate: band.endDate,
          expectedIncome,
          expectedFixed,
          availableToAllocate,
          blockCount: bandBlocks.length,
          executedCount,
        };
      });
  }, [bands, blocks, selectedMonth, showArchived]);

  // Check if any filters are active (not defaults)
  const hasActiveFilters = useMemo(() => {
    const now = new Date();
    return (
      filters.dateRange.preset !== 'This month' ||
      filters.owners.length > 0 ||
      filters.accounts.length > 0 ||
      filters.types.length > 0 ||
      filters.status !== 'all' ||
      filters.search !== ''
    );
  }, [filters]);

  // Filter blocks for display
  const getFilteredBlocks = (bandId: string) => {
    const bandBlocks = blocks.filter((b) => b.bandId === bandId);
    if (!hasActiveFilters) return bandBlocks;
    return bandBlocks.filter(blockMatchesFilters);
  };

  // Filter rows for display within a block
  const getFilteredRows = (block: Block) => {
    if (!hasActiveFilters) return block.rows;
    return block.rows.filter(row => rowMatchesFilters(row, block));
  };
  
  const [expandedBands, setExpandedBands] = useState<Set<string>>(new Set());
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [manageBlock, setManageBlock] = useState<Block | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Block | null>(null);
  const [deleteConfirmStrong, setDeleteConfirmStrong] = useState<Block | null>(null);
  const [deleteInputText, setDeleteInputText] = useState("");
  const [showNoBandDialog, setShowNoBandDialog] = useState(false);

  const toggleBand = (bandId: string) => {
    setExpandedBands((prev) => {
      const next = new Set(prev);
      if (next.has(bandId)) {
        next.delete(bandId);
      } else {
        next.add(bandId);
      }
      return next;
    });
  };

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  const handleDeleteFirstConfirm = (block: Block) => {
    const hasExecuted = block.rows.some(r => r.executed);
    if (hasExecuted) {
      // Show second confirmation for executed rows
      setDeleteConfirm(null);
      setDeleteConfirmStrong(block);
      setDeleteInputText("");
    } else {
      // No executed rows, delete immediately
      handleDeleteBlock(block);
    }
  };

  const handleDeleteBlock = (block: Block) => {
    const hasExecuted = block.rows.some(r => r.executed);
    deleteBlock(block.id);
    toast.success(
      hasExecuted 
        ? "Block deleted. Executed rows reversed." 
        : "Block deleted"
    );
    setDeleteConfirm(null);
    setDeleteConfirmStrong(null);
    setDeleteInputText("");
  };

  const getBaseName = (baseId?: string) => {
    if (!baseId) return 'N/A';
    const base = bases.find((b) => b.id === baseId);
    return base?.name || 'Unknown';
  };

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

  const handleMonthSelect = (monthKey: string) => {
    const [year, month] = monthKey.split('-').map(Number);
    setSelectedMonth(new Date(year, month - 1, 1));
  };

  const handleInsertFixedBills = (rows: Row[]) => {
    if (!pickBillsBand) return;
    
    // Create a new Fixed Bill block with the inserted rows
    const newBlock = {
      type: 'Fixed Bill' as const,
      title: `Bills - ${pickBillsBand.title}`,
      date: pickBillsBand.startDate,
      tags: [],
      rows: rows,
      bandId: pickBillsBand.id,
    };
    
    addBlock(newBlock);
    setPickBillsBand(null);
  };


  // Check if there are ANY bands in the system (not just current month)
  const hasBandsInSystem = bands.length > 0;

  const handleNewBlockWithGuard = () => {
    if (!hasBandsInSystem) {
      // Show interstitial when no bands exist
      setShowNoBandDialog(true);
    } else if (onNewBlock) {
      onNewBlock();
    }
  };

  return (
    <div className="space-y-4">
      {/* Ledger Header - Always Visible */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Ledger</h2>
        
        <div className="flex items-center gap-2">
          {/* Pay Periods - always enabled */}
          {onManagePeriods && (
            <Button variant="outline" size="sm" onClick={onManagePeriods}>
              <Settings className="w-4 h-4 mr-2" />
              Pay Periods
            </Button>
          )}
          
          
          {/* Show Archived Toggle - disabled when no bands */}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
              disabled={!hasBandsInSystem}
            />
            <Label 
              htmlFor="show-archived" 
              className={`text-sm ${hasBandsInSystem ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
            >
              Show archived
            </Label>
          </div>
        </div>
      </div>

      {/* Filter Bar - only show if bands exist */}
      {hasBandsInSystem && (
        <LedgerFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />
      )}

      {/* Month Navigation - only show if bands exist */}
      {hasBandsInSystem && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevMonth}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Select
                value={format(selectedMonth, 'yyyy-MM')}
                onValueChange={handleMonthSelect}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue>
                    {format(selectedMonth, 'MMMM yyyy')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((monthKey) => {
                    const [year, month] = monthKey.split('-').map(Number);
                    const date = new Date(year, month - 1, 1);
                    return (
                      <SelectItem key={monthKey} value={monthKey}>
                        {format(date, 'MMMM yyyy')}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {!hasBandsInSystem ? (
          // Empty state when no bands exist in system
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-6">
              <Calendar className="w-16 h-16 text-muted-foreground" />
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">No pay periods yet</h3>
                <p className="text-muted-foreground max-w-md">
                  Create pay periods to start planning blocks and organizing your budget.
                </p>
              </div>
              <div className="flex gap-3">
                {onManagePeriods && (
                  <>
                    <Button onClick={onManagePeriods} size="lg">
                      <Plus className="w-4 h-4 mr-2" />
                      Quick Generate
                    </Button>
                    <Button onClick={onManagePeriods} variant="outline" size="lg">
                      <Settings className="w-4 h-4 mr-2" />
                      Open Manage Pay Periods
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : bandSummaries.length === 0 ? (
          // Empty state when bands exist but none in current view
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <Calendar className="w-12 h-12 text-muted-foreground mb-2" />
              {hasActiveFilters ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Filtered view</Badge>
                  </div>
                  <p className="text-muted-foreground text-center">
                    No bands match current filters
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setFilters({
                      dateRange: {
                        from: startOfMonth(new Date()),
                        to: endOfMonth(new Date()),
                        preset: 'This month',
                      },
                      owners: [],
                      accounts: [],
                      types: [],
                      status: 'all' as const,
                      search: '',
                    })}
                  >
                    Reset filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-center">
                    No bands for {format(selectedMonth, 'MMMM yyyy')}
                  </p>
                  {onManagePeriods && (
                    <Button variant="outline" onClick={onManagePeriods}>
                      <Calendar className="w-4 h-4 mr-2" />
                      Create Pay Periods
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          bandSummaries.map((summary) => {
          const isExpanded = expandedBands.has(summary.bandId);
          const bandBlocks = blocks.filter((b) => b.bandId === summary.bandId);

          return (
            <Card key={summary.bandId} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div 
                  className="flex items-start justify-between"
                  onClick={() => toggleBand(summary.bandId)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{summary.title}</CardTitle>
                          {hasActiveFilters && (
                            <Badge variant="secondary" className="text-xs">
                              Filtered view
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(summary.startDate, 'MMM d')} - {format(summary.endDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="grid grid-cols-3 gap-4 text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">Expected Income</p>
                        <p className="text-sm font-semibold text-success">
                          {formatCurrency(summary.expectedIncome)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Expected Fixed</p>
                        <p className="text-sm font-semibold text-warning">
                          {formatCurrency(summary.expectedFixed)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Available</p>
                        <p className={`text-sm font-semibold ${
                          summary.availableToAllocate >= 0 ? 'text-kpi-positive' : 'text-kpi-negative'
                        }`}>
                          {formatCurrency(summary.availableToAllocate)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBandSettingsId(summary.bandId);
                      }}
                      title="Band Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {onNewBlockInBand && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateBlockBand({
                            id: summary.bandId,
                            title: summary.title,
                            startDate: summary.startDate,
                            endDate: summary.endDate,
                            type: 'Income',
                          });
                        }}
                        className="flex-1"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Income Block
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateBlockBand({
                            id: summary.bandId,
                            title: summary.title,
                            startDate: summary.startDate,
                            endDate: summary.endDate,
                            type: 'Fixed Bill',
                          });
                        }}
                        className="flex-1"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Fixed Block
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateBlockBand({
                            id: summary.bandId,
                            title: summary.title,
                            startDate: summary.startDate,
                            endDate: summary.endDate,
                            type: 'Flow',
                            availableToAllocate: summary.availableToAllocate,
                          });
                        }}
                        className="flex-1"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Flow Block
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickExpenseBand({
                            id: summary.bandId,
                            title: summary.title,
                            startDate: summary.startDate,
                            endDate: summary.endDate,
                          });
                        }}
                        className="flex-1"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Transaction
                      </Button>
                    </div>
                  </div>
                )}
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-4 space-y-3">
                  {(() => {
                    const filteredBlocks = getFilteredBlocks(summary.bandId);
                    if (filteredBlocks.length === 0) {
                    return (
                        <div className="text-center py-8">
                          <p className="text-sm text-muted-foreground mb-3">
                            {hasActiveFilters ? 'No blocks match filters' : 'No blocks in this period'}
                          </p>
                          {!hasActiveFilters && (
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => setBlockTypeChooserBand({
                                  id: summary.bandId,
                                  title: summary.title,
                                  startDate: summary.startDate,
                                  endDate: summary.endDate,
                                  availableToAllocate: summary.availableToAllocate,
                                })}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Create First Block
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setTemplateChooserBand({
                                  id: summary.bandId,
                                  title: summary.title,
                                  startDate: summary.startDate,
                                  endDate: summary.endDate,
                                  availableToAllocate: summary.availableToAllocate,
                                })}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Insert from Template
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return filteredBlocks.map((block) => {
                      const isBlockExpanded = expandedBlocks.has(block.id);
                      const filteredRows = getFilteredRows(block);
                      const executedCount = filteredRows.filter((r) => r.executed).length;
                      const total = filteredRows.reduce((sum, r) => sum + r.amount, 0);

                      return (
                        <Card key={block.id} className="border-l-4" style={{
                          borderLeftColor: block.type === 'Income' ? 'hsl(var(--success))' :
                                          block.type === 'Fixed Bill' ? 'hsl(var(--warning))' :
                                          'hsl(var(--accent))'
                        }}>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <div 
                                className="flex items-center gap-3 flex-1 cursor-pointer"
                                onClick={() => toggleBlock(block.id)}
                              >
                                {isBlockExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold">{block.title}</h4>
                                    <Badge variant="outline" className={getBlockTypeColor(block.type)}>
                                      {block.type}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(block.date, 'MMM d, yyyy')} • {[...new Set(block.rows.map(r => r.owner))].join(', ')}
                                  </p>
                                </div>
                              </div>
                               <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="font-semibold">{formatCurrency(total)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {executedCount}/{block.rows.length} executed
                                  </p>
                                </div>
                                 <Button
                                   variant="outline"
                                   size="icon"
                                   className="h-8 w-8"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setManageBlock(block);
                                   }}
                                   title="Edit Block"
                                 >
                                   <Settings className="w-4 h-4" />
                                 </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirm(block);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>

                          {isBlockExpanded && block.rows.length > 0 && (
                            <CardContent className="pt-0 space-y-3">
                              <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th className="text-left p-2 font-medium">Execute</th>
                                      <th className="text-left p-2 font-medium">From</th>
                                      <th className="text-left p-2 font-medium">To</th>
                                      <th className="text-left p-2 font-medium">Amount</th>
                                      <th className="text-left p-2 font-medium">Category</th>
                                      <th className="text-left p-2 font-medium">Notes</th>
                                    </tr>
                                  </thead>
                                   <tbody>
                                     {filteredRows.map((row) => (
                                      <tr key={row.id} className="border-t">
                                        <td className="p-2">
                                          <Checkbox
                                            checked={row.executed}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                executeRow(block.id, row.id);
                                              } else {
                                                undoExecuteRow(block.id, row.id);
                                              }
                                            }}
                                          />
                                        </td>
                                        <td className="p-2">{getBaseName(row.fromBaseId)}</td>
                                        <td className="p-2">{getBaseName(row.toBaseId)}</td>
                                        <td className="p-2 font-medium">
                                          {formatCurrency(row.amount)}
                                        </td>
                                        <td className="p-2 text-muted-foreground">
                                          {row.category || '—'}
                                        </td>
                                        <td className="p-2 text-muted-foreground text-xs">
                                          {row.notes || '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setManageBlock(block)}
                                >
                                  <Settings className="w-4 h-4 mr-2" />
                                  Manage
                                </Button>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    });
                  })()}
                </CardContent>
              )}
            </Card>
          );
        })
        )}
      </div>

      {/* No Band Guard Dialog */}
      <AlertDialog open={showNoBandDialog} onOpenChange={setShowNoBandDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No pay periods available</AlertDialogTitle>
            <AlertDialogDescription>
              You need at least one pay period to insert a block. Create pay periods first to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {onManagePeriods && (
              <>
                <AlertDialogAction
                  onClick={() => {
                    setShowNoBandDialog(false);
                    onManagePeriods();
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Quick Generate
                </AlertDialogAction>
                <Button
                  onClick={() => {
                    setShowNoBandDialog(false);
                    onManagePeriods();
                  }}
                  variant="outline"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Open Manage Pay Periods
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditBlockDialog
        block={manageBlock}
        open={!!manageBlock}
        onOpenChange={(open) => !open && setManageBlock(null)}
        onDelete={(block) => setDeleteConfirm(block)}
        availableToAllocate={
          manageBlock ? bandSummaries.find(s => s.bandId === manageBlock.bandId)?.availableToAllocate : undefined
        }
      />

      {/* First confirmation dialog - always shown */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this block?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the block and all its rows from this pay period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteFirstConfirm(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Second confirmation dialog - only for executed rows */}
      <AlertDialog open={!!deleteConfirmStrong} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmStrong(null);
          setDeleteInputText("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This block has executed rows.</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Executed rows will be un-executed.</li>
                  <li>All balance changes will be reversed.</li>
                  <li>This action cannot be undone.</li>
                </ul>
                <div className="pt-4">
                  <label htmlFor="delete-confirm-input" className="text-sm font-medium block mb-2">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </label>
                  <Input
                    id="delete-confirm-input"
                    type="text"
                    value={deleteInputText}
                    onChange={(e) => setDeleteInputText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteConfirmStrong(null);
              setDeleteInputText("");
            }}>
              Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmStrong && handleDeleteBlock(deleteConfirmStrong)}
              disabled={deleteInputText !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Band Settings Dialog */}
      <BandSettingsDialog
        bandId={bandSettingsId}
        open={bandSettingsId !== null}
        onOpenChange={(open) => !open && setBandSettingsId(null)}
      />

      {/* Pick Fixed Bills Dialog */}
      <PickFixedBillsDialog
        open={!!pickBillsBand}
        onOpenChange={(open) => {
          if (!open) setPickBillsBand(null);
        }}
        band={pickBillsBand}
        onInsert={handleInsertFixedBills}
        onManageLibrary={() => {
          setShowManageBills(true);
        }}
      />

      {/* Manage Fixed Bills Dialog */}
      <ManageFixedBillsDialog
        open={showManageBills}
        onOpenChange={setShowManageBills}
      />

      {/* Quick Expense Dialog */}
      {quickExpenseBand && (
        <QuickExpenseDialog
          open={quickExpenseBand !== null}
          onOpenChange={(open) => !open && setQuickExpenseBand(null)}
          bandId={quickExpenseBand.id}
          bandInfo={quickExpenseBand}
        />
      )}

      {/* Unified Create Block Dialog */}
      {createBlockBand && (
        <CreateBlockDialog
          open={createBlockBand !== null}
          onOpenChange={(open) => !open && setCreateBlockBand(null)}
          bandId={createBlockBand.id}
          bandInfo={createBlockBand}
          blockType={createBlockBand.type}
          availableToAllocate={createBlockBand.availableToAllocate}
        />
      )}

      {/* Block Type Chooser Dialog */}
      {blockTypeChooserBand && (
        <BlockTypeChooserDialog
          open={blockTypeChooserBand !== null}
          onOpenChange={(open) => !open && setBlockTypeChooserBand(null)}
          onSelectType={(type) => {
            if (type === 'Transaction') {
              setQuickExpenseBand(blockTypeChooserBand);
            } else {
              setCreateBlockBand({
                ...blockTypeChooserBand,
                type: type as BlockType,
              });
            }
            setBlockTypeChooserBand(null);
          }}
          bandTitle={blockTypeChooserBand.title}
        />
      )}

      {/* Template Chooser Dialog */}
      {templateChooserBand && (
        <TemplateChooserDialog
          open={templateChooserBand !== null}
          onOpenChange={(open) => !open && setTemplateChooserBand(null)}
          onSelectTemplate={(template) => {
            // Insert the template into the band
            addBlock({
              type: template.type,
              title: template.title,
              date: templateChooserBand.startDate,
              tags: template.tags || [],
              rows: template.rows.map((r: Row) => ({
                ...r,
                id: uuidv4(),
                date: templateChooserBand.startDate,
                executed: false,
              })),
              bandId: templateChooserBand.id,
            });
            
            toast.success(`Inserted '${template.title}' (${template.rows.length} rows)`);
            setTemplateChooserBand(null);
          }}
          bandTitle={templateChooserBand.title}
        />
      )}

    </div>
  );
}
