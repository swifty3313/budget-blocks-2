import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore, selectBandSummaries } from "@/lib/store";
import { ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

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

export function LedgerPanel() {
  const bandSummaries = useStore(selectBandSummaries);
  const blocks = useStore((state) => state.blocks);
  const executeRow = useStore((state) => state.executeRow);
  const undoExecuteRow = useStore((state) => state.undoExecuteRow);
  const bases = useStore((state) => state.bases);
  
  const [expandedBands, setExpandedBands] = useState<Set<string>>(new Set());
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

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
                onClick={() => toggleBand(summary.bandId)}
              >
                <div className="flex items-start justify-between">
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
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-4 space-y-3">
                  {bandBlocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No blocks in this period
                    </p>
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
                          <CardHeader
                            className="cursor-pointer py-3"
                            onClick={() => toggleBlock(block.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
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
                                    {format(block.date, 'MMM d, yyyy')} • {block.owner}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{formatCurrency(total)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {executedCount}/{block.rows.length} executed
                                </p>
                              </div>
                            </div>
                          </CardHeader>

                          {isBlockExpanded && block.rows.length > 0 && (
                            <CardContent className="pt-0">
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
    </div>
  );
}
