import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Building2, Plus } from "lucide-react";
import { ManageBasesDialog } from "./ManageBasesDialog";

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bases.map((base) => (
            <Card key={base.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{base.name}</CardTitle>
                    {base.institution && (
                      <CardDescription className="text-xs">
                        {base.institution}
                        {base.identifier && ` • ${base.identifier}`}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant="secondary" className={getBaseColor(base.type)}>
                    {base.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <span className={`text-2xl font-bold ${
                      base.balance >= 0 ? 'text-kpi-positive' : 'text-kpi-negative'
                    }`}>
                      {formatCurrency(base.balance)}
                    </span>
                  </div>
                  {base.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {base.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
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
