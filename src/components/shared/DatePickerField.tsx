import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface DatePickerFieldProps {
  value: Date;
  onChange: (date: Date) => void;
  bandStart?: Date;
  bandEnd?: Date;
  className?: string;
  disabled?: boolean;
}

export function DatePickerField({ 
  value, 
  onChange, 
  bandStart, 
  bandEnd, 
  className,
  disabled = false 
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Normalize to local start of day (no UTC conversion)
      const localDate = startOfDay(date);
      onChange(localDate);
      setOpen(false);
    }
  };

  const handleQuickDate = (date: Date) => {
    const localDate = startOfDay(date);
    onChange(localDate);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'MMM d, yyyy') : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1" 
            onClick={() => handleQuickDate(new Date())}
          >
            Today
          </Button>
          {bandStart && (
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1" 
              onClick={() => handleQuickDate(bandStart)}
            >
              Band Start
            </Button>
          )}
          {bandEnd && (
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1" 
              onClick={() => handleQuickDate(bandEnd)}
            >
              Band End
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          initialFocus
          className="pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
