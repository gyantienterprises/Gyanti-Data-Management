/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gyanti: {
          bg: '#0B0F19',       // Main app background
          sidebar: '#0F1423',  // Sidebar background
          card: '#131A2B',     // Component card background
          border: '#1E293B',   // Subtle borders
          gold: '#F59E0B',     // Primary brand orange/yellow
          goldHover: '#D97706',
          green: '#10B981',    // Positive indicators
          red: '#EF4444',      // Negative indicators
          teal: '#14B8A6',     // Secondary chart color
          purple: '#A855F7',   // Tertiary chart color
          text: '#F9FAFB',     // Main text
          muted: '#9CA3AF',    // Secondary text
        },
      },
    },
  },
  plugins: [],
}