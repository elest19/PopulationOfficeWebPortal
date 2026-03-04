import React from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';

export function GeneralLayout() {
  const parentContext = useOutletContext?.() || {};
  return (
    <div style={{ width: '100%' }}>
      <Outlet context={parentContext} />
    </div>
  );
}
