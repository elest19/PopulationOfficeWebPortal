import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Card, Badge, Table, Loader, Center, Text, Stack, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';

import { useAuth } from '../../context/AuthContext.jsx';
import { getMyUsapanAppointments, getMyPreMarriageAppointments } from '../../api/appointments.js';
import { getMyFamilyPlanningBookings } from '../../api/familyPlanning.js';
import { getMyPmoAppointments } from '../../api/pmo.js';
import { updateMyProfile, deleteMyAccount } from '../../api/users.js';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';
import { getMyFileTasks, submitMyFileTask, replaceMyFileTaskSubmission, deleteMyFileTaskSubmission } from '../../api/fileTasks.js';

const BARANGAYS = [
  'Alacan','Ambalangan-Dalin','Angio','Anonang','Aramal','Bigbiga','Binday','Bolaoen','Bolasi','Cabaruan','Cayanga','Colisao','Gomot','Inmalog','Inmalog Norte','Lekep-Butao','Lipit-Tomeeng','Longos','Longos Proper','Longos-Amangonan-Parac-Parac (Fabrica)','Mabilao','Nibaliw Central','Nibaliw East','Nibaliw Magliba','Nibaliw Narvarte (Nibaliw West Compound)','Nibaliw Vidal (Nibaliw West Proper)','Palapad','Poblacion','Rabon','Sagud-Bahley','Sobol','Tempra-Guilig','Tiblong','Tocok'
];

export function ProfileModal({ opened, onClose }) {
  const auth = useAuth() || {};
  const { user, isAdmin, isOfficer } = auth;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [editMode, setEditMode] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fpBookings, setFpBookings] = useState([]);
  const [fpLoading, setFpLoading] = useState(false);
  const [pmoAppointments, setPmoAppointments] = useState([]);
  const [pmoLoading, setPmoLoading] = useState(false);
  const [pmoSeminarAppointments, setPmoSeminarAppointments] = useState([]);
  const [pmoSeminarLoading, setPmoSeminarLoading] = useState(false);
  const [fileTasks, setFileTasks] = useState([]);
  const [fileTasksLoading, setFileTasksLoading] = useState(false);
  const [fileTasksSaving, setFileTasksSaving] = useState(false);
  const [fileTaskUploadingId, setFileTaskUploadingId] = useState(null);
  const [pendingUploadTask, setPendingUploadTask] = useState(null);
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [pendingUploadIsReplace, setPendingUploadIsReplace] = useState(false);
  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);
  const [fileTasksPage, setFileTasksPage] = useState(1);
  const [usapanPage, setUsapanPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [barangay, setBarangay] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!opened) {
      setEditMode(false);
      return;
    }
    // Reset per open
    setAppointments([]);
    setFpBookings([]);
    setPmoAppointments([]);
    setPmoSeminarAppointments([]);
    setFileTasks([]);
    setFileTasksPage(1);
    setUsapanPage(1);

    if (isOfficer) {
      setLoading(true);
      setFileTasksLoading(true);

      getMyUsapanAppointments()
        .then((res) => {
          setAppointments(res.data.data || []);
          setUsapanPage(1);
        })
        .catch(() => {
          setAppointments([]);
          setUsapanPage(1);
        })
        .finally(() => setLoading(false));

      getMyFileTasks()
        .then((res) => {
          const rows = res.data?.data || [];
          setFileTasks(rows);
          setFileTasksPage(1);
        })
        .catch(() => {
          setFileTasks([]);
          setFileTasksPage(1);
        })
        .finally(() => setFileTasksLoading(false));
    } else if (!isAdmin) {
      // Normal user: load Family Planning bookings, Pre-Marriage appointments, and PMO appointments
      setFpLoading(true);
      getMyFamilyPlanningBookings()
        .then((res) => {
          setFpBookings(res.data?.data || []);
        })
        .catch(() => {
          setFpBookings([]);
        })
        .finally(() => setFpLoading(false));

      setPmoLoading(true);
      getMyPreMarriageAppointments()
        .then((res) => {
          setPmoAppointments(res.data?.data || []);
        })
        .catch(() => {
          setPmoAppointments([]);
        })
        .finally(() => setPmoLoading(false));

      setPmoSeminarLoading(true);
      getMyPmoAppointments()
        .then((res) => {
          setPmoSeminarAppointments(res.data?.data || []);
        })
        .catch(() => {
          setPmoSeminarAppointments([]);
        })
        .finally(() => setPmoSeminarLoading(false));
    }
  }, [opened, isOfficer, isAdmin]);

  const roleLabel = isAdmin ? 'ADMIN' : isOfficer ? 'BARANGAY OFFICER' : 'USER';

  const statusColor = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') return 'yellow';
    if (s === 'APPROVED') return 'green';
    if (s === 'REJECTED' || s === 'CANCELLED') return 'red';
    if (s === 'COMPLETED') return 'blue';
    if (s === 'SUBMITTED') return 'green';
    if (s === 'OVERDUE') return 'red';
    return 'gray';
  };

  const FILE_TASKS_PAGE_SIZE = 5;
  const totalFileTaskPages = Math.max(1, Math.ceil((fileTasks?.length || 0) / FILE_TASKS_PAGE_SIZE));
  const safeFileTasksPage = Math.min(fileTasksPage, totalFileTaskPages);
  const paginatedFileTasks = useMemo(() => {
    if (!fileTasks || fileTasks.length === 0) return [];
    const start = (safeFileTasksPage - 1) * FILE_TASKS_PAGE_SIZE;
    return fileTasks.slice(start, start + FILE_TASKS_PAGE_SIZE);
  }, [fileTasks, safeFileTasksPage]);

  const computeFileTaskStatus = (task) => {
    if (!task) return 'PENDING';

    const raw = String(task.status || '').toUpperCase();
    if (raw === 'ARCHIVED') return 'ARCHIVED';

    if (task.submittedAt) return 'SUBMITTED';

    const now = new Date();
    const deadline = task.submitUntil ? new Date(task.submitUntil) : null;
    if (deadline && !Number.isNaN(deadline.getTime()) && now > deadline) {
      return 'OVERDUE';
    }

    return 'PENDING';
  };

  const computeFileTaskStatusColor = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'SUBMITTED') return '#2f9e44'; // green
    if (s === 'OVERDUE') return '#e03131';   // red
    if (s === 'ARCHIVED') return '#868e96';  // gray
    // default / PENDING
    return '#3081fa'; // blue
  };

  const USAPAN_PAGE_SIZE = 5;
  const totalUsapanPages = Math.max(1, Math.ceil((appointments?.length || 0) / USAPAN_PAGE_SIZE));
  const safeUsapanPage = Math.min(usapanPage, totalUsapanPages);

  const normalizedAppointments = useMemo(() => {
    if (!Array.isArray(appointments) || appointments.length === 0) return [];

    const sorted = [...appointments].sort((a, b) => {
      const da = new Date(a.date || a.created_at || 0).getTime();
      const db = new Date(b.date || b.created_at || 0).getTime();
      return da - db;
    });
    if (!sorted.length) return [];
    const start = (safeUsapanPage - 1) * USAPAN_PAGE_SIZE;
    return sorted.slice(start, start + USAPAN_PAGE_SIZE);
  }, [appointments, safeUsapanPage]);

  const initials = (user?.fullName || 'User')
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleClose = () => {
    setEditMode(false);
    onClose?.();
  };

  const { refreshProfile, logout } = useAuth();

  const handleEnterEdit = () => {
    setFullName(user?.fullName || '');
    setEmail(user?.email || '');
    setBarangay(user?.barangay || '');
    setContactNumber(user?.contactNumber || '');
    setUsername(user?.username || '');
    setPassword('');
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const normalizedContact = String(contactNumber || '').trim();
    if (!/^09\d{9}$/.test(normalizedContact)) {
      showNotification({
        title: 'Invalid contact number',
        message: 'Contact number must be 11 digits and start with 09',
        color: 'red',
      });
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        fullName,
        username,
        email,
        contactNumber: normalizedContact,
        barangay,
        password: password || null,
      });

      await refreshProfile?.();

      showNotification({
        title: 'Profile updated',
        message: 'Your profile has been updated.',
        color: 'green',
      });

      setEditMode(false);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to update profile.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteMyAccount();
      showNotification({
        title: 'Account deleted',
        message: 'Your account has been deleted.',
        color: 'green',
      });
      setDeleteLoading(false);
      setDeleteOpen(false);
      logout?.();
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to delete account.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
      setDeleteLoading(false);
    }
  };

  // Upload or replace a file task submission for the officer
  const handleFileTaskUpload = async (task, file, hasSubmission) => {
    if (!task || !file) return;
    const taskId = task.id || task.fileTaskID || task.filetaskid;
    if (!taskId) return;

    setFileTasksSaving(true);
    setFileTaskUploadingId(taskId);
    try {
      const apiCall = hasSubmission ? replaceMyFileTaskSubmission : submitMyFileTask;
      const res = await apiCall(taskId, file);
      const updated = res?.data?.data || res?.data || res;
      if (updated && (updated.id || updated.fileTaskID || updated.filetaskid)) {
        const updatedId = updated.id || updated.fileTaskID || updated.filetaskid;
        setFileTasks((prev) =>
          (prev || []).map((t) => (t.id === updatedId || t.fileTaskID === updatedId || t.filetaskid === updatedId ? updated : t))
        );
      }

      showNotification({
        title: hasSubmission ? 'File replaced' : 'File uploaded',
        message: 'Your file has been saved.',
        color: 'green',
      });
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to save file.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setFileTasksSaving(false);
      setFileTaskUploadingId(null);
    }
  };

  // Delete an existing file task submission and revert status
  const handleFileTaskDeleteSubmission = async (task) => {
    if (!task) return;
    const taskId = task.id || task.fileTaskID || task.filetaskid;
    if (!taskId) return;

    setFileTasksSaving(true);
    setFileTaskUploadingId(taskId);
    try {
      const res = await deleteMyFileTaskSubmission(taskId);
      const updated = res?.data?.data || res?.data || res;
      if (updated && (updated.id || updated.fileTaskID || updated.filetaskid)) {
        const updatedId = updated.id || updated.fileTaskID || updated.filetaskid;
        setFileTasks((prev) =>
          (prev || []).map((t) => (t.id === updatedId || t.fileTaskID === updatedId || t.filetaskid === updatedId ? updated : t))
        );
      }

      showNotification({
        title: 'Submission removed',
        message: 'Your file submission has been removed.',
        color: 'green',
      });
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to remove submission.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setFileTasksSaving(false);
      setFileTaskUploadingId(null);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      withCloseButton={false}
      size={isMobile ? '100%' : (editMode ? 'xl' : (isOfficer ? 'xxl' : 'lg'))}
      fullScreen={isMobile}
      classNames={{
        body: !editMode && isOfficer ? 'profile-modal-body officer-static' : 'profile-modal-body',
      }}
      styles={{
        content: {
          maxWidth: isMobile ? '100%' : (editMode ? '1080px' : (isOfficer ? '1280px' : '900px')),
          width: '100%',
        },
        body: {
          padding: 0,
        },
      }}
    >
      <style>{`
        .profile-modal-body {
          max-height: 90vh;
          overflow-y: auto;
          overflow-x: hidden;

        }
        .profile-modal-body.officer-static {
          max-height: 90vh;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .profile-modal-header {
          position: sticky;
          top: 0;
          z-index: 10;
          background-color: #ffffff;
        }
        .profile-modal-body::-webkit-scrollbar {
          width: 0px; /* Chrome, Safari */
          height: 0px;
          background: transparent;
        }
      `}</style>
      {editMode ? (
        <div className="container-fluid p-0">
          <div className="row g-0">
            <div className="col-12 bg-white">
              <div className="p-4 p-md-5">
                <div className="d-flex justify-content-between align-items-start mb-3 profile-modal-header">
                  <h2 className="h4 fw-bold mb-0">Edit your profile</h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={handleClose}
                  />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Full name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    {!isAdmin && (
                      <div className="col-md-6">
                        <label className="form-label">Barangay</label>
                        {isOfficer ? (
                          <input
                            type="text"
                            className="form-control"
                            value={barangay}
                            disabled
                          />
                        ) : (
                          <select
                            className="form-select"
                            value={barangay}
                            onChange={(e) => setBarangay(e.target.value)}
                          >
                            <option value="">Select barangay</option>
                            {BARANGAYS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                    <div className="col-md-6">
                      <label className="form-label">Contact number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <hr className="my-4" />

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Username</label>
                      <input
                        type="text"
                        className="form-control"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        readOnly={true}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                      />
                    </div>
                  </div>

                  <div className="mt-4 d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-semibold small mb-1">Delete your account?</div>
                      <div className="small text-muted">
                        Deleting your account will remove all your access. This action cannot be undone.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setDeleteOpen(true)}
                    >
                      Delete your account
                    </button>
                  </div>

                  <div className="d-flex justify-content-end gap-2 mt-4">
                    <Button
                      style={{ backgroundColor: '#3081faff' }}
                      loading={saving}
                      onClick={handleSave}
                    >
                      Save changes
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="container-fluid p-0">
          <div className="row g-0">
            {isOfficer && (
              <div className="col-12 col-md-7 order-2 order-md-1 bg-light d-flex flex-column">
                <div className="text-start d-flex flex-column flex-grow-1">
                  <Card withBorder radius="md" shadow="sm" className=" flex-grow-1 d-flex flex-column"> 
                    <Title order={3} mb="sm">
                      Documents To Submit
                    </Title>
                    <hr />
                    {fileTasksLoading ? (
                      <Center py="sm">
                        <Loader />
                      </Center>
                    ) : (
                      <div className="table-responsive" style={{ width: '100%' }}>
                        <table className="table table-bordered table-hover mb-0 align-middle">
                          <thead className="table-light">
                            <tr>
                              {!isMobile && <th style={{ width: 60}}>No.</th>}
                              <th>Task</th>
                              <th>Deadline</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fileTasks.length === 0 ? (
                              <tr>
                                <td colSpan={isMobile ? 4 : 5} className="text-center py-3">
                                  <Text size="sm">No assigned file tasks yet.</Text>
                                </td>
                              </tr>
                            ) : (
                              paginatedFileTasks.map((t, index) => {
                                const deadline = t.submitUntil
                                  ? new Date(t.submitUntil).toLocaleDateString(undefined, {
                                      year: 'numeric',
                                      month: 'numeric',
                                      day: 'numeric',
                                    })
                                  : '';
                                const hasSubmission = !!t.submittedAt;
                                const uploading = fileTaskUploadingId === t.id && fileTasksSaving;
                                const taskStatus = computeFileTaskStatus(t);
                                const taskStatusColor = computeFileTaskStatusColor(taskStatus);
                                return (
                                  <tr key={t.id}>
                                    {!isMobile && (
                                      <td>{index + 1 + (safeFileTasksPage - 1) * FILE_TASKS_PAGE_SIZE}</td>
                                    )}
                                    <td style={{ maxWidth: 260, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                      <div style={{ fontWeight: 500 }}>{t.taskTitle}</div>
                                      {t.description && (
                                        <div className="text-muted small" style={{ whiteSpace: 'normal' }}>
                                          {t.description}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{deadline || '—'}</td>
                                    <td>
                                      <span
                                        className="badge text-uppercase"
                                        style={{ backgroundColor: taskStatusColor, color: '#fff' }}
                                      >
                                        {taskStatus}
                                      </span>
                                    </td>
                                    <td>
                                      {hasSubmission ? (
                                        <div className="d-flex flex-column gap-1 align-items-start">
                                          {t.supabaseLink && (
                                            <a
                                              href={t.supabaseLink}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="small"
                                            >
                                              Open File
                                            </a>
                                          )}
                                          <span className="text-muted small">
                                            Submitted:{' '}
                                            {t.submittedAt
                                              ? new Date(t.submittedAt).toLocaleDateString()
                                              : 'None'}
                                          </span>
                                          <label
                                            className={`btn btn-sm btn-outline-primary mb-0 ${uploading ? 'disabled' : ''}`}
                                          >
                                            Replace
                                            <input
                                              type="file"
                                              style={{ display: 'none' }}
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                setPendingUploadTask(t);
                                                setPendingUploadFile(file);
                                                setPendingUploadIsReplace(true);
                                                setUploadConfirmOpen(true);
                                                e.target.value = '';
                                              }}
                                              disabled={uploading}
                                            />
                                          </label>
                                          {uploading && (
                                            <span className="text-muted small">Saving...</span>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="d-flex flex-column gap-1">
                                          <label
                                            className={`btn btn-sm btn-outline-primary mb-0 ${uploading ? 'disabled' : ''}`}
                                          >
                                            Upload
                                            <input
                                              type="file"
                                              style={{ display: 'none' }}
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                setPendingUploadTask(t);
                                                setPendingUploadFile(file);
                                                setPendingUploadIsReplace(false);
                                                setUploadConfirmOpen(true);
                                                e.target.value = '';
                                              }}
                                              disabled={uploading}
                                            />
                                          </label>
                                          {uploading && (
                                            <span className="text-muted small">Saving...</span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {fileTasks.length > FILE_TASKS_PAGE_SIZE && (
                      <div className="d-flex justify-content-between align-items-center mt-2">
                        <span className="small text-muted">
                          Page {safeFileTasksPage} of {totalFileTaskPages}
                        </span>
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            disabled={safeFileTasksPage <= 1}
                            onClick={() => setFileTasksPage((p) => Math.max(1, p - 1))}
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            disabled={safeFileTasksPage >= totalFileTaskPages}
                            onClick={() => setFileTasksPage((p) => Math.min(totalFileTaskPages, p + 1))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}

            <div className={`col-12 ${isOfficer ? 'col-md-5 order-1 order-md-2' : ''} bg-white`}>
              <div className="pt-4 px-4 px-md-4 pb-3 text-center">
                <div className="profile-modal-summary-sticky">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h2 className="h5 fw-bold mb-0">Profile</h2>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={handleClose}
                    />
                  </div>

                  <div className="d-flex flex-column align-items-center mt-3 mb-4">
                    <div
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: '50%',
                        backgroundColor: '#e1e7ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 32,
                      }}
                    >
                      {initials}
                    </div>
                    <div className="mt-3 mb-1">
                      <span className="badge rounded-pill text-bg-primary px-3 py-2">{roleLabel}</span>
                    </div>
                    <div className="fw-semibold fs-5">{user?.fullName || 'User'}</div>
                  </div>

                  <div className="mt-3 mb-2">
                    <button
                      type="button"
                      className="btn btn-primary w-100"
                      style={{ maxWidth: 360 }}
                      onClick={handleEnterEdit}
                    >
                      Edit profile
                    </button>
                  </div>
                </div>
                {isOfficer && (
                  <div className="mt-4 text-start">
                    <Card withBorder radius="md" shadow="sm" className="mb-3">
                      <Title order={3} mb="sm">
                        Usapan-Series Requests
                      </Title>
                      <hr />
                      {loading ? (
                        <Center py="lg">
                          <Loader />
                        </Center>
                      ) : normalizedAppointments.length === 0 ? (
                        <Text size="sm">No Usapan-Series requests yet.</Text>
                      ) : (
                        <>
                          <div style={{ width: '100%', overflowX: 'auto' }}>
                            <Table striped highlightOnHover withBorder>
                              <thead>
                                <tr>
                                  <th>Requested Date</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {normalizedAppointments.map((a) => {
                                  const dateValue = a.date || a.created_at;
                                  const requestedDate = dateValue
                                    ? new Date(dateValue).toLocaleDateString()
                                    : '';
                                  return (
                                    <tr key={a.usapanID || a.id}>
                                      <td style={{ whiteSpace: 'nowrap' }}>{requestedDate}</td>
                                      <td>
                                        <Badge color={statusColor(a.status)}>{a.status}</Badge>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </Table>
                          </div>
                          {appointments.length > USAPAN_PAGE_SIZE && (
                            <div className="d-flex justify-content-between align-items-center mt-2">
                              <span className="small text-muted">
                                Page {safeUsapanPage} of {totalUsapanPages}
                              </span>
                              <div className="btn-group btn-group-sm" role="group">
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  disabled={safeUsapanPage <= 1}
                                  onClick={() => setUsapanPage((p) => Math.max(1, p - 1))}
                                >
                                  Prev
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  disabled={safeUsapanPage >= totalUsapanPages}
                                  onClick={() => setUsapanPage((p) => Math.min(totalUsapanPages, p + 1))}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}

                        </>
                      )}
                    </Card>
                  </div>
                )}
                {!isAdmin && !isOfficer && (
                  <Card withBorder radius="md" shadow="sm" className="text-start mb-3">
                    <Title order={3} mb="sm">
                      PMO Orientation Appointments
                    </Title>
                    <hr />
                    {pmoSeminarLoading ? (
                      <Center py="lg">
                        <Loader />
                      </Center>
                    ) : pmoSeminarAppointments.length === 0 ? (
                      <Text size="sm">No PMO seminar appointments yet.</Text>
                    ) : (
                      <div style={{ width: '100%', overflowX: 'auto' }}>
                        <Table striped highlightOnHover withBorder>
                          <thead>
                            <tr>
                              <th>Schedule date</th>
                              <th>Time</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pmoSeminarAppointments.map((a) => {
                              const formatDateSafe = (value) => {
                                if (!value) return '';
                                const primary = new Date(value);
                                if (!Number.isNaN(primary.getTime())) {
                                  return primary.toLocaleDateString();
                                }
                                const raw = String(value);
                                const dateOnly = raw.length >= 10 ? raw.slice(0, 10) : raw;
                                const fallback = new Date(dateOnly);
                                if (!Number.isNaN(fallback.getTime())) {
                                  return fallback.toLocaleDateString();
                                }
                                return '';
                              };
                              const dateStr = formatDateSafe(a.scheduleDate);
                              const start = a.scheduleStartTime ? String(a.scheduleStartTime).slice(0, 5) : '';
                              const end = a.scheduleEndTime ? String(a.scheduleEndTime).slice(0, 5) : '';
                              const timeStr = start && end ? `${start} - ${end}` : (start || end || '');
                              return (
                                <tr key={a.appointmentId}>
                                  <td style={{ whiteSpace: 'nowrap' }}>{dateStr}</td>
                                  <td style={{ whiteSpace: 'nowrap' }}>{timeStr}</td>
                                  <td>
                                    <Badge color={statusColor(a.status)}>{a.status || 'PENDING'}</Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Card>
                )}

                {!isAdmin && !isOfficer && (
                  <Card withBorder radius="md" shadow="sm" className="text-start mb-3">
                    <Title order={3} mb="sm">
                      Family Planning Bookings
                    </Title>
                    <hr />
                    {fpLoading ? (
                      <Center py="lg">
                        <Loader />
                      </Center>
                    ) : fpBookings.length === 0 ? (
                      <Text size="sm">No Family Planning bookings yet.</Text>
                    ) : (
                      <div style={{ width: '100%', overflowX: 'auto' }}>
                        <Table striped highlightOnHover withBorder>
                          <thead>
                            <tr>
                              <th>Preferred date</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fpBookings.map((b) => {
                              const formatDateSafe = (value) => {
                                if (!value) return '';
                                const primary = new Date(value);
                                if (!Number.isNaN(primary.getTime())) {
                                  return primary.toLocaleDateString();
                                }
                                const raw = String(value);
                                const dateOnly = raw.length >= 10 ? raw.slice(0, 10) : raw;
                                const fallback = new Date(dateOnly);
                                if (!Number.isNaN(fallback.getTime())) {
                                  return fallback.toLocaleDateString();
                                }
                                return '';
                              };
                              const prefStr = formatDateSafe(b.pref_date);
                              return (
                                <tr key={b.id}>

                                  <td style={{ whiteSpace: 'nowrap' }}>{prefStr}</td>
                                  <td>
                                    <Badge color={statusColor(b.status)}>{b.status || 'Pending'}</Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <DeleteConfirmModal
        opened={deleteOpen}
        onCancel={() => {
          if (!deleteLoading) setDeleteOpen(false);
        }}
        onConfirm={handleConfirmDelete}
        title="Are you sure?"
        message="This action cannot be undone. Your account will be permanently removed and you will lose access to the system."
        confirmLabel="Delete account"
        loading={deleteLoading}
      />
      {isOfficer && (
        <DeleteConfirmModal
          opened={uploadConfirmOpen}
          onCancel={() => {
            if (fileTasksSaving) return;
            setUploadConfirmOpen(false);
            setPendingUploadTask(null);
            setPendingUploadFile(null);
            setPendingUploadIsReplace(false);
          }}
          onConfirm={async () => {
            if (!pendingUploadTask || !pendingUploadFile) return;
            await handleFileTaskUpload(pendingUploadTask, pendingUploadFile, pendingUploadIsReplace);
            setUploadConfirmOpen(false);
            setPendingUploadTask(null);
            setPendingUploadFile(null);
            setPendingUploadIsReplace(false);
          }}
          title={pendingUploadIsReplace ? 'Confirm file replacement' : 'Confirm file upload'}
          message={
            pendingUploadIsReplace
              ? 'This will replace your existing submitted file for this task in the system and in storage.'
              : 'This will upload the selected file as your submission for this task.'
          }
          confirmLabel={pendingUploadIsReplace ? 'Replace file' : 'Upload file'}
          loading={fileTasksSaving}
          color="blue"
        />
      )}
    </Modal>
  );
}
