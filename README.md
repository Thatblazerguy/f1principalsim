# 🏎️ F1 Manager: Championship Hub

**F1 Manager** is an immersive Formula 1 team management simulator where you take control of an F1 team, manage drivers, develop your car, and compete throughout an entire championship season. Build your legacy by making strategic decisions on driver recruitment, car development, sponsorships, and race strategy.

> *Available at: `npm run dev` → Open browser at localhost*

---

## 📖 Table of Contents

- [Features](#-features)
- [Game Mechanics](#-game-mechanics)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Getting Started](#-getting-started)
- [Environment Setup](#-environment-setup)
- [Game Systems Guide](#-game-systems-guide)
- [Database Schema](#-database-schema)
- [Design System](#-design-system)
- [Development Guide](#-development-guide)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Features

### Core Gameplay
- **Team Selection & Management** – Start your season by choosing from 10 F1 teams, each with unique base performance metrics and budgets
- **Dynamic Driver Market** – Scout, sign, and manage drivers with real-time integration to the OpenF1 API for authentic driver data
- **Car Development System** – Invest budget points into four core car systems: aerodynamics, engine, chassis, and reliability
- **Complete Season Progression** – Race through a full 24-race championship calendar, earning points and competing for the championship
- **Strategic Race Planning** – Select race strategies, manage tire strategies, practice sessions, and qualifying runs

### Advanced Systems
- **Driver Academy** – Train young drivers with customizable development programs focusing on specific skill areas
- **Scouting Network** – Scout promising drivers across multiple regions with detailed attribute analysis
- **Sponsorship Deals** – Negotiate sponsorship contracts for revenue and stat bonuses
- **Pit Wall Decisions** – Make real-time strategic calls during races (pit timing, tire strategy, driver instructions)
- **Driver Morale & Contracts** – Manage driver satisfaction, contract negotiations, and career progression
- **Detailed Statistics** – Track driver performance, car upgrades, financial records, and championship standings

### Technical Features
- **Cloud-Based Save System** – All progress securely saved to Supabase with Row Level Security (RLS) for privacy
- **Real-Time Sync** – Driver stats and team data synchronized from the OpenF1 API
- **Responsive Design** – Fully responsive UI optimized for desktop, tablet, and mobile devices
- **Modern Animations** – Smooth transitions and micro-interactions powered by Framer Motion
- **Dark Mode UI** – Eye-friendly glassmorphism design system with Formula 1 branding

---

## 🎮 Game Mechanics

### Gameplay Loop
1. **Season Setup** – Select your team and recruit your driver lineup (lead driver, second driver, reserve driver)
2. **Weekly Cycles** – Each race week includes practice sessions, qualifying rounds, and the main race event
3. **Strategic Management** – Between races, manage your budget, develop your car, scout new drivers, and negotiate sponsorships
4. **Race Simulation** – Competitive racing with dynamic simulation based on driver skill, car performance, weather, and strategy
5. **Season Progression** – Build points and climbing the championship standings across 24 races

### Budget & Economics
- **Initial Budget** – Each team starts with a budget pool based on team tier
- **Budget Sources** – Earnings from race points, sponsorship deals, and performance bonuses
- **Budget Expenses** – Driver salaries, car development upgrades, academy training, and sponsorship slots
- **Financial Strategy** – Balance long-term car development with short-term driver talent acquisition

### Driver Attributes (0-100 scale)
- **Pace** – Top speed and acceleration potential
- **Qualifying** – Single-lap performance in qualifying sessions
- **Racecraft** – Ability to make strategic decisions and adapt during races
- **Tyre Management** – Skill in preserving tire grip throughout a stint
- **Wet Weather** – Performance in rain and damp conditions
- **Consistency** – Reliability and minimized mistakes over a race distance
- **Adaptability** – Speed of learning new cars and setups
- **Feedback** – Quality of engineering input and communication
- **Mentality** – Mental resilience under pressure
- **Media Handling** – Public relations and sponsorship appeal

### Car Performance Components
- **Aerodynamics (Aero)** – Downforce and top speed efficiency
- **Engine** – Power delivery and race boost capability
- **Chassis** – Handling, acceleration out of corners, and setup flexibility
- **Reliability** – Probability of mechanical failures during races

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Vanilla JavaScript with React (TSX/JSX components)
- **Build Tool:** Vite for fast development and optimized production builds
- **Styling:** 
  - Tailwind CSS v4 for utility-first responsive design
  - Custom CSS for brand-specific styling
- **UI Libraries:**
  - Radix UI primitives (avatars, dropdowns, popovers, scroll areas, separators)
  - Lucide React for consistent iconography
  - Framer Motion for animations and transitions

### Backend & Database
- **Database:** PostgreSQL (hosted on Supabase)
- **Authentication:** Supabase Auth (email/password, OAuth support)
- **Security:** Row Level Security (RLS) policies for user data isolation
- **Real-time Sync:** Supabase Realtime subscriptions (optional for future features)

### External APIs
- **OpenF1 API** – Fetch real driver data, team information, and race calendars
- **Weather Data** – (Optional future integration) Real-time weather conditions for race simulation

### Development & DevOps
- **Package Manager:** npm
- **Version Control:** Git
- **Language:** TypeScript for type safety in React components

---

## 📦 Project Architecture

### Directory Structure

```
f1manager/
├── assets/                      # Static assets
│   └── fonts/                   # Formula 1 typeface files
├── components/                  # Reusable React components
│   ├── HubLayout.tsx            # Main championship hub scaffold
│   ├── ChampionshipHub.tsx       # Hub container with sidebar navigation
│   ├── NavDropdown.tsx          # Navigation dropdown menus
│   ├── driverComparison.tsx     # Driver stats comparison UI
│   ├── demo.tsx                 # Demo/showcase components
│   └── ui/                      # Radix UI component library
│       ├── animated-tabs.tsx    # Custom tabbed interface
│       ├── avatar.tsx           # Driver/team avatars
│       ├── button.tsx           # Reusable button component
│       ├── dropdown-menu.tsx    # Dropdown interactions
│       ├── header-2.tsx         # Header variants
│       ├── popover.tsx          # Popover dialogs
│       ├── scroll-area.tsx      # Scrollable containers
│       ├── sign-in.tsx          # Authentication forms
│       ├── slide-tabs.tsx       # Animated tab switching
│       └── workspaces.tsx       # Workspace/team switcher
├── data/                        # Game data & API integration
│   ├── calendar.js              # Race calendar and schedule
│   ├── drivers.js               # OpenF1 driver sync & database
│   ├── sponsors.js              # Sponsorship contracts data
│   ├── strategies.js            # Pit strategy definitions
│   └── teams.js                 # F1 teams reference data
├── game/                        # Core game logic & simulation
│   ├── academy.js               # Driver training & development
│   ├── development.js           # Car upgrade progression system
│   ├── driver.js                # Driver class and attributes
│   ├── practice.js              # Practice session simulation
│   ├── qualifying.js            # Qualifying round simulation
│   ├── race.js                  # Single race simulation engine
│   ├── raceSimulator.js         # Full season race simulation
│   ├── scouting.js              # Driver scouting mechanics
│   ├── standings.js             # Championship standings calculation
│   └── team.js                  # Team class and management
├── lib/                         # Utility libraries
│   ├── supabaseClient.js        # Supabase client configuration
│   ├── supabaseApi.js           # Supabase data operations
│   └── utils.ts                 # General utility functions
├── screens/                     # Full-page screen components
│   ├── landing.tsx              # Landing/splash screen
│   ├── auth.tsx                 # Authentication portal
│   ├── setup.tsx                # Initial team/driver setup
│   ├── dashboard.tsx            # Main dashboard overview
│   ├── ChampionshipHub.tsx       # Hub navigation scaffold
│   ├── weekend.tsx              # Race weekend (practice → qualifying → race)
│   ├── academy.tsx              # Driver academy & training
│   ├── myDrivers.tsx            # Driver roster management
│   ├── teams.tsx                # Team selection & info
│   ├── market.tsx               # Driver transfer market
│   ├── sponsors.tsx             # Sponsorship management
│   ├── finance.tsx              # Budget & financial overview
│   ├── office.tsx               # General team management
│   ├── calendar.tsx             # Race calendar view
│   ├── leaderboard.tsx          # Championship standings
│   ├── offseason.tsx            # Off-season management
│   └── hubNav.tsx               # Hub navigation logic
├── utils/                       # Helper functions
│   ├── carDevelopment.js        # Car upgrade calculations
│   ├── reactRoot.tsx            # React mounting utilities
│   ├── seasonTimeline.js        # Season scheduling logic
│   ├── simTeam.js               # Team simulation helpers
│   ├── sponsorDeals.js          # Sponsorship calculations
│   ├── storage.js               # LocalStorage/SessionStorage helpers
│   └── teamState.js             # Team state management
├── app.js                       # Application entry point
├── index.html                   # HTML template
├── style.css                    # Global styles
├── design.md                    # Design system documentation
├── supabase_schema.sql          # Database initialization script
├── f1_save_patch.sql            # Database migration patches
├── vite.config.js               # Vite build configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── postcss.config.js            # PostCSS configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies and scripts
```

### Component Architecture

**Legacy Pattern (Still Used):**
- `.innerHTML` string injection for dynamic screen rendering
- JavaScript class-based game logic

**Modern Pattern (Migration Ongoing):**
- React components (TSX/JSX) for new screens
- Functional React composition with hooks
- Separated concerns between game logic and UI rendering

**Hybrid Approach:**
- `reactRoot.tsx` mounts full-page React experiences (Landing, Auth, Setup)
- `HubLayout.tsx` injects sub-screens into a persistent hub scaffold
- Game logic remains purely JavaScript (no React dependency)

---

## 🏁 Getting Started

### Prerequisites

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Supabase Account** ([Sign up free](https://supabase.com/)) for database and authentication
- **Git** for version control
- **Modern Browser** (Chrome, Firefox, Safari, or Edge)

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/f1manager.git
cd f1manager
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Set Up Supabase Project

1. Create a new project on [Supabase](https://supabase.com/)
2. Note your project URL and public anon key
3. In the Supabase SQL Editor, run the initialization scripts:
   - First, execute **`supabase_schema.sql`** to create tables and RLS policies
   - Then, execute **`f1_save_patch.sql`** for any additional migrations
4. Enable Google/GitHub OAuth (optional, for social authentication)

#### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: API Keys for integrations
VITE_OPENF1_API_URL=https://api.openf1.org
```

**Where to find these values:**
- Go to Supabase → Project Settings → API
- Copy the "Project URL" and "public anon key"

#### 5. Start Development Server

```bash
npm run dev
```

The application will open at `http://localhost:5173` (or the next available port).

#### 6. Build for Production

```bash
npm run build
```

The production build is optimized and ready for deployment.

### First-Time Setup

1. **Create Account** – Sign up or log in via the auth screen
2. **Select Team** – Choose your F1 team from the available options
3. **Recruit Drivers** – Sign your lead driver, second driver, and reserve driver
4. **Begin Season** – Start your championship with the first race weekend

---

## 🎲 Environment Setup

### Development

```bash
# Watch mode with hot reload
npm run dev

# Build once
npm run build

# Run production build (requires built assets)
npm run build && npm run preview  # (if preview script exists)
```

### Environment Variables Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | Supabase project endpoint | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public authentication key | `eyJhbGc...` |
| `VITE_OPENF1_API_URL` | OpenF1 API endpoint (optional) | `https://api.openf1.org` |

### Database Setup Checklist

- [ ] Supabase project created
- [ ] SQL initialization scripts executed
- [ ] Tables created: `profiles`, `teams`, `drivers`, `races`, `user_game_state`, `race_results`
- [ ] RLS policies enabled on all tables
- [ ] Authentication providers configured
- [ ] Environment variables in `.env`

---

## 🎯 Game Systems Guide

### 1. Team Management (`game/team.js`)

**Responsibilities:**
- Driver roster tracking (lead, second, reserve)
- Budget allocation and spending
- Sponsor slot management
- Car upgrade tracking

**Key Methods:**
```javascript
team.signDriver(driver, role)     // Sign a driver (lead/second/reserve)
team.releaseDriver(name)          // Release a driver to free agency
team.upgradeCar(system, amount)   // Invest budget in car development
team.getSponsor()                 // Get active sponsor
team.addSponsors(sponsor)         // Sign sponsorship deal
```

### 2. Driver Academy (`game/academy.js`)

**Features:**
- Focus training on specific driver attributes
- Personality & driving style assignment
- Development rate based on age and attribute potential
- Hidden traits system (work ethic, professionalism, pressure resistance)

**Training Focus Areas:**
- Pace Development
- Qualifying Improvement
- Wet Weather Performance
- Racecraft Enhancement
- Consistency Refinement

### 3. Car Development (`game/development.js`)

**Upgrade System:**
- **Aerodynamics** – Increases downforce and top speed
- **Engine** – Boosts acceleration and race performance
- **Chassis** – Improves handling and cornering speed
- **Reliability** – Reduces mechanical failure probability

**Progression:**
- Each upgrade level (1-10) costs increasingly more budget
- Diminishing returns on high-level upgrades
- Benefits compound with driver skill

### 4. Race Simulation (`game/raceSimulator.js`, `game/race.js`)

**Simulation Engine:**
- Lap-by-lap race modeling with weather effects
- Pit stop timing calculations
- Tire degradation modeling
- Driver consistency variance
- Safety car and incident simulation (random)
- Points allocation (F1 2024 format: 25-18-15-12-10-8-6-4-2-1)

**Strategy Impact:**
- Tire choice affects pit stop timing and lap times
- Fuel management influences race pace
- Safety car windows create strategic opportunities
- Weather changes mid-race

### 5. Driver Scouting (`game/scouting.js`)

**Scout Mechanics:**
- Discover promising drivers across regions
- Get detailed attribute previews before signing
- Market value assessment
- Contract negotiation
- Hidden potential detection

**Regions:**
- Europe
- Americas
- Asia-Pacific
- Middle East
- Africa

### 6. Sponsorship System (`data/sponsors.js`)

**Deal Types:**
- **Title Sponsor** – Significant budget boost, stat bonuses
- **Technical Partner** – Car performance bonuses
- **Media Partner** – Driver morale and PR bonus

**Contract Terms:**
- 1-3 year agreements
- Budget payment per season
- Performance incentive clauses
- Driver preference alignment

### 7. Championship Standing (`game/standings.js`)

**Calculation:**
- Points tallied across all races
- Driver and constructor standings tracked separately
- Head-to-head driver statistics
- Performance metrics and records

---

## 📊 Database Schema

### Tables Overview

#### `profiles` (User Data)
```sql
id (uuid, PK)              -- Linked to auth.users
username (text)            -- Display name
avatar_url (text)          -- Profile picture
created_at (timestamp)     -- Account creation date
```

#### `teams` (Global Reference)
```sql
id (uuid, PK)
name (text)                -- Team name
logo_url (text)
base_performance (int)     -- Base car performance rating
budget (int)               -- Starting budget for new games
```

#### `drivers` (Global Reference)
```sql
id (uuid, PK)
first_name (text)
last_name (text)
skill_level (int)          -- 0-100 overall rating
salary (int)               -- Annual salary cost
portrait_url (text)        -- Driver photo
team_id (uuid, FK)         -- Optional: default F1 team
```

#### `races` (Global Reference)
```sql
id (uuid, PK)
name (text)                -- Race name/location
track_image_url (text)
laps (int)                 -- Race distance
season_order (int)         -- Position in calendar (1-24)
```

#### `user_game_state` (Player Progress)
```sql
id (uuid, PK)
user_id (uuid, FK)         -- Links to profile
selected_team_id (uuid, FK)
driver_1_id (uuid, FK)     -- Lead driver
driver_2_id (uuid, FK)     -- Second driver
current_season (int)       -- Season number
current_race_index (int)   -- Race in calendar
points (int)               -- Championship points
budget (numeric)           -- Current budget
standings_position (int)   -- Current championship position
car_upgrades (jsonb)       -- Aero, engine, chassis, reliability levels
created_at (timestamp)
updated_at (timestamp)
```

#### `race_results` (Historical Data)
```sql
id (uuid, PK)
user_id (uuid, FK)
race_id (uuid, FK)
driver_id (uuid, FK)
position (int)             -- Finishing position
points_awarded (int)       -- Points earned
completion_time (numeric)  -- Race time in seconds
created_at (timestamp)
```

### Row Level Security (RLS) Policies

- **Profiles:** Users can only view/update their own profile
- **Teams/Drivers/Races:** Global read-only (seeded by admins)
- **User Game State:** Users can full CRUD only their own state
- **Race Results:** Users can full CRUD only their own results

---

## 🎨 Design System

### Visual Language

The UI uses a **glassmorphism** aesthetic inspired by F1 pit wall telemetry dashboards:
- Deep navy backgrounds (`#0B0F19`)
- Translucent glass panels with 12px blur
- Vibrant racing red accents (`#E10600`)
- Monospace data typography for statistics

### Typography

**Font Stack:**
- `Formula1-Wide` – Page titles, headlines (brand voice)
- `Formula1-Bold` – Card titles, data values, navigation
- `Formula1-Regular` – Body text, labels, descriptions

**Scale:**
- **Page Title:** 28px, uppercase, letter-spaced
- **Card Title:** 16-18px, bold
- **Stat Value:** 20-24px, monospace, tabular numbers
- **Body Text:** 14px, regular
- **Label:** 10-13px, uppercase, 0.15em letter-spacing

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `HUB.bg` | `#0B0F19` | Main background |
| `HUB.sidebar` | `#080B12` | Navigation sidebar |
| `HUB.accent` | `#E10600` | Active states, CTAs |
| `HUB.textPrimary` | `#FFFFFF` | Primary text |
| `HUB.textMuted` | `#94A3B8` | Secondary text |
| `HUB.border` | `rgba(255,255,255,0.05)` | Subtle borders |
| `HUB.borderMid` | `rgba(255,255,255,0.1)` | Card borders |

### Component Library (`components/HubLayout.tsx`)

Reusable styled component generators:

```typescript
glassCard(extra)       // Main UI building block with blur + transparency
actionBtn(extra)       // Primary red button with glow effect
sectionLabel(text)     // Tiny uppercase red label
pageTitle(text)        // Large bold headline
pageSubtitle(text)     // Small gray description
statLabel(text)        // Label above a number
statValue(text)        // Monospace numeric display
```

---

## 💻 Development Guide

### Adding a New Screen

1. Create a new file in `screens/`
   ```typescript
   // screens/myNewScreen.tsx
   export function renderMyNewScreen(container) {
     return (
       <div className="p-6">
         <h1 className="text-2xl font-bold">My New Screen</h1>
       </div>
     );
   }
   ```

2. Add navigation in `screens/hubNav.tsx`
   ```javascript
   case 'myNewScreen':
     mountLayout(renderMyNewScreen, container);
     break;
   ```

3. Add menu item in `components/NavDropdown.tsx`
   ```typescript
   { label: 'My New Screen', action: 'myNewScreen' }
   ```

### Adding Game Logic

1. Create a new file in `game/`
2. Export a class or functions with clear, documented methods
3. Keep game logic separate from UI rendering
4. Add state persistence to `user_game_state` table when needed

### Syncing Real-Time Data

```javascript
// Example: Sync drivers from OpenF1 API
async function syncDriversFromOpenF1() {
  const response = await fetch('https://api.openf1.org/v1/drivers');
  const drivers = await response.json();
  // Process and store in database
}
```

### Database Migrations

When modifying the schema:
1. Create a new SQL file: `migrations/[timestamp]_description.sql`
2. Test in Supabase SQL Editor
3. Document changes in a new patch file
4. Update `supabase_schema.sql` to reflect current state

### Testing Locally

```bash
# Run development server with hot reload
npm run dev

# Open browser DevTools (F12)
# → Console for JS errors
# → Network for API calls
# → Application → Local Storage for game state
```

### Code Style Guidelines

- **JavaScript/TypeScript:** ES6+ syntax, arrow functions, const/let
- **React:** Functional components with hooks, avoid class components
- **CSS:** Tailwind utilities first, custom CSS for unique designs
- **Comments:** Document complex logic, game mechanics, and API integrations
- **Naming:** CamelCase for functions/variables, PascalCase for classes/components

---

## 🔧 Troubleshooting

### Common Issues

#### "Cannot connect to Supabase"
**Solution:**
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- Check Supabase project status in dashboard
- Ensure RLS policies allow your user access
- Check browser console for specific error messages

#### "Driver data not syncing from OpenF1"
**Solution:**
- Verify OpenF1 API is accessible: `curl https://api.openf1.org/v1/drivers`
- Check network tab in DevTools for failed requests
- Ensure `syncDriversFromOpenF1()` is called on app boot in `app.js`
- Clear LocalStorage and refresh

#### "Game state not saving"
**Solution:**
- Verify user is authenticated (check `auth.users` in Supabase)
- Check RLS policy: `SELECT * FROM user_game_state WHERE user_id = auth.uid()`
- Ensure `user_game_state` row exists for current user
- Check browser console for Supabase error details

#### "Races not progressing or simulating"
**Solution:**
- Verify race data is seeded in `races` table
- Check driver attributes are within valid ranges (0-100)
- Ensure team car upgrades are initialized
- Review race simulation logs in browser console

#### "UI not rendering properly / Tailwind classes not applied"
**Solution:**
- Rebuild Tailwind: restart dev server with `npm run dev`
- Check `tailwind.config.js` includes correct `content` paths
- Verify `style.css` imports `@tailwind` directives
- Clear browser cache (Ctrl+Shift+Delete)

#### "Build fails with TypeScript errors"
**Solution:**
- Run `npm run build` to see full errors
- Check `tsconfig.json` settings
- Ensure all imports use correct relative paths
- Use `as unknown as Type` for complex prop passing if needed

### Performance Optimization

**If the app feels sluggish:**
1. Check DevTools Performance tab for long tasks
2. Profile React components with React DevTools
3. Reduce animation frame rates if needed (Framer Motion config)
4. Optimize database queries in `lib/supabaseApi.js`
5. Use code splitting for large screens (Vite lazy imports)

### Debug Mode

Enable detailed logging:

```javascript
// In app.js or any file
const DEBUG = true;
if (DEBUG) {
  console.log('Game State:', gameState);
  console.log('User:', currentUser);
}
```

---

## 🤝 Contributing

### Getting Started with Contributions

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with clear commit messages
4. Add comments explaining non-obvious logic
5. Test thoroughly before submitting
6. Push to your fork and create a Pull Request

### Areas for Contribution

- **Bug Fixes:** Report and fix issues found during gameplay
- **Features:** New screens, game mechanics, or systems
- **UI/UX:** Polish, accessibility improvements, responsive design
- **Performance:** Optimization, code refactoring
- **Documentation:** README clarity, code comments, guides

### Code Review Process

- All PRs require review before merging
- Test game logic independently of UI
- Ensure backward compatibility where possible
- Update documentation for new features
- Follow existing code style and patterns

---

## 📋 Known Issues & Roadmap

### Currently In Development
- [ ] Mobile responsive optimization
- [ ] Multiplayer competitive seasons
- [ ] Driver injuries and medical recovery system
- [ ] Advanced weather simulation
- [ ] Team radio communications with AI co-pilot
- [ ] Historical replay and telemetry viewing

### Known Limitations
- Race simulation is deterministic (same state → same result)
- Limited to 24-race seasons
- No dynamic track condition changes mid-session (practice/quali)
- Driver development is linear without major breakpoints
- No transfer market for AI team drivers

### Performance Notes
- Large season data (multiple years) may slow down UI
- Real-time Supabase subscriptions not yet implemented
- Race simulation runs synchronously (blocks UI during calculation)

---

## 📄 License

This project is licensed under the **ISC License** – See [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- **OpenF1 API** – Real-time F1 data and driver information
- **Supabase** – Backend infrastructure and database hosting
- **Radix UI** – Accessible component primitives
- **Tailwind CSS** – Utility-first CSS framework
- **Framer Motion** – Animation library
- **Formula 1** – Inspiration and authentic branding

---

**Questions or Feedback?** Open an issue on GitHub or reach out to the maintainers.

**Happy Racing! 🏁**