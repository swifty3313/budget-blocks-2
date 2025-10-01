import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Building2, Plus } from "lucide-react";
import { ManageBasesDialog } from "./ManageBasesDialog";
import { getTextColorForBackground } from "@/lib/colorUtils";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

const getBaseColor = (type: string) => {
  const colors: Record<string, string> = {
    'Checking': 'bg-primary/10 text-primary',
    'Savings': 'bg-secondary/10 text-secondary',
    'Credit': 'bg-destructive/10 text-destructive',
    'Loan': 'bg-warning/10 text-warning',
    'Vault': 'bg-accent/10 text-accent',
    'Goal': 'bg-success/10 text-success',
  };
  return colors[type] || 'bg-muted text-muted-foreground';
};

export function BaseBlocksPanel() {
  const bases = useStore((state) => state.bases);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Bases</h2>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Manage Bases
        </Button>
      </div>

      {bases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No bases yet. Create your first account to get started.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="mt-4">
              Create Base
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {bases.map((base) => (
            <Card key={base.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 px-3 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <CardTitle className="text-sm leading-tight truncate">{base.name}</CardTitle>
                    {base.institution && (
                      <CardDescription className="text-xs leading-tight truncate">
                        {base.institution}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant="secondary" className={`${getBaseColor(base.type)} text-xs px-1.5 py-0 shrink-0`}>
                    {base.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Balance</span>
                    {base.tagColor ? (
                      <span 
                        className="text-lg font-bold px-2 py-0.5 rounded"
                        style={{ 
                          backgroundColor: base.tagColor,
                          color: getTextColorForBackground(base.tagColor)
                        }}
                      >
                        {formatCurrency(base.balance)}
                      </span>
                    ) : (
                      <span className={`text-lg font-bold ${
                        base.balance >= 0 ? 'text-kpi-positive' : 'text-kpi-negative'
                      }`}>
                        {formatCurrency(base.balance)}
                      </span>
                    )}
                  </div>
                  {base.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {base.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                          {tag}
                        </Badge>
                      ))}
                      {base.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          +{base.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ManageBasesDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
