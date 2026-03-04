import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Stack, Title, Text, Table, Loader, Center, Badge, Group, Button, Modal, TextInput, Select, Textarea, Pagination } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';

import { getCalendarEvents, updateCalendarEvent, cancelCalendarEvent } from '../../api/calendar.js';
import { socket } from '../../socket.js';
import { showNotification } from '@mantine/notifications';
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal.jsx';

const USAPAN_STATUSES = ['Pending', 'Scheduled', 'Ongoing', 'Completed', 'Rejected', 'Cancelled'];

export function UsapanRequests() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    date: '',
    start_time: '',
    barangay: '',
    status: ''
  });
  const [cancelId, setCancelId] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryFilterType, setSummaryFilterType] = useState(''); // date, barangay, requestedBy
  const [summaryDate, setSummaryDate] = useState(null);
  const [summaryBarangay, setSummaryBarangay] = useState('');
  const [summaryRequestedBy, setSummaryRequestedBy] = useState('');
  const outletCtx = useOutletContext?.() || {};
  const setReqPending = outletCtx.setReqPending;

  useEffect(() => {
    const handler = () => load();
    socket.on('usapan:updated', handler);
    return () => socket.off('usapan:updated', handler);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const start = dayjs().startOf('year').toISOString();
      const end = dayjs().endOf('year').toISOString();
      const res = await getCalendarEvents({ start, end });
      const all = res.data.data || [];
      const onlyPendingUsapan = all.filter((e) => {
        if (!e || e.type !== 'Usapan-Series') return false;
        const status = String(e.status || '').toUpperCase();
        return status === 'PENDING';
      });
      setRows(onlyPendingUsapan);
      if (typeof setReqPending === 'function') setReqPending(onlyPendingUsapan.length);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelId) return;
    const row = rows.find((r) => r.id === cancelId);
    if (!row) {
      setCancelId(null);
      setCancelReason('');
      return;
    }
    setCancelLoading(true);
    try {
      const dateStr = row.startDate
        ? String(row.startDate).slice(0, 10)
        : row.date || null;
      const startStr = row.startDate
        ? String(row.startDate).slice(11, 16)
        : (row.start_time ? String(row.start_time).slice(0, 5) : null);
      const endStr = row.endDate
        ? String(row.endDate).slice(11, 16)
        : (row.end_time ? String(row.end_time).slice(0, 5) : startStr);

      await updateCalendarEvent(row.id, {
        type: 'Usapan-Series',
        date: dateStr,
        title: null,
        counselorID: null,
        lead: null,
        location: null,
        barangay: row.location || null,
        userID: row.userID || null,
        startTime: startStr,
        endTime: endStr,
        status: 'Cancelled',
        reason: cancelReason || null
      });

      await load();
      setCancelId(null);
      setCancelReason('');
      showNotification({ title: 'Cancelled', message: 'Request cancelled.', color: 'yellow' });
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to cancel request';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejecting?.id) return;
    if (!rejectReason || !rejectReason.trim()) {
      showNotification({ title: 'Missing reason', message: 'Please provide a reason for rejection.', color: 'yellow' });
      return;
    }
    setRowActionLoadingId(rejecting.id);
    try {
      const dateStr = rejecting.startDate
        ? String(rejecting.startDate).slice(0, 10)
        : rejecting.date || null;
      const startStr = rejecting.startDate
        ? String(rejecting.startDate).slice(11, 16)
        : (rejecting.start_time ? String(rejecting.start_time).slice(0, 5) : null);
      const endStr = rejecting.endDate
        ? String(rejecting.endDate).slice(11, 16)
        : (rejecting.end_time ? String(rejecting.end_time).slice(0, 5) : startStr);

      await updateCalendarEvent(rejecting.id, {
        type: 'Usapan-Series',
        date: dateStr,
        title: null,
        counselorID: null,
        lead: null,
        location: null,
        barangay: rejecting.location || null,
        userID: rejecting.userID || null,
        startTime: startStr,
        endTime: endStr,
        status: 'Rejected'
      });
      await load();
      showNotification({ title: 'Rejected', message: 'Usapan request has been rejected.', color: 'green' });
      setRejecting(null);
      setRejectReason('');
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to reject request';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleApprove = async (row) => {
    if (!row?.id) return;
    setRowActionLoadingId(row.id);
    try {
      const dateStr = row.startDate
        ? String(row.startDate).slice(0, 10)
        : row.date || null;
      const startStr = row.startDate
        ? String(row.startDate).slice(11, 16)
        : (row.start_time ? String(row.start_time).slice(0, 5) : null);
      const endStr = row.endDate
        ? String(row.endDate).slice(11, 16)
        : (row.end_time ? String(row.end_time).slice(0, 5) : startStr);

      await updateCalendarEvent(row.id, {
        type: 'Usapan-Series',
        date: dateStr,
        title: null,
        counselorID: null,
        lead: null,
        location: null,
        barangay: row.location || null,
        userID: row.userID || null,
        startTime: startStr,
        endTime: endStr,
        status: 'Scheduled'
      });
      showNotification({ title: 'Approved', message: 'Usapan request approved and scheduled.', color: 'green' });
      await load();
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to approve request';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setRowActionLoadingId(null);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      date: row.startDate ? String(row.startDate).slice(0, 10) : '',
      start_time: row.startDate ? String(row.startDate).slice(11, 16) : '',
      barangay: row.location || '',
      status: row.status || 'Pending'
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
      const startStr = form.start_time || (editing.startDate ? String(editing.startDate).slice(11, 16) : null);
      const endStr = editing.endDate
        ? String(editing.endDate).slice(11, 16)
        : (editing.end_time ? String(editing.end_time).slice(0, 5) : startStr);

      await updateCalendarEvent(editing.id, {
        type: 'Usapan-Series',
        date: form.date || null,
        title: null,
        counselorID: null,
        lead: null,
        location: null,
        barangay: form.barangay || null,
        userID: editing.userID || null,
        startTime: startStr,
        endTime: endStr,
        status: form.status || 'Pending'
      });
      showNotification({ title: 'Saved', message: 'Usapan request updated.', color: 'green' });
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to update request';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  const statusBadgeColor = useMemo(() => {
    return (status) => {
      const s = String(status || '').toUpperCase();
      if (s === 'PENDING') return 'yellow';
      if (s === 'SCHEDULED') return 'blue';
      if (s === 'ONGOING') return 'orange';
      if (s === 'COMPLETED') return 'green';
      if (s === 'REJECTED') return 'red';
      if (s === 'CANCELLED') return 'gray';
      return 'gray';
    };
  }, []);

  const filteredRows = rows.filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const date = dayjs(s.startDate || s.dateStr || s.date);
    const dateStr = date.isValid() ? date.format('MMM D, YYYY').toLowerCase() : '';
    return (
      String(s.location || '').toLowerCase().includes(q) ||
      String(s.requesterName || '').toLowerCase().includes(q) ||
      String(s.status || '').toLowerCase().includes(q) ||
      dateStr.includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Summary filter options
  const summaryBarangayOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      if (r.location) set.add(String(r.location));
    });
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const summaryRequestedByOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      if (r.requesterName) set.add(String(r.requesterName));
    });
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const filteredSummaryRows = useMemo(() => {
    let list = rows || [];

    if (summaryFilterType === 'date' && summaryDate) {
      list = list.filter((s) => {
        const d = dayjs(s.startDate || s.dateStr || s.date);
        return d.isValid() && d.isSame(summaryDate, 'day');
      });
    }

    if (summaryFilterType === 'barangay' && summaryBarangay) {
      list = list.filter((s) => String(s.location || '') === summaryBarangay);
    }

    if (summaryFilterType === 'requestedBy' && summaryRequestedBy) {
      list = list.filter((s) => String(s.requesterName || '') === summaryRequestedBy);
    }

    return list;
  }, [rows, summaryFilterType, summaryDate, summaryBarangay, summaryRequestedBy]);

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>Usapan-Series - Requests</Title>
          <Text c="dimmed">View and manage Pending Usapan-Series requests submitted by barangay officers.</Text>
        </div>
        <Group gap="xs" align="center">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setSummaryOpen(true)}
            disabled={rows.length === 0}
          >
            Summary
          </Button>
          <TextInput
            size="sm"
            placeholder="Search by barangay, date, or status..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ maxWidth: 280 }}
          />
        </Group>
      </Group>

      {loading ? (
        <Center>
          <Loader size="sm" />
        </Center>
      ) : filteredRows.length === 0 ? (
        <Text size="sm" c="dimmed">No pending requests found.</Text>
      ) : (
        <Table striped withTableBorder withColumnBorders highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>No.</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Time</Table.Th>
              <Table.Th>Requested by</Table.Th>
              <Table.Th>Barangay</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pagedRows.map((s, index) => {
              const rowNumber = (currentPage - 1) * pageSize + index + 1;
              const date = dayjs(s.startDate || s.dateStr || s.date);

              // Derive start and end time strings (HH:MM) from possible fields
              const rawStart = s.startDate || s.start_time || s.startTime;
              const rawEnd = s.endDate || s.end_time || s.endTime;
              const startStr = rawStart ? String(rawStart).slice(11, 16) : '';
              const endStr = rawEnd ? String(rawEnd).slice(11, 16) : '';
              const timeStr = startStr && endStr ? `${startStr} - ${endStr}` : (startStr || '—');

              const isRowBusy = rowActionLoadingId === s.id;

              return (
                <Table.Tr key={s.id}>
                  <Table.Td>{rowNumber}</Table.Td>
                  <Table.Td>{date.isValid() ? date.format('MMM D, YYYY') : '—'}</Table.Td>
                  <Table.Td>{timeStr}</Table.Td>
                  <Table.Td>{s.requesterName || '—'}</Table.Td>
                  <Table.Td>{s.location || '—'}</Table.Td>
                  <Table.Td>
                    <Badge variant="filled" color={statusBadgeColor(s.status)}>{s.status}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-start">
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        onClick={() => handleApprove(s)}
                        loading={isRowBusy}
                        disabled={isRowBusy}
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        onClick={() => !isRowBusy && setRejecting(s)}
                        disabled={isRowBusy}
                      >
                        Reject
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="yellow"
                        disabled={
                          isRowBusy ||
                          String(s.status).toUpperCase() === 'CANCELLED' ||
                          String(s.status).toUpperCase() === 'COMPLETED'
                        }
                        onClick={() => { if (!isRowBusy) setCancelId(s.id); }}
                      >
                        Cancel
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      {!loading && filteredRows.length > pageSize && (
        <Group justify="flex-end" mt="sm">
          <Pagination
            size="sm"
            value={currentPage}
            onChange={setPage}
            total={totalPages}
          />
        </Group>
      )}

      <Modal
        opened={cancelId != null}
        onClose={() => { if (!cancelLoading) { setCancelId(null); setCancelReason(''); } }}
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
              Are you sure you want to cancel this Usapan request? Existing arrangements may be affected.
            </Text>
          </div>

          <Textarea
            label="Reason for cancellation"
            placeholder="Enter the reason for cancellation (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.currentTarget.value)}
            minRows={3}
          />

          <div className="d-flex flex-column gap-2 mt-2">
            <Button
              color="red"
              fullWidth
              onClick={handleConfirmCancel}
              loading={cancelLoading}
              disabled={cancelLoading}
            >
              Cancel request
            </Button>
            <Button
              color="gray"
              fullWidth
              onClick={() => { if (!cancelLoading) { setCancelId(null); setCancelReason(''); } }}
            >
              Back
            </Button>
          </div>
        </Stack>
      </Modal>

      {/* Summary modal */}
      <Modal
        opened={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        centered
        size="xl"
        title={
          <Stack gap={4}>
            <Text fw={700}>Usapan-Series Requests Summary</Text>
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
                  { value: 'date', label: 'Date' },
                  { value: 'barangay', label: 'Barangay' },
                  { value: 'requestedBy', label: 'Requested by' },
                ]}
                value={summaryFilterType}
                onChange={(v) => {
                  setSummaryFilterType(v || '');
                  setSummaryDate(null);
                  setSummaryBarangay('');
                  setSummaryRequestedBy('');
                }}
                clearable
                w={180}
              />

              {summaryFilterType === 'date' && (
                <DatePickerInput
                  label="Date"
                  placeholder="Pick date"
                  value={summaryDate}
                  onChange={setSummaryDate}
                  firstDayOfWeek={0}
                  valueFormat="MMM D, YYYY"
                />
              )}

              {summaryFilterType === 'barangay' && (
                <Select
                  label="Barangay"
                  placeholder="Select barangay"
                  data={summaryBarangayOptions}
                  value={summaryBarangay}
                  onChange={(v) => setSummaryBarangay(v || '')}
                  searchable
                  clearable
                  w={220}
                />
              )}

              {summaryFilterType === 'requestedBy' && (
                <Select
                  label="Requested by"
                  placeholder="Select requester"
                  data={summaryRequestedByOptions}
                  value={summaryRequestedBy}
                  onChange={(v) => setSummaryRequestedBy(v || '')}
                  searchable
                  clearable
                  w={220}
                />
              )}
            </Group>
          </Stack>

          <Stack gap={4}>
            <Text size="sm"><b>Total requests:</b> {filteredSummaryRows.length}</Text>
          </Stack>

          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>No.</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Time</Table.Th>
                <Table.Th>Requested by</Table.Th>
                <Table.Th>Barangay</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredSummaryRows.map((s, index) => {
                const date = dayjs(s.startDate || s.dateStr || s.date);
                const timeStr = s.startDate ? String(s.startDate).slice(11, 16) : String(s.start_time).slice(0, 5);
                return (
                  <Table.Tr key={`summary-${s.id}`}>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>{date.isValid() ? date.format('MMM D, YYYY') : '—'}</Table.Td>
                    <Table.Td>{timeStr}</Table.Td>
                    <Table.Td>{s.requesterName || '—'}</Table.Td>
                    <Table.Td>{s.location || '—'}</Table.Td>
                    <Table.Td>{s.status || '—'}</Table.Td>
                  </Table.Tr>
                );
              })}
              {filteredSummaryRows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed">No requests match the selected filters.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Stack>
      </Modal>

      <Modal
        opened={editOpen}
        onClose={() => { setEditOpen(false); setEditing(null); }}
        withCloseButton={false}
        centered
        size="xl"
      >
        <div className="row g-0 align-items-stretch">
          {/* Left: request summary */}
          <div
            className="col-md-5 d-none d-md-block bg-light"
            style={{ borderRight: '1px solid #e5e7eb' }}
          >
            <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center" align="left">
              <div className="mb-3 small text-muted">Request Preview</div>
              {editing && (
                <Stack gap="xs">
                  <Text fw={600}>{dayjs(form.date || editing.startDate || editing.date).format('MMMM D, YYYY')}</Text>
                  <Text size="sm" c="dimmed">
                    Time: {form.start_time || (editing.startDate ? String(editing.startDate).slice(11, 16) : String(editing.start_time).slice(0, 5))}
                  </Text>
                  <Text size="sm">
                    Barangay: {form.barangay || editing.location || '—'}
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
                <div className="text-uppercase small text-muted mb-1">Usapan-Series Request</div>
                <h2 className="h5 mb-0">Review Request</h2>
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
                <TextInput
                  label="Start time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.currentTarget.value }))}
                />
                <TextInput
                  label="Barangay"
                  value={form.barangay}
                  onChange={(e) => setForm((f) => ({ ...f, barangay: e.currentTarget.value }))}
                />
                <Select
                  label="Status"
                  data={USAPAN_STATUSES.map((s) => ({ value: s, label: s }))}
                  value={form.status || 'Pending'}
                  onChange={(v) => setForm((f) => ({ ...f, status: v || 'Pending' }))}
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

      <Modal
        opened={rejecting != null}
        onClose={() => { setRejecting(null); setRejectReason(''); }}
        withCloseButton={false}
        centered
        size="sm"
        radius="lg"
      >
        <Stack gap="md">
          <div className="d-flex flex-column align-items-center text-center">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center mb-3"
              style={{ width: 56, height: 56, backgroundColor: '#fff7ed', color: '#ea580c' }}
            >
              <span style={{ fontSize: 24 }}>!</span>
            </div>
            <Text fw={600} size="lg" mb={2}>
              Reject this Usapan request?
            </Text>
            <Text size="sm" c="dimmed">
              This action will mark the request as Rejected. Please provide a clear reason for the rejection.
            </Text>
          </div>

          <Textarea
            label="Reason for rejection"
            placeholder="Enter the reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.currentTarget.value)}
            minRows={3}
          />

          <div className="d-flex flex-column gap-2 mt-2">
            <Button
              color="orange"
              fullWidth
              loading={rowActionLoadingId === (rejecting?.id || null)}
              disabled={rowActionLoadingId === (rejecting?.id || null)}
              onClick={handleReject}
            >
              Confirm rejection
            </Button>
            <Button
              variant="default"
              fullWidth
              onClick={() => { setRejecting(null); setRejectReason(''); }}
            >
              Cancel
            </Button>
          </div>
        </Stack>
      </Modal>
    </Stack>
  );
}
