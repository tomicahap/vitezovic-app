# The Digital Archivist

A genealogical society admin portal built with Next.js, TypeScript, and Tailwind CSS.

## Features Implemented

### ✅ Core Functionality
- **Dashboard**: Overview with stats, recent activities, meetings, and quick actions
- **Members Management**: View, search, filter, and add new members
- **Meetings**: Schedule and manage society meetings
- **Projects**: Track research projects and progress
- **Archive**: Digital document repository with search and filtering
- **Google Drive Integration**: Cloud storage interface

### ✅ Interactive Features
- **Add New Members**: Form with validation using React Hook Form and Zod
- **Search & Filter**: Real-time search and filtering across all sections
- **Responsive Design**: Mobile-friendly layout with proper navigation
- **State Management**: React Context for managing application state

### ✅ UI Components
- **Navigation Sidebar**: Active state management and routing
- **Data Tables**: Sortable and paginated tables
- **Forms**: Validated forms with proper error handling
- **Modals/Dialogs**: For adding new records
- **Cards and Badges**: Status indicators and information display

## Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **State Management**: React Context

## Project Structure
```
app/
├── layout.tsx          # Root layout with providers
├── page.tsx           # Dashboard page
├── members/
│   └── page.tsx       # Members management
├── meetings/
│   └── page.tsx       # Meetings management
├── projects/
│   └── page.tsx       # Projects tracking
├── archive/
│   └── page.tsx       # Digital archive
└── drive/
    └── page.tsx       # Google Drive interface

components/
├── app-sidebar.tsx    # Main navigation
├── dashboard-content.tsx
├── members-content.tsx
├── meetings-content.tsx
├── projects-content.tsx
├── archive-content.tsx
├── drive-content.tsx
├── add-member-dialog.tsx
└── ui/               # Reusable UI components

contexts/
└── members-context.tsx # State management
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Features

### Members Management
- Add new members with form validation
- Search by name or email
- Filter by status and payment status
- View member details and research areas

### Dashboard
- Real-time statistics
- Recent activities feed
- Upcoming meetings and events
- Quick actions for common tasks

### Archive System
- Document upload and management
- Category-based organization
- Access level controls
- Search and filter capabilities

## Next Steps
- Add authentication and user roles
- Implement data persistence (database integration)
- Add file upload functionality
- Create detailed member profiles
- Add meeting scheduling with calendar integration
- Implement project collaboration features