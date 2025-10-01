import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, addMonths, startOfMonth, endOfMonth } from "date-fns";

interface ManagePayPeriodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagePayPeriodsDialog({ open, onOpenChange }: ManagePayPeriodsDialogProps) {
  const bands = useStore((state) => state.bands);
  const addBand = useStore((state) => state.addBand);
  const updateBand = useStore((state) => state.updateBand);
  const deleteBand = useStore((state) => state.deleteBand);

  const [formData, setFormData] = useState({
    title: "",
    startDate: "",
    endDate: "",
  });

  const handleGenerateMonthly = () => {
    const now = new Date();
    const periods = [];

    // Generate 3 past months and 3 future months
    for (let i = -3; i <= 3; i++) {
      const date = addMonths(now, i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      periods.push({
        title: format(date, 'MMMM yyyy'),
        startDate: start,
        endDate: end,
        order: i + 3,
      });
    }

    periods.forEach((period) => addBand(period));
    toast.success(`Generated ${periods.length} monthly periods`);
  };

  const handleGenerateBiweekly = () => {
    const now = new Date();
    const periods = [];
    let currentStart = addWeeks(now, -6); // Start 6 weeks back

    // Generate 6 biweekly periods
    for (let i = 0; i < 6; i++) {
      const start = currentStart;
      const end = addWeeks(start, 2);
      end.setDate(end.getDate() - 1); // End day before next period starts

      periods.push({
        title: `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`,
        startDate: start,
        endDate: end,
        order: i,
      });

      currentStart = addWeeks(currentStart, 2);
    }

    periods.forEach((period) => addBand(period));
    toast.success(`Generated ${periods.length} biweekly periods`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.startDate || !formData.endDate) {
      toast.error("Please fill in all fields");
      return;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);

    if (start >= end) {
      toast.error("End date must be after start date");
      return;
    }

    addBand({
      title: formData.title.trim(),
      startDate: start,
      endDate: end,
      order: bands.length,
    });

    toast.success("Pay period created");
    setFormData({ title: "", startDate: "", endDate: "" });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this pay period?")) {
      deleteBand(id);
      toast.success("Pay period deleted");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Pay Periods</DialogTitle>
          <DialogDescription>
            Create and manage your pay period bands
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Generate */}
          <div className="space-y-3">
            <h3 className="font-semibold">Quick Generate</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGenerateMonthly}>
                <Calendar className="w-4 h-4 mr-2" />
                Generate Monthly (6 periods)
              </Button>
              <Button variant="outline" onClick={handleGenerateBiweekly}>
                <Calendar className="w-4 h-4 mr-2" />
                Generate Biweekly (6 periods)
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Form */}
            <div className="space-y-4">
              <h3 className="font-semibold">Add Custom Period</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., January 2025"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Period
                </Button>
              </form>
            </div>

            {/* List */}
            <div className="space-y-4">
              <h3 className="font-semibold">Existing Periods ({bands.length})</h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {bands.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No pay periods created yet
                  </p>
                ) : (
                  bands
                    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                    .map((band) => (
                      <div
                        key={band.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{band.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(band.startDate, 'MMM d, yyyy')} -{' '}
                              {format(band.endDate, 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(band.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
