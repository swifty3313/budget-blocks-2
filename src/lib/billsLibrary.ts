export type BillItem = {
  id: string;
  active: boolean;
  ownerId: string;
  vendor: string;
  fromBaseId?: string;
  defaultAmount: number;
  defaultCategoryId?: string | null;
  dueDay: number | 'Last';
  autopay?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const LS_KEY = 'bb.billsLibrary:v1';

export function loadBills(): BillItem[] {
  try {
    const data = localStorage.getItem(LS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data) as BillItem[];
    return Array.isArray(parsed) ? parsed.filter(b => b && b.id) : [];
  } catch {
    return [];
  }
}

function saveBills(all: BillItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

export const billsLibrary = {
  all(): BillItem[] {
    return loadBills().filter(b => b.active !== false);
  },

  get(id: string): BillItem | null {
    return loadBills().find(b => b.id === id && b.active !== false) || null;
  },

  upsert(input: Partial<BillItem> & { id?: string }): BillItem {
    const now = new Date().toISOString();
    const list = loadBills();
    const idx = input.id ? list.findIndex(b => b.id === input.id) : -1;

    if (idx >= 0) {
      // Update existing
      const updated: BillItem = { ...list[idx], ...input, updatedAt: now };
      list[idx] = updated;
      saveBills(list);
      return updated;
    }

    // Create new
    const created: BillItem = {
      id: crypto.randomUUID(),
      active: true,
      ownerId: '',
      vendor: '',
      defaultAmount: 0,
      dueDay: 1,
      createdAt: now,
      updatedAt: now,
      ...input,
    } as BillItem;
    list.push(created);
    saveBills(list);
    return created;
  },

  softDelete(id: string): void {
    const list = loadBills();
    const idx = list.findIndex(b => b.id === id);
    if (idx >= 0) {
      list[idx].active = false;
      list[idx].updatedAt = new Date().toISOString();
      saveBills(list);
    }
  },

  restore(id: string): void {
    const list = loadBills();
    const idx = list.findIndex(b => b.id === id);
    if (idx >= 0) {
      list[idx].active = true;
      list[idx].updatedAt = new Date().toISOString();
      saveBills(list);
    }
  },

  // Find bill by key fields (for duplicate detection)
  findDuplicate(ownerId: string, vendor: string, fromBaseId: string | undefined, dueDay: number | 'Last'): BillItem | null {
    return loadBills().find(b =>
      b.active &&
      b.ownerId === ownerId &&
      b.vendor === vendor &&
      b.fromBaseId === fromBaseId &&
      b.dueDay === dueDay
    ) || null;
  }
};
