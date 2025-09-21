import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Bell, 
  User, 
  LogOut, 
  Menu, 
  X, 
  Plus, 
  BarChart3,
  Home,
  FileText,
  Settings,
  ChevronRight
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import NotificationService from '../services/NotificationService';
import NotificationPanel from './NotificationPanel';

const Layout = ({ user, onLogout, children }) => {
  const {
    notifications,
    loading: notificationLoading,
    fetchNotifications
  } = useNotifications();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  const isActive = (path) => {
    return location.pathname === path;
  };


  if (!user) {
    return children; // Return children directly if no user (login/register pages)
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link to="/" className="flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">PollSpace</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="px-4 py-4 space-y-2">
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/') 
                ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500' 
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Home className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          
          <Link
            to="/create"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/create') 
                ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500' 
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Plus className="w-5 h-5" />
            <span>Create Poll</span>
          </Link>
          
          <Link
            to="/my-polls"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/my-polls') 
                ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500' 
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>My Polls</span>
          </Link>
          
          <Link
            to="/results"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/results') 
                ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500' 
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Poll Results</span>
          </Link>
          
          <Link
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/profile') 
                ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500' 
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Profile</span>
          </Link>
        </nav>

        {/* Notifications Section - Expanded */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-6 border-t border-gray-200 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                <Bell className="w-4 h-4 mr-2" />
                Recent Activity
              </h3>
              <button
                onClick={() => setNotificationPanelOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-medium"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {notificationLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                </div>
              )}
              
              {!notificationLoading && notifications.length === 0 && (
                <div className="text-center py-12">
                  <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No recent activity</p>
                  <p className="text-xs text-gray-400 mt-1">Stay tuned for updates!</p>
                </div>
              )}
              
              {!notificationLoading && notifications.slice(0, 5).map((notification) => {
                const icon = NotificationService.getNotificationIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className="group p-2 rounded-lg transition-all duration-200 border bg-gray-50 border-gray-200"
                  >
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs bg-blue-100 text-blue-600">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed text-gray-700 font-medium line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {NotificationService.formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {!notificationLoading && notifications.length > 5 && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setNotificationPanelOpen(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    View {notifications.length - 5} more notifications
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>



        {/* User Profile Footer - Moved to bottom */}
        <div className="mt-auto px-4 py-4 border-t border-gray-200">
          <Link
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            {user.profile_picture ? (
              <img
                src={`${process.env.REACT_APP_BACKEND_URL}${user.profile_picture}`}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{user.username}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLogout();
              }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span className="text-lg font-bold text-gray-900">PollSpace</span>
            </div>
            <div className="w-8"></div>
          </div>
        </div>

        {/* Page Content */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Notification Panel */}
      <NotificationPanel 
        isOpen={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
      />
    </div>
  );
};

export default Layout;
