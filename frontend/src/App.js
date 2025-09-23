import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Toaster, toast } from 'sonner';
import { getValidAuthData, cleanupInvalidTokens, isValidTokenFormat } from './utils/tokenUtils';
import './App.css';

// Context
import { NotificationProvider } from './context/NotificationContext';

// Components
import Layout from './components/Layout';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import CreatePoll from './components/CreatePoll';
import EditPoll from './components/EditPoll';
import PollView from './components/PollView';
import PollResults from './components/PollResults';
import Profile from './components/Profile';
import Notifications from './components/Notifications';
import MyPolls from './components/MyPolls';
import AllPollResults from './components/AllPollResults';
import Chatbot from './components/Chatbot';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const recentToasts = useRef(new Set());

  // Removed debug functions for production

  // Check if user is logged in on app start
  useEffect(() => {
    // Clean up any invalid tokens first
    const wasCleanedUp = cleanupInvalidTokens();
    
    if (wasCleanedUp) {
      setLoading(false);
      return;
    }
    
    const authData = getValidAuthData();
    
    if (authData) {
      const { token, user } = authData;
      setUser(user);
      
      // Initialize Socket.IO connection
      const newSocket = io(BACKEND_URL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000
      });
      
      newSocket.on('connect', () => {
        // Join user's personal room for notifications
        newSocket.emit('join', user.id);
      });

      newSocket.on('connect_error', (error) => {
        if (error.message.includes('Invalid token') || error.message.includes('Authentication')) {
          cleanupInvalidTokens();
          setUser(null);
          newSocket.disconnect();
          toast.error('Session expired. Please login again.');
        }
      });

      newSocket.on('newNotification', (notification) => {
        // Only show toast for actual user notifications, not poll creation updates
        if (notification.type !== 'poll_created') {
          showToastWithDuplicateCheck('New Notification', notification.message, 'success');
        }
      });

      newSocket.on('disconnect', () => {
        // Disconnected from server
      });

      setSocket(newSocket);
    }
    
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    try {
      // Validate token format before storing
      if (!isValidTokenFormat(token)) {
        toast.error('Invalid authentication token received');
        return;
      }
      
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      // Initialize Socket.IO connection
      const newSocket = io(BACKEND_URL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000
      });
      
      newSocket.on('connect', () => {
        newSocket.emit('join', userData.id);
      });

      newSocket.on('connect_error', (error) => {
        if (error.message.includes('Invalid token') || error.message.includes('Authentication')) {
          toast.error('Authentication failed. Please login again.');
          logout();
        }
      });

      setSocket(newSocket);
      
      toast.success('Login successful!');
    } catch (error) {
      toast.error('Failed to complete login process');
    }
  };

  // Toast duplicate prevention helper
  const showToastWithDuplicateCheck = (title, message, type = 'success') => {
    const toastKey = `${type}-${title}-${message}`;
    
    // Check if we've shown this exact toast recently (within 3 seconds)
    if (recentToasts.current.has(toastKey)) {
      return;
    }
    
    // Add to recent toasts
    recentToasts.current.add(toastKey);
    
    // Remove from recent toasts after 3 seconds
    setTimeout(() => {
      recentToasts.current.delete(toastKey);
    }, 3000);
    
    // Show the toast
    if (type === 'success') {
      toast.success(title, { description: message });
    } else if (type === 'error') {
      toast.error(title, { description: message });
    } else if (type === 'info') {
      toast.info(title, { description: message });
    } else if (type === 'warning') {
      toast.warning(title, { description: message });
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    // Token removal handled by api.js interceptor
    setUser(null);
    
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    
    toast.success('Logged out successfully!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
        <NotificationProvider>
          <Toaster 
            richColors 
            position="top-right" 
            expand={true}
            visibleToasts={4}
            duration={4000}
            closeButton={true}
            toastOptions={{
              style: {
                padding: '16px',
                fontSize: '14px',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(8px)',
                maxWidth: '420px',
              },
              className: 'custom-toast',
              success: {
                style: {
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                },
              },
              error: {
                style: {
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                },
              },
              info: {
                style: {
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                },
              },
              warning: {
                style: {
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                },
              },
            }}
          />
          
          <Layout user={user} onLogout={logout}>
            <Routes>
              {/* Public routes */}
              {!user ? (
                <>
                  <Route path="/login" element={<Login onLogin={login} />} />
                  <Route path="/register" element={<Register onLogin={login} />} />
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </>
              ) : (
                <>
                  {/* Protected routes */}
                  <Route path="/" element={<Dashboard socket={socket} />} />
                  <Route path="/create" element={<CreatePoll socket={socket} />} />
                  <Route path="/my-polls" element={<MyPolls />} />
                  <Route path="/poll/:id" element={<PollView socket={socket} />} />
                  <Route path="/poll/:id/edit" element={<EditPoll socket={socket} />} />
                  <Route path="/poll/:id/results" element={<PollResults />} />
                  <Route path="/results" element={<AllPollResults />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}
            </Routes>
            
            {/* Chatbot - only show when user is logged in */}
            {user && <Chatbot />}
          </Layout>
        </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;