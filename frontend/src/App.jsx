import React, { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';

import { AppShellLayout } from './layout/AppShellLayout.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';

import { HomePage } from './pages/HomePageBootstrap.jsx';
import { NewsDetailPage } from './pages/NewsDetailPage.jsx';
import { ServicesPage } from './pages/ServicesPage.jsx';
import { PreMarriageOrientation } from './pages/services/PreMarriageOrientation.jsx';
import { MeifTemplate } from './pages/services/MeifTemplate.jsx';
import { UsapanSeries } from './pages/services/UsapanSeries.jsx';
import { RpfpBootstrap } from './pages/services/RpfpBootstrap.jsx';
import { Ahdp } from './pages/services/Ahdp.jsx';
import { Iec } from './pages/services/Iec.jsx';
import { PopulationProfiling } from './pages/services/PopulationProfiling.jsx';
import { CommunityEvents } from './pages/services/CommunityEvents.jsx';
import { OtherAssistance } from './pages/services/OtherAssistance.jsx';
import { CalendarPage } from './pages/CalendarPage.jsx';
import { EducationPage } from './pages/EducationPage.jsx';
import { EducationDetailPage } from './pages/EducationDetailPage.jsx';
import { FAQPage } from './pages/FAQPage.jsx';
import { ContactPage } from './pages/ContactPage.jsx';
import { AdminDashboardLayout } from './admin/AdminDashboardLayout.jsx';
import { GeneralLayout } from './admin/GeneralLayout.jsx';
import { PmoLayout } from './admin/PmoLayout.jsx';
import { UsapanLayout } from './admin/UsapanLayout.jsx';
import { GeneralAnalytics } from './admin/pages/GeneralAnalytics.jsx';
import { UsapanAnalytics } from './admin/pages/UsapanAnalytics.jsx';
import { AdminAnalytics } from './admin/pages/AdminAnalytics.jsx';
import { NewsAdmin } from './admin/pages/NewsAdmin.jsx';
import { AnnouncementsCalendar } from './admin/pages/AnnouncementsCalendar.jsx';
import { FeedbackAdmin } from './admin/pages/FeedbackAdmin.jsx';
import { FamilyPlanningAdmin } from './admin/pages/FamilyPlanningAdmin.jsx';
import { AccountsAdmin } from './admin/pages/AccountsAdmin.jsx';
import { FileTasksAdmin } from './admin/pages/FileTasksAdminNew.jsx';
import { EducationWebAdmin } from './admin/pages/EducationWebAdmin.jsx';
import { EducationBookletsAdmin } from './admin/pages/EducationBookletsAdmin.jsx';
import { PmoAnalytics } from './admin/pages/PmoAnalytics.jsx';
import { PmoSchedules } from './admin/pages/PmoSchedules.jsx';
import { PmoAppointments } from './admin/pages/PmoAppointments.jsx';
import { PmoQuestionnaire } from './admin/pages/PmoQuestionnaire.jsx';
import { PmoAnswers } from './admin/pages/PmoAnswers.jsx';
import { PmoCounselors } from './admin/pages/PmoCounselors.jsx';
import { PmoSmsLogs } from './admin/pages/PmoSmsLogs.jsx';
import { PmoMeifPrint } from './admin/pages/PmoMeifPrint.jsx';
import { UsapanSchedules } from './admin/pages/UsapanSchedules.jsx';
import { UsapanRequests } from './admin/pages/UsapanRequests.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <AppShellLayout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/news/:id" element={<NewsDetailPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/pre-marriage-orientation" element={<PreMarriageOrientation />} />
        <Route path="/services/meif-template" element={<MeifTemplate />} />
        <Route path="/services/usapan-series" element={<UsapanSeries />} />
        <Route path="/services/rpfp" element={<RpfpBootstrap />} />
        <Route path="/services/ahdp" element={<Ahdp />} />
        <Route path="/services/iec" element={<Iec />} />
        <Route path="/services/population-profiling" element={<PopulationProfiling />} />
        <Route path="/services/community-events" element={<CommunityEvents />} />
        <Route path="/services/other-assistance" element={<OtherAssistance />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/education" element={<EducationPage />} />
        <Route path="/education/:id" element={<EducationDetailPage />} />
        <Route path="/faqs" element={<FAQPage />} />
        <Route path="/contact" element={<ContactPage />} />

        {/* Legacy PMO booking pages removed in favor of PMOWizardModal */}

        <Route element={<ProtectedRoute roles={['Admin', 'Barangay Officer']} />}>
          <Route path="/admin" element={<AdminDashboardLayout />}>
            <Route index element={<Navigate to="/admin/analytics" replace />} />

            <Route path="analytics" element={<AdminAnalytics />} />

            <Route path="general" element={<GeneralLayout />}>
              <Route index element={<Navigate to="news" replace />} />
              <Route path="news" element={<NewsAdmin />} />
              <Route path="announcements" element={<AnnouncementsCalendar />} />
              <Route path="feedback" element={<FeedbackAdmin />} />
              <Route path="family-planning" element={<FamilyPlanningAdmin />} />
              <Route path="accounts" element={<AccountsAdmin />} />
              <Route path="file-tasks" element={<FileTasksAdmin />} />
              <Route path="education-web" element={<EducationWebAdmin />} />
              <Route path="education-booklets" element={<EducationBookletsAdmin />} />
            </Route>

            <Route element={<ProtectedRoute roles={['Admin']} />}>
              <Route path="pmo" element={<PmoLayout />}>
                <Route index element={<Navigate to="schedules" replace />} />
                <Route path="schedules" element={<PmoSchedules />} />
                <Route path="appointments" element={<PmoAppointments />} />
                <Route path="appointments/:id/meif" element={<PmoMeifPrint />} />
                <Route path="questionnaire" element={<PmoQuestionnaire />} />
                <Route path="answers" element={<PmoAnswers />} />
                <Route path="counselors" element={<PmoCounselors />} />
                <Route path="sms-logs" element={<PmoSmsLogs />} />
              </Route>
            </Route>

            <Route path="usapan" element={<UsapanLayout />}>
              <Route index element={<Navigate to="schedules" replace />} />
              <Route path="schedules" element={<UsapanSchedules />} />
              <Route path="requests" element={<UsapanRequests />} />
            </Route>
          </Route>
        </Route>

      </Routes>
    </AppShellLayout>
  );
}
