import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore, selectKPIs } from "@/lib/store";
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet } from "lucide-react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

export function KPIPanel() {
  const kpis = useStore(selectKPIs);

  const kpiCards = [
    {
      title: "Total Cash Available",
      value: kpis.totalCash,
      icon: Wallet,
      colorClass: "text-kpi-positive",
      description: "Checking + Savings + Vault",
    },
    {
      title: "Total Credit Card Debt",
      value: kpis.totalCreditDebt,
      icon: CreditCard,
      colorClass: "text-kpi-negative",
      description: "Credit balances",
    },
    {
      title: "Net Worth",
      value: kpis.netWorth,
      icon: DollarSign,
      colorClass: kpis.netWorth >= 0 ? "text-kpi-positive" : "text-kpi-negative",
      description: "Assets - Liabilities",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Financial Overview</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          const isPositive = kpi.value >= 0;
          const TrendIcon = isPositive ? TrendingUp : TrendingDown;

          return (
            <Card key={kpi.title} className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
                <Icon className="w-full h-full" />
              </div>
              
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <Icon className={`w-5 h-5 ${kpi.colorClass}`} />
              </CardHeader>
              
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-bold">{formatCurrency(Math.abs(kpi.value))}</div>
                  <TrendIcon className={`w-5 h-5 ${kpi.colorClass}`} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{kpi.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
