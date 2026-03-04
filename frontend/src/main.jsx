import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/carousel/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import './global.css';

import App from './App.jsx';
import { theme } from './theme.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { PmoBookingProvider } from './context/PmoBookingContext.jsx';

// In production, silence all console output in the browser
if (import.meta.env.PROD && typeof window !== 'undefined') {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
  console.warn = noop;
  console.error = noop;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <Notifications />
      <ModalsProvider>
        <BrowserRouter>
          <AuthProvider>
            <PmoBookingProvider>
              <App />
            </PmoBookingProvider>
          </AuthProvider>
        </BrowserRouter>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
);
