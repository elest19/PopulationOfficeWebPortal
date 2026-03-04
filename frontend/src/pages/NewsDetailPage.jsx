import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Modal, TextInput, Textarea, FileInput, Stack, Progress, Button as MantineButton } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { getNewsById, updateNews, deleteNews } from '../api/news.js';
import { uploadNewsImage } from '../api/uploads.js';
import { DeleteConfirmModal } from '../components/common/DeleteConfirmModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import popcomLogo from '../content/POPCOM-Logo.jpg';

export function NewsDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const { user, isAdmin, isOfficer } = auth;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpened, setEditOpened] = useState(false);
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [zoomImageUrl, setZoomImageUrl] = useState(null);

  const form = useForm({
    initialValues: {
      title: '',
      content: '',
      imageFile: null,
    },
    validate: {
      title: (v) => (String(v).trim() ? null : 'Title is required'),
      content: (v) => (String(v).trim() ? null : 'Content is required'),
    },
  });

  useEffect(() => {
    setLoading(true);
    setError(null);
    getNewsById(id)
      .then((res) => setItem(res.data.data))
      .catch(() => setError('Failed to load news item'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!item) return;
    form.setValues({
      title: item.title || '',
      content: item.content || '',
      imageFile: null,
    });
    if (imagePreviewUrl) {
      try { URL.revokeObjectURL(imagePreviewUrl); } catch (_) {}
    }
    setImagePreviewUrl(null);
    setUploadProgress(0);
    setFileInputKey((k) => k + 1);
  }, [item]);

  const existingImageUrl = item?.imageUrl || null;

  const getAuthorName = () => {
    if (!item) return null;
    // Prefer explicit authorUsername if present, otherwise fall back to possible fields
    return (
      item.authorUsername ||
      item.authorName ||
      item.createdByName ||
      null
    );
  };

  const getMetaLine = () => {
    if (!item) return '';
    const datePart = item.publishedAt
      ? new Date(item.publishedAt).toLocaleDateString('en-US')
      : '';
    const author = getAuthorName();
    if (datePart && author) return `${datePart} - ${author}`;
    if (datePart) return datePart;
    if (author) return author;
    return '';
  };

  const getCurrentUserId = () => {
    if (!user) return null;
    return user.id ?? user.userId ?? null;
  };

  const isOwnedByCurrentUser = () => {
    if (!item) return false;
    const currentId = getCurrentUserId();
    if (!currentId) return false;
    const ownerId =
      item.createdById ??
      item.createdByUserId ??
      item.userId ??
      item.authorId ??
      item.createdBy ??
      null;
    if (ownerId == null) return false;
    return String(ownerId) === String(currentId);
  };

  const handleEditSubmit = async (values) => {
    const { hasErrors } = form.validate();
    if (hasErrors) return;

    try {
      let imageUrl = existingImageUrl;
      if (values.imageFile instanceof File) {
        setUploadProgress(1);
        const up = await uploadNewsImage(values.imageFile, { onProgress: (pct) => setUploadProgress(pct) });
        imageUrl = up?.data?.data?.publicUrl || null;
      }

      const payload = {
        title: values.title,
        content: values.content,
        imageUrl,
        isPublished: true,
      };

      await updateNews(id, payload);
      showNotification({ title: 'Saved', message: 'News updated', color: 'green' });

      const res = await getNewsById(id);
      setItem(res.data.data);

      setEditOpened(false);
      setUploadProgress(0);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to save news';
      showNotification({ title: 'Error', message: msg, color: 'red' });
      setUploadProgress(0);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteNews(id);
      showNotification({ title: 'Deleted', message: 'News deleted', color: 'green' });
      setDeleteOpened(false);
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to delete news';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  const serviceItems = [
    { to: '/services/pre-marriage-orientation', label: 'Pre-Marriage Orientation (PMOC)' },
    { to: '/services/usapan-series', label: 'Usapan Sessions' },
    { to: '/services/rpfp', label: 'Responsible Parenthood (RPFP)' },
    { to: '/services/ahdp', label: 'Adolescent Health (AHDP)' },
    { to: '/services/iec', label: 'Population Awareness (IEC)' },
    { to: '/services/population-profiling', label: 'Demographic Profiling' },
    { to: '/services/community-events', label: 'Community Events' },
    { to: '/services/other-assistance', label: 'Other Assistance' }
  ];

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border" role="status" aria-label="Loading news" />
      </div>
    );
  }

  if (error || !item) {
    return <div className="container py-5 text-danger">{error || 'News not found.'}</div>;
  }

  return (
    <section className="py-4 bg-white">
      <div className="container">
        <div className="row g-4">
          <div className="col-12">
            <div className="d-flex mb-3 justify-content-between align-items-center">
              <button
                className="btn btn-primary rounded-pill px-4 py-2 d-inline-flex align-items-center shadow-sm"
                onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                aria-label="Go back"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="currentColor"
                  className="me-2"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M11.354 1.146a.5.5 0 0 1 0 .708L5.207 8l6.147 6.146a.5.5 0 0 1-.708.708l-6.5-6.5a.5.5 0 0 1 0-.708l6.5-6.5a.5.5 0 0 1 .708 0z"/>
                </svg>
                Back
              </button>
              {(isAdmin || (isOfficer && isOwnedByCurrentUser())) && (
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      backgroundColor: '#e0efff',
                      color: '#0d6efd',
                      borderColor: 'transparent',
                      fontWeight: 600,
                      minWidth: 72,
                    }}
                    onClick={() => setEditOpened(true)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      borderColor: 'transparent',
                      fontWeight: 600,
                      minWidth: 72,
                    }}
                    onClick={() => setDeleteOpened(true)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <div className="row g-4 mt-1">
              <div className="col-12 col-lg-8">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="img-fluid rounded mb-3 shadow-sm"
                    style={{ width: '100%', maxHeight: 480, objectFit: 'cover' }}
                  />
                )}
              </div>
              <div className="col-12 col-lg-4">
                <div className="vstack gap-3 h-100">
                  <div className="card shadow-sm">
                    <div className="card-body">
                      <h5 className="card-title h6 mb-2">Services</h5>
                      <div className="row small">
                        <div className="col-6">
                          <ul className="list-styled mb-0">
                            {serviceItems.slice(0, Math.ceil(serviceItems.length / 2)).map((s) => (
                              <li key={s.to} className="mb-1"><Link to={s.to}>{s.label}</Link></li>
                            ))}
                          </ul>
                        </div>
                        <div className="col-6">
                          <ul className="list-styled mb-0">
                            {serviceItems.slice(Math.ceil(serviceItems.length / 2)).map((s) => (
                              <li key={s.to} className="mb-1"><Link to={s.to}>{s.label}</Link></li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card shadow-sm">
                    <div className="card-body d-flex justify-content-center align-items-center">
                      <img
                        src={popcomLogo}
                        alt="POPCOM Logo"
                        className="img-fluid rounded"
                        style={{ maxHeight: 220, objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <h1 className="h2 fw-bold mb-2">{item.title}</h1>
            <div className="text-muted small mb-3">
              {getMetaLine()}
            </div>
              <hr />
            <div className="mt-3 fs-6" style={{ whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
              {item.content}
            </div>
          </div>
        </div>
      </div>

      {(isAdmin || isOfficer) && (
        <>
          <DeleteConfirmModal
            opened={deleteOpened}
            onCancel={() => setDeleteOpened(false)}
            onConfirm={handleConfirmDelete}
            confirmLabel="Delete news"
            message="This action cannot be undone. The selected news article will be permanently removed."
            loading={false}
          />

          <Modal
            opened={editOpened}
            onClose={() => {
              setEditOpened(false);
              setUploadProgress(0);
            }}
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
          >
            <div className="card border-0 shadow-lg" style={{ borderRadius: '0.75rem' }}>
              <div className="row g-0 align-items-stretch">
              <div
                className="col-md-5 d-none d-md-block bg-light"
                style={{ borderRight: '1px solid #e5e7eb' }}
              >
                <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center align-items-center" align="center">
                  <div className="mb-3 small text-muted w-100">Preview</div>
                  {(() => {
                    const currentUrl = existingImageUrl;
                    const replacementUrl = imagePreviewUrl;

                    if (!currentUrl && !replacementUrl) {
                      return (
                        <div
                          className="border rounded d-flex align-items-center justify-content-center text-muted"
                          style={{ width: '100%', maxWidth: 320, height: 160, fontSize: 12 }}
                        >
                          No image selected
                        </div>
                      );
                    }

                    return (
                      <div className="w-100 d-flex flex-column gap-3 align-items-center">
                        {currentUrl && (
                          <div className="w-100" style={{ maxWidth: 260 }}>
                            <div className="small text-muted mb-2"><b>Current image</b></div>
                            <img
                              src={currentUrl}
                              alt="Current news visual"
                              className="img-fluid rounded border"
                              style={{ maxHeight: 160, objectFit: 'cover', cursor: 'pointer' }}
                              onClick={() => setZoomImageUrl(currentUrl)}
                            />
                          </div>
                        )}
                        <br />
                        <br />
                        {replacementUrl && (
                          <div className="w-100" style={{ maxWidth: 260 }}>
                            <div className="small text-muted mb-2"><b>Replacement image</b></div>
                            <img
                              src={replacementUrl}
                              alt="Replacement news visual"
                              className="img-fluid rounded border"
                              style={{ maxHeight: 320, objectFit: 'cover', cursor: 'pointer' }}
                              onClick={() => setZoomImageUrl(replacementUrl)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="col-12 col-md-7 p-4 bg-white">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <div className="text-uppercase small text-muted mb-1">News</div>
                    <h2 className="h5 mb-0">Edit News</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => {
                      setEditOpened(false);
                      setUploadProgress(0);
                    }}
                  />
                </div>

                <form
                  onSubmit={form.onSubmit((values) => {
                    handleEditSubmit(values).catch(() => {});
                  })}
                >
                  <Stack>
                    <TextInput label="Title" required {...form.getInputProps('title')} />
                    <Textarea
                      label="Content"
                      required
                      minRows={14}
                      autosize={false}
                      styles={{ input: { maxHeight: 650, minHeight: 260, overflowY: 'auto' } }}
                      {...form.getInputProps('content')}
                    />

                    <FileInput
                      label={existingImageUrl ? 'Replace image (optional)' : 'Image (optional)'}
                      accept="image/*"
                      key={fileInputKey}
                      onChange={(file) => {
                        if (imagePreviewUrl) {
                          try { URL.revokeObjectURL(imagePreviewUrl); } catch (_) {}
                        }
                        if (file instanceof File) {
                          try {
                            setImagePreviewUrl(URL.createObjectURL(file));
                          } catch {
                            setImagePreviewUrl(null);
                          }
                        } else {
                          setImagePreviewUrl(null);
                        }
                        form.setFieldValue('imageFile', file || null);
                        setUploadProgress(0);
                      }}
                    />

                    {uploadProgress > 0 && uploadProgress < 100 && <Progress value={uploadProgress} />}

                    <div className="d-flex justify-content-end gap-2 pt-2 mt-1 border-top">
                      <MantineButton variant="default" onClick={() => {
                        setEditOpened(false);
                        setUploadProgress(0);
                      }}>
                        Cancel
                      </MantineButton>
                      <MantineButton type="submit">Save changes</MantineButton>
                    </div>
                  </Stack>
                </form>
              </div>
            </div>
            </div>
          </Modal>

          <Modal
            opened={!!zoomImageUrl}
            onClose={() => setZoomImageUrl(null)}
            centered
            size="xl"
            withCloseButton
            title="Image preview"
          >
            {zoomImageUrl && (
              <div className="w-100 d-flex justify-content-center">
                <img
                  src={zoomImageUrl}
                  alt="Zoomed news visual"
                  className="img-fluid rounded border"
                  style={{ maxHeight: '70vh', objectFit: 'contain' }}
                />
              </div>
            )}
          </Modal>
        </>
      )}
    </section>
  );
}
