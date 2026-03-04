import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Group, Loader, Modal, Pagination, Progress, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';

import { getAdminFileTasks, createAdminFileTask, updateAdminFileTask, archiveAdminFileTask, unarchiveAdminFileTask } from '../../api/fileTasks.js';

export function FileTasksAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(340); // backend page size; client paginates grouped tasks separately (enough for many tasks * 34 barangays)
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  const [editing, setEditing] = useState(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [officerFilterType, setOfficerFilterType] = useState(''); // '', 'status'
  const [officerFilterValue, setOfficerFilterValue] = useState('');
  const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    submitUntil: null, // Date object
  });

  const resetForm = () => {
    setEditing(null);
    setForm({ title: '', description: '', submitUntil: null });
  };

  const fetchTasks = async (opts = {}) => {
    const p = opts.page ?? page;
    const l = opts.limit ?? limit;
    const s = opts.status ?? statusFilter;
    setLoading(true);
    try {
      const res = await getAdminFileTasks({ page: p, limit: l, status: s || undefined });
      setRows(res.data?.data || []);
      setTotal(res.data?.meta?.total || 0);
      setPage(res.data?.meta?.page || p);
      setLimit(res.data?.meta?.limit || l);
    } catch (err) {
      showNotification({ title: 'Error', message: err?.response?.data?.error?.message || 'Failed to load tasks', color: 'red' });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    resetForm();
    openModal();
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      title: row?.taskTitle || '',
      description: row?.description || '',
      submitUntil: row?.submitUntil ? new Date(row.submitUntil) : null,
    });
    openModal();
  };

  const handleSave = async () => {
    if (!form.title || !form.submitUntil) {
      showNotification({ title: 'Validation', message: 'Please provide a title and a deadline.', color: 'yellow' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        taskTitle: form.title,
        description: form.description || '',
        // Send ISO string at midnight local time for the selected date
        submitUntil:
          form.submitUntil instanceof Date
            ? new Date(
                form.submitUntil.getFullYear(),
                form.submitUntil.getMonth(),
                form.submitUntil.getDate(),
                23,
                59,
                59,
              ).toISOString()
            : form.submitUntil,
      };
      if (editing) {
        await updateAdminFileTask(editing.id || editing.fileTaskID || editing.filetaskid, payload);
        showNotification({ title: 'Updated', message: 'Task updated.', color: 'green' });
      } else {
        await createAdminFileTask(payload);
        showNotification({ title: 'Created', message: 'Tasks created for all barangay officers.', color: 'green' });
      }
      closeModal();
      resetForm();
      await fetchTasks({ page: 1 });
    } catch (err) {
      showNotification({ title: 'Error', message: err?.response?.data?.error?.message || 'Failed to save task', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const getGroupTaskId = (group) => group?.id || group?.rows?.[0]?.id || group?.rows?.[0]?.fileTaskID || group?.rows?.[0]?.filetaskid;

  const handleArchive = async (group) => {
    const id = getGroupTaskId(group);
    if (!id) return;
    setRowActionLoadingId(id);
    try {
      await archiveAdminFileTask(id);
      showNotification({ title: 'Archived', message: 'Document report archived.', color: 'green' });
      await fetchTasks({ page: 1 });
    } catch (err) {
      showNotification({ title: 'Error', message: err?.response?.data?.error?.message || 'Failed to archive report', color: 'red' });
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleUnarchive = async (group) => {
    const id = getGroupTaskId(group);
    if (!id) return;
    setRowActionLoadingId(id);
    try {
      await unarchiveAdminFileTask(id);
      showNotification({ title: 'Restored', message: 'Document report unarchived.', color: 'green' });
      await fetchTasks({ page: 1 });
    } catch (err) {
      showNotification({ title: 'Error', message: err?.response?.data?.error?.message || 'Failed to unarchive report', color: 'red' });
    } finally {
      setRowActionLoadingId(null);
    }
  };

  // Client-side pagination over grouped tasks (cards)
  const groupsPerPage = 10;

  const statusColor = (s) => {
    const v = String(s || '').toUpperCase();
    if (v === 'PENDING') return 'yellow';
    if (v === 'SUBMITTED') return 'green';
    if (v === 'OVERDUE') return 'red';
    if (v === 'ARCHIVED') return 'gray';
    return 'gray';
  };

  // Group rows by task definition so the admin sees a single entry per task.
  const groupedTasks = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    const groups = new Map();

    const filteredRows = rows.filter((t) => {
      const v = String(t.status || '').toUpperCase();
      if (showArchived) return v === 'ARCHIVED';
      return v !== 'ARCHIVED';
    });

    filteredRows.forEach((t) => {
      // Group by the logical task definition (title + description + deadline)
      const key = [t.taskTitle || '', t.description || '', t.submitUntil || ''].join('||');
      if (!groups.has(key)) {
        groups.set(key, {
          id: t.id || t.fileTaskID || t.filetaskid,
          taskTitle: t.taskTitle,
          description: t.description,
          submitUntil: t.submitUntil,
          rows: [],
        });
      }
      const group = groups.get(key);
      group.rows.push(t);
    });

    // Convert to array and compute simple submission progress per group.
    return Array.from(groups.values()).map((g) => {
      const totalOfficers = g.rows.length;
      const submittedCount = g.rows.filter((r) => r.supabaseFileID || r.submittedAt || r.supabaseLink).length;
      return {
        ...g,
        totalOfficers,
        submittedCount,
      };
    });
  }, [rows, showArchived]);

  // Filtered officer rows for the modal, based on selected filter type/value
  const filteredOfficerRows = useMemo(() => {
    if (!selectedGroup) return [];
    let list = selectedGroup.rows || [];
    if (officerFilterType === 'status' && officerFilterValue) {
      const target = officerFilterValue.toLowerCase();
      list = list.filter((r) => String(r.status || '').toLowerCase() === target);
    } else if (officerFilterType === 'officer' && officerFilterValue) {
      const target = officerFilterValue.toLowerCase();
      list = list.filter((r) => String(r.officerName || '').toLowerCase() === target);
    } else if (officerFilterType === 'barangay' && officerFilterValue) {
      const target = officerFilterValue.toLowerCase();
      list = list.filter((r) => String(r.officerBarangay || '').toLowerCase() === target);
    } else if (officerFilterType === 'dateSubmitted' && officerFilterValue) {
      list = list.filter((r) => {
        if (!r.submittedAt) return false;
        const d = new Date(r.submittedAt);
        if (Number.isNaN(d.getTime())) return false;
        const value = d.toLocaleDateString();
        return value === officerFilterValue;
      });
    }
    // Always sort A–Z by barangay first, then officer name, for a stable, readable order.
    return [...list].sort((a, b) => {
      const brgyA = String(a.officerBarangay || '').toLowerCase();
      const brgyB = String(b.officerBarangay || '').toLowerCase();
      if (brgyA !== brgyB) {
        return brgyA.localeCompare(brgyB);
      }
      const nameA = String(a.officerName || '').toLowerCase();
      const nameB = String(b.officerName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [selectedGroup, officerFilterType, officerFilterValue]);

  const totalPages = Math.max(1, Math.ceil(groupedTasks.length / groupsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pagedGroups = useMemo(
    () => groupedTasks.slice((currentPage - 1) * groupsPerPage, currentPage * groupsPerPage),
    [groupedTasks, currentPage]
  );

  return (
    <Stack>
      <style>{`
        .task-list-item {
          transition: box-shadow 120ms ease, border-color 120ms ease, transform 80ms ease;
        }

        .task-list-item:hover {
          border-color: #3081fa !important;
          background-color: #f5f9ff !important;
          box-shadow: 0 0 0 2px rgba(48, 129, 250, 0.25), 0 8px 20px rgba(15, 23, 42, 0.08);
          transform: translateY(-1px);
        }

        .officer-filter-select:focus {
          box-shadow: none !important;
          border-color: #3081fa !important;
        }
      `}</style>
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>Document Reports</Title>
          <Text c="dimmed">Create and manage document report submissions required from all barangay officers.</Text>
        </div>
        <Group gap="xs">
          <Button size="sm" onClick={openCreate}>New Document Report</Button>
          <Button
            size="sm"
            variant={showArchived ? 'filled' : 'outline'}
            color={showArchived ? 'gray' : 'dark'}
            onClick={async () => {
              const next = !showArchived;
              const status = next ? 'Archived' : '';
              setShowArchived(next);
              setStatusFilter(status);
              await fetchTasks({ page: 1, status });
            }}
          >
            Archived
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="md" shadow="sm">
        {loading ? (
          <Group justify="center" py="lg"><Loader /></Group>
        ) : groupedTasks.length === 0 ? (
          <Text>No tasks found.</Text>
        ) : (
          <Stack gap="xs">
            {pagedGroups.map((g) => {
              const deadline = g.submitUntil
                ? new Date(g.submitUntil).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                  })
                : '';
              const initials = (g.taskTitle || 'T')
                .split(' ')
                .map((p) => p.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const ratio = g.totalOfficers ? (g.submittedCount / g.totalOfficers) : 0;
              const progressClass = g.submittedCount === g.totalOfficers
                ? 'bg-success'
                : g.submittedCount > 0
                  ? 'bg-warning'
                  : 'bg-danger';

              const repStatus = String(g.rows[0]?.status || '').toUpperCase();
              const isArchived = repStatus === 'ARCHIVED';
              const actionId = getGroupTaskId(g);

              return (
                <div
                  key={g.id}
                  className="d-flex align-items-center justify-content-between px-3 py-3 rounded-3 border shadow-sm bg-white task-list-item"
                  style={{ borderColor: '#e1e5f0', cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedGroup(g);
                    setGroupModalOpen(true);
                  }}
                >
                  {/* Left: avatar + title/description */}
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="d-flex align-items-center justify-content-center rounded-circle fw-semibold text-white"
                      style={{
                        width: 40,
                        height: 40,
                        background: '#3081fa',
                        fontSize: 16,
                      }}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="fw-semibold">{g.taskTitle}</div>
                      {g.description && (
                        <div className="text-muted small">{g.description}</div>
                      )}
                      <div className="text-muted small mt-1">
                        <strong>Deadline:</strong> {deadline || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Right: progress + actions */}
                  <div className="d-flex flex-column align-items-end" style={{ minWidth: 220 }}>
                    <div className="small fw-semibold mb-1">
                      {g.submittedCount} / {g.totalOfficers} submitted
                    </div>
                    <div className="progress mb-2" style={{ height: 6, width: 180 }}>
                      <div
                        className={`progress-bar ${progressClass}`}
                        role="progressbar"
                        style={{ width: `${ratio * 100}%` }}
                        aria-valuemin={0}
                        aria-valuemax={g.totalOfficers || 1}
                        aria-valuenow={g.submittedCount}
                      />
                    </div>
                    <div className="d-flex gap-1">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(g.rows[0]);
                        }}
                        disabled={rowActionLoadingId === actionId}
                      >
                        Edit
                      </Button>
                      {!isArchived && (
                        <Button
                          size="xs"
                          color="red"
                          variant="outline"
                          disabled={rowActionLoadingId === actionId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(g);
                          }}
                        >
                          Archive
                        </Button>
                      )}
                      {isArchived && (
                        <Button
                          size="xs"
                          color="green"
                          variant="outline"
                          disabled={rowActionLoadingId === actionId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnarchive(g);
                          }}
                        >
                          Unarchive
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </Stack>
        )}

        <Group justify="space-between" align="center" mt="md">
          <Text size="sm" c="dimmed">Page {currentPage} of {totalPages}</Text>
          <Pagination total={totalPages} value={currentPage} onChange={setPage} size="lg" />
        </Group>
      </Card>

      <Modal
        opened={modalOpened}
        onClose={() => { if (!saving) { closeModal(); resetForm(); } }}
        withCloseButton={false}
        centered
        size="xl"
      >
        <div className="row g-0 align-items-stretch">
          {/* Left: simple preview panel */}
          <div
            className="col-md-5 d-none d-md-block bg-light"
            style={{ borderLeft: '1px solid #e5e7eb' }}
          >
            <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center">
              <div className="d-flex flex-column align-items-center text-center">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                  style={{ width: 72, height: 72, backgroundColor: '#e5e7eb', fontWeight: 600 }}
                >
                  {(form.title || 'DR')
                    .split(' ')
                    .map((p) => p.charAt(0))
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="fw-bold" style={{ fontSize: 20 }}>
                  {form.title || 'New document report'}
                </div>
                <div className="text-muted small mb-1" style={{ maxWidth: 260 }}>
                  {form.description || 'Use document reports to request files and submissions from barangay officers.'}
                </div>
                <div className="small" style={{ color: '#6b7280' }}>
                  Deadline:{' '}
                  {form.submitUntil
                    ? new Date(form.submitUntil).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Not set yet'}
                </div>
              </div>
            </div>
          </div>

          {/* Right: form panel */}
          <div className="col-12 col-md-7 p-4">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="text-uppercase small text-muted mb-1">Document Reports</div>
                <h2 className="h5 mb-0">{editing ? 'Edit document report' : 'Add document report'}</h2>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <Stack>
                {saving && (
                  <Progress value={100} color="blue" size="sm" striped animated mb="xs" />
                )}
                <TextInput
                  label="Report title"
                  required
                  value={form.title}
                  onChange={(e) => {
                    const value = e?.currentTarget?.value ?? '';
                    setForm((f) => ({ ...f, title: value }));
                  }}
                />
                <Textarea
                  label="Description"
                  minRows={3}
                  value={form.description}
                  onChange={(e) => {
                    const value = e?.currentTarget?.value ?? '';
                    setForm((f) => ({ ...f, description: value }));
                  }}
                />
                <DatePickerInput
                  label="Deadline (submit until)"
                  placeholder="Select date"
                  value={form.submitUntil}
                  onChange={(v) => setForm((f) => ({ ...f, submitUntil: v }))}
                  dropdownType="popover"
                  popoverProps={{ withinPortal: true }}
                  firstDayOfWeek={0} // Sunday
                />

                <div className="d-flex justify-content-end gap-2 pt-2 mt-1 border-top">
                  <Button
                    variant="default"
                    disabled={saving}
                    onClick={() => { if (!saving) { closeModal(); resetForm(); } }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={saving}>
                    Save
                  </Button>
                </div>
              </Stack>
            </form>
          </div>
        </div>
      </Modal>

      {/* Modal showing all officers for a selected grouped task */}
      <Modal
        opened={groupModalOpen}
        onClose={() => { setGroupModalOpen(false); setSelectedGroup(null); setOfficerFilterType(''); setOfficerFilterValue(''); }}
        title={(
          <div className="w-100">
            <div className="fw-bold" style={{ fontSize: 20 }}>
              {selectedGroup ? ` ${selectedGroup.taskTitle}` : ''}
            </div>
          </div>
        )}
        size="xxl"
        centered
      >
        {selectedGroup ? (
          <>
            <div className="mb-3">
              <div className="small fw-semibold mb-1">Filter by</div>
              <div className="d-flex gap-2" style={{ maxWidth: 420 }}>
                <div className="position-relative" style={{ minWidth: 180 }}>
                  <select
                    className="form-select form-select-sm officer-filter-select"
                    style={{
                      width: '100%',
                      paddingRight: officerFilterType ? 28 : undefined,
                      // When a filter is selected and the clear (X) button is shown,
                      // hide the native dropdown arrow so it does not overlap with the X icon.
                      appearance: officerFilterType ? 'none' : undefined,
                      WebkitAppearance: officerFilterType ? 'none' : undefined,
                      MozAppearance: officerFilterType ? 'none' : undefined,
                      backgroundImage: officerFilterType ? 'none' : undefined,
                    }}
                    value={officerFilterType || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOfficerFilterType(value);
                      setOfficerFilterValue('');
                    }}
                  >
                    <option value="status">Status</option>
                    <option value="officer">Officer</option>
                    <option value="barangay">Barangay</option>
                    <option value="dateSubmitted">Date submitted</option>
                  </select>

                  {officerFilterType && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-muted position-absolute top-50 end-0 translate-middle-y px-2"
                      onClick={() => { setOfficerFilterType(''); setOfficerFilterValue(''); }}
                      aria-label="Clear filter"
                    >
                      ×
                    </button>
                  )}
                </div>

                {officerFilterType === 'status' && (
                  <select
                    className="form-select form-select-sm officer-filter-select"
                    value={officerFilterValue}
                    onChange={(e) => setOfficerFilterValue(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                )}

                {officerFilterType === 'officer' && (
                  <select
                    className="form-select form-select-sm officer-filter-select"
                    value={officerFilterValue}
                    onChange={(e) => setOfficerFilterValue(e.target.value)}
                  >
                    <option value="">All officers</option>
                    {Array.from(new Set((selectedGroup.rows || []).map((r) => r.officerName || '')))
                      .filter((v) => v)
                      .sort()
                      .map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                  </select>
                )}

                {officerFilterType === 'barangay' && (
                  <select
                    className="form-select form-select-sm officer-filter-select"
                    value={officerFilterValue}
                    onChange={(e) => setOfficerFilterValue(e.target.value)}
                  >
                    <option value="">All barangays</option>
                    {Array.from(new Set((selectedGroup.rows || []).map((r) => r.officerBarangay || '')))
                      .filter((v) => v)
                      .sort()
                      .map((brgy) => (
                        <option key={brgy} value={brgy}>{brgy}</option>
                      ))}
                  </select>
                )}

                {officerFilterType === 'dateSubmitted' && (
                  <select
                    className="form-select form-select-sm officer-filter-select"
                    value={officerFilterValue}
                    onChange={(e) => setOfficerFilterValue(e.target.value)}
                  >
                    <option value="">All dates</option>
                    {Array.from(new Set(
                      (selectedGroup.rows || [])
                        .filter((r) => r.submittedAt)
                        .map((r) => {
                          const d = new Date(r.submittedAt);
                          return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
                        })
                    ))
                      .filter((v) => v)
                      .sort()
                      .map((date) => (
                        <option key={date} value={date}>{date}</option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: '60vh' }}>
              <table className="table table-bordered table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 70 }}>No.</th>
                    <th>Officer</th>
                    <th>Barangay</th>
                    <th>Status</th>
                    <th>Date submitted</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOfficerRows.map((t, index) => {
                    const submittedDate = t.submittedAt
                      ? (() => {
                          const d = new Date(t.submittedAt);
                          return Number.isNaN(d.getTime())
                            ? ''
                            : d.toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric',
                              });
                        })()
                      : 'None';

                    return (
                      <tr key={t.id || t.fileTaskID || t.filetaskid}>
                        <td>{index + 1}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{t.officerName || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{t.officerBarangay || '—'}</td>
                        <td>
                          {(() => {
                            const v = String(t.status || '').toUpperCase();
                            let bg = '#3081fa'; // default blue
                            if (v === 'SUBMITTED') bg = '#16a34a'; // green
                            else if (v === 'OVERDUE') bg = '#dc2626'; // red
                            return (
                              <span className="badge text-uppercase" style={{ backgroundColor: bg, color: '#fff' }}>
                                {t.status || '—'}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{submittedDate || '—'}</td>
                        <td>
                          {t.supabaseLink ? (
                            <a href={t.supabaseLink} target="_blank" rel="noreferrer">Open File</a>
                          ) : (
                            <span className="text-muted small">No submission</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOfficerRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted small py-3">
                        No officers match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Text size="sm">No officers to display.</Text>
        )}
      </Modal>
    </Stack>
  );
}
