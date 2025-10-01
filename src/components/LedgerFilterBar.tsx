import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, Search, X, Calendar as CalendarIcon } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subDays, addDays } from "date-fns";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface LedgerFilters {
  dateRange: {
    from: Date;
    to: Date;
    preset: string;
  };
  owners: string[];
  accounts: string[];
  types: string[];
  status: 'all' | 'executed' | 'planned';
  search: string;
}

interface LedgerFilterBarProps {
  filters: LedgerFilters;
  onFiltersChange: (filters: LedgerFilters) => void;
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function LedgerFilterBar({ filters, onFiltersChange, selectedMonth, onMonthChange }: LedgerFilterBarProps) {
  const bases = useStore((state) => state.bases);
  const owners = useStore((state) => state.owners);
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, search: searchInput });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const datePresets = useMemo(() => {
    const now = new Date();
    const basePresets = {
      'This month': {
        from: startOfMonth(now),
        to: endOfMonth(now),
      },
    };

    if (filters.status === 'executed') {
      return {
        ...basePresets,
        'Last 30 days': {
          from: subDays(now, 30),
          to: now,
        },
        'Last 60 days': {
          from: subDays(now, 60),
          to: now,
        },
        'Last 90 days': {
          from: subDays(now, 90),
          to: now,
        },
      };
    } else if (filters.status === 'planned') {
      return {
        ...basePresets,
        'Next 30 days': {
          from: now,
          to: addDays(now, 30),
        },
        'Next 60 days': {
          from: now,
          to: addDays(now, 60),
        },
        'Next 90 days': {
          from: now,
          to: addDays(now, 90),
        },
      };
    } else {
      // Status = 'all', show both past and future
      return {
        ...basePresets,
        'Last 30 days': {
          from: subDays(now, 30),
          to: now,
        },
        'Last 60 days': {
          from: subDays(now, 60),
          to: now,
        },
        'Last 90 days': {
          from: subDays(now, 90),
          to: now,
        },
      };
    }
  }, [filters.status]);

  const handleDatePreset = (preset: string) => {
    if (preset === 'Custom...') {
      // Set to Custom mode with current date range
      onFiltersChange({
        ...filters,
        dateRange: {
          ...filters.dateRange,
          preset: 'Custom',
        },
      });
      return;
    }
    
    const range = datePresets[preset as keyof typeof datePresets];
    if (range) {
      onFiltersChange({
        ...filters,
        dateRange: {
          from: range.from,
          to: range.to,
          preset,
        },
      });
      // Sync with month selector if preset is "This month"
      if (preset === 'This month') {
        onMonthChange(new Date());
      }
    }
  };

  const handleCustomDateRange = (from: Date | undefined, to: Date | undefined) => {
    if (from && to) {
      onFiltersChange({
        ...filters,
        dateRange: {
          from,
          to,
          preset: 'Custom',
        },
      });
    }
  };

  const handleOwnerToggle = (owner: string) => {
    const newOwners = filters.owners.includes(owner)
      ? filters.owners.filter(o => o !== owner)
      : [...filters.owners, owner];
    onFiltersChange({ ...filters, owners: newOwners });
  };

  const handleAccountToggle = (accountId: string) => {
    const newAccounts = filters.accounts.includes(accountId)
      ? filters.accounts.filter(a => a !== accountId)
      : [...filters.accounts, accountId];
    onFiltersChange({ ...filters, accounts: newAccounts });
  };

  const handleTypeToggle = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onFiltersChange({ ...filters, types: newTypes });
  };

  const handleStatusChange = (status: 'all' | 'executed' | 'planned') => {
    // Reset date preset to "This month" when changing status
    const now = new Date();
    onFiltersChange({
      ...filters,
      status,
      dateRange: {
        from: startOfMonth(now),
        to: endOfMonth(now),
        preset: 'This month',
      },
    });
  };

  const isDefaultFilters = () => {
    const now = new Date();
    const thisMonth = {
      from: startOfMonth(now),
      to: endOfMonth(now),
    };
    return (
      filters.dateRange.preset === 'This month' &&
      filters.owners.length === 0 &&
      filters.accounts.length === 0 &&
      filters.types.length === 0 &&
      filters.status === 'all' &&
      filters.search === ''
    );
  };

  const handleReset = () => {
    const now = new Date();
    onFiltersChange({
      dateRange: {
        from: startOfMonth(now),
        to: endOfMonth(now),
        preset: 'This month',
      },
      owners: [],
      accounts: [],
      types: [],
      status: 'all',
      search: '',
    });
    setSearchInput('');
    onMonthChange(now);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateRange.preset !== 'This month') count++;
    if (filters.owners.length > 0) count++;
    if (filters.accounts.length > 0) count++;
    if (filters.types.length > 0) count++;
    if (filters.status !== 'all') count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  return (
    <Card className="mb-4">
      <CardContent className="py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filters Label */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Filters</Label>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </div>

          {/* Date Range */}
          <Select value={filters.dateRange.preset} onValueChange={handleDatePreset}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(datePresets).map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {preset}
                </SelectItem>
              ))}
              <SelectItem value="Custom...">Custom...</SelectItem>
            </SelectContent>
          </Select>

          {/* Custom Date Range Display/Edit */}
          {filters.dateRange.preset === 'Custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(filters.dateRange.from, 'MMM d')} - {format(filters.dateRange.to, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Start Date</Label>
                    <Calendar
                      mode="single"
                      selected={filters.dateRange.from}
                      onSelect={(date) => date && handleCustomDateRange(date, filters.dateRange.to)}
                      className={cn("pointer-events-auto")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">End Date</Label>
                    <Calendar
                      mode="single"
                      selected={filters.dateRange.to}
                      onSelect={(date) => date && handleCustomDateRange(filters.dateRange.from, date)}
                      disabled={(date) => date < filters.dateRange.from}
                      className={cn("pointer-events-auto")}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Owner Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                Owner
                {filters.owners.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {filters.owners.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Select Owners</Label>
                {owners.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No owners available</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {owners.map((owner) => (
                      <div key={owner} className="flex items-center gap-2">
                        <Checkbox
                          id={`owner-${owner}`}
                          checked={filters.owners.includes(owner)}
                          onCheckedChange={() => handleOwnerToggle(owner)}
                        />
                        <label
                          htmlFor={`owner-${owner}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {owner}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Account Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                Account
                {filters.accounts.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {filters.accounts.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Select Accounts</Label>
                {bases.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No accounts available</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {bases.map((base) => (
                      <div key={base.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`account-${base.id}`}
                          checked={filters.accounts.includes(base.id)}
                          onCheckedChange={() => handleAccountToggle(base.id)}
                        />
                        <label
                          htmlFor={`account-${base.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {base.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Type Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                Type
                {filters.types.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {filters.types.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Select Types</Label>
                <div className="space-y-2">
                  {['Income', 'Fixed Bill', 'Flow'].map((type) => (
                    <div key={type} className="flex items-center gap-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={filters.types.includes(type)}
                        onCheckedChange={() => handleTypeToggle(type)}
                      />
                      <label
                        htmlFor={`type-${type}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Status Segmented Control */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={filters.status === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-9 rounded-r-none border-r"
              onClick={() => handleStatusChange('all')}
            >
              All
            </Button>
            <Button
              variant={filters.status === 'executed' ? 'default' : 'ghost'}
              size="sm"
              className="h-9 rounded-none border-r"
              onClick={() => handleStatusChange('executed')}
            >
              Executed
            </Button>
            <Button
              variant={filters.status === 'planned' ? 'default' : 'ghost'}
              size="sm"
              className="h-9 rounded-l-none"
              onClick={() => handleStatusChange('planned')}
            >
              Planned
            </Button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search blocks, vendors, notes..."
              className="pl-9 h-9"
            />
          </div>

          {/* Reset */}
          {!isDefaultFilters() && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={handleReset}
            >
              <X className="w-4 h-4 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
