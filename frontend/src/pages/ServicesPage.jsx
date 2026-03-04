import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Title,
  Text,
  Stack,
  Group,
  Card,
  Button,
  Modal,
  Textarea,
  Loader,
  Center,
  SimpleGrid,
  Image,
  Badge,
  TextInput,
  Select
} from '@mantine/core';
import { AspectRatio, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import { createUsapanAppointment } from '../api/appointments.js';
import { createFamilyPlanningBooking } from '../api/familyPlanning.js';
import { useAuth } from '../context/AuthContext.jsx';
import { usePmoBooking } from '../context/PmoBookingContext.jsx';
import { getPmoAvailableSchedules } from '../api/pmo.js';
import { PmoWizardModal } from '../components/pmo/PmoWizardModal.jsx';
import { LoginModal } from '../components/auth/LoginModal.jsx';
import { isMocksEnabled, mockServices } from '../mocks/mockData.js';
// Reuse the same images as the HomePage hero carousel
import imgPMOHome from '../content/Home Images/PMOHomePage.jpg';
import imgUsapanHome from '../content/Home Images/UsapanSeriesHomePage.jpg';
import imgResponsibleParenthoodHome from '../content/Home Images/ResponsibleParenthoodHomePage.jpg';
import imgAdolescentHome from '../content/Home Images/AdolescentHomePage.jpg';
import imgPopulationAwarenessHome from '../content/Home Images/PopulationAwarenessHomePage.jpg';
import imgDemographicHome from '../content/Home Images/DemographicHomePage.jpg';
import imgCommunityEventsHome from '../content/Home Images/CommunityEventsHomePage.jpg';
import imgSupportHome from '../content/Home Images/SupportHomePage.jpg';
import dayjs from 'dayjs';

const OFFICIAL_SERVICES = [
  {
    key: 'pre-marriage-orientation',
    slug: 'pre-marriage-orientation',
    title: 'Pre-Marriage Orientation & Counseling (PMOC)',
    description:
      'Mandatory seminar for couples applying for marriage licenses covering family planning, legal rights, financial planning, conflict management, and more.',
    kind: 'requestable'
  },
  {
    key: 'usapan-series',
    slug: 'usapan-series',
    title: 'Usapan Sessions (Usapan Series)',
    description:
      'Facilitated group discussions in barangays on responsible parenthood, family planning, teen health, couples communication, and community outreach topics.',
    kind: 'requestable'
  },
  {
    key: 'rpfp',
    slug: 'rpfp',
    title: 'Family Planning',
    description:
      'Seminars on responsible parenting for couples, parents, and youth; support for household-based programs.',
    kind: 'requestable',
  },
  {
    key: 'ahdp',
    slug: 'ahdp',
    title: 'Adolescent Health and Development Program (AHDP)',
    description:
      'Youth-centered programs for teen pregnancy prevention education, peer education, and youth empowerment sessions.',
  },
  {
    key: 'iec',
    slug: 'iec',
    title: 'Population Awareness & IEC Activities',
    description:
      'Community education campaigns and distribution of flyers/posters; collaboration with schools, barangays, and health units.',
  },
  {
    key: 'population-profiling',
    slug: 'population-profiling',
    title: 'Demographic Data Collection & Population Profiling',
    description:
      'Assists the LGU in collecting population data, maintaining demographic records, and providing data for planning and policy-making.',
  },
  {
    key: 'community-events',
    slug: 'community-events',
    title: 'Support During Community Events',
    description:
      'Participation in LGU caravans and mobile population education activities to bring services to remote barangays.'
  },
  {
    key: 'other-assistance',
    slug: 'other-assistance',
    title: 'Other Assistance Service',
    description:
      'Referral-based assistance that may include support for permanent methods (for eligible clients), civil registration linkages, and special population cases, depending on municipal arrangements.',
  },
];

export function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [hoveredServiceKey, setHoveredServiceKey] = useState(null);

  const [serviceDetailsOpened, setServiceDetailsOpened] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  const [usapanFormOpened, setUsapanFormOpened] = useState(false);
  const [usapanConfirmOpened, setUsapanConfirmOpened] = useState(false);
  const [usapanPreview, setUsapanPreview] = useState(null);

  const [rpfpFormOpened, setRpfpFormOpened] = useState(false);
  const [rpfpConfirmOpened, setRpfpConfirmOpened] = useState(false);
  const [rpfpPreview, setRpfpPreview] = useState(null);

  const [pmoInfoOpened, setPmoInfoOpened] = useState(false);

  // PMO booking flow state (unified wizard modal)
  const [pmoWizardOpen, setPmoWizardOpen] = useState(false);
  const [pmoSchedulesLoading, setPmoSchedulesLoading] = useState(true);
  const [pmoSchedules, setPmoSchedules] = useState([]);
  const [pmoMonth, setPmoMonth] = useState(new Date());

  const [loginModalOpened, setLoginModalOpened] = useState(false);
  const [usapanRoleModalOpened, setUsapanRoleModalOpened] = useState(false);
  const [restrictionModalOpened, setRestrictionModalOpened] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState('');

  const auth = useAuth() || {};
  const { user, isOfficer, isAdmin, sessionExpired } = auth;
  const { updateDraft } = usePmoBooking();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useMantineTheme();
  const smBreakpoint = theme.breakpoints.sm;
  const smMaxWidth = typeof smBreakpoint === 'number' ? `${smBreakpoint}px` : smBreakpoint;
  const isMobile = useMediaQuery(`(max-width: ${smMaxWidth})`);

  const formatTime12Hour = (timeStr) => {
    if (!timeStr) return '';
    const [hRaw, mRaw] = String(timeStr).split(':');
    let h = Number(hRaw);
    const m = mRaw != null ? mRaw : '00';
    if (Number.isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m.padStart(2, '0')} ${ampm}`;
  };

  useEffect(() => {
    // Use static catalog; optionally merge with mocks when enabled
    if (isMocksEnabled()) {
      setServices(mockServices || []);
    } else {
      setServices([]);
    }
    setLoading(false);
  }, []);

  // Load PMO schedules once for the modal flow
  useEffect(() => {
    setPmoSchedulesLoading(true);
    getPmoAvailableSchedules()
      .then((res) => {
        const items = res.data.data || [];
        const mapped = items.map((r) => {
          const dateStr = new Date(r.date).toISOString().slice(0, 10);
          const start = String(r.start_time).slice(0, 5);
          return {
            id: String(r.id),
            date: `${dateStr}T${start}:00`,
            place: r.description || 'Municipal Hall – PMO Room',
            counselor: r.counselor_name || 'Assigned counselor',
            status: r.status || null,
          };
        });

        setPmoSchedules(mapped);
      })
      .catch(() => setPmoSchedules([]))
      .finally(() => setPmoSchedulesLoading(false));
  }, []);

  const handlePmoClick = () => {
    if (!user) {
      setLoginModalOpened(true);
      return;
    }
    // Only regular User role can access PMO booking
    if (isAdmin || isOfficer) {
      setRestrictionMessage('Only users with the role of User can book Pre-Marriage Orientation online.');
      setRestrictionModalOpened(true);
      return;
    }
    setPmoInfoOpened(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const book = String(params.get('book') || '').toLowerCase();
    const restricted = String(params.get('restricted') || '').toLowerCase();
    if (restricted === 'pmo') {
      if (user && (isAdmin || isOfficer)) {
        setRestrictionMessage('Only users with the role of User can book Pre-Marriage Orientation online.');
        setRestrictionModalOpened(true);
      }
      return;
    }

    if (!book) return;

    if (book === 'pmo') {
      handlePmoClick();
      return;
    }
    if (book === 'usapan') {
      handleUsapanClick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const usapanForm = useForm({
    initialValues: {
      requestedDate: null,
      requestedTime: '',
      requestedEndTime: '',
      reason: ''
    },
    validate: {
      requestedDate: (v) => {
        if (!v) return 'Please select a date';
        const today = dayjs().startOf('day');
        const d = dayjs(v).startOf('day');
        if (d.isBefore(today)) return 'Past dates and times cannot be selected.';
        return null;
      },
      requestedTime: (v) => (v ? null : 'Please select a start time'),
      requestedEndTime: (v, values) => {
        if (!v) return 'Please select an end time';
        const start = String(values.requestedTime || '');
        if (start && typeof v === 'string' && v <= start) {
          return 'End time must be later than start time';
        }
        return null;
      }
    }
  });

  const rpfpForm = useForm({
    initialValues: {
      fullName: '',
      age: '',
      contactNumber: '',
      preferredDate: null,
      notes: '',
    },
    validate: {
      fullName: (v) => (String(v || '').trim().length === 0 ? 'Full name is required' : null),
      age: (v) => {
        const n = Number(v);
        if (!n || Number.isNaN(n) || n <= 0) return 'Valid age is required';
        return null;
      },
      contactNumber: (v) => {
        const s = String(v || '').trim();
        if (!s) return 'Contact number is required';
        if (!/^09\d{9}$/.test(s)) return 'Use 11 digits starting with 09';
        return null;
      },
      preferredDate: (v) => {
        if (!v) return 'Please select a preferred date';
        const today = dayjs().startOf('day');
        const d = dayjs(v).startOf('day');
        if (d.isBefore(today)) return 'Past dates cannot be selected.';
        return null;
      },
    },
  });

  const handleRpfpSubmit = async () => {
    if (sessionExpired) {
      showNotification({
        title: 'Session expired',
        message: 'Please log in again before submitting your request.',
        color: 'red'
      });
      setLoginModalOpened(true);
      return;
    }
    if (!rpfpPreview) return;
    const values = rpfpPreview;
    try {
      const numericContact = Number(String(values.contactNumber).replace(/[^0-9]/g, ''));
      await createFamilyPlanningBooking({
        fullName: values.fullName,
        age: Number(values.age),
        contactNumber: numericContact,
        prefDate: values.preferredDate,
        notes: values.notes || null,
      });
      showNotification({
        title: 'Request submitted',
        message: 'Your RPFP counseling request has been sent. The office will contact you shortly.',
        color: 'green',
      });
      setRpfpConfirmOpened(false);
      setRpfpPreview(null);
      setRpfpFormOpened(false);
      rpfpForm.reset();
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to submit RPFP counseling request.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  const handleUsapanClick = () => {
    if (!user) {
      setLoginModalOpened(true);
      return;
    }
    // Only Barangay Officers can request Usapan-Series
    if (!isOfficer) {
      setUsapanRoleModalOpened(true);
      return;
    }
    usapanForm.reset();
    setUsapanFormOpened(true);
  };

  const handleRpfpClick = () => {
    if (!user) {
      setLoginModalOpened(true);
      return;
    }
    // Only regular User role can access Family Planning booking
    if (isAdmin || isOfficer) {
      setRestrictionMessage('Only users with the role of User can book Family Planning counseling online.');
      setRestrictionModalOpened(true);
      return;
    }
    rpfpForm.reset();
    // Pre-fill from logged-in user when available
    rpfpForm.setValues((current) => ({
      ...current,
      fullName: user?.fullName || current.fullName || '',
      contactNumber: user?.contactNumber || current.contactNumber || '',
    }));
    setRpfpPreview(null);
    setRpfpConfirmOpened(false);
    setRpfpFormOpened(true);
  };

  const handleRpfpContinue = () => {
    const { hasErrors } = rpfpForm.validate();
    if (hasErrors) return;
    const values = rpfpForm.values;
    setRpfpPreview(values);
    setRpfpFormOpened(false);
    setRpfpConfirmOpened(true);
  };

  // PMO schedule selection is managed inside the wizard via PmoBookingContext

  const handleUsapanContinue = () => {
    const { hasErrors } = usapanForm.validate();
    if (hasErrors) return;
    const values = usapanForm.values;

    if (values.requestedDate && values.requestedTime) {
      const [h, m] = String(values.requestedTime).split(':');
      const candidate = dayjs(values.requestedDate)
        .hour(Number(h) || 0)
        .minute(Number(m) || 0)
        .second(0)
        .millisecond(0);
      if (candidate.isBefore(dayjs())) {
        usapanForm.setFieldError('requestedTime', 'Past dates and times cannot be selected.');
        showNotification({
          title: 'Invalid request',
          message: 'Past dates and times cannot be selected.',
          color: 'red'
        });
        return;
      }
    }
    setUsapanPreview({
      ...values,
      barangay: user?.barangay || null
    });
    setUsapanFormOpened(false);
    setUsapanConfirmOpened(true);
  };

  const handleUsapanSubmit = async () => {
    if (sessionExpired) {
      showNotification({
        title: 'Session expired',
        message: 'Please log in again before submitting your request.',
        color: 'red'
      });
      setLoginModalOpened(true);
      return;
    }
    if (!usapanPreview) return;
    try {
      let finalRequestedDate = usapanPreview.requestedDate;
      if (usapanPreview.requestedDate && usapanPreview.requestedTime) {
        const [h, m] = String(usapanPreview.requestedTime).split(':');
        const base = dayjs(usapanPreview.requestedDate || undefined)
          .hour(Number(h) || 0)
          .minute(Number(m) || 0)
          .second(0)
          .millisecond(0);
        finalRequestedDate = base.toDate();
      }

      await createUsapanAppointment({
        requestedDate: finalRequestedDate,
        endTime: usapanPreview.requestedEndTime || null,
        reason: usapanPreview.reason
      });
      showNotification({
        title: 'Request submitted',
        message: 'Your Usapan-Series appointment request has been submitted.',
        color: 'green'
      });
      setUsapanConfirmOpened(false);
      setUsapanPreview(null);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to submit request.', color: 'red' });
    }
  };

  const preMarriageService = services.find((s) => s.slug === 'pre-marriage-orientation');
  const usapanService = services.find((s) => s.slug === 'usapan-series');

  const servicesBySlug = services.reduce((acc, s) => {
    if (s?.slug) acc[s.slug] = s;
    return acc;
  }, {});

  const displayedServices = OFFICIAL_SERVICES.map((s) => {
    const api = s.slug ? servicesBySlug[s.slug] : null;
    
    const defaultImages = {
      'pre-marriage-orientation': imgPMOHome,
      'usapan-series': imgUsapanHome,
      'rpfp': imgResponsibleParenthoodHome,
      'ahdp': imgAdolescentHome,
      'iec': imgPopulationAwarenessHome,
      'population-profiling': imgDemographicHome,
      'community-events': imgCommunityEventsHome,
      'other-assistance': imgSupportHome,
    };

    return {
      key: s.key,
      slug: s.slug || s.key,
      kind: s.kind,
      title: api?.name || s.title,
      description: api?.description || s.description,
      isActive: typeof api?.isActive === 'boolean' ? api.isActive : true,
      imageUrl: defaultImages[s.slug || s.key] // Now returns the string path correctly
    };
  });

  const servicesWithAction = displayedServices.filter((s) => s.kind === 'requestable');
  const servicesWithoutAction = displayedServices.filter((s) => s.kind !== 'requestable');

  const handleServiceCardClick = (service) => {
    if (!service || !service.slug) return;
    navigate(`/services/${service.slug}`);
  };

  const handleServiceAction = (service) => {
    if (!service || !service.isActive) return;
    if (service.slug === 'pre-marriage-orientation') {
      handlePmoClick();
    } else if (service.slug === 'usapan-series') {
      handleUsapanClick();
    } else if (service.slug === 'rpfp') {
      handleRpfpClick();
    } else {
      navigate(`/services/${service.slug}`);
    }
  };

  const getServiceActionLabel = (service) => {
    if (!service) return 'Open';
    if (service.slug === 'pre-marriage-orientation') return 'Book Orientation';
    if (service.slug === 'usapan-series') return 'Request Usapan-Series';
    if (service.slug === 'rpfp') return 'Book Family Planning';
    return 'Open';
  };

  const serviceActionButtonProps = {
    fullWidth: true,
    color: 'blue',
    variant: 'filled',
    radius: 'md',
    size: 'md',
    styles: {
      label: {
        fontWeight: 600,
        whiteSpace: 'normal',
        textAlign: 'center',
      },
    },
  };

  return (
    <Stack spacing="lg" px="lg" py="lg">
      {loading ? (
        <Center py="lg">
          <Loader />
        </Center>
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : (
        <Stack spacing="xl">
          <Stack spacing="xs">
            <Title order={1} className="hover-underline">Services</Title>
          </Stack>
          <SimpleGrid cols={isMobile ? 2 : 3} spacing="md">
            {servicesWithAction.map((service) => {
              const showAction = service.kind === 'requestable';
              const isDisabled = showAction && !service.isActive;

              return (
                <Card
                  key={service.key}
                  withBorder
                  radius="md"
                  shadow="sm"
                  className="holographic-card"
                  style={{
                    height: '100%',
                    minHeight: 340,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onClick={() => handleServiceCardClick(service)}
                  onMouseEnter={() => setHoveredServiceKey(service.key)}
                  onMouseLeave={() => setHoveredServiceKey(null)}
                >
                  <Stack style={{ height: '100%' }} spacing="sm">
                  <AspectRatio ratio={4 / 4} style={{ background: 'var(--mantine-color-gray-1)', borderRadius: 'var(--mantine-radius-sm)' }}>
                    <Image
                      src={service.imageUrl || undefined}
                      alt={service.title}
                      fit="contain"
                      styles={{ image: { objectFit: 'contain' } }}
                    />
                  </AspectRatio>

                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Text fw={700} lineClamp={2}>
                      {service.title}
                    </Text>
                  </Group>

                  <Text
                    size="sm"
                    c="dimmed"
                    style={{ flex: 1 }}
                    lineClamp={4}
                  >
                    {service.description}
                  </Text>

                  {showAction ? (
                    <Button
                      {...serviceActionButtonProps}
                      disabled={isDisabled}
                      color={serviceActionButtonProps.color}
                      variant={serviceActionButtonProps.variant}
                      styles={serviceActionButtonProps.styles}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleServiceAction(service);
                      }}
                    >
                      {getServiceActionLabel(service)}
                    </Button>
                  ) : null}
                </Stack>
              </Card>
            );
          })}
          </SimpleGrid>
      <hr />
          <Stack spacing="xs">
            <Title order={1} className="hover-underline">Other Municipal Services</Title>
          </Stack>
          <SimpleGrid cols={isMobile ? 2 : 3} spacing="md">
            {servicesWithoutAction.map((service) => {
              const showAction = service.kind === 'requestable';
              const isDisabled = showAction && !service.isActive;

              return (
                <Card
                  key={service.key}
                  withBorder
                  radius="md"
                  shadow="sm"
                  className="holographic-card"
                  style={{
                    height: '100%',
                    minHeight: 340,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onClick={() => handleServiceCardClick(service)}
                  onMouseEnter={() => setHoveredServiceKey(service.key)}
                  onMouseLeave={() => setHoveredServiceKey(null)}
                >
                  <Stack style={{ height: '100%' }} spacing="sm">
                    <AspectRatio ratio={4 / 4} style={{ background: 'var(--mantine-color-gray-1)', borderRadius: 'var(--mantine-radius-sm)' }}>
                      <Image
                        src={service.imageUrl || undefined}
                        alt={service.title}
                        fit="contain"
                        styles={{ image: { objectFit: 'contain' } }}
                      />
                    </AspectRatio>

                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text fw={700} lineClamp={2}>
                        {service.title}
                      </Text>
                    </Group>

                    <Text
                      size="sm"
                      c="dimmed"
                      style={{ flex: 1 }}
                      lineClamp={4}
                    >
                      {service.description}
                    </Text>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        </Stack>
      )}
      <hr />

      <Modal opened={pmoInfoOpened} onClose={() => setPmoInfoOpened(false)} centered size="lg" withCloseButton={false}>
        <div className="bg-white">
          <div className="card-header bg-white border-0 px-4 pt-3 pb-0">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h5 className="mb-0 fw-bold">Pre‑Marriage Orientation Booking</h5>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setPmoInfoOpened(false)}
              />
            </div>
            
          </div>
          <hr />
          <div className="card-body px-4 pt-3 pb-3">
            <Stack spacing="sm">
              <Text>
                Please review the reminders below before selecting a schedule. This helps ensure your booking and
                orientation process goes smoothly.
              </Text>

              <Card withBorder radius="md" p="md">
                <Stack spacing={6}>
                  <Text fw={700}>Required documents to bring</Text>
                  <Text size="sm">- Valid ID (for both partners)</Text>
                  <Text size="sm">- Marriage license application requirements (as advised by the Civil Registrar)</Text>
                  <Text size="sm">
                    - Any supporting documents requested by your barangay or the Municipal Civil Registrar
                  </Text>
                </Stack>
              </Card>

              <Card withBorder radius="md" p="md">
                <Stack spacing={6}>
                  <Text fw={700}>Preparations / reminders</Text>
                  <Text size="sm">- Arrive 10–15 minutes early for verification.</Text>
                  <Text size="sm">- Wear appropriate attire for a municipal office setting.</Text>
                  <Text size="sm">- Be ready to answer a short questionnaire during the booking process.</Text>
                  <Text size="sm">- If you need to reschedule, please contact the Municipal Population Office.</Text>
                </Stack>
              </Card>

              <Text size="sm" c="dimmed" style={{ textAlign: 'justify' }}> 
                Disclaimer: This information is for guidance only. Requirements may vary depending on current municipal
                policies. For clarification, please contact the Municipal Population Office. By proceeding you are also 
                giving us your consent to process your data for the purpose of scheduling and verification.
              </Text>
            </Stack>
          </div>
          <hr />
          <div className="card-footer bg-white border-0 px-4 py-3 d-flex justify-content-between align-items-center">
            <p></p>
            <Button
              onClick={() => {
                setPmoInfoOpened(false);
                setPmoWizardOpen(true);
              }}
            >
              Proceed
            </Button>
          </div>
        </div>
      </Modal>

      {/* RPFP counseling booking modal */}
      <Modal
        opened={rpfpFormOpened}
        onClose={() => setRpfpFormOpened(false)}
        centered
        withCloseButton={false}
        classNames={{ body: 'rpfp-modal-body' }}
      >
        <div className="bg-white">
          <style>{`
            .rpfp-modal-body {
              max-height: 90vh;
              overflow-y: auto;
              overflow-x: hidden;
              scrollbar-width: none; /* Firefox */
              -ms-overflow-style: none; /* IE/Edge */
            }
            .rpfp-modal-body::-webkit-scrollbar {
              width: 0px; /* Chrome, Safari */
              height: 0px;
              background: transparent;
            }
          `}</style>
          <div className="card-header bg-white border-0 px-4 pt-1 pb-3">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h5 className="mb-0 fw-bold">Family Planning Counseling</h5>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setRpfpFormOpened(false)}
              />
            </div>
          </div>

          <hr className="my-1" />

          <div className="card-body px-4 pt-2 pb-1">
            <Stack spacing="sm">
              <Text size="sm" align="justify">
                This form is for counseling requests related to family planning and RPFP services. A staff member will
                review your details and contact you to confirm the schedule.
              </Text>
            </Stack>
          </div>

          <div className="card-body px-4 pt-1 pb-3">
            <Stack>
              <TextInput
                label="Full name"
                required
                withAsterisk={false}
                placeholder="Your full name"
                {...rpfpForm.getInputProps('fullName')}
                disabled={!!user?.fullName}
              />
              <Select
                label="Age"
                required
                withAsterisk={false}
                placeholder="Select age"
                data={Array.from({ length: 83 }, (_, i) => {
                  const value = 18 + i; // 10–18
                  return { value: String(value), label: String(value) };
                })}
                value={rpfpForm.values.age ? String(rpfpForm.values.age) : null}
                onChange={(v) => rpfpForm.setFieldValue('age', v || '')}
                error={rpfpForm.errors.age}
              />
              <TextInput
                label="Contact number"
                required
                withAsterisk={false}
                placeholder="09xxxxxxxxx"
                {...rpfpForm.getInputProps('contactNumber')}
                disabled={!!user?.contactNumber}
              />
              <DatePickerInput
                label="Preferred date"
                required
                withAsterisk={false}
                firstDayOfWeek={0}
                placeholder="Select a date"
                value={rpfpForm.values.preferredDate}
                onChange={(value) => rpfpForm.setFieldValue('preferredDate', value)}
                error={rpfpForm.errors.preferredDate}
                minDate={new Date()}
              />
              <Textarea
                label="Additional notes (optional)"
                placeholder="Any information you want the office to know"
                autosize
                minRows={2}
                {...rpfpForm.getInputProps('notes')}
              />
            </Stack>
          </div>

          <hr />
          <div className="card-footer bg-white border-0 d-flex justify-content-end align-items-center">
            <Button onClick={handleRpfpContinue}>Continue</Button>
          </div>
        </div>
      </Modal>

      {/* RPFP confirmation modal */}
      <Modal
        opened={rpfpConfirmOpened}
        onClose={() => setRpfpConfirmOpened(false)}
        centered
        withCloseButton={false}
      >
        {rpfpPreview && (
          <div className="bg-white">
            <div className="card-header bg-white border-0 px-4 pt-1 pb-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="text-uppercase small text-muted fw-semibold mb-1">Confirm request</div>
                  <h5 className="mb-0 fw-bold">Family Planning Counseling Details</h5>
                </div>
              </div>
            </div>

            <hr className="my-1" />

            <div className="card-body px-4 pt-2 pb-3">
              <Stack spacing="sm">
                <Text>
                  <strong>Full name:</strong> {rpfpPreview.fullName}
                </Text>
                <Text>
                  <strong>Age:</strong> {rpfpPreview.age}
                </Text>
                <Text>
                  <strong>Contact number:</strong> {rpfpPreview.contactNumber}
                </Text>
                <Text>
                  <strong>Preferred date:</strong>{' '}
                  {rpfpPreview.preferredDate &&
                    dayjs(rpfpPreview.preferredDate).format('YYYY-MM-DD')}
                </Text>
                {rpfpPreview.notes && (
                  <Text>
                    <strong>Notes:</strong> {rpfpPreview.notes}
                  </Text>
                )}
              </Stack>
            </div>

            <hr />
            <div className="card-footer bg-white border-0 px-4 py-3 d-flex justify-content-between align-items-center">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  setRpfpConfirmOpened(false);
                  setRpfpFormOpened(true);
                }}
              >
                Back
              </Button>
              <Button onClick={handleRpfpSubmit}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Usapan-Series calendar modal */}
      <Modal
        opened={usapanFormOpened}
        onClose={() => setUsapanFormOpened(false)}
        centered
        withCloseButton={false}
      >
        <div className="bg-white">
          <div className="card-header bg-white border-0 px-4 pt-1 pb-3">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h5 className="mb-0 fw-bold">Usapan-Series Request Form</h5>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setUsapanFormOpened(false)}
              />
            </div>
          </div>

          <hr className="my-1" />

          <div className="card-body px-4 pt-2 pb-1">
            <Stack spacing="sm">
              <Text size="sm" align="justify">
                Please select your preferred date and starting time for the Usapan-Series session. The Municipal
                Population Office will coordinate with you to confirm the final schedule.
              </Text>
            </Stack>
          </div>

          <div className="card-body px-4 pt-1 pb-3">
            <Stack>
              <DatePickerInput
                label="Requested date"
                required
                placeholder="Select a date"
                firstDayOfWeek={0}
                value={usapanForm.values.requestedDate}
                onChange={(value) => usapanForm.setFieldValue('requestedDate', value)}
                minDate={new Date()}
                error={usapanForm.errors.requestedDate}
              />
              <Select
                label="Start time"
                required
                placeholder="Select a time"
                data={[
                  '08:00',
                  '09:00',
                  '10:00',
                  '11:00',
                  '13:00',
                  '14:00',
                  '15:00',
                  '16:00'
                ].map((t) => ({ value: t, label: formatTime12Hour(t) }))}
                value={usapanForm.values.requestedTime || ''}
                onChange={(value) => usapanForm.setFieldValue('requestedTime', value || '')}
                error={usapanForm.errors.requestedTime}
              />
              <Select
                label="End time"
                required
                placeholder="Select a time"
                data={[
                  '08:00',
                  '09:00',
                  '10:00',
                  '11:00',
                  '13:00',
                  '14:00',
                  '15:00',
                  '16:00'
                ].map((t) => ({ value: t, label: formatTime12Hour(t) }))}
                value={usapanForm.values.requestedEndTime || ''}
                onChange={(value) => usapanForm.setFieldValue('requestedEndTime', value || '')}
                error={usapanForm.errors.requestedEndTime}
              />
              <Textarea
                label="Reason (optional)"
                placeholder="Reason for the request"
                {...usapanForm.getInputProps('reason')}
              />
            </Stack>
          </div>
          <hr />
          <div className="card-footer bg-white border-0 px-4 py-3 d-flex justify-content-between align-items-center">
            <p></p>
            <Button onClick={handleUsapanContinue}>Continue</Button>
          </div>
        </div>
      </Modal>

      {/* Usapan-Series confirmation modal */}
      <Modal
        opened={usapanConfirmOpened}
        onClose={() => setUsapanConfirmOpened(false)}
        centered
        withCloseButton={false}
      >
        {usapanPreview && (
          <div className="bg-white">
            <div className="card-header bg-white border-0 px-4 pt-1 pb-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="text-uppercase small text-muted fw-semibold mb-1">Confirm request</div>
                  <h5 className="mb-0 fw-bold">Usapan-Series Request Form</h5>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setUsapanConfirmOpened(false)}
                />
              </div>
            </div>

            <hr className="my-1" />

            <div className="card-body px-4 pt-2 pb-3">
              <Stack spacing="sm">
                <Text>
                  <strong>Requested date:</strong>{' '}
                  {usapanPreview.requestedDate &&
                    new Date(usapanPreview.requestedDate).toLocaleDateString()}
                </Text>
                {usapanPreview.requestedTime && (
                  <Text>
                    <strong>Start time:</strong> {formatTime12Hour(usapanPreview.requestedTime)}
                  </Text>
                )}
                {usapanPreview.requestedEndTime && (
                  <Text>
                    <strong>End time:</strong> {formatTime12Hour(usapanPreview.requestedEndTime)}
                  </Text>
                )}
                <Text>
                  <strong>Officer name:</strong> {user?.fullName}
                </Text>
                <Text>
                  <strong>Barangay:</strong> {usapanPreview.barangay || user?.barangay || 'N/A'}
                </Text>
                {usapanPreview.reason && (
                  <Text>
                    <strong>Reason:</strong> {usapanPreview.reason}
                  </Text>
                )}
              </Stack>
            </div>
  <hr />
            <div className="card-footer bg-white border-0 px-4 py-3 d-flex justify-content-between align-items-center">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  setUsapanConfirmOpened(false);
                  setUsapanFormOpened(true);
                }}
              >
                Back
              </Button>
              <Button onClick={handleUsapanSubmit}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Usapan role restriction modal */}
      <Modal
        opened={usapanRoleModalOpened}
        onClose={() => setUsapanRoleModalOpened(false)}
        withCloseButton={false}
        centered
        size="sm"
        radius="lg"
      >
        <Stack gap="md">
          <div className="d-flex flex-column align-items-center text-center">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center mb-3"
              style={{ width: 56, height: 56, backgroundColor: '#eff6ff', color: '#1d4ed8' }}
            >
              <span style={{ fontSize: 24 }}>i</span>
            </div>
            <Text fw={600} size="lg" mb={2}>
              Restricted service
            </Text>
            <Text size="sm" c="dimmed">
              Only users with the role of Barangay Officer can access the Usapan-Series request feature.
            </Text>
          </div>

          <div className="d-flex flex-column gap-2 mt-2">
            <Button
              variant="default"
              fullWidth
              onClick={() => setUsapanRoleModalOpened(false)}
            >
              Close
            </Button>
          </div>
        </Stack>
      </Modal>

      {/* Generic restricted service modal for other services (PMO, Family Planning, etc.) */}
      <Modal
        opened={restrictionModalOpened}
        onClose={() => setRestrictionModalOpened(false)}
        withCloseButton={false}
        centered
        size="sm"
        radius="lg"
      >
        <Stack gap="md">
          <div className="d-flex flex-column align-items-center text-center">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center mb-3"
              style={{ width: 56, height: 56, backgroundColor: '#eff6ff', color: '#1d4ed8' }}
            >
              <span style={{ fontSize: 24 }}>i</span>
            </div>
            <Text fw={600} size="lg" mb={2}>
              Restricted service
            </Text>
            <Text size="sm" c="dimmed">
              {restrictionMessage || 'You do not have access to this service with your current role.'}
            </Text>
          </div>

          <div className="d-flex flex-column gap-2 mt-2">
            <Button
              variant="default"
              fullWidth
              onClick={() => setRestrictionModalOpened(false)}
            >
              Close
            </Button>
          </div>
        </Stack>
      </Modal>

      <PmoWizardModal
        opened={pmoWizardOpen}
        onClose={() => setPmoWizardOpen(false)}
        schedulesLoading={pmoSchedulesLoading}
        schedules={pmoSchedules}
        month={pmoMonth}
        setMonth={setPmoMonth}
      />

      <LoginModal opened={loginModalOpened} onClose={() => setLoginModalOpened(false)} />
    </Stack>
  );
}
