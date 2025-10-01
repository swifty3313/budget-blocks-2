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
}

export interface BandFrequencyConfig {
  frequency: 'Weekly' | 'Biweekly' | 'Semi-Monthly' | 'Monthly' | 'Custom';
  anchorDate?: Date;
  semiMonthlyDays?: [number, number];
}

export interface AppState {
  bases: Base[];
  blocks: Block[];
  bands: PayPeriodBand[];
  library: Block[];
  
  // Master lists
  owners: string[];
  categories: string[];
  vendors: string[];
  institutions: string[];
  baseTypes: BaseType[];
  flowTypes: FlowRowType[];
  
  // UI State
  groupBasesByType: boolean;
  
  // Actions
  addBase: (base: Omit<Base, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateBase: (id: string, updates: Partial<Base>) => void;
  deleteBase: (id: string) => void;
  reorderBases: (baseIds: string[]) => void;
  toggleGroupByType: () => void;
  
  addBlock: (block: Omit<Block, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  moveBlockToBand: (blockId: string, bandId: string | undefined) => void;
  
  addBand: (band: Omit<PayPeriodBand, 'id'>) => void;
  updateBand: (id: string, updates: Partial<PayPeriodBand>) => void;
  deleteBand: (id: string) => void;
  archiveBand: (id: string) => void;
  unarchiveBand: (id: string) => void;
  
  saveToLibrary: (block: Block) => void;
  removeFromLibrary: (id: string) => void;
  
  executeRow: (blockId: string, rowId: string) => void;
  undoExecuteRow: (blockId: string, rowId: string) => void;
  
  addToMasterList: (type: 'owners' | 'categories' | 'vendors' | 'institutions' | 'baseTypes' | 'flowTypes', value: string) => void;
  
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
