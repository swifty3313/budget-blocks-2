import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Building2, Plus } from "lucide-react";
import { ManageBasesDialog } from "./ManageBasesDialog";
import { adjustColorForContrast } from "@/lib/colorUtils";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

const getBaseColor = (type: string) => {
  const colors: Record<string, string> = {
    'Checking': 'bg-primary/10 text-primary border-primary/20',
    'Savings': 'bg-secondary/10 text-secondary border-secondary/20',
    'Credit': 'bg-destructive/10 text-destructive border-destructive/20',
    'Loan': 'bg-warning/10 text-warning border-warning/20',
    'Vault': 'bg-accent/10 text-accent border-accent/20',
    'Goal': 'bg-success/10 text-success border-success/20',
  };
  return colors[type] || 'bg-muted text-muted-foreground border-border';
};

const getBadgeStyles = (tagColor: string | undefined) => {
  if (!tagColor) return {};
  
  // Create a light tint background (10% opacity)
  const rgb = parseInt(tagColor.slice(1), 16);
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
    color: adjustColorForContrast(tagColor),
    borderColor: `rgba(${r}, ${g}, ${b}, 0.2)`,
  };
};

const getAmountColor = (tagColor: string | undefined, balance: number) => {
  if (!tagColor) {
    return balance >= 0 ? 'text-kpi-positive' : 'text-kpi-negative';
  }
  
  // Use adjusted color for better contrast
  const adjustedColor = adjustColorForContrast(tagColor);
  return adjustedColor;
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
                  <Badge 
                    variant="outline" 
                    className={`text-xs px-1.5 py-0 shrink-0 ${!base.tagColor ? getBaseColor(base.type) : 'border'}`}
                    style={base.tagColor ? getBadgeStyles(base.tagColor) : undefined}
                  >
                    {base.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Balance</span>
                    <span 
                      className={`text-lg font-bold ${!base.tagColor ? getAmountColor(base.tagColor, base.balance) : ''}`}
                      style={base.tagColor ? { color: getAmountColor(base.tagColor, base.balance) } : undefined}
                    >
                      {formatCurrency(base.balance)}
                    </span>
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
