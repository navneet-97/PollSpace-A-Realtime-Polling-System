# PollSpace - Real-Time Polling System

PollSpace is a sophisticated real-time polling application that allows users to create, vote on, and analyze polls with instant results updates. Built with modern web technologies, it features real-time updates, AI-powered assistance, comprehensive analytics, and a responsive design.

## 🌟 Features

### User Authentication
- Secure user registration and login system
- JWT-based authentication with session management
- Password encryption using bcrypt

### Poll Management
- **Create Polls**: Design polls with custom titles, descriptions, and multiple options
- **Categories**: Organize polls into 7 categories (General, Technology, Politics, Entertainment, Sports, Business, Other)
- **Draft System**: Save polls as drafts for later editing
- **Scheduled Polls**: Set end dates for automatic poll closure
- **Privacy Controls**: Toggle result visibility (public/private)
- **Multiple Votes**: Option to allow users to select multiple options

### Real-Time Functionality
- **Instant Updates**: Live vote counting and result visualization
- **WebSocket Integration**: Real-time notifications for votes, comments, and replies
- **Live Commenting**: Threaded comment system with real-time updates
- **Comment Likes**: Like/dislike functionality for comments

### Results & Analytics
- **Visual Charts**: Interactive pie charts showing vote distribution
- **Progress Bars**: Visual representation of vote percentages
- **Detailed Statistics**: Total votes, highest votes, averages
- **Export Functionality**: Export poll results as HTML reports
- **Sorting Options**: Sort results by vote count

### Social Features
- **Comment System**: Threaded replies to comments
- **Real-Time Notifications**: Instant alerts for:
  - New votes on your polls
  - Comments on your polls
  - Replies to your comments
  - Likes on your comments
  - Poll creation/closure events
- **Profile Management**: Customizable user profiles with bio, location, and profile pictures
- **Voting History**: Track polls you've voted on

### AI Assistant
- **Gemini AI Integration**: Intelligent chatbot for user assistance
- **Context-Aware Responses**: Answers specific questions about the platform
- **Chat History**: Persistent conversation history

### User Interface
- **Responsive Design**: Works on all device sizes (mobile, tablet, desktop)
- **Dark Mode**: Toggle between light and dark themes
- **Intuitive Navigation**: Clean, user-friendly interface
- **Real-Time Feedback**: Toast notifications for user actions

## 🛠️ Technology Stack

### Frontend
- **React 18** with hooks and context API
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time communication
- **Lucide React** for icons
- **Sonner** for toast notifications
- **Axios** for HTTP requests

### Backend
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM
- **Socket.IO** for WebSocket communication
- **JWT** for authentication
- **Bcrypt.js** for password hashing
- **Google Gemini AI** for chatbot functionality
- **Multer** for file uploads
- **Node-cron** for scheduled tasks

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB database (local or cloud)
- Google Gemini API key (for AI chatbot)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd real-time-polling-system
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Install frontend dependencies:**
```bash
cd ../frontend
npm install
```

4. **Configure environment variables:**

Create a `.env` file in the `backend` directory:
```env
MONGO_URL=your_mongodb_connection_string
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_google_gemini_api_key
PORT=8001
```

Create a `.env` file in the `frontend` directory:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Demo Accounts

For testing purposes, you can use the following demo accounts:

| Email | Password |
|-------|----------|
| demo@pollspace.com | demo123 |
| demo1@pollspace.com | demo123 |
| demo2@pollspace.com | demo123 |

### Running the Application Locally

1. **Start the backend server:**
```bash
cd backend
npm start
```

2. **Start the frontend development server:**
```bash
cd ../frontend
npm start
```

3. **Access the application:**
Open your browser and navigate to `http://localhost:3000`

### Building for Production

1. **Build the frontend:**
```bash
cd frontend
npm run build
```

2. **Start the production server:**
```bash
cd ../backend
npm start
```

The production build will be served from the backend server.

## 📤 Deployment Options

### Traditional Deployment (Recommended)

1. **Database Setup:**
   - Set up MongoDB either locally or use a cloud service like MongoDB Atlas
   - Update the `MONGO_URL` in your backend `.env` file with your database connection string

2. **Backend Deployment:**
   - Deploy the `backend` folder to any Node.js hosting service (Heroku, DigitalOcean, AWS, etc.)
   - Set the environment variables in your hosting platform

3. **Frontend Deployment:**
   - Build the frontend: `cd frontend && npm run build`
   - Deploy the `build` folder to any static hosting service (Netlify, Vercel, GitHub Pages, etc.)
   - Make sure to set the `REACT_APP_BACKEND_URL` environment variable to your deployed backend URL

### Vercel and Render Deployment (Recommended)

If you want to deploy to Vercel (frontend) and Render (backend):

#### Backend Deployment on Render

1. **Prepare your backend for Render:**
   - The `render.yaml` file is already included in the backend directory

2. **Configure environment variables on Render:**
   Go to your Render dashboard and set these environment variables:
   - `MONGO_URL`: Your MongoDB connection string
   - `CORS_ORIGINS`: https://your-frontend-domain.vercel.app
   - `JWT_SECRET`: Your JWT secret key
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `PORT`: 8001

3. **Deploy to Render:**
   - Connect your GitHub repository to Render
   - Select the backend folder as the root directory
   - Deploy the service

#### Frontend Deployment on Vercel

1. **Prepare your frontend for Vercel:**
   - The `vercel.json` file is already included for proper routing

2. **Configure environment variables on Vercel:**
   Go to your Vercel project settings and set:
   - `REACT_APP_BACKEND_URL`: https://your-backend-domain.onrender.com

3. **Deploy to Vercel:**
   - Connect your GitHub repository to Vercel
   - Select the frontend folder as the root directory
   - Deploy the project

### Docker Deployment

If you prefer to use Docker for deployment:

1. **Prerequisites:**
   - Install Docker and Docker Compose on your server

2. **Configure environment:**
   Update the environment variables in `docker-compose.yml`:
   - `JWT_SECRET`: Change to a secure secret key
   - `GEMINI_API_KEY`: Add your Google Gemini API key

3. **Deploy with Docker Compose:**
   ```bash
   # Clone or copy the repository
   git clone <repository-url>
   cd real-time-polling-system
   
   # Start all services
   docker-compose up -d
   
   # Check service status
   docker-compose ps
   
   # View logs
   docker-compose logs -f
   ```

4. **Access the Application:**
   - Frontend: http://localhost
   - Backend API: http://localhost:8001
   - MongoDB: localhost:27017

### When to Use Each Deployment Method

- **Vercel + Render**: Best for quick deployment with managed services
- **Traditional Deployment**: More control over your infrastructure
- **Docker Deployment**: Consistent environments and easy scaling

### Deploying to Production

1. **Build the frontend:**
```bash
cd frontend
npm run build
```

2. **Set environment variables for production:**
```env
NODE_ENV=production
MONGO_URL=your_production_mongodb_connection_string
CORS_ORIGINS=your_production_domain
JWT_SECRET=your_secure_jwt_secret
GEMINI_API_KEY=your_production_gemini_api_key
PORT=8001
```

3. **Start the server:**
```bash
cd backend
npm start
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URL` | MongoDB connection string | Yes |
| `CORS_ORIGINS` | Comma-separated list of allowed origins | Yes |
| `JWT_SECRET` | Secret key for JWT token signing | Yes |
| `GEMINI_API_KEY` | Google Gemini API key for chatbot | Yes |
| `PORT` | Server port (default: 8001) | No |

## 📚 API Endpoints

### Authentication
- `POST /api/register` - Register a new user
- `POST /api/login` - Login user

### Polls
- `GET /api/polls` - Get all public polls
- `GET /api/polls/:id` - Get a specific poll
- `POST /api/polls` - Create a new poll
- `PUT /api/polls/:id` - Update a poll
- `PATCH /api/polls/:id` - Change poll status
- `DELETE /api/polls/:id` - Delete a poll
- `GET /api/polls/my-polls` - Get current user's polls
- `GET /api/polls/voted` - Get polls current user has voted on

### Voting
- `POST /api/polls/:id/vote` - Vote on a poll
- `GET /api/polls/:id/vote-status` - Check vote status

### Comments
- `GET /api/polls/:id/comments` - Get poll comments
- `POST /api/comments` - Add a comment
- `POST /api/comments/:id/like` - Like/unlike a comment
- `DELETE /api/comments/:id` - Delete a comment

### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile
- `POST /api/profile/picture` - Upload profile picture

### Notifications
- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/:id/read` - Mark notification as read
- `PATCH /api/notifications/mark-all-read` - Mark all notifications as read
- `DELETE /api/notifications/:id` - Delete a notification
- `DELETE /api/notifications/clear-all` - Clear all notifications

### Chatbot
- `POST /api/chat` - Get AI chat response
- `GET /api/chat/history` - Get chat history

## 🤖 AI Chatbot

The integrated Gemini AI chatbot can assist users with:
- How to create polls
- How to vote on polls
- How to export results
- How to manage profile settings
- How to use the comment system
- How to interpret poll results
- How to use dark mode

## 🎨 UI Components

The application features a comprehensive set of reusable components:
- Dashboard with poll listings
- Poll creation and editing forms
- Poll viewing and voting interface
- Detailed results visualization
- User profile management
- Notification center
- AI chatbot interface
- Responsive navigation

## 📈 Performance & Security

### Security Features
- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- CORS protection
- Input validation and sanitization
- Secure file uploads

### Performance Optimizations
- Real-time updates with WebSockets
- Efficient database queries
- Caching strategies
- Optimized React components
- Lazy loading where appropriate

## 🧪 Testing

The application includes:
- Unit tests for critical functions
- Integration tests for API endpoints
- End-to-end tests for user flows

To run tests:
```bash
cd backend
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all contributors who have helped build this project
- Icons provided by Lucide React
- UI components built with Tailwind CSS
- AI powered by Google Gemini
- Real-time functionality powered by Socket.IO