import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BarChart3, Users, MessageCircle, Clock, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';

const MyPolls = () => {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingPollId, setUpdatingPollId] = useState(null);
  const [filter, setFilter] = useState('all'); // all, active, closed, draft
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    closed: 0,
    draft: 0,
    totalVotes: 0
  });

  useEffect(() => {
    fetchMyPolls();
    // Track that user visited My Polls page
    sessionStorage.setItem('lastVisitedPage', '/my-polls');
  }, []);

  // Listen for storage events to refresh data when returning from poll pages
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'pollDataChanged' && e.newValue === 'true') {
        // Clear the flag
        localStorage.removeItem('pollDataChanged');
        // Refresh poll data
        fetchMyPolls();
      }
    };

    const handleWindowFocus = () => {
      if (localStorage.getItem('pollDataChanged') === 'true') {
        localStorage.removeItem('pollDataChanged');
        fetchMyPolls();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const fetchMyPolls = async () => {
    try {
      const response = await api.get('/polls/my-polls');
      const userPolls = response.data;
      setPolls(userPolls);
      
      // Calculate stats
      const stats = userPolls.reduce((acc, poll) => {
        acc.total++;
        acc[poll.status]++;
        acc.totalVotes += poll.total_votes || 0;
        return acc;
      }, { total: 0, active: 0, closed: 0, draft: 0, totalVotes: 0 });
      
      setStats(stats);
    } catch (error) {
      console.error('Error fetching my polls:', error);
      toast.error('Failed to load your polls');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePoll = async (pollId, pollTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${pollTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/polls/${pollId}`);
      setPolls(prev => prev.filter(poll => poll.id !== pollId));
      toast.success('Poll deleted successfully');
      
      // Recalculate stats
      const updatedPolls = polls.filter(poll => poll.id !== pollId);
      const newStats = updatedPolls.reduce((acc, poll) => {
        acc.total++;
        acc[poll.status]++;
        acc.totalVotes += poll.total_votes || 0;
        return acc;
      }, { total: 0, active: 0, closed: 0, draft: 0, totalVotes: 0 });
      setStats(newStats);
      
    } catch (error) {
      console.error('Error deleting poll:', error);
      toast.error('Failed to delete poll');
    }
  };

  const handleTogglePollStatus = async (pollId, currentStatus) => {
    // Prevent multiple simultaneous updates
    if (updatingPollId === pollId) {
      return;
    }
    
    const poll = polls.find(p => p.id === pollId);
    const newStatus = currentStatus === 'active' ? 'closed' : 'active';
    
    // Show warning for reopening expired polls
    if (newStatus === 'active' && poll?.ends_at && new Date(poll.ends_at) <= new Date()) {
      const confirmReopen = window.confirm(
        `This poll expired on ${new Date(poll.ends_at).toLocaleDateString()}. ` +
        'Reopening it will clear the end date. Do you want to continue?'
      );
      if (!confirmReopen) {
        return;
      }
    }
    
    try {
      setUpdatingPollId(pollId);
      const response = await api.patch(`/polls/${pollId}`, { status: newStatus });
      const updatedPoll = response.data.poll; // Get the updated poll from response
      
      // Update local state with the complete updated poll data (including cleared end date)
      setPolls(prev => prev.map(poll => 
        poll.id === pollId ? updatedPoll : poll
      ));
      
      const statusMessage = newStatus === 'active' 
        ? (poll?.ends_at && new Date(poll.ends_at) <= new Date() 
           ? 'Poll reopened successfully' 
           : 'Poll activated successfully')
        : 'Poll closed successfully';
      
      toast.success(statusMessage);
      
      // Recalculate stats
      const updatedPolls = polls.map(poll => 
        poll.id === pollId ? { ...poll, status: newStatus } : poll
      );
      const newStats = updatedPolls.reduce((acc, poll) => {
        acc.total++;
        acc[poll.status]++;
        acc.totalVotes += poll.total_votes || 0;
        return acc;
      }, { total: 0, active: 0, closed: 0, draft: 0, totalVotes: 0 });
      setStats(newStats);
      
    } catch (error) {
      console.error('Error updating poll status:', error);
      toast.error('Failed to update poll status');
    } finally {
      setUpdatingPollId(null);
    }
  };

  const filteredPolls = polls.filter(poll => {
    if (filter === 'all') return true;
    return poll.status === filter;
  });

  const formatTimeAgo = (date) => {
    const now = new Date();
    const pollDate = new Date(date);
    const diffMs = now - pollDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const StatCard = ({ title, value, color, icon: Icon }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
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

  const MyPollCard = ({ poll }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
              poll.status === 'active' ? 'bg-green-100 text-green-700' :
              poll.status === 'closed' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {poll.status}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
              poll.category === 'technology' ? 'bg-blue-100 text-blue-700' :
              poll.category === 'politics' ? 'bg-red-100 text-red-700' :
              poll.category === 'entertainment' ? 'bg-pink-100 text-pink-700' :
              poll.category === 'sports' ? 'bg-green-100 text-green-700' :
              poll.category === 'business' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {poll.category}
            </span>
          </div>
          
          <Link
            to={`/poll/${poll.id}`}
            state={{ from: '/my-polls' }}
            className="block hover:text-blue-600 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-2">
              {poll.title}
            </h3>
          </Link>
          
          {poll.description && (
            <p className="text-gray-600 text-sm line-clamp-2 mb-3">
              {poll.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center text-gray-500 text-sm ml-4">
          <Clock className="w-4 h-4 mr-1" />
          {formatTimeAgo(poll.createdAt)}
        </div>
      </div>

      {/* Poll Stats */}
      <div className="flex items-center space-x-6 text-sm text-gray-500 mb-4">
        <div className="flex items-center">
          <Users className="w-4 h-4 mr-1" />
          {poll.total_votes} votes
        </div>
        <div className="flex items-center">
          <MessageCircle className="w-4 h-4 mr-1" />
          {poll.comments_count || 0} comments
        </div>
        <div className="flex items-center">
          <BarChart3 className="w-4 h-4 mr-1" />
          {poll.options.length} options
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex space-x-2">
          <Link
            to={`/poll/${poll.id}`}
            state={{ from: '/my-polls' }}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Link>
          
          <div className="relative group">
            <Link
              to={`/poll/${poll.id}/edit`}
              state={{ from: '/my-polls' }}
              className={`inline-flex items-center px-3 py-2 text-sm font-medium transition-colors ${
                poll.status === 'closed' 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-500'
              }`}
              title={poll.status === 'closed' ? 'Activate poll before editing' : 'Edit poll'}
            >
              <Edit className="w-4 h-4 mr-1" />
              {poll.status === 'closed' ? 'Needs Activation' : 'Edit'}
            </Link>
            {poll.status === 'closed' && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Activate poll first to enable editing
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => handleTogglePollStatus(poll.id, poll.status)}
            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              poll.status === 'active'
                ? 'text-red-600 hover:text-red-500 hover:bg-red-50'
                : 'text-green-600 hover:text-green-500 hover:bg-green-50'
            } ${
              updatingPollId === poll.id ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={poll.status === 'draft' || updatingPollId === poll.id}
          >
            {updatingPollId === poll.id ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-1"></div>
                Updating...
              </div>
            ) : poll.status === 'active' ? (
              <>
                <EyeOff className="w-4 h-4 mr-1" />
                Close
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1" />
                Activate
              </>
            )}
          </button>
          
          <button
            onClick={() => handleDeletePoll(poll.id, poll.title)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-8 bg-gray-300 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-64"></div>
            </div>
            <div className="h-10 bg-gray-300 rounded w-32"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
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
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Polls</h1>
          <p className="text-gray-600">Manage and track your created polls</p>
        </div>
        <Link
          to="/create"
          className="btn-primary inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white mt-4 sm:mt-0 shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Poll
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard 
          title="Total Polls"
          value={stats.total}
          color="bg-blue-600"
          icon={BarChart3}
        />
        <StatCard 
          title="Active Polls"
          value={stats.active}
          color="bg-green-600"
          icon={Eye}
        />
        <StatCard 
          title="Closed Polls"
          value={stats.closed}
          color="bg-red-600"
          icon={EyeOff}
        />
        <StatCard 
          title="Total Votes"
          value={stats.totalVotes}
          color="bg-purple-600"
          icon={Users}
        />
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { value: 'all', label: 'All Polls', count: stats.total },
            { value: 'active', label: 'Active', count: stats.active },
            { value: 'closed', label: 'Closed', count: stats.closed },
            { value: 'draft', label: 'Drafts', count: stats.draft }
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === tab.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-600">
            Showing {filteredPolls.length} of {stats.total} polls
          </p>
        </div>
      </div>

      {/* Polls Grid */}
      {filteredPolls.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-12 h-12 text-gray-400" />
          </div>
          
          {stats.total === 0 ? (
            <>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No polls created yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Create your first poll to start collecting opinions and engaging with your audience.
              </p>
              <Link
                to="/create"
                className="btn-primary inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white shadow-sm"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Poll
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No {filter} polls found
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Try selecting a different filter to see your polls.
              </p>
              <button
                onClick={() => setFilter('all')}
                className="btn-secondary px-6 py-3 rounded-lg font-medium"
              >
                Show All Polls
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredPolls.map((poll) => (
            <MyPollCard key={poll.id} poll={poll} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyPolls;
