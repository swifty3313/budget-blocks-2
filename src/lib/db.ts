import Dexie, { Table } from 'dexie';
import type { Base, Block, PayPeriodBand } from '@/types';

export class BudgetBlocksDB extends Dexie {
  bases!: Table<Base>;
  blocks!: Table<Block>;
  bands!: Table<PayPeriodBand>;

  constructor() {
    super('BudgetBlocksDB');
    
    this.version(1).stores({
      bases: 'id, name, type, createdAt',
      blocks: 'id, type, date, owner, bandId, isTemplate, createdAt',
      bands: 'id, startDate, endDate, order',
    });
  }
}

export const db = new BudgetBlocksDB();
