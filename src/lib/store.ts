import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Base, Block, PayPeriodBand, Row, KPIData, BandSummary, PaySchedule, FixedBill, UndoHistoryItem, Owner, Category } from '@/types';
import { toDateOnly, fromDateOnly, isWithinRange } from './dateOnly';

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
      schedules: [],
      fixedBills: [],
      owners: [],
      categories: [],
      vendors: [],
      institutions: [],
      baseTypes: ['Checking', 'Savings', 'Credit', 'Loan', 'Vault', 'Goal'],
      flowTypes: ['Transfer', 'Payment', 'Expense', 'Reimbursement'],
      ownerEntities: [],
      categoryEntities: [],
      groupBasesByType: false,
      templatePreferences: {
        dontOfferForIncome: false,
        dontOfferForFixed: false,
        dontOfferForFlow: false,
      },
      undoHistory: [],

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
        const { bases, undoHistory } = get();
        const base = bases.find((b) => b.id === id);
        if (!base) return '';

        // Add to undo history
        const historyItem: UndoHistoryItem = {
          id: uuidv4(),
          entity: { type: 'base', data: base },
          timestamp: new Date(),
          label: `Base: ${base.name}`,
        };

        set((state) => ({
          bases: state.bases.filter((b) => b.id !== id),
          undoHistory: [...state.undoHistory, historyItem],
        }));
        
        return historyItem.id;
      },

      reorderBases: (baseIds) => {
        set((state) => ({
          bases: state.bases.map((base) => ({
            ...base,
            sortOrder: baseIds.indexOf(base.id),
          })),
        }));
      },

      toggleGroupByType: () => {
        set((state) => ({ groupBasesByType: !state.groupBasesByType }));
      },

      // Block actions
      addBlock: (block) => {
        const { bands } = get();
        // Prefer passed bandId, fallback to date-based lookup
        const bandId = block.bandId || findBandForDate(block.date, bands);
        
        console.debug('addBlock called', {
          type: block.type,
          title: block.title,
          date: block.date,
          passedBandId: block.bandId,
          resolvedBandId: bandId,
          rowCount: block.rows?.length || 0,
        });

        if (!bandId && !block.isTemplate) {
          console.error('No bandId resolved for block', { date: block.date, availableBands: bands.length });
        }

        const newBlock: Block = {
          ...block,
          id: uuidv4(),
          bandId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ blocks: [...state.blocks, newBlock] }));
        
        console.debug('Block added successfully', { id: newBlock.id, bandId: newBlock.bandId });
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
        const { blocks, bases, undoHistory } = get();
        const block = blocks.find((b) => b.id === id);
        if (!block) return '';

        // Add to undo history
        const historyItem: UndoHistoryItem = {
          id: uuidv4(),
          entity: { type: 'block', data: { ...block } },
          timestamp: new Date(),
          label: `Block: ${block.title}`,
        };

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
          undoHistory: [...undoHistory, historyItem],
        });
        
        return historyItem.id;
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
        const { bands, blocks, undoHistory } = get();
        const band = bands.find((b) => b.id === id);
        if (!band) return '';

        // Snapshot blocks in this band
        const affectedBlocks = blocks.filter((b) => b.bandId === id);

        // Add to undo history
        const historyItem: UndoHistoryItem = {
          id: uuidv4(),
          entity: { type: 'band', data: band, blocksSnapshot: affectedBlocks },
          timestamp: new Date(),
          label: `Band: ${band.title}`,
        };

        set((state) => ({
          bands: state.bands.filter((b) => b.id !== id),
          blocks: state.blocks.map((block) =>
            block.bandId === id ? { ...block, bandId: undefined } : block
          ),
          undoHistory: [...state.undoHistory, historyItem],
        }));

        return historyItem.id;
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

      reassignBlocksToBands: () => {
        const { blocks, bands } = get();
        let reassignedCount = 0;
        
        const updatedBlocks = blocks.map((block) => {
          const newBandId = findBandForDate(block.date, bands);
          if (newBandId !== block.bandId) {
            reassignedCount++;
            return { ...block, bandId: newBandId, updatedAt: new Date() };
          }
          return block;
        });

        set({ blocks: updatedBlocks });
        return reassignedCount;
      },

      // Schedule actions
      addSchedule: (schedule) => {
        const newSchedule: PaySchedule = {
          ...schedule,
          id: uuidv4(),
          createdAt: new Date(),
        };
        set((state) => ({ schedules: [...state.schedules, newSchedule] }));
      },

      updateSchedule: (id, updates) => {
        set((state) => ({
          schedules: state.schedules.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }));
      },

      deleteSchedule: (id) => {
        const { schedules, undoHistory } = get();
        const schedule = schedules.find((s) => s.id === id);
        if (!schedule) return;

        // Add to undo history
        const historyItem: UndoHistoryItem = {
          id: uuidv4(),
          entity: { type: 'schedule', data: schedule },
          timestamp: new Date(),
          label: `Schedule: ${schedule.name}`,
        };

        set((state) => ({
          schedules: state.schedules.filter((s) => s.id !== id),
          undoHistory: [...state.undoHistory, historyItem],
        }));
      },

      // Fixed Bill actions
      addFixedBill: (bill) => {
        const newBill: FixedBill = {
          ...bill,
          id: uuidv4(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ fixedBills: [...state.fixedBills, newBill] }));
      },

      updateFixedBill: (id, updates) => {
        set((state) => ({
          fixedBills: state.fixedBills.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date() } : b
          ),
        }));
      },

      deleteFixedBill: (id) => {
        const { fixedBills, undoHistory } = get();
        const bill = fixedBills.find((b) => b.id === id);
        if (!bill) return;

        // Add to undo history
        const historyItem: UndoHistoryItem = {
          id: uuidv4(),
          entity: { type: 'fixedBill', data: bill },
          timestamp: new Date(),
          label: `Bill: ${bill.vendor}`,
        };

        set((state) => ({
          fixedBills: state.fixedBills.filter((b) => b.id !== id),
          undoHistory: [...state.undoHistory, historyItem],
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
        const { library, undoHistory } = get();
        const template = library.find((b) => b.id === id);
        if (!template) return '';

        // Add to undo history
        const historyItem: UndoHistoryItem = {
          id: uuidv4(),
          entity: { type: 'template', data: template },
          timestamp: new Date(),
          label: `Template: ${template.title}`,
        };

        set((state) => ({
          library: state.library.filter((b) => b.id !== id),
          undoHistory: [...state.undoHistory, historyItem],
        }));
        
        return historyItem.id;
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          library: state.library.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
          ),
        }));
      },

      duplicateTemplate: (id) => {
        const { library } = get();
        const template = library.find((t) => t.id === id);
        if (!template) return;

        const duplicate: Block = {
          ...template,
          id: uuidv4(),
          title: `${template.title} (Copy)`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({ library: [...state.library, duplicate] }));
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

      // Owner entity actions
      addOwner: (name) => {
        const newOwner: Owner = {
          id: uuidv4(),
          name,
          order: get().ownerEntities.length,
          createdAt: new Date(),
        };
        set((state) => ({
          ownerEntities: [...state.ownerEntities, newOwner],
        }));
      },

      updateOwner: (id, updates) => {
        set((state) => ({
          ownerEntities: state.ownerEntities.map((o) =>
            o.id === id ? { ...o, ...updates } : o
          ),
        }));
      },

      deleteOwner: (id, reassignToId) => {
        const { ownerEntities, blocks, library, undoHistory } = get();
        const owner = ownerEntities.find((o) => o.id === id);
        if (!owner) return '';

        // Track reassignments for undo
        const reassignments: { blockId: string; rowId: string; oldOwnerId: string }[] = [];

        // Update blocks
        const updatedBlocks = blocks.map((block) => ({
          ...block,
          rows: block.rows.map((row) => {
            if (row.owner === id) {
              reassignments.push({ blockId: block.id, rowId: row.id, oldOwnerId: id });
              return { ...row, owner: reassignToId || '' };
            }
            return row;
          }),
        }));

        // Update library
        const updatedLibrary = library.map((template) => ({
          ...template,
          rows: template.rows.map((row) => {
            if (row.owner === id) {
              return { ...row, owner: reassignToId || '' };
            }
            return row;
          }),
        }));

        // Add to undo history
        const historyItem: UndoHistoryItem = {
          id: uuidv4(),
          entity: { type: 'owner', data: owner, reassignments },
          timestamp: new Date(),
          label: `Owner: ${owner.name}`,
        };

        set({
          ownerEntities: ownerEntities.filter((o) => o.id !== id),
          blocks: updatedBlocks,
          library: updatedLibrary,
          undoHistory: [...undoHistory, historyItem],
        });

        return historyItem.id;
      },

      reorderOwners: (ownerIds) => {
        set((state) => ({
          ownerEntities: state.ownerEntities.map((owner) => ({
            ...owner,
            order: ownerIds.indexOf(owner.id),
          })),
        }));
      },

      // Category entity actions
      addCategory: (name) => {
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4'];
        const newCategory: Category = {
          id: uuidv4(),
          name,
          color: colors[get().categoryEntities.length % colors.length],
          order: get().categoryEntities.length,
          createdAt: new Date(),
        };
        set((state) => ({
          categoryEntities: [...state.categoryEntities, newCategory],
        }));
      },

      updateCategory: (id, updates) => {
        set((state) => ({
          categoryEntities: state.categoryEntities.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },

      deleteCategory: (id, reassignToId) => {
        const { categoryEntities, blocks, library, undoHistory } = get();
        const category = categoryEntities.find((c) => c.id === id);
        if (!category) return '';

        // Track reassignments for undo
        const reassignments: { blockId: string; rowId: string; oldCategoryId: string | undefined }[] = [];

        // Update blocks
        const updatedBlocks = blocks.map((block) => ({
          ...block,
          rows: block.rows.map((row) => {
            if (row.category === id) {
              reassignments.push({ blockId: block.id, rowId: row.id, oldCategoryId: id });
              return { ...row, category: reassignToId === null ? undefined : reassignToId };
            }
            return row;
          }),
        }));

        // Update library
        const updatedLibrary = library.map((template) => ({
          ...template,
          rows: template.rows.map((row) => {
            if (row.category === id) {
              return { ...row, category: reassignToId === null ? undefined : reassignToId };
            }
            return row;
          }),
        }));

        // Add to undo history
        const historyItem: UndoHistoryItem = {
          id: uuidv4(),
          entity: { type: 'category', data: category, reassignments },
          timestamp: new Date(),
          label: `Category: ${category.name}`,
        };

        set({
          categoryEntities: categoryEntities.filter((c) => c.id !== id),
          blocks: updatedBlocks,
          library: updatedLibrary,
          undoHistory: [...undoHistory, historyItem],
        });

        return historyItem.id;
      },

      reorderCategories: (categoryIds) => {
        set((state) => ({
          categoryEntities: state.categoryEntities.map((category) => ({
            ...category,
            order: categoryIds.indexOf(category.id),
          })),
        }));
      },

      // Template preference actions
      updateTemplatePreference: (blockType, dontOffer) => {
        set((state) => ({
          templatePreferences: {
            ...state.templatePreferences,
            dontOfferForIncome: blockType === 'Income' ? dontOffer : state.templatePreferences.dontOfferForIncome,
            dontOfferForFixed: blockType === 'Fixed Bill' ? dontOffer : state.templatePreferences.dontOfferForFixed,
            dontOfferForFlow: blockType === 'Flow' ? dontOffer : state.templatePreferences.dontOfferForFlow,
          },
        }));
      },

      // Undo actions
      undoDelete: (historyId) => {
        const { undoHistory } = get();
        const historyItem = undoHistory.find((h) => h.id === historyId);
        if (!historyItem) return false;

        const { entity } = historyItem;

        switch (entity.type) {
          case 'block':
            set((state) => ({
              blocks: [...state.blocks, entity.data],
              undoHistory: state.undoHistory.filter((h) => h.id !== historyId),
            }));
            break;
          case 'base':
            set((state) => ({
              bases: [...state.bases, entity.data],
              undoHistory: state.undoHistory.filter((h) => h.id !== historyId),
            }));
            break;
          case 'band':
            set((state) => ({
              bands: [...state.bands, entity.data],
              blocks: state.blocks.map((block) => {
                const snapshotBlock = entity.blocksSnapshot.find((b) => b.id === block.id);
                if (snapshotBlock) {
                  return { ...block, bandId: entity.data.id };
                }
                return block;
              }),
              undoHistory: state.undoHistory.filter((h) => h.id !== historyId),
            }));
            break;
          case 'template':
            set((state) => ({
              library: [...state.library, entity.data],
              undoHistory: state.undoHistory.filter((h) => h.id !== historyId),
            }));
            break;
          case 'schedule':
            set((state) => ({
              schedules: [...state.schedules, entity.data],
              undoHistory: state.undoHistory.filter((h) => h.id !== historyId),
            }));
            break;
          case 'fixedBill':
            set((state) => ({
              fixedBills: [...state.fixedBills, entity.data],
              undoHistory: state.undoHistory.filter((h) => h.id !== historyId),
            }));
            break;
          case 'owner':
            set((state) => {
              // Restore owner
              const ownerEntities = [...state.ownerEntities, entity.data];
              
              // Restore original owner IDs
              const blocks = state.blocks.map((block) => ({
                ...block,
                rows: block.rows.map((row) => {
                  const reassignment = entity.reassignments?.find(
                    (r) => r.blockId === block.id && r.rowId === row.id
                  );
                  if (reassignment) {
                    return { ...row, owner: reassignment.oldOwnerId };
                  }
                  return row;
                }),
              }));

              const library = state.library.map((template) => ({
                ...template,
                rows: template.rows.map((row) => {
                  const reassignment = entity.reassignments?.find(
                    (r) => r.blockId === template.id && r.rowId === row.id
                  );
                  if (reassignment) {
                    return { ...row, owner: reassignment.oldOwnerId };
                  }
                  return row;
                }),
              }));

              return {
                ownerEntities,
                blocks,
                library,
                undoHistory: state.undoHistory.filter((h) => h.id !== historyId),
              };
            });
            break;
          case 'category':
            set((state) => {
              // Restore category
              const categoryEntities = [...state.categoryEntities, entity.data];
              
              // Restore original category IDs
              const blocks = state.blocks.map((block) => ({
                ...block,
                rows: block.rows.map((row) => {
                  const reassignment = entity.reassignments?.find(
                    (r) => r.blockId === block.id && r.rowId === row.id
                  );
                  if (reassignment) {
                    return { ...row, category: reassignment.oldCategoryId };
                  }
                  return row;
                }),
              }));

              const library = state.library.map((template) => ({
                ...template,
                rows: template.rows.map((row) => {
                  const reassignment = entity.reassignments?.find(
                    (r) => r.blockId === template.id && r.rowId === row.id
                  );
                  if (reassignment) {
                    return { ...row, category: reassignment.oldCategoryId };
                  }
                  return row;
                }),
              }));

              return {
                categoryEntities,
                blocks,
                library,
                undoHistory: state.undoHistory.filter((h) => h.id !== historyId),
              };
            });
            break;
        }

        return true;
      },

      clearUndoHistory: () => {
        set({ undoHistory: [] });
      },

      // Data actions
      exportData: () => {
        const state = get();
        return JSON.stringify({
          bases: state.bases,
          blocks: state.blocks,
          bands: state.bands,
          library: state.library,
          schedules: state.schedules,
          fixedBills: state.fixedBills,
          owners: state.owners,
          categories: state.categories,
          vendors: state.vendors,
          institutions: state.institutions,
          baseTypes: state.baseTypes,
          flowTypes: state.flowTypes,
          ownerEntities: state.ownerEntities,
          categoryEntities: state.categoryEntities,
          templatePreferences: state.templatePreferences,
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
            schedules: data.schedules || [],
            fixedBills: data.fixedBills || [],
            owners: data.owners || [],
            categories: data.categories || [],
            vendors: data.vendors || [],
            institutions: data.institutions || [],
            baseTypes: data.baseTypes || [],
            flowTypes: data.flowTypes || [],
            ownerEntities: data.ownerEntities || [],
            categoryEntities: data.categoryEntities || [],
            templatePreferences: data.templatePreferences || {
              dontOfferForIncome: false,
              dontOfferForFixed: false,
              dontOfferForFlow: false,
            },
            undoHistory: [],
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
          schedules: [],
          fixedBills: [],
          owners: [],
          categories: [],
          vendors: [],
          institutions: [],
          baseTypes: ['Checking', 'Savings', 'Credit', 'Loan', 'Vault', 'Goal'],
          flowTypes: ['Transfer', 'Payment', 'Expense', 'Reimbursement'],
          ownerEntities: [],
          categoryEntities: [],
          templatePreferences: {
            dontOfferForIncome: false,
            dontOfferForFixed: false,
            dontOfferForFlow: false,
          },
          undoHistory: [],
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
          
          // Migration: Convert old string-based owners/categories to entities
          let ownerEntities: Owner[] = state.ownerEntities || [];
          let categoryEntities: Category[] = state.categoryEntities || [];
          const ownerMap = new Map<string, string>(); // old name -> new ID
          const categoryMap = new Map<string, string>(); // old name -> new ID

          // Migrate owners if entities don't exist but old array does
          if (ownerEntities.length === 0 && state.owners && state.owners.length > 0) {
            ownerEntities = state.owners.map((name: string, index: number) => {
              const id = uuidv4();
              ownerMap.set(name, id);
              return {
                id,
                name,
                order: index,
                createdAt: new Date(),
              };
            });
          } else {
            // Build map for existing entities
            ownerEntities.forEach(o => ownerMap.set(o.name, o.id));
          }

          // Migrate categories if entities don't exist but old array does
          const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4'];
          if (categoryEntities.length === 0 && state.categories && state.categories.length > 0) {
            categoryEntities = state.categories.map((name: string, index: number) => {
              const id = uuidv4();
              categoryMap.set(name, id);
              return {
                id,
                name,
                color: colors[index % colors.length],
                order: index,
                createdAt: new Date(),
              };
            });
          } else {
            // Build map for existing entities
            categoryEntities.forEach(c => categoryMap.set(c.name, c.id));
          }

          // Helper to migrate row references
          const migrateRow = (row: any) => {
            const migratedRow = { ...row };
            
            // Migrate owner reference
            if (row.owner && typeof row.owner === 'string') {
              const ownerId = ownerMap.get(row.owner);
              if (ownerId) {
                migratedRow.owner = ownerId;
              }
            }
            
            // Migrate category reference
            if (row.category && typeof row.category === 'string') {
              const categoryId = categoryMap.get(row.category);
              if (categoryId) {
                migratedRow.category = categoryId;
              }
            }
            
            return migratedRow;
          };
          
          // Convert date strings back to Date objects and migrate references
          return {
            state: {
              ...state,
              ownerEntities,
              categoryEntities,
              bases: (state.bases || []).map((base: any) => ({
                ...base,
                createdAt: base.createdAt ? new Date(base.createdAt) : new Date(),
                updatedAt: base.updatedAt ? new Date(base.updatedAt) : new Date(),
              })),
              blocks: (state.blocks || []).map((block: any) => ({
                ...block,
                date: block.date ? new Date(block.date) : new Date(),
                rows: (block.rows || []).map((row: any) => migrateRow({
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
                rows: (block.rows || []).map((row: any) => migrateRow({
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
              schedules: (state.schedules || []).map((schedule: any) => ({
                ...schedule,
                anchorDate: schedule.anchorDate ? new Date(schedule.anchorDate) : undefined,
                createdAt: schedule.createdAt ? new Date(schedule.createdAt) : new Date(),
              })),
              fixedBills: (state.fixedBills || []).map((bill: any) => ({
                ...bill,
                createdAt: bill.createdAt ? new Date(bill.createdAt) : new Date(),
                updatedAt: bill.updatedAt ? new Date(bill.updatedAt) : new Date(),
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
