import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, X, Calendar, Settings, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import PageHeader from './PageHeader';

// Helper function to format date for datetime-local input
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Format to local timezone for datetime-local input
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const EditPoll = ({ socket }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [poll, setPoll] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    status: 'active',
    ends_at: '',
    allow_multiple_votes: false,
    show_results: true, // New field for result visibility
    options: []
  });

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'technology', label: 'Technology' },
    { value: 'politics', label: 'Politics' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'sports', label: 'Sports' },
    { value: 'business', label: 'Business' },
    { value: 'other', label: 'Other' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active - Visible and accepting votes' },
    { value: 'closed', label: 'Closed - Visible but not accepting votes' },
    { value: 'draft', label: 'Draft - Save for later editing' }
  ];

  // Enhanced smart navigation back function
  const handleBackNavigation = () => {
    const referrer = location.state?.from;
    const lastPage = sessionStorage.getItem('lastVisitedPage');
    
    // Priority order: location state > session storage > default
    if (referrer === '/my-polls') {
      navigate('/my-polls');
    } else if (referrer === '/profile') {
      navigate('/profile');
    } else if (referrer === '/results') {
      navigate('/results');
    } else if (referrer?.startsWith('/poll/')) {
      navigate(referrer);
    } else if (lastPage === '/my-polls') {
      navigate('/my-polls');
    } else if (lastPage === '/profile') {
      navigate('/profile');
    } else if (lastPage === '/results') {
      navigate('/results');
    } else if (referrer) {
      navigate(referrer);
    } else {
      navigate('/');
    }
  };

  const getBackButtonText = () => {
    const referrer = location.state?.from;
    const lastPage = sessionStorage.getItem('lastVisitedPage');
    
    if (referrer === '/my-polls' || lastPage === '/my-polls') {
      return 'Back to My Polls';
    } else if (referrer === '/profile' || lastPage === '/profile') {
      return 'Back to Profile';
    } else if (referrer === '/results' || lastPage === '/results') {
      return 'Back to Poll Results';
    } else if (referrer?.startsWith('/poll/')) {
      return 'Back to Poll';
    }
    return 'Back to Dashboard';
  };

  const generateOptionId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
  };

  useEffect(() => {
    fetchPoll();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPoll = async () => {
    try {
      const response = await api.get(`/polls/${id}`);
      const pollData = response.data;
      
      // Check if user owns this poll
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      if (pollData.creator !== user.id) {
        toast.error('You can only edit your own polls');
        navigate('/my-polls');
        return;
      }

      setPoll(pollData);
      
      // Check if poll is closed and prevent editing
      if (pollData.status === 'closed') {
        toast.error('Cannot edit a closed poll', {
          description: 'Please activate the poll first before editing.'
        });
        navigate('/my-polls');
        return;
      }
      
      setFormData({
        title: pollData.title || '',
        description: pollData.description || '',
        category: pollData.category || 'general',
        status: pollData.status || 'active',
        ends_at: pollData.ends_at ? formatDateForInput(pollData.ends_at) : '',
        allow_multiple_votes: pollData.allow_multiple_votes || false,
        show_results: pollData.show_results !== undefined ? pollData.show_results : true, // Handle existing polls
        options: pollData.options || []
      });
    } catch (error) {
      console.error('Error fetching poll:', error);
      if (error.response?.status === 404) {
        toast.error('Poll not found');
      } else if (error.response?.status === 403 && error.response?.data?.error?.includes('Cannot edit a closed poll')) {
        toast.error('Cannot edit a closed poll', {
          description: 'Please activate the poll first before editing.'
        });
        navigate('/my-polls');
      } else {
        toast.error('Failed to load poll');
      }
      navigate('/my-polls');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear specific field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleOptionChange = (optionId, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map(option =>
        option.id === optionId ? { ...option, text: value } : option
      )
    }));

    // Clear option errors
    if (errors[`option_${optionId}`]) {
      setErrors(prev => ({ ...prev, [`option_${optionId}`]: null }));
    }
  };

  const addOption = () => {
    const newOption = {
      id: generateOptionId(),
      text: '',
      votes: 0
    };
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, newOption]
    }));
  };

  const removeOption = (optionId) => {
    if (formData.options.length <= 2) {
      toast.error('A poll must have at least 2 options');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter(option => option.id !== optionId)
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData.title.trim()) {
      newErrors.title = 'Poll title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters long';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must not exceed 200 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must not exceed 500 characters';
    }

    // Options validation
    const validOptions = formData.options.filter(option => option.text.trim());
    if (validOptions.length < 2) {
      newErrors.options = 'At least 2 options are required';
    }

    // Individual option validation
    formData.options.forEach(option => {
      if (!option.text.trim()) {
        newErrors[`option_${option.id}`] = 'Option text is required';
      } else if (option.text.length > 100) {
        newErrors[`option_${option.id}`] = 'Option text must not exceed 100 characters';
      }
    });

    // Check for duplicate options
    const optionTexts = formData.options.map(option => option.text.trim().toLowerCase());
    const duplicates = optionTexts.filter((text, index) => optionTexts.indexOf(text) !== index);
    if (duplicates.length > 0) {
      newErrors.options = 'All options must be unique';
    }

    // End date validation
    if (formData.ends_at) {
      const endDate = new Date(formData.ends_at);
      const now = new Date();
      if (endDate <= now) {
        newErrors.ends_at = 'End date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the form errors before submitting');
      return;
    }

    setSaving(true);

    try {
      // Prepare poll data
      const pollData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        status: formData.status,
        ends_at: formData.ends_at || null,
        allow_multiple_votes: formData.allow_multiple_votes,
        show_results: formData.show_results, // Include result visibility
        options: formData.options
          .filter(option => option.text.trim())
          .map(option => ({
            ...option,
            text: option.text.trim()
          }))
      };

      await api.put(`/polls/${id}`, pollData);
      
      // Emit real-time update if socket is available
      if (socket) {
        socket.emit('pollUpdated', { ...poll, ...pollData });
      }

      toast.success('Poll updated successfully!', {
        description: `"${pollData.title}" has been updated`
      });
      
      // Navigate back using smart navigation
      handleBackNavigation();
      
    } catch (error) {
      console.error('Error updating poll:', error);
      const message = error.response?.data?.error || 'Failed to update poll';
      if (error.response?.status === 403 && message.includes('Cannot edit a closed poll')) {
        toast.error('Cannot edit a closed poll', {
          description: 'Please activate the poll first before editing.'
        });
      } else {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="flex items-center space-x-4 mb-8">
            <div className="h-8 bg-gray-300 rounded w-32"></div>
          </div>
          <div className="card p-8">
            <div className="space-y-6">
              <div className="h-8 bg-gray-300 rounded w-3/4"></div>
              <div className="h-20 bg-gray-300 rounded"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-gray-300 rounded"></div>
                <div className="h-10 bg-gray-300 rounded"></div>
              </div>
            </div>
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
          <p className="text-red-700 mb-4">The poll you're trying to edit doesn't exist or has been removed.</p>
          <button
            onClick={handleBackNavigation}
            className="btn-primary px-6 py-3 rounded-lg font-medium"
          >
            {getBackButtonText()}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Navigation */}
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={handleBackNavigation}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {getBackButtonText()}
        </button>
      </div>

      <PageHeader
        title="Edit Poll"
        subtitle={`Modify "${poll?.title || 'Loading...'}"`}
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information Section */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Basic Information
          </h2>
          
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="label">
                Poll Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`input ${errors.title ? 'border-red-300 focus:ring-red-500' : ''}`}
                placeholder="What's your question?"
                maxLength={200}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.title}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">{formData.title.length}/200 characters</p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="label">
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className={`input resize-none ${errors.description ? 'border-red-300 focus:ring-red-500' : ''}`}
                placeholder="Provide additional context for your poll (optional)"
                maxLength={500}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.description}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">{formData.description.length}/500 characters</p>
            </div>

            {/* Category and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="category" className="label">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="input"
                >
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="status" className="label">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="input"
                >
                  {statusOptions.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Poll Options Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Poll Options
            </h2>
            <button
              type="button"
              onClick={addOption}
              className="btn-secondary px-4 py-2 rounded-lg font-medium transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Option
            </button>
          </div>

          <div className="space-y-4">
            {formData.options.map((option, index) => (
              <div key={option.id} className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-medium text-gray-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => handleOptionChange(option.id, e.target.value)}
                    className={`input ${errors[`option_${option.id}`] ? 'border-red-300 focus:ring-red-500' : ''}`}
                    placeholder={`Option ${index + 1}`}
                    maxLength={100}
                  />
                  {errors[`option_${option.id}`] && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors[`option_${option.id}`]}
                    </p>
                  )}
                  {poll?.total_votes > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Current votes: {option.votes || 0}
                    </p>
                  )}
                </div>
                {formData.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(option.id)}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove option"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}

            {errors.options && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.options}
              </p>
            )}

            <p className="text-sm text-gray-500">
              Minimum 2 options required. {poll?.total_votes > 0 && 'Note: Vote counts will be preserved when editing options.'}
            </p>
          </div>
        </div>

        {/* Advanced Settings Section */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Advanced Settings
          </h2>

          <div className="space-y-6">
            {/* End Date */}
            <div>
              <label htmlFor="ends_at" className="label">
                End Date (Optional)
              </label>
              <input
                type="datetime-local"
                id="ends_at"
                name="ends_at"
                value={formData.ends_at}
                onChange={handleInputChange}
                className={`input ${errors.ends_at ? 'border-red-300 focus:ring-red-500' : ''}`}
                min={formatDateForInput(new Date())}
              />
              {errors.ends_at && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.ends_at}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Leave empty for polls that never expire
              </p>
            </div>

            {/* Multiple Votes */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="allow_multiple_votes"
                name="allow_multiple_votes"
                checked={formData.allow_multiple_votes}
                onChange={handleInputChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={poll?.total_votes > 0}
              />
              <div>
                <label htmlFor="allow_multiple_votes" className="block text-sm font-medium text-gray-700">
                  Allow multiple votes
                  {poll?.total_votes > 0 && (
                    <span className="text-gray-500 text-xs block mt-1">
                      Cannot be changed after votes are cast ({poll.total_votes} votes)
                    </span>
                  )}
                </label>
                <p className="text-sm text-gray-500">
                  Allow users to select multiple options in this poll
                </p>
              </div>
            </div>

            {/* Show Results */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="show_results"
                name="show_results"
                checked={formData.show_results}
                onChange={handleInputChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <label htmlFor="show_results" className="block text-sm font-medium text-gray-700">
                  Public results
                </label>
                <p className="text-sm text-gray-500">
                  Allow anyone to view the poll results. When disabled, only you can see the results.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-6">
          <div>
            {poll?.total_votes > 0 && (
              <p className="text-sm text-amber-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                This poll has {poll.total_votes} votes. Some options may be restricted.
              </p>
            )}
          </div>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleBackNavigation}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating Poll...
                </div>
              ) : (
                'Update Poll'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditPoll;