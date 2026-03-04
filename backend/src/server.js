const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config/env');
const { startFamilyPlanningReminderJob } = require('./jobs/familyPlanningReminders');
const { startUsapanReminderJob } = require('./jobs/usapanReminders');
const { startPmoReminderJob } = require('./jobs/pmoReminders');

const port = config.port;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('WS client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('WS client disconnected:', socket.id);
  });
});

// Make io accessible from Express routes via req.app.get('io')
app.set('io', io);

// Start background jobs
startFamilyPlanningReminderJob();
startUsapanReminderJob();
startPmoReminderJob();

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
