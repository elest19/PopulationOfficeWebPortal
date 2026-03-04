import React, { useEffect, useMemo, useState } from 'react';
import { Title, Text, Stack, Accordion, Loader, Center, Button, Group, Modal, Textarea, TextInput, Autocomplete } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import { createFaq, deleteFaq, getFaqs, getFaqTopics, updateFaq } from '../api/faq.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DeleteConfirmModal } from '../components/common/DeleteConfirmModal.jsx';

export function FAQPage() {
  const auth = useAuth() || {};
  const { isAdmin } = auth;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [deleteId, setDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [topics, setTopics] = useState([]);
  const [query, setQuery] = useState('');

  const form = useForm({
    initialValues: { topic: '', question: '', answer: '' },
    validate: {
      topic: () => null,
      question: (v) => (String(v || '').trim() ? null : 'Question is required'),
      answer: (v) => (String(v || '').trim() ? null : 'Answer is required')
    }
  });

  const fetchFaqs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFaqs();
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs().catch(() => {});
  }, []);

  const fetchTopics = async () => {
    try {
      const res = await getFaqTopics();
      const list = Array.isArray(res.data.data) ? res.data.data : [];
      setTopics(list);
    } catch (err) {
      console.error(err);
      setTopics([]);
    }
  };

  useEffect(() => {
    fetchTopics().catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingId(null);
    form.setValues({ topic: '', question: '', answer: '' });
    form.resetDirty();
    setModalOpened(true);
  };

  const openEdit = (faq) => {
    setEditingId(faq.id);
    form.setValues({ topic: faq.topic || '', question: faq.question || '', answer: faq.answer || '' });
    form.resetDirty();
    setModalOpened(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingId) {
        await updateFaq(editingId, values);
        showNotification({ title: 'Updated', message: 'FAQ updated successfully', color: 'green' });
      } else {
        await createFaq(values);
        showNotification({ title: 'Created', message: 'FAQ created successfully', color: 'green' });
      }
      setModalOpened(false);
      setEditingId(null);
      await fetchFaqs();
      await fetchTopics();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to save FAQ';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  const handleDelete = (id) => {
    setDeleteId(id);
  };

  const filteredItems = useMemo(() => {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return items || [];
    return (items || []).filter((it) =>
      [it.topic, it.question, it.answer]
        .map((v) => String(v || '').toLowerCase())
        .some((text) => text.includes(q))
    );
  }, [items, query]);

  const sortedItems = useMemo(() => {
    return [...(filteredItems || [])].sort((a, b) => Number(a.id) - Number(b.id));
  }, [filteredItems]);

  const groupedItems = useMemo(() => {
    if (!sortedItems || sortedItems.length === 0) return {};
    return sortedItems.reduce((acc, item) => {
      const topic = String(item.topic || '').trim() || 'General';
      if (!acc[topic]) acc[topic] = [];
      acc[topic].push(item);
      return acc;
    }, {});
  }, [sortedItems]);

  return (
    <>
    <div className="container" style={{marginTop: '20px'}}>
      <div className="row g-4">
        <div className="col-12 col-lg-8">
          <Stack spacing="lg" px="sm">
            <Group justify="space-between" align="flex-end">
              <Title order={1}>Inquiries (FAQ)</Title>
              {isAdmin ? (
                <Button onClick={openCreate}>Add FAQ</Button>
              ) : null}
            </Group>
            <TextInput
              placeholder="Search by topic, question, or answer..."
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
            {loading ? (
              <Center py="lg">
                <Loader />
              </Center>
            ) : error ? (
              <Text color="red">{error}</Text>
            ) : items.length === 0 ? (
              <Text>No FAQs available.</Text>
            ) : (
              <Stack spacing="xl">
                {Object.entries(groupedItems).map(([topic, topicItems]) => (
                  <Stack key={topic} spacing="sm">
                    <Title order={3}>{topic}</Title>
                    <Accordion>
                      {topicItems.map((item) => (
                        <Accordion.Item key={item.id} value={String(item.id)} align="justify">
                          <Accordion.Control>
                            <Group justify="space-between" wrap="nowrap" gap="sm">
                              <Text fw={600} lineClamp={2}>{item.question}</Text>
                              {isAdmin ? (
                                <Group gap="xs" wrap="nowrap">
                                  <Button size="xs" variant="light" onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openEdit(item);
                                  }}>
                                    Edit
                                  </Button>
                                  <Button size="xs" color="red" variant="light" onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDelete(item.id).catch(() => {});
                                  }}>
                                    Delete
                                  </Button>
                                </Group>
                              ) : null}
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            <Text size="sm">{item.answer || 'No answer provided yet.'}</Text>
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </div>

        <div className="col-12 col-lg-4">
          <div className="vstack gap-3">
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
    </div>

      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setEditingId(null);
        }}
        withCloseButton={false}
        centered
        size="xl"
      >
        <div className="row g-0 align-items-stretch" align="justify">
          <div
            className="col-md-5 d-none d-md-block bg-light"
            style={{ borderLeft: '1px solid #e5e7eb' }}
          >
            <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center">
              <div className="mb-3 small text-muted">Preview</div>

              <div className="small text-muted mb-1">Topic</div>
              <div className="fw-semibold mb-2">{form.values.topic || 'General'}</div>

              <div className="small text-muted mb-1">Question</div>
              <div className="mb-2">{form.values.question || '—'}</div>

              <div className="small text-muted mb-1">Answer</div>
              <div className="mb-2" style={{ whiteSpace: 'pre-wrap' }}>
                {form.values.answer || '—'}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-7 p-4">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="text-uppercase small text-muted mb-1">FAQ / Inquiries</div>
                <h2 className="h5 mb-0">{editingId ? 'Edit FAQ' : 'Add FAQ'}</h2>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => {
                  setModalOpened(false);
                  setEditingId(null);
                }}
              />
            </div>

            <form
              onSubmit={form.onSubmit((values) => {
                handleSubmit(values).catch(() => {});
              })}
            >
              <Stack>
                <Autocomplete
                  label="Topic"
                  placeholder="Type or select a topic"
                  data={topics || []}
                  value={form.values.topic}
                  onChange={(value) => form.setFieldValue('topic', value)}
                  searchable
                  clearable
                />
                <TextInput label="Question" required {...form.getInputProps('question')} />
                <Textarea label="Answer" required minRows={8} autosize {...form.getInputProps('answer')} />
                <Group justify="flex-end" mt="sm">
                  <Button type="submit">Save</Button>
                </Group>
              </Stack>
            </form>
          </div>
        </div>
      </Modal>

      <DeleteConfirmModal
        opened={deleteId != null}
        onCancel={() => { if (!deleteLoading) setDeleteId(null); }}
        onConfirm={async () => {
          if (!deleteId) return;
          setDeleteLoading(true);
          try {
            await deleteFaq(deleteId);
            showNotification({ title: 'Deleted', message: 'FAQ deleted', color: 'green' });
            setItems((prev) => prev.filter((x) => x.id !== deleteId));
            setDeleteId(null);
          } catch (err) {
            console.error(err);
            showNotification({ title: 'Error', message: 'Failed to delete FAQ', color: 'red' });
          } finally {
            setDeleteLoading(false);
          }
        }}
        confirmLabel="Delete FAQ"
        message="This FAQ will be permanently removed from the list. This action cannot be undone."
        loading={deleteLoading}
      />

    </>
  );
}
