import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, CheckCircle, XCircle, Eye, EyeOff, Clock, Users, BarChart3, Activity, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import PageHeader from './PageHeader';

const AllPollResults = () => {
  const [polls, setPolls] = useState([]);
  const [filteredPolls, setFilteredPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    fetchAllPolls();
  }, []);

  // Listen for storage events to refresh data when returning from poll pages
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'pollDataChanged' && e.newValue === 'true') {
        // Clear the flag
        localStorage.removeItem('pollDataChanged');
        // Refresh poll data
        fetchAllPolls();
      }
    };

    const handleWindowFocus = () => {
      if (localStorage.getItem('pollDataChanged') === 'true') {
        localStorage.removeItem('pollDataChanged');
        fetchAllPolls();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const filterPolls = useCallback(() => {
    let filtered = polls;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(poll =>
        poll.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        poll.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(poll => poll.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(poll => poll.category === categoryFilter);
    }

    setFilteredPolls(filtered);
  }, [polls, searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    filterPolls();
  }, [filterPolls]);

  const fetchAllPolls = async () => {
    try {
      // Use the special endpoint for poll results page
      const response = await api.get('/polls/results');
      const allPolls = response.data;
      
      // The backend now handles filtering correctly for the results page
      setPolls(allPolls);
    } catch (error) {
      console.error('Error fetching polls:', error);
      toast.error('Failed to load poll results');
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (votes, total) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      active: {
        icon: CheckCircle,
        label: 'Active',
        color: 'bg-green-100 text-green-700 border-green-200',
      },
      closed: {
        icon: XCircle,
        label: 'Closed',
        color: 'bg-red-100 text-red-700 border-red-200',
      },
      draft: {
        icon: Eye,
        label: 'Draft',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      }
    };
    return statusMap[status] || statusMap.active;
  };

  const getCategoryColor = (category) => {
    const colors = {
      technology: 'bg-blue-100 text-blue-700',
      politics: 'bg-red-100 text-red-700',
      entertainment: 'bg-pink-100 text-pink-700',
      sports: 'bg-green-100 text-green-700',
      business: 'bg-yellow-100 text-yellow-700',
      general: 'bg-gray-100 text-gray-700',
      other: 'bg-purple-100 text-purple-700'
    };
    return colors[category] || colors.general;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const PollResultCard = ({ poll }) => {
    const statusInfo = getStatusInfo(poll.status);
    const StatusIcon = statusInfo.icon;
    const topOption = poll.options.reduce((max, option) => 
      option.votes > max.votes ? option : max, poll.options[0]
    );

    return (
      <div className="card p-6 hover:shadow-lg transition-all duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getCategoryColor(poll.category)}`}>
                {poll.category || 'general'}
              </span>
              <div className={`flex items-center px-2 py-1 rounded-lg border text-xs font-medium ${statusInfo.color}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                <span>{statusInfo.label}</span>
              </div>
              {poll.show_results ? (
                <div className="flex items-center px-2 py-1 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  <span>Public</span>
                </div>
              ) : (
                <div className="flex items-center px-2 py-1 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-xs">
                  <EyeOff className="w-3 h-3 mr-1" />
                  <span>Private</span>
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {poll.title}
            </h3>
            {poll.description && (
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {poll.description}
              </p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{poll.total_votes}</div>
            <div className="text-xs text-gray-500">Total Votes</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">{poll.options.length}</div>
            <div className="text-xs text-gray-500">Options</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {poll.total_votes > 0 ? `${calculatePercentage(topOption.votes, poll.total_votes)}%` : '0%'}
            </div>
            <div className="text-xs text-gray-500">Leading</div>
          </div>
        </div>

        {/* Top Results Preview */}
        {poll.total_votes > 0 && (
          <div className="space-y-2 mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Top Results:</div>
            {poll.options
              .sort((a, b) => b.votes - a.votes)
              .slice(0, 2)
              .map((option, index) => {
                const percentage = calculatePercentage(option.votes, poll.total_votes);
                const colors = ['bg-blue-500', 'bg-purple-500'];
                
                return (
                  <div key={option.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1 mr-2">{option.text}</span>
                      <span className="text-gray-600 font-medium">{percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${colors[index]}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            {poll.options.length > 2 && (
              <p className="text-xs text-gray-500 mt-2">+{poll.options.length - 2} more options</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {formatDate(poll.createdAt)}
            </div>
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {poll.total_votes} votes
            </div>
          </div>
          <Link
            to={`/poll/${poll.id}/results`}
            state={{ from: '/results' }}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center"
          >
            View Details
            <BarChart3 className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center space-x-4 mb-8">
            <div className="h-8 bg-gray-300 rounded w-48"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 border">
                <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-gray-300 rounded w-full"></div>
                  <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-8 bg-gray-300 rounded"></div>
                  <div className="h-8 bg-gray-300 rounded"></div>
                  <div className="h-8 bg-gray-300 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title="Poll Results Center"
        subtitle="Explore results from ongoing and completed polls"
        actions={(
          <div className="flex items-center space-x-2">
            <div className="flex items-center px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
              <Activity className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">{filteredPolls.length} Results</span>
            </div>
          </div>
        )}
      />

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center justify-between space-x-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search poll results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-64 py-3 pl-10 pr-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
            />
          </div>
          
          {/* Status and Category Filters - Right Side */}
          <div className="flex space-x-4">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block py-3 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm min-w-[160px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="block py-3 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm min-w-[180px]"
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          Showing {filteredPolls.length} of {polls.length} poll results
          {searchTerm && ` for "${searchTerm}"`}
          {statusFilter !== 'all' && ` • ${statusFilter} polls`}
          {categoryFilter !== 'all' && ` • ${categories.find(c => c.value === categoryFilter)?.label}`}
        </div>
        <div className="flex items-center space-x-1">
          <PieChart className="w-4 h-4" />
          <span>Live Results</span>
        </div>
      </div>

      {/* Results Grid */}
      {filteredPolls.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'No results found' : 'No poll results available'}
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {searchTerm 
              ? 'Try adjusting your search terms or filters' 
              : 'Poll results will appear here when polls have public results or are completed'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPolls.map((poll) => (
            <PollResultCard key={poll.id} poll={poll} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AllPollResults;