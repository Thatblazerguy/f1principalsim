# F1 Create A Team (F1 Manager)

Welcome to **F1 Create A Team**, an immersive Formula 1 manager web application! Take the reins of your own F1 team, manage your drivers, upgrade your car, and compete in exhilarating races throughout the season.

## 🚀 Features

- **Team Management:** Select and manage your own F1 team.
- **Driver Recruitment:** Hire and manage drivers, with stats dynamically synced from the OpenF1 API.
- **Car Development:** Spend your budget wisely on car upgrades to gain a competitive edge.
- **Season Progression:** Compete in various races across the season, earning points and climbing the standings.
- **Cloud Saves:** Your progress, including team state, race results, and budget, is securely saved to the cloud using Supabase.
- **Modern UI:** Built with a sleek, responsive design featuring Tailwind CSS, Radix UI, and Framer Motion animations.

## 🛠️ Tech Stack

This project is built using modern web development tools and libraries:

- **Frontend Framework:** Vanilla JavaScript with Vite as the bundler.
- **Styling:** Tailwind CSS for utility-first styling, along with custom CSS.
- **UI Components:** Radix UI primitives for accessible, high-quality components.
- **Icons & Animations:** Lucide React for iconography and Framer Motion for smooth animations.
- **Backend & Database:** Supabase for PostgreSQL database, authentication, and Row Level Security (RLS).
- **External APIs:** Integrates with the [OpenF1 API](https://openf1.org/) to keep driver data up to date.

## 📦 Project Structure

```
f1manager/
├── assets/          # Static assets (images, fonts)
├── components/      # Reusable UI components
├── data/            # Data fetching and syncing logic (e.g., OpenF1 sync)
├── game/            # Core game logic and state management
├── lib/             # Utility libraries and configurations
├── screens/         # Different views/screens of the app (Dashboard, Landing, etc.)
├── utils/           # Helper functions
├── app.js           # Main application entry point
├── index.html       # HTML template
├── style.css        # Global styles
└── supabase_schema.sql # Database schema for Supabase
```

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Supabase](https://supabase.com/) account for database and authentication

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd f1manager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Initialize the Database:**
   Run the SQL scripts provided in `supabase_schema.sql` and `f1_save_patch.sql` in your Supabase SQL Editor to set up the necessary tables, triggers, and Row Level Security (RLS) policies.

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Build for production:**
   ```bash
   npm run build
   ```

## 🤝 Contributing

Contributions are welcome! If you'd like to improve the game, add new features, or fix bugs, feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the ISC License.