import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import api from '../utils/api';

const NotificationContext = createContext();

// Notification Types
export const NOTIFICATION_TYPES = {
  VOTE: 'vote',
  COMMENT: 'comment', 
  REPLY: 'reply',
  COMMENT_LIKE: 'comment_like',
  POLL_CREATED: 'poll_created',
  POLL_CLOSED: 'poll_closed',
  SYSTEM: 'system'
};

// Action Types
const NOTIFICATION_ACTIONS = {
  SET_NOTIFICATIONS: 'SET_NOTIFICATIONS',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  MARK_AS_READ: 'MARK_AS_READ',
  MARK_ALL_AS_READ: 'MARK_ALL_AS_READ',
  DELETE_NOTIFICATION: 'DELETE_NOTIFICATION',
  CLEAR_ALL: 'CLEAR_ALL',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  UPDATE_UNREAD_COUNT: 'UPDATE_UNREAD_COUNT'
};

// Initial State
const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  connected: false
};

// Reducer
function notificationReducer(state, action) {
  switch (action.type) {
    case NOTIFICATION_ACTIONS.SET_NOTIFICATIONS:
      const unreadCount = action.payload.filter(n => !n.isRead).length;
      return {
        ...state,
        notifications: action.payload,
        unreadCount,
        loading: false,
        error: null
      };

    case NOTIFICATION_ACTIONS.ADD_NOTIFICATION:
      const newNotification = {
        ...action.payload,
        id: action.payload.id || Date.now().toString(),
        timestamp: action.payload.timestamp || new Date(),
        isRead: false
      };
      return {
        ...state,
        notifications: [newNotification, ...state.notifications],
        unreadCount: state.unreadCount + 1
      };

    case NOTIFICATION_ACTIONS.MARK_AS_READ:
      const updatedNotifications = state.notifications.map(notification =>
        notification.id === action.payload.id
          ? { ...notification, isRead: true }
          : notification
      );
      const newUnreadCount = updatedNotifications.filter(n => !n.isRead).length;
      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: newUnreadCount
      };

    case NOTIFICATION_ACTIONS.MARK_ALL_AS_READ:
      return {
        ...state,
        notifications: state.notifications.map(notification => ({
          ...notification,
          isRead: true
        })),
        unreadCount: 0
      };

    case NOTIFICATION_ACTIONS.DELETE_NOTIFICATION:
      const filteredNotifications = state.notifications.filter(
        notification => notification.id !== action.payload.id
      );
      const remainingUnreadCount = filteredNotifications.filter(n => !n.isRead).length;
      return {
        ...state,
        notifications: filteredNotifications,
        unreadCount: remainingUnreadCount
      };

    case NOTIFICATION_ACTIONS.CLEAR_ALL:
      return {
        ...state,
        notifications: [],
        unreadCount: 0
      };

    case NOTIFICATION_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };

    case NOTIFICATION_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      };

    case NOTIFICATION_ACTIONS.UPDATE_UNREAD_COUNT:
      return {
        ...state,
        unreadCount: action.payload
      };

    default:
      return state;
  }
}

export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const socketRef = useRef(null);
  const userRef = useRef(null);

  const getNotificationTitle = useCallback((notification) => {
    switch (notification.type) {
      case NOTIFICATION_TYPES.VOTE:
        return '🗳️ New Vote on Your Poll';
      case NOTIFICATION_TYPES.COMMENT:
        return '💬 New Comment on Your Poll';
      case NOTIFICATION_TYPES.REPLY:
        return '↩️ Reply to Your Comment';
      case NOTIFICATION_TYPES.COMMENT_LIKE:
        return '👍 Someone Liked Your Comment';
      case NOTIFICATION_TYPES.POLL_CREATED:
        return '📊 Poll Created Successfully';
      case NOTIFICATION_TYPES.POLL_CLOSED:
        return '🔒 Poll Closed';
      case NOTIFICATION_TYPES.SYSTEM:
        return '🔔 PollSpace Notification';
      default:
        return '🔔 New Notification';
    }
  }, []);

  const addNotification = useCallback((notification) => {
    dispatch({ type: NOTIFICATION_ACTIONS.ADD_NOTIFICATION, payload: notification });
  }, [dispatch]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);

      dispatch({ type: NOTIFICATION_ACTIONS.MARK_AS_READ, payload: { id: notificationId } });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      dispatch({ type: NOTIFICATION_ACTIONS.SET_ERROR, payload: error.message });
    }
  }, [dispatch]);

  const showBrowserNotification = useCallback((notification) => {
    try {
      const title = getNotificationTitle(notification);
      const options = {
        body: notification.message || notification.content,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: false,
        silent: false
      };

      const browserNotification = new Notification(title, options);
      
      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
        // Navigate to relevant page based on notification type
        if (notification.pollId) {
          window.location.href = `/poll/${notification.pollId}`;
        }
      };

      // Auto-close after 5 seconds
      setTimeout(() => {
        browserNotification.close();
      }, 5000);

    } catch (error) {
      console.error('Failed to show browser notification:', error);
    }
  }, [getNotificationTitle]);

  const initializeSocket = useCallback((token) => {
    try {
      // Clean up existing socket first
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;
      socketRef.current = io(BACKEND_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Notifications socket connected');
        dispatch({ type: NOTIFICATION_ACTIONS.SET_ERROR, payload: null });
        if (userRef.current?.id) {
          socketRef.current.emit('join', userRef.current.id);
        }
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('❌ Notifications socket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // the disconnection was initiated by the server, you need to reconnect manually
          socketRef.current.connect();
        }
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        dispatch({ type: NOTIFICATION_ACTIONS.SET_ERROR, payload: `Connection failed: ${error.message}` });
        
        // If it's an authentication error, clear the invalid token
        if (error.message.includes('Invalid token') || error.message.includes('Authentication')) {
          console.warn('Socket authentication failed, clearing sessionStorage');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          window.location.href = '/login';
        }
      });

      // Listen for new notifications
      socketRef.current.on('newNotification', (notification) => {
        console.log('🔔 New notification received:', notification);
        console.log('🔔 Notification type:', notification.type);
        console.log('🔔 Notification message:', notification.message);
        console.log('🔔 Notification userId:', notification.userId);
        console.log('🔔 Current user:', userRef.current?.id);
        
        addNotification(notification);
        
        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
          showBrowserNotification(notification);
        }
      });

      socketRef.current.on('notificationRead', (data) => {
        markAsRead(data.notificationId);
      });

      socketRef.current.on('error', (error) => {
        console.error('Socket error:', error);
        dispatch({ type: NOTIFICATION_ACTIONS.SET_ERROR, payload: error.message });
      });

    } catch (error) {
      console.error('Failed to initialize socket:', error);
      dispatch({ type: NOTIFICATION_ACTIONS.SET_ERROR, payload: error.message });
    }
  }, [showBrowserNotification, addNotification, markAsRead, dispatch]);

  const fetchNotifications = useCallback(async () => {
    try {
      dispatch({ type: NOTIFICATION_ACTIONS.SET_LOADING, payload: true });
      
      const response = await api.get('/notifications');

      const data = Array.isArray(response.data) ? response.data : (response.data.notifications || []);
      dispatch({ 
        type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS, 
        payload: data
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      dispatch({ type: NOTIFICATION_ACTIONS.SET_ERROR, payload: error.message });
    }
  }, [dispatch]);

  // Initialize socket connection
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const user = sessionStorage.getItem('user');
    
    if (token && user) {
      try {
        userRef.current = JSON.parse(user);
        initializeSocket(token);
        fetchNotifications();
      } catch (error) {
        console.error('Failed to parse user data:', error);
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initializeSocket, fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch('/notifications/mark-all-read');

      dispatch({ type: NOTIFICATION_ACTIONS.MARK_ALL_AS_READ });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      dispatch({ type: NOTIFICATION_ACTIONS.SET_ERROR, payload: error.message });
    }
  }, [dispatch]);

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);

      dispatch({ type: NOTIFICATION_ACTIONS.DELETE_NOTIFICATION, payload: { id: notificationId } });
    } catch (error) {
      console.error('Failed to delete notification:', error);
      dispatch({ type: NOTIFICATION_ACTIONS.SET_ERROR, payload: error.message });
    }
  }, [dispatch]);

  const clearAllNotifications = useCallback(async () => {
    try {
      await api.delete('/notifications/clear-all');

      dispatch({ type: NOTIFICATION_ACTIONS.CLEAR_ALL });
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
      dispatch({ type: NOTIFICATION_ACTIONS.SET_ERROR, payload: error.message });
    }
  }, [dispatch]);

  const requestNotificationPermission = useCallback(async () => {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, []);

  const value = {
    ...state,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    fetchNotifications,
    requestNotificationPermission,
    getNotificationTitle
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;