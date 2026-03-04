import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Stack, Title, Text, Table, Loader, Center, Badge, Button, Group, Modal, Textarea, Image, Select, Divider, Pagination } from '@mantine/core';
import { DatePickerInput, MonthPickerInput, YearPickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { showNotification } from '@mantine/notifications';

import { acceptPmoAppointment, cancelPmoAppointment, getPmoAdminAppointments, rejectPmoAppointment, archivePmoAppointment, unarchivePmoAppointment } from '../../api/pmoAdmin.js';
import { socket } from '../../socket.js';

export function PmoAppointments() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const [rejectOpened, setRejectOpened] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [activeRow, setActiveRow] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [zoomImageSrc, setZoomImageSrc] = useState(null);
  const [zoomImageLabel, setZoomImageLabel] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryFilterType, setSummaryFilterType] = useState(''); // '', 'counselor', 'schedule', 'status'
  const [summaryCounselor, setSummaryCounselor] = useState('');
  const [summaryStatus, setSummaryStatus] = useState('');
  const [summaryScheduleMode, setSummaryScheduleMode] = useState(''); // 'day','month','year'
  const [summaryScheduleDay, setSummaryScheduleDay] = useState(null);
  const [summaryScheduleMonth, setSummaryScheduleMonth] = useState(null);
  const [summaryScheduleYear, setSummaryScheduleYear] = useState(null); // Date for YearPickerInput
  const outletCtx = useOutletContext?.() || {};
  const setApptPending = outletCtx.setApptPending;
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [summaryPage, setSummaryPage] = useState(1);
  const summaryPageSize = 10;
  const [showArchived, setShowArchived] = useState(false);

  const scheduleLabel = useMemo(() => {
    if (!activeRow) return '';
    const date = activeRow.scheduleDate ? dayjs(activeRow.scheduleDate).format('MMM D, YYYY') : '—';
    const start = activeRow.scheduleStartTime ? String(activeRow.scheduleStartTime).slice(0, 5) : null;
    const end = activeRow.scheduleEndTime ? String(activeRow.scheduleEndTime).slice(0, 5) : null;
    const time = start && end ? `${start} - ${end}` : null;
    return [date, time].filter(Boolean).join(' • ');
  }, [activeRow]);

  useEffect(() => {
    const handler = () => fetchRows();
    socket.on('pmo:updated', handler);
    return () => socket.off('pmo:updated', handler);
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await getPmoAdminAppointments();
      const data = res.data.data || [];
      setRows(data);
      const pendingCount = data.filter((r) => String(r.status || '').toUpperCase() === 'PENDING').length;
      if (typeof setApptPending === 'function') setApptPending(pendingCount);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset to first page whenever the total rows change
  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  // Reset summary pagination when filters or modal open state change
  useEffect(() => {
    if (summaryOpen) {
      setSummaryPage(1);
    }
  }, [summaryOpen, summaryFilterType, summaryCounselor, summaryStatus, summaryScheduleMode, summaryScheduleDay, summaryScheduleMonth, summaryScheduleYear]);

  const sortedRows = useMemo(() => {
    const list = Array.isArray(rows) ? [...rows] : [];

    const getStatusRank = (statusRaw) => {
      const s = String(statusRaw || '').toUpperCase();
      if (s === 'PENDING') return 0;
      if (s === 'APPROVED' || s === 'COMPLETED' || s === 'SCHEDULED') return 1;
      if (s === 'REJECTED') return 2;
      if (s === 'CANCELLED') return 3;
      if (s === 'ARCHIVED') return 4;
      return 5;
    };

    const today = dayjs().startOf('day');

    list.sort((a, b) => {
      const da = a.scheduleDate ? dayjs(a.scheduleDate).startOf('day') : null;
      const db = b.scheduleDate ? dayjs(b.scheduleDate).startOf('day') : null;

      const hasDa = da && da.isValid();
      const hasDb = db && db.isValid();

      if (hasDa && hasDb) {
        const diffA = Math.abs(da.diff(today, 'day'));
        const diffB = Math.abs(db.diff(today, 'day'));
        if (diffA !== diffB) return diffA - diffB; // closer schedule first
      } else if (hasDa || hasDb) {
        // Appointments with a valid schedule date first
        return hasDa ? -1 : 1;
      }

      const ra = getStatusRank(a.status);
      const rb = getStatusRank(b.status);
      if (ra !== rb) return ra - rb;

      // Fallback: most recently created first
      const ca = a.created_at ? dayjs(a.created_at) : null;
      const cb = b.created_at ? dayjs(b.created_at) : null;
      if (!ca && !cb) return 0;
      if (!ca) return 1;
      if (!cb) return -1;
      return cb.valueOf() - ca.valueOf();
    });

    return list;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const list = Array.isArray(sortedRows) ? sortedRows : [];
    return list.filter((r) => {
      const s = String(r.status || '').toUpperCase();
      if (showArchived) return s === 'ARCHIVED';
      return s !== 'ARCHIVED';
    });
  }, [sortedRows, showArchived]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Distinct filter options derived from appointments
  const counselorOptions = useMemo(() => {
    const set = new Set();
    sortedRows.forEach((r) => {
      const label = r.counselorName || r.counselorId;
      if (label) set.add(String(label));
    });
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [sortedRows]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    sortedRows.forEach((r) => {
      const s = String(r.status || 'PENDING').toUpperCase();
      set.add(s);
    });
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [sortedRows]);

  const filteredSummaryRows = useMemo(() => {
    let list = sortedRows;

    if (summaryFilterType === 'counselor' && summaryCounselor) {
      list = list.filter((r) => {
        const label = r.counselorName || r.counselorId;
        return String(label || '') === summaryCounselor;
      });
    }

    if (summaryFilterType === 'status' && summaryStatus) {
      list = list.filter((r) => String(r.status || 'PENDING').toUpperCase() === summaryStatus);
    }

    if (summaryFilterType === 'schedule' && summaryScheduleMode) {
      list = list.filter((r) => {
        if (!r.scheduleDate) return false;
        const d = dayjs(r.scheduleDate);
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
  }, [sortedRows, summaryFilterType, summaryCounselor, summaryStatus, summaryScheduleMode, summaryScheduleDay, summaryScheduleMonth, summaryScheduleYear]);

  const paginatedSummaryRows = useMemo(() => {
    const start = (summaryPage - 1) * summaryPageSize;
    return filteredSummaryRows.slice(start, start + summaryPageSize);
  }, [filteredSummaryRows, summaryPage, summaryPageSize]);

  const handleArchive = async (row) => {
    const id = row?.appointmentID;
    if (!id) return;
    setActionLoadingId(id);
    try {
      await archivePmoAppointment(id);
      showNotification({ title: 'Archived', message: 'Appointment archived successfully.', color: 'green' });
      await fetchRows();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to archive appointment.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnarchive = async (row) => {
    const id = row?.appointmentID;
    if (!id) return;
    setActionLoadingId(id);
    try {
      await unarchivePmoAppointment(id);
      showNotification({ title: 'Restored', message: 'Appointment restored successfully.', color: 'green' });
      await fetchRows();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to unarchive appointment.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = (row) => {
    const id = row?.appointmentID;
    if (!id) return;
    setCancelId(id);
    setCancelReason('');
  };

  const handleConfirmCancel = async () => {
    if (!cancelId) return;
    if (!cancelReason || !String(cancelReason).trim()) {
      showNotification({ title: 'Missing reason', message: 'Please provide a reason for cancellation.', color: 'yellow' });
      return;
    }
    setCancelLoading(true);
    setActionLoadingId(cancelId);
    try {
      await cancelPmoAppointment(cancelId, cancelReason);
      showNotification({ title: 'Cancelled', message: 'Appointment cancelled successfully.', color: 'green' });
      await fetchRows();
      setCancelId(null);
      setCancelReason('');
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to cancel appointment.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setActionLoadingId(null);
      setCancelLoading(false);
    }
  };

  useEffect(() => {
    fetchRows().catch(() => {});
  }, []);

  const handleAccept = async (row) => {
    const id = row?.appointmentID;
    if (!id) return;
    setActionLoadingId(id);
    try {
      await acceptPmoAppointment(id);
      showNotification({ title: 'Approved', message: 'Appointment approved successfully.', color: 'green' });
      await fetchRows();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to approve appointment.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openReject = (row) => {
    setActiveRow(row);
    setRejectReason('');
    setRejectOpened(true);
  };

  const openView = (row) => {
    setViewRow(row);
    setViewOpen(true);
  };

  const handleReject = async () => {
    const id = activeRow?.appointmentID;
    if (!id) return;
    if (!rejectReason || String(rejectReason).trim().length === 0) {
      showNotification({ title: 'Missing reason', message: 'Reject reason is required.', color: 'red' });
      return;
    }
    setActionLoadingId(id);
    try {
      await rejectPmoAppointment(id, rejectReason);
      showNotification({ title: 'Rejected', message: 'Appointment rejected successfully.', color: 'green' });
      setRejectOpened(false);
      setActiveRow(null);
      await fetchRows();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to reject appointment.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Stack>
      <style>{`
        /* Hide scrollbar but keep scroll for the PMO appointment modal */
        .mantine-Modal-body {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none;    /* Firefox */
        }
        .mantine-Modal-body::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>
      <Group justify="space-between" align="center" mb="xs">
        <div>
          <Title order={2}>PMO - Appointments</Title>
          <Text c="dimmed">Manage PMO appointments linked to schedules and couples.</Text>
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
        <Text size="sm" c="dimmed">No bookings found.</Text>
      ) : (
        <>
          <Table striped withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>No.</Table.Th>
                <Table.Th>Ref #</Table.Th>
                <Table.Th>Couple</Table.Th>
                <Table.Th>Schedule</Table.Th>
                <Table.Th>Counselor</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Notified</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedRows.map((row, index) => {
                const rowNumber = (page - 1) * pageSize + index + 1;
                const status = String(row.status || '').toUpperCase();
                const isApproved = status === 'APPROVED';
                const isRejected = status === 'REJECTED';
                const isCancelled = status === 'CANCELLED';
                const isArchived = status === 'ARCHIVED';
                const isRowBusy = actionLoadingId === row.appointmentID;
                return (
                  <Table.Tr key={row.appointmentID || `${row.coupleID}-${row.scheduleId}`}>
                    <Table.Td>{rowNumber}</Table.Td>
                    <Table.Td>{row.referenceNumber || '—'}</Table.Td>
                  <Table.Td>
                    {row.husband_name || row.husbandName || '—'} / {row.wife_name || row.wifeName || '—'}
                  </Table.Td>
                  <Table.Td>
                    {row.scheduleDate
                      ? dayjs(row.scheduleDate).format('MMM D, YYYY')
                      : row.scheduleId || '—'}
                  </Table.Td>
                  <Table.Td>{row.counselorName || row.counselorId || '—'}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        status === 'APPROVED' ? 'green'
                        : status === 'PENDING' ? 'yellow'
                        : status === 'CANCELLED' ? 'red'
                        : status === 'ARCHIVED' ? 'gray'
                        : 'gray'
                      }
                    >
                      {status || 'PENDING'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{row.notificationSent ? 'Yes' : 'No'}</Table.Td>
                  <Table.Td>
                    <div
                      className="d-flex flex-column gap-1"
                      style={{ minWidth: 260, maxWidth: 260 }}
                    >
                      {/* First row: always show View + Print MEIF, then Accept/Unarchive as the third button */}
                      <Group gap="xs" wrap="nowrap">
                        <Button
                          size="xs"
                          variant="light"
                          style={{ minWidth: 80 }}
                          onClick={() => openView(row)}
                          disabled={isRowBusy}
                        >
                          View
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          style={{ minWidth: 80 }}
                          onClick={() => navigate(`/admin/pmo/appointments/${row.appointmentID}/meif`)}
                          disabled={isRowBusy}
                        >
                          Print MEIF
                        </Button>
                        {!isArchived && (
                          <Button
                            size="xs"
                            style={{ minWidth: 80 }}
                            onClick={() => handleAccept(row)}
                            loading={isRowBusy}
                            disabled={isRowBusy || isApproved || isRejected || isCancelled}
                          >
                            Accept
                          </Button>
                        )}
                        {isArchived && (
                          <Button
                            size="xs"
                            color="green"
                            variant="light"
                            style={{ minWidth: 80 }}
                            onClick={() => { if (!isRowBusy) handleUnarchive(row); }}
                            disabled={isRowBusy}
                          >
                            Unarchive
                          </Button>
                        )}
                      </Group>

                      {/* Second row: only for non-archived appointments (Reject, Cancel, Archive) */}
                      {!isArchived && (
                        <Group gap="xs" wrap="nowrap">
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            style={{ minWidth: 80 }}
                            onClick={() => { if (!isRowBusy) openReject(row); }}
                            disabled={isRowBusy || isRejected || isCancelled}
                          >
                            Reject
                          </Button>
                          <Button
                            size="xs"
                            color="gray"
                            variant="light"
                            style={{ minWidth: 80 }}
                            onClick={() => { if (!isRowBusy) handleCancel(row); }}
                            disabled={isRowBusy || isCancelled}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            style={{ minWidth: 80 }}
                            onClick={() => { if (!isRowBusy) handleArchive(row); }}
                            disabled={isRowBusy}
                          >
                            Archive
                          </Button>
                        </Group>
                      )}
                    </div>
                  </Table.Td>
                </Table.Tr>
              );
              })}
            </Table.Tbody>
          </Table>
          {rows.length > pageSize && (
            <Group justify="flex-end" mt="sm">
              <Pagination
                total={Math.ceil(rows.length / pageSize)}
                value={page}
                onChange={setPage}
                size="sm"
              />
            </Group>
          )}
        </>
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
              Are you sure you want to cancel this appointment? A cancellation SMS may be sent to the client.
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
              Cancel appointment
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

      <Modal
        opened={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setViewRow(null);
        }}
        centered
        size="xxl"
        radius="lg"
        padding="lg"
        withCloseButton
      >
        {viewRow && (
          <div className="row g-0">
            <div className="col-12">
              <div className="h-100 p-4">
                <div className="mb-3">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                    Appointments / PMO
                  </Text>
                  <Text fw={700} size="lg">Appointment Details</Text>
                </div>

                <Stack gap="md">
                  {/* Schedule & status + images in three columns */}
                  <div
                    style={{
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      padding: 12,
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    <div className="row g-3 align-items-center">
                      <div className="col-12 col-md-4">
                        <Stack gap={4}>
                          <Text fw={600} size="sm">Schedule &amp; status</Text>
                          <Text size="sm"><b>Schedule:</b> {viewRow ? (
                            [
                              viewRow.scheduleDate ? dayjs(viewRow.scheduleDate).format('MMM D, YYYY') : null,
                              viewRow.scheduleStartTime && viewRow.scheduleEndTime
                                ? `${String(viewRow.scheduleStartTime).slice(0, 5)} - ${String(viewRow.scheduleEndTime).slice(0, 5)}`
                                : null
                            ].filter(Boolean).join(' • ')
                          ) : '—'}</Text>
                          <Text size="sm"><b>Counselor:</b> {viewRow.counselorName || viewRow.counselorId || '—'}</Text>
                          <Text size="sm"><b>Status:</b> {String(viewRow.status || 'PENDING').toUpperCase()}</Text>
                          <Text size="sm"><b>Notified:</b> {viewRow.notificationSent ? 'Yes' : 'No'}</Text>
                        </Stack>
                      </div>

                      <div className="col-6 col-md-4">
                        <Text size="xs" c="dimmed">Husband ID image</Text>
                        {viewRow.husband_id_photo || viewRow.husbandIdPhoto ? (
                          <Image
                            src={viewRow.husband_id_photo || viewRow.husbandIdPhoto}
                            alt="Husband valid ID"
                            radius={6}
                            style={{ width: '100%', maxHeight: 180, objectFit: 'contain', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                            onClick={() => {
                              setZoomImageSrc(viewRow.husband_id_photo || viewRow.husbandIdPhoto);
                              setZoomImageLabel('Husband ID');
                            }}
                          />
                        ) : (
                          <Text size="sm">—</Text>
                        )}
                      </div>

                      <div className="col-6 col-md-4">
                        <Text size="xs" c="dimmed">Wife ID image</Text>
                        {viewRow.wife_id_photo || viewRow.wifeIdPhoto ? (
                          <Image
                            src={viewRow.wife_id_photo || viewRow.wifeIdPhoto}
                            alt="Wife valid ID"
                            radius={6}
                            style={{ width: '100%', maxHeight: 180, objectFit: 'contain', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                            onClick={() => {
                              setZoomImageSrc(viewRow.wife_id_photo || viewRow.wifeIdPhoto);
                              setZoomImageLabel('Wife ID');
                            }}
                          />
                        ) : (
                          <Text size="sm">—</Text>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Husband and wife information side by side */}
                  <div className="row g-3 justify-content-between">
                    <div className="col-12 col-md-6 order-1 order-md-1">
                      <div
                        style={{
                          borderRadius: 12,
                          border: '1px solid #e5e7eb',
                          padding: 12,
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <Stack gap={4}>
                          <Text fw={600} size="sm">Husband information</Text>
                          <Text size="sm"><b>Name:</b> {viewRow.husband_name || viewRow.husbandName || '—'}</Text>
                          <Text size="sm"><b>Birthday:</b> {(viewRow.husband_birthday || viewRow.husbandBirthday) ? dayjs(viewRow.husband_birthday || viewRow.husbandBirthday).format('MMM D, YYYY') : '—'}</Text>
                          <Text size="sm"><b>Age:</b> {viewRow.husband_age || viewRow.husbandAge || '—'}</Text>
                          <Text size="sm"><b>Address:</b> {viewRow.husband_address || viewRow.husbandAddress || '—'}</Text>
                          <Text size="sm"><b>Occupation:</b> {viewRow.husband_occupation || viewRow.husbandOccupation || '—'}</Text>
                          <Text size="sm"><b>Religion:</b> {viewRow.husband_religion || viewRow.husbandReligion || '—'}</Text>
                          <Text size="sm"><b>Educational attainment:</b> {viewRow.husband_educational_attainment || viewRow.husbandEducationalAttainment || '—'}</Text>
                          <Text size="sm"><b>Citizenship:</b> {viewRow.husband_citizenship || viewRow.husbandCitizenship || '—'}</Text>
                          <Text size="sm"><b>ID type:</b> {viewRow.husband_id_type || viewRow.husbandIdType || '—'}</Text>
                          <Text size="sm"><b>ID number:</b> {viewRow.husband_id_number || viewRow.husbandIdNumber || '—'}</Text>
                        </Stack>
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <div
                        style={{
                          borderRadius: 12,
                          border: '1px solid #e5e7eb',
                          padding: 12,
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <Stack gap={4}>
                          <Text fw={600} size="sm">Wife information</Text>
                          <Text size="sm"><b>Name:</b> {viewRow.wife_name || viewRow.wifeName || '—'}</Text>
                          <Text size="sm"><b>Birthday:</b> {(viewRow.wife_birthday || viewRow.wifeBirthday) ? dayjs(viewRow.wife_birthday || viewRow.wifeBirthday).format('MMM D, YYYY') : '—'}</Text>
                          <Text size="sm"><b>Age:</b> {viewRow.wife_age || viewRow.wifeAge || '—'}</Text>
                          <Text size="sm"><b>Address:</b> {viewRow.wife_address || viewRow.wifeAddress || '—'}</Text>
                          <Text size="sm"><b>Occupation:</b> {viewRow.wife_occupation || viewRow.wifeOccupation || '—'}</Text>
                          <Text size="sm"><b>Religion:</b> {viewRow.wife_religion || viewRow.wifeReligion || '—'}</Text>
                          <Text size="sm"><b>Educational attainment:</b> {viewRow.wife_educational_attainment || viewRow.wifeEducationalAttainment || '—'}</Text>
                          <Text size="sm"><b>Citizenship:</b> {viewRow.wife_citizenship || viewRow.wifeCitizenship || '—'}</Text>
                          <Text size="sm"><b>ID type:</b> {viewRow.wife_id_type || viewRow.wifeIdType || '—'}</Text>
                          <Text size="sm"><b>ID number:</b> {viewRow.wife_id_number || viewRow.wifeIdNumber || '—'}</Text>
                        </Stack>
                      </div>
                    </div>
                  </div>

                  {/* Marriage & contact details */}
                  <div
                    style={{
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      padding: 12,
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <Stack gap={4}>
                      <Text fw={600} size="sm">Marriage &amp; contact details</Text>
                      <Text size="sm">
                        <b>Marriage date:</b>{' '}
                        {(viewRow.marriage_date || viewRow.marriageDate)
                          ? dayjs(viewRow.marriage_date || viewRow.marriageDate).format('MMM D, YYYY')
                          : '—'}
                      </Text>
                      <Text size="sm">
                        <b>Solemnizing officer:</b>{' '}
                        {viewRow.solemnizing_officer || viewRow.solemnizingOfficer || '—'}
                      </Text>
                      <Text size="sm">
                        <b>Main contact number:</b>{' '}
                        {viewRow.main_contact || viewRow.mainContact || '—'}
                      </Text>
                      <Text size="sm">
                        <b>Emergency contact:</b>{' '}
                        {viewRow.backup_contact || viewRow.backupContact || '—'}
                      </Text>
                      <Text size="sm">
                        <b>Email:</b>{' '}
                        {viewRow.email || '—'}
                      </Text>
                    </Stack>
                  </div>
                </Stack>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Summary modal */}
      <Modal
          opened={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          centered
          size="xl"
          title={
            <Stack gap={4}>
              <Text fw={700}>Appointments Summary</Text>
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
                ]}
                value={summaryFilterType}
                onChange={(v) => {
                  setSummaryFilterType(v || '');
                  setSummaryCounselor('');
                  setSummaryStatus('');
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
                  data={counselorOptions}
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
                  data={statusOptions}
                  value={summaryStatus}
                  onChange={(v) => setSummaryStatus(v || '')}
                  w={180}
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
                      setSummaryScheduleYear('');
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
                      firstDayOfWeek={0}
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
            <Text size="sm"><b>Total appointments:</b> {filteredSummaryRows.length}</Text>
          </Stack>

          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>No.</Table.Th>
                <Table.Th>Ref #</Table.Th>
                <Table.Th>Couple</Table.Th>
                <Table.Th>Schedule</Table.Th>
                <Table.Th>Counselor</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedSummaryRows.map((row, index) => {
                const rowNumber = (summaryPage - 1) * summaryPageSize + index + 1;
                return (
                  <Table.Tr key={`summary-${row.appointmentID || `${row.coupleID}-${row.scheduleId}`}`}>
                    <Table.Td>{rowNumber}</Table.Td>
                    <Table.Td>{row.referenceNumber || '—'}</Table.Td>
                  <Table.Td>
                    {row.husband_name || row.husbandName || '—'} / {row.wife_name || row.wifeName || '—'}
                  </Table.Td>
                  <Table.Td>
                    {row.scheduleDate
                      ? dayjs(row.scheduleDate).format('MMM D, YYYY')
                      : row.scheduleId || '—'}
                  </Table.Td>
                  <Table.Td>{row.counselorName || row.counselorId || '—'}</Table.Td>
                  <Table.Td>{String(row.status || 'PENDING').toUpperCase()}</Table.Td>
                </Table.Tr>
              );
              })}
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

      {/* Image zoom modal for ID photos */}
      <Modal
        opened={!!zoomImageSrc}
        onClose={() => {
          setZoomImageSrc(null);
          setZoomImageLabel('');
        }}
        centered
        size="lg"
        title={zoomImageLabel || undefined}
        withCloseButton
      >
        {zoomImageSrc && (
          <Image
            src={zoomImageSrc}
            alt="Zoomed ID image"
            radius={8}
            style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', border: '1px solid #e5e7eb' }}
          />
        )}
      </Modal>

      <Modal
        opened={rejectOpened}
        onClose={() => {
          setRejectOpened(false);
          setActiveRow(null);
        }}
        withCloseButton={false}
        centered
        size="sm"
        radius="lg"
      >
        <Stack gap="md">
          <div className="d-flex flex-column align-items-center text-center">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center mb-3"
              style={{ width: 56, height: 56, backgroundColor: '#fff1f2', color: '#dc2626' }}
            >
              <span style={{ fontSize: 24 }}>!</span>
            </div>
            <Text fw={600} size="lg" mb={2}>
              Reject this appointment?
            </Text>
            <Text size="sm" c="dimmed">
              A rejection SMS will be sent to the client. Please provide a clear reason for the rejection.
            </Text>
          </div>

          <Stack gap={4}>
            <Text size="sm"><b>Couple:</b> {(activeRow?.husband_name || activeRow?.husbandName || '—')} / {(activeRow?.wife_name || activeRow?.wifeName || '—')}</Text>
            <Text size="sm"><b>Schedule:</b> {scheduleLabel || '—'}</Text>
          </Stack>

          <Textarea
            label="Reason for rejection"
            placeholder="Enter the reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.currentTarget.value)}
            minRows={3}
          />

          <div className="d-flex flex-column gap-2 mt-2">
            <Button
              color="red"
              fullWidth
              onClick={handleReject}
              loading={actionLoadingId === activeRow?.appointmentID}
            >
              Reject appointment
            </Button>
            <Button
              variant="default"
              fullWidth
              onClick={() => {
                setRejectOpened(false);
                setActiveRow(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Stack>
      </Modal>
    </Stack>
  );
}
