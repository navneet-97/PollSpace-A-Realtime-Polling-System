import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, Users, MessageCircle, TrendingUp } from 'lucide-react';

const PollCard = ({ poll }) => {
  const location = useLocation();
  
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

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      closed: 'bg-red-100 text-red-700',
      draft: 'bg-yellow-100 text-yellow-700'
    };
    return colors[status] || colors.active;
  };

  return (
    <Link
      to={`/poll/${poll.id}`}
      state={{ from: location.pathname }} // Pass current page as source
      className="block bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getCategoryColor(poll.category)}`}>
              {poll.category || 'general'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(poll.status)}`}>
              {poll.status || 'active'}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
            {poll.title || poll.question}
          </h3>
          {poll.description && (
            <p className="text-gray-600 text-sm mt-1 line-clamp-2">
              {poll.description}
            </p>
          )}
        </div>
        <div className="flex items-center text-gray-500 text-sm ml-4 flex-shrink-0">
          <Clock className="w-4 h-4 mr-1" />
          {formatTimeAgo(poll.createdAt)}
        </div>
      </div>

      {/* Preview of poll options */}
      <div className="space-y-2 mb-4">
        {poll.options.slice(0, 2).map((option, index) => (
          <div key={option.id} className="py-2 px-3 bg-gray-50 rounded-lg">
            <span className="text-gray-700 text-sm">{option.text}</span>
          </div>
        ))}
        {poll.options.length > 2 && (
          <p className="text-sm text-gray-500">+{poll.options.length - 2} more options</p>
        )}
      </div>

      {/* Poll stats */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            {poll.total_votes} votes
          </div>
          <div className="flex items-center">
            <MessageCircle className="w-4 h-4 mr-1" />
            {poll.comments_count || 0} comments
          </div>
        </div>
        <TrendingUp className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
};

export default PollCard;
