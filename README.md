# NCSC7 Expanded Centenarian Cash Gift (ECA) System

A comprehensive management system for administering cash gifts to senior citizens at milestone ages (80, 85, 90, 95, and 100 years old).

## Overview

The ECA system streamlines the process of identifying eligible senior citizens, generating applications, tracking payment status, and providing statistical insights for the Expanded Centenarian Cash Gift program.

## Features

- **Citizen Management**: Register, update, and manage citizen records
- **ECA Application Processing**: Generate and process applications for eligible citizens
- **Age-based Cash Gifts**:
  - Ages 80, 85, 90, 95: ₱10,000
  - Age 100: ₱100,000
- **Dashboard & Analytics**: Visualize program statistics and track progress
- **User Management**: Role-based access control for system administrators
- **Audit Trail**: Comprehensive logging of all system activities
- **Duplicate Checking**: Identify and manage potential duplicate citizen records
- **Broadcast Messaging**: System-wide notifications for all users
- **Import/Export**: Data migration capabilities for citizen records
- **Address Management**: Standardized address management system

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: TailwindCSS
- **State Management**: React Context API
- **Forms**: React Hook Form with Zod validation
- **Routing**: React Router v6
- **Data Visualization**: Recharts
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Data Processing**: PapaParse, XLSX

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository
   ```
   git clone https://github.com/your-organization/ncsc7eca.git
   cd ncsc7eca
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Set up environment variables
   ```
   cp .env.example .env
   ```
   
   Edit the `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Start the development server
   ```
   npm run dev
   ```

5. Build for production
   ```
   npm run build
   ```

## Database Setup

The application requires a Supabase project with the proper database schema. The migrations are located in the `supabase/migrations` directory.

To apply the migrations:

1. Install the Supabase CLI
2. Link your project: `supabase link --project-ref your-project-ref`
3. Apply migrations: `supabase db push`

## Application Structure

```
ncsc7eca/
├── docs/                   # Documentation
├── src/                    # Source code
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React context providers
│   ├── lib/                # Utility functions and types
│   ├── pages/              # Application pages
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Application entry point
├── supabase/               # Supabase configuration
│   └── migrations/         # Database migrations
├── .env.example            # Example environment variables
├── package.json            # Project dependencies
├── tailwind.config.js      # TailwindCSS configuration
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
```

## Key Features Explained

### ECA Management

The ECA Management module allows administrators to:
- View and filter ECA applications by year, type, and status
- Search by citizen name, OSCA ID, or RRN
- Update application status
- Generate bulk applications for a specific year
- View complete citizen and address information

### ECA Dashboard

The ECA Dashboard provides:
- Year-over-year statistics overview
- ECA type breakdown with progress indicators
- Detailed statistics table
- Payment completion percentages
- Total amounts and application counts

### Eligibility Rules

1. Citizens must be exactly 80, 85, 90, 95, or 100 years old in the target year
2. Citizens must have valid status (not Disqualified)
3. Citizens cannot receive the same ECA type twice
4. Citizens must reapply when they reach each milestone age

## Usage Instructions

### 1. Initial Setup
1. Run the migration: `supabase/migrations/20250526000000_expanded_centenarian_cash_gifts.sql`
2. The system will create all necessary tables, functions, views, and indexes

### 2. Generating Applications
1. Navigate to ECA Management
2. Select the target year (2024, 2025, etc.)
3. Click "Generate [Year] Applications"
4. The system will automatically create applications for all eligible citizens

### 3. Processing Applications
1. Use filters to find specific applications
2. Update status using the dropdown in the Actions column
3. Payment date is automatically set when status changes to "Paid"

### 4. Monitoring Progress
1. Use the ECA Dashboard to view overall statistics
2. Monitor payment completion rates
3. Track yearly trends and distributions

## Security Features

1. **Row Level Security (RLS)** enabled on all tables
2. **Foreign key constraints** ensure data integrity
3. **Check constraints** validate data values
4. **Unique constraints** prevent duplicate benefits
5. **Audit trail** with created_by and updated_by tracking

## Performance Optimizations

1. **Indexes** on frequently queried columns
2. **Views** for complex joins to improve query performance
3. **Denormalized birth_date** in ECA table for faster age calculations

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a pull request

## License

This project is licensed under the [MIT License](LICENSE).

## Support

For questions or issues with the ECA system implementation, refer to:
1. The documentation in the `docs` directory
2. Database migration file comments
3. Component source code comments
4. TypeScript type definitions
