'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StageHeader from '@/components/stage-header';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Reports = () => {
  const dailyProductionData = [
    { date: 'Mon', planned: 100, actual: 95, efficiency: 95 },
    { date: 'Tue', planned: 100, actual: 88, efficiency: 88 },
    { date: 'Wed', planned: 100, actual: 92, efficiency: 92 },
    { date: 'Thu', planned: 100, actual: 98, efficiency: 98 },
    { date: 'Fri', planned: 100, actual: 90, efficiency: 90 },
  ];

  const stageCompletionData = [
    { stage: 'Dispatch Planning', completion: 100 },
    { stage: 'Oil Indent', completion: 95 },
    { stage: 'Lab Confirmation', completion: 100 },
    { stage: 'Production', completion: 92 },
    { stage: 'Packing', completion: 88 },
    { stage: 'Stock In', completion: 85 },
  ];

  return (
    <div className="p-6 bg-background">
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Production</p>
          <p className="text-3xl font-bold text-foreground mt-2">9,265</p>
          <p className="text-xs text-green-600 mt-1">↑ 5% from last week</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">On-Time Dispatch</p>
          <p className="text-3xl font-bold text-foreground mt-2">94%</p>
          <p className="text-xs text-green-600 mt-1">Target: 95%</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Production Efficiency</p>
          <p className="text-3xl font-bold text-foreground mt-2">92.6%</p>
          <p className="text-xs text-green-600 mt-1">Avg efficiency</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Material Wastage</p>
          <p className="text-3xl font-bold text-foreground mt-2">2.1%</p>
          <p className="text-xs text-green-600 mt-1">Below target</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Production Efficiency */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Daily Production Efficiency</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyProductionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="planned" stroke="#3b82f6" strokeWidth={2} name="Planned" />
              <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} name="Actual" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Stage Completion */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Stage Completion Rate (%)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stageCompletionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="completion" fill="#3b82f6" name="Completion %" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Detailed Report Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Detailed Summary Report</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Metric</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">This Week</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Last Week</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-2 font-medium text-foreground">Total Orders Completed</td>
                <td className="px-4 py-2 text-foreground">47</td>
                <td className="px-4 py-2 text-foreground">45</td>
                <td className="px-4 py-2 text-green-600">↑ 4.4%</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-foreground">Production Hours Used</td>
                <td className="px-4 py-2 text-foreground">156</td>
                <td className="px-4 py-2 text-foreground">168</td>
                <td className="px-4 py-2 text-green-600">↓ 7.1%</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-foreground">Material Cost</td>
                <td className="px-4 py-2 text-foreground">$12,450</td>
                <td className="px-4 py-2 text-foreground">$13,200</td>
                <td className="px-4 py-2 text-green-600">↓ 5.7%</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-foreground">Defect Rate</td>
                <td className="px-4 py-2 text-foreground">1.2%</td>
                <td className="px-4 py-2 text-foreground">1.8%</td>
                <td className="px-4 py-2 text-green-600">↓ 33%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Reports;
