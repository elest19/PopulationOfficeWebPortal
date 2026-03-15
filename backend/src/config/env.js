const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'public'
  },
  db: {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    accessTokenTtl: process.env.JWT_ACCESS_TTL || '300m',
    refreshTokenTtl: process.env.JWT_REFRESH_TTL || '7d'
  },
  drive: {
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    clientEmail: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_DRIVE_PRIVATE_KEY
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};

module.exports = config;
