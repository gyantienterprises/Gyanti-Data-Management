import { Users, FileText, BarChart2, PlusCircle, Edit } from 'lucide-react';
import logo from '../assets/logo.png';

const navItems = [
  { name: 'Client', icon: Users },
  { name: 'Bills', icon: FileText },
  { name: 'Analytics', icon: BarChart2 },
  { name: 'New Entry', icon: PlusCircle },
  { name: 'Update Entry', icon: Edit },
];

export default function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="w-64 h-screen bg-[#0F1423] border-r border-slate-800/80 flex flex-col justify-between shrink-0">
      <div>
        {/* Logo Section */}
        <div className="flex items-center gap-3 p-6 border-b border-slate-800/80">
          <img src={logo} alt="Gyanti Logo" className="h-8 object-contain" />
          <span className="text-[10px] font-bold tracking-wider text-slate-400 border border-slate-700 px-2 py-0.5 rounded bg-[#0B0F19]">
            DATA
          </span>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActivePage(item.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/10 to-transparent text-amber-500 border-l-2 border-amber-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Admin Profile Section */}
      <div className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-[#0B0F19]">
          <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center text-black font-bold text-sm">
            GD
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Admin Console</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <p className="text-xs text-slate-400">Live Server</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}