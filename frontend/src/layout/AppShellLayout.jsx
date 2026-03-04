import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  AppShell, Group, Anchor, Button, Text, Avatar, 
  Burger, Drawer, Stack, Divider, ScrollArea, Menu, Accordion, Modal
} from '@mantine/core';

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';

import { useAuth } from '../context/AuthContext.jsx';
import { LoginModal } from '../components/auth/LoginModal.jsx';
import { RegisterModal } from '../components/auth/RegisterModal.jsx';
import { ProfileModal } from '../components/profile/ProfileModal.jsx';
import { DeleteConfirmModal } from '../components/common/DeleteConfirmModal.jsx';

import popcomLogo from '../content/POPCOM-Logo.jpg';
import popcomBanner from '../content/POPCOM-Banner.jpg';
import Page1Image from '../content/User Manual Images/Page1Image.png';
import Page2Image from '../content/User Manual Images/Page2Image.png';
import Page3Image from '../content/User Manual Images/Page3Image.png';
import Page4Image from '../content/User Manual Images/Page4Image.png';
import Page5Image from '../content/User Manual Images/Page5Image.png';
import Page6Image from '../content/User Manual Images/Page6Image.png';

export function AppShellLayout({ children }) {
  const auth = useAuth() || {};
  const { user, isAdmin, isOfficer, logout, loading } = auth;

  const location = useLocation();
  const navigate = useNavigate();

  const [loginModalOpened, setLoginModalOpened] = useState(false);
  const [registerModalOpened, setRegisterModalOpened] = useState(false);
  const [profileModalOpened, setProfileModalOpened] = useState(false);
  const [sessionExpiredModalOpened, setSessionExpiredModalOpened] = useState(false);
  const [helpModalOpened, setHelpModalOpened] = useState(false);
  const [helpSlide, setHelpSlide] = useState(0);

  const [mobileNavOpened, setMobileNavOpened] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);

  const hasShownLandingLoginRef = useRef(false);

  const isMobile = useMediaQuery('(max-width: 768px)');
  // Match Bootstrap's lg breakpoint (navbar uses d-none d-lg-block)
  const isCompactNav = useMediaQuery('(max-width: 991px)');

  const headerHeight = 64;
  const footerHeight = 52;

  // Synced with your ServicesPage OFFICIAL_SERVICES slugs
  const serviceItems = [
    { to: '/services', label: 'View All Services' },
    { to: '/services/pre-marriage-orientation', label: 'Pre-Marriage Orientation (PMOC)' },
    { to: '/services/usapan-series', label: 'Usapan Sessions' },
    { to: '/services/rpfp', label: 'Responsible Parenthood (RPFP)' },
    { to: '/services/ahdp', label: 'Adolescent Health (AHDP)' },
    { to: '/services/iec', label: 'Population Awareness (IEC)' },
    { to: '/services/population-profiling', label: 'Demographic Profiling' },
    { to: '/services/community-events', label: 'Community Events' },
    { to: '/services/other-assistance', label: 'Other Assistance' },
  ];

  const links = [
    { to: '/', label: 'Home' },
    { to: '/news', label: 'News' },
    { to: '/services', label: 'Services', hasDropdown: true },
    { to: '/calendar', label: 'Schedule of Activities' },
    { to: '/education', label: 'Education Corner' },
    { to: '/faqs', label: 'FAQ' },
    { to: '/contact', label: 'About Us' }
  ];

  const utilityLinks = useMemo(() => {
    const items = [];
    if (isAdmin) items.push({ to: '/admin', label: 'Admin Dashboard' });
    return items;
  }, [isAdmin]);

  const isCalendarPage = location.pathname === '/calendar';
  const isHomePage = location.pathname === '/';
  const isAdminPage = location.pathname.startsWith('/admin');
  const isServicesPage = location.pathname.startsWith('/services');

  const activeNavStyle = { fontWeight: 600, color: '#0d6efd' };

  const manualPages = [
    {
      title: 'Overview',
      content: (
        <>
          <img
            src={Page1Image}
            alt="POPCOM system overview"
            className="img-fluid mb-3"
            style={{ maxHeight: 220, width: '100%', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }}
          />

          <Text size="sm" mb="sm">
            This system helps the San Fabian Population Office manage services such as news, education materials,
            PMO bookings, Usapan sessions, and analytics.
          </Text>
          <Text size="sm" fw={600} mb={4}>Who can use this system?</Text>
          <ul className="small mb-2">
            <li>Citizens can view public information and submit service requests.</li>
            <li>Barangay Officers can access additional tools relevant to their area.</li>
            <li>Admins can manage all content, schedules, and analytics.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Public website navigation',
      content: (
        <>
          <img
            src={Page2Image}
            alt="Public website navigation"
            className="img-fluid mb-3"
            style={{ maxHeight: 220, width: '100%', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }}
          />

          <Text size="sm" fw={600} mb={4}>Top navigation bar</Text>
          <ul className="small mb-2">
            <li><b>Home</b> – overview, announcements, and shortcuts to services.</li>
            <li><b>Services</b> – list of all population services with details and online forms.</li>
            <li><b>Schedule of Activities</b> – calendar of upcoming activities.</li>
            <li><b>Education Corner</b> – articles and educational resources.</li>
            <li><b>FAQ</b> – common questions and answers.</li>
            <li><b>About Us</b> – office profile and contact information.</li>
          </ul>
          <Text size="sm" fw={600} mb={4}>Logging in</Text>
          <ul className="small mb-2">
            <li>Use the <b>Login</b> button in the header to sign in.</li>
            <li>Once logged in, you can access your profile and, if authorized, the Admin Dashboard.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Admin role guide',
      content: (
        <>
          <img
            src={Page3Image}
            alt="Admin role guide"
            className="img-fluid mb-3"
            style={{ maxHeight: 220, width: '100%', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }}
          />

          <Text size="sm" fw={600} mb={4}>What Admins can do</Text>
          <ul className="small mb-2">
            <li>Access the full <b>Admin Dashboard</b> after logging in as Admin.</li>
            <li>Manage news, announcements, feedback, file tasks, and family planning bookings.</li>
            <li>Configure and monitor <b>PMO</b> schedules, appointments, MEIF forms, questionnaire, counselors, and SMS logs.</li>
            <li>Oversee <b>Usapan</b> schedules and requests.</li>
            <li>View and export summary statistics in the <b>Analytics</b> section.</li>
          </ul>
          <Text size="sm" fw={600} mb={4}>Key responsibilities</Text>
          <ul className="small mb-2">
            <li>Ensure schedules and services are up-to-date.</li>
            <li>Review and approve or reject bookings in a timely manner.</li>
            <li>Monitor SMS and email notifications and address failed sends.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Barangay Officer guide',
      content: (
        <>
          <img
            src={Page4Image}
            alt="Barangay Officer guide"
            className="img-fluid mb-3"
            style={{ maxHeight: 220, width: '100%', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }}
          />

          <Text size="sm" fw={600} mb={4}>What Barangay Officers can do</Text>
          <ul className="small mb-2">
            <li>Log in using the account assigned to your barangay.</li>
            <li>Open your <b>Profile</b> from the header to see <b>Usapan-Series Requests</b> assigned to your barangay.</li>
            <li>Upload required files/documents in your profile when the Admin gives you a specific task.</li>
            <li>Help residents with PMO bookings and Usapan requests if they do not have internet access.</li>
            <li>Coordinate schedules and confirm attendance for sessions held in your barangay.</li>
          </ul>
          <Text size="sm" fw={600} mb={4}>Good practices</Text>
          <ul className="small mb-2">
            <li>Regularly check pending requests from your barangay.</li>
            <li>Verify residents’ contact numbers before submitting bookings or requests.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Users / Citizens guide',
      content: (
        <>
          <img
            src={Page5Image}
            alt="Users and Citizens guide"
            className="img-fluid mb-3"
            style={{ maxHeight: 220, width: '100%', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }}
          />

          <Text size="sm" fw={600} mb={4}>For Users and Citizens</Text>
          <ul className="small mb-2">
            <li>Use the public pages (Home, Services, Calendar, Education Corner, FAQ, About Us) to learn about programs.</li>
            <li>From <b>Services</b>, open the specific booking services (e.g., Pre-Marriage Orientation or Family Planning Counseling) to submit online forms.</li>
            <li>Wait for SMS or call confirmation from the Population Office for booking status and schedules.</li>
          </ul>
          <Text size="sm" fw={600} mb={4}>Keeping your information accurate</Text>
          <ul className="small mb-2">
            <li>Provide a correct mobile number and check messages regularly.</li>
            <li>Inform the office if you need to reschedule or cancel a booking.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Getting more help',
      content: (
        <>
          <img
            src={Page6Image}
            alt="Help and support"
            className="img-fluid mb-3"
            style={{ maxHeight: 220, width: '100%', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }}
          />

          <Text size="sm" mb="sm">
            If you encounter issues (errors, missing data, or questions about how to record a case), please reach out
            to the Population Office.
          </Text>
          <ul className="small mb-2">
            <li>Use the contact information in the footer or the <b>About Us</b> page.</li>
            <li>When reporting a problem, include the date, page URL, and a short description of what happened.</li>
            <li>You can also send message to us via the <b>Feedback form</b> located in the sidebar of the About Us page.</li>
          </ul>
        </>
      ),
    },
  ];

  // Services dropdown hover handlers
  const servicesDropdownRef = useRef(null);

  const openServicesDropdown = () => {
    const el = servicesDropdownRef.current;
    if (!el) return;
    el.classList.add('show');
    const menu = el.querySelector('.dropdown-menu');
    if (menu) menu.classList.add('show');
    const toggle = el.querySelector('[data-bs-toggle="dropdown"]');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  };

  const closeServicesDropdown = () => {
    const el = servicesDropdownRef.current;
    if (!el) return;
    el.classList.remove('show');
    const menu = el.querySelector('.dropdown-menu');
    if (menu) menu.classList.remove('show');
    const toggle = el.querySelector('[data-bs-toggle="dropdown"]');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  };

  const handleServiceClick = () => {
    closeServicesDropdown();
  };

  useEffect(() => {
    setMobileNavOpened(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = () => {
      if (user) {
        // Close any open popups and clear their local input state by unmounting them
        setLoginModalOpened(false);
        setRegisterModalOpened(false);
        setProfileModalOpened(false);

        // Then show the global Session Expired dialog
        setSessionExpiredModalOpened(true);
      }
    };
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, [user]);

  // Listen for brochure viewer open/close events so we can hide the help button
  useEffect(() => {
    const handler = (e) => {
      const opened = !!(e && e.detail && e.detail.opened);
      setBrochureViewerOpen(opened);
    };
    window.addEventListener('brochure-viewer-toggle', handler);
    return () => window.removeEventListener('brochure-viewer-toggle', handler);
  }, []);

  const [brochureViewerOpen, setBrochureViewerOpen] = useState(false);

  // Previously auto-opened the login modal on the home page for guests;
  // this behavior has been removed so the login modal opens only on explicit user action.

  return (
    <AppShell
      header={{ height: headerHeight }}
      padding="0"
    >
      <AppShell.Header px="0">
        <nav className="navbar navbar-expand-lg sticky-top bg-white">
          <div className="container d-flex align-items-center justify-content-between">
            <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
              <img src={popcomLogo} width="32" height="32" className="rounded" />
              <span className="fw-semibold">San Fabian Population Office</span>
            </Link>

            {/* Mobile/compact burger: shown whenever desktop nav is hidden */}
            {isCompactNav && (
              <Burger
                onClick={() => setMobileNavOpened((o) => !o)}
                aria-label="Toggle navigation menu"
                size="md"
                style={{
                  borderRadius: 9999,
                  padding: 4,
                }}
              />
            )}

            {/* Desktop navigation */}
            <div className="collapse navbar-collapse d-none d-lg-block" id="mainTopNav">
              <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-lg-2">
                <li className="nav-item">
                  <Link
                    to="/"
                    className={`nav-link${location.pathname === '/' ? ' active' : ''}`}
                    style={location.pathname === '/' ? activeNavStyle : undefined}
                  >
                    Home
                  </Link>
                </li>

                <li
                  className="nav-item dropdown"
                  ref={servicesDropdownRef}
                  onMouseEnter={openServicesDropdown}
                  onMouseLeave={closeServicesDropdown}
                >
                  <a
                    className={`nav-link dropdown-toggle${location.pathname.startsWith('/services') ? ' active' : ''}`}
                    href="#"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    style={location.pathname.startsWith('/services') ? activeNavStyle : undefined}
                  >
                    Services
                  </a>
                  <ul className="dropdown-menu">
                    <li><Link className="dropdown-item" to="/services" onClick={handleServiceClick}>View All Services</Link></li>
                    <li><hr className="dropdown-divider" /></li>
                    {serviceItems.map((s) => (
                      <li key={s.to}><Link className="dropdown-item" to={s.to} onClick={handleServiceClick}>{s.label}</Link></li>
                    ))}
                  </ul>
                </li>

                <li className="nav-item">
                  <Link
                    to="/calendar"
                    className={`nav-link${location.pathname.startsWith('/calendar') ? ' active' : ''}`}
                    style={location.pathname.startsWith('/calendar') ? activeNavStyle : undefined}
                  >
                    Schedule of Activities
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/education"
                    className={`nav-link${location.pathname.startsWith('/education') ? ' active' : ''}`}
                    style={location.pathname.startsWith('/education') ? activeNavStyle : undefined}
                  >
                    Education Corner
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/faqs"
                    className={`nav-link${location.pathname.startsWith('/faqs') ? ' active' : ''}`}
                    style={location.pathname.startsWith('/faqs') ? activeNavStyle : undefined}
                  >
                    FAQ
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/contact"
                    className={`nav-link${location.pathname.startsWith('/contact') ? ' active' : ''}`}
                    style={location.pathname.startsWith('/contact') ? activeNavStyle : undefined}
                  >
                    About Us
                  </Link>
                </li>

                {isAdmin && (
                  <li className="nav-item">
                    <Link to="/admin" className="btn btn-outline-secondary btn-sm ms-lg-2">Admin Dashboard</Link>
                  </li>
                )}
                {user && !isAdmin && (
                  <li className="nav-item">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm ms-lg-2"
                      onClick={() => setProfileModalOpened(true)}
                    >
                      {isOfficer ? 'Officer Profile' : 'Profile'}
                    </button>
                  </li>
                )}

                <li className="nav-item ms-lg-2">
                  {user ? (
                    <button className="btn btn-link btn-sm text-decoration-none" onClick={logout}>Logout</button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => setLoginModalOpened(true)}>Login</button>
                  )}
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </AppShell.Header>

      {/* Mobile/compact navigation drawer (slides in from the left) */}
      {isCompactNav && (
        <Drawer
          opened={mobileNavOpened}
          onClose={() => { setMobileNavOpened(false); setMobileServicesOpen(false); }}
          position="left"
          size="60%"
          padding="md"
          title="San Fabian Population Office"
        >
          <Stack spacing="sm">
            <Link
              to="/"
              onClick={() => { setMobileNavOpened(false); setMobileServicesOpen(false); }}
              className="text-decoration-none"
            >
              Home
            </Link>
            <button
              type="button"
              className="p-0 border-0 bg-transparent text-start text-decoration-none text-primary"
              style={{ cursor: 'pointer', outline: 'none', boxShadow: 'none' }}
              onClick={() => setMobileServicesOpen((o) => !o)}
            >
              Services
            </button>

            {mobileServicesOpen && serviceItems.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                onClick={() => { setMobileNavOpened(false); setMobileServicesOpen(false); }}
                className="ms-3 text-decoration-none small"
              >
                {s.label}
              </Link>
            ))}
            <Link
              to="/calendar"
              onClick={() => { setMobileNavOpened(false); setMobileServicesOpen(false); }}
              className="text-decoration-none"
            >
              Schedule of Activities
            </Link>
            <Link
              to="/education"
              onClick={() => { setMobileNavOpened(false); setMobileServicesOpen(false); }}
              className="text-decoration-none"
            >
              Education Corner
            </Link>
            <Link
              to="/faqs"
              onClick={() => { setMobileNavOpened(false); setMobileServicesOpen(false); }}
              className="text-decoration-none"
            >
              FAQ
            </Link>
            <Link
              to="/contact"
              onClick={() => { setMobileNavOpened(false); setMobileServicesOpen(false); }}
              className="text-decoration-none"
            >
              About Us
            </Link>

            <hr />

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => { setMobileNavOpened(false); setMobileServicesOpen(false); }}
                className="text-decoration-none"
              >
                Admin Dashboard
              </Link>
            )}

            {user && !isAdmin && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm text-center"
                onClick={() => {
                  setMobileNavOpened(false);
                  setMobileServicesOpen(false);
                  setProfileModalOpened(true);
                }}
                style={{ width: '40%' }}
              >
                {isOfficer ? 'Officer Profile' : 'Profile'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm mt-2 text-center"

              onClick={() => {
                setMobileNavOpened(false);
                setMobileServicesOpen(false);
                if (user) {
                  logout();
                } else {
                  setLoginModalOpened(true);
                }
              }}
              style={{ width: '40%' }}
            >
              {user ? 'Logout' : 'Login'}
            </button>
          </Stack>
        </Drawer>
      )}

      {/* FLEX WRAPPER: This ensures the footer stays at the bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppShell.Main
          style={{ minHeight: `calc(100vh - ${headerHeight + footerHeight}px)` }}
        >
          <div
            style={{ minHeight: '100%', paddingBottom: isHomePage ? 0 : 16 }}
          >
            {!isServicesPage && (
              <div className="w-100 border-bottom">
                <div className="container" align="center">
                  <img
                    src={popcomBanner}
                    alt="Commission on Population and Development (POPCOM) banner"
                    className="img-fluid w-60"
                    style={{ maxHeight: 200, objectFit: 'cover', padding: '1rem'}}
                  />
                </div>
              </div>
            )}
            {isHomePage || isAdminPage ? (
              children
            ) : (
              <div className="container">
                {children}
              </div>
            )}
          </div>
        </AppShell.Main> 

        {/* FOOTER SECTION: Non-sticky, but always at bottom */}
        <footer className="w-100 mt-auto">
          <div className="bg-primary text-white py-5">
            <div className="container">
              <div className="row g-4">
                <div className="col-12 col-md-4">
                  <h6 className="text-uppercase fw-bold mb-3">About Us</h6>
                  <p className="mb-1 small">Municipal Hall, Kadiwa Building, San Fabian, Pangasinan</p>
                  <p className="mb-1 small">Contact Number: 0915-811-2320</p>
                  <p className="mb-0 small">Email: sanfabian.munpopcom@gmail.com</p>
                </div>
                <div className="col-12 col-md-4">
                  <h6 className="text-uppercase fw-bold mb-3">Connect With Us</h6>
                  <div className="d-flex align-items-center gap-2">
                    <a className="btn btn-sm btn-outline-light" href="https://www.facebook.com/profile.php?id=100087014496500" aria-label="Facebook"> Facebook </a>
                    {/*<a className="btn btn-sm btn-outline-light" href="#" aria-label="Instagram"> Instagram </a>*/}
                    {/*<a className="btn btn-sm btn-outline-light" href="#" aria-label="YouTube"> YouTube </a>*/}
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <h6 className="text-uppercase fw-bold mb-3">Sitemap</h6>
                  <ul className="list-unstyled small mb-0 row row-cols-2 g-1">
                    <li className="col"><Link className="text-white text-decoration-none" to="/">Home</Link></li>
                    <li className="col"><Link className="text-white text-decoration-none" to="/services">Services</Link></li>
                    <li className="col"><Link className="text-white text-decoration-none" to="/calendar">Schedule of Activities</Link></li>
                    <li className="col"><Link className="text-white text-decoration-none" to="/education">Education Corner</Link></li>
                    <li className="col"><Link className="text-white text-decoration-none" to="/faqs">FAQ</Link></li>
                    <li className="col"><Link className="text-white text-decoration-none" to="/contact">About Us</Link></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Global floating help button (hidden while brochure viewer or profile modal is open) */}
      {!brochureViewerOpen && !profileModalOpened && (
        <button
          type="button"
          onClick={() => { setHelpSlide(0); setHelpModalOpened(true); }}
          className="btn btn-primary rounded-circle shadow"
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            width: '44px',
            height: '44px',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '22px',
          }}
          aria-label="Open system manual"
        >
          ?
        </button>
      )}

      {/* Global floating "Go to Top" button (always visible) */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="btn btn-primary rounded-circle shadow"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '44px',
          height: '44px',
          zIndex: 1900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '18px',
        }}
        aria-label="Go to top"
      >
        ↑
      </button>

      {/* MODALS */}
      <LoginModal
        opened={loginModalOpened}
        onClose={() => setLoginModalOpened(false)}
        onOpenRegister={() => setRegisterModalOpened(true)}
      />
      <RegisterModal
        opened={registerModalOpened}
        onClose={() => setRegisterModalOpened(false)}
        onOpenLogin={() => setLoginModalOpened(true)}
      />
      <ProfileModal
        opened={profileModalOpened}
        onClose={() => setProfileModalOpened(false)}
      />
      <Modal
        opened={helpModalOpened}
        onClose={() => setHelpModalOpened(false)}
        title={manualPages[helpSlide]?.title || 'System Manual'}
        size="lg"
        centered
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <div className="mb-2 small text-muted">
          Page {helpSlide + 1} of {manualPages.length}
        </div>
        <div
          className="mb-3"
          style={{ textAlign: 'justify' }}
        >
          {manualPages[helpSlide]?.content}
        </div>
        <div className="d-flex justify-content-between align-items-center mt-3">
          <Button
            size="xs"
            variant="subtle"
            disabled={helpSlide === 0}
            onClick={() => setHelpSlide((s) => Math.max(0, s - 1))}
          >
            Previous
          </Button>
          <div className="d-flex align-items-center gap-1">
            {manualPages.map((_, idx) => (
              <span
                key={idx}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: idx === helpSlide ? '#0d6efd' : '#ced4da',
                  display: 'inline-block',
                }}
              />
            ))}
          </div>
          <Button
            size="xs"
            disabled={helpSlide === manualPages.length - 1}
            onClick={() => setHelpSlide((s) => Math.min(manualPages.length - 1, s + 1))}
          >
            Next
          </Button>
        </div>
      </Modal>

      <DeleteConfirmModal
        opened={sessionExpiredModalOpened}
        onCancel={() => {
          setSessionExpiredModalOpened(false);
          navigate('/', { replace: true });
        }}
        onConfirm={() => {
          setSessionExpiredModalOpened(false);
          logout();
          setLoginModalOpened(true);
        }}
        title="Session expired"
        message="Your session has expired. Please log in again to continue."
        confirmLabel="Log in"
        cancelLabel="Go to Home"
        closeOnEscape={false}
        closeOnClickOutside={false}
      />
    </AppShell>
  );
}