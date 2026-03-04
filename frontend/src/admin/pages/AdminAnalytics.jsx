import React from 'react';
import { GeneralAnalytics } from './GeneralAnalytics.jsx';
import { PmoAnalytics } from './PmoAnalytics.jsx';
import { UsapanAnalytics } from './UsapanAnalytics.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

// Combined Data Analytics page for Admin
export function AdminAnalytics() {
  const { user } = useAuth();
  const greetingName = user?.username && String(user.username).trim()
    ? String(user.username).trim()
    : 'Admin';

  return (
    <div className="container-fluid py-3">
      <div className="row align-items-center mb-3 g-2">
        <div className="col-12 col-lg-6">
          <h2 className="h5 mb-1">Data Analytics</h2>
          <p className="text-muted small mb-0">
            Overview of key metrics across General, Pre-Marriage Orientation, and Usapan-Series.
          </p>
        </div>
        <div className="col-12 col-lg-6 d-flex justify-content-lg-end mt-2 mt-lg-0">
          <div className="text-end">
            <p className="text-muted small mb-1">Dashboard</p>
            <h2 className="h4 mb-0">
              Good Day,
              {' '}
              <span className="fw-semibold">{greetingName}</span>
            </h2>
          </div>
        </div>
      </div>
      <hr />

      <div className="row g-4">
        <div className="col-12">
          <GeneralAnalytics />
        </div>
        <div className="col-12">
          <PmoAnalytics />
        </div>
        <div className="col-12">
          <UsapanAnalytics />
        </div>
      </div>
    </div>
  );
}
