# Darelm

Darelm is a Qwen-powered data intelligence platform with three autonomous agents: a Conversational Analyst, an Autopilot Analyst, and an ML Experimenter.

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animations and transitions
- **React Router** - Client-side routing
- **Zustand** - State management
- **Lucide React** - Icon library

### Backend (to be implemented)
- **Python** - Backend language
- **FastAPI** - API framework
- **Qwen Cloud** - AI/ML model provider

## Project Structure

```
darelm/
├── frontend/
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── assets/          # Images, fonts, etc.
│   │   ├── components/
│   │   │   ├── ui/          # Reusable UI components (Button, Badge, Toast, Modal, Table)
│   │   │   ├── layout/      # Layout components (Sidebar, TopNav, Footer)
│   │   │   └── agents/      # Agent-specific components (ConversationalChat, AutopilotFlow, MLExperimenter)
│   │   ├── pages/           # Page components (Landing, Login, Register, Dashboard, Session, Datasets)
│   │   ├── hooks/           # Custom React hooks (useSession, useDataset, useAgent)
│   │   ├── store/           # Zustand state stores (authStore)
│   │   ├── lib/             # Utilities and API client (api, utils)
│   │   └── styles/          # Global styles and design tokens (globals.css)
│   ├── index.html           # HTML entry point
│   ├── package.json         # Dependencies and scripts
│   ├── vite.config.js       # Vite configuration
│   ├── tailwind.config.js   # Tailwind configuration
│   └── postcss.config.js    # PostCSS configuration
│
├── backend/                 # Backend (to be implemented)
│   ├── app/
│   │   ├── api/             # API routes
│   │   ├── agents/          # Agent implementations
│   │   ├── core/            # Core functionality (config, Qwen client, sandbox)
│   │   ├── db/              # Database models and sessions
│   │   └── main.py          # FastAPI entry point
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Backend container
│
├── .env.example             # Environment variables template
├── docker-compose.yml       # Docker orchestration
└── README.md                # This file
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+ (for backend)
- Git

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`.

### Build for Production

```bash
npm run build
```

The built files will be in the `frontend/dist` directory.

## Design System

### Color Tokens
- `--void`: `#0A0A0F` - Page background
- `--surface`: `#111118` - Cards, panels, sidebars
- `--surface-raised`: `#16161F` - Elevated cards, modals
- `--border`: `#1E1E2E` - All borders, dividers
- `--ink`: `#E8E8F0` - Primary text
- `--muted`: `#6B6B80` - Secondary text, labels, placeholders
- `--signal`: `#00E5A0` - Single accent — CTAs, active states, highlights
- `--signal-dim`: `rgba(0, 229, 160, 0.08)` - Accent background tint
- `--error`: `#FF4D6D` - Errors only
- `--warn`: `#FFB347` - Warnings only

### Typography
- **Display**: DM Mono 600 - Hero headlines, agent names, section titles
- **Body**: Inter 400/500 - All prose, descriptions, UI copy
- **Data**: DM Mono 400 - All numbers, metrics, file names, code, timestamps
- **Label**: Inter 500 - Button text, form labels, nav items

### Spacing
- Base unit: 4px
- Content max-width: 1200px
- Page padding: 24px mobile / 48px desktop
- Card padding: 24px
- Section gap: 96px
- Component gap: 16px / 24px

### Border Radius
- Cards: 8px
- Buttons: 6px
- Inputs: 6px
- Badges: 4px

## Pages

### Landing Page (`/`)
- Hero section with coordinate grid background
- Agent cards with scan line hover effect
- How it works section
- Qwen Cloud branding section

### Auth Pages (`/login`, `/register`)
- Split-screen layout with coordinate grid
- Form validation
- Navigation between login and register

### Dashboard (`/dashboard`)
- Sidebar navigation
- Agent selector cards
- Recent sessions list
- Time-based greeting

### Session Page (`/session/:id`)
- Conversational Analyst: Chat interface with data context panel
- Autopilot Analyst: Goal input → Planning → Execution → Report flow
- ML Experimenter: Hypothesis → Preprocessing → Model selection → Training → Results

### Datasets Page (`/datasets`)
- Upload zone with drag-and-drop
- Database connection modal
- Dataset table with actions

## Components

### UI Components
- **Button**: Primary, Ghost, Danger variants with hover animations
- **Badge**: Active and neutral variants for status indicators
- **Toast**: Success, error, info notifications with slide-in animation
- **Modal**: Backdrop with slide-up animation
- **Table**: Data table with hover states and numeric alignment

### Layout Components
- **Sidebar**: Fixed navigation with user avatar and Qwen branding
- **TopNav**: Landing page navigation with links
- **Footer**: Minimal footer with links

### Agent Components
- **ConversationalChat**: Chat interface with typing indicator and data context
- **AutopilotFlow**: Multi-phase workflow with step-by-step execution
- **MLExperimenter**: ML experiment workflow with model training visualization

## Features

- **Coordinate Grid Background**: Signature hero element with parallax scroll effect
- **Scan Line Animation**: One-time sweep on agent card hover
- **Page Load Animations**: Staggered fade-in with translate effect
- **Typing Indicator**: Pulsing dots for agent responses
- **Progress Animations**: Smooth progress bars for training and execution
- **Responsive Design**: Mobile breakpoint at 768px with collapsed sidebar

## Qwen Cloud Integration

The platform prominently features Qwen Cloud branding:
- "POWERED BY QWEN CLOUD" eyebrow on landing hero
- Sidebar footer branding
- Qwen capability pills on landing page
- No Qwen mentions on agent cards (clean design)

## Development Notes

- The frontend is fully functional with mock data
- API integration is stubbed and ready for backend implementation
- All animations respect `prefers-reduced-motion`
- Design follows the "no AI smell" principle — clean, engineering-focused aesthetic
- No gradients, orbs, or floating shapes
- Single accent color (`--signal`) used strategically

## License

MIT
