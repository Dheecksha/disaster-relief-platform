const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const beaconRoutes = require('./routes/beaconRoutes');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: { origin: '*' }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('⚡ Connected node:', socket.id);
  socket.on('disconnect', () => console.log('Disconnected node:', socket.id));
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas successfully!'))
  .catch((err) => console.error('❌ MongoDB Atlas connection error:', err));

// Mount the beacon routes under /api
app.use('/api', beaconRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    platform: 'Real-Time Disaster Relief Coordination Platform',
    status: 'Operational',
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
