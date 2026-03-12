import React, { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { IconNews, IconCalendarEvent, IconMessageDots, IconHeartHandshake, IconUsers, IconHeart, IconClipboardList, IconListDetails, IconUserCheck, IconMail } from '@tabler/icons-react';
import { Burger, Drawer, ScrollArea } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useAuth } from '../context/AuthContext.jsx';
import { ProfileModal } from '../components/profile/ProfileModal.jsx';
import { getFamilyPlanningBookings } from '../api/familyPlanning.js';
import { getPmoAdminAppointments, getPmoSmsFailedCount } from '../api/pmoAdmin.js';
import { getCalendarEvents } from '../api/calendar.js';
import { socket } from '../socket.js';
import './adminScrollbar.css';

function AdminDashboardLayout() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [fpPending, setFpPending] = useState(0);
  const [apptPending, setApptPending] = useState(0);
  const [reqPending, setReqPending] = useState(0);
  const [smsFailed, setSmsFailed] = useState(0);
  const pendingRefreshTimeoutRef = useRef(null);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const analyticsPath = '/admin/analytics';

  const sections = [
    {
      key: 'general',
      label: 'General',
      base: '/admin/general',
      items: [
        { to: '/admin/general/news', label: 'News', icon: IconNews },
        { to: '/admin/general/announcements', label: 'Events / Activity', icon: IconCalendarEvent },
        { to: '/admin/general/feedback', label: 'Feedback', icon: IconMessageDots },
        { to: '/admin/general/family-planning', label: 'Family Planning', icon: IconHeartHandshake },
        { to: '/admin/general/education-web', label: 'Education Web', icon: IconHeart },
        { to: '/admin/general/education-booklets', label: 'Education Booklets', icon: IconClipboardList },
        { to: '/admin/general/accounts', label: 'Accounts', icon: IconUsers },
        { to: '/admin/general/file-tasks', label: 'Document Reports', icon: IconClipboardList },
        { to: '/admin/pmo/sms-logs', label: 'SMS Logs', icon: IconMail }
      ]
    },
    ...(isAdmin
      ? [
          {
            key: 'pmo',
            label: 'Pre-Marriage Orientation',
            base: '/admin/pmo',
            items: [
              { to: '/admin/pmo/schedules', label: 'Schedules', icon: IconCalendarEvent },
              { to: '/admin/pmo/appointments', label: 'Appointments', icon: IconClipboardList },
              { to: '/admin/pmo/questionnaire', label: 'Questionnaire', icon: IconListDetails },
              { to: '/admin/pmo/answers', label: 'Answers', icon: IconListDetails },
              { to: '/admin/pmo/counselors', label: 'Counselors', icon: IconUserCheck }
            ]
          }
        ]
      : []),
    {
      key: 'usapan',
      label: 'Usapan-Series',
      base: '/admin/usapan',
      items: [
        { to: '/admin/usapan/schedules', label: 'Schedules', icon: IconCalendarEvent },
        { to: '/admin/usapan/requests', label: 'Requests', icon: IconHeart }
      ]
    }
  ];

  // Pending count loaders (extracted so socket handlers can reuse them)
  const loadFpPending = async () => {
    try {
      const res = await getFamilyPlanningBookings({ page: 1, limit: 200 });
      const data = res.data?.data || [];
      const pendingCount = data.filter((b) => String(b.status || '').trim().toUpperCase() === 'PENDING').length;
      setFpPending(pendingCount);
    } catch {
      // ignore if unauthorized or fails; page-level logic will still update later
    }
  };

  const loadApptPending = async () => {
    try {
      const res = await getPmoAdminAppointments();
      const data = res.data?.data || [];
      const pendingCount = data.filter((r) => String(r.status || '').toUpperCase() === 'PENDING').length;
      setApptPending(pendingCount);
    } catch {
      // ignore
    }
  };

  const loadReqPending = async () => {
    try {
      const start = dayjs().startOf('year').toISOString();
      const end = dayjs().endOf('year').toISOString();
      const res = await getCalendarEvents({ start, end });
      const all = res.data?.data || [];
      const pendingUsapan = all.filter((e) => {
        if (!e || e.type !== 'Usapan-Series') return false;
        const s = String(e.status || '').toUpperCase();
        return s === 'PENDING';
      });
      setReqPending(pendingUsapan.length);
    } catch {
      // ignore
    }
  };

  const loadSmsFailed = async () => {
    try {
      const res = await getPmoSmsFailedCount();
      const count = res.data?.data?.count ?? 0;
      setSmsFailed(count);
    } catch {
      // ignore
    }
  };

  // Initial pending counts on dashboard load
  useEffect(() => {
    loadFpPending().catch(() => {});
    loadApptPending().catch(() => {});
    loadReqPending().catch(() => {});
    loadSmsFailed().catch(() => {});
  }, []);

  // Live-refresh pending counters via WebSocket
  useEffect(() => {
    const schedulePendingRefresh = () => {
      if (pendingRefreshTimeoutRef.current) return;
      pendingRefreshTimeoutRef.current = setTimeout(() => {
        pendingRefreshTimeoutRef.current = null;
        // Re-load all counters together
        loadFpPending().catch(() => {});
        loadApptPending().catch(() => {});
        loadReqPending().catch(() => {});
        loadSmsFailed().catch(() => {});
      }, 500);
    };

    const onFp = () => schedulePendingRefresh();
    const onPmo = () => schedulePendingRefresh();
    const onUsapan = () => schedulePendingRefresh();
    socket.on('fp:updated', onFp);
    socket.on('pmo:updated', onPmo);
    socket.on('usapan:updated', onUsapan);
    return () => {
      socket.off('fp:updated', onFp);
      socket.off('pmo:updated', onPmo);
      socket.off('usapan:updated', onUsapan);
      if (pendingRefreshTimeoutRef.current) {
        clearTimeout(pendingRefreshTimeoutRef.current);
        pendingRefreshTimeoutRef.current = null;
      }
    };
  }, []);

  // Fallback auto-refresh every 30 seconds in case WebSocket events are missed
  useEffect(() => {
    const interval = setInterval(() => {
      loadFpPending().catch(() => {});
      loadApptPending().catch(() => {});
      loadReqPending().catch(() => {});
      loadSmsFailed().catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, []);
  const renderSidebar = () => (
    <aside
      className="bg-white shadow-sm rounded-4 d-flex flex-column p-3 no-scrollbar"
      style={{ position: 'sticky', top: '1rem', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}
    >
            <div className="mb-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-uppercase text-muted small fw-semibold">Admin Dashboard</div>
              </div>
            </div>

            <div className="mb-3">
              <button
                type="button"
                className="w-100 d-flex align-items-center gap-2 rounded-4 px-3 py-2 text-start border-0 bg-light"
                onClick={() => setProfileModalOpen(true)}
              >
                <span
                  className="d-inline-flex align-items-center justify-content-center rounded-5 bg-primary text-white fw-semibold"
                  style={{ width: 32, height: 32 }}
                >
                  {(user?.fullName || 'Admin')
                    .split(' ')
                    .map((p) => p.charAt(0))
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <span className="d-flex flex-column">
                  <span className="small fw-semibold">{user?.fullName || 'Admin'}</span>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>Admin profile</span>
                </span>
              </button>
            </div>

            {/* Primary dashboard pill */}
            <div className="mb-3">
              {(() => {
                const active = location.pathname.startsWith(analyticsPath);
                const baseClasses =
                  'd-flex align-items-center gap-2 rounded-4 px-3 py-2 text-decoration-none small shadow-sm admin-sidebar-link';
                const activeClasses = active
                  ? 'bg-warning text-white'
                  : 'bg-light text-dark';
                return (
                  <NavLink
                    to={analyticsPath}
                    className={baseClasses + ' ' + activeClasses}
                  >
                    <span className="d-inline-flex align-items-center justify-content-center rounded-3 bg-white bg-opacity-25 me-1" style={{ width: 24, height: 24 }}>
                      <span className="fw-bold" style={{ fontSize: '0.75rem' }}>DA</span>
                    </span>
                    <span className="fw-semibold">Data Analytics</span>
                  </NavLink>
                );
              })()}
            </div>
              
            {/* Section groups */}
            <div className="flex-grow-1 overflow-auto no-scrollbar">
              {sections.map((section) => (
                <div key={section.key} className="mb-3">
                  <div className="text-uppercase text-muted small fw-semibold mb-1">
                    {section.label}
                  </div>
                  <div className="d-flex flex-column gap-1">
                    {section.items.map((item) => {
                      let pendingCount = 0;
                      if (item.to === '/admin/general/family-planning') pendingCount = fpPending;
                      if (item.to === '/admin/pmo/appointments') pendingCount = apptPending;
                      if (item.to === '/admin/usapan/requests') pendingCount = reqPending;
                      if (item.to === '/admin/pmo/sms-logs') pendingCount = smsFailed;

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) => {
                            const base =
                              'd-flex align-items-center rounded-3 px-3 py-2 text-decoration-none small admin-sidebar-link';
                            const state = isActive
                              ? ' bg-primary text-white shadow-sm'
                              : ' bg-light text-dark';
                            return base + state;
                          }}
                        >
                          <span className="d-inline-flex align-items-center justify-content-center rounded-2 bg-white bg-opacity-50 me-2" style={{ width: 22, height: 22 }}>
                            {item.icon ? (
                              React.createElement(item.icon, { size: 16, stroke: 1.8 })
                            ) : (
                              <span style={{ fontSize: '0.7rem' }}>•</span>
                            )}
                          </span>
                          <span className="d-flex w-100 justify-content-between align-items-center">
                            <span>{item.label}</span>
                            {(item.to === '/admin/general/family-planning' || item.to === '/admin/pmo/appointments' || item.to === '/admin/usapan/requests' || item.to === '/admin/pmo/sms-logs') && (
                              <span
                                style={{
                                  backgroundColor: pendingCount > 0 ? '#2563eb' : '#e5e7eb',
                                  color: pendingCount > 0 ? 'white' : '#6b7280',
                                  borderRadius: 999,
                                  padding: '0 6px',
                                  fontSize: '0.7rem',
                                  lineHeight: '16px',
                                  minWidth: 18,
                                  textAlign: 'center',
                                  marginLeft: 8,
                                }}
                              >
                                {pendingCount}
                              </span>
                            )}
                          </span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
  );

  return (
    <div className="container-fluid py-3">
      {isMobile && (
        <Drawer
          opened={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          position="left"
          size="75%"
          padding="md"
          title="Admin Menu"
        >
          <ScrollArea style={{ height: '100%' }}>
            {renderSidebar()}
          </ScrollArea>
        </Drawer>
      )}

      <div className="row g-3" style={{ minHeight: '70vh' }}>
        <div className="col-12 col-md-3 col-lg-2 d-none d-md-block">
          {renderSidebar()}
        </div>

        <div className="col-12 col-md-9 col-lg-10">
          <div
            className="bg-white shadow-sm rounded-4 h-100 p-3"
            style={{ maxHeight: '100%', overflowY: 'auto' }}
          >
            {isMobile && (
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Burger
                  opened={mobileSidebarOpen}
                  onClick={() => setMobileSidebarOpen((o) => !o)}
                  size="sm"
                  aria-label="Toggle admin menu"
                />
                <div className="small text-muted">Admin Dashboard</div>
              </div>
            )}

            <Outlet context={{ setFpPending, setApptPending, setReqPending }} />
          </div>
        </div>
      </div>

      <ProfileModal opened={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  );
}

export { AdminDashboardLayout };
export default AdminDashboardLayout;
