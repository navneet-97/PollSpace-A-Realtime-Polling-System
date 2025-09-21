import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  Mail, 
  MapPin, 
  Calendar,
  Edit, 
  Save, 
  X, 
  Camera,
  BarChart3,
  Users,
  MessageCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import PollCard from './PollCard';

const Profile = () => {
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('user') || '{}'));
  const BASE_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [createdPolls, setCreatedPolls] = useState([]);
  const [votedPolls, setVotedPolls] = useState([]);
  const [pollsCache, setPollsCache] = useState(null);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);
  const [profileData, setProfileData] = useState({
    username: user.username || '',
    email: user.email || '',
    bio: user.bio || '',
    location: user.location || '',
    removeProfilePicture: false
  });
  const [stats, setStats] = useState({
    totalPolls: 0,
    totalVotes: 0,
    totalComments: 0,
    joinDate: user.createdAt || new Date().toISOString()
  });

  // Initialize data on component mount and handle data refresh
  useEffect(() => {
    const initializeData = async () => {
      setDataLoading(true);
      try {
        await Promise.all([
          fetchUserStats(),
          fetchInitialPolls()
        ]);
      } catch (error) {
        console.error('Error initializing profile data:', error);
      } finally {
        setDataLoading(false);
      }
    };
    
    // Check if user is returning from a poll page
    const lastVisitedPage = sessionStorage.getItem('lastVisitedPage');
    const shouldRefresh = lastVisitedPage && lastVisitedPage.startsWith('/poll/');
    
    // Track that user visited Profile page
    localStorage.setItem('lastVisitedPage', '/profile');
    
    // Always initialize on mount, or refresh if returning from a poll
    if (shouldRefresh) {
      // Clear cache to force fresh data
      setPollsCache(null);
      setCreatedPolls([]);
    }
    
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for storage events to refresh data when returning from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'pollDataChanged' && e.newValue === 'true') {
        // Clear the flag
        localStorage.removeItem('pollDataChanged');
        // Refresh poll data
        setPollsCache(null);
        setCreatedPolls([]);
        fetchInitialPolls();
        fetchUserStats();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check for the flag on component focus
    const handleWindowFocus = () => {
      if (localStorage.getItem('pollDataChanged') === 'true') {
        localStorage.removeItem('pollDataChanged');
        setPollsCache(null);
        setCreatedPolls([]);
        fetchInitialPolls();
        fetchUserStats();
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle tab changes without refetching data
  useEffect(() => {
    if (activeTab === 'created' && !createdPolls.length && pollsCache) {
      setCreatedPolls(pollsCache.slice(0, 6));
    } else if (activeTab === 'voted' && !votedPolls.length) {
      fetchVotedPolls();
    } else if (activeTab === 'overview' && !votedPolls.length) {
      // Fetch voted polls for overview tab if not already loaded
      fetchVotedPolls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchInitialPolls = async () => {
    try {
      const response = await api.get('/polls/my-polls');
      const polls = response.data;
      setPollsCache(polls);
      setCreatedPolls(polls.slice(0, 6)); // Show latest 6
    } catch (error) {
      console.error('Error fetching created polls:', error);
    }
  };

  const fetchUserStats = async () => {
    try {
      // Use cached polls data if available, otherwise fetch
      const pollsData = pollsCache || await api.get('/polls/my-polls').then(res => {
        const data = res.data;
        setPollsCache(data); // Cache the data
        return data;
      });
      
      const userStats = await api.get('/user/stats').then(res => res.data);

      setStats({
        totalPolls: pollsData.length,
        totalVotes: userStats.totalVotes || 0,
        totalComments: userStats.totalComments || 0,
        joinDate: user.createdAt || new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchVotedPolls = async () => {
    try {
      const response = await api.get('/user/voted-polls');
      setVotedPolls(response.data.slice(0, 6)); // Show latest 6
    } catch (error) {
      console.error('Error fetching voted polls:', error);
      toast.error('Failed to load voted polls');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', profileData.username);
      formData.append('bio', profileData.bio);
      formData.append('location', profileData.location);
      
      // Handle profile picture removal
      if (profileData.removeProfilePicture) {
        formData.append('removeProfilePicture', 'true');
      } else if (profilePictureFile) {
        formData.append('profilePicture', profilePictureFile);
      }

      const response = await api.patch('/user/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const updatedUser = response.data;
      setUser(updatedUser);
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      setIsEditing(false);
      setProfilePictureFile(null);
      setProfileData(prev => ({ ...prev, removeProfilePicture: false })); // Reset the remove flag
      
      toast.success('Profile updated successfully!');

    } catch (error) {
      console.error('Error updating profile:', error);
      const message = error.response?.data?.error || 'Failed to update profile';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', profileData.username);
      formData.append('bio', profileData.bio);
      formData.append('location', profileData.location);
      formData.append('removeProfilePicture', 'true'); // Always set this to true for removal

      console.log('Sending request to remove profile picture');
      
      const response = await api.patch('/user/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const updatedUser = response.data;
      console.log('Received updated user data:', updatedUser);
      
      setUser(updatedUser);
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      setProfilePictureFile(null);
      setProfileData(prev => ({ ...prev, removeProfilePicture: false })); // Reset the remove flag
      
      // Also update the profileData state to reflect the changes
      setProfileData({
        username: updatedUser.username || '',
        email: updatedUser.email || '',
        bio: updatedUser.bio || '',
        location: updatedUser.location || '',
        removeProfilePicture: false
      });
      
      console.log('User state updated, profile_picture:', updatedUser.profile_picture);
      
      toast.success('Profile picture removed successfully!');
    } catch (error) {
      console.error('Error removing profile picture:', error);
      const message = error.response?.data?.error || 'Failed to remove profile picture';
      toast.error(message);
    } finally {
      setLoading(false);
      setShowProfilePictureModal(false);
      setIsEditing(false); // Exit editing mode after removal
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      setProfilePictureFile(file);
    }
  };

  const formatJoinDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="card">
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

  const PollPreviewCard = ({ poll }) => (
    <Link
      to={`/poll/${poll.id}`}
      state={{ from: '/profile' }}
      className="block bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 line-clamp-2 flex-1">{poll.title}</h4>
        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
          {formatTimeAgo(poll.createdAt)}
        </span>
      </div>
      
      <div className="flex items-center space-x-4 text-xs text-gray-500">
        <span className="flex items-center">
          <Users className="w-3 h-3 mr-1" />
          {poll.total_votes} votes
        </span>
        <span className="flex items-center">
          <MessageCircle className="w-3 h-3 mr-1" />
          {poll.comments_count || 0} comments
        </span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          poll.status === 'active' ? 'bg-green-100 text-green-700' :
          poll.status === 'closed' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {poll.status}
        </span>
      </div>
    </Link>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Profile Header */}
      <div className="card p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-8">
          {/* Profile Picture */}
          <div className="relative mb-6 lg:mb-0">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
              {console.log('Rendering profile picture, user.profile_picture:', user.profile_picture)}
              {user.profile_picture ? (
                <img
                  src={user.profile_picture.startsWith('http') ? user.profile_picture : `${BASE_URL}${user.profile_picture}`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-16 h-16 text-white" />
              )}
            </div>
            
            {isEditing && (
              <label 
                className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors"
                onClick={() => {
                  if (user.profile_picture) {
                    // If there's already a profile picture, show the modal
                    setShowProfilePictureModal(true);
                  } else {
                    // If there's no profile picture, trigger file input directly
                    document.getElementById('profilePictureInput').click();
                  }
                }}
              >
                <Camera className="w-5 h-5 text-white" />
              </label>
            )}
            
            {/* Hidden file input */}
            <input
              id="profilePictureInput"
              type="file"
              accept="image/*"
              onChange={handleProfilePictureChange}
              className="hidden"
            />
            
            {profilePictureFile && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            {isEditing ? (
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      Username
                    </label>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="label">
                      Location
                    </label>
                    <input
                      type="text"
                      value={profileData.location}
                      onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="e.g., New York, USA"
                      className="input"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label">
                    Bio
                  </label>
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    maxLength={500}
                    className="input resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">{profileData.bio.length}/500 characters</p>
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setProfileData({
                        username: user.username || '',
                        email: user.email || '',
                        bio: user.bio || '',
                        location: user.location || '',
                        removeProfilePicture: false
                      });
                      setProfilePictureFile(null);
                      setShowProfilePictureModal(false);
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all flex items-center justify-center"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary px-12 py-2 rounded-lg font-medium disabled:opacity-50 min-w-[160px] flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-3xl font-bold text-gray-900">{user.username}</h1>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-secondary px-4 py-2 rounded-lg font-medium flex items-center"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </button>
                </div>

                <div className="space-y-3 text-gray-600">
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 mr-3 text-gray-400" />
                    <span>{user.email}</span>
                  </div>
                  
                  {user.location && (
                    <div className="flex items-center">
                      <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                      <span>{user.location}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                    <span>Joined {formatJoinDate(stats.joinDate)}</span>
                  </div>
                  
                  {user.bio && (
                    <div className="mt-4">
                      <p className="text-gray-800 leading-relaxed">{user.bio}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Picture Action Modal */}
      {showProfilePictureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h3>
            <p className="text-gray-600 mb-6">What would you like to do with your profile picture?</p>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  document.getElementById('profilePictureInput').click();
                  setShowProfilePictureModal(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center"
              >
                <Camera className="w-5 h-5 text-blue-600 mr-3" />
                <span>Upload new picture</span>
              </button>
              
              <button
                onClick={handleRemoveProfilePicture}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center"
              >
                <X className="w-5 h-5 text-red-600 mr-3" />
                <span>Remove picture</span>
              </button>
              
              <button
                onClick={() => setShowProfilePictureModal(false)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard 
          icon={BarChart3}
          title="Polls Created"
          value={stats.totalPolls}
          color="bg-blue-600"
        />
        <StatCard 
          icon={Users}
          title="Votes Cast"
          value={stats.totalVotes}
          color="bg-purple-600"
        />
        <StatCard 
          icon={MessageCircle}
          title="Comments"
          value={stats.totalComments}
          color="bg-green-600"
        />
        <StatCard 
          icon={Clock}
          title="Days Active"
          value={Math.floor((new Date() - new Date(stats.joinDate)) / (1000 * 60 * 60 * 24))}
          color="bg-orange-600"
        />
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'created', label: 'Polls Created' },
              { id: 'voted', label: 'Polls Voted On' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Recent Activity Summary */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                {dataLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Latest Created Polls</h4>
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Recently Voted On</h4>
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Latest Created Polls</h4>
                    <div className="space-y-2">
                      {createdPolls.slice(0, 3).map(poll => (
                        <PollPreviewCard key={poll.id} poll={poll} />
                      ))}
                      {createdPolls.length === 0 && (
                        <div className="text-center py-8">
                          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600">No polls created yet</p>
                          <Link to="/create" className="text-blue-600 hover:text-blue-500 font-medium">
                            Create your first poll
                          </Link>
                        </div>
                      )}
                    </div>
                    {createdPolls.length > 3 && (
                      <button
                        onClick={() => setActiveTab('created')}
                        className="mt-3 text-blue-600 hover:text-blue-500 font-medium text-sm"
                      >
                        View all created polls →
                      </button>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Recently Voted On</h4>
                    <div className="space-y-2">
                      {votedPolls.slice(0, 3).map(poll => (
                        <PollPreviewCard key={poll.id} poll={poll} />
                      ))}
                      {votedPolls.length === 0 && (
                        <div className="text-center py-8">
                          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600">No votes cast yet</p>
                          <Link to="/" className="text-blue-600 hover:text-blue-500 font-medium">
                            Explore polls to vote
                          </Link>
                        </div>
                      )}
                    </div>
                    {votedPolls.length > 3 && (
                      <button
                        onClick={() => setActiveTab('voted')}
                        className="mt-3 text-blue-600 hover:text-blue-500 font-medium text-sm"
                      >
                        View all voted polls →
                      </button>
                    )}
                  </div>
                </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'created' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Polls Created ({stats.totalPolls})
                </h3>
                <Link
                  to="/create"
                  className="btn-primary px-4 py-2 rounded-lg font-medium"
                >
                  Create New Poll
                </Link>
              </div>
              
              {createdPolls.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">No polls created yet</h4>
                  <p className="text-gray-600 mb-6">Start engaging with your audience by creating your first poll</p>
                  <Link
                    to="/create"
                    className="btn-primary px-6 py-3 rounded-lg font-medium"
                  >
                    Create Your First Poll
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {createdPolls.map(poll => (
                    <PollCard key={poll.id} poll={poll} />
                  ))}
                </div>
              )}

              {createdPolls.length >= 6 && (
                <div className="text-center mt-8">
                  <Link
                    to="/my-polls"
                    className="btn-secondary px-6 py-3 rounded-lg font-medium"
                  >
                    View All My Polls
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === 'voted' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Polls Voted On
              </h3>
              
              {votedPolls.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">No votes cast yet</h4>
                  <p className="text-gray-600 mb-6">Explore polls and share your opinions</p>
                  <Link
                    to="/"
                    className="btn-primary px-6 py-3 rounded-lg font-medium"
                  >
                    Browse Polls
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {votedPolls.map(poll => (
                    <PollCard key={poll.id} poll={poll} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;