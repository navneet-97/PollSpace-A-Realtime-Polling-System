import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BarChart3, Users, Activity, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import PollCard from './PollCard';
import PageHeader from './PageHeader';

const Dashboard = ({ socket }) => {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stats, setStats] = useState({
    totalPolls: 0,
    totalVotes: 0,
    recentActivity: 0
  });

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'general', label: 'General' },
    { value: 'technology', label: 'Technology' },
    { value: 'politics', label: 'Politics' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'sports', label: 'Sports' },
    { value: 'business', label: 'Business' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchPolls();
    fetchStats();
    
    // Track that user visited Dashboard page
    sessionStorage.setItem('lastVisitedPage', '/');

    // Listen for real-time poll updates
    if (socket) {
      socket.on('newPoll', (poll) => {
        // Only add non-draft polls to prevent draft polls from appearing
        if (poll.status !== 'draft') {
          setPolls(prev => [poll, ...prev]);
        }
        // No toast here - CreatePoll component already shows success message
      });

      socket.on('pollUpdate', (updatedPoll) => {
        setPolls(prev => prev.map(poll => 
          poll.id === updatedPoll.id ? updatedPoll : poll
        ).filter(poll => poll.status !== 'draft')); // Filter out any draft polls
      });

      // Listen for poll closure events
      socket.on('pollClosed', (data) => {
        toast.info('Poll Closed', {
          description: `Poll "${data.title}" has been automatically closed.`,
          duration: 4000
        });
        // The pollUpdate event will handle the state update
      });

      return () => {
        socket.off('newPoll');
        socket.off('pollUpdate');
        socket.off('pollClosed');
      };
    }
  }, [socket]);

  // Listen for storage events to refresh data when returning from poll pages
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'pollDataChanged' && e.newValue === 'true') {
        // Clear the flag
        localStorage.removeItem('pollDataChanged');
        // Refresh poll data
        fetchPolls();
        fetchStats();
      }
    };

    const handleWindowFocus = () => {
      if (localStorage.getItem('pollDataChanged') === 'true') {
        localStorage.removeItem('pollDataChanged');
        fetchPolls();
        fetchStats();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const fetchPolls = async () => {
    try {
      // Use the special endpoint for dashboard
      const response = await api.get('/polls/dashboard');
      // Additional frontend filter to ensure no draft polls are displayed
      const publicPolls = response.data.filter(poll => poll.status !== 'draft');
      setPolls(publicPolls);
    } catch (error) {
      console.error('Error fetching polls:', error);
      toast.error('Failed to load polls');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Use the special endpoint for dashboard stats
      const response = await api.get('/polls/dashboard');
      // Filter out draft polls from stats calculation
      const publicPolls = response.data.filter(poll => poll.status !== 'draft');
      
      const totalVotes = publicPolls.reduce((sum, poll) => sum + (poll.total_votes || 0), 0);
      const recentPolls = publicPolls.filter(poll => {
        const pollDate = new Date(poll.createdAt);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return pollDate > oneDayAgo;
      }).length;

      setStats({
        totalPolls: publicPolls.length,
        totalVotes,
        recentActivity: recentPolls
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filteredPolls = polls.filter(poll => {
    const matchesSearch = poll.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         poll.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || poll.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="card">
      <div className="flex items-center">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mr-4 ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-8 bg-gray-300 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-64"></div>
            </div>
            <div className="h-10 bg-gray-300 rounded w-32"></div>
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="h-12 w-12 bg-gray-300 rounded-lg mr-4"></div>
                  <div>
                    <div className="h-4 bg-gray-300 rounded w-20 mb-2"></div>
                    <div className="h-8 bg-gray-300 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Content skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-300 rounded"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/3"></div>
                  <div className="h-2 bg-gray-300 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <PageHeader
        title="Dashboard"
        subtitle="Discover and participate in live polls"
        actions={(
          <Link
            to="/create"
            className="btn-primary inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Poll
          </Link>
        )}
      />

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={BarChart3}
          title="Total Polls"
          value={stats.totalPolls}
          color="bg-blue-600"
        />
        <StatCard 
          icon={Users}
          title="Total Votes"
          value={stats.totalVotes}
          color="bg-purple-600"
        />
        <StatCard 
          icon={Activity}
          title="Recent Activity"
          value={stats.recentActivity}
          color="bg-green-600"
        />
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search polls..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full py-3 pl-12 pr-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === category.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filteredPolls.length} of {polls.length} polls
          {searchTerm && ` for "${searchTerm}"`}
          {selectedCategory !== 'all' && ` in ${categories.find(c => c.value === selectedCategory)?.label}`}
        </p>
      </div>

      {/* Polls Grid */}
      {filteredPolls.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'No polls found' : 'No polls yet'}
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {searchTerm 
              ? 'Try adjusting your search terms or filters' 
              : 'Be the first to create a poll and start the conversation!'
            }
          </p>
          {!searchTerm && (
            <Link
              to="/create"
              className="btn-primary inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white shadow-sm"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Poll
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
