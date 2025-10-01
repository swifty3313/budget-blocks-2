import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Base, Block, PayPeriodBand, Row, KPIData, BandSummary } from '@/types';

// Helper to calculate block total
const calculateBlockTotal = (rows: Row[]): number => {
  return rows.reduce((sum, row) => sum + row.amount, 0);
};

// Helper to determine band for a block
const findBandForDate = (date: Date, bands: PayPeriodBand[]): string | undefined => {
  const band = bands.find(b => date >= b.startDate && date <= b.endDate);
  return band?.id;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      bases: [],
      blocks: [],
      bands: [],
      library: [],
      owners: [],
      categories: [],
      vendors: [],
      institutions: [],
      baseTypes: ['Checking', 'Savings', 'Credit', 'Loan', 'Vault', 'Goal'],
      flowTypes: ['Transfer', 'Payment', 'Expense', 'Reimbursement'],

      // Base actions
      addBase: (base) => {
        const newBase: Base = {
          ...base,
          id: uuidv4(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ bases: [...state.bases, newBase] }));
      },

      updateBase: (id, updates) => {
        set((state) => ({
          bases: state.bases.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date() } : b
          ),
        }));
      },

      deleteBase: (id) => {
        set((state) => ({ bases: state.bases.filter((b) => b.id !== id) }));
      },

      // Block actions
      addBlock: (block) => {
        const { bands } = get();
        const bandId = findBandForDate(block.date, bands);
        const newBlock: Block = {
          ...block,
          id: uuidv4(),
          bandId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ blocks: [...state.blocks, newBlock] }));
      },

      updateBlock: (id, updates) => {
        set((state) => {
          const { bands } = get();
          return {
            blocks: state.blocks.map((b) => {
              if (b.id !== id) return b;
              const updated = { ...b, ...updates, updatedAt: new Date() };
              // Re-assign band if date changed
              if (updates.date) {
                updated.bandId = findBandForDate(updated.date, bands);
              }
              return updated;
            }),
          };
        });
      },

      deleteBlock: (id) => {
        const { blocks, bases } = get();
        const block = blocks.find((b) => b.id === id);
        if (!block) return;

        // Reverse all executed rows before deletion
        const updatedBases = [...bases];
        block.rows.forEach((row) => {
          if (!row.executed) return;

          // Reverse balance changes based on block type
          if (block.type === 'Income' && row.toBaseId) {
            const toBase = updatedBases.find((b) => b.id === row.toBaseId);
            if (toBase) toBase.balance -= row.amount;
          } else if (block.type === 'Fixed Bill' && row.fromBaseId) {
            const fromBase = updatedBases.find((b) => b.id === row.fromBaseId);
            if (fromBase) fromBase.balance += row.amount;
          } else if (block.type === 'Flow') {
            if (row.fromBaseId) {
              const fromBase = updatedBases.find((b) => b.id === row.fromBaseId);
              if (fromBase) fromBase.balance += row.amount;
            }
            if (row.toBaseId) {
              const toBase = updatedBases.find((b) => b.id === row.toBaseId);
              if (toBase) toBase.balance -= row.amount;
            }
          }
        });

        set({
          bases: updatedBases,
          blocks: blocks.filter((b) => b.id !== id),
        });
      },

      moveBlockToBand: (blockId, bandId) => {
        set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === blockId ? { ...b, bandId, updatedAt: new Date() } : b
          ),
        }));
      },

      // Band actions
      addBand: (band) => {
        const newBand: PayPeriodBand = {
          ...band,
          id: uuidv4(),
        };
        set((state) => ({ bands: [...state.bands, newBand] }));
      },

      updateBand: (id, updates) => {
        set((state) => ({
          bands: state.bands.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        }));
      },

      deleteBand: (id) => {
        set((state) => ({
          bands: state.bands.filter((b) => b.id !== id),
          blocks: state.blocks.map((block) =>
            block.bandId === id ? { ...block, bandId: undefined } : block
          ),
        }));
      },

      archiveBand: (id) => {
        set((state) => ({
          bands: state.bands.map((b) => (b.id === id ? { ...b, archived: true } : b)),
        }));
      },

      unarchiveBand: (id) => {
        set((state) => ({
          bands: state.bands.map((b) => (b.id === id ? { ...b, archived: false } : b)),
        }));
      },

      // Library actions
      saveToLibrary: (block) => {
        const template: Block = {
          ...block,
          id: uuidv4(),
          isTemplate: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ library: [...state.library, template] }));
      },

      removeFromLibrary: (id) => {
        set((state) => ({ library: state.library.filter((b) => b.id !== id) }));
      },

      // Execute/Undo actions
      executeRow: (blockId, rowId) => {
        const { blocks, bases } = get();
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;

        const row = block.rows.find((r) => r.id === rowId);
        if (!row || row.executed) return;

        // Update balances based on block type
        const updatedBases = [...bases];
        
        if (block.type === 'Income' && row.toBaseId) {
          const toBase = updatedBases.find((b) => b.id === row.toBaseId);
          if (toBase) toBase.balance += row.amount;
        } else if (block.type === 'Fixed Bill' && row.fromBaseId) {
          const fromBase = updatedBases.find((b) => b.id === row.fromBaseId);
          if (fromBase) fromBase.balance -= row.amount;
        } else if (block.type === 'Flow') {
          if (row.fromBaseId) {
            const fromBase = updatedBases.find((b) => b.id === row.fromBaseId);
            if (fromBase) fromBase.balance -= row.amount;
          }
          if (row.toBaseId) {
            const toBase = updatedBases.find((b) => b.id === row.toBaseId);
            if (toBase) toBase.balance += row.amount;
          }
        }

        // Mark row as executed
        const updatedBlocks = blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                rows: b.rows.map((r) =>
                  r.id === rowId ? { ...r, executed: true } : r
                ),
                updatedAt: new Date(),
              }
            : b
        );

        set({ bases: updatedBases, blocks: updatedBlocks });
      },

      undoExecuteRow: (blockId, rowId) => {
        const { blocks, bases } = get();
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;

        const row = block.rows.find((r) => r.id === rowId);
        if (!row || !row.executed) return;

        // Reverse balance changes
        const updatedBases = [...bases];
        
        if (block.type === 'Income' && row.toBaseId) {
          const toBase = updatedBases.find((b) => b.id === row.toBaseId);
          if (toBase) toBase.balance -= row.amount;
        } else if (block.type === 'Fixed Bill' && row.fromBaseId) {
          const fromBase = updatedBases.find((b) => b.id === row.fromBaseId);
          if (fromBase) fromBase.balance += row.amount;
        } else if (block.type === 'Flow') {
          if (row.fromBaseId) {
            const fromBase = updatedBases.find((b) => b.id === row.fromBaseId);
            if (fromBase) fromBase.balance += row.amount;
          }
          if (row.toBaseId) {
            const toBase = updatedBases.find((b) => b.id === row.toBaseId);
            if (toBase) toBase.balance -= row.amount;
          }
        }

        // Mark row as not executed
        const updatedBlocks = blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                rows: b.rows.map((r) =>
                  r.id === rowId ? { ...r, executed: false } : r
                ),
                updatedAt: new Date(),
              }
            : b
        );

        set({ bases: updatedBases, blocks: updatedBlocks });
      },

      // Master list actions
      addToMasterList: (type, value) => {
        set((state) => {
          const list = state[type];
          if (!list.includes(value)) {
            return { [type]: [...list, value] };
          }
          return state;
        });
      },

      // Data actions
      exportData: () => {
        const state = get();
        return JSON.stringify({
          bases: state.bases,
          blocks: state.blocks,
          bands: state.bands,
          library: state.library,
          owners: state.owners,
          categories: state.categories,
          vendors: state.vendors,
          institutions: state.institutions,
          baseTypes: state.baseTypes,
          flowTypes: state.flowTypes,
        }, null, 2);
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            bases: data.bases || [],
            blocks: data.blocks || [],
            bands: data.bands || [],
            library: data.library || [],
            owners: data.owners || [],
            categories: data.categories || [],
            vendors: data.vendors || [],
            institutions: data.institutions || [],
            baseTypes: data.baseTypes || [],
            flowTypes: data.flowTypes || [],
          });
        } catch (error) {
          console.error('Failed to import data:', error);
        }
      },

      clearAll: () => {
        set({
          bases: [],
          blocks: [],
          bands: [],
          library: [],
          owners: [],
          categories: [],
          vendors: [],
          institutions: [],
          baseTypes: ['Checking', 'Savings', 'Credit', 'Loan', 'Vault', 'Goal'],
          flowTypes: ['Transfer', 'Payment', 'Expense', 'Reimbursement'],
        });
      },
    }),
    {
      name: 'budget-blocks-storage',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          
          const { state } = JSON.parse(str);
          
          // Convert date strings back to Date objects
          return {
            state: {
              ...state,
              bases: (state.bases || []).map((base: any) => ({
                ...base,
                createdAt: base.createdAt ? new Date(base.createdAt) : new Date(),
                updatedAt: base.updatedAt ? new Date(base.updatedAt) : new Date(),
              })),
              blocks: (state.blocks || []).map((block: any) => ({
                ...block,
                date: block.date ? new Date(block.date) : new Date(),
                rows: (block.rows || []).map((row: any) => ({
                  ...row,
                  date: row.date ? new Date(row.date) : new Date(),
                })),
                recurrence: block.recurrence ? {
                  ...block.recurrence,
                  startDate: new Date(block.recurrence.startDate),
                  endDate: block.recurrence.endDate ? new Date(block.recurrence.endDate) : undefined,
                  anchorDate: block.recurrence.anchorDate ? new Date(block.recurrence.anchorDate) : undefined,
                } : undefined,
                createdAt: block.createdAt ? new Date(block.createdAt) : new Date(),
                updatedAt: block.updatedAt ? new Date(block.updatedAt) : new Date(),
              })),
              bands: (state.bands || []).map((band: any) => ({
                ...band,
                startDate: band.startDate ? new Date(band.startDate) : new Date(),
                endDate: band.endDate ? new Date(band.endDate) : new Date(),
              })),
              library: (state.library || []).map((block: any) => ({
                ...block,
                date: block.date ? new Date(block.date) : new Date(),
                rows: (block.rows || []).map((row: any) => ({
                  ...row,
                  date: row.date ? new Date(row.date) : new Date(),
                })),
                recurrence: block.recurrence ? {
                  ...block.recurrence,
                  startDate: new Date(block.recurrence.startDate),
                  endDate: block.recurrence.endDate ? new Date(block.recurrence.endDate) : undefined,
                  anchorDate: block.recurrence.anchorDate ? new Date(block.recurrence.anchorDate) : undefined,
                } : undefined,
                createdAt: block.createdAt ? new Date(block.createdAt) : new Date(),
                updatedAt: block.updatedAt ? new Date(block.updatedAt) : new Date(),
              })),
            },
          };
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);

// Selectors for KPIs
export const selectKPIs = (state: AppState): KPIData => {
  const cashTypes = ['Checking', 'Savings', 'Vault'];
  const creditTypes = ['Credit'];
  const assetTypes = ['Checking', 'Savings', 'Vault', 'Goal'];
  const liabilityTypes = ['Credit', 'Loan'];

  const totalCash = state.bases
    .filter((b) => cashTypes.includes(b.type))
    .reduce((sum, b) => sum + b.balance, 0);

  const totalCreditDebt = state.bases
    .filter((b) => creditTypes.includes(b.type))
    .reduce((sum, b) => sum + Math.abs(b.balance), 0);

  const assets = state.bases
    .filter((b) => assetTypes.includes(b.type))
    .reduce((sum, b) => sum + b.balance, 0);

  const liabilities = state.bases
    .filter((b) => liabilityTypes.includes(b.type))
    .reduce((sum, b) => sum + b.balance, 0);

  const netWorth = assets + liabilities; // liabilities are negative

  return { totalCash, totalCreditDebt, netWorth };
};

// Selector for band summaries
export const selectBandSummaries = (state: AppState): BandSummary[] => {
  return state.bands
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((band) => {
      const bandBlocks = state.blocks.filter((b) => b.bandId === band.id);
      
      const expectedIncome = bandBlocks
        .filter((b) => b.type === 'Income')
        .reduce((sum, b) => sum + calculateBlockTotal(b.rows), 0);

      const expectedFixed = bandBlocks
        .filter((b) => b.type === 'Fixed Bill')
        .reduce((sum, b) => sum + calculateBlockTotal(b.rows), 0);

      const availableToAllocate = expectedIncome - expectedFixed;

      const executedCount = bandBlocks.reduce(
        (count, b) => count + b.rows.filter((r) => r.executed).length,
        0
      );

      return {
        bandId: band.id,
        title: band.title,
        startDate: band.startDate,
        endDate: band.endDate,
        expectedIncome,
        expectedFixed,
        availableToAllocate,
        blockCount: bandBlocks.length,
        executedCount,
      };
    });
};
