# PollSpace - Real-Time Polling System

PollSpace is a web application that allows users to create polls, vote in real-time, and see instant results. It's built with modern web technologies and features a clean, responsive interface.

## 🌟 Key Features

- **Real-time voting**: See vote results update instantly as people vote
- **User authentication**: Secure sign up and login system
- **Poll management**: Create, edit, and manage your polls
- **Live notifications**: Get notified when someone votes on your polls
- **AI chatbot**: Get help with using the app through an intelligent assistant
- **Responsive design**: Works on mobile, tablet, and desktop
- **Poll analytics**: View detailed charts and statistics for your polls
- **Comment system**: Users can comment and reply to comments on polls
- **Export results**: Export poll results as HTML reports
- **Profile customization**: Personalize your profile with bio and picture

## 🛠️ Technology Stack

### Frontend
- React.js
- Tailwind CSS (for styling)
- Socket.IO (real-time communication)

### Backend
- Node.js with Express
- MongoDB (database)
- Socket.IO (real-time communication)
- Google Gemini AI (chatbot)

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB database
- Google Gemini API key (optional, for AI chatbot)

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

4. **Set up environment variables:**

   Create a `.env` file in the `backend` directory:
   ```
   MONGO_URL=your_mongodb_connection_string
   CORS_ORIGINS=http://localhost:3000
   JWT_SECRET=your_secret_key_here
   GEMINI_API_KEY=your_google_gemini_api_key  # Optional
   PORT=8001
   ```

   Create a `.env` file in the `frontend` directory:
   ```
   REACT_APP_BACKEND_URL=http://localhost:8001
   ```

### Running the Application

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
   Open your browser and go to `http://localhost:3000`

## 🧪 Demo Accounts

For testing purposes, you can use these demo accounts:

| Email | Password |
|-------|----------|
| demo@pollspace.com | demo123 |
| demo1@pollspace.com | demo123 |
| demo2@pollspace.com | demo123 |

## 📚 Common Features

### Creating a Poll
1. Sign up or log in to your account
2. Click "Create Poll" from the dashboard
3. Enter your poll question and options
4. Set any additional settings (privacy, voting options, etc.)
5. Click "Create Poll"

### Voting on Polls
1. Browse public polls on the dashboard
2. Click on a poll to view details
3. Select your choice(s)
4. Submit your vote

### Viewing Results
- Results update in real-time as votes are cast
- View detailed statistics and charts on the results page

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all contributors who have helped build this project
- Icons provided by Lucide React
- UI components built with Tailwind CSS
- AI powered by Google Gemini
- Real-time functionality powered by Socket.IO