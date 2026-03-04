const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const newsRoutes = require('./routes/news.routes');
const announcementsRoutes = require('./routes/announcements.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const usersRoutes = require('./routes/users.routes');
const appointmentsRoutes = require('./routes/appointments.routes');
const faqRoutes = require('./routes/faq.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const calendarRoutes = require('./routes/calendar.routes');
const pmoRoutes = require('./routes/pmo.routes');
const counselorsRoutes = require('./routes/counselors.routes');
const familyPlanningRoutes = require('./routes/familyPlanning.routes');
const searchRoutes = require('./routes/search.routes');
const hierarchyRoutes = require('./routes/hierarchy.routes');
const fileTasksRoutes = require('./routes/fileTasks.routes');
const officesRoutes = require('./routes/offices.routes');
const educationCornerRoutes = require('./routes/educationCorner.routes');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OK' });
});

app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/pmo', pmoRoutes);
app.use('/api/counselors', counselorsRoutes);
app.use('/api/family-planning', familyPlanningRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/api/file-tasks', fileTasksRoutes);
app.use('/api/offices', officesRoutes);
app.use('/api/education-corner', educationCornerRoutes);

app.use(errorHandler);

module.exports = app;
