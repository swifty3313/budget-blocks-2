import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, addMonths, addDays, startOfMonth, endOfMonth, setDate, lastDayOfMonth, startOfWeek, isFriday, nextFriday } from "date-fns";

interface ManagePayPeriodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FrequencyType = 'monthly' | 'semi-monthly' | 'bi-weekly' | 'weekly';

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

  // Quick Generate state
  const [selectedFrequency, setSelectedFrequency] = useState<FrequencyType>('monthly');
  const [showSemiMonthlyConfig, setShowSemiMonthlyConfig] = useState(false);
  const [showWeeklyConfig, setShowWeeklyConfig] = useState(false);
  
  // Semi-Monthly config
  const [semiMonthlyDay1, setSemiMonthlyDay1] = useState(1);
  const [semiMonthlyDay2, setSemiMonthlyDay2] = useState(15);
  
  // Weekly/Bi-Weekly config
  const [anchorDate, setAnchorDate] = useState(format(new Date(), 'yyyy-MM-dd'));

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

  const handleGenerateSemiMonthly = () => {
    const now = new Date();
    const periods = [];
    
    // Generate 3 months of semi-monthly periods (6 periods total, 3 past and 3 future)
    for (let monthOffset = -3; monthOffset <= 2; monthOffset++) {
      const currentMonth = addMonths(now, monthOffset);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      // First period (day1 to day before day2)
      let firstStart = new Date(year, month, semiMonthlyDay1);
      let firstEnd: Date;
      
      if (semiMonthlyDay2 === 0) {
        // If day2 is "last day", first period ends day before last day
        const lastDay = lastDayOfMonth(currentMonth);
        firstEnd = addDays(lastDay, -1);
      } else {
        firstEnd = new Date(year, month, semiMonthlyDay2 - 1);
      }
      
      periods.push({
        title: `${format(currentMonth, 'MMM yyyy')} (1st half)`,
        startDate: firstStart,
        endDate: firstEnd,
        order: monthOffset * 2,
      });
      
      // Second period (day2 to last day of month)
      let secondStart: Date;
      if (semiMonthlyDay2 === 0) {
        secondStart = lastDayOfMonth(currentMonth);
      } else {
        secondStart = new Date(year, month, semiMonthlyDay2);
      }
      const secondEnd = lastDayOfMonth(currentMonth);
      
      periods.push({
        title: `${format(currentMonth, 'MMM yyyy')} (2nd half)`,
        startDate: secondStart,
        endDate: secondEnd,
        order: monthOffset * 2 + 1,
      });
    }

    periods.forEach((period) => addBand(period));
    toast.success(`Generated ${periods.length} semi-monthly periods`);
    setShowSemiMonthlyConfig(false);
  };

  const handleGenerateWeekly = () => {
    const anchor = new Date(anchorDate);
    const periods = [];
    
    // Generate 6 weekly periods: 3 past and 3 future from anchor
    for (let i = -3; i <= 2; i++) {
      const start = addWeeks(anchor, i);
      const end = addDays(start, 6); // 7 days (inclusive)
      
      periods.push({
        title: `Week of ${format(start, 'MMM d, yyyy')}`,
        startDate: start,
        endDate: end,
        order: i + 3,
      });
    }

    periods.forEach((period) => addBand(period));
    toast.success(`Generated ${periods.length} weekly periods`);
    setShowWeeklyConfig(false);
  };

  const handleGenerateBiWeekly = () => {
    const anchor = new Date(anchorDate);
    const periods = [];
    
    // Generate 6 bi-weekly periods: 3 past and 3 future from anchor
    for (let i = -3; i <= 2; i++) {
      const start = addWeeks(anchor, i * 2);
      const end = addDays(addWeeks(start, 2), -1); // 14 days
      
      periods.push({
        title: `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`,
        startDate: start,
        endDate: end,
        order: i + 3,
      });
    }

    periods.forEach((period) => addBand(period));
    toast.success(`Generated ${periods.length} bi-weekly periods`);
    setShowWeeklyConfig(false);
  };

  const handleQuickGenerate = () => {
    if (selectedFrequency === 'monthly') {
      handleGenerateMonthly();
    } else if (selectedFrequency === 'semi-monthly') {
      setShowSemiMonthlyConfig(true);
    } else if (selectedFrequency === 'weekly') {
      setShowWeeklyConfig(true);
    } else if (selectedFrequency === 'bi-weekly') {
      setShowWeeklyConfig(true);
    }
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
    <>
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
                <Select value={selectedFrequency} onValueChange={(v) => setSelectedFrequency(v as FrequencyType)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="semi-monthly">Semi-Monthly</SelectItem>
                    <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleQuickGenerate}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Generate Periods
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedFrequency === 'monthly' && 'Generates 7 monthly periods (3 past, current, 3 future)'}
                {selectedFrequency === 'semi-monthly' && 'Generates 6 semi-monthly periods (2 per month for 3 months)'}
                {selectedFrequency === 'bi-weekly' && 'Generates 6 bi-weekly periods (14-day periods)'}
                {selectedFrequency === 'weekly' && 'Generates 6 weekly periods (7-day periods)'}
              </p>
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

      {/* Semi-Monthly Configuration Modal */}
      <Dialog open={showSemiMonthlyConfig} onOpenChange={setShowSemiMonthlyConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Semi-Monthly Configuration</DialogTitle>
            <DialogDescription>
              Set the two payment dates for each month
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="day1">First Payment Day of Month</Label>
              <Select 
                value={semiMonthlyDay1.toString()} 
                onValueChange={(v) => setSemiMonthlyDay1(parseInt(v))}
              >
                <SelectTrigger id="day1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="day2">Second Payment Day of Month</Label>
              <Select 
                value={semiMonthlyDay2.toString()} 
                onValueChange={(v) => setSemiMonthlyDay2(parseInt(v))}
              >
                <SelectTrigger id="day2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                    </SelectItem>
                  ))}
                  <SelectItem value="0">Last day of month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              Example: Days 1 and 15 creates periods from 1st-14th and 15th-last day
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSemiMonthlyConfig(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateSemiMonthly}>
              Generate Semi-Monthly Periods
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weekly/Bi-Weekly Configuration Modal */}
      <Dialog open={showWeeklyConfig} onOpenChange={setShowWeeklyConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedFrequency === 'weekly' ? 'Weekly' : 'Bi-Weekly'} Configuration
            </DialogTitle>
            <DialogDescription>
              Set the anchor date for generating periods
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="anchorDate">
                Anchor Date (Start of first period)
              </Label>
              <Input
                id="anchorDate"
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {selectedFrequency === 'weekly' 
                ? 'Periods will be 7 days long, starting from this date'
                : 'Periods will be 14 days long, starting from this date'}
            </p>
            
            <p className="text-xs text-muted-foreground">
              Tip: Choose a payday like Friday for better alignment
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWeeklyConfig(false)}>
              Cancel
            </Button>
            <Button onClick={selectedFrequency === 'weekly' ? handleGenerateWeekly : handleGenerateBiWeekly}>
              Generate {selectedFrequency === 'weekly' ? 'Weekly' : 'Bi-Weekly'} Periods
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
