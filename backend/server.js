import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';

// 🔥 IMPORTANT: LOAD ENV CORRECTLY
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

// ✅ Import routes
import authRoutes from './routes/auth.routes.js';
import taskRoutes from './routes/task.routes.js';
import projectRoutes from './routes/project.route.js';
import dashboardRoutes from './routes/dashboard.route.js';
import userRoutes from './routes/user.routes.js';
import reportRoutes from './routes/report.route.js';

import { authMiddleware } from './middlewares/auth.middleware.js';

// 🔥 Import DB (to initialize connection)
import './config/db.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS FIX (supports local + deployed frontend)
const allowedOrigins = [
  'http://localhost:8082',
  'http://localhost:8081',
  'https://team-stride-grid.lovable.app',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// ✅ Middleware
app.use(express.json());

// ✅ Health check
app.get('/', (req, res) => {
  res.send('🚀 API is running');
});

// ✅ Routes
app.use('/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
});

// 🔥 Create HTTP server
const server = http.createServer(app);

// 🔥 SOCKET.IO FIX
const socketOrigins = [
  'http://localhost:8081',
  'https://team-stride-grid.lovable.app',
];

export const io = new Server(server, {
  cors: {
    origin: socketOrigins,
    credentials: true,
  },
});

// 🔥 Socket logic
io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

// ✅ Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});