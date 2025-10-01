import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { ChevronDown, ChevronRight, Calendar, Settings, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ManageBlockDialog } from "@/components/ManageBlockDialog";
import type { Block } from "@/types";

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

export function LedgerPanel({ onNewBlockInBand }: { onNewBlockInBand?: (bandId: string, bandInfo: { title: string; startDate: Date; endDate: Date }) => void }) {
  const bands = useStore((state) => state.bands);
  const blocks = useStore((state) => state.blocks);
  const deleteBlock = useStore((state) => state.deleteBlock);
  const executeRow = useStore((state) => state.executeRow);
  const undoExecuteRow = useStore((state) => state.undoExecuteRow);
  const bases = useStore((state) => state.bases);
  
  const bandSummaries = useMemo(() => {
    return bands
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((band) => {
        const bandBlocks = blocks.filter((b) => b.bandId === band.id);
        
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
  }, [bands, blocks]);
  
  const [expandedBands, setExpandedBands] = useState<Set<string>>(new Set());
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [manageBlock, setManageBlock] = useState<Block | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Block | null>(null);
  const [deleteConfirmStrong, setDeleteConfirmStrong] = useState<Block | null>(null);
  const [deleteInputText, setDeleteInputText] = useState("");

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

  if (bandSummaries.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Ledger</h2>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No pay periods created yet. Set up your pay periods to start organizing blocks.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Ledger</h2>

      <div className="space-y-4">
        {bandSummaries.map((summary) => {
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
                    <div>
                      <CardTitle className="text-lg">{summary.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(summary.startDate, 'MMM d')} - {format(summary.endDate, 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>

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
                </div>

                {onNewBlockInBand && (
                  <div className="mt-3 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewBlockInBand(summary.bandId, {
                          title: summary.title,
                          startDate: summary.startDate,
                          endDate: summary.endDate,
                        });
                      }}
                      className="w-full"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Add Block to this Period
                    </Button>
                  </div>
                )}
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-4 space-y-3">
                  {bandBlocks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-3">
                        No blocks in this period
                      </p>
                      {onNewBlockInBand && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => onNewBlockInBand(summary.bandId, {
                            title: summary.title,
                            startDate: summary.startDate,
                            endDate: summary.endDate,
                          })}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Create First Block
                        </Button>
                      )}
                    </div>
                  ) : (
                    bandBlocks.map((block) => {
                      const isBlockExpanded = expandedBlocks.has(block.id);
                      const executedCount = block.rows.filter((r) => r.executed).length;
                      const total = block.rows.reduce((sum, r) => sum + r.amount, 0);

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
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setManageBlock(block);
                                  }}
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
                                    {block.rows.map((row) => (
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
                                  className="flex-1"
                                  onClick={() => setManageBlock(block)}
                                >
                                  <Settings className="w-4 h-4 mr-2" />
                                  Manage
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirm(block)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </Button>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <ManageBlockDialog
        block={manageBlock}
        open={!!manageBlock}
        onOpenChange={(open) => !open && setManageBlock(null)}
        onDelete={(block) => setDeleteConfirm(block)}
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
    </div>
  );
}
