'use client';

import { Card } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const dashboardCards = [
    { title: 'Total Orders Pending', value: '12', color: 'bg-red-50 text-red-600' },
    { title: 'Oil Indents Pending', value: '5', color: 'bg-yellow-50 text-yellow-600' },
    { title: 'Production In Progress', value: '8', color: 'bg-blue-50 text-blue-600' },
    { title: 'Dispatch Completed Today', value: '15', color: 'bg-green-50 text-green-600' },
  ];

  const oilConsumptionData = [
    { name: 'Rice Oil', value: 45 },
    { name: 'Soya Oil', value: 30 },
    { name: 'Sunflower Oil', value: 25 },
  ];

  const productionVsPlanData = [
    { stage: 'Dispatch', planned: 100, actual: 95 },
    { stage: 'Production', planned: 100, actual: 88 },
    { stage: 'Packing', planned: 100, actual: 92 },
    { stage: 'Receipt', planned: 100, actual: 100 },
  ];

  const dispatchPerformanceData = [
    { date: 'Mon', completed: 8, pending: 2 },
    { date: 'Tue', completed: 6, pending: 4 },
    { date: 'Wed', completed: 10, pending: 1 },
    { date: 'Thu', completed: 5, pending: 3 },
    { date: 'Fri', completed: 12, pending: 2 },
    { date: 'Sat', completed: 7, pending: 4 },
    { date: 'Sun', completed: 15, pending: 1 },
  ];

  const COLORS = ['#3b82f6', '#ef4444', '#f59e0b'];

  return (
    <div className="p-6 bg-background">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Production Planning Dashboard</h1>
        <p className="text-muted-foreground">Real-time overview of all production and dispatch activities</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {dashboardCards.map((card, idx) => (
          <Card key={idx} className="p-6">
            <div className={`${card.color} rounded-lg p-4 mb-4`}>
              <p className="text-sm font-medium">{card.title}</p>
              <p className="text-3xl font-bold mt-2">{card.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Oil Consumption */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Oil Consumption</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={oilConsumptionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {oilConsumptionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Production vs Plan */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Production vs Plan (%)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={productionVsPlanData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="planned" fill="#3b82f6" />
              <Bar dataKey="actual" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Dispatch Performance */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Weekly Dispatch Performance</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dispatchPerformanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
            <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="Pending" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Dashboard;
