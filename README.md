# Budget Blocks

A sophisticated Notion-style personal finance web application for planning and tracking money with Blocks, Pay Period Bands, and intelligent account management.

## 🚀 Features

### Core Functionality
- **Bases (Accounts)**: Manage multiple financial accounts (Checking, Savings, Credit, Loan, Vault, Goal)
- **Blocks**: Group transactions into Income, Fixed Bill, or Flow blocks
- **Pay Period Bands**: Organize blocks by date-bounded periods (weekly, biweekly, monthly, custom)
- **KPI Dashboard**: Real-time financial overview with Total Cash, Credit Debt, and Net Worth
- **Balance Engine**: Execute transactions to update account balances in real-time
- **Block Library**: Save and reuse transaction templates

### Technical Features
- **Local-First**: All data stored in browser using Zustand + LocalStorage
- **Export/Import**: JSON-based data portability
- **Responsive Design**: Beautiful UI built with Tailwind CSS and shadcn/ui
- **Professional Finance Theme**: Blue/teal color palette with semantic design tokens
- **Type-Safe**: Full TypeScript implementation

## 🛠️ Tech Stack

- **Framework**: React + TypeScript + Vite
- **State Management**: Zustand with persistence
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS with custom design system
- **Date Handling**: date-fns
- **Validation**: zod
- **Icons**: Lucide React

## 📋 Getting Started

### Quick Start

1. **Welcome Dialog**: On first launch, choose "Load Sample Data" to explore features or "Start Fresh" to begin from scratch

2. **Create Bases**: Set up your financial accounts (checking, savings, credit cards, etc.)

3. **Set Pay Periods**: Generate monthly, biweekly, or custom pay period bands

4. **Add Blocks**: Create Income, Fixed Bill, or Flow blocks to track transactions

5. **Execute Transactions**: Check off transactions as they occur to update your real balances

### Key Workflows

#### Managing Bases
- Click "Manage Bases" in the Bases panel
- Add accounts with name, type, institution, balance
- View live balances updated as you execute transactions

#### Creating Blocks
1. Click "New Block" in the top bar
2. Choose block type: Income, Fixed Bill, or Flow
3. Add transaction rows with amounts and account associations
4. Save & Insert to add to ledger, or Save to Library for reuse

#### Pay Period Management
- Click "Pay Periods" in the top bar
- Quick generate monthly or biweekly periods
- Blocks automatically assigned to periods by date

#### Executing Transactions
- Expand blocks in the Ledger panel
- Check the "Execute" checkbox for each transaction
- Watch your base balances update in real-time

## 📊 Data Model

### Bases
Accounts where money lives. Each has:
- Name, Type, Institution, Identifier
- Current balance
- Tags for organization

### Blocks
Groups of transactions. Types:
- **Income**: Money coming in (salary, freelance, etc.)
- **Fixed Bill**: Recurring expenses (rent, utilities, subscriptions)
- **Flow**: Custom transactions (transfers, payments, expenses)

### Rows
Individual transactions within blocks:
- From/To bases
- Amount, category, notes
- Executed status

### Pay Period Bands
Time containers that organize blocks:
- Start/End dates
- Auto-calculate Expected Income, Expected Fixed, Available to Allocate
- Show execution progress

## 🎨 Design System

The app uses a professional finance-themed design with:
- **Primary**: Professional blue (`hsl(214 95% 45%)`)
- **Secondary**: Growth green (`hsl(164 75% 42%)`)
- **Success**: Positive green for cash/income
- **Warning**: Amber for bills/pending
- **Destructive**: Red for debt/negative

All colors defined as HSL semantic tokens for consistency and theme support.

## 🔒 Data & Privacy

- **100% Local**: All data stored in your browser's LocalStorage
- **No Server**: No data leaves your device
- **Export Anytime**: Download your data as JSON
- **Import**: Restore from exported JSON files

## 🚧 Future Enhancements (Not in MVP)

- Recurring block automation
- Forecast KPIs (planned transactions)
- Drag-and-drop block reordering
- Charts and trend visualization
- Multi-currency support
- Mobile app
- Cloud sync option

## 📦 Project Structure

```
src/
├── components/          # UI components
│   ├── ui/             # shadcn/ui components
│   ├── KPIPanel.tsx    # Financial overview
│   ├── BaseBlocksPanel.tsx
│   ├── LedgerPanel.tsx
│   ├── BlockLibraryPanel.tsx
│   └── dialogs/        # Modal components
├── lib/
│   ├── store.ts        # Zustand state management
│   ├── db.ts           # Dexie DB setup (future)
│   └── utils.ts        # Utilities
├── types/
│   └── index.ts        # TypeScript types
└── pages/
    └── Index.tsx       # Main app page
```

## 🤝 Contributing

This is a personal finance management tool. Feel free to fork and customize for your needs!
