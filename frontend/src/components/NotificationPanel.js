import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck, 
  Trash2, 
  Eye,
  AlertCircle,
  MessageSquare,
  BarChart3,
  PlusCircle,
  Lock
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import NotificationService from '../services/NotificationService';

const NotificationPanel = ({ isOpen, onClose }) => {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  } = useNotifications();

  const [filters, setFilters] = useState({
    unreadOnly: false,
    type: 'all',
    priority: 'all',
    dateRange: 'all'
  });
  const sortBy = 'timestamp';
  const groupBy = 'date';
  const [markingAsRead, setMarkingAsRead] = useState(new Set());

  // Filter and sort notifications
  const processedNotifications = useMemo(() => {
    let filtered = NotificationService.filterNotifications(notifications, filters);
    let sorted = NotificationService.sortNotifications(filtered, sortBy, 'desc');
    return NotificationService.groupNotifications(sorted, groupBy);
  }, [notifications, filters, sortBy, groupBy]);

  const handleMarkAsRead = async (notificationId, event) => {
    event.stopPropagation();
    if (markingAsRead.has(notificationId)) {
      return; // Prevent multiple clicks
    }
    
    try {
      setMarkingAsRead(prev => new Set([...prev, notificationId]));
      await markAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    } finally {
      setMarkingAsRead(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleDeleteNotification = async (notificationId, event) => {
    event.stopPropagation();
    if (window.confirm('Delete this notification?')) {
      try {
        await deleteNotification(notificationId);
      } catch (error) {
        console.error('Error deleting notification:', error);
      }
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'vote':
        return <BarChart3 className="w-3 h-3" />;
      case 'comment':
        return <MessageSquare className="w-3 h-3" />;
      case 'reply':
        return <MessageSquare className="w-3 h-3" />;
      case 'comment_like':
        return <span className="text-xs">👍</span>;
      case 'poll_created':
        return <PlusCircle className="w-3 h-3" />;
      case 'poll_closed':
        return <Lock className="w-3 h-3" />;
      case 'system':
        return <Bell className="w-3 h-3" />;
      default:
        return <Bell className="w-3 h-3" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bell className="w-6 h-6 text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-500">
                {unreadCount === 0 ? 'All caught up!' : `${unreadCount} unread`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-200 space-y-3">
          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center space-x-1 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Mark all read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all notifications? This cannot be undone.')) {
                      clearAllNotifications();
                    }
                  }}
                  className="flex items-center space-x-1 text-xs bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear all</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="vote">Votes</option>
              <option value="comment">Comments</option>
              <option value="reply">Replies</option>
              <option value="poll_created">Poll Created</option>
              <option value="poll_closed">Poll Closed</option>
              <option value="system">System</option>
            </select>
            
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            <button
              onClick={() => setFilters({ ...filters, unreadOnly: !filters.unreadOnly })}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                filters.unreadOnly
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Eye className="w-3 h-3 inline mr-1" />
              Unread only
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
            </div>
          )}

          {error && (
            <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800">Failed to load notifications</p>
              </div>
            </div>
          )}

          {!loading && !error && Object.keys(processedNotifications).length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <Bell className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-900">No notifications</p>
              <p className="text-sm text-gray-500 text-center mt-1">
                {filters.unreadOnly 
                  ? "You're all caught up!" 
                  : "New notifications will appear here"}
              </p>
            </div>
          )}

          {!loading && !error && Object.keys(processedNotifications).map(groupKey => (
            <div key={groupKey} className="border-b border-gray-100 last:border-b-0">
              {groupBy !== 'none' && Object.keys(processedNotifications).length > 1 && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700">{groupKey}</h3>
                </div>
              )}
              
              {processedNotifications[groupKey].map(notification => (
                <div
                  key={notification.id}
                  className={`relative flex items-start p-3 border-l-4 transition-colors ${
                    markingAsRead.has(notification.id) ? 'opacity-50 pointer-events-none' : ''
                  } ${
                    notification.isRead 
                      ? 'border-l-gray-200 bg-white' 
                      : getPriorityColor(notification.priority)
                  }`}
                >
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                    notification.isRead ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${
                      notification.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'
                    } line-clamp-2`}>
                      {notification.message}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {NotificationService.formatTimestamp(notification.timestamp)}
                      </span>
                      {notification.priority === 'high' && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                          Important
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 ml-2">
                    {!notification.isRead && (
                      <button
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Mark as read"
                        disabled={markingAsRead.has(notification.id)}
                      >
                        {markingAsRead.has(notification.id) ? (
                          <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"></div>
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteNotification(notification.id, e)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="absolute right-2 top-4 w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationPanel;