import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Stack, Button } from '@mantine/core';

export function SectionSideNav({ basePath, items }) {
  const location = useLocation();
  return (
    <nav aria-label="Section navigation" style={{ width: 260, flexShrink: 0, marginTop: '30%' }}>
      <Stack gap={6}>
        {items.map((it) => {
          const to = `${basePath}/${it.path}`;
          const active = location.pathname.startsWith(to);
          return (
            <Button
              key={it.key}
              component={NavLink}
              to={to}
              variant={active ? 'light' : 'subtle'}
              color={active ? 'blue' : 'dark'}
              justify="flex-start"
            >
              {it.label}
            </Button>
          );
        })}
      </Stack>
    </nav>
  );
}
