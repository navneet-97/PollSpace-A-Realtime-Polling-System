import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Calendar, Settings, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import PageHeader from './PageHeader';

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

const CreatePoll = ({ socket }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    status: 'active',
    ends_at: '',
    allow_multiple_votes: false,
    show_results: true, // New field for result visibility
    options: [
      { id: '1', text: '' },
      { id: '2', text: '' }
    ]
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
    { value: 'draft', label: 'Draft - Save for later editing' }
  ];

  const generateOptionId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
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
      text: ''
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
    
        if (loading) return;
    
    if (!validateForm()) {
      toast.error('Please fix the form errors before submitting');
      return;
    }

    setLoading(true);

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
            id: option.id,
            text: option.text.trim(),
            votes: 0
          }))
      };

      const response = await api.post('/polls', pollData);
      const newPoll = response.data;

      // Emit real-time update if socket is available (but don't show duplicate toast)
      if (socket) {
        socket.emit('newPoll', newPoll);
      }

      toast.success('Poll created successfully!', {
        description: `"${newPoll.title}" is now live`
      });

      // Navigate to the new poll
      navigate(`/poll/${newPoll.id}`);

    } catch (error) {
      console.error('Error creating poll:', error);
      const message = error.response?.data?.error || 'Failed to create poll';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'general',
      status: 'active',
      ends_at: '',
      allow_multiple_votes: false,
      show_results: true, // Reset to default
      options: [
        { id: generateOptionId(), text: '' },
        { id: generateOptionId(), text: '' }
      ]
    });
    setErrors({});
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <PageHeader
        title="Create New Poll"
        subtitle="Create an engaging poll and start collecting responses"
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
              className="btn-secondary px-4 py-2 rounded-lg font-medium transition-all flex items-center"
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
              Minimum 2 options required. You can add up to 10 options total.
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
              />
              <div>
                <label htmlFor="allow_multiple_votes" className="block text-sm font-medium text-gray-700">
                  Allow multiple votes
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
          <button
            type="button"
            onClick={resetForm}
            className="btn-secondary px-6 py-3 rounded-lg font-medium transition-all flex items-center"
          >
            Reset Form
          </button>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all flex items-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Poll...
                </>
              ) : (
                'Create Poll'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreatePoll;
