import React from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { Group } from '@mantine/core';
import { SectionSideNav } from './SectionSideNav.jsx';

const items = [
  { key: 'analytics', label: 'Data Analytics', path: 'analytics' },
  { key: 'schedules', label: 'Schedules', path: 'schedules' },
  { key: 'requests', label: 'Requests', path: 'requests' }
];

export function UsapanLayout() {
  const parentContext = useOutletContext?.() || {};
  return (
    <Group align="flex-start" gap="lg" px="md" style={{ height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <Outlet context={parentContext} />
      </div>
    </Group>
  );
}
