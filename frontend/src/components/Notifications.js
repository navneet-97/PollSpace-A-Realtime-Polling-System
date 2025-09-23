import React, { useState, useEffect } from 'react';
import { MessageCircle, Clock, BarChart3, Bell, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../utils/api';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );
      toast.success('Marked as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark as read');
    }
  };
  
  const deleteNotification = async (notificationId) => {
    try {
      // Remove from local state immediately for better UX
      setNotifications(prev =>
        prev.filter(notification => notification.id !== notificationId)
      );
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };
  
  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      
      await Promise.all(
        unreadNotifications.map(notification =>
          api.patch(`/notifications/${notification.id}/read`)
        )
      );
      
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffMs = now - notificationDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Notifications</h1>
            <p className="text-gray-600">
              {notifications.length === 0 
                ? 'No notifications' 
                : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''} (${notifications.filter(n => !n.isRead).length} unread)`
              }
            </p>
          </div>
          {notifications.length > 0 && notifications.some(n => !n.isRead) && (
            <button
              onClick={markAllAsRead}
              className="btn-primary flex items-center px-4 py-2 rounded-lg font-medium text-sm"
            >
              <Check className="w-4 h-4 mr-2" />
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No notifications</h3>
            <p className="text-gray-600">
              You'll see notifications here when someone votes on or comments on your polls.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const isUnread = !notification.isRead;
              return (
                <Link
                  key={notification.id}
                  to={`/poll/${notification.pollId}`}
                  className={`block p-4 rounded-lg transition-all border ${
                    isUnread 
                      ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      notification.type === 'vote' 
                        ? 'bg-blue-100 text-blue-600' 
                        : notification.type === 'comment_like'
                        ? 'bg-pink-100 text-pink-600'
                        : 'bg-green-100 text-green-600'
                    }`}>
                      {notification.type === 'vote' ? (
                        <BarChart3 className="w-5 h-5 text-current" />
                      ) : notification.type === 'comment_like' ? (
                        <span className="text-lg">👍</span>
                      ) : (
                        <MessageCircle className="w-5 h-5 text-current" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {notification.title && (
                        <h4 className="font-semibold text-gray-900 text-sm mb-1">
                          {notification.title}
                        </h4>
                      )}
                      <p className={`text-sm ${
                        isUnread ? 'text-gray-800' : 'text-gray-600'
                      }`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTimeAgo(notification.createdAt)}
                        </div>
                        {isUnread && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                            New
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            markAsRead(notification.id);
                          }}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          deleteNotification(notification.id);
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete notification"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;