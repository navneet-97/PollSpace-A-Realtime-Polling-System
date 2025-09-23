const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }
});


// Middleware
// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman) or from allowlist
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept', 
    'Cache-Control',
    'X-Requested-With',
    'Accept-Encoding',
    'Accept-Language',
    'Connection',
    'Host',
    'Origin',
    'Referer',
    'User-Agent'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 600,
};

// Apply CORS before rate limiting so even 429 responses include CORS headers
app.use(cors(corsOptions));
// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Enhanced rate limiting with intelligent user-based limits and request classification
const createRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      // Dynamic limits based on user authentication and request type
      const isAuthenticated = req.headers['authorization'];
      const isReadOperation = ['GET', 'HEAD'].includes(req.method);
      const isHealthCheck = req.url === '/api/health';
      
      // Health checks get unlimited requests
      if (isHealthCheck) return 10000;
      
      // Authenticated users get higher limits
      if (isAuthenticated) {
        return isReadOperation ? 2000 : 1000; // 2000 for reads, 1000 for writes
      }
      
      // Anonymous users get lower limits
      return isReadOperation ? 500 : 200;
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for:
      // - OPTIONS preflight requests
      // - Static file requests
      // - Internal health checks
      return req.method === 'OPTIONS' || 
             req.url.startsWith('/uploads/') ||
             req.url === '/favicon.ico';
    },
    message: (req) => {
      const isAuthenticated = req.headers['authorization'];
      const resetTime = new Date(Date.now() + 15 * 60 * 1000);
      
      return {
        error: 'Rate limit exceeded',
        message: `Too many requests. ${isAuthenticated ? 'Authenticated' : 'Anonymous'} users are limited.`,
        retryAfter: 15 * 60, // seconds
        resetTime: resetTime.toISOString(),
        suggestion: isAuthenticated ? 
          'Try reducing request frequency or use batch operations.' :
          'Consider logging in for higher rate limits.'
      };
    },
    // Enhanced key generation with user identification
    keyGenerator: (req) => {
      const authHeader = req.headers['authorization'];
      
      if (authHeader) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          return `user_${decoded.id}_${req.ip}`; // User + IP combo for security
        } catch (error) {
          // Invalid token, fall back to IP with marker
          return `invalid_token_${req.ip}`;
        }
      }
      
      return `anon_${req.ip}`;
    },
    // Custom handler replaces both onLimitReached and handler in v7+
    handler: (req, res) => {
      const isAuthenticated = req.headers['authorization'];
      
      // Simple rate limit logging
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Rate limit exceeded: ${req.method} ${req.url}`);
      }
      
      // Send rate limit response
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests from ${isAuthenticated ? 'your account' : 'this IP address'}`,
        retryAfter: 15 * 60,
        resetTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
    }
  });
};

app.use(createRateLimiter());

// More permissive JSON parsing middleware
app.use(express.json({ 
  limit: '50mb',
  strict: false, // Allow non-object/array JSON values
  verify: (req, res, buf, encoding) => {
    // Only verify if there's content
    if (buf.length > 0) {
      try {
        JSON.parse(buf);
      } catch (e) {
        // Log the invalid JSON for debugging
        console.warn('Invalid JSON received:', buf.toString());
        const error = new Error('Invalid JSON format');
        error.status = 400;
        throw error;
      }
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enhanced error handling middleware
const errorHandler = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.id || Math.random().toString(36).substr(2, 9);
  
  // Log error with context
  console.error(`❌ Error [${requestId}] ${timestamp}:`, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id || 'anonymous'
  });
  
  // Categorize errors
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = 'INTERNAL_ERROR';
  
  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_ERROR';
    message = 'Duplicate entry';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON format';
  }
  
  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && status >= 500) {
    message = 'Internal server error occurred';
  }
  
  const errorResponse = {
    error: message,
    code: code,
    status: status,
    timestamp: timestamp,
    requestId: requestId
  };
  
  // Add error details for development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details || {};
  }
  
  res.status(status).json(errorResponse);
};

// Request logging and ID middleware
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9);
  req.startTime = Date.now();
  
  // Simple request logging
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${req.method} ${req.url}`);
  }
  
  next();
});

// Request timeout middleware
app.use((req, res, next) => {
  const timeout = 30000; // 30 seconds
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      console.warn(`⏰ Request timeout [${req.id}] ${req.method} ${req.url}`);
      res.status(408).json({
        error: 'Request timeout',
        code: 'TIMEOUT',
        message: 'Request took too long to process'
      });
    }
  }, timeout);
  
  // Clear timeout when response is sent
  const originalEnd = res.end;
  res.end = function(...args) {
    clearTimeout(timer);
    originalEnd.apply(this, args);
  };
  
  next();
});

// MongoDB connection
const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/pollspace';

mongoose.connect(mongoUrl)
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Gemini AI setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Static files for profile pictures
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// User Schema
const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  profile_picture: { type: String, default: '' },
  polls_created: [{ type: String, ref: 'Poll' }],
  polls_voted: [{ type: String, ref: 'Poll' }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Poll Schema
const pollSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  options: [{
    id: { type: String, required: true },
    text: { type: String, required: true },
    votes: { type: Number, default: 0 }
  }],
  status: { type: String, enum: ['active', 'closed', 'draft'], default: 'active' },
  ends_at: { type: Date, default: null },
  allow_multiple_votes: { type: Boolean, default: false },
  show_results: { type: Boolean, default: true }, // New field for result visibility
  total_votes: { type: Number, default: 0 },
  category: { type: String, enum: ['general', 'technology', 'politics', 'entertainment', 'sports', 'business', 'other'], default: 'general' },
  comments_count: { type: Number, default: 0 },
  manual_status_override: { type: Boolean, default: false }, // Flag to prevent auto-closure after manual reopen
  creator: { type: String, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const Poll = mongoose.model('Poll', pollSchema);

// Vote Schema
const voteSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  poll_id: { type: String, ref: 'Poll', required: true },
  option_id: { type: String, required: true },
  voter_email: { type: String, required: true },
  user: { type: String, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const Vote = mongoose.model('Vote', voteSchema);

// Comment Schema - Add liked_by array to track users who liked
const commentSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  poll_id: { type: String, ref: 'Poll', required: true },
  content: { type: String, required: true },
  parent_comment_id: { type: String, ref: 'Comment', default: null },
  author_email: { type: String, required: true },
  author_username: { type: String, required: true }, // Add username field
  likes: { type: Number, default: 0 },
  liked_by: [{ type: String, ref: 'User' }], // Track who liked this comment
  user: { type: String, ref: 'User', required: true },
  replies: [{ type: String, ref: 'Comment' }],
  createdAt: { type: Date, default: Date.now }
});

const Comment = mongoose.model('Comment', commentSchema);

// Notification Schema
const notificationSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  userId: { type: String, ref: 'User', required: true },
  type: { type: String, enum: ['vote', 'comment', 'reply', 'comment_like', 'poll_created', 'poll_closed', 'system'], required: true },
  message: { type: String, required: true },
  data: {
    pollId: { type: String, ref: 'Poll', default: null },
    commentId: { type: String, ref: 'Comment', default: null },
    voterName: { type: String, default: '' },
    commenterName: { type: String, default: '' },
    replierName: { type: String, default: '' },
    likerName: { type: String, default: '' },
    pollTitle: { type: String, default: '' }
  },
  isRead: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

// Chat Message Schema (for chatbot)
const chatMessageSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  user: { type: String, ref: 'User', required: true },
  message: { type: String, required: true },
  response: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// Helper function to create a detailed chat response about poll results export
const createExportResponse = () => {
  return `The PollSpace application supports exporting poll results as HTML reports. Here's how to use this feature:

1. Navigate to the Poll Results page for the poll you want to export
2. Click the "Export" button in the top right corner of the page
3. The system will generate a comprehensive HTML report containing:
   - Poll title and description
   - Total votes and participation statistics
   - Visual representation of results with pie charts
   - Detailed breakdown of each option's performance
   - Timestamp showing when the report was generated

The exported HTML file can be opened in any web browser and shared with others. You can also right-click on the chart to save it as an image.

Note: This feature is available for all active and closed polls. For draft polls, you'll need to publish them first before exporting results. PollSpace currently only supports HTML export format.`;
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};



// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Helper function to generate unique IDs
const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// Routes

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      id: generateId(),
      username,
      email,
      password: hashedPassword
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profile_picture: user.profile_picture || '',
        profilePicture: user.profile_picture || ''
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profile_picture: user.profile_picture || '',
        profilePicture: user.profile_picture || ''
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Profile Routes
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      profile_picture: user.profile_picture || '',
      profilePicture: user.profile_picture || '',
      bio: user.bio || '',
      location: user.location || '',
      polls_created: user.polls_created || [],
      polls_voted: user.polls_voted || [],
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { bio, location } = req.body;

    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.bio = bio !== undefined ? bio : user.bio;
    user.location = location !== undefined ? location : user.location;
    await user.save();

res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profile_picture: user.profile_picture || '',
        profilePicture: user.profile_picture || '',
        bio: user.bio,
        location: user.location
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/profile/picture', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete old profile picture if exists
    if (user.profile_picture) {
      try {
        // Extract filename from the profile picture URL - handle both formats
        let filename = '';
        if (user.profile_picture.startsWith('/uploads/')) {
          // If it's already a relative path like /uploads/filename
          filename = user.profile_picture.substring(9); // Remove '/uploads/' prefix (9 characters)
        } else if (user.profile_picture.includes('/uploads/')) {
          // If it's a full URL, extract the filename
          filename = path.basename(user.profile_picture);
        } else {
          // If it's just a filename
          filename = user.profile_picture;
        }
        
        if (filename) {
          const uploadsDir = path.join(__dirname, 'uploads');
          const oldPath = path.join(uploadsDir, filename);
          console.log('Attempting to delete file at path:', oldPath);
          
          if (fs.existsSync(oldPath)) {
            try { 
              fs.unlinkSync(oldPath);
              console.log(`Deleted profile picture: ${oldPath}`);
            } catch (err) {
              console.error(`Error deleting profile picture: ${oldPath}`, err);
            }
          } else {
            console.log('File does not exist at path:', oldPath);
          }
        } else {
          console.log('Could not extract filename from profile_picture:', user.profile_picture);
        }
      } catch (err) {
        console.error('Error processing profile picture removal:', err);
      }
    }

    // Update user profile picture
    user.profile_picture = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({
      message: 'Profile picture updated successfully',
      profile_picture: user.profile_picture,
      profilePicture: user.profile_picture
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Poll Routes
app.get('/api/polls', authenticateToken, async (req, res) => {
  try {
    // This endpoint is for general poll listing (dashboard, profile, etc.)
    // Include all polls that should be visible to users:
    // 1. All active and closed polls (no drafts)
    const polls = await Poll.find({ 
      status: { $in: ['active', 'closed'] }
    }).sort({ createdAt: -1 });
    
    // ALWAYS update comment counts to ensure accuracy across all components
    const pollsWithAccurateComments = await Promise.all(
      polls.map(async (poll) => {
        const actualCommentCount = await Comment.countDocuments({ poll_id: poll.id });
        
        // Force update comment count regardless of current value
        poll.comments_count = actualCommentCount;
        await poll.save();
        
        console.log(`📊 Poll "${poll.title}" - Comment count updated to: ${actualCommentCount}`);
        
        return poll;
      })
    );
    
    res.json(pollsWithAccurateComments);
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Special endpoint for poll results page - excludes private polls from other users
app.get('/api/polls/results', authenticateToken, async (req, res) => {
  try {
    // This endpoint is specifically for the poll results page
    // Show all polls except private polls from other users
    const polls = await Poll.find({ 
      status: { $in: ['active', 'closed'] },
      $or: [
        { show_results: true }, // Show public polls
        { show_results: { $exists: false } }, // Show polls created before this field existed
        { creator: req.user.id } // Always show user's own polls (even private ones)
      ]
    }).sort({ createdAt: -1 });
    
    // ALWAYS update comment counts to ensure accuracy across all components
    const pollsWithAccurateComments = await Promise.all(
      polls.map(async (poll) => {
        const actualCommentCount = await Comment.countDocuments({ poll_id: poll.id });
        
        // Force update comment count regardless of current value
        poll.comments_count = actualCommentCount;
        await poll.save();
        
        console.log(`📊 Poll "${poll.title}" - Comment count updated to: ${actualCommentCount}`);
        
        return poll;
      })
    );
    
    res.json(pollsWithAccurateComments);
  } catch (error) {
    console.error('Get polls for results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Special endpoint for dashboard - includes all polls except drafts
app.get('/api/polls/dashboard', authenticateToken, async (req, res) => {
  try {
    // This endpoint is specifically for the dashboard
    // Show all active and closed polls (including private ones) except drafts
    const polls = await Poll.find({ 
      status: { $in: ['active', 'closed'] }
    }).sort({ createdAt: -1 });
    
    // ALWAYS update comment counts to ensure accuracy across all components
    const pollsWithAccurateComments = await Promise.all(
      polls.map(async (poll) => {
        const actualCommentCount = await Comment.countDocuments({ poll_id: poll.id });
        
        // Force update comment count regardless of current value
        poll.comments_count = actualCommentCount;
        await poll.save();
        
        console.log(`📊 Poll "${poll.title}" - Comment count updated to: ${actualCommentCount}`);
        
        return poll;
      })
    );
    
    res.json(pollsWithAccurateComments);
  } catch (error) {
    console.error('Get polls for dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Place specific routes before parameterized :id route to avoid conflicts
app.get('/api/polls/my-polls', authenticateToken, async (req, res) => {
  try {
    const polls = await Poll.find({ creator: req.user.id }).sort({ createdAt: -1 });
    
    // ALWAYS update comment counts to ensure accuracy
    const pollsWithAccurateComments = await Promise.all(
      polls.map(async (poll) => {
        const actualCommentCount = await Comment.countDocuments({ poll_id: poll.id });
        
        // Force update comment count regardless of current value
        poll.comments_count = actualCommentCount;
        await poll.save();
        
        console.log(`📊 My Poll "${poll.title}" - Comment count updated to: ${actualCommentCount}`);
        
        return poll;
      })
    );
    
    res.json(pollsWithAccurateComments);
  } catch (error) {
    console.error('Get user polls error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/polls/voted', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const polls = await Poll.find({ id: { $in: (user.polls_voted || []) } }).sort({ createdAt: -1 });
    
    // ALWAYS update comment counts to ensure accuracy
    const pollsWithAccurateComments = await Promise.all(
      polls.map(async (poll) => {
        const actualCommentCount = await Comment.countDocuments({ poll_id: poll.id });
        
        // Force update comment count regardless of current value
        poll.comments_count = actualCommentCount;
        await poll.save();
        
        console.log(`📊 Voted Poll "${poll.title}" - Comment count updated to: ${actualCommentCount}`);
        
        return poll;
      })
    );
    
    res.json(pollsWithAccurateComments);
  } catch (error) {
    console.error('Get voted polls error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/polls/:id', async (req, res) => {
  try {
    const poll = await Poll.findOne({ id: req.params.id });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Security check: For draft polls, only allow access to the creator
    if (poll.status === 'draft') {
      // Check if user is authenticated
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.id !== poll.creator) {
          return res.status(404).json({ error: 'Poll not found' });
        }
      } catch (error) {
        return res.status(404).json({ error: 'Poll not found' });
      }
    }

    // ALWAYS sync comment count for this specific poll
    const actualCommentCount = await Comment.countDocuments({ poll_id: poll.id });
    poll.comments_count = actualCommentCount;
    await poll.save();
    
    console.log(`📊 Single Poll "${poll.title}" - Comment count updated to: ${actualCommentCount}`);

    res.json(poll);
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/polls', authenticateToken, async (req, res) => {
  try {
    const { title, description, options, category, status, ends_at, allow_multiple_votes } = req.body;

    if (!title || !options || options.length < 2) {
      return res.status(400).json({ error: 'Title and at least 2 options are required' });
    }

    // Normalize options (accept array of strings or array of objects)
    const normalizedOptions = (Array.isArray(options) ? options : []).map((opt) => {
      if (typeof opt === 'string') {
        return { id: generateId(), text: opt, votes: 0 };
      }
      if (opt && typeof opt === 'object') {
        return {
          id: opt.id || generateId(),
          text: String(opt.text || ''),
          votes: Number(opt.votes || 0)
        };
      }
      return null;
    }).filter(Boolean);

    if (normalizedOptions.length < 2 || normalizedOptions.some(o => !o.text || !o.text.trim())) {
      return res.status(400).json({ error: 'Provide at least 2 valid options with non-empty text' });
    }

    const poll = new Poll({
      id: generateId(),
      title,
      description: description || '',
      options: normalizedOptions,
      category: category || 'general',
      status: ['active', 'closed', 'draft'].includes(status) ? status : 'active',
      ends_at: ends_at ? new Date(ends_at) : null,
      allow_multiple_votes: !!allow_multiple_votes,
      total_votes: 0,
      comments_count: 0,
      manual_status_override: false, // Initialize override flag
      creator: req.user.id
    });

    await poll.save();

    // Add poll to user's created polls
    await User.findOneAndUpdate(
      { id: req.user.id },
      { $push: { polls_created: poll.id } },
      { new: true }
    );

    // Create notification for poll creator
    await createNotification('poll_created', {
      pollTitle: poll.title,
      pollId: poll.id
    }, req.user.id);

    // Only emit new poll to all connected clients if it's not a draft
    // Draft polls should only be visible to their creators
    if (poll.status !== 'draft') {
      io.emit('newPoll', poll);
    }

    res.status(201).json(poll);
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Poll management routes
app.patch('/api/polls/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'closed', 'draft'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const poll = await Poll.findOne({ id: req.params.id });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Only allow reopening if the user is the poll creator
    if (poll.creator !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Set manual override flag to true when manually changing status
    if (status === 'active' && poll.status === 'closed') {
      // User is manually reopening a closed poll
      poll.manual_status_override = true;
      // Always clear end date when reactivating a poll
      poll.ends_at = null;
      console.log(`🔄 Reopening poll "${poll.title}" - End date cleared, manual override enabled`);
    } else if (status === 'closed') {
      // User is manually closing poll - set override flag to true
      poll.manual_status_override = true;
      // Clear the end date when poll is manually closed
      poll.ends_at = null;
      console.log(`🔒 Manually closing poll "${poll.title}" - Manual override enabled`);
    }

    poll.status = status;
    await poll.save();

    if (status === 'closed') {
      await createNotification('poll_closed', { pollTitle: poll.title, pollId: poll.id }, req.user.id);
    }

    // Only emit updates for non-draft polls to prevent leaking draft polls to other users
    if (poll.status !== 'draft') {
      io.to(`poll_${poll.id}`).emit('pollUpdate', poll);
      io.emit('pollUpdate', poll);
    }

    res.json({ message: 'Poll updated', poll });
  } catch (error) {
    console.error('Update poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Full poll update route (for editing)
app.put('/api/polls/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, options, category, status, ends_at, allow_multiple_votes, show_results } = req.body;

    if (!title || !options || options.length < 2) {
      return res.status(400).json({ error: 'Title and at least 2 options are required' });
    }

    const poll = await Poll.findOne({ id: req.params.id });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.creator !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Prevent editing closed polls - user must activate first
    if (poll.status === 'closed') {
      return res.status(403).json({ error: 'Cannot edit a closed poll. Please activate the poll first.' });
    }

    // Normalize options (preserve existing votes)
    const normalizedOptions = options.map((opt) => {
      if (typeof opt === 'string') {
        return { id: generateId(), text: opt, votes: 0 };
      }
      if (opt && typeof opt === 'object') {
        return {
          id: opt.id || generateId(),
          text: String(opt.text || ''),
          votes: Number(opt.votes || 0)
        };
      }
      return null;
    }).filter(Boolean);

    if (normalizedOptions.length < 2 || normalizedOptions.some(o => !o.text || !o.text.trim())) {
      return res.status(400).json({ error: 'Provide at least 2 valid options with non-empty text' });
    }

    // Update poll fields
    poll.title = title;
    poll.description = description || '';
    poll.category = category || 'general';
    poll.status = ['active', 'closed', 'draft'].includes(status) ? status : 'active';
    poll.ends_at = ends_at ? new Date(ends_at) : null;
    
    // Automatically reactivate poll ONLY if it was closed automatically (not manually)
    // This happens when:
    // 1. The poll currently has a 'closed' status
    // 2. The poll has manual_status_override = false (meaning it was automatically closed)
    // 3. A new end date is provided that is in the future
    if (ends_at && poll.status === 'closed' && !poll.manual_status_override) {
      const newEndDate = new Date(ends_at);
      const now = new Date();
      // Check if the poll was automatically closed (ends_at was in the past) and new end date is in future
      if (poll.ends_at && new Date(poll.ends_at) <= now && newEndDate > now) {
        poll.status = 'active';
        // Set manual_status_override to true since it's now being manually managed
        poll.manual_status_override = true;
        console.log(`🔄 Reactivating automatically closed poll "${poll.title}" - New end date: ${newEndDate.toISOString()}`);
      }
    }
    
    // Only allow changing multiple votes if no votes have been cast
    if (poll.total_votes === 0) {
      poll.allow_multiple_votes = !!allow_multiple_votes;
    }
    
    // Update show_results field
    poll.show_results = show_results !== undefined ? !!show_results : poll.show_results;
    
    poll.options = normalizedOptions;
    await poll.save();

    // Only emit real-time updates for non-draft polls to prevent leaking draft polls to other users
    if (poll.status !== 'draft') {
      io.to(`poll_${poll.id}`).emit('pollUpdate', poll);
      io.emit('pollUpdate', poll);
    }

    res.json({ message: 'Poll updated successfully', poll });
  } catch (error) {
    console.error('Update poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/polls/:id', authenticateToken, async (req, res) => {
  try {
    const poll = await Poll.findOne({ id: req.params.id });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.creator !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Vote.deleteMany({ poll_id: poll.id });
    await Comment.deleteMany({ poll_id: poll.id });
    await Poll.deleteOne({ id: poll.id });

    await User.findOneAndUpdate(
      { id: req.user.id },
      { $pull: { polls_created: poll.id } }
    );

    res.json({ message: 'Poll deleted successfully' });
  } catch (error) {
    console.error('Delete poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Vote Routes
app.post('/api/polls/:id/vote', authenticateToken, async (req, res) => {
  try {
    const { option_id } = req.body;
    const pollId = req.params.id;

    if (!option_id) {
      return res.status(400).json({ error: 'Option ID is required' });
    }

    // Check if poll exists
    const poll = await Poll.findOne({ id: pollId });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Security check: Only allow voting on active polls
    if (poll.status !== 'active') {
      if (poll.status === 'draft') {
        return res.status(403).json({ error: 'Cannot vote on draft polls' });
      }
      if (poll.status === 'closed') {
        return res.status(403).json({ error: 'This poll has been closed' });
      }
      return res.status(403).json({ error: 'Voting is not allowed on this poll' });
    }

    // Check if user has already voted on this poll (unless multiple votes allowed)
    if (!poll.allow_multiple_votes) {
      const existingVote = await Vote.findOne({
        user: req.user.id,
        poll_id: pollId
      });

      if (existingVote) {
        return res.status(400).json({ error: 'You have already voted on this poll' });
      }
    }

    // Find the option
    const option = poll.options.find(opt => opt.id === option_id);
    if (!option) {
      return res.status(400).json({ error: 'Invalid option' });
    }

    // Create vote record
    const vote = new Vote({
      id: generateId(),
      user: req.user.id,
      poll_id: pollId,
      option_id: option_id,
      voter_email: req.user.email
    });

    await vote.save();

    // Update poll vote counts
    option.votes += 1;
    poll.total_votes = (poll.total_votes || 0) + 1;
    await poll.save();

    // Add poll to user's voted polls (only once)
    await User.findOneAndUpdate(
      { id: req.user.id },
      { $addToSet: { polls_voted: pollId } }
    );

    // Create notification for poll creator (if not the same user)
    if (poll.creator !== req.user.id) {
      await createNotification('vote', {
        voterName: req.user.username,
        pollTitle: poll.title,
        pollId: pollId
      }, poll.creator);
    }

// Emit updated poll results only for non-draft polls
    if (poll.status !== 'draft') {
      io.to(`poll_${pollId}`).emit('pollUpdate', poll);
      io.emit('pollUpdate', poll);
    }

    res.json({ message: 'Vote recorded successfully', poll });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Vote status for current user
app.get('/api/polls/:id/vote-status', authenticateToken, async (req, res) => {
  try {
    const pollId = req.params.id;
    
    // Check if poll exists and is accessible
    const poll = await Poll.findOne({ id: pollId });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Security check: Only allow vote status check on active/closed polls or user's own drafts
    if (poll.status === 'draft' && poll.creator !== req.user.id) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    const votes = await Vote.find({ user: req.user.id, poll_id: pollId });
    res.json({ hasVoted: votes.length > 0, votes: votes.map(v => v.option_id) });
  } catch (error) {
    console.error('Vote status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Comment Routes
app.get('/api/polls/:id/comments', authenticateToken, async (req, res) => {
  try {
    // Check if poll exists and is accessible
    const poll = await Poll.findOne({ id: req.params.id });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Security check: Only allow comments access on active polls or user's own drafts
    if (poll.status === 'draft' && poll.creator !== req.user.id) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    
    // Return all comments for the poll with user's like status
    const comments = await Comment.find({ poll_id: req.params.id }).sort({ createdAt: -1 });
    
    // Add hasLiked property for the current user
    const commentsWithLikeStatus = comments.map(comment => ({
      ...comment.toObject(),
      hasLiked: comment.liked_by && comment.liked_by.includes(req.user.id)
    }));
    
    res.json(commentsWithLikeStatus);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Single unified comment creation endpoint with duplicate prevention
app.post('/api/comments', authenticateToken, async (req, res) => {
  try {
    const { poll_id, content, parent_comment_id } = req.body;

    if (!poll_id || !content) {
      return res.status(400).json({ error: 'poll_id and content are required' });
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const poll = await Poll.findOne({ id: poll_id });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Security check: Only allow comments on active polls or user's own drafts
    if (poll.status === 'draft' && poll.creator !== req.user.id) {
      return res.status(403).json({ error: 'Cannot comment on draft polls' });
    }

    // Prevent commenting on closed polls
    if (poll.status === 'closed') {
      return res.status(403).json({ error: 'This poll has been closed and no longer accepts comments' });
    }

    // Prevent duplicate comments: Check for identical content from same user in last 5 seconds
    const recentComment = await Comment.findOne({
      user: req.user.id,
      poll_id: poll_id,
      content: trimmedContent,
      parent_comment_id: parent_comment_id || null,
      createdAt: { $gte: new Date(Date.now() - 5000) } // Last 5 seconds
    });

    if (recentComment) {
      return res.status(429).json({ error: 'Duplicate comment detected. Please wait before posting again.' });
    }

    const comment = new Comment({
      id: generateId(),
      user: req.user.id,
      poll_id,
      content: trimmedContent,
      parent_comment_id: parent_comment_id || null,
      author_email: req.user.email,
      author_username: req.user.username
    });

    await comment.save();

    if (parent_comment_id) {
      await Comment.findOneAndUpdate(
        { id: parent_comment_id },
        { $push: { replies: comment.id } }
      );
    }
    
    // ALWAYS update comment count based on actual database count to ensure accuracy
    const actualCommentCount = await Comment.countDocuments({ poll_id: poll_id });
    poll.comments_count = actualCommentCount;
    await poll.save();
    
    console.log(`📝 Comment added to poll "${poll.title}": ${actualCommentCount} total comments (parent + replies)`);

    // Create notification for poll creator (if not the same user)
    if (poll.creator !== req.user.id) {
      const notificationType = parent_comment_id ? 'reply' : 'comment';
      const notificationData = {
        [parent_comment_id ? 'replierName' : 'commenterName']: req.user.username,
        pollTitle: poll.title,
        pollId: poll_id,
        commentId: comment.id
      };
      
      await createNotification(notificationType, notificationData, poll.creator);
    }

    // Emit new comment to clients viewing this poll
    io.to(`poll_${poll_id}`).emit('newComment', comment);

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Like/Unlike comment with duplicate prevention
app.post('/api/comments/:id/like', authenticateToken, async (req, res) => {
  try {
    const comment = await Comment.findOne({ id: req.params.id });
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user already liked this comment
    const hasLiked = comment.liked_by && comment.liked_by.includes(req.user.id);
    
    if (hasLiked) {
      // Unlike - remove user from liked_by array and decrease count
      comment.liked_by = comment.liked_by.filter(userId => userId !== req.user.id);
      comment.likes = Math.max(0, (comment.likes || 0) - 1);
      await comment.save();
      
      res.json({ 
        message: 'Comment unliked', 
        likes: comment.likes,
        hasLiked: false
      });
    } else {
      // Like - add user to liked_by array and increase count
      if (!comment.liked_by) {
        comment.liked_by = [];
      }
      comment.liked_by.push(req.user.id);
      comment.likes = (comment.likes || 0) + 1;
      await comment.save();
      
      // Create notification for comment author (only if someone else liked their comment)
      if (comment.user !== req.user.id) {
        console.log('🔔 Creating comment like notification - Liker:', req.user.username, 'Comment author:', comment.user);
        console.log('🔔 Comment details - Poll ID:', comment.poll_id, 'Comment ID:', comment.id);
        
        // Get the poll information for the notification
        const poll = await Poll.findOne({ id: comment.poll_id });
        if (poll) {
          console.log('🔔 Poll found:', poll.title);
          const notificationResult = await createNotification('comment_like', {
            likerName: req.user.username,
            pollTitle: poll.title,
            pollId: comment.poll_id,
            commentId: comment.id
          }, comment.user);
          console.log('✅ Comment like notification created:', notificationResult ? 'Success' : 'Failed');
          
          if (notificationResult) {
            console.log('🔔 Notification details:', {
              id: notificationResult.id,
              userId: notificationResult.userId,
              type: notificationResult.type,
              message: notificationResult.message
            });
            
            // Check socket room
            const userRoom = `user_${comment.user}`;
            const sockets = io.sockets.adapter.rooms;
            const roomSockets = sockets.get(userRoom);
            console.log('🔔 Socket room', userRoom, 'has', roomSockets ? roomSockets.size : 0, 'connected sockets');
          }
        } else {
          console.log('❌ Poll not found for comment like notification');
        }
      } else {
        console.log('⏭️ Skipping notification - user liked their own comment');
      }
      
      res.json({ 
        message: 'Comment liked', 
        likes: comment.likes,
        hasLiked: true
      });
    }

    // Emit real-time update
    io.to(`poll_${comment.poll_id}`).emit('commentLikeUpdate', {
      commentId: comment.id,
      likes: comment.likes,
      hasLiked: !hasLiked,
      userId: req.user.id
    });

  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete comment endpoint
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    const comment = await Comment.findOne({ id: req.params.id });
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user owns the comment
    if (comment.user !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    // If this is a parent comment, also delete all replies
    if (!comment.parent_comment_id) {
      await Comment.deleteMany({ parent_comment_id: comment.id });
    } else {
      // Remove reply from parent comment's replies array
      await Comment.findOneAndUpdate(
        { id: comment.parent_comment_id },
        { $pull: { replies: comment.id } }
      );
    }

    // Delete the comment
    await Comment.findOneAndDelete({ id: req.params.id });

    // ALWAYS update comment count based on actual database count to ensure accuracy
    const poll = await Poll.findOne({ id: comment.poll_id });
    if (poll) {
      const actualCommentCount = await Comment.countDocuments({ poll_id: comment.poll_id });
      poll.comments_count = actualCommentCount;
      await poll.save();
      
      console.log(`🗿 Comment deleted from poll "${poll.title}": ${actualCommentCount} total comments remaining (parent + replies)`);
    }

    // Emit real-time update
    io.to(`poll_${comment.poll_id}`).emit('commentDeleted', {
      commentId: comment.id,
      parentCommentId: comment.parent_comment_id
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Notification Routes
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, type, priority, unreadOnly } = req.query;
    
    let query = { userId: req.user.id };
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Add 'read' alias for frontend compatibility
    const normalized = notifications.map(n => ({
      ...n,
      read: n.isRead
    }));

    res.json(normalized);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { id: req.params.id, userId: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Emit real-time update
    io.to(`user_${req.user.id}`).emit('notificationRead', { notificationId: notification.id });

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );

    // Emit real-time update
    io.to(`user_${req.user.id}`).emit('allNotificationsRead');

    res.json({ 
      message: 'All notifications marked as read', 
      count: result.modifiedCount 
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/notifications/clear-all', authenticateToken, async (req, res) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user.id });

    res.json({ 
      message: 'All notifications cleared', 
      count: result.deletedCount 
    });
  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Notification helper function
const createNotification = async (type, data, userId) => {
  try {
    console.log('📢 Creating notification:', type, 'for user:', userId);
    console.log('📢 Notification data:', data);
    
    const notification = new Notification({
      id: generateId(),
      userId,
      type,
      message: formatNotificationMessage(type, data),
      data,
      priority: getNotificationPriority(type),
      timestamp: new Date()
    });

    const savedNotification = await notification.save();
    console.log('✅ Notification saved to database:', savedNotification.id);
    
    const targetRoom = `user_${userId}`;
    console.log('✅ Emitting to room:', targetRoom);
    
    // Check if room has connected sockets
    const sockets = io.sockets.adapter.rooms;
    const roomSockets = sockets.get(targetRoom);
    console.log('📡 Room', targetRoom, 'has', roomSockets ? roomSockets.size : 0, 'connected sockets');
    
    // Emit real-time notification (frontend listens for 'newNotification')
    io.to(targetRoom).emit('newNotification', savedNotification);
    console.log('📡 Notification emitted via socket');

    return savedNotification;
  } catch (error) {
    console.error('❌ Create notification error:', error);
    return null;
  }
};

const formatNotificationMessage = (type, data) => {
  switch (type) {
    case 'vote':
      return `${data.voterName || 'Someone'} voted on your poll "${data.pollTitle}"`;
    case 'comment':
      return `${data.commenterName || 'Someone'} commented on your poll "${data.pollTitle}"`;
    case 'reply':
      return `${data.replierName || 'Someone'} replied to your comment on "${data.pollTitle}"`;
    case 'comment_like':
      return `${data.likerName || 'Someone'} liked your comment on "${data.pollTitle}"`;
    case 'poll_created':
      return `Your poll "${data.pollTitle}" has been created successfully`;
    case 'poll_closed':
      if (data.reason === 'automatic_closure') {
        return `Your poll "${data.pollTitle}" has been automatically closed as it reached its end date. Final results are now available.`;
      }
      return `Your poll "${data.pollTitle}" has been closed. Final results are now available.`;
    case 'system':
      return data.message || 'System notification';
    default:
      return data.message || 'New notification';
  }
};

const getNotificationPriority = (type) => {
  switch (type) {
    case 'system':
      return 'high';
    case 'reply':
    case 'comment':
    case 'poll_closed':
      return 'medium';
    case 'vote':
    case 'comment_like':
    case 'poll_created':
    default:
      return 'low';
  }
};

// User profile and stats routes (for frontend compatibility)
app.patch('/api/user/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { username, bio, location } = req.body;
    const removeProfilePicture = req.body.removeProfilePicture === 'true';

    if (typeof username === 'string' && username.trim()) {
      user.username = username.trim();
    }
    if (typeof bio === 'string') {
      user.bio = bio;
    }
    if (typeof location === 'string') {
      user.location = location;
    }

    // Handle profile picture removal
    if (removeProfilePicture) {
      console.log('Removing profile picture for user:', user.id);
      console.log('Current profile_picture value:', user.profile_picture);
      
      // Delete old profile picture if exists
      if (user.profile_picture) {
        try {
          // Extract filename from the profile picture URL - handle both formats
          let filename = '';
          if (user.profile_picture.startsWith('/uploads/')) {
            // If it's already a relative path like /uploads/filename
            filename = user.profile_picture.substring(9); // Remove '/uploads/' prefix (9 characters including the trailing slash)
          } else if (user.profile_picture.includes('/uploads/')) {
            // If it's a full URL, extract the filename
            filename = path.basename(user.profile_picture);
          } else {
            // If it's just a filename
            filename = user.profile_picture;
          }
          
          if (filename) {
            const uploadsDir = path.join(__dirname, 'uploads');
            const oldPath = path.join(uploadsDir, filename);
            console.log('Attempting to delete file at path:', oldPath);
            
            if (fs.existsSync(oldPath)) {
              try { 
                fs.unlinkSync(oldPath);
                console.log(`Deleted profile picture: ${oldPath}`);
              } catch (err) {
                console.error(`Error deleting profile picture: ${oldPath}`, err);
              }
            } else {
              console.log('File does not exist at path:', oldPath);
            }
          } else {
            console.log('Could not extract filename from profile_picture:', user.profile_picture);
          }
        } catch (err) {
          console.error('Error processing profile picture removal:', err);
        }
      }
      user.profile_picture = '';
      console.log('Profile picture field cleared');
    } else if (req.file) {
      // Delete old profile picture if exists
      if (user.profile_picture) {
        // Extract filename from the profile picture URL
        const filename = path.basename(user.profile_picture);
        const uploadsDir = path.join(__dirname, 'uploads');
        const oldPath = path.join(uploadsDir, filename);
        if (fs.existsSync(oldPath)) {
          try { 
            fs.unlinkSync(oldPath);
            console.log(`Deleted old profile picture: ${oldPath}`);
          } catch (err) {
            console.error(`Error deleting old profile picture: ${oldPath}`, err);
          }
        }
      }
      user.profile_picture = `/uploads/${req.file.filename}`;
    }

    await user.save();
    console.log('User saved with profile_picture:', user.profile_picture);

    // Return updated user
    const responseData = {
      id: user.id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      location: user.location,
      profile_picture: user.profile_picture
    };
    
    console.log('Sending response:', responseData);
    
    res.json(responseData);
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/profile/picture', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

// Delete old profile picture if exists
    if (user.profile_picture) {
      try {
        // Extract filename from the profile picture URL - handle both formats
        let filename = '';
        if (user.profile_picture.startsWith('/uploads/')) {
          // If it's already a relative path like /uploads/filename
          filename = user.profile_picture.substring(9); // Remove '/uploads/' prefix (9 characters)
        } else if (user.profile_picture.includes('/uploads/')) {
          // If it's a full URL, extract the filename
          filename = path.basename(user.profile_picture);
        } else {
          // If it's just a filename
          filename = user.profile_picture;
        }
        
        if (filename) {
          const uploadsDir = path.join(__dirname, 'uploads');
          const oldPath = path.join(uploadsDir, filename);
          console.log('Attempting to delete file at path:', oldPath);
          
          if (fs.existsSync(oldPath)) {
            try { 
              fs.unlinkSync(oldPath);
              console.log(`Deleted profile picture: ${oldPath}`);
            } catch (err) {
              console.error(`Error deleting profile picture: ${oldPath}`, err);
            }
          } else {
            console.log('File does not exist at path:', oldPath);
          }
        } else {
          console.log('Could not extract filename from profile_picture:', user.profile_picture);
        }
      } catch (err) {
        console.error('Error processing profile picture removal:', err);
      }
    }

    // Update user profile picture
    user.profile_picture = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({
      message: 'Profile picture updated successfully',
      profile_picture: user.profile_picture,
      profilePicture: user.profile_picture
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/user/stats', authenticateToken, async (req, res) => {
  try {
    const [totalVotes, totalComments] = await Promise.all([
      Vote.countDocuments({ user: req.user.id }),
      Comment.countDocuments({ user: req.user.id })
    ]);
    res.json({ totalVotes, totalComments });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/user/voted-polls', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const polls = await Poll.find({ id: { $in: (user.polls_voted || []) } }).sort({ createdAt: -1 });
    
    // ALWAYS update comment counts to ensure accuracy for voted polls too
    const pollsWithAccurateComments = await Promise.all(
      polls.map(async (poll) => {
        const actualCommentCount = await Comment.countDocuments({ poll_id: poll.id });
        
        // Force update comment count regardless of current value
        poll.comments_count = actualCommentCount;
        await poll.save();
        
        console.log(`📊 User Voted Poll "${poll.title}" - Comment count updated to: ${actualCommentCount}`);
        
        return poll;
      })
    );
    
    res.json(pollsWithAccurateComments);
  } catch (error) {
    console.error('Get user voted polls error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/polls', authenticateToken, async (req, res) => {
  try {
    // This endpoint is for general poll listing (dashboard, profile, etc.)
    // Include all polls that should be visible to users:
    // 1. All active and closed polls (no drafts)
    const polls = await Poll.find({ 
      status: { $in: ['active', 'closed'] }
    }).sort({ createdAt: -1 });
    
    // ALWAYS update comment counts to ensure accuracy across all components
    const pollsWithAccurateComments = await Promise.all(
      polls.map(async (poll) => {
        const actualCommentCount = await Comment.countDocuments({ poll_id: poll.id });
        
        // Force update comment count regardless of current value
        poll.comments_count = actualCommentCount;
        await poll.save();
        
        console.log(`📊 Poll "${poll.title}" - Comment count updated to: ${actualCommentCount}`);
        
        return poll;
      })
    );
    
    res.json(pollsWithAccurateComments);
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Special endpoint for dashboard - includes all polls except drafts
app.get('/api/polls/dashboard', authenticateToken, async (req, res) => {
  try {
    // This endpoint is specifically for the dashboard
    // Show all active and closed polls (including private ones) except drafts
    const polls = await Poll.find({ 
      status: { $in: ['active', 'closed'] }
    }).sort({ createdAt: -1 });
    
    // ALWAYS update comment counts to ensure accuracy across all components
    const pollsWithAccurateComments = await Promise.all(
      polls.map(async (poll) => {
        const actualCommentCount = await Comment.countDocuments({ poll_id: poll.id });
        
        // Force update comment count regardless of current value
        poll.comments_count = actualCommentCount;
        await poll.save();
        
        console.log(`📊 Poll "${poll.title}" - Comment count updated to: ${actualCommentCount}`);
        
        return poll;
      })
    );
    
    res.json(pollsWithAccurateComments);
  } catch (error) {
    console.error('Get polls for dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chatbot Routes
app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Generate response using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const pollSpaceKnowledge = `
    You are a helpful assistant for PollSpace, a sophisticated real-time polling application. Here's what you need to know:
    
    CORE FEATURES:
    - Create polls with title, description, and multiple options
    - Set poll categories (General, Technology, Politics, Entertainment, Sports, Business, Other)
    - Configure poll settings (end dates, multiple votes per user, result visibility)
    - Real-time voting with instant result updates
    - Visualize results with interactive pie charts
    - Export poll results in multiple formats (HTML, CSV, TXT, JSON)
    - Share polls via social media or direct links
    - Comment system with threaded replies and likes
    - Real-time notifications for votes and comments
    - User profiles with bio, location, and profile pictures
    - Search and filter polls by category, status, or keywords
    - Mobile-responsive design for all devices
    
    POLL CREATION:
    - Create polls with custom titles and descriptions
    - Add multiple options for users to vote on
    - Select from 7 categories (General, Technology, Politics, Entertainment, Sports, Business, Other)
    - Set optional end date for polls (automatically close when date is reached)
    - Enable/disable multiple votes per user
    - Control result visibility (public/private results)
    - Preview poll before publishing
    
    VOTING SYSTEM:
    - Real-time voting with instant result updates
    - Visual progress bars showing vote percentages
    - Interactive pie charts for result visualization
    - Single vote per user by default (unless multiple votes enabled)
    - Vote anytime while poll is active
    - See real-time updates as others vote
    
    RESULTS & VISUALIZATION:
    - Detailed results page with statistics
    - Interactive pie charts showing vote distribution
    - Progress bars for each option with percentages
    - Sort options by vote count (highest first)
    - Export results in HTML format only:
      * HTML: Web page with charts, styled for printing
    - Share results via direct links
    
    EXPORTING RESULTS:
    - Users can export poll results from the poll results page
    - Click the "Export" button to download results
    - Available format: HTML (web page with charts) only
    - HTML exports include visual charts and are print-friendly
    - All exports include all poll data and voting results
    - Exported files are automatically downloaded to the user's device
    
    SOCIAL FEATURES:
    - Comment system with threaded replies
    - Comment system with threaded replies
    - Like/dislike comments
    - Real-time comment updates
    - Share polls via social media or copy links
    - Real-time notifications for:
      * When someone votes on your polls
      * When someone comments on your polls
      * When someone replies to your comments
    
    USER PROFILES:
    - Personal profile pages
    - Upload and manage profile pictures
    - Add bio and location information
    - View created polls and voting history
    - Edit profile information at any time
    
    SEARCH & DISCOVERY:
    - Search polls by keywords in title or description
    - Filter polls by category
    - Filter polls by status (active, closed, draft)
    - Sort polls by creation date or popularity
    - View all public poll results in one place
    
    MOBILE & ACCESSIBILITY:
    - Fully responsive design works on all devices
    - Touch-friendly interface for mobile users
    - Fast loading times and smooth animations
    - Accessible design following web standards
    `;
    
    const prompt = `${pollSpaceKnowledge}

    The user asked: "${message}"
    
    Please provide a short, simple response (2-3 sentences max) about PollSpace. Use easy words and be direct. Focus on answering exactly what they asked.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Save chat message
    const chatMessage = new ChatMessage({
      id: generateId(),
      user: req.user.id,
      message,
      response
    });

    await chatMessage.save();

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    // Check if headers have already been sent
    if (!res.headersSent) {
      // Handle specific Gemini API errors
      if (error.status === 503 || (error.message && error.message.includes('Service Unavailable'))) {
        res.status(503).json({ 
          error: 'AI service is temporarily unavailable',
          response: 'The AI assistant is currently overloaded. Please try again in a few minutes.'
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to generate response',
          response: 'I apologize, but I\'m having trouble responding right now. Please try again later.'
        });
      }
    }
  }
});

app.get('/api/chat/history', authenticateToken, async (req, res) => {
  try {
    const chatHistory = await ChatMessage.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(chatHistory);
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Socket.IO authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.warn('Socket connection attempted without token');
      return next(new Error('Authentication token required'));
    }

    // Validate token format
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.warn('Socket connection attempted with invalid token format');
      return next(new Error('Invalid token format'));
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error('Socket authentication error:', err.message, 'Token:', token.substring(0, 20) + '...');
        if (err.name === 'JsonWebTokenError') {
          return next(new Error('Invalid token'));
        } else if (err.name === 'TokenExpiredError') {
          return next(new Error('Token expired'));
        } else {
          return next(new Error('Authentication failed'));
        }
      }
      socket.user = user;
      console.log('Socket authenticated successfully for user:', user.username);
      next();
    });
  } catch (error) {
    console.error('Socket authentication failed:', error);
    next(new Error('Authentication failed'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔗 Socket connected:', socket.id, 'User:', socket.user?.username);
  
  // Automatically join user to their personal room for notifications
  if (socket.user?.id) {
    socket.join(`user_${socket.user.id}`);
    console.log('📡 User', socket.user.username, 'joined notification room:', `user_${socket.user.id}`);
  }

  // Join user to their personal room for notifications (legacy support)
  socket.on('join', (userId) => {
    console.log('📡 Join request for user:', userId, 'from socket user:', socket.user?.id);
    // Verify the userId matches the authenticated user
    if (socket.user?.id === userId) {
      socket.join(`user_${userId}`);
      console.log('✅ User', socket.user.username, 'successfully joined room:', `user_${userId}`);
    } else {
      console.warn('⚠️ Invalid join request: user', socket.user?.id, 'tried to join room for user', userId);
    }
  });

  // Join poll room for real-time updates
  socket.on('joinPoll', (pollId) => {
    socket.join(`poll_${pollId}`);
  });

  // Leave poll room
  socket.on('leavePoll', (pollId) => {
    socket.leave(`poll_${pollId}`);
  });

  socket.on('disconnect', () => {
    // Cleanup handled automatically by socket.io
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  // Log error details
  console.error(`❌ Error in ${req.method} ${req.url}:`, {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle specific error types
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        maxSize: '5MB'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Unexpected file field'
      });
    }
  }
  
  // Handle file type rejections from multer fileFilter
  if (error && error.message === 'Only image files are allowed!') {
    return res.status(400).json({ 
      error: error.message,
      allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    });
  }
  
  // Handle MongoDB/Mongoose errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: Object.values(error.errors).map(err => err.message)
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format'
    });
  }
  
  if (error.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate entry',
      field: Object.keys(error.keyPattern)[0]
    });
  }
  
  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }
  
  // Generic server error
  res.status(500).json({ 
    error: 'Internal server error',
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  });
});

// Enhanced health check endpoint with comprehensive monitoring
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const dbResponseTime = await checkDatabaseHealth();
    
    // System metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Service checks
    const services = {
      database: {
        status: dbStatus,
        responseTime: dbResponseTime
      },
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
        usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
    
    // Overall health determination
    const isHealthy = dbStatus === 'connected' && 
                     dbResponseTime < 1000 && 
                     services.memory.usage < 90;
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.0',
      responseTime: Date.now() - startTime,
      services: services,
      checks: {
        database: dbStatus === 'connected',
        memory: services.memory.usage < 90,
        responseTime: dbResponseTime < 1000
      }
    };
    
    // Set appropriate status code
    const statusCode = isHealthy ? 200 : 503;
    
    res.status(statusCode).json(healthData);
    
  } catch (error) {
    console.error('❤️ Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      responseTime: Date.now() - startTime
    });
  }
});

// Database health check helper
async function checkDatabaseHealth() {
  const start = Date.now();
  try {
    await mongoose.connection.db.admin().ping();
    return Date.now() - start;
  } catch (error) {
    console.error('Database ping failed:', error);
    return -1;
  }
}

// Apply enhanced error handling middleware
app.use(errorHandler);

// The backend should only serve API endpoints

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// For all other routes, return a simple message indicating this is the API server
app.get('*', (req, res) => {
  res.status(200).json({ 
    message: 'PollSpace API Server', 
    version: '1.0.0',
    documentation: '/api/docs (coming soon)' 
  });
});

const PORT = process.env.PORT || 8001;

// Enhanced server startup with health monitoring
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗺️ API Base URL: http://localhost:${PORT}/api`);
  
  // Log memory usage
  const memUsage = process.memoryUsage();
  console.log(`📦 Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
});

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`⚠️ Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('👋 HTTP server closed.');
    
    // Close database connection
    mongoose.connection.close(false, () => {
      console.log('📛 MongoDB connection closed.');
      process.exit(0);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Automatic Poll Closure System
// Schedule a job to run every minute and check for expired polls
cron.schedule('* * * * *', async () => {
  try {
    const currentTime = new Date();
    console.log(`🕐 Checking for expired polls at ${currentTime.toISOString()}...`);
    
    // Find all active polls that have passed their end date
    // We auto-close polls that either:
    // 1. Don't have manual override set, OR
    // 2. Have manual override set but no future end date (user wants it to stay closed)
    const expiredPolls = await Poll.find({
      status: 'active',
      ends_at: { $lte: currentTime }
    });
    
    if (expiredPolls.length > 0) {
      console.log(`📅 Found ${expiredPolls.length} expired poll(s) to close`);
      
      for (const poll of expiredPolls) {
        try {
          const pollEndTime = new Date(poll.ends_at);
          console.log(`🔄 Closing poll "${poll.title}" - End time: ${pollEndTime.toISOString()}, Current time: ${currentTime.toISOString()}`);
          
          // Update poll status to closed
          poll.status = 'closed';
          // Clear the end date when poll expires automatically
          poll.ends_at = null;
          // If this poll had manual override, it means user previously reopened it
          // Now that it's expired again, we reset the manual override flag
          // to allow future automatic closures if user sets new end dates
          poll.manual_status_override = false;
          await poll.save();
          
          console.log(`✅ Automatically closed poll: "${poll.title}" (ID: ${poll.id})`);
          
          // Create notification for poll creator
          await createNotification('poll_closed', {
            pollTitle: poll.title,
            pollId: poll.id,
            reason: 'automatic_closure'
          }, poll.creator);
          
          // Emit real-time update to all connected clients
          io.to(`poll_${poll.id}`).emit('pollUpdate', poll);
          io.emit('pollUpdate', poll);
          
          // Emit poll closure notification
          io.to(`poll_${poll.id}`).emit('pollClosed', {
            pollId: poll.id,
            title: poll.title,
            message: 'This poll has been automatically closed as it reached its end date.'
          });
          
        } catch (pollError) {
          console.error(`❌ Error closing poll ${poll.id}:`, pollError);
        }
      }
    } else {
      console.log('📊 No expired polls found');
    }
  } catch (error) {
    console.error('❌ Poll closure cron job error:', error);
  }
});

console.log('⏰ Automatic poll closure system initialized - checking every minute for expired polls');

// Monitor for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;