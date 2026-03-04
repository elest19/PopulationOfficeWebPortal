import React, { useEffect, useState } from 'react';
import {
  Title,
  Tabs,
  Stack,
  Group,
  Button,
  Table,
  Modal,
  TextInput,
  Textarea,
  Select,
  FileInput,
  Loader,
  Center,
  Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import { getNewsList, createNews, deleteNews } from '../api/news.js';
import { getAnnouncements, createAnnouncement, updateAnnouncement, archiveAnnouncement, deleteAnnouncement } from '../api/announcements.js';
import { uploadAnnouncementImage } from '../api/uploads.js';
import { getFaqs, createFaq, updateFaq, deleteFaq } from '../api/faq.js';
import { getFeedback, updateFeedbackStatus } from '../api/feedback.js';
import { getAllAppointments, updateAppointmentStatus } from '../api/appointments.js';

export function AdminDashboardPage() {
  // News state
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsModalOpened, setNewsModalOpened] = useState(false);
  const newsForm = useForm({
    initialValues: {
      title: '',
      shortDescription: '',
      content: '',
      imageUrl: ''
    }
  });

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [annModalOpened, setAnnModalOpened] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [annImageFile, setAnnImageFile] = useState(null);
  const [annUploadProgress, setAnnUploadProgress] = useState(0);
  const annForm = useForm({
    initialValues: {
      title: '',
      description: '',
      startDate: null,
      endDate: null,
      location: ''
    }
  });

  // Removed Services and Education admin UI per new specification

  // FAQ state
  const [faqs, setFaqs] = useState([]);
  const [faqLoading, setFaqLoading] = useState(true);
  const [faqModalOpened, setFaqModalOpened] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState(null);
  const faqForm = useForm({
    initialValues: {
      question: '',
      answer: ''
    }
  });

  // Feedback state
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  // Appointments state
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);

  // Loaders
  useEffect(() => {
    // News
    setNewsLoading(true);
    getNewsList({ page: 1, limit: 50 })
      .then((res) => setNews(res.data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setNewsLoading(false));

    // Announcements
    setAnnLoading(true);
    getAnnouncements({ page: 1, limit: 50 })
      .then((res) => setAnnouncements(res.data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setAnnLoading(false));

    // Services and Education admin removed

    // FAQs
    setFaqLoading(true);
    getFaqs()
      .then((res) => setFaqs(res.data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setFaqLoading(false));

    // Feedback
    setFeedbackLoading(true);
    getFeedback({ page: 1, limit: 50 })
      .then((res) => setFeedbackItems(res.data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setFeedbackLoading(false));

    // Appointments
    setAppointmentsLoading(true);
    getAllAppointments()
      .then((res) => setAppointments(res.data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setAppointmentsLoading(false));
  }, []);

  // News handlers
  const handleNewsSubmit = async (values) => {
    try {
      await createNews({
        title: values.title,
        shortDescription: values.shortDescription,
        content: values.content,
        imageUrl: values.imageUrl || null,
        isPublished: true
      });
      showNotification({ title: 'News created', message: 'News item created successfully', color: 'green' });
      setNewsModalOpened(false);
      newsForm.reset();
      const res = await getNewsList({ page: 1, limit: 50 });
      setNews(res.data.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to create news', color: 'red' });
    }
  };

  const handleNewsDelete = async (id) => {
    try {
      await deleteNews(id);
      setNews((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to delete news', color: 'red' });
    }
  };

  // Announcement handlers
  const openAnnouncementModalForCreate = () => {
    setEditingAnnouncementId(null);
    annForm.reset();
    setAnnImageFile(null);
    setAnnUploadProgress(0);
    setAnnModalOpened(true);
  };

  const openAnnouncementModalForEdit = (ann) => {
    setEditingAnnouncementId(ann.id);
    annForm.setValues({
      title: ann.title,
      description: ann.description,
      startDate: new Date(ann.startDate),
      endDate: new Date(ann.endDate),
      location: ann.location || ''
    });
    setAnnImageFile(null);
    setAnnUploadProgress(0);
    setAnnModalOpened(true);
  };

  const handleAnnouncementSubmit = async (values) => {
    try {
      let imageUrl = undefined;
      if (annImageFile instanceof File) {
        setAnnUploadProgress(1);
        const up = await uploadAnnouncementImage(annImageFile, { onProgress: (pct) => setAnnUploadProgress(pct) });
        imageUrl = up?.data?.data?.publicUrl || undefined;
      }

      const payload = {
        title: values.title,
        description: values.description,
        startDate: values.startDate,
        endDate: values.endDate,
        location: values.location || '',
        imageUrl
      };

      if (editingAnnouncementId) {
        await updateAnnouncement(editingAnnouncementId, payload);
      } else {
        await createAnnouncement(payload);
      }
      showNotification({
        title: 'Saved',
        message: 'Announcement saved successfully',
        color: 'green'
      });
      setAnnModalOpened(false);
      setEditingAnnouncementId(null);
      setAnnImageFile(null);
      setAnnUploadProgress(0);
      const res = await getAnnouncements({ page: 1, limit: 50 });
      setAnnouncements(res.data.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to save announcement', color: 'red' });
      setAnnUploadProgress(0);
    }
  };

  const handleAnnouncementArchive = async (id) => {
    try {
      await archiveAnnouncement(id);
      const res = await getAnnouncements({ page: 1, limit: 50 });
      setAnnouncements(res.data.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to archive announcement', color: 'red' });
    }
  };

  const handleAnnouncementDelete = async (id) => {
    try {
      await deleteAnnouncement(id);
      const res = await getAnnouncements({ page: 1, limit: 50 });
      setAnnouncements(res.data.data || []);
      showNotification({ title: 'Deleted', message: 'Announcement permanently deleted', color: 'green' });
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to delete announcement', color: 'red' });
    }
  };

  // Services and Education handlers removed

  // FAQ handlers
  const openFaqModalForCreate = () => {
    setEditingFaqId(null);
    faqForm.reset();
    setFaqModalOpened(true);
  };

  const openFaqModalForEdit = (faq) => {
    setEditingFaqId(faq.id);
    faqForm.setValues({ question: faq.question, answer: faq.answer });
    setFaqModalOpened(true);
  };

  const handleFaqSubmit = async (values) => {
    try {
      if (editingFaqId) {
        await updateFaq(editingFaqId, { question: values.question, answer: values.answer });
      } else {
        await createFaq({ question: values.question, answer: values.answer });
      }
      showNotification({ title: 'Saved', message: 'FAQ saved', color: 'green' });
      setFaqModalOpened(false);
      setEditingFaqId(null);
      const res = await getFaqs();
      setFaqs(res.data.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to save FAQ', color: 'red' });
    }
  };

  const handleFaqDelete = async (id) => {
    try {
      await deleteFaq(id);
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to delete FAQ', color: 'red' });
    }
  };

  // Feedback handlers
  const handleFeedbackStatusChange = async (id, status) => {
    try {
      await updateFeedbackStatus(id, status);
      const res = await getFeedback({ page: 1, limit: 50 });
      setFeedbackItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to update feedback', color: 'red' });
    }
  };

  // Appointment handlers
  const handleAppointmentStatusChange = async (id, status) => {
    try {
      await updateAppointmentStatus(id, status);
      const res = await getAllAppointments();
      setAppointments(res.data.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to update appointment', color: 'red' });
    }
  };

  return (
    <Stack spacing="lg" px="sm">
      <Title order={1}>Admin Dashboard</Title>
      <Tabs defaultValue="news">
        <Tabs.List>
          <Tabs.Tab value="news">News</Tabs.Tab>
          <Tabs.Tab value="announcements">Announcements / Calendar</Tabs.Tab>
          <Tabs.Tab value="feedback">Feedback</Tabs.Tab>
          <Tabs.Tab value="appointments">Appointments</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="news" pt="md">
          <Group position="apart" mb="sm">
            <Title order={4}>News</Title>
            <Button size="xs" onClick={() => setNewsModalOpened(true)}>
              Add news
            </Button>
          </Group>
          {newsLoading ? (
            <Center py="lg">
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover withBorder>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {news.map((n) => (
                  <tr key={n.id}>
                    <td>{n.title}</td>
                    <td>{n.shortDescription}</td>
                    <td>
                      <Button size="xs" color="red" variant="light" onClick={() => handleNewsDelete(n.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <Modal
            opened={newsModalOpened}
            onClose={() => setNewsModalOpened(false)}
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
            overlayProps={{ opacity: 1, color: '#ffffff', blur: 0 }}
          >
            <div className="card border-0 shadow-lg" style={{ borderRadius: '0.75rem' }}>
              <div className="row g-0 align-items-stretch">
                {/* Left: preview panel */}
                <div
                  className="col-md-4 d-none d-md-block bg-light"
                  style={{ borderRight: '1px solid #e5e7eb' }}
                >
                  <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center" align="left">
                    <div className="mb-2 small text-muted">News preview</div>
                    <Stack gap="xs">
                      <strong>{newsForm.values.title || 'Untitled news'}</strong>
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        {newsForm.values.shortDescription || 'Short description will appear here.'}
                      </span>
                      {newsForm.values.imageUrl && (
                        <img
                          src={newsForm.values.imageUrl}
                          alt="News preview"
                          className="img-fluid rounded border mt-2"
                          style={{ maxHeight: 160, objectFit: 'contain' }}
                        />
                      )}
                    </Stack>
                  </div>
                </div>

                {/* Right: form fields */}
                <div className="col-12 col-md-8 p-4 bg-white">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <div className="text-uppercase small text-muted mb-1">News</div>
                      <h2 className="h5 mb-0">Create News</h2>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={() => setNewsModalOpened(false)}
                    />
                  </div>

                  <form
                    onSubmit={newsForm.onSubmit((values) => {
                      handleNewsSubmit(values).catch(() => {});
                    })}
                  >
                    <Stack>
                      <TextInput label="Title" required {...newsForm.getInputProps('title')} />
                      <TextInput
                        label="Short description"
                        {...newsForm.getInputProps('shortDescription')}
                      />
                      <Textarea
                        label="Content"
                        minRows={4}
                        {...newsForm.getInputProps('content')}
                      />
                      <TextInput label="Image URL" {...newsForm.getInputProps('imageUrl')} />
                      <div className="d-flex justify-content-end gap-2 pt-2 mt-2 border-top">
                        <Button
                          type="button"
                          variant="default"
                          onClick={() => setNewsModalOpened(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                      </div>
                    </Stack>
                  </form>
                </div>
              </div>
            </div>
          </Modal>
        </Tabs.Panel>

        <Tabs.Panel value="announcements" pt="md">
          <Group position="apart" mb="sm">
            <Title order={4}>Events / Activity</Title>
            <Button size="xs" onClick={openAnnouncementModalForCreate}>
              Add announcement
            </Button>
          </Group>
          {annLoading ? (
            <Center py="lg">
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover withBorder>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>
                      {new Date(a.startDate).toLocaleDateString()} -
                      {' '}
                      {new Date(a.endDate).toLocaleDateString()}
                    </td>
                    <td>
                      <Badge
                        color={
                          a.status === 'UPCOMING'
                            ? 'blue'
                            : a.status === 'ONGOING'
                            ? 'green'
                            : a.status === 'PAST'
                            ? 'gray'
                            : 'red'
                        }
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td>
                      <Group spacing="xs">
                        <Button size="xs" variant="light" onClick={() => openAnnouncementModalForEdit(a)}>
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() => handleAnnouncementArchive(a.id)}
                        >
                          Archive
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          onClick={() => handleAnnouncementDelete(a.id)}
                        >
                          Delete permanently
                        </Button>
                      </Group>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <Modal
            opened={annModalOpened}
            onClose={() => setAnnModalOpened(false)}
            title={editingAnnouncementId ? 'Edit announcement' : 'Create announcement'}
            centered
          >
            <form
              onSubmit={annForm.onSubmit((values) => {
                handleAnnouncementSubmit(values).catch(() => {});
              })}
            >
              <Stack>
                <TextInput label="Title" required {...annForm.getInputProps('title')} />
                <Textarea
                  label="Description"
                  required
                  minRows={3}
                  {...annForm.getInputProps('description')}
                />
                <DatePickerInput
                  label="Start date"
                  required
                  value={annForm.values.startDate}
                  onChange={(value) => annForm.setFieldValue('startDate', value)}
                  firstDayOfWeek={0}
                />
                <DatePickerInput
                  label="End date"
                  required
                  value={annForm.values.endDate}
                  onChange={(value) => annForm.setFieldValue('endDate', value)}
                  firstDayOfWeek={0}
                />
                <TextInput label="Location" {...annForm.getInputProps('location')} />
                <FileInput
                  label="Image (optional)"
                  accept="image/*"
                  onChange={(file) => {
                    setAnnImageFile(file || null);
                    setAnnUploadProgress(0);
                  }}
                />
                {annUploadProgress > 0 && annUploadProgress < 100 ? (
                  <div style={{ width: '100%', height: 6, background: '#eee', borderRadius: 4 }}>
                    <div style={{ width: `${annUploadProgress}%`, height: '100%', background: '#228be6', borderRadius: 4 }} />
                  </div>
                ) : null}
                <Group position="right" mt="md">
                  <Button type="submit">Save</Button>
                </Group>
              </Stack>
            </form>
          </Modal>
        </Tabs.Panel>


        <Tabs.Panel value="feedback" pt="md">
          <Title order={4} mb="sm">
            Feedback
          </Title>
          {feedbackLoading ? (
            <Center py="lg">
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover withBorder>
              <thead>
                <tr>
                  <th>From</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {feedbackItems.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.name || 'Anonymous'}
                      <br />
                      <span style={{ fontSize: 12, color: '#555' }}>{f.email}</span>
                    </td>
                    <td>{f.message}</td>
                    <td>{f.status}</td>
                    <td>
                      <Select
                        size="xs"
                        data={['NEW', 'REVIEWED', 'RESOLVED']}
                        value={f.status}
                        onChange={(value) => handleFeedbackStatusChange(f.id, value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="appointments" pt="md">
          <Title order={4} mb="sm">
            Appointments
          </Title>
          {appointmentsLoading ? (
            <Center py="lg">
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover withBorder>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Requested date</th>
                  <th>Citizen / Officer</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.service_slug}</td>
                    <td>{a.requested_date && new Date(a.requested_date).toLocaleDateString()}</td>
                    <td>
                      {a.citizen_full_name || a.officer_name}
                      {a.barangay && ` (${a.barangay})`}
                    </td>
                    <td>{a.status}</td>
                    <td>
                      <Select
                        size="xs"
                        data={['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED']}
                        value={a.status}
                        onChange={(value) => handleAppointmentStatusChange(a.id, value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
