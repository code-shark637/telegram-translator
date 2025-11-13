import { useEffect, useState } from 'react';
import { Users, MessageSquare, UserCheck, Activity } from 'lucide-react';
import { adminApi } from '../services/api';

interface Statistics {
  total_users: number;
  active_users: number;
  total_accounts: number;
  total_messages: number;
  total_conversations: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await adminApi.getStatistics();
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Colleagues',
      value: stats?.total_users || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Active Colleagues',
      value: stats?.active_users || 0,
      icon: UserCheck,
      color: 'bg-green-500',
    },
    {
      title: 'Telegram Accounts',
      value: stats?.total_accounts || 0,
      icon: Activity,
      color: 'bg-purple-500',
    },
    {
      title: 'Total Messages',
      value: stats?.total_messages || 0,
      icon: MessageSquare,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome to Admin Panel</h2>
        <p className="text-gray-600 mb-4">
          This admin panel allows you to manage all colleague accounts and review their messages.
        </p>
        <ul className="space-y-2 text-gray-600">
          <li className="flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
            View and manage all colleague accounts
          </li>
          <li className="flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
            Monitor Telegram accounts managed by colleagues
          </li>
          <li className="flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
            Review all messages across all accounts
          </li>
          <li className="flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
            Secure authentication with encrypted password
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
