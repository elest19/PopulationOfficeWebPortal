import React, { useMemo, useState } from 'react';
import { Title, Text, Stack, Card, TextInput, Textarea, Button, Group, Paper, Modal, Select, Loader, Center, FileInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import { submitFeedback } from '../api/feedback.js';
import { getHierarchy, createHierarchyEntry, updateHierarchyEntry, deleteHierarchyEntry } from '../api/hierarchy.js';
import { getMainOffice, updateMainOffice } from '../api/offices.js';
import { uploadAboutUsImage } from '../api/uploads.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LoginModal } from '../components/auth/LoginModal.jsx';
import { RegisterModal } from '../components/auth/RegisterModal.jsx';
import aboutUsImage from '../content/About Us/AboutUs.jpg';
import sanFabianLogo from '../content/About Us/SanFabian-Logo.png';

const HIERARCHY_POSITIONS = [
  'Mayor',
  'Vice Mayor',
  'Population Office Head',
  'Population Office Staff',
  'Barangay Representative'
];

export function ContactPage() {
  const { user, accessToken, isAdmin } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [hierarchy, setHierarchy] = useState([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyModalMode, setHierarchyModalMode] = useState(null); // 'add' | 'edit' | 'delete'
  const [hierarchyModalOpen, setHierarchyModalOpen] = useState(false);
  const [hierarchySaving, setHierarchySaving] = useState(false);
  const [selectedHierarchyId, setSelectedHierarchyId] = useState(null);
  const [hierarchyName, setHierarchyName] = useState('');
  const [hierarchyPosition, setHierarchyPosition] = useState('');
  const [feedbackConfirmOpen, setFeedbackConfirmOpen] = useState(false);
  const [office, setOffice] = useState(null);
  const [officeLoading, setOfficeLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [officeEditOpen, setOfficeEditOpen] = useState(false);

  const officeForm = useForm({
    initialValues: {
      officeName: '',
      address: '',
      contactNumber: '',
      email: '',
      officeHead: ''
    },
    validate: {
      officeName: (v) => (v.trim().length === 0 ? 'Office name is required' : null),
      address: (v) => (v.trim().length === 0 ? 'Address is required' : null),
      contactNumber: (v) => (v.trim().length === 0 ? 'Contact number is required' : null),
      email: (v) => (v.trim().length === 0 ? 'Email is required' : null),
      officeHead: (v) => (v.trim().length === 0 ? 'Office head is required' : null)
    }
  });

  const initialUser = useMemo(() => ({
    fullName: user?.fullName || '',
    email: user?.email || '',
    contactNumber: user?.contactNumber || '',
    barangay: user?.barangay || ''
  }), [user]);

  const form = useForm({
    initialValues: {
      fullName: initialUser.fullName,
      email: initialUser.email,
      contactNumber: initialUser.contactNumber,
      barangay: initialUser.barangay,
      message: ''
    },
    validate: {
      message: (v) => (v.trim().length === 0 ? 'Please enter your message' : null)
    }
  });

  // Sync read-only user fields when auth state changes (e.g., after login)
  React.useEffect(() => {
    form.setValues({
      fullName: initialUser.fullName,
      email: initialUser.email,
      contactNumber: initialUser.contactNumber,
      barangay: initialUser.barangay,
      message: form.values.message
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser.fullName, initialUser.email, initialUser.contactNumber, initialUser.barangay]);

  // Load hierarchy data
  React.useEffect(() => {
    const loadHierarchy = async () => {
      setHierarchyLoading(true);
      try {
        const res = await getHierarchy();
        setHierarchy(res.data?.data || []);
      } catch (err) {
        console.error('Failed to load hierarchy', err);
      } finally {
        setHierarchyLoading(false);
      }
    };
    loadHierarchy().catch(() => {});
  }, []);

  const handleReplaceImage = async () => {
    if (!isAdmin || imageUploading) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      try {
        setImageUploading(true);
        const uploadRes = await uploadAboutUsImage(file);
        const publicUrl = uploadRes?.data?.data?.publicUrl;
        if (!publicUrl) {
          showNotification({ title: 'Error', message: 'Failed to upload image.', color: 'red' });
          return;
        }

        const payload = { officeImageUrl: publicUrl };
        const updateRes = await updateMainOffice(payload);
        setOffice(updateRes.data?.data || null);
        showNotification({ title: 'Updated', message: 'Office image updated.', color: 'green' });
      } catch (err) {
        console.error('Failed to replace office image', err);
        const msg = err?.response?.data?.error?.message || 'Failed to replace office image.';
        showNotification({ title: 'Error', message: msg, color: 'red' });
      } finally {
        setImageUploading(false);
      }
    };

    input.click();
  };

  const openOfficeEdit = () => {
    if (office) {
      officeForm.setValues({
        officeName: office.officeName || '',
        address: office.address || '',
        contactNumber: office.contactNumber || '',
        email: office.email || '',
        officeHead: office.officeHead || ''
      });
    }
    setOfficeEditOpen(true);
  };

  const handleOfficeSave = async (values) => {
    try {
      const payload = {
        officeName: values.officeName,
        address: values.address,
        contactNumber: values.contactNumber,
        email: values.email,
        officeHead: values.officeHead
      };

      const res = await updateMainOffice(payload);
      setOffice(res.data?.data || null);
      showNotification({ title: 'Saved', message: 'Office details updated.', color: 'green' });
      setOfficeEditOpen(false);
    } catch (err) {
      console.error('Failed to update office details', err);
      const msg = err?.response?.data?.error?.message || 'Failed to update office details.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  // Load main office contact info
  React.useEffect(() => {
    const loadOffice = async () => {
      setOfficeLoading(true);
      try {
        const res = await getMainOffice();
        setOffice(res.data?.data || null);
        const data = res.data?.data;
        if (data) {
          officeForm.setValues({
            officeName: data.officeName || '',
            address: data.address || '',
            contactNumber: data.contactNumber || '',
            email: data.email || '',
            officeHead: data.officeHead || ''
          });
        }
      } catch (err) {
        console.error('Failed to load office info', err);
      } finally {
        setOfficeLoading(false);
      }
    };

    loadOffice().catch(() => {});
  }, []);

  const handleSubmit = async (values) => {
    try {
      // require authentication
      if (!accessToken) {
        setLoginOpen(true);
        return;
      }

      // Submit only the message; backend attaches userID from token
      await submitFeedback({ message: values.message });
      showNotification({
        title: 'Feedback sent',
        message: 'Thank you for your feedback. We will review your message shortly.',
        color: 'green'
      });
      form.reset();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to send feedback.', color: 'red' });
    }
  };

  const openHierarchyModal = (mode) => {
    setHierarchyModalMode(mode);
    setHierarchySaving(false);

    if (mode === 'add') {
      setSelectedHierarchyId(null);
      setHierarchyName('');
      setHierarchyPosition('');
    } else {
      setSelectedHierarchyId(null);
      setHierarchyName('');
      setHierarchyPosition('');
    }

    setHierarchyModalOpen(true);
  };

  const closeHierarchyModal = () => {
    setHierarchyModalOpen(false);
    setHierarchyModalMode(null);
    setSelectedHierarchyId(null);
    setHierarchyName('');
    setHierarchyPosition('');
  };

  const extractBarangay = (fullName) => {
    if (!fullName) return '';
    const start = fullName.indexOf('(');
    const end = fullName.indexOf(')', start + 1);
    if (start === -1 || end === -1) return fullName;
    return fullName.slice(start + 1, end).trim();
  };

  const sortedHierarchyForOptions = [...hierarchy].sort((a, b) =>
    extractBarangay(a.name).localeCompare(extractBarangay(b.name))
  );

  const hierarchyOptions = sortedHierarchyForOptions.map((item) => ({
    value: String(item.id),
    label: `${item.position}: ${item.name}`
  }));

  const handleHierarchyPrimaryChange = (idValue) => {
    setSelectedHierarchyId(idValue || null);
    const found = hierarchy.find((h) => String(h.id) === String(idValue));
    if (found) {
      setHierarchyName(found.name || '');
      setHierarchyPosition(found.position || '');
    } else {
      setHierarchyName('');
      setHierarchyPosition('');
    }
  };

  const submitHierarchy = async () => {
    try {
      setHierarchySaving(true);

      if (hierarchyModalMode === 'add') {
        if (!hierarchyName.trim() || !hierarchyPosition) return;
        await createHierarchyEntry({ name: hierarchyName.trim(), position: hierarchyPosition });
      } else if (hierarchyModalMode === 'edit') {
        if (!selectedHierarchyId || !hierarchyName.trim() || !hierarchyPosition) return;
        await updateHierarchyEntry(selectedHierarchyId, { name: hierarchyName.trim(), position: hierarchyPosition });
      } else if (hierarchyModalMode === 'delete') {
        if (!selectedHierarchyId) return;
        await deleteHierarchyEntry(selectedHierarchyId);
      }

      const res = await getHierarchy();
      setHierarchy(res.data?.data || []);
      closeHierarchyModal();
      showNotification({
        title: 'Saved',
        message:
          hierarchyModalMode === 'add'
            ? 'Hierarchy entry added'
            : hierarchyModalMode === 'edit'
            ? 'Hierarchy entry updated'
            : 'Hierarchy entry deleted',
        color: 'green'
      });
    } catch (err) {
      console.error('Failed to save hierarchy', err);
      const msg = err?.response?.data?.error?.message || 'Failed to save hierarchy entry';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setHierarchySaving(false);
    }
  };

  const mayor = hierarchy.find((h) => h.position === 'Mayor');
  const viceMayor = hierarchy.find((h) => h.position === 'Vice Mayor');
  const head = hierarchy.find((h) => h.position === 'Population Office Head');
  const staffMembers = hierarchy.filter((h) => h.position === 'Population Office Staff');
  const barangayReps = hierarchy
    .filter((h) => h.position === 'Barangay Representative')
    .sort((a, b) => extractBarangay(a.name).localeCompare(extractBarangay(b.name)));

  return (
    <>
    <br />
    <div className="container">
      <div className="row g-4">
        <div className="col-12 col-lg-8">
          <Stack spacing="lg" px="sm">
              <div className="mb-3 position-relative">
                <img
                  src={office?.officeImageUrl || aboutUsImage}
                  alt="About the Municipal Population Office"
                  className="img-fluid rounded shadow-sm w-100"
                  style={{ objectFit: 'cover', maxHeight: 320 }}
                />
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary position-absolute"
                    style={{ right: '12px', bottom: '12px' }}
                    onClick={handleReplaceImage}
                    disabled={imageUploading}
                  >
                    {imageUploading ? 'Uploading...' : 'Replace'}
                  </button>
                )}
              </div>

              <Stack spacing="sm">
                <Title order={1} style={{ margin: 0 }}>
                  About Our <span style={{ color: '#6ba4f0ff' }}>Municipal Population Office</span>
                </Title>
                <Text
                  size="md"
                  style={{ textAlign: 'justify' }}
                >
                  The <span style={{ fontWeight: 600 }}>Municipal Population Office (MPO) of San Fabian</span> serves as
                  the primary frontline department dedicated to managing and implementing the
                  <span style={{ fontWeight: 600 }}> Philippine Population and Development Program (PPDP)</span> at the
                  local level.
                </Text>
                <Text
                  size="md"
                  style={{ textAlign: 'justify' }}
                >
                  We believe that a well-informed and empowered community is the foundation of a resilient San Fabian.
                  Our work focuses on the intersection of people, resources, and environment to ensure that every
                  San Fabianense is accounted for and supported.
                </Text>

                <hr />

                <Paper radius="md" shadow="xs" p="md" withBorder>
                  <Title order={2} weight={600} mb="xs" className="hover-underline">
                    Mission &amp; Vision
                    <hr />
                  </Title>
                  <Title order={3} weight={500} size="lg">Our Vision</Title>
                  <Text size="md" align="justify">
                    "We envision a progressive and empowered San Fabian where every family is well-informed and capable of making responsible decisions regarding their size and well-being, leading to a high quality of life within a sustainable and ecologically balanced community."
                  </Text>
                  <br />
                  <Title order={3} weight={500} size="lg" mt="xs">Our Mission</Title>
                  <Text size="md" align="justify">
                    "To provide comprehensive population and development services through the integration of Responsible Parenthood and Family Planning (RPFP), Adolescent Health and Development (AHD), and Population-Development (POPDEV) strategies. We commit to strengthening the capacity of every San Fabianense to contribute to and benefit from the municipality’s socio-economic progress."
                  </Text>
                </Paper>

                <hr />

                <Title order={2} weight={600} mt="sm">
                  Core Programs &amp; Services
                </Title>
                <Text size="md" align="justify">
                  The MPO leads several key program areas to support San Fabian families and communities:
                </Text>
                <ul className="mb-0 md" style={{ textAlign: 'justify' }}>
                  <li>
                    <b>Responsible Parenthood &amp; Family Planning (RPFP)</b> – Providing education and access to family
                    planning methods to help couples achieve their desired family size.
                  </li>
                  <li>
                    <b>Adolescent Health and Development (AHD)</b> – Youth-focused initiatives aimed at preventing
                    teenage pregnancy and promoting healthy lifestyle choices among the San Fabian youth.
                  </li>
                  <li>
                    <b>Pre-Marriage Orientation and Counseling (PMOC)</b> – Mandatory sessions for engaged couples to
                    prepare them for the psychological and social responsibilities of married life.
                  </li>
                  <li>
                    <b>Population Data Management</b> – Maintaining the Municipal Population Information System to help
                    the local government unit (LGU) make informed decisions for infrastructure and social services.
                  </li>
                </ul>

                <Title order={3} weight={600} mt="sm">
                  Why Population Matters
                </Title>
                <Text size="md" align="justify">
                  Population management is not just about numbers; it is about human development. By understanding our
                  demographics, we can:
                </Text>
                <ul className="mb-0 md" style={{ textAlign: 'justify' }}>
                  <li>Ensure there are enough classrooms for our students.</li>
                  <li>Optimize healthcare delivery to our barangays.</li>
                  <li>Support the economic productivity of our labor force.</li>
                </ul>

                <hr />
              </Stack>
            </Stack>
            </div>
            

            <div className="col-12 col-lg-4">
              <div className="vstack gap-3">

                <div className="card shadow-sm">
                  <div className="card-header py-2 px-3 bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="card-title h5 mb-0">Contact Us</h5>
                      {isAdmin && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={openOfficeEdit}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="card-body md">
                    {officeLoading ? (
                      <p className="mb-0">Loading office information...</p>
                    ) : office ? (
                      <>
                        <p className="mb-1 fw-semibold">{office.officeName}</p>
                        <p className="mb-1">Address: {office.address}</p>
                        <p className="mb-1">Contact number: {office.contactNumber}</p>
                        <p className="mb-0">Email: {office.email}</p>
                        <p className="mb-0">Office Head: {office.officeHead}</p>
                      </>
                    ) : (
                      <>
                      </>
                    )}
                  </div>
                </div>

                <div className="card shadow-sm">
                  <div className="card-header py-2 px-3 bg-light">
                    <h5 className="card-title h6 mb-0">Feedback Form</h5>
                  </div>
                  <div className="card-body">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const result = form.validate();
                        if (result.hasErrors) return;
                        setFeedbackConfirmOpen(true);
                      }}
                    >
                      <Stack>
                        <TextInput label="Full Name" value={form.values.fullName} readOnly disabled />
                        <TextInput label="Email" value={form.values.email} readOnly disabled />
                        <TextInput label="Contact Number" value={form.values.contactNumber} readOnly disabled />
                        <TextInput
                          label="Barangay"
                          value={form.values.barangay}
                          readOnly={!isAdmin}
                          disabled={!isAdmin}
                          onChange={(event) => {
                            if (isAdmin) {
                              form.setFieldValue('barangay', event.currentTarget.value);
                            }
                          }}
                        />
                        <Textarea
                          label="Message"
                          placeholder="Your feedback, inquiry, or concern"
                          required
                          minRows={3}
                          {...form.getInputProps('message')}
                        />
                        <Group className="mt-2">
                          <Button type="submit">
                            Submit Feedback
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  </div>
                </div>

                <div className="card shadow-sm text-center">
                  <div className="card-body py-3">
                    <img
                      src={sanFabianLogo}
                      alt="Municipality of San Fabian Logo"
                      className="img-fluid"
                      style={{ maxHeight: 250, objectFit: 'contain' }}
                    />
                  </div>
                </div>

                <div className="card shadow-sm">
                  <div className="card-header py-2 px-3 bg-light">
                    <h5 className="card-title h6 mb-0">Services</h5>
                  </div>
                  <div className="card-body">
                    <ul className="small mb-0">
                      <li><a href="/services/pre-marriage-orientation" className="text-decoration-none">Pre-Marriage Orientation (PMOC)</a></li>
                      <li><a href="/services/usapan-series" className="text-decoration-none">Usapan Series</a></li>
                      <li><a href="/services/rpfp" className="text-decoration-none">Responsible Parenthood &amp; Family Development (RPFP)</a></li>
                      <li><a href="/services/ahdp" className="text-decoration-none">Adolescent Health and Development Program (AHDP)</a></li>
                      <li><a href="/services/iec" className="text-decoration-none">Population Awareness &amp; IEC Activities</a></li>
                      <li><a href="/services/population-profiling" className="text-decoration-none">Demographic Data Collection &amp; Population Profiling</a></li>
                      <li><a href="/services/community-events" className="text-decoration-none">Support During Community Events</a></li>
                      <li><a href="/services/other-assistance" className="text-decoration-none">Other Assistance</a></li>
                    </ul>
                  </div>
                </div>

                <div className="card shadow-sm">
                  <div className="card-header py-2 px-3 bg-light">
                    <h5 className="card-title h6 mb-0">Population Office Location</h5>
                  </div>
                  <div className="card-body">
                    <div className="ratio ratio-4x3 rounded overflow-hidden">
                      <iframe
                        title="San Fabian Population Office Location"
                        src="https://www.google.com/maps?q=16.120723263859666,120.40280245009167&z=15&output=embed"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
          <br />
          <div className="row g-4">
            <div className="col-12">
              <Paper radius="md" shadow="xs" p="md" withBorder>
                {isAdmin && (
                  <Group justify="flex-end" mb="xs">
                    <Button size="xs" variant="outline" onClick={() => openHierarchyModal('add')}>
                      Add
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => openHierarchyModal('edit')}>
                      Edit
                    </Button>
                    <Button size="xs" color="red" variant="outline" onClick={() => openHierarchyModal('delete')}>
                      Delete
                    </Button>
                  </Group>
                )}
                <Title order={2} weight={600} mb="xs" className="hover-underline text-center">
                  Organization Hierarchy
                </Title>
                <Text size="sm" c="dimmed" mb="md" align="center">
                  Visual overview of the Municipal Population Office leadership and support structure.
                </Text>

                <div className="d-flex flex-column align-items-center mb-4">
                  <div className="px-4 py-2 rounded-3 text-white text-center hover-underline" style={{ backgroundColor: '#0377c5ff', minWidth: 220 }}>
                    <div>{mayor?.name || '—'}</div>
                    <div className="fw-semibold">Mayor</div>                  
                  </div>
                </div>

                <div className="d-flex justify-content-center mb-3">
                  <div className="border-start border-2" style={{ height: 24, borderColor: '#0377c5ff' }} />
                </div>

                <div className="d-flex flex-column align-items-center mb-4">
                  <div className="px-4 py-2 rounded-3 text-white text-center" style={{ backgroundColor: '#0377c5ff', minWidth: 220 }}>
                    <div className="fw-semibold">Vice Mayor</div>
                    <div>{viceMayor?.name || '—'}</div>
                  </div>
                </div>

                <div className="d-flex justify-content-center mb-3">
                  <div className="border-start border-2" style={{ height: 24, borderColor: '#0377c5ff' }} />
                </div>

                <div className="d-flex flex-column align-items-center mb-4">
                  <div className="px-4 py-2 rounded-3 text-white text-center" style={{ backgroundColor: '#0377c5ff', minWidth: 220 }}>
                    <div>{head?.name || '—'}</div>
                    <div className="fw-semibold">Population Office Head</div>                 
                  </div>
                </div>

                <div className="d-flex justify-content-center mb-3">
                  <div className="border-start border-2" style={{ height: 24, borderColor: '#0377c5ff' }} />
                </div>

                {staffMembers.length === 0 ? (
                  <>
                    <div className="d-flex flex-column align-items-center mb-4">
                      <div className="px-4 py-2 rounded-3 text-white text-center hover-underline" style={{ backgroundColor: '#0377c5ff', minWidth: 220 }}>
                        <div className="fw-semibold">Population Office Staff</div>
                        <div>—</div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-center mb-3">
                      <div className="border-start border-2" style={{ height: 24, borderColor: '#0377c5ff' }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="row g-3 justify-content-center mb-3">
                      {staffMembers.map((staff) => (
                        <div key={staff.id} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex flex-column align-items-center">
                          <div className="px-3 py-2 rounded-3 text-white text-center hover-underline" style={{ backgroundColor: '#0377c5ff', minWidth: 180 }}>
                            <div>{staff.name}</div>
                            <div className="fw-semibold">Population Office Staff</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="d-flex justify-content-center mb-3">
                  <div className="border-start border-2" style={{ height: 24, borderColor: '#0377c5ff' }} />
                </div>

                {hierarchyLoading ? (
                  <Center py="sm">
                    <Loader size="sm" />
                  </Center>
                ) : (
                  <div className="row g-3 justify-content-center">
                    {barangayReps.map((rep) => (
                      <div key={rep.id} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex flex-column align-items-center">
                        <div
                          className="px-3 py-2 rounded-3 text-white text-center hover-underline"
                          style={{ backgroundColor: '#0377c5ff', minWidth: 300, minHeight: 80 }}
                        >
                          <div>{rep.name}</div>
                          <div className="fw-semibold">Barangay Representative</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Paper>
            </div>
          </div>

          <LoginModal
            opened={loginOpen}
            onClose={() => setLoginOpen(false)}
            redirectTo="/contact"
            onOpenRegister={() => {
              setLoginOpen(false);
              setRegisterOpen(true);
            }}
          />

          <RegisterModal opened={registerOpen} onClose={() => setRegisterOpen(false)} />

          {/* Feedback confirmation modal */}
          <Modal
            opened={feedbackConfirmOpen}
            onClose={() => setFeedbackConfirmOpen(false)}
            withCloseButton={false}
            centered
            size="sm"
            radius="lg"
          >
            <Stack gap="md">
              <div className="d-flex flex-column align-items-center text-center">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                  style={{ width: 56, height: 56, backgroundColor: '#fee2e2', color: '#dc2626' }}
                >
                  <span style={{ fontSize: 24 }}>!</span>
                </div>
                <Text fw={600} size="lg" mb={2}>
                  Are you sure?
                </Text>
                <Text size="sm" c="dimmed">
                  Are you sure you want to submit this feedback? This action cannot be undone.
                </Text>
              </div>

              <Button
                color="green"
                fullWidth
                onClick={() => {
                  setFeedbackConfirmOpen(false);
                  handleSubmit(form.values).catch(() => {});
                }}
              >
                Submit feedback
              </Button>

              <Button
                variant="outline"
                color="gray"
                fullWidth
                onClick={() => setFeedbackConfirmOpen(false)}
              >
                Cancel
              </Button>
            </Stack>
          </Modal>

          {isAdmin && (
            <Modal
              opened={officeEditOpen}
              onClose={() => setOfficeEditOpen(false)}
              withCloseButton={false}
              centered
              size="xl"
              padding={0}
              styles={{
                content: {
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                },
                body: {
                  padding: 0,
                },
              }}
              overlayProps={{ opacity: 1, color: '#050000ff' }}
            >
              <div className="card border-0 shadow-lg" style={{ borderRadius: '0.75rem' }}>
                <div className="row g-0 align-items-stretch">
                  {/* Preview on the left: text summary */}
                  <div
                    className="col-md-5 d-none d-md-block bg-light"
                    style={{ borderRight: '1px solid #e5e7eb' }}
                  >
                    <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center" align="left">
                      <div className="mb-3 small text-muted w-100">Preview</div>
                      <div className="w-100" style={{ maxWidth: 320 }}>
                        <div className="mb-2">
                          <div className="small text-muted">Office name</div>
                          <div className="fw-semibold">
                            {officeForm.values.officeName || '—'}
                          </div>
                        </div>
                        <div className="mb-2">
                          <div className="small text-muted">Address</div>
                          <div>
                            {officeForm.values.address || '—'}
                          </div>
                        </div>
                        <div className="mb-2">
                          <div className="small text-muted">Contact number</div>
                          <div>
                            {officeForm.values.contactNumber || '—'}
                          </div>
                        </div>
                        <div className="mb-2">
                          <div className="small text-muted">Email</div>
                          <div>
                            {officeForm.values.email || '—'}
                          </div>
                        </div>
                        <div className="mb-2">
                          <div className="small text-muted">Office head</div>
                          <div>
                            {officeForm.values.officeHead || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form on the right */}
                  <div className="col-12 col-md-7 p-4 bg-white">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <div className="text-uppercase small text-muted mb-1">Contact Us</div>
                        <h2 className="h5 mb-0">Edit Office Details</h2>
                      </div>
                      <button
                        type="button"
                        className="btn-close"
                        aria-label="Close"
                        onClick={() => setOfficeEditOpen(false)}
                      />
                    </div>

                    <form
                      onSubmit={officeForm.onSubmit((values) => {
                        handleOfficeSave(values).catch(() => {});
                      })}
                    >
                      <Stack>
                        <TextInput
                          label="Office name"
                          required
                          {...officeForm.getInputProps('officeName')}
                        />
                        <Textarea
                          label="Address"
                          required
                          minRows={3}
                          autosize
                          {...officeForm.getInputProps('address')}
                        />
                        <TextInput
                          label="Contact number"
                          required
                          {...officeForm.getInputProps('contactNumber')}
                        />
                        <TextInput
                          label="Email"
                          required
                          {...officeForm.getInputProps('email')}
                        />
                        <TextInput
                          label="Office head"
                          required
                          {...officeForm.getInputProps('officeHead')}
                        />

                        <Group justify="flex-end" mt="md">
                          <Button
                            variant="default"
                            type="button"
                            onClick={() => setOfficeEditOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">
                            Save changes
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  </div>
                </div>
              </div>
            </Modal>
          )}

          {isAdmin && (
            <Modal
              opened={hierarchyModalOpen}
              onClose={closeHierarchyModal}
              centered
              withCloseButton={false}
              padding={0}
              styles={{
                content: {
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                },
                body: {
                  padding: 0,
                },
              }}
            >
              <div className="card border-0 shadow-lg" style={{ borderRadius: '0.75rem' }}>
                <div className="p-4">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <div className="text-uppercase small text-muted mb-1">Organization Hierarchy</div>
                      <h2 className="h5 mb-0">
                        {hierarchyModalMode === 'add'
                          ? 'Add hierarchy entry'
                          : hierarchyModalMode === 'edit'
                          ? 'Edit hierarchy entry'
                          : 'Delete hierarchy entry'}
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={closeHierarchyModal}
                    />
                  </div>

                  <Stack gap="sm">
                    {(hierarchyModalMode === 'edit' || hierarchyModalMode === 'delete') && (
                      <Select
                        label="Select entry"
                        placeholder="Choose hierarchy entry"
                        data={hierarchyOptions}
                        value={selectedHierarchyId}
                        onChange={handleHierarchyPrimaryChange}
                        searchable
                        clearable
                      />
                    )}

                    {hierarchyModalMode !== 'delete' && (
                      <>
                        <Select
                          label="Position"
                          placeholder="Select position"
                          data={HIERARCHY_POSITIONS.map((p) => ({ value: p, label: p }))}
                          value={hierarchyPosition}
                          onChange={(v) => setHierarchyPosition(v || '')}
                          required
                        />
                        <TextInput
                          label="Name"
                          placeholder="Enter name"
                          value={hierarchyName}
                          onChange={(event) => setHierarchyName(event.currentTarget.value)}
                          required
                        />
                      </>
                    )}

                    {hierarchyModalMode === 'delete' && (
                      <Text size="sm" c="red">
                        This action cannot be undone. The selected hierarchy entry will be permanently removed from the
                        Organization Hierarchy.
                      </Text>
                    )}
                  </Stack>

                  <div className="d-flex justify-content-end gap-2 pt-3 mt-3 border-top">
                    <Button
                      variant="default"
                      onClick={closeHierarchyModal}
                      disabled={hierarchySaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      color={hierarchyModalMode === 'delete' ? 'red' : 'blue'}
                      onClick={submitHierarchy}
                      loading={hierarchySaving}
                    >
                      {hierarchyModalMode === 'delete' ? 'Delete' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            </Modal>
          )}
        </div>
      </>
  );
}
