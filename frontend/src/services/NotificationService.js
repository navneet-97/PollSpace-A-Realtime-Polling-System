import { NOTIFICATION_TYPES } from '../context/NotificationContext';

class NotificationService {
  constructor() {
    this.soundEnabled = JSON.parse(localStorage.getItem('notificationSound') || 'true');
    this.browserEnabled = JSON.parse(localStorage.getItem('browserNotifications') || 'true');
  }

  // Format notification message based on type and data
  formatNotificationMessage(type, data) {
    switch (type) {
      case NOTIFICATION_TYPES.VOTE:
        return `${data.voterName || 'Someone'} voted on your poll "${data.pollTitle}"`;
      
      case NOTIFICATION_TYPES.COMMENT:
        return `${data.commenterName || 'Someone'} commented on your poll "${data.pollTitle}"`;
      
      case NOTIFICATION_TYPES.REPLY:
        return `${data.replierName || 'Someone'} replied to your comment on "${data.pollTitle}"`;
      
      case NOTIFICATION_TYPES.COMMENT_LIKE:
        return `${data.likerName || 'Someone'} liked your comment on "${data.pollTitle}"`;
      
      case NOTIFICATION_TYPES.POLL_CREATED:
        return `Your poll "${data.pollTitle}" has been created successfully`;
      
      case NOTIFICATION_TYPES.POLL_CLOSED:
        return `Your poll "${data.pollTitle}" has been closed. Final results are now available.`;
      
      case NOTIFICATION_TYPES.SYSTEM:
        return data.message || 'System notification';
      
      default:
        return data.message || 'New notification';
    }
  }

  // Create notification object
  createNotification(type, data, userId = null) {
    return {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      userId: userId || data.userId,
      message: this.formatNotificationMessage(type, data),
      data: data,
      pollId: data.pollId || null,
      commentId: data.commentId || null,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: this.getNotificationPriority(type)
    };
  }

  // Get notification priority (for sorting and styling)
  getNotificationPriority(type) {
    switch (type) {
      case NOTIFICATION_TYPES.SYSTEM:
        return 'high';
      case NOTIFICATION_TYPES.REPLY:
        return 'medium';
      case NOTIFICATION_TYPES.COMMENT:
        return 'medium';
      case NOTIFICATION_TYPES.VOTE:
        return 'low';
      case NOTIFICATION_TYPES.COMMENT_LIKE:
        return 'low';
      case NOTIFICATION_TYPES.POLL_CREATED:
        return 'low';
      case NOTIFICATION_TYPES.POLL_CLOSED:
        return 'medium';
      default:
        return 'low';
    }
  }

  // Get notification icon
  getNotificationIcon(type) {
    switch (type) {
      case NOTIFICATION_TYPES.VOTE:
        return '🗳️';
      case NOTIFICATION_TYPES.COMMENT:
        return '💬';
      case NOTIFICATION_TYPES.REPLY:
        return '↩️';
      case NOTIFICATION_TYPES.COMMENT_LIKE:
        return '👍';
      case NOTIFICATION_TYPES.POLL_CREATED:
        return '📊';
      case NOTIFICATION_TYPES.POLL_CLOSED:
        return '🔒';
      case NOTIFICATION_TYPES.SYSTEM:
        return '⚙️';
      default:
        return '🔔';
    }
  }

  // Get notification color theme
  getNotificationColor(type, priority = 'low') {
    const colors = {
      vote: 'blue',
      comment: 'green',
      reply: 'purple',
      comment_like: 'pink',
      poll_created: 'indigo',
      poll_closed: 'orange',
      system: 'red'
    };

    return colors[type] || 'gray';
  }

  // Format timestamp for display
  formatTimestamp(timestamp) {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffMs = now - notificationTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return notificationTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: notificationTime.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  // Play notification sound
  playNotificationSound() {
    if (!this.soundEnabled) return;

    try {
      // Create audio context and generate a pleasant notification sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      // Could not play notification sound
    }
  }

  // Group notifications by type or date
  groupNotifications(notifications, groupBy = 'date') {
    if (groupBy === 'date') {
      return this.groupByDate(notifications);
    } else if (groupBy === 'type') {
      return this.groupByType(notifications);
    }
    return { 'All': notifications };
  }

  groupByDate(notifications) {
    const groups = {};
    const now = new Date();
    
    notifications.forEach(notification => {
      const notifDate = new Date(notification.timestamp);
      const diffDays = Math.floor((now - notifDate) / (1000 * 60 * 60 * 24));
      
      let groupKey;
      if (diffDays === 0) {
        groupKey = 'Today';
      } else if (diffDays === 1) {
        groupKey = 'Yesterday';
      } else if (diffDays < 7) {
        groupKey = 'This Week';
      } else if (diffDays < 30) {
        groupKey = 'This Month';
      } else {
        groupKey = 'Older';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notification);
    });

    return groups;
  }

  groupByType(notifications) {
    const groups = {};
    
    notifications.forEach(notification => {
      const type = notification.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(notification);
    });

    return groups;
  }

  // Filter notifications
  filterNotifications(notifications, filters) {
    let filtered = [...notifications];

    if (filters.unreadOnly) {
      filtered = filtered.filter(n => !n.isRead);
    }

    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter(n => n.type === filters.type);
    }

    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(n => n.priority === filters.priority);
    }

    if (filters.dateRange) {
      const now = new Date();
      const daysAgo = {
        'today': 1,
        'week': 7,
        'month': 30,
        'all': Infinity
      };
      
      const maxDays = daysAgo[filters.dateRange] || Infinity;
      if (maxDays !== Infinity) {
        const cutoffDate = new Date(now.getTime() - (maxDays * 24 * 60 * 60 * 1000));
        filtered = filtered.filter(n => new Date(n.timestamp) >= cutoffDate);
      }
    }

    return filtered;
  }

  // Sort notifications
  sortNotifications(notifications, sortBy = 'timestamp', order = 'desc') {
    return [...notifications].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'timestamp':
          valueA = new Date(a.timestamp);
          valueB = new Date(b.timestamp);
          break;
        case 'priority':
          const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          valueA = priorityOrder[a.priority] || 1;
          valueB = priorityOrder[b.priority] || 1;
          break;
        case 'type':
          valueA = a.type;
          valueB = b.type;
          break;
        case 'read':
          valueA = a.isRead ? 1 : 0;
          valueB = b.isRead ? 1 : 0;
          break;
        default:
          valueA = a[sortBy];
          valueB = b[sortBy];
      }
      
      if (order === 'desc') {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      } else {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      }
    });
  }

  // Settings management
  updateSettings(settings) {
    if (settings.hasOwnProperty('soundEnabled')) {
      this.soundEnabled = settings.soundEnabled;
      localStorage.setItem('notificationSound', JSON.stringify(this.soundEnabled));
    }
    
    if (settings.hasOwnProperty('browserEnabled')) {
      this.browserEnabled = settings.browserEnabled;
      localStorage.setItem('browserNotifications', JSON.stringify(this.browserEnabled));
    }
  }

  getSettings() {
    return {
      soundEnabled: this.soundEnabled,
      browserEnabled: this.browserEnabled
    };
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;
