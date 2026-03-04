import React, { useEffect, useState } from 'react';
import { Title, Stack, Group, Button, Table, Modal, TextInput, Textarea, Checkbox, NumberInput, Loader, Center, Badge, FileInput, Pagination } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { listEducationWeb, createEducationWeb, updateEducationWeb, archiveEducationWeb, unarchiveEducationWeb, listEducationWebKeyConcepts, upsertEducationWebKeyConcepts } from '../../api/educationWeb.js';
import { uploadEducationWebImage } from '../../api/uploads.js';

function normalizeYoutubeInput(raw) {
  if (!raw) return '';
  const value = String(raw).trim();

  // If it's an iframe snippet, extract src="..."
  const iframeMatch = value.match(/src\s*=\s*"([^"]+)"/i) || value.match(/src\s*=\s*'([^']+)'/i);
  if (iframeMatch && iframeMatch[1]) {
    return iframeMatch[1].trim();
  }

  // If it's a standard YouTube watch URL, convert to embed
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname === '/watch' && url.searchParams.get('v')) {
        const vid = url.searchParams.get('v');
        return `https://www.youtube.com/embed/${vid}`;
      }
      if (url.pathname.startsWith('/embed/')) {
        return url.toString();
      }
    }
    if (url.hostname === 'youtu.be') {
      const vid = url.pathname.replace('/', '');
      if (vid) {
        return `https://www.youtube.com/embed/${vid}`;
      }
    }
  } catch {
    // fall through, treat as plain string
  }

  return value;
}

export function EducationWebAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [concepts, setConcepts] = useState([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState(null);
  const [visualPreviewUrl, setVisualPreviewUrl] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 10;

  const form = useForm({
    initialValues: {
      title: '',
      imageThumbnailUrl: '',
      label: '',
      purpose: '',
      overview: '',
      mainExplanation: '',
      visualImageUrl: '',
      benefits: '',
      limitationsOrNotes: '',
      youtubeVideoUrl: '',
      isPublished: true,
      displayOrder: null,
      thumbnailFile: null,
      visualFile: null,
    }
  });

  const conceptForm = useForm({
    initialValues: {
      conceptTitle: '',
      conceptDescription: ''
    }
  });

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await listEducationWeb();
      setItems(res.data?.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to load education content.', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems().catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingId(null);
    // Determine next display order automatically (max existing + 1)
    const maxOrder = items.reduce((max, it) => {
      const val = it.displayOrder ?? it.display_order;
      return typeof val === 'number' && !Number.isNaN(val) ? Math.max(max, val) : max;
    }, 0);

    form.reset();
    form.setFieldValue('displayOrder', maxOrder + 1);
    setConcepts([]);
    setThumbnailPreviewUrl(null);
    setVisualPreviewUrl(null);
    setModalOpened(true);
  };

  const openEdit = async (item) => {
    setEditingId(item.id);
    form.setValues({
      title: item.title || '',
      imageThumbnailUrl: item.imageThumbnailUrl || item.image_thumbnail_url || '',
      label: item.label || '',
      purpose: item.purpose || '',
      overview: item.overview || '',
      mainExplanation: item.mainExplanation || item.main_explanation || '',
      visualImageUrl: item.visualImageUrl || item.visual_image_url || '',
      benefits: item.benefits || '',
      limitationsOrNotes: item.limitationsOrNotes || item.limitations_or_notes || '',
      youtubeVideoUrl: item.youtubeVideoUrl || item.youtube_video_url || '',
      isPublished: typeof item.isPublished === 'boolean' ? item.isPublished : !!item.is_published,
      displayOrder: item.displayOrder ?? item.display_order,
      thumbnailFile: null,
      visualFile: null,
    });

    setThumbnailPreviewUrl(item.imageThumbnailUrl || item.image_thumbnail_url || null);
    setVisualPreviewUrl(item.visualImageUrl || item.visual_image_url || null);

    setConceptsLoading(true);
    try {
      const res = await listEducationWebKeyConcepts(item.id);
      setConcepts(res.data?.data || []);
    } catch (err) {
      console.error(err);
      setConcepts([]);
    } finally {
      setConceptsLoading(false);
    }

    setModalOpened(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      let thumbnailUrl = values.imageThumbnailUrl || null;
      let visualUrl = values.visualImageUrl || null;

      if (values.thumbnailFile instanceof File) {
        const up = await uploadEducationWebImage(values.thumbnailFile);
        thumbnailUrl = up?.data?.data?.publicUrl || thumbnailUrl;
      }

      if (values.visualFile instanceof File) {
        const up = await uploadEducationWebImage(values.visualFile);
        visualUrl = up?.data?.data?.publicUrl || visualUrl;
      }

      const payload = {
        title: values.title,
        imageThumbnailUrl: thumbnailUrl,
        label: values.label || null,
        purpose: values.purpose || null,
        overview: values.overview || null,
        mainExplanation: values.mainExplanation || null,
        visualImageUrl: visualUrl,
        benefits: values.benefits || null,
        limitationsOrNotes: values.limitationsOrNotes || null,
        youtubeVideoUrl: values.youtubeVideoUrl || null,
        isPublished: values.isPublished,
        displayOrder: values.displayOrder,
      };

      let res;
      if (editingId) {
        res = await updateEducationWeb(editingId, payload);
      } else {
        res = await createEducationWeb(payload);
        setEditingId(res.data?.data?.id || null);
      }

      const webId = res.data?.data?.id;
      if (webId) {
        await upsertEducationWebKeyConcepts(webId, concepts.map((c, idx) => ({
          id: c.id,
          conceptTitle: c.conceptTitle,
          conceptDescription: c.conceptDescription,
          displayOrder: idx + 1,
        })));
      }

      showNotification({ title: 'Saved', message: 'Education web content saved.', color: 'green' });
      setModalOpened(false);
      await loadItems();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to save education web content.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id) => {
    try {
      await archiveEducationWeb(id);
      showNotification({ title: 'Archived', message: 'Content archived.', color: 'green' });
      await loadItems();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to archive content.', color: 'red' });
    }
  };

  const handleUnarchive = async (id) => {
    try {
      await unarchiveEducationWeb(id);
      showNotification({ title: 'Unarchived', message: 'Content published again.', color: 'green' });
      await loadItems();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to unarchive content.', color: 'red' });
    }
  };

  const addConcept = () => {
    const { conceptTitle, conceptDescription } = conceptForm.values;
    if (!conceptTitle.trim()) return;
    setConcepts((prev) => [
      ...prev,
      { id: null, conceptTitle: conceptTitle.trim(), conceptDescription: conceptDescription.trim() || '' },
    ]);
    conceptForm.reset();
  };

  const removeConcept = (idx) => {
    setConcepts((prev) => prev.filter((_, i) => i !== idx));
  };

  const isPublishedItem = (it) => (typeof it.isPublished === 'boolean' ? it.isPublished : it.is_published);

  const visibleItems = items.filter((it) => {
    if (showArchived) {
      return !isPublishedItem(it);
    }
    return isPublishedItem(it);
  });

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const pageItems = visibleItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Stack>
      <Group justify="space-between" mb="sm">
        <Title order={2}>Education Web Content</Title>
        <Group gap="xs">
          <Button
            variant={showArchived ? 'default' : 'filled'}
            onClick={openCreate}
          >
            Add content
          </Button>
          <Button
            variant={showArchived ? 'filled' : 'outline'}
            color={showArchived ? 'gray' : 'dark'}
            onClick={() => setShowArchived((v) => !v)}
          >
            Archived
          </Button>
        </Group>
      </Group>

      {loading ? (
        <Center py="lg"><Loader /></Center>
      ) : (
        <Table striped withTableBorder withColumnBorders highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Label</Table.Th>
              <Table.Th>Published</Table.Th>
              <Table.Th>Published Date</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageItems.map((it) => (
              <Table.Tr key={it.id}>
                <Table.Td>
                  {it.title}
                </Table.Td>
                <Table.Td>{it.label}</Table.Td>
                <Table.Td style={{textAlign: 'center'}}>
                  { isPublishedItem(it)
                    ? <Badge color="green">Published</Badge>
                    : <Badge color="gray">Archived</Badge> }
                </Table.Td>
                <Table.Td style={{textAlign: 'center'}}>
                  {(() => {
                    const raw = it.createdAt || it.created_at;
                    if (!raw) return '—';
                    const d = new Date(raw);
                    // Fallback in case of invalid date
                    return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString();
                  })()}
                </Table.Td>
                <Table.Td style={{textAlign: 'center'}}>
                  <Group justify="flex-end" gap="xs">
                    <Button size="xs" variant="light" onClick={() => openEdit(it)}>Edit</Button>
                    {isPublishedItem(it) ? (
                      <Button
                        size="xs"
                        color="red"
                        variant="light"
                        onClick={() => handleArchive(it.id)}
                      >
                        Archive
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        color="green"
                        variant="light"
                        onClick={() => handleUnarchive(it.id)}
                      >
                        Unarchive
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {!loading && totalPages > 1 && (
        <Group justify="flex-end" mt="sm">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        withCloseButton={false}
        centered
        size="xl"
        padding={0}
        styles={{
          content: {
            backgroundColor: 'transparent',
            boxShadow: 'none'
          },
          body: {
            padding: 0
          }
        }}
      >
        <div className="card border-0 shadow-lg" style={{ borderRadius: '0.75rem' }}>
          <div className="row g-0 align-items-stretch">
            {/* Preview on the left */}
            <div
              className="col-md-5 d-none d-md-block bg-light"
              style={{ borderRight: '1px solid #e5e7eb' }}
            >
              <div className="h-100 w-100 p-4 d-flex flex-column justify-content-start align-items-center">
                <div className="mb-3 small text-muted w-100">Preview</div>

                <div className="w-100 mb-3" style={{ maxWidth: 260 }}>
                  <div className="small text-muted mb-2"><b>Thumbnail</b></div>
                  {thumbnailPreviewUrl ? (
                    <img
                      src={thumbnailPreviewUrl}
                      alt="Thumbnail preview"
                      className="img-fluid rounded border"
                      style={{ maxHeight: 160, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className="border rounded d-flex align-items-center justify-content-center text-muted"
                      style={{ width: '100%', height: 120, fontSize: 12 }}
                    >
                      No thumbnail selected
                    </div>
                  )}
                </div>

                <div className="w-100 mb-3" style={{ maxWidth: 260 }}>
                  <div className="small text-muted mb-2"><b>Visual image</b></div>
                  {visualPreviewUrl ? (
                    <img
                      src={visualPreviewUrl}
                      alt="Visual image preview"
                      className="img-fluid rounded border"
                      style={{ maxHeight: 200, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className="border rounded d-flex align-items-center justify-content-center text-muted"
                      style={{ width: '100%', height: 140, fontSize: 12 }}
                    >
                      No visual image selected
                    </div>
                  )}
                </div>

                <div className="w-100" style={{ maxWidth: 260 }}>
                  <div className="small text-muted mb-2"><b>YouTube preview</b></div>
                  {form.values.youtubeVideoUrl ? (
                    <div className="ratio ratio-16x9 border rounded overflow-hidden">
                      <iframe
                        src={form.values.youtubeVideoUrl}
                        title="YouTube preview"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ border: 0 }}
                      />
                    </div>
                  ) : (
                    <div
                      className="border rounded d-flex align-items-center justify-content-center text-muted"
                      style={{ width: '100%', height: 140, fontSize: 12 }}
                    >
                      No YouTube URL provided
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form on the right */}
            <div className="col-12 col-md-7 p-4 bg-white">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <div className="text-uppercase small text-muted mb-1">Education Web</div>
                  <h2 className="h5 mb-0">{editingId ? 'Edit Web Content' : 'Add Web Content'}</h2>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setModalOpened(false)}
                />
              </div>

              <form onSubmit={form.onSubmit(handleSave)}>
                <Stack>
                  <TextInput label="Title" required {...form.getInputProps('title')} />
                  <FileInput
                    label={editingId ? 'Replace thumbnail (optional)' : 'Thumbnail image'}
                    accept="image/*"
                    placeholder="Insert image..."
                    onChange={(file) => {
                      form.setFieldValue('thumbnailFile', file || null);
                      if (file instanceof File) {
                        try {
                          setThumbnailPreviewUrl(URL.createObjectURL(file));
                        } catch {
                          setThumbnailPreviewUrl(null);
                        }
                      } else {
                        setThumbnailPreviewUrl(form.values.imageThumbnailUrl || null);
                      }
                    }}
                  />
                  <TextInput label="Label (blue category)" {...form.getInputProps('label')} />
                  <Textarea
                    label="Purpose"
                    autosize
                    minRows={2}
                    {...form.getInputProps('purpose')}
                  />
                  <Textarea
                    label="Overview"
                    autosize
                    minRows={2}
                    {...form.getInputProps('overview')}
                  />
                  <Textarea
                    label="Main explanation"
                    autosize
                    minRows={3}
                    {...form.getInputProps('mainExplanation')}
                  />
                  <hr />
                  <Stack gap="xs">
                    <Title order={5}>Key concepts</Title>
                    {conceptsLoading ? (
                      <Loader size="sm" />
                    ) : (
                      concepts.map((c, idx) => (
                        <Group key={idx} align="flex-start">
                          <div style={{ flex: 1 }}>
                            <div className="fw-semibold">{c.conceptTitle}</div>
                            <div
                              className="small text-muted"
                              style={{ whiteSpace: 'pre-line' }}
                            >
                              {c.conceptDescription}
                            </div>
                          </div>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => removeConcept(idx)}
                          >
                            Remove
                          </Button>
                        </Group>
                      ))
                    )}
                    <Stack gap="xs">
                      <TextInput
                        label="Concept title"
                        {...conceptForm.getInputProps('conceptTitle')}
                      />
                      <Textarea
                        label="Description"
                        autosize
                        minRows={1}
                        maxRows={4}
                        {...conceptForm.getInputProps('conceptDescription')}
                      />
                      <Group justify="flex-end">
                        <Button size="xs" type="button" onClick={addConcept}>
                          Add
                        </Button>
                      </Group>
                    </Stack>
                  </Stack>
                  <hr />
                  <FileInput
                    label={editingId ? 'Replace visual image (optional)' : 'Visual image'}
                    accept="image/*"
                    placeholder="Insert image..."
                    onChange={(file) => {
                      form.setFieldValue('visualFile', file || null);
                      if (file instanceof File) {
                        try {
                          setVisualPreviewUrl(URL.createObjectURL(file));
                        } catch {
                          setVisualPreviewUrl(null);
                        }
                      } else {
                        setVisualPreviewUrl(form.values.visualImageUrl || null);
                      }
                    }}
                  />

                  <Textarea
                    label="Benefits"
                    autosize
                    minRows={2}
                    {...form.getInputProps('benefits')}
                  />
                  <Textarea
                    label="Limitations / notes"
                    autosize
                    minRows={2}
                    {...form.getInputProps('limitationsOrNotes')}
                  />
                  <TextInput
                    label="YouTube Embeded Code"
                    {...form.getInputProps('youtubeVideoUrl')}
                    onBlur={(event) => {
                      const normalized = normalizeYoutubeInput(event.currentTarget.value);
                      form.setFieldValue('youtubeVideoUrl', normalized);
                    }}
                    onChange={(event) => {
                      form.setFieldValue('youtubeVideoUrl', event.currentTarget.value);
                    }}
                  />
                  <Group justify="flex-end" gap="xs">
                    <Button
                      type="button"
                      size="xs"
                      variant="light"
                      onClick={() => {
                        const current = form.values.youtubeVideoUrl;
                        const normalized = normalizeYoutubeInput(current);
                        form.setFieldValue('youtubeVideoUrl', normalized);
                      }}
                    >
                      Check / clean URL
                    </Button>
                  </Group>
                  <Checkbox label="Published" {...form.getInputProps('isPublished', { type: 'checkbox' })} />

                  <Group justify="flex-end" mt="md">
                    <Button variant="default" type="button" onClick={() => setModalOpened(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" loading={saving}>
                      Save
                    </Button>
                  </Group>
                </Stack>
              </form>
            </div>
          </div>
        </div>
      </Modal>
    </Stack>
  );
}
