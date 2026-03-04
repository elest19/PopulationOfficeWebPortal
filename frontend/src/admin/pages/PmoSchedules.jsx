import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Title, Text, Table, Loader, Center, Badge, Group, Button, Modal, TextInput, Select, Textarea, Pagination } from '@mantine/core';
import { DatePickerInput, MonthPickerInput, YearPickerInput } from '@mantine/dates';
import dayjs from 'dayjs';

import { getPmoAdminSchedules, updatePmoAdminSchedule, archivePmoAdminSchedule, unarchivePmoAdminSchedule } from '../../api/pmoAdmin.js';
import { socket } from '../../socket.js';
import { showNotification } from '@mantine/notifications';
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal.jsx';
import { getActiveCounselors } from '../../api/counselors.js';

export function PmoSchedules() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [counselorsLoading, setCounselorsLoading] = useState(true);
  const [counselors, setCounselors] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    description: '',
    details: '',
    counselor: '',
    status: '',
    date: '',
    start_time: '',
    end_time: ''
  });
  const [deleteId, setDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryFilterType, setSummaryFilterType] = useState(''); // counselor, schedule, status, location
  const [summaryCounselor, setSummaryCounselor] = useState('');
  const [summaryStatus, setSummaryStatus] = useState('');
  const [summaryLocation, setSummaryLocation] = useState('');
  const [summaryScheduleMode, setSummaryScheduleMode] = useState(''); // day, month, year
  const [summaryScheduleDay, setSummaryScheduleDay] = useState(null);
  const [summaryScheduleMonth, setSummaryScheduleMonth] = useState(null);
  const [summaryScheduleYear, setSummaryScheduleYear] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [summaryPage, setSummaryPage] = useState(1);
  const summaryPageSize = 10;
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const handler = () => load();
    socket.on('pmo:updated', handler);
    return () => socket.off('pmo:updated', handler);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPmoAdminSchedules();
      const raw = res.data.data || [];
      const sorted = [...raw].sort((a, b) => {
        const statusA = String(a.status || '').toUpperCase();
        const statusB = String(b.status || '').toUpperCase();

        const isDoneA = statusA === 'CANCELLED' || statusA === 'COMPLETED' || statusA === 'FINISHED';
        const isDoneB = statusB === 'CANCELLED' || statusB === 'COMPLETED' || statusB === 'FINISHED';

        if (isDoneA !== isDoneB) {
          // Non-cancelled/non-completed first, then cancelled/completed
          return isDoneA ? 1 : -1;
        }

        const dateA = dayjs(a.date);
        const dateB = dayjs(b.date);

        if (dateA.isBefore(dateB)) return -1;
        if (dateA.isAfter(dateB)) return 1;
        return 0;
      });
      setRows(sorted);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset pagination when rows change
  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  // Reset summary pagination when filters or modal state change
  useEffect(() => {
    if (summaryOpen) {
      setSummaryPage(1);
    }
  }, [summaryOpen, summaryFilterType, summaryCounselor, summaryStatus, summaryLocation, summaryScheduleMode, summaryScheduleDay, summaryScheduleMonth, summaryScheduleYear]);

  useEffect(() => {
    load().catch(() => {});
  }, []);

  useEffect(() => {
    setCounselorsLoading(true);
    getActiveCounselors()
      .then((res) => setCounselors(res.data.data || []))
      .catch(() => setCounselors([]))
      .finally(() => setCounselorsLoading(false));
  }, []);

  const counselorOptions = useMemo(() => {
    return (counselors || [])
      .map((c) => ({
        value: String(c.id ?? c.counselorID),
        label: c.name ?? c.counselor_name ?? 'Unknown counselor'
      }))
      .filter((opt) => opt.value && opt.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [counselors]);

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      description: row.description || row.place || '',
      details: row.details || '',
      counselor: row.counselor != null ? String(row.counselor) : '',
      status: row.status || '',
      date: row.date ? String(row.date).slice(0, 10) : '',
      start_time: row.start_time ? String(row.start_time).slice(0, 5) : '',
      end_time: row.end_time ? String(row.end_time).slice(0, 5) : ''
    });
    setEditOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing?.id) {
      setEditOpen(false);
      return;
    }
    try {
      await updatePmoAdminSchedule(editing.id, {
        description: form.description,
        details: form.details || null,
        counselor: form.counselor ? Number(form.counselor) : null,
        status: form.status,
        date: form.date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null
      });
      showNotification({ title: 'Saved', message: 'Schedule updated.', color: 'green' });
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to update schedule';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  const sortedRows = rows; // rows are already sorted in load()

  // Distinct options for summary filters
  const summaryCounselorOptions = useMemo(() => {
    const set = new Set();
    (sortedRows || []).forEach((s) => {
      if (s.counselor_name) set.add(String(s.counselor_name));
    });
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [sortedRows]);

  const summaryStatusOptions = useMemo(() => {
    const set = new Set();
    (sortedRows || []).forEach((s) => {
      if (s.status) set.add(String(s.status));
    });
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [sortedRows]);

  const summaryLocationOptions = useMemo(() => {
    const set = new Set();
    (sortedRows || []).forEach((s) => {
      const loc = s.description || s.place;
      if (loc) set.add(String(loc));
    });
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [sortedRows]);

  const filteredSummaryRows = useMemo(() => {
    let list = sortedRows || [];

    if (summaryFilterType === 'counselor' && summaryCounselor) {
      list = list.filter((s) => String(s.counselor_name || '') === summaryCounselor);
    }

    if (summaryFilterType === 'status' && summaryStatus) {
      list = list.filter((s) => String(s.status || '') === summaryStatus);
    }

    if (summaryFilterType === 'location' && summaryLocation) {
      list = list.filter((s) => String(s.description || s.place || '') === summaryLocation);
    }

    if (summaryFilterType === 'schedule' && summaryScheduleMode) {
      list = list.filter((s) => {
        if (!s.date) return false;
        const d = dayjs(s.date);
        if (!d.isValid()) return false;

        if (summaryScheduleMode === 'day' && summaryScheduleDay) {
          return d.isSame(summaryScheduleDay, 'day');
        }
        if (summaryScheduleMode === 'month' && summaryScheduleMonth) {
          return d.isSame(summaryScheduleMonth, 'month');
        }
        if (summaryScheduleMode === 'year' && summaryScheduleYear) {
          return d.isSame(summaryScheduleYear, 'year');
        }
        return true;
      });
    }

    return list;
  }, [sortedRows, summaryFilterType, summaryCounselor, summaryStatus, summaryLocation, summaryScheduleMode, summaryScheduleDay, summaryScheduleMonth, summaryScheduleYear]);

  const filteredRows = useMemo(() => {
    return (sortedRows || []).filter((s) => {
      const v = String(s.status || '').toUpperCase();
      if (showArchived) return v === 'ARCHIVED';
      return v !== 'ARCHIVED';
    });
  }, [sortedRows, showArchived]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const paginatedSummaryRows = useMemo(() => {
    const start = (summaryPage - 1) * summaryPageSize;
    return filteredSummaryRows.slice(start, start + summaryPageSize);
  }, [filteredSummaryRows, summaryPage, summaryPageSize]);

  const handleArchive = async (id) => {
    try {
      await archivePmoAdminSchedule(id);
      await load();
      showNotification({ title: 'Archived', message: 'Schedule archived.', color: 'green' });
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to archive schedule';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  const handleUnarchive = async (id) => {
    try {
      await unarchivePmoAdminSchedule(id);
      await load();
      showNotification({ title: 'Restored', message: 'Schedule restored.', color: 'green' });
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to unarchive schedule';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  return (
    <Stack>
      <Group justify="space-between" align="center" mb="xs">
        <div>
          <Title order={2}>PMO - Schedules</Title>
          <Text c="dimmed">Manage available PMO schedules.</Text>
        </div>
        <Group gap="xs">
          <Button size="xs" variant="outline" onClick={() => setSummaryOpen(true)} disabled={rows.length === 0}>
            Summary
          </Button>
          <Button
            size="xs"
            variant={showArchived ? 'filled' : 'outline'}
            color={showArchived ? 'gray' : 'dark'}
            onClick={() => {
              setShowArchived((prev) => !prev);
              setPage(1);
            }}
            disabled={rows.length === 0}
          >
            Archived
          </Button>
        </Group>
      </Group>

      {loading ? (
        <Center>
          <Loader size="sm" />
        </Center>
      ) : rows.length === 0 ? (
        <Text size="sm" c="dimmed">No schedules found.</Text>
      ) : (
        <>
          <Table striped withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>No.</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Time</Table.Th>
                <Table.Th>Location</Table.Th>
                <Table.Th>Counselor</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedRows.map((s, index) => {
                const rowNumber = (page - 1) * pageSize + index + 1;
                const statusUpper = String(s.status || '').toUpperCase();
                const isArchived = statusUpper === 'ARCHIVED';
                return (
                  <Table.Tr key={s.id}>
                    <Table.Td>{rowNumber}</Table.Td>
                    <Table.Td>{dayjs(s.date).format('MMM D, YYYY')}</Table.Td>
                  <Table.Td>
                    {String(s.start_time).slice(0, 5)} - {String(s.end_time).slice(0, 5)}
                  </Table.Td>
                  <Table.Td>{s.description || s.place || '—'}</Table.Td>
                  <Table.Td>{s.counselor_name || '—'}</Table.Td>
                  <Table.Td>
                    <Badge variant="filled">{s.status}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-start">
                      <Button size="xs" variant="light" onClick={() => openEdit(s)}>Edit</Button>
                      {!isArchived && (
                        <Button
                          size="xs"
                          variant="light"
                          color="yellow"
                          disabled={s.status === 'Cancelled' || s.status === 'Completed'}
                          onClick={() => setCancelId(s.id)}
                        >
                          Cancel
                        </Button>
                      )}
                      {!isArchived && (
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() => handleArchive(s.id)}
                        >
                          Archive
                        </Button>
                      )}
                      {isArchived && (
                        <Button
                          size="xs"
                          color="green"
                          variant="light"
                          onClick={() => handleUnarchive(s.id)}
                        >
                          Unarchive
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
              })}
            </Table.Tbody>
          </Table>
          {filteredRows.length > pageSize && (
            <Group justify="flex-end" mt="sm">
              <Pagination
                total={Math.ceil(filteredRows.length / pageSize)}
                value={page}
                onChange={setPage}
                size="sm"
              />
            </Group>
          )}
        </>
      )}

      <DeleteConfirmModal
        opened={cancelId != null}
        onCancel={() => { if (!cancelLoading) setCancelId(null); }}
        onConfirm={async () => {
          if (!cancelId) return;
          setCancelLoading(true);
          try {
            await updatePmoAdminSchedule(cancelId, { status: 'Cancelled' });
            await load();
            setCancelId(null);
            showNotification({ title: 'Cancelled', message: 'Schedule cancelled.', color: 'yellow' });
          } catch (err) {
            const msg = err?.response?.data?.error?.message || 'Failed to cancel schedule';
            showNotification({ title: 'Error', message: msg, color: 'red' });
          } finally {
            setCancelLoading(false);
          }
        }}
        confirmLabel="Cancel schedule"
        message="Are you sure you want to cancel this PMO schedule? Existing bookings may be affected."
        loading={cancelLoading}
      />

      <Modal
        opened={editOpen}
        onClose={() => { setEditOpen(false); setEditing(null); }}
        withCloseButton={false}
        centered
        size="xl"
      >
        <div className="row g-0 align-items-stretch">
          {/* Left: schedule summary */}
          <div
            className="col-md-5 d-none d-md-block bg-light"
            style={{ borderRight: '1px solid #e5e7eb' }}
          >
            <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center" align="left">
              <div className="mb-3 small text-muted">Schedule Preview</div>
              {editing && (
                <Stack gap="xs">
                  <Text fw={600}>{dayjs(form.date || editing.date).format('MMMM D, YYYY')}</Text>
                  <Text size="sm" c="dimmed">
                    Time: {form.start_time || String(editing.start_time).slice(0, 5)} - {form.end_time || String(editing.end_time).slice(0, 5)}
                  </Text>
                  <Text size="sm">
                    Location: {form.description || editing.description || editing.place || '—'}
                  </Text>
                  <Text size="sm">
                    Details: {form.details || editing.details || '—'}
                  </Text>
                  <Text size="sm">
                    Counselor: {editing.counselor_name || '—'}
                  </Text>
                  <Badge mt="sm" variant="filled">{form.status || editing.status}</Badge>
                </Stack>
              )}
            </div>
          </div>

          {/* Right: form */}
          <div className="col-12 col-md-7 p-4">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="text-uppercase small text-muted mb-1">PMO Schedule</div>
                <h2 className="h5 mb-0">Edit Schedule</h2>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => { setEditOpen(false); setEditing(null); }}
              />
            </div>

            <form onSubmit={handleSave}>
              <Stack>
                <TextInput
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.currentTarget.value }))}
                />
                <Group grow>
                  <TextInput
                    label="Start time"
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.currentTarget.value }))}
                  />
                  <TextInput
                    label="End time"
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.currentTarget.value }))}
                  />
                </Group>

                <TextInput
                  label="Location"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.currentTarget.value }))}
                />
                <Textarea
                  label="Details"
                  minRows={3}
                  value={form.details}
                  onChange={(e) => setForm((f) => ({ ...f, details: e.currentTarget.value }))}
                />
                <Select
                  label="Counselor"
                  placeholder={counselorsLoading ? 'Loading counselors...' : 'Select counselor'}
                  searchable
                  clearable
                  data={counselorOptions}
                  value={form.counselor || null}
                  onChange={(v) => setForm((f) => ({ ...f, counselor: v || '' }))}
                  disabled={counselorsLoading}
                />
                <Select
                  label="Status"
                  data={['Scheduled', 'Cancelled', 'Completed'].map((s) => ({ value: s, label: s }))}
                  value={form.status || 'Scheduled'}
                  onChange={(v) => setForm((f) => ({ ...f, status: v || '' }))}
                />

                <div className="d-flex justify-content-end gap-2 pt-2 mt-1 border-top">
                  <Button variant="default" type="button" onClick={() => { setEditOpen(false); setEditing(null); }}>
                    Cancel
                  </Button>
                  <Button type="submit">Save changes</Button>
                </div>
              </Stack>
            </form>
          </div>
        </div>
      </Modal>

      {/* Summary modal */}
      <Modal
        opened={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        centered
        size="xl"
        title={
          <Stack gap={4}>
            <Text fw={700}>Schedules Summary</Text>
          </Stack>
        }
      >
        <Stack gap="md">
          <Stack gap={4}>
            <Group gap="sm" align="flex-end">
              <Select
                label="Filter by"
                placeholder="None"
                data={[
                  { value: 'counselor', label: 'Counselor' },
                  { value: 'schedule', label: 'Schedule' },
                  { value: 'status', label: 'Status' },
                  { value: 'location', label: 'Location' },
                ]}
                value={summaryFilterType}
                onChange={(v) => {
                  setSummaryFilterType(v || '');
                  setSummaryCounselor('');
                  setSummaryStatus('');
                  setSummaryLocation('');
                  setSummaryScheduleMode('');
                  setSummaryScheduleDay(null);
                  setSummaryScheduleMonth(null);
                  setSummaryScheduleYear(null);
                }}
                clearable
                w={180}
              />

              {summaryFilterType === 'counselor' && (
                <Select
                  label="Counselor"
                  placeholder="Select counselor"
                  data={summaryCounselorOptions}
                  value={summaryCounselor}
                  onChange={(v) => setSummaryCounselor(v || '')}
                  searchable
                  clearable
                  w={220}
                />
              )}

              {summaryFilterType === 'status' && (
                <Select
                  label="Status"
                  placeholder="Select status"
                  data={summaryStatusOptions}
                  value={summaryStatus}
                  onChange={(v) => setSummaryStatus(v || '')}
                  w={180}
                />
              )}

              {summaryFilterType === 'location' && (
                <Select
                  label="Location"
                  placeholder="Select location"
                  data={summaryLocationOptions}
                  value={summaryLocation}
                  onChange={(v) => setSummaryLocation(v || '')}
                  searchable
                  clearable
                  w={260}
                />
              )}

              {summaryFilterType === 'schedule' && (
                <Group gap="sm" align="flex-end">
                  <Select
                    label="Schedule filter"
                    placeholder="Select granularity"
                    data={[
                      { value: 'day', label: 'Day' },
                      { value: 'month', label: 'Month' },
                      { value: 'year', label: 'Year' },
                    ]}
                    value={summaryScheduleMode}
                    onChange={(v) => {
                      setSummaryScheduleMode(v || '');
                      setSummaryScheduleDay(null);
                      setSummaryScheduleMonth(null);
                      setSummaryScheduleYear(null);
                    }}
                    w={160}
                  />

                  {summaryScheduleMode === 'day' && (
                    <DatePickerInput
                      label="Day"
                      placeholder="Pick date"
                      value={summaryScheduleDay}
                      onChange={setSummaryScheduleDay}
                      firstDayOfWeek={0}
                      valueFormat="MMM D, YYYY"
                    />
                  )}

                  {summaryScheduleMode === 'month' && (
                    <MonthPickerInput
                      label="Month"
                      placeholder="Pick month"
                      value={summaryScheduleMonth}
                      onChange={setSummaryScheduleMonth}
                    />
                  )}

                  {summaryScheduleMode === 'year' && (
                    <YearPickerInput
                      label="Year"
                      placeholder="Select year"
                      value={summaryScheduleYear}
                      onChange={setSummaryScheduleYear}
                    />
                  )}
                </Group>
              )}
            </Group>
          </Stack>

          <Stack gap={4}>
            <Text size="sm"><b>Total schedules:</b> {filteredSummaryRows.length}</Text>
          </Stack>

          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>No.</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Time</Table.Th>
                <Table.Th>Location</Table.Th>
                <Table.Th>Counselor</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedSummaryRows.map((s, index) => {
                const rowNumber = (summaryPage - 1) * summaryPageSize + index + 1;
                return (
                  <Table.Tr key={`summary-${s.id}`}>
                    <Table.Td>{rowNumber}</Table.Td>
                    <Table.Td>{dayjs(s.date).format('MMM D, YYYY')}</Table.Td>
                  <Table.Td>
                    {String(s.start_time).slice(0, 5)} - {String(s.end_time).slice(0, 5)}
                  </Table.Td>
                  <Table.Td>{s.description || s.place || '—'}</Table.Td>
                  <Table.Td>{s.counselor_name || '—'}</Table.Td>
                  <Table.Td>{s.status || '—'}</Table.Td>
                </Table.Tr>
              );
              })}
              {filteredSummaryRows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed">No schedules match the selected filters.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          {filteredSummaryRows.length > summaryPageSize && (
            <Group justify="flex-end" mt="sm">
              <Pagination
                total={Math.ceil(filteredSummaryRows.length / summaryPageSize)}
                value={summaryPage}
                onChange={setSummaryPage}
                size="sm"
              />
            </Group>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
