  import React, { useEffect, useRef, useState } from 'react';
  import { useOutletContext } from 'react-router-dom';
  import { Stack, Title, Table, Loader, Center, Group, Button, Text, Modal, Textarea, Badge, TextInput, Pagination, Select } from '@mantine/core';
  import { DatePickerInput, MonthPickerInput, YearPickerInput } from '@mantine/dates';
  import { showNotification } from '@mantine/notifications';
  import dayjs from 'dayjs';
  
  import { getFamilyPlanningBookings, approveFamilyPlanningBooking, rejectFamilyPlanningBooking, cancelFamilyPlanningBooking, archiveFamilyPlanningBooking, unarchiveFamilyPlanningBooking } from '../../api/familyPlanning.js';
  import { socket } from '../../socket.js';
  import popcomLogo from '../../content/POPCOM-Logo.jpg';

  export function FamilyPlanningAdmin() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewing, setViewing] = useState(null);
    const [rejectingId, setRejectingId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [cancelingId, setCancelingId] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [showArchived, setShowArchived] = useState(false);
    const [summaryOpened, setSummaryOpened] = useState(false);
    const [summaryFilterType, setSummaryFilterType] = useState(''); // age | pref | created | status
    const [summaryAge, setSummaryAge] = useState('');
    const [summaryStatus, setSummaryStatus] = useState('');
    const [summaryPrefMode, setSummaryPrefMode] = useState('');
    const [summaryPrefDay, setSummaryPrefDay] = useState(null);
    const [summaryPrefMonth, setSummaryPrefMonth] = useState(null);
    const [summaryPrefYear, setSummaryPrefYear] = useState('');
    const [summaryCreatedMode, setSummaryCreatedMode] = useState('');
    const [summaryCreatedDay, setSummaryCreatedDay] = useState(null);
    const [summaryCreatedMonth, setSummaryCreatedMonth] = useState(null);
    const [summaryCreatedYear, setSummaryCreatedYear] = useState('');
    const [summaryPage, setSummaryPage] = useState(1);
    const [approvingId, setApprovingId] = useState(null);
    const [approveNote, setApproveNote] = useState('');
    const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
    const outletCtx = useOutletContext?.() || {};
    const setFpPending = outletCtx.setFpPending;
    const autoRejectingRef = useRef(false);

    useEffect(() => {
      const handler = () => fetchItems();
      socket.on('fp:updated', handler);
      return () => socket.off('fp:updated', handler);
    }, []);

    const fetchItems = async () => {
      setLoading(true);
      try {
        const res = await getFamilyPlanningBookings({ page: 1, limit: 100 });
        const data = res.data.data || [];
        setItems(data);
        const pendingCount = data.filter((b) => String(b.status || '').trim().toUpperCase() === 'PENDING').length;
        if (typeof setFpPending === 'function') setFpPending(pendingCount);

        // Auto-reject past pending bookings on load
        if (!autoRejectingRef.current && data.length > 0) {
          const today = dayjs().startOf('day');
          const overdue = data.filter((b) => {
            const status = String(b.status || '').trim().toUpperCase();
            if (status !== 'PENDING') return false;
            const d = b.pref_date ? dayjs(b.pref_date).startOf('day') : null;
            return d != null && d.isBefore(today);
          });

          if (overdue.length > 0) {
            autoRejectingRef.current = true;
            try {
              await Promise.all(
                overdue.map((b) =>
                  rejectFamilyPlanningBooking(
                    b.id,
                    'This date is unavailable, please select new schedule'
                  )
                )
              );
              await fetchItems();
            } catch (e) {
              console.error('Auto-reject past family planning bookings failed:', e);
            } finally {
              autoRejectingRef.current = false;
            }
          }
        }
      } catch (err) {
        console.error(err);
        showNotification({ title: 'Error', message: 'Failed to load bookings', color: 'red' });
      } finally {
        setLoading(false);
      }
    };

    const handleCancel = (id) => {
      setCancelingId(id);
    };

    const handleConfirmCancel = async () => {
      if (!cancelingId) return;
      if (!cancelReason || !cancelReason.trim()) {
        showNotification({ title: 'Missing reason', message: 'Please provide a reason for cancellation.', color: 'yellow' });
        return;
      }
      setRowActionLoadingId(cancelingId);
      try {
        await cancelFamilyPlanningBooking(cancelingId, cancelReason.trim());
        await fetchItems();
        showNotification({ title: 'Cancelled', message: 'Booking has been cancelled.', color: 'green' });
        setCancelingId(null);
        setCancelReason('');
      } catch (err) {
        console.error(err);
        const msg = err?.response?.data?.error?.message || 'Failed to cancel booking';
        showNotification({ title: 'Error', message: msg, color: 'red' });
      } finally {
        setRowActionLoadingId(null);
      }
    };

    const statusColor = (status) => {
      const s = String(status || '').trim().toUpperCase();
      if (s === 'PENDING') return 'yellow';
      if (s === 'APPROVED') return 'green';
      if (s === 'REJECTED' || s === 'CANCELLED') return 'red';
      if (s === 'ARCHIVED') return 'gray';
      return 'gray';
    };

    const handleApproveClick = (id) => {
      setApprovingId(id);
      setApproveNote('');
    };

    const handleConfirmApprove = async () => {
      if (!approvingId) return;
      setRowActionLoadingId(approvingId);
      try {
        await approveFamilyPlanningBooking(approvingId, approveNote.trim() || null);
        await fetchItems();
        showNotification({ title: 'Approved', message: 'Approval SMS sent', color: 'green' });
        setApprovingId(null);
        setApproveNote('');
      } catch (err) {
        console.error(err);
        const msg = err?.response?.data?.error?.message || 'Failed to approve/send SMS';
        showNotification({ title: 'Error', message: msg, color: 'red' });
      } finally {
        setRowActionLoadingId(null);
      }
    };

    const handleReject = async () => {
      if (!rejectingId) return;
      if (!rejectReason || !rejectReason.trim()) {
        showNotification({ title: 'Missing reason', message: 'Please provide a reason for rejection.', color: 'yellow' });
        return;
      }
      setRowActionLoadingId(rejectingId);
      try {
        await rejectFamilyPlanningBooking(rejectingId, rejectReason.trim());
        await fetchItems();
        showNotification({ title: 'Rejected', message: 'Rejection SMS sent', color: 'green' });
        setRejectingId(null);
        setRejectReason('');
      } catch (err) {
        console.error(err);
        const msg = err?.response?.data?.error?.message || 'Failed to reject booking';
        showNotification({ title: 'Error', message: msg, color: 'red' });
      } finally {
        setRowActionLoadingId(null);
      }
    };

    const formatDate = (value, pattern = 'YYYY-MM-DD') => {
      if (!value) return '—';
      const d = dayjs(value);
      return d.isValid() ? d.format(pattern) : '—';
    };

    useEffect(() => {
      fetchItems().catch(() => {});
    }, []);

    const handleArchive = async (id) => {
      setRowActionLoadingId(id);
      try {
        await archiveFamilyPlanningBooking(id);
        await fetchItems();
        showNotification({ title: 'Archived', message: 'Booking has been archived.', color: 'green' });
      } catch (err) {
        console.error(err);
        const msg = err?.response?.data?.error?.message || 'Failed to archive booking';
        showNotification({ title: 'Error', message: msg, color: 'red' });
      } finally {
        setRowActionLoadingId(null);
      }
    };

    const handleUnarchive = async (id) => {
      setRowActionLoadingId(id);
      try {
        await unarchiveFamilyPlanningBooking(id);
        await fetchItems();
        showNotification({ title: 'Restored', message: 'Booking has been unarchived.', color: 'green' });
      } catch (err) {
        console.error(err);
        const msg = err?.response?.data?.error?.message || 'Failed to unarchive booking';
        showNotification({ title: 'Error', message: msg, color: 'red' });
      } finally {
        setRowActionLoadingId(null);
      }
    };

    const normalizedStatus = (value) => String(value || '').trim().toUpperCase();

    const sortedItems = [...items].sort((a, b) => {
      const today = dayjs().startOf('day');

      const statusA = String(a.status || '').trim().toUpperCase();
      const statusB = String(b.status || '').trim().toUpperCase();

      const getStatusRank = (s) => {
        if (s === 'PENDING') return 0;
        if (s === 'APPROVED' || s === 'COMPLETED' || s === 'SCHEDULED') return 1;
        if (s === 'CANCELLED') return 2;
        if (s === 'REJECTED') return 3;
        return 4;
      };

      const ra = getStatusRank(statusA);
      const rb = getStatusRank(statusB);
      if (ra !== rb) return ra - rb; // primary: status order

      const da = a.pref_date ? dayjs(a.pref_date).startOf('day') : null;
      const db = b.pref_date ? dayjs(b.pref_date).startOf('day') : null;

      const hasDa = da && da.isValid();
      const hasDb = db && db.isValid();

      if (hasDa && hasDb) {
        const diffA = Math.abs(da.diff(today, 'day'));
        const diffB = Math.abs(db.diff(today, 'day'));
        if (diffA !== diffB) return diffA - diffB; // within same status: closest preferred date first
      } else if (hasDa || hasDb) {
        // Within same status, bookings with a valid preferred date first
        return hasDa ? -1 : 1;
      }

      const ca = a.created_at ? dayjs(a.created_at) : null;
      const cb = b.created_at ? dayjs(b.created_at) : null;
      if (!ca && !cb) return 0;
      if (!ca) return 1;
      if (!cb) return -1;
      return cb.valueOf() - ca.valueOf();
    });

    const filteredItems = sortedItems.filter((b) => {
      const status = normalizedStatus(b.status);
      if (showArchived) {
        if (status !== 'ARCHIVED') return false;
      } else {
        if (status === 'ARCHIVED') return false;
      }

      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        String(b.full_name || '').toLowerCase().includes(q) ||
        String(b.contact_number || '').toLowerCase().includes(q)
      );
    });

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const summaryAgeOptions = Array.from(
      new Set(
        items
          .map((b) => (b.age != null ? String(b.age).trim() : ''))
          .filter((v) => v !== '')
      )
    )
      .sort((a, b) => Number(a) - Number(b))
      .map((age) => ({ value: age, label: age }));

    const summaryStatusOptions = Array.from(
      new Set(
        items
          .map((b) => normalizedStatus(b.status))
          .filter((v) => v !== '')
      )
    )
      .sort()
      .map((status) => ({ value: status, label: status }));

    const matchesGranularDate = (source, mode, dayVal, monthVal, yearVal) => {
      if (!mode) return true;
      if (!source) return false;
      const d = dayjs(source);
      if (!d.isValid()) return false;
      if (mode === 'day') {
        if (!dayVal) return true;
        const target = dayjs(dayVal);
        return d.isSame(target, 'day');
      }
      if (mode === 'month') {
        if (!monthVal) return true;
        const target = dayjs(monthVal);
        return d.year() === target.year() && d.month() === target.month();
      }
      if (mode === 'year') {
        if (!yearVal) return true;
        const y = typeof yearVal === 'number' ? yearVal : Number(yearVal);
        if (!y) return true;
        return d.year() === y;
      }
      return true;
    };

    const summaryFilteredItems = items.filter((b) => {
      if (!summaryFilterType) return true;

      if (summaryFilterType === 'age') {
        if (!summaryAge) return true;
        return String(b.age || '').trim() === String(summaryAge);
      }

      if (summaryFilterType === 'status') {
        if (!summaryStatus) return true;
        return normalizedStatus(b.status) === normalizedStatus(summaryStatus);
      }

      if (summaryFilterType === 'pref') {
        return matchesGranularDate(b.pref_date, summaryPrefMode, summaryPrefDay, summaryPrefMonth, summaryPrefYear);
      }

      if (summaryFilterType === 'created') {
        return matchesGranularDate(b.created_at, summaryCreatedMode, summaryCreatedDay, summaryCreatedMonth, summaryCreatedYear);
      }

      return true;
    });

    const summaryPageSize = 10;
    const summaryTotalPages = Math.max(1, Math.ceil(summaryFilteredItems.length / summaryPageSize));
    const summaryCurrentPage = Math.min(summaryPage, summaryTotalPages);
    const summaryPagedItems = summaryFilteredItems.slice(
      (summaryCurrentPage - 1) * summaryPageSize,
      summaryCurrentPage * summaryPageSize
    );

    return (
      <Stack>
        <Group justify="space-between" align="center" mb="xs">
          <Title order={2}>Family Planning Bookings</Title>
          <Group gap="xs">
            <Button size="sm" variant="outline" onClick={() => setSummaryOpened(true)}>
              Summary
            </Button>
            <TextInput
              size="sm"
              placeholder="Search by name or contact..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ maxWidth: 260 }}
            />
            <Button
              size="sm"
              variant={showArchived ? 'filled' : 'outline'}
              color={showArchived ? 'gray' : 'dark'}
              onClick={() => { setShowArchived((prev) => !prev); setPage(1); }}
            >
              Archived
            </Button>
          </Group>
        </Group>
        {loading ? (
          <Center py="lg"><Loader /></Center>
        ) : (
          <Table
            striped
            withTableBorder
            withColumnBorders
            highlightOnHover
            verticalSpacing="xs"
            fontSize="sm"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ textAlign: 'left' }}>No.</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Full name</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Age</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Contact</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Preferred date</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Created at</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pagedItems.map((b, index) => {
                const rowNumber = (currentPage - 1) * pageSize + index + 1;
                const status = normalizedStatus(b.status);
                const isPending = status === 'PENDING';
                const isCancelled = status === 'CANCELLED';
                const isRejected = status === 'REJECTED';
                const isArchived = status === 'ARCHIVED';
                const isRowBusy = rowActionLoadingId === b.id;

                return (
                  <Table.Tr key={b.id}>
                    <Table.Td>{rowNumber}</Table.Td>
                    <Table.Td>{b.full_name}</Table.Td>
                  <Table.Td>{b.age}</Table.Td>
                  <Table.Td>{b.contact_number}</Table.Td>
                  <Table.Td>{formatDate(b.pref_date, 'YYYY-MM-DD')}</Table.Td>
                  <Table.Td>{formatDate(b.created_at, 'YYYY-MM-DD')}</Table.Td>
                  <Table.Td style={{textAlign: 'center'}}>
                    <Badge color={statusColor(b.status)} variant="filled">
                      {b.status || 'Pending'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-start">
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => setViewing(b)}
                        disabled={isRowBusy}
                      >
                        View
                      </Button>
                      {!isArchived && (
                        <>
                          <Button
                            size="xs"
                            color="green"
                            variant="light"
                            disabled={isRowBusy || !isPending}
                            onClick={() => !isRowBusy && isPending && handleApproveClick(b.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="xs"
                            color="orange"
                            variant="light"
                            disabled={isRowBusy || !isPending}
                            onClick={() => !isRowBusy && isPending && setRejectingId(b.id)}
                          >
                            Reject
                          </Button>
                          <Button
                            size="xs"
                            color="gray"
                            variant="light"
                            disabled={isRowBusy || isCancelled || isRejected}
                            onClick={() => !isRowBusy && !isCancelled && !isRejected && handleCancel(b.id)}
                          >
                            Cancel
                          </Button>
                          {!isPending && (
                            <Button
                              size="xs"
                              color="red"
                              variant="light"
                              disabled={isRowBusy}
                              onClick={() => !isRowBusy && handleArchive(b.id)}
                            >
                              Archive
                            </Button>
                          )}
                        </>
                      )}
                      {isArchived && (
                        <Button
                          size="xs"
                          color="green"
                          variant="light"
                          disabled={isRowBusy}
                          onClick={() => !isRowBusy && handleUnarchive(b.id)}
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

        {!loading && filteredItems.length > pageSize && (
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
          opened={summaryOpened}
          onClose={() => setSummaryOpened(false)}
          size="xl"
          centered
          title="Family Planning Bookings Summary"
        >
          <Stack gap="sm">
            <Group gap="sm" align="flex-end">
              <Select
                label="Filter by"
                placeholder="None"
                data={[
                  { value: 'age', label: 'Age' },
                  { value: 'pref', label: 'Preferred date' },
                  { value: 'created', label: 'Created at' },
                  { value: 'status', label: 'Status' },
                ]}
                value={summaryFilterType}
                onChange={(v) => {
                  const value = v || '';
                  setSummaryFilterType(value);
                  setSummaryAge('');
                  setSummaryStatus('');
                  setSummaryPrefMode('');
                  setSummaryPrefDay(null);
                  setSummaryPrefMonth(null);
                  setSummaryPrefYear('');
                  setSummaryCreatedMode('');
                  setSummaryCreatedDay(null);
                  setSummaryCreatedMonth(null);
                  setSummaryCreatedYear('');
                  setSummaryPage(1);
                }}
                clearable
                w={200}
              />

              {summaryFilterType === 'age' && (
                <Select
                  label="Age"
                  placeholder="Select age"
                  data={summaryAgeOptions}
                  value={summaryAge}
                  onChange={(v) => {
                    setSummaryAge(v || '');
                    setSummaryPage(1);
                  }}
                  clearable
                  w={140}
                />
              )}

              {summaryFilterType === 'status' && (
                <Select
                  label="Status"
                  placeholder="Select status"
                  data={summaryStatusOptions}
                  value={summaryStatus}
                  onChange={(v) => {
                    setSummaryStatus(v || '');
                    setSummaryPage(1);
                  }}
                  clearable
                  w={180}
                />
              )}

              {summaryFilterType === 'pref' && (
                <Group gap="sm" align="flex-end">
                  <Select
                    label="Preferred date filter"
                    placeholder="Select granularity"
                    data={[
                      { value: 'day', label: 'Day' },
                      { value: 'month', label: 'Month' },
                      { value: 'year', label: 'Year' },
                    ]}
                    value={summaryPrefMode}
                    onChange={(v) => {
                      setSummaryPrefMode(v || '');
                      setSummaryPrefDay(null);
                      setSummaryPrefMonth(null);
                      setSummaryPrefYear('');
                      setSummaryPage(1);
                    }}
                    w={180}
                  />

                  {summaryPrefMode === 'day' && (
                    <DatePickerInput
                      label="Day"
                      placeholder="Pick date"
                      value={summaryPrefDay}
                      onChange={(value) => {
                        setSummaryPrefDay(value);
                        setSummaryPage(1);
                      }}
                      firstDayOfWeek={0}
                      valueFormat="MMM D, YYYY"
                    />
                  )}

                  {summaryPrefMode === 'month' && (
                    <MonthPickerInput
                      label="Month"
                      placeholder="Pick month"
                      value={summaryPrefMonth}
                      onChange={(value) => {
                        setSummaryPrefMonth(value);
                        setSummaryPage(1);
                      }}
                      firstDayOfWeek={0}
                    />
                  )}

                  {summaryPrefMode === 'year' && (
                    <YearPickerInput
                      label="Year"
                      placeholder="Select year"
                      value={summaryPrefYear}
                      onChange={(value) => {
                        setSummaryPrefYear(value || '');
                        setSummaryPage(1);
                      }}
                    />
                  )}
                </Group>
              )}

              {summaryFilterType === 'created' && (
                <Group gap="sm" align="flex-end">
                  <Select
                    label="Created at filter"
                    placeholder="Select granularity"
                    data={[
                      { value: 'day', label: 'Day' },
                      { value: 'month', label: 'Month' },
                      { value: 'year', label: 'Year' },
                    ]}
                    value={summaryCreatedMode}
                    onChange={(v) => {
                      setSummaryCreatedMode(v || '');
                      setSummaryCreatedDay(null);
                      setSummaryCreatedMonth(null);
                      setSummaryCreatedYear('');
                      setSummaryPage(1);
                    }}
                    w={180}
                  />

                  {summaryCreatedMode === 'day' && (
                    <DatePickerInput
                      label="Day"
                      placeholder="Pick date"
                      value={summaryCreatedDay}
                      onChange={(value) => {
                        setSummaryCreatedDay(value);
                        setSummaryPage(1);
                      }}
                      firstDayOfWeek={0}
                      valueFormat="MMM D, YYYY"
                    />
                  )}

                  {summaryCreatedMode === 'month' && (
                    <MonthPickerInput
                      label="Month"
                      placeholder="Pick month"
                      value={summaryCreatedMonth}
                      onChange={(value) => {
                        setSummaryCreatedMonth(value);
                        setSummaryPage(1);
                      }}
                      firstDayOfWeek={0}
                    />
                  )}

                  {summaryCreatedMode === 'year' && (
                    <YearPickerInput
                      label="Year"
                      placeholder="Select year"
                      value={summaryCreatedYear}
                      onChange={(value) => {
                        setSummaryCreatedYear(value || '');
                        setSummaryPage(1);
                      }}
                    />
                  )}
                </Group>
              )}
            </Group>

            <Table
              striped
              withTableBorder
              withColumnBorders
              highlightOnHover
              verticalSpacing="xs"
              fontSize="sm"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ textAlign: 'left' }}>No.</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>Full name</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>Contact</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>Preferred date</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summaryPagedItems.map((b, index) => {
                  const rowNumber = (summaryCurrentPage - 1) * summaryPageSize + index + 1;
                  return (
                    <Table.Tr key={b.id}>
                      <Table.Td>{rowNumber}</Table.Td>
                      <Table.Td>{b.full_name}</Table.Td>
                      <Table.Td>{b.contact_number}</Table.Td>
                      <Table.Td>{formatDate(b.pref_date, 'YYYY-MM-DD')}</Table.Td>
                      <Table.Td>
                        <Badge color={statusColor(b.status)} variant="filled">
                          {b.status || 'Pending'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {summaryPagedItems.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Center>
                        <Text size="sm" c="dimmed">
                          No bookings match the selected filters.
                        </Text>
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            {summaryFilteredItems.length > summaryPageSize && (
              <Group justify="flex-end" mt="sm">
                <Pagination
                  size="sm"
                  value={summaryCurrentPage}
                  onChange={setSummaryPage}
                  total={summaryTotalPages}
                />
              </Group>
            )}
          </Stack>
        </Modal>

        <Modal opened={!!viewing} onClose={() => setViewing(null)} withCloseButton={false} centered size="xl">
          {viewing && (
            <div className="row g-0 align-items-stretch">
              <div
                className="col-md-5 d-none d-md-block"
                style={{ borderRight: '1px solid #dee2e6' }}
              >
                <div className="h-100 w-100 position-relative">
                  <img
                    src={popcomLogo}
                    alt="POPCOM Logo"
                    className="img-fluid h-100 w-100 p-4"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              </div>

              <div className="col-12 col-md-7 p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <div className="text-uppercase small text-muted mb-1">Municipal Population Office</div>
                    <h2 className="h5 mb-0">Booking Details</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setViewing(null)}
                  />
                </div>

                <Stack gap={6}>
                  <Text size="sm"><strong>Full name:</strong> {viewing.full_name}</Text>
                  <Text size="sm"><strong>Age:</strong> {viewing.age}</Text>
                  <Text size="sm"><strong>Contact:</strong> {viewing.contact_number}</Text>
                  <Text size="sm"><strong>Preferred date:</strong> {dayjs(viewing.pref_date).format('YYYY-MM-DD')}</Text>
                  <Text size="sm"><strong>Notes:</strong></Text>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{viewing.notes || '—'}</Text>

                  {(() => {
                    const status = String(viewing.status || '').toUpperCase();
                    const reason = viewing.reject_reason || viewing.rejectReason;
                    if (!reason || (status !== 'REJECTED' && status !== 'CANCELLED')) return null;

                    const label = status === 'REJECTED' ? 'Reason for rejection:' : 'Reason for cancellation:';
                    return (
                      <>
                        <Text size="sm"><strong>{label}</strong></Text>
                        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{reason}</Text>
                      </>
                    );
                  })()}
                </Stack>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          opened={rejectingId != null}
          onClose={() => { setRejectingId(null); setRejectReason(''); }}
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
                Reject this booking?
              </Text>
              <Text size="sm" c="dimmed">
                A rejection SMS will be sent to the client. Please provide a clear reason for the rejection.
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
                color="red"
                fullWidth
                onClick={handleReject}
                loading={rowActionLoadingId === (rejectingId || null)}
                disabled={rowActionLoadingId === (rejectingId || null)}
              >
                Confirm rejection
              </Button>
              <Button
                color="gray"
                fullWidth
                onClick={() => { setRejectingId(null); setRejectReason(''); }}
              >
                Back
              </Button>
            </div>
          </Stack>
        </Modal>

        <Modal
          opened={approvingId != null}
          onClose={() => { setApprovingId(null); setApproveNote(''); }}
          withCloseButton={false}
          centered
          size="sm"
          radius="lg"
        >
          <Stack gap="md">
            <div className="d-flex flex-column align-items-center text-center">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                style={{ width: 56, height: 56, backgroundColor: '#ecfdf3', color: '#16a34a' }}
              >
                <span style={{ fontSize: 24 }}>!</span>
              </div>
              <Text fw={600} size="lg" mb={2}>
                Approve this booking?
              </Text>
              <Text size="sm" c="dimmed">
                You can optionally add a note to the client. This note may be included in the approval SMS and email.
              </Text>
            </div>

            <Textarea
              label="Note to client (optional)"
              placeholder="Enter a short note to the client"
              value={approveNote}
              onChange={(e) => setApproveNote(e.currentTarget.value)}
              minRows={3}
            />

            <div className="d-flex flex-column gap-2 mt-2">
              <Button
                color="green"
                fullWidth
                onClick={handleConfirmApprove}
                loading={rowActionLoadingId === (approvingId || null)}
                disabled={rowActionLoadingId === (approvingId || null)}
              >
                Confirm approval
              </Button>
              <Button
                variant="default"
                onClick={() => { setApprovingId(null); setApproveNote(''); }}
              >
                Exit
              </Button>
            </div>
          </Stack>
        </Modal>

        <Modal
          opened={cancelingId != null}
          onClose={() => { setCancelingId(null); setCancelReason(''); }}
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
              placeholder="Enter the reason for cancellation"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.currentTarget.value)}
              minRows={3}
            />

            <div className="d-flex flex-column gap-2 mt-2">
              <Button
                color="red"
                fullWidth
                onClick={handleConfirmCancel}
                loading={rowActionLoadingId === (cancelingId || null)}
                disabled={rowActionLoadingId === (cancelingId || null)}
              >
                Cancel appointment
              </Button>
              <Button
                color="gray"
                fullWidth
                onClick={() => { setCancelingId(null); setCancelReason(''); }}
              >
                Back
              </Button>
            </div>
          </Stack>
        </Modal>
      </Stack>
    );
  }
