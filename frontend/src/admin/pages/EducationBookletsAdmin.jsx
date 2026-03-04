import React, { useEffect, useState } from 'react';
import { Title, Stack, Group, Button, Table, Modal, TextInput, NumberInput, Checkbox, Loader, Center, Badge, Select, FileInput, Pagination } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import {
  listBooklets,
  createBooklet,
  updateBooklet,
  archiveBooklet,
  listBookletPages,
  createBookletPage,
  updateBookletPage,
  deleteBookletPage,
} from '../../api/educationBooklets.js';
import { uploadEducationBookletImage } from '../../api/uploads.js';

export function EducationBookletsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [pagesModalOpened, setPagesModalOpened] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [activeBooklet, setActiveBooklet] = useState(null);
  const [pageInputs, setPageInputs] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 10;

  const form = useForm({
    initialValues: {
      title: '',
      imageThumbnailUrl: '',
      brochureContentNumber: 1,
      isPublished: true,
      displayOrder: null,
      thumbnailFile: null,
    }
  });

  const pageForm = useForm({
    initialValues: {
      id: null,
      pageNumber: 1,
      imageUrl: '',
    }
  });

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await listBooklets();
      setItems(res.data?.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to load booklets.', color: 'red' });
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
    const maxOrder = items.reduce((max, b) => {
      const val = b.display_order ?? b.displayOrder;
      return typeof val === 'number' && !Number.isNaN(val) ? Math.max(max, val) : max;
    }, 0);

    form.reset();
    form.setValues({
      title: '',
      imageThumbnailUrl: '',
      brochureContentNumber: 1,
      isPublished: true,
      displayOrder: maxOrder + 1,
      thumbnailFile: null,
    });
    // Start with a single empty page input (Page 1)
    setPageInputs([
      { id: null, pageNumber: 1, imageUrl: '', imageFile: null },
    ]);
    setModalOpened(true);
  };

  const openEdit = async (item) => {
    setEditingId(item.id);

    form.setValues({
      title: item.title || '',
      imageThumbnailUrl: item.imageThumbnailUrl || item.image_thumbnail_url || '',
      brochureContentNumber: item.brochureContentNumber || item.brochure_content_number || 1,
      isPublished: !!(item.isPublished ?? item.is_published),
      displayOrder: item.displayOrder ?? item.display_order ?? null,
      thumbnailFile: null,
    });

    try {
      const res = await listBookletPages(item.id);
      const data = res.data?.data || [];

      if (data.length > 0) {
        setPageInputs(
          data
            .slice()
            .sort((a, b) => ((a.pageNumber ?? a.page_number ?? 0) - (b.pageNumber ?? b.page_number ?? 0)))
            .map((p, idx) => ({
              id: p.id,
              pageNumber: p.pageNumber ?? p.page_number ?? idx + 1,
              imageUrl: p.imageUrl || p.image_url || '',
              imageFile: null,
            }))
        );

        form.setFieldValue('brochureContentNumber', data.length);
      } else {
        const count = item.brochureContentNumber || item.brochure_content_number || 1;
        setPageInputs(
          Array.from({ length: count }, (_, i) => ({
            id: null,
            pageNumber: i + 1,
            imageUrl: '',
            imageFile: null,
          }))
        );
      }
    } catch (err) {
      console.error(err);
      const count = item.brochureContentNumber || item.brochure_content_number || 1;
      setPageInputs(
        Array.from({ length: count }, (_, i) => ({
          id: null,
          pageNumber: i + 1,
          imageUrl: '',
          imageFile: null,
        }))
      );
    }

    setModalOpened(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      let thumbnailUrl = values.imageThumbnailUrl || null;

      if (values.thumbnailFile instanceof File) {
        const up = await uploadEducationBookletImage(values.thumbnailFile);
        thumbnailUrl = up?.data?.data?.publicUrl || thumbnailUrl;
      }

      // Count active pages (those that will actually have an image: existing URL or selected file)
      const activeCount = pageInputs.filter((p) => {
        if (p.imageFile instanceof File) return true;
        return !!(p.imageUrl && String(p.imageUrl).trim());
      }).length;

      if (activeCount < 1) {
        showNotification({
          color: 'red',
          title: 'At least one page is required',
          message: 'Please add an image for at least one page before saving.',
        });
        setSaving(false);
        return;
      }

      const payload = {
        title: values.title,
        imageThumbnailUrl: thumbnailUrl,
        brochureContentNumber: activeCount,
        isPublished: values.isPublished,
        displayOrder: values.displayOrder,
      };

      let bookletId = editingId;
      if (editingId) {
        await updateBooklet(editingId, payload);
      } else {
        const res = await createBooklet(payload);
        bookletId = res?.data?.data?.id;
      }

      // Save page images based on pageInputs for this booklet
      if (bookletId) {
        const existingRes = await listBookletPages(bookletId);
        const existing = existingRes.data?.data || [];
        const existingById = new Map(existing.map((p) => [p.id, p]));

        // Upsert pages in order, but only for those that actually have an image
        let nextPageNumber = 1;
        for (let i = 0; i < pageInputs.length; i += 1) {
          const input = pageInputs[i];
          let imageUrl = (input.imageUrl || '').trim();

          if (input.imageFile instanceof File) {
            const up = await uploadEducationBookletImage(input.imageFile);
            const publicUrl = up?.data?.data?.publicUrl || null;
            if (publicUrl) {
              imageUrl = publicUrl;
            }
          }

          // Skip entries with no image at all
          if (!imageUrl) {
            if (input.id) {
              await deleteBookletPage(input.id);
            }
            continue;
          }

          const pageNumber = nextPageNumber;
          nextPageNumber += 1;

          if (input.id && !imageUrl) {
            // If existing page now has empty URL, delete it
            await deleteBookletPage(input.id);
            continue;
          }
          if (input.id && imageUrl) {
            await updateBookletPage(input.id, { pageNumber, imageUrl });
            existingById.delete(input.id);
            continue;
          }
          if (!input.id && imageUrl) {
            await createBookletPage(bookletId, { pageNumber, imageUrl });
          }
        }

        // Any remaining existing pages not represented in pageInputs should be deleted
        for (const leftover of existingById.values()) {
          await deleteBookletPage(leftover.id);
        }
      }

      showNotification({ title: 'Saved', message: 'Booklet saved.', color: 'green' });
      setModalOpened(false);
      await loadItems();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to save booklet.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id) => {
    try {
      await archiveBooklet(id);
      showNotification({ title: 'Archived', message: 'Booklet archived.', color: 'green' });
      await loadItems();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to archive booklet.', color: 'red' });
    }
  };

  const handleUnarchive = async (booklet) => {
    try {
      const payload = {
        title: booklet.title || '',
        imageThumbnailUrl: booklet.imageThumbnailUrl || booklet.image_thumbnail_url || null,
        brochureContentNumber: booklet.brochureContentNumber || booklet.brochure_content_number || 1,
        isPublished: true,
        displayOrder: booklet.displayOrder ?? booklet.display_order ?? null,
      };

      await updateBooklet(booklet.id, payload);
      showNotification({ title: 'Unarchived', message: 'Booklet published again.', color: 'green' });
      await loadItems();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to unarchive booklet.', color: 'red' });
    }
  };

  const isPublishedItem = (b) => (typeof b.isPublished === 'boolean' ? b.isPublished : !!b.is_published);

  const visibleItems = items.filter((b) => {
    if (showArchived) {
      return !isPublishedItem(b);
    }
    return isPublishedItem(b);
  });

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const pageItems = visibleItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openPages = async (booklet) => {
    setActiveBooklet(booklet);
    setPages([]);
    setPagesLoading(true);
    try {
      const res = await listBookletPages(booklet.id);
      setPages(res.data?.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to load booklet pages.', color: 'red' });
    } finally {
      setPagesLoading(false);
    }
    setPagesModalOpened(true);
  };

  const syncActiveBookletPageCount = async (bookletId, currentPages) => {
    if (!activeBooklet) return;
    const pagesArray = currentPages || pages || [];
    const count = pagesArray.length;
    if (count < 0) return;

    try {
      const payload = {
        title: activeBooklet.title || '',
        imageThumbnailUrl: activeBooklet.imageThumbnailUrl || activeBooklet.image_thumbnail_url || null,
        brochureContentNumber: count,
        isPublished: !!(activeBooklet.isPublished ?? activeBooklet.is_published),
        displayOrder: activeBooklet.displayOrder ?? activeBooklet.display_order ?? null,
      };
      const res = await updateBooklet(bookletId, payload);
      // Keep local activeBooklet in sync with backend response if available
      const updated = res?.data?.data || null;
      if (updated) {
        setActiveBooklet((prev) => (prev && prev.id === bookletId ? updated : prev));
      }
    } catch (err) {
      console.error(err);
      // We don't surface a separate notification here to avoid double errors; main handlers already notify on failure
    }
  };

  const openPageEdit = (page) => {
    if (page) {
      pageForm.setValues({
        id: page.id,
        pageNumber: page.page_number,
        imageUrl: page.image_url,
      });
    } else {
      pageForm.reset();
      pageForm.setFieldValue('pageNumber', (pages?.length || 0) + 1);
    }
  };

  const handleSavePage = async (values) => {
    if (!activeBooklet) return;
    try {
      const currentCount = pages?.length || 0;

      if (values.id) {
        // Updating an existing page does not change the count
        await updateBookletPage(values.id, {
          pageNumber: values.pageNumber,
          imageUrl: values.imageUrl,
        });
      } else {
        // Creating a new page increases the expected count by 1;
        // update the booklet first so the trigger sees matching values.
        await syncActiveBookletPageCount(activeBooklet.id, [
          ...pages,
          { id: null, page_number: values.pageNumber, image_url: values.imageUrl },
        ]);

        await createBookletPage(activeBooklet.id, {
          pageNumber: values.pageNumber,
          imageUrl: values.imageUrl,
        });
      }
      const res = await listBookletPages(activeBooklet.id);
      const newPages = res.data?.data || [];
      setPages(newPages);
      await syncActiveBookletPageCount(activeBooklet.id, newPages);
      pageForm.reset();
      showNotification({ title: 'Saved', message: 'Page saved.', color: 'green' });
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to save page.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  const handleDeletePage = async (pageId) => {
    if (!activeBooklet) return;
    try {
      // Deleting a page decreases the expected count; compute new set first
      const remaining = (pages || []).filter((p) => p.id !== pageId);
      await syncActiveBookletPageCount(activeBooklet.id, remaining);

      await deleteBookletPage(pageId);
      const res = await listBookletPages(activeBooklet.id);
      const newPages = res.data?.data || [];
      setPages(newPages);
      await syncActiveBookletPageCount(activeBooklet.id, newPages);
      showNotification({ title: 'Deleted', message: 'Page removed.', color: 'green' });
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to delete page.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  return (
    <Stack>
      <Group justify="space-between" mb="sm">
        <Title order={2}>Education Booklets</Title>
        <Group gap="xs">
          <Button
            variant={showArchived ? 'default' : 'filled'}
            onClick={openCreate}
          >
            Add booklet
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
              <Table.Th>Created at</Table.Th>
              <Table.Th>Published</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageItems.map((b) => (
              <Table.Tr key={b.id}>
                <Table.Td>{b.title}</Table.Td>
                <Table.Td style={{textAlign: 'center'}}>
                  {(() => {
                    const raw = b.createdAt || b.created_at;
                    if (!raw) return '-';
                    const d = new Date(raw);
                    // Fallback if date is invalid
                    if (Number.isNaN(d.getTime())) return String(raw);
                    return d.toLocaleDateString();
                  })()}
                </Table.Td>
                <Table.Td style={{textAlign: 'center'}}>
                  {b.isPublished ?? b.is_published
                    ? <Badge color="green">PUBLISHED</Badge>
                    : <Badge color="gray">ARCHIVED</Badge>}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  <Group justify="center" gap="xs">
                    <Button size="xs" variant="light" onClick={() => openEdit(b)}>
                      Edit
                    </Button>
                    {isPublishedItem(b) ? (
                      <Button
                        size="xs"
                        color="red"
                        variant="light"
                        onClick={() => handleArchive(b.id)}
                      >
                        Archive
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        color="green"
                        variant="light"
                        onClick={() => handleUnarchive(b)}
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
        scrollAreaComponent={undefined}
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
                  {form.values.imageThumbnailUrl ? (
                    <img
                      src={form.values.imageThumbnailUrl}
                      alt="Booklet thumbnail preview"
                      className="img-fluid rounded border"
                      style={{ maxHeight: 180, objectFit: 'contain' }}
                    />
                  ) : (
                    <div
                      className="border rounded d-flex align-items-center justify-content-center text-muted"
                      style={{ width: '100%', height: 140, fontSize: 12 }}
                    >
                      No thumbnail selected
                    </div>
                  )}
                </div>

                <div className="w-100" style={{ maxWidth: 260 }}>
                  <div className="small text-muted mb-2"><b>Pages</b></div>
                  {pageInputs && pageInputs.length > 0 ? (
                    <div
                      className="w-100"
                      style={{
                        maxHeight: 260,
                      }}
                    >
                      <div
                        className="row row-cols-3 g-2"
                        style={{ marginRight: 0, marginLeft: 0 }}
                      >
                        {pageInputs.map((p, idx) => (
                          <div key={idx} className="col">
                            <div className="small text-muted mb-1">Page {idx + 1}</div>
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={`Page ${idx + 1} preview`}
                                className="img-fluid rounded border"
                                style={{ maxHeight: 120, objectFit: 'contain', width: '100%' }}
                              />
                            ) : (
                              <div
                                className="border rounded d-flex align-items-center justify-content-center text-muted"
                                style={{ width: '100%', height: 80, fontSize: 11 }}
                              >
                                No image URL
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border rounded d-flex align-items-center justify-content-center text-muted"
                      style={{ width: '100%', height: 140, fontSize: 12 }}
                    >
                      No pages configured
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form on the right */}
            <div className="col-12 col-md-7 p-4 bg-white">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <div className="text-uppercase small text-muted mb-1">Education Booklet</div>
                  <h2 className="h5 mb-0">{editingId ? 'Edit Booklet' : 'Add Booklet'}</h2>
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
                    placeholder="thumbnail image..."
                    onChange={(file) => {
                      form.setFieldValue('thumbnailFile', file || null);
                      if (file instanceof File) {
                        try {
                          const url = URL.createObjectURL(file);
                          form.setFieldValue('imageThumbnailUrl', url);
                        } catch {
                          form.setFieldValue('imageThumbnailUrl', '');
                        }
                      }
                    }}
                  />
                  <Checkbox label="Published" {...form.getInputProps('isPublished', { type: 'checkbox' })} />

                  {pageInputs.map((p, idx) => (
                    <Group key={idx} align="flex-end" gap="xs">
                      <FileInput
                        style={{ flex: 1 }}
                        label={`Page ${idx + 1} image`}
                        accept="image/*"
                        placeholder="select image..."
                        onChange={(file) => {
                          setPageInputs((prev) => {
                            const next = [...prev];
                            const entry = next[idx] || { id: null, pageNumber: idx + 1, imageUrl: '', imageFile: null };
                            if (file instanceof File) {
                              let preview = '';
                              try {
                                preview = URL.createObjectURL(file);
                              } catch {
                                preview = '';
                              }
                              next[idx] = { ...entry, imageFile: file, imageUrl: preview || entry.imageUrl };
                            } else {
                              // Clearing the file keeps existing URL (if any) but removes pending upload
                              next[idx] = { ...entry, imageFile: null };
                            }
                            return next;
                          });
                        }}
                      />
                      <Button
                        type="button"
                        color="red"
                        variant="subtle"
                        onClick={() => {
                          setPageInputs((prev) => {
                            const filtered = prev.filter((_, i) => i !== idx);
                            const base =
                              filtered.length > 0
                                ? filtered
                                : [{ id: null, pageNumber: 1, imageUrl: '', imageFile: null }];
                            return base.map((item, i2) => ({ ...item, pageNumber: i2 + 1 }));
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </Group>
                  ))}

                  <Button
                    type="button"
                    variant="light"
                    onClick={() => {
                      setPageInputs((prev) => {
                        const next = [...prev];
                        const nextIndex = next.length;
                        next.push({
                          id: null,
                          pageNumber: nextIndex + 1,
                          imageUrl: '',
                          imageFile: null,
                        });
                        return next;
                      });
                    }}
                  >
                    Add image
                  </Button>

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

      <Modal
        opened={pagesModalOpened}
        onClose={() => setPagesModalOpened(false)}
        size="lg"
        centered
        title={activeBooklet ? `Pages for: ${activeBooklet.title}` : 'Pages'}
        scrollAreaComponent={undefined}
      >
        {pagesLoading ? (
          <Center py="lg"><Loader /></Center>
        ) : (
          <Stack>
            <Table striped withTableBorder withColumnBorders highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Page #</Table.Th>
                  <Table.Th>Image URL</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pages.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>{p.page_number}</Table.Td>
                    <Table.Td>{p.image_url}</Table.Td>
                    <Table.Td>
                      <Group justify="flex-end" gap="xs">
                        <Button size="xs" variant="light" type="button" onClick={() => openPageEdit(p)}>
                          Edit
                        </Button>
                        <Button size="xs" color="red" variant="light" type="button" onClick={() => handleDeletePage(p.id)}>
                          Remove
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <form
              onSubmit={pageForm.onSubmit((values) => {
                handleSavePage(values).catch(() => {});
              })}
            >
              <Stack mt="sm">
                <Group grow>
                  <NumberInput
                    label="Page number"
                    min={1}
                    {...pageForm.getInputProps('pageNumber')}
                  />
                  <TextInput
                    label="Image URL"
                    {...pageForm.getInputProps('imageUrl')}
                  />
                </Group>
                <Group justify="flex-end">
                  <Button type="submit" size="sm">
                    {pageForm.values.id ? 'Update page' : 'Add page'}
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
