import React from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { Group } from '@mantine/core';
import { SectionSideNav } from './SectionSideNav.jsx';

const items = [
  { key: 'analytics', label: 'Data Analytics', path: 'analytics' },
  { key: 'schedules', label: 'Schedules', path: 'schedules' },
  { key: 'appointments', label: 'Appointments', path: 'appointments' },
  { key: 'questionnaire', label: 'Questionnaire', path: 'questionnaire' },
  { key: 'answers', label: 'Answers', path: 'answers' },
  { key: 'counselors', label: 'Counselors', path: 'counselors' },
  { key: 'sms-logs', label: 'SMS Logs', path: 'sms-logs' }
];

export function PmoLayout() {
  const parentContext = useOutletContext?.() || {};
  return (
    <Group align="flex-start" gap="lg" px="md" style={{ height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <Outlet context={parentContext} />
      </div>
    </Group>
  );
}
