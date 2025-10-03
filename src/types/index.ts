export type BaseType = 'Checking' | 'Savings' | 'Credit' | 'Loan' | 'Vault' | 'Goal' | string;

export type BlockType = 'Income' | 'Fixed Bill' | 'Flow';

export type FlowRowType = 'Transfer' | 'Payment' | 'Expense' | 'Reimbursement' | string;

export type RecurrenceFrequency = 
  | 'Weekly' 
  | 'Biweekly' 
  | 'Semi-Monthly' 
  | 'Monthly' 
  | 'Quarterly' 
  | 'Yearly';

export interface Base {
  id: string;
  name: string;
  type: BaseType;
  institution?: string;
  identifier?: string;
  balance: number;
  currency: string;
  tags: string[];
  tagColor?: string; // Hex color for balance display
  sortOrder?: number; // Manual sort order
  createdAt: Date;
  updatedAt: Date;
}

export interface Row {
  id: string;
  date: Date;
  owner: string;
  source?: string; // Vendor/Source for Fixed Bills, Source for Income, Source/Description for Flow
  fromBaseId?: string;
  toBaseId?: string;
  amount: number;
  flowMode?: 'Fixed' | '%'; // For Flow blocks: Fixed dollar amount or percentage
  flowValue?: number; // For Flow blocks: the actual value (dollar or percentage)
  type?: FlowRowType; // For Flow blocks only (Transfer, Payment, Expense, Reimbursement)
  category?: string;
  notes?: string;
  executed: boolean;
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  startDate: Date;
  endDate?: Date;
  snapToBands: boolean;
  anchorDate?: Date; // For biweekly
  dayOfMonth?: number; // For semi-monthly
}

export interface Block {
  id: string;
  type: BlockType;
  title: string;
  date: Date; // Used for sorting/display; actual transaction dates are in rows
  tags: string[];
  rows: Row[];
  bandId?: string; // Auto-assigned based on date or user selection
  recurrence?: RecurrenceRule; // Only for templates in library
  isTemplate?: boolean;
  allocationBasisPreference?: 'none' | 'band' | 'manual' | 'calculator'; // For Flow templates only
  allocationBasisValue?: number; // For manual/calculator basis in Flow templates
  createdAt: Date;
  updatedAt: Date;
}

export interface PayPeriodBand {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  order: number;
  archived?: boolean;
  sourceScheduleId?: string; // Reference to the schedule that generated this band
  attributionRule?: 'end-month' | 'start-month' | 'shift-plus-1';
  displayMonth?: string; // YYYY-MM format for ledger paging (calculated from attribution rule)
  locked?: boolean; // When true, band won't be regenerated in composite mode
  compositePaydays?: string[]; // Schedule IDs contributing to this band's boundaries
}

export interface BandFrequencyConfig {
  frequency: 'Weekly' | 'Biweekly' | 'Semi-Monthly' | 'Monthly' | 'Custom';
  anchorDate?: Date;
  semiMonthlyDays?: [number, number];
}

export interface PaySchedule {
  id: string;
  name: string;
  frequency: 'Monthly' | 'Semi-Monthly' | 'Bi-Weekly' | 'Weekly';
  anchorDate?: Date; // For Bi-Weekly and Weekly
  anchorDay?: number | 'Last'; // For Monthly (1-31 or "Last")
  semiMonthlyDay1?: number | 'Last'; // For Semi-Monthly (1-31 or "Last")
  semiMonthlyDay2?: number | 'Last'; // For Semi-Monthly (1-31 or "Last")
  attributionRule?: 'end-month' | 'start-month' | 'shift-plus-1'; // How to assign bands to display months
  semiSecondAsNextMonth?: boolean; // For Semi-Monthly: treat second anchor as next month's PP1
  createdAt: Date;
}

export interface Owner {
  id: string;
  name: string;
  order: number;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: Date;
}

export interface FixedBill {
  id: string;
  owner: string;
  vendor: string;
  fromBaseId: string;
  defaultAmount: number;
  category?: string;
  dueDay: number | 'Last'; // 1-31 or "Last Day"
  autopay: boolean;
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Undo history types
export type UndoableEntity = 
  | { type: 'block'; data: Block }
  | { type: 'base'; data: Base }
  | { type: 'band'; data: PayPeriodBand; blocksSnapshot: Block[] }
  | { type: 'template'; data: Block }
  | { type: 'schedule'; data: PaySchedule }
  | { type: 'fixedBill'; data: FixedBill }
  | { type: 'owner'; data: Owner; reassignments?: { blockId: string; rowId: string; oldOwnerId: string }[] }
  | { type: 'category'; data: Category; reassignments?: { blockId: string; rowId: string; oldCategoryId: string | undefined }[] };

export interface UndoHistoryItem {
  id: string;
  entity: UndoableEntity;
  timestamp: Date;
  label: string;
}

export interface AppState {
  bases: Base[];
  blocks: Block[];
  bands: PayPeriodBand[];
  library: Block[];
  schedules: PaySchedule[];
  fixedBills: FixedBill[];
  
  // Master lists (legacy string arrays for backward compatibility)
  owners: string[];
  categories: string[];
  vendors: string[];
  institutions: string[];
  baseTypes: BaseType[];
  flowTypes: FlowRowType[];
  
  // New entity-based lists
  ownerEntities: Owner[];
  categoryEntities: Category[];
  
  // UI State
  groupBasesByType: boolean;
  templatePreferences: {
    dontOfferForIncome: boolean;
    dontOfferForFixed: boolean;
    dontOfferForFlow: boolean;
  };
  undoHistory: UndoHistoryItem[];
  
  // Actions
  addBase: (base: Omit<Base, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateBase: (id: string, updates: Partial<Base>) => void;
  deleteBase: (id: string) => string;
  reorderBases: (baseIds: string[]) => void;
  toggleGroupByType: () => void;
  
  addBlock: (block: Omit<Block, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  deleteBlock: (id: string) => string;
  moveBlockToBand: (blockId: string, bandId: string | undefined) => void;
  
  addBand: (band: Omit<PayPeriodBand, 'id'>) => void;
  updateBand: (id: string, updates: Partial<PayPeriodBand>) => void;
  deleteBand: (id: string) => string;
  archiveBand: (id: string) => void;
  unarchiveBand: (id: string) => void;
  reassignBlocksToBands: () => number; // Returns count of reassigned blocks
  
  addSchedule: (schedule: Omit<PaySchedule, 'id' | 'createdAt'>) => void;
  updateSchedule: (id: string, updates: Partial<PaySchedule>) => void;
  deleteSchedule: (id: string) => void;
  
  addFixedBill: (bill: Omit<FixedBill, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateFixedBill: (id: string, updates: Partial<FixedBill>) => void;
  deleteFixedBill: (id: string) => void;
  
  saveToLibrary: (block: Block) => void;
  removeFromLibrary: (id: string) => string;
  updateTemplate: (id: string, updates: Partial<Block>) => void;
  duplicateTemplate: (id: string) => void;
  
  executeRow: (blockId: string, rowId: string) => void;
  undoExecuteRow: (blockId: string, rowId: string) => void;
  
  addToMasterList: (type: 'owners' | 'categories' | 'vendors' | 'institutions' | 'baseTypes' | 'flowTypes', value: string) => void;
  
  // Owner/Category entity actions
  addOwner: (name: string) => void;
  updateOwner: (id: string, updates: Partial<Owner>) => void;
  deleteOwner: (id: string, reassignToId: string | undefined) => string;
  reorderOwners: (ownerIds: string[]) => void;
  
  addCategory: (name: string) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string, reassignToId: string | null | undefined) => string;
  reorderCategories: (categoryIds: string[]) => void;
  
  updateTemplatePreference: (blockType: BlockType, dontOffer: boolean) => void;
  
  undoDelete: (historyId: string) => boolean;
  clearUndoHistory: () => void;
  
  exportData: () => string;
  importData: (json: string) => void;
  clearAll: () => void;
}

export interface KPIData {
  totalCash: number;
  totalCreditDebt: number;
  netWorth: number;
  forecastedCash?: number;
  forecastedDebt?: number;
  forecastedNetWorth?: number;
}

export interface BandSummary {
  bandId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  expectedIncome: number;
  expectedFixed: number;
  availableToAllocate: number;
  blockCount: number;
  executedCount: number;
}
