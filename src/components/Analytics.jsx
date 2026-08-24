import { Search } from 'lucide-react';

export default function Analytics() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6 bg-[#0B0F19] text-white">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">Gyanti Data Management System</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search analytics or logs..."
              className="pl-10 pr-4 py-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm font-medium text-white hover:bg-slate-800 transition-colors">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            Refresh Data
          </button>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total Volume" value="$73,330" badge="+14.2%" isPositive={true} />
        <KpiCard title="Total Balance" value="$2,036" badge="-2.4%" isPositive={false} />
        <KpiCard title="Percentile Value" value="$12,357" badge="+8.1%" isPositive={true} />
        <KpiCard title="Total Running" value="2.83%" badge="+0.4%" isPositive={true} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Graph Card */}
        <div className="lg:col-span-2 bg-[#131A2B] border border-slate-800 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-lg font-semibold text-white">Weekly Data Activity</h3>
              <p className="text-sm text-slate-400">Activity volume over the past 7 days</p>
            </div>
            <div className="flex bg-[#0B0F19] rounded-lg p-1 border border-slate-800">
              <button className="px-3 py-1 text-xs font-medium text-amber-500 bg-[#131A2B] rounded shadow">Weekly</button>
              <button className="px-3 py-1 text-xs font-medium text-slate-400 hover:text-white transition-colors">Monthly</button>
            </div>
          </div>
          
          <div className="h-[220px] relative w-full flex items-end">
            <div className="absolute inset-0 flex flex-col justify-between">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border-b border-slate-800 w-full border-dashed"></div>
              ))}
            </div>
            <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path d="M0,80 Q25,70 50,40 T100,50" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" />
              <path d="M0,90 Q40,85 70,80 T80,30 T100,70" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex justify-between mt-4 text-xs text-slate-400 px-2">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>

        {/* Heatmap Ring Card */}
        <div className="bg-[#131A2B] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Data Density Heatmap</h3>
            <p className="text-sm text-slate-400">Cluster resource distribution</p>
          </div>
          
          <div className="flex flex-col items-center justify-center my-6">
            <div className="relative w-44 h-44 rounded-full flex items-center justify-center border-8 border-slate-800">
              <div className="absolute inset-0 rounded-full border-8 border-amber-500 border-t-transparent border-l-transparent -rotate-45"></div>
              <div className="absolute inset-2 rounded-full border-8 border-teal-500 border-b-transparent border-r-transparent rotate-12"></div>
              <div className="text-center z-10">
                <p className="text-2xl font-bold text-white">88.4%</p>
                <p className="text-[10px] text-slate-400 tracking-widest mt-0.5">DENSITY</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500"></span>Core</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-teal-500"></span>Node</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-purple-500"></span>Cache</div>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Data Logs Card */}
        <div className="lg:col-span-2 bg-[#131A2B] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Data Introline & Logs</h3>
          <div className="space-y-4">
            <LogItem name="Denine Enterprise" sub="Cash / Instant" amount="$2,126.86" status="Completed" />
            <LogItem name="Lacer Logistics" sub="Automatic Debit" amount="$30.59" status="Pending" />
            <LogItem name="Ernieft Holdings" sub="Wire Transfer" amount="$20.50" status="Completed" />
            <LogItem name="Average Daily Run" sub="Calculated Metric" amount="$243.53" status="Optimal" isLast />
          </div>
        </div>

        {/* Allocation Card */}
        <div className="bg-[#131A2B] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white">System Allocation</h3>
          <p className="text-sm text-slate-400 mb-6">Live storage and database quotas</p>
          
          <div className="space-y-6">
            <ProgressBar label="Primary Database" percent="68%" color="bg-amber-500" textColor="text-amber-500" />
            <ProgressBar label="Cache Memory" percent="42%" color="bg-teal-500" textColor="text-teal-500" />
            <ProgressBar label="Bandwidth Cap" percent="89%" color="bg-purple-500" textColor="text-purple-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, badge, isPositive }) {
  return (
    <div className="bg-[#131A2B] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-[120px]">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-400 font-medium">{title}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {badge}
        </span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function LogItem({ name, sub, amount, status, isLast }) {
  const statusColors = {
    Completed: 'text-emerald-400',
    Pending: 'text-amber-500',
    Optimal: 'text-emerald-400',
  };
  return (
    <div className={`flex justify-between items-center pb-3 ${!isLast ? 'border-b border-slate-800' : ''}`}>
      <div>
        <p className="font-semibold text-white text-sm">{name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-amber-500 text-sm">{amount}</p>
        <p className={`text-xs font-medium mt-0.5 ${statusColors[status] || 'text-slate-400'}`}>{status}</p>
      </div>
    </div>
  );
}

function ProgressBar({ label, percent, color, textColor }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="font-medium text-white">{label}</span>
        <span className={`font-semibold ${textColor}`}>{percent}</span>
      </div>
      <div className="h-2 w-full bg-[#0B0F19] rounded-full overflow-hidden border border-slate-800">
        <div className={`h-full ${color} rounded-full`} style={{ width: percent }}></div>
      </div>
    </div>
  );
}