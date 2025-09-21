import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  Clock, 
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Share2,
  Download,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import PageHeader from './PageHeader';

const PollResults = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  const fetchPollResults = useCallback(async () => {
    try {
      const response = await api.get(`/polls/${id}`);
      const pollData = response.data;
      
      // Check if results are public or if user is the creator
      if (!pollData.show_results && pollData.creator !== user.id) {
        setError('Results are private for this poll');
        return;
      }
      
      setPoll(pollData);
    } catch (error) {
      console.error('Error fetching poll results:', error);
      if (error.response?.status === 404) {
        setError('Poll not found');
      } else {
        setError('Failed to load poll results');
      }
    } finally {
      setLoading(false);
    }
  }, [id, user.id]);

  useEffect(() => {
    fetchPollResults();
  }, [fetchPollResults]);

  const handleBackNavigation = () => {
    const referrer = location.state?.from;
    
    if (referrer === '/results') {
      // Coming from Poll Results Center page
      navigate('/results');
    } else if (referrer) {
      // Coming from another specific page (e.g., poll view, dashboard)
      navigate(referrer);
    } else {
      // Default fallback - go to the poll itself
      navigate(`/poll/${id}`);
    }
  };

  const getBackButtonText = () => {
    const referrer = location.state?.from;
    
    if (referrer === '/results') {
      return 'Back to Poll Results';
    } else if (referrer?.startsWith('/poll/')) {
      return 'Back to Poll';
    } else if (referrer === '/') {
      return 'Back to Dashboard';
    } else if (referrer === '/my-polls') {
      return 'Back to My Polls';
    } else {
      return 'Back to Poll';
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      active: {
        icon: CheckCircle,
        label: 'Active',
        color: 'bg-green-100 text-green-700 border-green-200',
        description: 'Currently accepting votes'
      },
      closed: {
        icon: XCircle,
        label: 'Closed',
        color: 'bg-red-100 text-red-700 border-red-200',
        description: 'No longer accepting votes'
      },
      draft: {
        icon: Eye,
        label: 'Draft',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        description: 'Not yet published'
      }
    };
    return statusMap[status] || statusMap.active;
  };

  const calculatePercentage = (votes, total) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };



  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const shareResults = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Poll Results: ${poll.title}`,
          text: `Check out the results for "${poll.title}"`,
          url: url
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Results link copied to clipboard!');
    }
  };

  const exportResults = () => {
    // Export as HTML
    if (!poll) return;
    
    try {
      // Generate HTML report
      const html = generateHTMLReport(poll);
      
      // Create and download file
      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `poll-results-${poll.id}-${new Date().toISOString().slice(0, 10)}.html`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Poll results exported as HTML!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export poll results. Please try again.');
    }
  };

  // Generate pie chart SVG with percentages on segments
  const generatePieChartSVG = (options) => {
    if (options.length === 0) return '';
    
    const total = options.reduce((sum, option) => sum + option.votes, 0);
    
    // Handle case where there are no votes at all
    if (total === 0) {
      return `
        <svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
          <circle cx="150" cy="150" r="120" fill="#e5e7eb" stroke="#ffffff" stroke-width="2"/>
          <text x="150" y="150" text-anchor="middle" dominant-baseline="central" 
                font-family="Arial, sans-serif" font-size="16" fill="#6b7280" font-weight="bold">No votes</text>
          <!-- Center circle for donut effect -->
          <circle cx="150" cy="150" r="50" fill="#ffffff"/>
        </svg>
      `;
    }
    
    const colors = [
      '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', 
      '#ef4444', '#ec4899', '#6366f1', '#06b6d4'
    ];
    
    let cumulativeAngle = 0;
    let paths = '';
    let labels = '';
    
    // Calculate angles for each segment
    const segments = options.map((option, index) => {
      const percentage = (option.votes / total) * 100;
      // For 0 votes, we still create a minimal segment for visibility
      const angle = option.votes === 0 ? 1 : (option.votes / total) * 360;
      return { option, index, percentage, angle };
    });
    
    // Adjust angles so they sum to 360 degrees
    const totalAngle = segments.reduce((sum, segment) => sum + segment.angle, 0);
    const adjustedSegments = segments.map(segment => ({
      ...segment,
      adjustedAngle: (segment.angle / totalAngle) * 360
    }));
    
    // Generate paths and labels
    adjustedSegments.forEach(segment => {
      const { index, percentage, adjustedAngle } = segment;
      
      const startAngle = cumulativeAngle;
      const endAngle = startAngle + adjustedAngle;
      
      // Convert angles to radians
      const startRad = (startAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      
      // Calculate coordinates
      const centerX = 150;
      const centerY = 150;
      const radius = 120;
      
      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);
      
      // Large arc flag (1 if angle > 180 degrees)
      const largeArcFlag = adjustedAngle > 180 ? 1 : 0;
      
      // Create path
      const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
      
      // Add path with clean styling
      paths += `<path d="${path}" fill="${colors[index % colors.length]}" stroke="#ffffff" stroke-width="2"/>`;
      
      // Add percentage label if segment is large enough or if it's the only option with votes
      const significantSegments = adjustedSegments.filter(s => s.percentage > 0);
      if (percentage > 3 || (percentage > 0 && significantSegments.length === 1)) {
        // Calculate midpoint angle for label placement
        const midAngle = startAngle + (adjustedAngle / 2);
        const labelRad = (midAngle - 90) * Math.PI / 180;
        // Place label at 60% of the radius to position it within the segment
        const labelRadius = radius * 0.6;
        const labelX = centerX + labelRadius * Math.cos(labelRad);
        const labelY = centerY + labelRadius * Math.sin(labelRad);
        
        labels += `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" 
                  font-family="Arial, sans-serif" font-size="16" fill="white" font-weight="bold">${Math.round(percentage)}%</text>`;
      }
      
      cumulativeAngle = endAngle;
    });
    
    return `
      <svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
        ${paths}
        ${labels}
        <!-- Center circle for donut effect -->
        <circle cx="150" cy="150" r="50" fill="#ffffff"/>
      </svg>
    `;
  };



  // Generate HTML report with charts
  const generateHTMLReport = (poll) => {
    // Sort options by votes (descending)
    const sortedOptions = [...poll.options].sort((a, b) => b.votes - a.votes);
    
    // Generate charts
    const pieChartSVG = generateChartForExport('pie');
    
    // Generate options list for HTML report
    const generateOptionsListHTML = (options) => {
      const total = options.reduce((sum, _option) => sum + _option.votes, 0);
      const colors = [
        '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', 
        '#ef4444', '#ec4899', '#6366f1', '#06b6d4'
      ];
      
      return `
        <div style="width: 100%;">
          ${options.map((_option, index) => {
            const percentage = total > 0 ? Math.round((_option.votes / total) * 100) : 0;
            return `
              <div style="display: flex; align-items: center; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; background-color: #fafafa;">
                <div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${colors[index % colors.length]}; margin-right: 12px;"></div>
                <div style="flex: 1; font-family: Arial, sans-serif; font-size: 14px; font-weight: 500; color: #111827;">
                  ${_option.text}
                </div>
                <div style="font-family: Arial, sans-serif; font-size: 14px; color: #6b7280; margin-right: 12px;">
                  ${_option.votes} votes
                </div>
                <div style="font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; color: #111827;">
                  ${percentage}%
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    };
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Poll Results - ${poll.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
            background-color: #f9fafb;
            color: #1f2937;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e5e7eb;
        }
        .title {
            font-size: 2.2rem;
            font-weight: 700;
            color: #111827;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #6b7280;
            font-size: 1.1rem;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
            padding: 20px;
            background-color: #f9fafb;
            border-radius: 10px;
        }
        .info-item {
            text-align: center;
        }
        .info-label {
            font-weight: 600;
            color: #374151;
            margin-bottom: 5px;
            font-size: 0.9rem;
        }
        .info-value {
            font-size: 1.4rem;
            font-weight: 700;
            color: #3b82f6;
        }
        .charts-section {
            margin-bottom: 40px;
        }
        .section-title {
            font-size: 1.4rem;
            font-weight: 700;
            margin-bottom: 20px;
            color: #111827;
        }
        .chart-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            border: 1px solid #e5e7eb;
        }
        .chart-title {
            font-weight: 600;
            margin-bottom: 20px;
            color: #111827;
            font-size: 1.1rem;
        }
        .chart-content {
            display: flex;
            flex-direction: column;
        }
        .chart-row {
            display: flex;
            flex-wrap: wrap;
            gap: 30px;
        }
        .options-list {
            flex: 1;
            min-width: 250px;
        }
        .pie-chart-container {
            flex: 1;
            min-width: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        @media (max-width: 768px) {
            .chart-row {
                flex-direction: column;
            }
            .pie-chart-container {
                order: -1;
            }
        }
        .results-section {
            margin-bottom: 40px;
        }
        .option {
            margin-bottom: 20px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #fafafa;
        }
        .option-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 10px;
        }
        .option-text {
            font-weight: 600;
            color: #111827;
            flex: 1;
        }
        .option-votes {
            color: #6b7280;
            font-weight: 500;
            margin-left: 20px;
        }
        .option-percentage {
            color: #111827;
            font-weight: 600;
            margin-left: 20px;
        }
        .progress-bar {
            width: 100%;
            height: 12px;
            background-color: #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
            transition: width 0.3s ease;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 0.9rem;
        }
        @media print {
            body { padding: 20px; }
            .container { box-shadow: none; }
        }
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${poll.title}</h1>
            <p class="subtitle">${poll.description || 'Poll Results Report'}</p>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Total Votes</div>
                <div class="info-value">${poll.total_votes}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">${poll.status.toUpperCase()}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Options</div>
                <div class="info-value">${poll.options.length}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Created</div>
                <div class="info-value" style="font-size: 1rem;">${new Date(poll.createdAt).toLocaleDateString()}</div>
            </div>
        </div>
        
        <div class="charts-section">
            <h2 class="section-title">Visual Results</h2>
            <div class="chart-card">
                <div class="chart-title">Vote Distribution</div>
                <div class="chart-content">
                    <div class="chart-row">
                        <div class="options-list">
                            ${generateOptionsListHTML(sortedOptions)}
                        </div>
                        <div class="pie-chart-container">
                            <div>${pieChartSVG}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="results-section">
            <h2 class="section-title">Detailed Results</h2>
            ${sortedOptions
              .map(option => {
                const percentage = poll.total_votes === 0 ? 0 : Math.round((option.votes / poll.total_votes) * 100);
                return `
                <div class="option">
                    <div class="option-header">
                        <span class="option-text">${option.text}</span>
                        <span class="option-votes">${option.votes} votes</span>
                        <span class="option-percentage">${percentage}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%;"></div>
                    </div>
                </div>`;
              }).join('')}
        </div>
        
        <div class="footer">
            <p>Report generated on ${new Date().toLocaleString()}</p>
            <p>Exported from PollSpace</p>
        </div>
    </div>
</body>
</html>`;
    
    return html;
  };

  // Function to download charts as SVG
  /*
  const downloadChart = (chartType) => {
    if (!poll) return;
    
    try {
      const sortedOptions = [...poll.options].sort((a, b) => b.votes - a.votes);
      let svgContent = '';
      
      if (chartType === 'pie') {
        svgContent = generatePieChartSVG(sortedOptions);
      }
      
      // Create and download file (used for HTML export)
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `poll-${chartType}-chart-${poll.id}-${new Date().toISOString().slice(0, 10)}.svg`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Chart download error:', error);
    }
  };
  */

  // Function to generate chart SVG for HTML export (no download functionality)
  const generateChartForExport = (chartType) => {
    if (!poll) return '';
    
    try {
      const sortedOptions = [...poll.options].sort((a, b) => b.votes - a.votes);
      
      if (chartType === 'pie') {
        return generatePieChartSVG(sortedOptions);
      }
      
      return '';
    } catch (error) {
      console.error('Chart generation error:', error);
      return '';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center space-x-4">
            <div className="h-8 bg-gray-300 rounded w-32"></div>
          </div>
          <div className="h-12 bg-gray-300 rounded w-3/4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 border">
                <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-gray-300 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 rounded-lg p-8 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-900 mb-2">Unable to Load Results</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={handleBackNavigation}
            className="btn-primary px-6 py-3 rounded-lg font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!poll) return null;

  const statusInfo = getStatusInfo(poll.status);
  const StatusIcon = statusInfo.icon;

  return (
    <>
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

      {/* Header */}
      <PageHeader
        title="Poll Results"
        subtitle={poll.title}
        actions={(
          <div className="flex space-x-3">
            <button
              onClick={shareResults}
              className="btn-secondary px-4 py-2 rounded-lg font-medium flex items-center"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </button>
            <button
              onClick={exportResults}
              className="btn-secondary px-4 py-2 rounded-lg font-medium flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        )}
      />

      {/* Poll Information */}
      <div className="card mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-3">
              <div className={`flex items-center px-3 py-1 rounded-lg border ${statusInfo.color}`}>
                <StatusIcon className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">{statusInfo.label}</span>
              </div>
              {poll.show_results ? (
                <div className="flex items-center px-3 py-1 rounded-lg bg-blue-100 text-blue-700 border border-blue-200">
                  <Eye className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Public Results</span>
                </div>
              ) : (
                <div className="flex items-center px-3 py-1 rounded-lg bg-gray-100 text-gray-700 border border-gray-200">
                  <EyeOff className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Private Results</span>
                </div>
              )}
            </div>
            
            {poll.description && (
              <p className="text-gray-600 mb-4">{poll.description}</p>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center text-gray-600">
                <Users className="w-4 h-4 mr-2" />
                <span>{poll.total_votes} votes</span>
              </div>
              <div className="flex items-center text-gray-600">
                <span>{poll.options.length} options</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="w-4 h-4 mr-2" />
                <span>Created {formatDate(poll.createdAt)}</span>
              </div>
              {poll.ends_at && (
                <div className="flex items-center text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Ends {formatDate(poll.ends_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-500">{statusInfo.description}</p>
      </div>

      {/* Charts Section */}
      {poll.total_votes > 0 && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Visual Results
          </h2>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vote Distribution</h3>
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Options List */}
              <div className="flex-1">
                <div className="space-y-3">
                  {poll.options
                    .sort((a, b) => b.votes - a.votes)
                    .map((option, index) => {
                      const percentage = poll.total_votes > 0 
                        ? Math.round((option.votes / poll.total_votes) * 100) 
                        : 0;
                      const colors = [
                        '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', 
                        '#ef4444', '#ec4899', '#6366f1', '#06b6d4'
                      ];
                      
                      return (
                        <div key={option.id} className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <div 
                            className="w-4 h-4 rounded-full mr-3 flex-shrink-0" 
                            style={{ backgroundColor: colors[index % colors.length] }}
                          ></div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {option.text}
                            </p>
                          </div>
                          <div className="text-sm text-gray-500 ml-2 whitespace-nowrap">
                            {option.votes} votes
                          </div>
                          <div className="text-sm font-medium text-gray-900 ml-2 whitespace-nowrap">
                            {percentage}%
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              
              {/* Pie Chart */}
              <div className="flex-1 flex items-center justify-center">
                <div className="relative">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: generatePieChartSVG([...poll.options].sort((a, b) => b.votes - a.votes)) 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Voting Results
        </h2>

        {poll.total_votes === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No votes yet</h3>
            <p className="text-gray-600">Be the first to cast your vote!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {poll.options
              .sort((a, b) => b.votes - a.votes) // Sort by votes descending
              .map((option, index) => {
                const percentage = calculatePercentage(option.votes, poll.total_votes);
                
                return (
                  <div key={option.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{option.text}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span>{option.votes} votes</span>
                          <span>{percentage}% of total</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{percentage}%</div>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all duration-1000 bg-blue-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Additional Statistics */}
      {poll.total_votes > 0 && (
        <div className="card mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{poll.total_votes}</div>
              <div className="text-sm text-gray-600">Total Votes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.max(...poll.options.map(o => o.votes))}
              </div>
              <div className="text-sm text-gray-600">Highest Votes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(poll.total_votes / poll.options.length)}
              </div>
              <div className="text-sm text-gray-600">Average per Option</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {poll.options.length}
              </div>
              <div className="text-sm text-gray-600">Total Options</div>
            </div>
          </div>
        </div>
      )}
    </div>
  </>
  );
};

export default PollResults;