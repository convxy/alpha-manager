import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Bar, Cell } from 'recharts';
import { Activity } from 'lucide-react';

const COLORS = {
  bg: '#F7F7F5',
  card: '#FFFFFF',
  textPrimary: '#434343',
  textSecondary: '#8C8C8C',
  profit: '#8EB897',
  loss: '#DD8D8D',
  revenue: '#9FB1BC',
  cost: '#D3C09A',
  primary: '#6D8299',
};

const getPeriodLabel = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-');
  const day = parseInt(d);
  const suffix = day <= 15 ? "上" : "下";
  return `${y}.${m}.${suffix}`;
};

interface ReportViewProps {
  records: Array<{
    date: string;
    accountId: string;
    score: number;
    balance?: number;
    revenue?: number;
    cost: number;
    net: number;
    projectId?: string;
  }>;
}

export default function ReportView({ records }: ReportViewProps) {
  const periodReport = useMemo(() => {
    const map = new Map<string, { period: string; cost: number; rev: number; net: number }>();
    records.forEach(r => {
      const p = getPeriodLabel(r.date);
      if (!map.has(p)) map.set(p, { period: p, cost: 0, rev: 0, net: 0 });
      const d = map.get(p)!;
      d.cost += r.cost;
      d.rev += r.revenue || 0;
      d.net += r.net;
    });
    return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
  }, [records]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 1. History Trend Chart */}
      <div className="rounded-[32px] p-8 shadow-sm border" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
          <Activity size={20} style={{ color: COLORS.revenue }} /> 历史净利趋势
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...periodReport].reverse()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
              <XAxis dataKey="period" tick={{ fontSize: 12, fill: COLORS.textSecondary, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: COLORS.textSecondary, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} tickFormatter={v => Math.round(v).toString()} />
              <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', fontFamily: 'Space Grotesk' }} formatter={(value: any) => Math.round(value as number)} />
              <Bar dataKey="net" radius={[4, 4, 4, 4]} barSize={20}>
                {[...periodReport].reverse().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.net >= 0 ? COLORS.profit : COLORS.loss} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Detailed Table */}
      <div className="overflow-hidden rounded-[24px] border" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
        <table className="w-full text-sm text-left">
          <thead style={{ backgroundColor: `${COLORS.bg}80`, color: COLORS.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
            <tr>
              <th className="p-3 md:p-5 whitespace-nowrap">周期</th>
              <th className="p-3 md:p-5 text-right whitespace-nowrap"><span className="hidden md:inline">总</span>磨损</th>
              <th className="p-3 md:p-5 text-right whitespace-nowrap"><span className="hidden md:inline">总</span>收益</th>
              <th className="p-3 md:p-5 text-right whitespace-nowrap"><span className="hidden md:inline">净</span>利润</th>
              <th className="p-3 md:p-5 text-right whitespace-nowrap">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: `${COLORS.textSecondary}10` }}>
            {periodReport.map((p, i) => {
              const maxCost = Math.max(...periodReport.map(i => i.cost)) || 1;
              const maxRev = Math.max(...periodReport.map(i => i.rev)) || 1;
              const maxNet = Math.max(...periodReport.map(i => Math.abs(i.net))) || 1;
              return (
                <tr key={i} className="hover:bg-black/5 transition-colors group">
                  <td className="p-3 md:p-5 font-bold whitespace-nowrap" style={{ color: COLORS.textPrimary }}>
                    {p.period}
                  </td>
                  <td className="p-3 md:p-5 text-right relative">
                    <div className="absolute inset-y-2 right-0 rounded-l opacity-20" style={{ width: `${(p.cost / maxCost) * 80}%`, backgroundColor: COLORS.cost }}></div>
                    <span className="relative z-10 font-mono" style={{ color: COLORS.textPrimary }}>
                      {p.cost.toFixed(0)}
                    </span>
                  </td>
                  <td className="p-3 md:p-5 text-right relative">
                    <div className="absolute inset-y-2 right-0 rounded-l opacity-20" style={{ width: `${(p.rev / maxRev) * 80}%`, backgroundColor: COLORS.revenue }}></div>
                    <span className="relative z-10 font-mono" style={{ color: COLORS.textPrimary }}>
                      {p.rev.toFixed(0)}
                    </span>
                  </td>
                  <td className="p-3 md:p-5 text-right relative">
                    <div className="absolute inset-y-2 right-0 rounded-l opacity-20" style={{ width: `${(Math.abs(p.net) / maxNet) * 80}%`, backgroundColor: p.net >= 0 ? COLORS.profit : COLORS.loss }}></div>
                    <span className="relative z-10 font-black font-mono" style={{ color: p.net >= 0 ? COLORS.profit : COLORS.loss }}>
                      {p.net.toFixed(0)}
                    </span>
                  </td>
                  <td className="p-3 md:p-5 text-right font-medium whitespace-nowrap" style={{ color: COLORS.textSecondary }}>
                    {p.cost > 0 ? ((p.net / p.cost) * 100).toFixed(0) : 0}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
