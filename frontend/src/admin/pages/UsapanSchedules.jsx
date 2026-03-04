import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Title, Text, Table, Loader, Center, Badge, Group, Button, Modal, TextInput, Select, Pagination, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';

import { getCalendarEvents, updateCalendarEvent, cancelCalendarEvent, archiveCalendarEvent, unarchiveCalendarEvent, getArchivedUsapanSchedules } from '../../api/calendar.js';
import { socket } from '../../socket.js';
import { showNotification } from '@mantine/notifications';
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal.jsx';

const USAPAN_STATUSES = ['Pending', 'Scheduled', 'Ongoing', 'Completed', 'Rejected', 'Cancelled'];

export function UsapanSchedules() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    date: '',
    start_time: '',
    end_time: '',
    barangay: '',
    status: '',
    details: ''
  });
  const [archivedRows, setArchivedRows] = useState([]);
  const [cancelId, setCancelId] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [showArchived, setShowArchived] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryFilterType, setSummaryFilterType] = useState(''); // date, barangay, requestedBy, status
  const [summaryDate, setSummaryDate] = useState(null);
  const [summaryBarangay, setSummaryBarangay] = useState('');
  const [summaryRequestedBy, setSummaryRequestedBy] = useState('');
  const [summaryStatus, setSummaryStatus] = useState('');

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
      const onlyUsapanNonPending = all.filter((e) => {
        if (!e || e.type !== 'Usapan-Series') return false;
        const status = String(e.status || '').toUpperCase();
        return status !== 'PENDING';
      });

      const today = dayjs().startOf('day');

      const statusRank = (statusRaw) => {
        const s = String(statusRaw || '').toUpperCase();
        if (s === 'SCHEDULED' || s === 'ONGOING') return 0; // top
        if (s === 'CANCELLED') return 1;
        if (s === 'REJECTED') return 2;
        if (s === 'COMPLETED') return 3; // bottom group among known statuses
        return 4;
      };
      const sorted = [...onlyUsapanNonPending].sort((a, b) => {
        const rankA = statusRank(a.status);
        const rankB = statusRank(b.status);
        if (rankA !== rankB) return rankA - rankB;

        const dateA = dayjs(a.startDate || a.dateStr || a.date);
        const dateB = dayjs(b.startDate || b.dateStr || b.date);

        // Within the same status group, sort by closeness to today (earlier dates first).
        if (dateA.isValid() && dateB.isValid()) {
          const diffA = Math.abs(dateA.startOf('day').diff(today, 'day'));
          const diffB = Math.abs(dateB.startOf('day').diff(today, 'day'));
          if (diffA !== diffB) return diffA - diffB;
          return dateA.valueOf() - dateB.valueOf();
        }

        if (dateA.isValid() && !dateB.isValid()) return -1;
        if (!dateA.isValid() && dateB.isValid()) return 1;
        return 0;
      });

      setRows(sorted);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadArchived = async () => {
    try {
      const res = await getArchivedUsapanSchedules();
      const data = res.data.data || [];
      const today = dayjs().startOf('day');

      const statusRank = (statusRaw) => {
        const s = String(statusRaw || '').toUpperCase();
        if (s === 'ARCHIVED') return 0;
        return 1;
      };

      const sorted = [...data].sort((a, b) => {
        const rankA = statusRank(a.status);
        const rankB = statusRank(b.status);
        if (rankA !== rankB) return rankA - rankB;

        const dateA = dayjs(a.startDate || a.dateStr || a.date);
        const dateB = dayjs(b.startDate || b.dateStr || b.date);

        if (dateA.isValid() && dateB.isValid()) {
          const diffA = Math.abs(dateA.startOf('day').diff(today, 'day'));
          const diffB = Math.abs(dateB.startOf('day').diff(today, 'day'));
          if (diffA !== diffB) return diffA - diffB;
          return dateA.valueOf() - dateB.valueOf();
        }

        if (dateA.isValid() && !dateB.isValid()) return -1;
        if (!dateA.isValid() && dateB.isValid()) return 1;
        return 0;
      });

      setArchivedRows(sorted);
    } catch (e) {
      setArchivedRows([]);
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
      end_time: row.endDate ? String(row.endDate).slice(11, 16) : (row.end_time ? String(row.end_time).slice(0, 5) : ''),
      barangay: row.location || '',
      status: row.status || 'Pending',
      details: row.details || ''
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
      await updateCalendarEvent(editing.id, {
        type: 'Usapan-Series',
        date: form.date || null,
        title: null,
        counselorID: null,
        lead: null,
        location: null,
        barangay: form.barangay || null,
        userID: editing.userID || null,
        startTime: form.start_time || null,
        endTime: form.end_time || null,
        status: form.status || 'Pending',
        details: form.details || null
      });
      showNotification({ title: 'Saved', message: 'Usapan schedule updated.', color: 'green' });
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to update schedule';
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
      if (s === 'ARCHIVED') return 'gray';
      return 'gray';
    };
  }, []);

  const getEffectiveStatus = (row) => {
    const raw = String(row?.status || '').trim();
    const upper = raw.toUpperCase();

    if (upper === 'ARCHIVED') return 'Archived';

    const date = dayjs(row.startDate || row.dateStr || row.date);
    const isPast = date.isValid() && date.isBefore(dayjs().startOf('day'));

    if (isPast && upper !== 'COMPLETED' && upper !== 'CANCELLED' && upper !== 'REJECTED') {
      return 'Completed';
    }

    return raw || 'Scheduled';
  };

  // Options for summary filters
  const barangayOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      if (r.location) set.add(String(r.location));
    });
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const requestedByOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      if (r.requesterName) set.add(String(r.requesterName));
    });
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      const eff = getEffectiveStatus(r);
      if (eff) set.add(String(eff));
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

    if (summaryFilterType === 'status' && summaryStatus) {
      list = list.filter((s) => getEffectiveStatus(s) === summaryStatus);
    }

    return list;
  }, [rows, summaryFilterType, summaryDate, summaryBarangay, summaryRequestedBy, summaryStatus, getEffectiveStatus]);

  const currentList = showArchived ? archivedRows : rows;
  const totalPages = Math.max(1, Math.ceil(currentList.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = currentList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Stack>
      <Group justify="space-between" align="center" mb="xs">
        <div>
          <Title order={2}>Usapan-Series - Schedules</Title>
          <Text c="dimmed">Manage Usapan-Series schedules per barangay.</Text>
        </div>
        <Group gap="xs">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setSummaryOpen(true)}
            disabled={rows.length === 0}
          >
            Summary
          </Button>
          <Button
            size="xs"
            variant={showArchived ? 'filled' : 'outline'}
            color={showArchived ? 'gray' : 'dark'}
            onClick={async () => {
              const next = !showArchived;
              setShowArchived(next);
              setPage(1);
              if (next) {
                await loadArchived();
              } else {
                await load();
              }
            }}
            disabled={rows.length === 0 && archivedRows.length === 0}
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

              const startStr = (() => {
                if (s.startDate) {
                  const d = dayjs(s.startDate);
                  return d.isValid() ? d.format('hh:mm A') : '';
                }
                if (s.start_time) {
                  const d = dayjs(`1970-01-01T${String(s.start_time).slice(0, 5)}`);
                  return d.isValid() ? d.format('hh:mm A') : '';
                }
                return '';
              })();

              const endStr = (() => {
                if (s.endDate) {
                  const d = dayjs(s.endDate);
                  return d.isValid() ? d.format('hh:mm A') : '';
                }
                if (s.end_time) {
                  const d = dayjs(`1970-01-01T${String(s.end_time).slice(0, 5)}`);
                  return d.isValid() ? d.format('hh:mm A') : '';
                }
                return '';
              })();

              const timeStr = endStr ? `${startStr}–${endStr}` : startStr;
              const effectiveStatus = getEffectiveStatus(s);
              const statusUpper = String(s.status || '').toUpperCase();
              const isArchived = statusUpper === 'ARCHIVED';

              return (
                <Table.Tr key={s.id}>
                  <Table.Td>{rowNumber}</Table.Td>
                  <Table.Td>{date.isValid() ? date.format('MMM D, YYYY') : '—'}</Table.Td>
                  <Table.Td>{timeStr || '—'}</Table.Td>
                  <Table.Td>{s.requesterName || '—'}</Table.Td>
                  <Table.Td>{s.location || '—'}</Table.Td>
                  <Table.Td>
                    <Badge variant="filled" color={statusBadgeColor(effectiveStatus)}>
                      {effectiveStatus}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-start">
                      {!isArchived && (
                        <>
                          <Button size="xs" variant="light" onClick={() => openEdit(s)}>
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="yellow"
                            disabled={String(s.status).toUpperCase() === 'CANCELLED' || String(s.status).toUpperCase() === 'COMPLETED'}
                            onClick={() => setCancelId(s.id)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={async () => {
                              try {
                                await archiveCalendarEvent(s.id);
                                await load();
                                showNotification({ title: 'Archived', message: 'Schedule archived.', color: 'green' });
                              } catch (err) {
                                const msg = err?.response?.data?.error?.message || 'Failed to archive schedule';
                                showNotification({ title: 'Error', message: msg, color: 'red' });
                              }
                            }}
                          >
                            Archive
                          </Button>
                        </>
                      )}
                      {isArchived && (
                        <Button
                          size="xs"
                          color="green"
                          variant="light"
                          onClick={async () => {
                            try {
                              await unarchiveCalendarEvent(s.id);
                              await loadArchived();
                              showNotification({ title: 'Restored', message: 'Schedule restored.', color: 'green' });
                            } catch (err) {
                              const msg = err?.response?.data?.error?.message || 'Failed to unarchive schedule';
                              showNotification({ title: 'Error', message: msg, color: 'red' });
                            }
                          }}
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
      )}

      {!loading && rows.length > pageSize && (
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
                  <Text fw={600}>{dayjs(form.date || editing.startDate || editing.date).format('MMMM D, YYYY')}</Text>
                  <Text size="sm" c="dimmed">
                    {(() => {
                      const startRaw = form.start_time || (editing.startDate ? String(editing.startDate).slice(11, 16) : (editing.start_time ? String(editing.start_time).slice(0, 5) : ''));
                      const endRaw = form.end_time || (editing.endDate ? String(editing.endDate).slice(11, 16) : (editing.end_time ? String(editing.end_time).slice(0, 5) : ''));
                      const formatTime = (t) => {
                        if (!t) return '';
                        const d = dayjs(`1970-01-01T${String(t).slice(0, 5)}`);
                        return d.isValid() ? d.format('hh:mm A') : String(t).slice(0, 5);
                      };
                      const startStr = formatTime(startRaw);
                      const endStr = formatTime(endRaw);
                      return `Time: ${startStr}${endStr ? ` – ${endStr}` : ''}`;
                    })()}
                  </Text>
                  <Text size="sm">
                    Barangay: {form.barangay || editing.location || '—'}
                  </Text>
                  <Text size="sm">
                    Details: {form.details || editing.details || '—'}
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
                <div className="text-uppercase small text-muted mb-1">Usapan-Series Schedule</div>
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
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  />
                </Group>

                <TextInput
                  label="Barangay"
                  value={form.barangay}
                  onChange={(e) => setForm((f) => ({ ...f, barangay: e.currentTarget.value }))}
                />
                <Select
                  label="Status"
                  data={USAPAN_STATUSES.map((s) => ({ value: s, label: s }))}
                  value={form.status}
                  onChange={() => {}}
                  disabled
                />
                <Textarea
                  label="Details / notes"
                  minRows={3}
                  autosize
                  value={form.details}
                  onChange={(e) => setForm((f) => ({ ...f, details: e.currentTarget.value }))}
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

      <DeleteConfirmModal
        opened={cancelId != null}
        onCancel={() => { if (!cancelLoading) setCancelId(null); }}
        onConfirm={async () => {
          if (!cancelId) return;
          setCancelLoading(true);
          try {
            await cancelCalendarEvent(cancelId);
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
        message="Are you sure you want to cancel this Usapan schedule? Existing arrangements may be affected."
        loading={cancelLoading}
      />

      {/* Summary modal */}
      <Modal
        opened={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        centered
        size="xl"
        title={
          <Stack gap={4}>
            <Text fw={700}>Usapan-Series Schedules Summary</Text>
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
                  { value: 'status', label: 'Status' },
                ]}
                value={summaryFilterType}
                onChange={(v) => {
                  setSummaryFilterType(v || '');
                  setSummaryDate(null);
                  setSummaryBarangay('');
                  setSummaryRequestedBy('');
                  setSummaryStatus('');
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
                  data={barangayOptions}
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
                  data={requestedByOptions}
                  value={summaryRequestedBy}
                  onChange={(v) => setSummaryRequestedBy(v || '')}
                  searchable
                  clearable
                  w={220}
                />
              )}

              {summaryFilterType === 'status' && (
                <Select
                  label="Status"
                  placeholder="Select status"
                  data={statusOptions}
                  value={summaryStatus}
                  onChange={(v) => setSummaryStatus(v || '')}
                  w={180}
                />
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
                <Table.Th>Requested by</Table.Th>
                <Table.Th>Barangay</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredSummaryRows.map((s, index) => {
                const date = dayjs(s.startDate || s.dateStr || s.date);

                const startStr = (() => {
                  if (s.startDate) {
                    const d = dayjs(s.startDate);
                    return d.isValid() ? d.format('hh:mm A') : '';
                  }
                  if (s.start_time) {
                    const d = dayjs(`1970-01-01T${String(s.start_time).slice(0, 5)}`);
                    return d.isValid() ? d.format('hh:mm A') : '';
                  }
                  return '';
                })();

                const endStr = (() => {
                  if (s.endDate) {
                    const d = dayjs(s.endDate);
                    return d.isValid() ? d.format('hh:mm A') : '';
                  }
                  if (s.end_time) {
                    const d = dayjs(`1970-01-01T${String(s.end_time).slice(0, 5)}`);
                    return d.isValid() ? d.format('hh:mm A') : '';
                  }
                  return '';
                })();

                const timeStr = endStr ? `${startStr}–${endStr}` : startStr;
                const effectiveStatus = getEffectiveStatus(s);
                return (
                  <Table.Tr key={`summary-${s.id}`}>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>{date.isValid() ? date.format('MMM D, YYYY') : '—'}</Table.Td>
                    <Table.Td>{timeStr}</Table.Td>
                    <Table.Td>{s.requesterName || '—'}</Table.Td>
                    <Table.Td>{s.location || '—'}</Table.Td>
                    <Table.Td>
                      <Badge variant="filled" color={statusBadgeColor(effectiveStatus)}>
                        {effectiveStatus}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {filteredSummaryRows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text size="sm" c="dimmed">No schedules match the selected filters.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Stack>
      </Modal>
    </Stack>
  );
}
