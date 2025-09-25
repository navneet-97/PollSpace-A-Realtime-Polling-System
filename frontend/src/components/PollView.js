import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Clock, 
  Users, 
  MessageCircle, 
  ThumbsUp, 
  Reply, 
  Send,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Calendar,
  Hash,
  BarChart3,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';

const PollView = ({ socket }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [poll, setPoll] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVotes, setUserVotes] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [likingComments, setLikingComments] = useState(new Set());
  const [deletingComments, setDeletingComments] = useState(new Set());

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  
  const handleBackNavigation = () => {
    const referrer = location.state?.from;
    const lastPage = sessionStorage.getItem('lastVisitedPage');
    
    
    if (referrer === '/my-polls') {
      navigate('/my-polls');
    } else if (referrer === '/profile') {
      navigate('/profile');
    } else if (referrer === '/results') {
      navigate('/results');
    } else if (referrer === '/') {
      navigate('/');
    } else if (lastPage === '/my-polls') {
      navigate('/my-polls');
    } else if (lastPage === '/profile') {
      navigate('/profile');
    } else if (lastPage === '/results') {
      navigate('/results');
    } else if (document.referrer.includes('/my-polls')) {
      navigate('/my-polls');
    } else if (document.referrer.includes('/profile')) {
      navigate('/profile');
    } else if (document.referrer.includes('/results')) {
      navigate('/results');
    } else {
      // Default to dashboard
      navigate('/');
    }
  };

  const getBackButtonText = () => {
    const referrer = location.state?.from;
    const lastPage = sessionStorage.getItem('lastVisitedPage');
    
    if (referrer === '/my-polls' || lastPage === '/my-polls' || document.referrer.includes('/my-polls')) {
      return 'Back to My Polls';
    } else if (referrer === '/profile' || lastPage === '/profile' || document.referrer.includes('/profile')) {
      return 'Back to Profile';
    } else if (referrer === '/results' || lastPage === '/results' || document.referrer.includes('/results')) {
      return 'Back to Poll Results';
    }
    return 'Back to Dashboard';
  };

  const fetchPoll = async () => {
    try {
      const response = await api.get(`/polls/${id}`);
      setPoll(response.data);
    } catch (error) {
      console.error('Error fetching poll:', error);
      if (error.response?.status === 404) {
        toast.error('Poll not found');
        navigate('/');
      } else {
        toast.error('Failed to load poll');
      }
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/polls/${id}/comments`);
      // Enhance comments with user like status
      const commentsWithLikeStatus = response.data.map(comment => ({
        ...comment,
        hasLiked: comment.liked_by && comment.liked_by.includes(user.id)
      }));
      setComments(commentsWithLikeStatus);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate actual comment count (comments + replies) from loaded comments
  const actualCommentCount = comments.length;
  
  
  const displayCommentCount = actualCommentCount > 0 ? actualCommentCount : (poll?.comments_count || 0);

  const checkUserVote = async () => {
    try {
      const response = await api.get(`/polls/${id}/vote-status`);
      setHasVoted(response.data.hasVoted);
      setUserVotes(response.data.votes || []);
    } catch (error) {
      console.error('Error checking vote status:', error);
    }
  };

  useEffect(() => {
    fetchPoll();
    fetchComments();
    checkUserVote();

    // Listen for real-time updates
    if (socket) {
      socket.emit('joinPoll', id);

      socket.on('pollUpdate', (updatedPoll) => {
        if (updatedPoll.id === id) {
          setPoll(updatedPoll);
        }
      });

      socket.on('newComment', (comment) => {
        if (comment.poll_id === id) {
          // Only add comments from other users to prevent duplicates
          if (comment.user !== user.id) {
            // Add hasLiked status to new comment
            const commentWithLikeStatus = {
              ...comment,
              hasLiked: comment.liked_by && comment.liked_by.includes(user.id)
            };
            setComments(prev => [commentWithLikeStatus, ...prev]);
          }
        }
      });

      socket.on('commentLikeUpdate', (data) => {
        if (data.commentId) {
          setComments(prev => 
            prev.map(comment =>
              comment.id === data.commentId
                ? { 
                    ...comment, 
                    likes: data.likes,
                    hasLiked: data.hasLiked && data.userId === user.id
                  }
                : comment
            )
          );
        }
      });

      socket.on('commentDeleted', (data) => {
        if (data.commentId) {
          setComments(prev => 
            prev.filter(comment => 
              comment.id !== data.commentId && 
              comment.parent_comment_id !== data.commentId
            )
          );
        }
      });

      // Listen for poll closure events
      socket.on('pollClosed', (data) => {
        if (data.pollId === id) {
          toast.info('Poll Closed', {
            description: data.message || 'This poll has been closed.',
            duration: 5000
          });
          // Refresh poll data to get updated status
          fetchPoll();
        }
      });

      return () => {
        socket.emit('leavePoll', id);
        socket.off('pollUpdate');
        socket.off('newComment');
        socket.off('commentLikeUpdate');
        socket.off('commentDeleted');
        socket.off('pollClosed');
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, socket]);

  // Sync comment count with backend when comments change
  useEffect(() => {
    if (poll && comments.length > 0 && poll.comments_count !== comments.length) {
      setPoll(prev => prev ? { ...prev, comments_count: comments.length } : prev);
    }
  }, [comments.length, poll?.comments_count, poll]);

  const handleVote = async (optionId) => {
    if (poll?.status === 'closed') {
      toast.error('This poll has been closed and is no longer accepting votes');
      return;
    }

    if (hasVoted && !poll?.allow_multiple_votes) {
      toast.info('You have already voted in this poll');
      return;
    }

    if (!user.id) {
      toast.error('Please sign in to vote');
      return;
    }

    setVoting(true);

    try {
      await api.post(`/polls/${id}/vote`, { option_id: optionId });
      
      // Update local state
      if (!poll.allow_multiple_votes) {
        setHasVoted(true);
        setUserVotes([optionId]);
      } else {
        if (userVotes.includes(optionId)) {
          setUserVotes(prev => prev.filter(vote => vote !== optionId));
        } else {
          setUserVotes(prev => [...prev, optionId]);
        }
        setHasVoted(userVotes.length > 0);
      }

      // Fetch updated poll data
      await fetchPoll();

      toast.success('Vote recorded successfully!');

    } catch (error) {
      console.error('Error voting:', error);
      const message = error.response?.data?.error || 'Failed to record vote';
      toast.error(message);
    } finally {
      setVoting(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    
    if (!newComment.trim()) return;
    if (!user.id) {
      toast.error('Please sign in to comment');
      return;
    }

    // Prevent comments on closed polls
    if (poll?.status === 'closed') {
      toast.error('This poll has been closed and no longer accepts comments');
      return;
    }

    // Prevent multiple submissions
    if (commentLoading) return;
    setCommentLoading(true);

    try {
      const commentData = {
        poll_id: id,
        content: newComment.trim(),
        parent_comment_id: null
      };

      const response = await api.post('/comments', commentData);
      const comment = response.data;

      // Add comment immediately (local update)
      const commentWithLikeStatus = {
        ...comment,
        hasLiked: false // New comment, user hasn't liked it yet
      };
      setComments(prev => [commentWithLikeStatus, ...prev]);
      setNewComment('');

      // Signal that poll data has changed (for Profile page refresh)
      localStorage.setItem('pollDataChanged', 'true');
      localStorage.setItem('lastVisitedPage', `/poll/${id}`);

      toast.success('Comment added successfully!');

    } catch (error) {
      console.error('Error adding comment:', error);
      const message = error.response?.data?.error || 'Failed to add comment';
      if (error.response?.status === 429) {
        toast.error('Please wait before posting another comment');
      } else {
        toast.error(message);
      }
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReplySubmit = async (parentCommentId) => {
    if (!replyText.trim()) return;
    if (!user.id) {
      toast.error('Please sign in to reply');
      return;
    }

    // Prevent replies on closed polls
    if (poll?.status === 'closed') {
      toast.error('This poll has been closed and no longer accepts replies');
      return;
    }

    // Prevent multiple submissions
    if (replyLoading) return;
    setReplyLoading(true);

    try {
      const replyData = {
        poll_id: id,
        content: replyText.trim(),
        parent_comment_id: parentCommentId
      };

      const response = await api.post('/comments', replyData);
      const reply = response.data;

      // Add reply to comments immediately (local update)
      const replyWithLikeStatus = {
        ...reply,
        hasLiked: false // New reply, user hasn't liked it yet
      };
      setComments(prev => [replyWithLikeStatus, ...prev]);
      
      // Clear reply form
      setReplyText('');
      setReplyingTo(null);

      // Don't manually update poll comment count - let useEffect sync it from actual comments

      // Signal that poll data has changed (for Profile page refresh)
      localStorage.setItem('pollDataChanged', 'true');
      localStorage.setItem('lastVisitedPage', `/poll/${id}`);

      toast.success('Reply added successfully!');

    } catch (error) {
      console.error('Error adding reply:', error);
      const message = error.response?.data?.error || 'Failed to add reply';
      if (error.response?.status === 429) {
        toast.error('Please wait before posting another reply');
      } else {
        toast.error(message);
      }
    } finally {
      setReplyLoading(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    if (!user.id) {
      toast.error('Please sign in to like comments');
      return;
    }

    
    if (likingComments.has(commentId)) {
      return;
    }

    setLikingComments(prev => new Set([...prev, commentId]));

    try {
      const response = await api.post(`/comments/${commentId}/like`);
      const { likes, hasLiked, message } = response.data;
      
      // Update comment like count and user's like status locally
      setComments(prev => 
        prev.map(comment =>
          comment.id === commentId 
            ? { 
                ...comment, 
                likes: likes,
                hasLiked: hasLiked,
                // Update liked_by array properly
                liked_by: hasLiked 
                  ? [...(comment.liked_by || []).filter(id => id !== user.id), user.id]
                  : (comment.liked_by || []).filter(id => id !== user.id)
              }
            : comment
        )
      );

      toast.success(hasLiked ? 'Comment liked!' : 'Comment unliked!');

    } catch (error) {
      console.error('Error liking comment:', error);
      toast.error('Failed to like comment');
    } finally {
      setLikingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (!user.id) {
      toast.error('Please sign in to delete comments');
      return;
    }

    // Prevent multiple simultaneous delete requests for the same comment
    if (deletingComments.has(commentId)) {
      return;
    }

    if (!window.confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return;
    }

    setDeletingComments(prev => new Set([...prev, commentId]));

    try {
      await api.delete(`/comments/${commentId}`);
      
      
      setComments(prev => 
        prev.filter(comment => 
          comment.id !== commentId && comment.parent_comment_id !== commentId
        )
      );
      
      
      const deletedComment = comments.find(c => c.id === commentId);
      if (deletedComment) {
        // If it's a parent comment, count it plus its replies
        if (!deletedComment.parent_comment_id) {
          const deletedRepliesCount = comments.filter(c => c.parent_comment_id === commentId).length;
          const totalDeleted = 1 + deletedRepliesCount;
          setPoll(prev => prev ? { 
            ...prev, 
            comments_count: Math.max(0, (prev.comments_count || 0) - totalDeleted)
          } : prev);
        } else {
          // If it's a reply, just count 1
          setPoll(prev => prev ? { 
            ...prev, 
            comments_count: Math.max(0, (prev.comments_count || 0) - 1)
          } : prev);
        }
      }

      // Signal that poll data has changed (for Profile page refresh)
      localStorage.setItem('pollDataChanged', 'true');
      localStorage.setItem('lastVisitedPage', `/poll/${id}`);

      toast.success('Comment deleted successfully!');

    } catch (error) {
      console.error('Error deleting comment:', error);
      const message = error.response?.data?.error || 'Failed to delete comment';
      toast.error(message);
    } finally {
      setDeletingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const commentDate = new Date(date);
    const diffMs = now - commentDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      closed: 'bg-red-100 text-red-700',
      draft: 'bg-yellow-100 text-yellow-700'
    };
    return colors[status] || colors.active;
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

  const Comment = ({ comment, isReply = false }) => (
    <div className={`${isReply ? 'ml-12 mt-4' : 'mb-6'} bg-gray-50 rounded-lg p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-white">
              {(comment.author_username || comment.author_email)?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{comment.author_username || comment.author_email}</p>
            <p className="text-xs text-gray-500">{formatTimeAgo(comment.createdAt)}</p>
          </div>
        </div>
        {/* Comment actions - show delete button for comment owner */}
        <div className="flex items-center space-x-2">
          {comment.user === user.id && (
            <button
              onClick={() => handleCommentDelete(comment.id)}
              className={`p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ${
                deletingComments.has(comment.id) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={deletingComments.has(comment.id)}
              title="Delete comment"
            >
              {deletingComments.has(comment.id) ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
      
      <p className="text-gray-800 mb-3">{comment.content}</p>
      
      <div className="flex items-center space-x-4 text-sm">
        <button
          onClick={() => handleCommentLike(comment.id)}
          className={`flex items-center transition-colors ${
            comment.hasLiked || (comment.liked_by && comment.liked_by.includes(user.id))
              ? 'text-blue-600 hover:text-blue-700' 
              : 'text-gray-500 hover:text-blue-600'
          } ${
            likingComments.has(comment.id) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={!user.id || likingComments.has(comment.id)}
        >
          {likingComments.has(comment.id) ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-1"></div>
          ) : (
            <ThumbsUp className={`w-4 h-4 mr-1 ${
              comment.hasLiked || (comment.liked_by && comment.liked_by.includes(user.id))
                ? 'fill-current' 
                : ''
            }`} />
          )}
          {comment.likes || 0}
        </button>
        
        {!isReply && user.id && poll?.status === 'active' && (
          <button
            onClick={() => {
              setReplyingTo(comment.id);
              setReplyText('');
            }}
            className="flex items-center text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Reply className="w-4 h-4 mr-1" />
            Reply
          </button>
        )}
      </div>

      {replyingTo === comment.id && (
        <div className="mt-4">
          <div className="flex space-x-3">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="input text-sm"
              disabled={replyLoading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !replyLoading && replyText.trim()) {
                  e.preventDefault();
                  handleReplySubmit(comment.id);
                }
                if (e.key === 'Escape') {
                  setReplyingTo(null);
                  setReplyText('');
                }
              }}
            />
            <button
              onClick={() => handleReplySubmit(comment.id)}
              disabled={replyLoading || !replyText.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {replyLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => {
                setReplyingTo(null);
                setReplyText('');
              }}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors"
              disabled={replyLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-3/4"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <div className="bg-red-50 rounded-lg p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-900 mb-2">Poll Not Found</h2>
          <p className="text-red-700 mb-4">The poll you're looking for doesn't exist or has been removed.</p>
          <Link to="/" className="btn-primary px-6 py-3 rounded-lg font-medium">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const parentComments = comments.filter(c => !c.parent_comment_id);
  const replies = comments.filter(c => c.parent_comment_id);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Back Navigation */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleBackNavigation}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {getBackButtonText()}
        </button>
      </div>

      {/* Poll Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(poll.category)}`}>
                {poll.category}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(poll.status)}`}>
                {poll.status}
              </span>
              {poll.ends_at && (
                <span className={`flex items-center text-sm ${
                  poll.status === 'closed' && new Date(poll.ends_at) <= new Date() 
                    ? 'text-red-600' 
                    : new Date(poll.ends_at) <= new Date() 
                      ? 'text-orange-600' 
                      : 'text-gray-500'
                }`}>
                  <Calendar className="w-4 h-4 mr-1" />
                  {poll.status === 'closed' && new Date(poll.ends_at) <= new Date() 
                    ? `Ended ${new Date(poll.ends_at).toLocaleDateString()}` 
                    : new Date(poll.ends_at) <= new Date()
                      ? `Expired ${new Date(poll.ends_at).toLocaleDateString()}`
                      : `Ends ${new Date(poll.ends_at).toLocaleDateString()}`
                  }
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{poll.title}</h1>
            {poll.description && (
              <p className="text-gray-600 text-lg mb-4">{poll.description}</p>
            )}
          </div>
        </div>

        {/* Poll Stats */}
        <div className="flex items-center space-x-6 text-sm text-gray-500 mb-6">
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            {poll.total_votes} votes
          </div>
          <div className="flex items-center">
            <MessageCircle className="w-4 h-4 mr-1" />
            {displayCommentCount} comments
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            Created {formatTimeAgo(poll.createdAt)}
          </div>
          <div className="flex items-center">
            <Hash className="w-4 h-4 mr-1" />
            ID: {poll.id.slice(0, 8)}
          </div>
        </div>

        {hasVoted && !poll.allow_multiple_votes && (
          <div className="mb-6 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center text-green-800">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">You have voted in this poll</span>
            </div>
          </div>
        )}

        {/* Poll Closure Notice */}
        {poll.status === 'closed' && poll.ends_at && new Date(poll.ends_at) <= new Date() && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center text-red-800">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">
                This poll was automatically closed when it reached its end date on {new Date(poll.ends_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
        
        {/* Manual Reopen Notice - REMOVED as per user request */}
        {/* 
        {poll.status === 'active' && poll.manual_status_override && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center text-blue-800">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">
                This poll was manually reopened and will run indefinitely until closed
              </span>
            </div>
          </div>
        )}
        */}

        {/* Voting Options */}
        <div className="space-y-4">
          {poll.options.map((option, index) => {
            const isUserVote = userVotes.includes(option.id);

            return (
              <div key={option.id} className="relative">
                <button
                  onClick={() => handleVote(option.id)}
                  disabled={voting || poll.status === 'closed'}
                  className={`w-full p-4 border-2 rounded-lg text-left font-medium transition-all hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed ${
                    poll.allow_multiple_votes && isUserVote
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.text}</span>
                    {poll.allow_multiple_votes && isUserVote && (
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Multiple Votes Information - Always visible when poll allows multiple votes */}
        {poll.allow_multiple_votes && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-blue-800 font-medium">Multiple votes allowed</p>
                <p className="text-blue-700 text-sm mt-1">
                  {hasVoted 
                    ? "You can select additional options. Each selection counts as one vote."
                    : "You can select more than one option. Each selection counts as one vote."
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* View Results Button */}
        {(hasVoted || poll.status === 'closed' || (poll.show_results && poll.total_votes > 0)) && (
          <div className="mt-6 text-center">
            <Link
              to={`/poll/${poll.id}/results`}
              state={{ from: location.pathname }}
              className="btn-primary inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white shadow-sm"
            >
              <BarChart3 className="w-5 h-5 mr-2" />
              View Results
            </Link>
          </div>
        )}


      </div>

      {/* Comments Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Comments ({displayCommentCount})
        </h2>

        {/* Add Comment Form */}
        {user.id ? (
          poll.status === 'closed' ? (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg text-center border border-gray-200">
              <p className="text-gray-600 mb-2 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                This poll has been closed and no longer accepts new comments
              </p>
            </div>
          ) : (
            <form onSubmit={handleCommentSubmit} className="mb-8">
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-white">
                    {(user.username || user.email)?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your thoughts..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      type="submit"
                      disabled={!newComment.trim() || commentLoading}
                      className="btn-primary px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {commentLoading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Posting...
                        </div>
                      ) : (
                        'Post Comment'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )
        ) : (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600 mb-3">Sign in to join the conversation</p>
            <Link to="/login" className="btn-primary px-6 py-2 rounded-lg font-medium">
              Sign In
            </Link>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-6">
          {parentComments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No comments yet. Be the first to share your thoughts!</p>
            </div>
          ) : (
            parentComments.map(comment => (
              <div key={comment.id}>
                <Comment comment={comment} />
                {/* Render replies */}
                {replies
                  .filter(reply => reply.parent_comment_id === comment.id)
                  .map(reply => (
                    <Comment key={reply.id} comment={reply} isReply />
                  ))
                }
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PollView;
