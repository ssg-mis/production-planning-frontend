'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StageHeader from '@/components/stage-header';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import TableSkeleton from '@/components/table-skeleton';


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const Reports = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/reports`);
        const result = await response.json();
        if (result.status === 'success') {
          setData(result.data);
        } else {
          setError('Failed to load report data');
        }
      } catch (err) {
        setError('Error connecting to server');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  if (error) {
    return (
      <div className="p-6 bg-background">
        <StageHeader title="Reports & Analytics" description="Comprehensive production and dispatch analytics" />
        <div className="p-4 text-red-500 bg-red-50 border border-red-200 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <StageHeader
        title="Reports & Analytics"
        description="Comprehensive production and dispatch analytics"
      />

      {/* Export Buttons */}
      <div className="flex gap-3 mb-6">
        <Button className="bg-primary hover:bg-primary/90">📊 Export Dashboard</Button>
        <Button variant="outline">📄 Export PDF</Button>
        <Button variant="outline">📋 Export CSV</Button>
      </div>

      {loading ? (
        <div className="space-y-6">
           <TableSkeleton cols={4} rows={1} />
           <TableSkeleton cols={2} rows={4} />
           <TableSkeleton cols={4} rows={5} />
        </div>
      ) : data ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-6 border-border shadow-sm">
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Production</p>
              <p className="text-3xl font-extrabold text-foreground mt-2">{data.keyMetrics.totalProduction.value}</p>
              <p className={`text-xs mt-1 font-medium ${data.keyMetrics.totalProduction.positive ? 'text-green-600' : 'text-red-600'}`}>
                {data.keyMetrics.totalProduction.trend}
              </p>
            </Card>
            <Card className="p-6 border-border shadow-sm">
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">On-Time Dispatch</p>
              <p className="text-3xl font-extrabold text-foreground mt-2">{data.keyMetrics.onTimeDispatch.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{data.keyMetrics.onTimeDispatch.trend}</p>
            </Card>
            <Card className="p-6 border-border shadow-sm">
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Production Efficiency</p>
              <p className="text-3xl font-extrabold text-foreground mt-2">{data.keyMetrics.efficiency.value}</p>
              <p className={`text-xs mt-1 font-medium ${data.keyMetrics.efficiency.positive ? 'text-green-600' : 'text-yellow-600'}`}>
                {data.keyMetrics.efficiency.trend}
              </p>
            </Card>
            <Card className="p-6 border-border shadow-sm">
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Material Wastage</p>
              <p className="text-3xl font-extrabold text-foreground mt-2">{data.keyMetrics.wastage.value}</p>
              <p className={`text-xs mt-1 font-medium ${data.keyMetrics.wastage.positive ? 'text-green-600' : 'text-red-600'}`}>
                {data.keyMetrics.wastage.trend}
              </p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Daily Production Efficiency */}
            <Card className="p-6 border-border shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4">Daily Production Efficiency (Kg)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.dailyProductionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dy={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="planned" stroke="#3b82f6" strokeWidth={3} name="Planned Qty" dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                  <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={3} name="Actual Qty" dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Stage Completion */}
            <Card className="p-6 border-border shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4">Stage Completion Rate (%)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.stageCompletionData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="stage" angle={-45} textAnchor="end" height={80} tickLine={false} axisLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11}} dy={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dx={-10} domain={[0, 100]} />
                  <Tooltip 
                     cursor={{fill: 'hsl(var(--muted)/0.4)'}}
                     contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="completion" fill="#6366f1" name="Completion %" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Detailed Report Table */}
          <Card className="p-6 border-border shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold text-foreground mb-4">Detailed Summary Report</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Metric</th>
                    <th className="px-4 py-3 text-left font-bold">Past 7 Days</th>
                    <th className="px-4 py-3 text-left font-bold">Previous 7 Days</th>
                    <th className="px-4 py-3 text-left font-bold">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {data.detailedReport.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4 font-semibold text-foreground">{row.metric}</td>
                      <td className="px-4 py-4 font-medium">{row.thisWeek}</td>
                      <td className="px-4 py-4 text-muted-foreground">{row.lastWeek}</td>
                      <td className={`px-4 py-4 font-bold ${row.positive ? 'text-green-600' : 'text-red-600'}`}>
                        {row.variance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default Reports;
