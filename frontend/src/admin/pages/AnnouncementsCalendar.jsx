import React, { useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Title,
  Group,
  Button,
  Table,
  Modal,
  TextInput,
  Textarea,
  Loader,
  Center,
  Badge,
  Select,
  Pagination,
  Text
} from '@mantine/core';
import { DatePickerInput, MonthPickerInput, YearPickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import dayjs from 'dayjs';

import { getCalendarEvents } from '../../api/calendar.js';
import { socket } from '../../socket.js';
import { updateAnnouncement, archiveAnnouncement, unarchiveAnnouncement } from '../../api/announcements.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function AnnouncementsCalendar() {
  const { user, isAdmin, isOfficer } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [summaryOpened, setSummaryOpened] = useState(false);
  const [summaryFilterType, setSummaryFilterType] = useState(''); // date | location | lead | status
  const [summaryDateMode, setSummaryDateMode] = useState(''); // day | month | year
  const [summaryDateDay, setSummaryDateDay] = useState(null);
  const [summaryDateMonth, setSummaryDateMonth] = useState(null);
  const [summaryDateYear, setSummaryDateYear] = useState('');
  const [summaryLocation, setSummaryLocation] = useState('');
  const [summaryLead, setSummaryLead] = useState('');
  const [summaryStatus, setSummaryStatus] = useState('');
  const [summaryPage, setSummaryPage] = useState(1);

  const form = useForm({
    initialValues: {
      title: '',
      date: null,
      startTime: '09:00',
      endTime: '10:00',
      location: '',
      lead: '',
      description: '',
      status: 'Scheduled'
    },
    validate: {
      date: (v) => (v ? null : 'Date is required'),
      startTime: (v) => (String(v || '').trim() ? null : 'Start time is required'),
      endTime: (v, values) => {
        if (!String(v || '').trim()) return 'End time is required';
        return (values.startTime && v > values.startTime) ? null : 'End time must be after start time';
      }
    }
  });

  const closeModal = () => {
    setModalOpened(false);
    setEditingId(null);
    form.reset();
  };

  useEffect(() => {
    const handler = () => fetchAnnouncements();
    socket.on('events:updated', handler);
    return () => socket.off('events:updated', handler);
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const start = dayjs().startOf('month').toISOString();
      const end = dayjs().add(2, 'month').endOf('month').toISOString();
      const res = await getCalendarEvents({ start, end });
      const all = res.data.data || [];
      const onlyEvents = all.filter((e) => e && e.type === 'Event/Activity');
      setItems(onlyEvents);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to load schedules', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements().catch(() => {});
  }, []);

  const getCurrentUserId = () => {
    if (!user) return null;
    return user.id ?? user.userId ?? null;
  };

  const canManageEvent = (ev) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (!isOfficer) return false;
    const currentId = getCurrentUserId();
    const ownerId = ev.userId ?? ev.createdByUserId ?? null;
    if (!currentId || ownerId == null) return false;
    return String(ownerId) === String(currentId);
  };

  const summaryPageSize = 10;

  const summaryLocationOptions = Array.from(
    new Set(
      items
        .map((ev) => (ev.location != null ? String(ev.location).trim() : ''))
        .filter((v) => v !== '')
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((loc) => ({ value: loc, label: loc }));

  const summaryLeadOptions = Array.from(
    new Set(
      items
        .map((ev) => (ev.lead != null ? String(ev.lead).trim() : ''))
        .filter((v) => v !== '')
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((lead) => ({ value: lead, label: lead }));

  const summaryStatusOptions = Array.from(
    new Set(
      items
        .map((ev) => (ev.status != null ? String(ev.status).trim() : ''))
        .filter((v) => v !== '')
    )
  )
    .sort((a, b) => a.localeCompare(b))
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

  const summaryFilteredItems = items.filter((ev) => {
    if (!summaryFilterType) return true;

    if (summaryFilterType === 'date') {
      const start = ev.startDate ? ev.startDate : (ev.date ? ev.date : null);
      return matchesGranularDate(start, summaryDateMode, summaryDateDay, summaryDateMonth, summaryDateYear);
    }

    if (summaryFilterType === 'location') {
      if (!summaryLocation) return true;
      return String(ev.location || '').trim() === String(summaryLocation).trim();
    }

    if (summaryFilterType === 'lead') {
      if (!summaryLead) return true;
      return String(ev.lead || '').trim() === String(summaryLead).trim();
    }

    if (summaryFilterType === 'status') {
      if (!summaryStatus) return true;
      return String(ev.status || '').trim().toLowerCase() === String(summaryStatus).trim().toLowerCase();
    }

    return true;
  });

  const summaryTotalPages = Math.max(1, Math.ceil(summaryFilteredItems.length / summaryPageSize));
  const summaryCurrentPage = Math.min(summaryPage, summaryTotalPages);
  const summaryPagedItems = summaryFilteredItems.slice(
    (summaryCurrentPage - 1) * summaryPageSize,
    summaryCurrentPage * summaryPageSize
  );

  const openEdit = (item) => {
    setEditingId(item.id);
    form.setValues({
      title: item.title || '',
      date: item.date ? new Date(item.date) : (item.startDate ? new Date(item.startDate) : null),
      startTime: item.startTime || (item.startDate ? dayjs(item.startDate).format('HH:mm') : '09:00'),
      endTime: item.endTime || (item.endDate ? dayjs(item.endDate).format('HH:mm') : '10:00'),
      location: item.location || '',
      lead: item.lead || '',
      description: item.description || '',
      status: item.status || 'Scheduled'
    });
    setModalOpened(true);
  };

  const isArchivedEvent = (ev) => String(ev.status || '').toUpperCase() === 'ARCHIVED';

  const handleSubmit = async (values) => {
    const { hasErrors } = form.validate();
    if (hasErrors) return;

    try {
      const payload = {
        title: values.title,
        description: values.description || '',
        lead: values.lead || '',
        date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : null,
        startTime: values.startTime,
        endTime: values.endTime,
        location: values.location || ''
      };

      await updateAnnouncement(editingId, payload);
      showNotification({ title: 'Saved', message: 'Event updated', color: 'green' });

      closeModal();
      await fetchAnnouncements();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to save event';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  // no archive in schedules view

  const handleArchive = async (id) => {
    try {
      await archiveAnnouncement(id);
      showNotification({ title: 'Archived', message: 'Event archived.', color: 'green' });
      await fetchAnnouncements();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to archive event';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  const handleUnarchive = async (id) => {
    try {
      await unarchiveAnnouncement(id);
      showNotification({ title: 'Unarchived', message: 'Event restored.', color: 'green' });
      await fetchAnnouncements();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to unarchive event';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>Events / Activity</Title>
        <Group gap="sm">
          <Button size="sm" variant="outline" onClick={() => setSummaryOpened(true)}>
            Summary
          </Button>
          <Button
            size="sm"
            variant={showArchived ? 'filled' : 'outline'}
            color={showArchived ? 'gray' : 'dark'}
            onClick={() => setShowArchived((v) => !v)}
          >
            Archived
          </Button>
        </Group>
      </Group>

      {loading ? (
        <Center py="lg">
          <Loader />
        </Center>
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
              <Table.Th style={{ textAlign: 'left' }}>Event Title</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Date</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Start Time</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>End Time</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Location</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Lead</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Status</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items
              .filter((ev) => (showArchived ? isArchivedEvent(ev) : !isArchivedEvent(ev)))
              .map((ev, index) => {
              const rowNumber = index + 1;
              const start = ev.startDate ? dayjs(ev.startDate) : (ev.date ? dayjs(ev.date) : null);
              const end = ev.endDate ? dayjs(ev.endDate) : null;

              const rawStatus = String(ev.status || '');
              const upper = rawStatus.toUpperCase();
              let statusLabel = rawStatus || 'Unknown';
              let statusColor = 'gray';

              if (upper === 'UPCOMING') {
                statusLabel = 'UPCOMING';
                statusColor = 'blue';
              } else if (upper === 'ONGOING') {
                statusLabel = 'ONGOING';
                statusColor = 'green';
              } else if (upper === 'PAST') {
                statusLabel = 'PAST';
                statusColor = 'gray';
              } else if (upper === 'ARCHIVED') {
                statusLabel = 'CANCELLED';
                statusColor = 'red';
              }
              return (
                <Table.Tr key={ev.id}>
                  <Table.Td style={{ textAlign: 'left', verticalAlign: 'middle' }}>{rowNumber}</Table.Td>
                  <Table.Td style={{ textAlign: 'left', verticalAlign: 'middle' }}>{ev.title || 'Event / Activity'}</Table.Td>
                  <Table.Td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                    {start
                      ? (!end || end.isSame(start, 'day')
                          ? start.format('MM/DD/YYYY')
                          : `${start.format('MM/DD/YYYY')} - ${end.format('MM/DD/YYYY')}`)
                      : '—'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                    {start ? start.format('h:mm A') : '—'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                    {end ? end.format('h:mm A') : '—'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'left', verticalAlign: 'middle' }}>{ev.location || '—'}</Table.Td>
                  <Table.Td style={{ textAlign: 'left', verticalAlign: 'middle' }}>{ev.lead || '—'}</Table.Td>
                  <Table.Td style={{ textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap', minWidth: 110 }}>
                    <Badge color={statusColor}>{statusLabel}</Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    {(isAdmin || isOfficer) && canManageEvent(ev) && (
                      <div className="d-inline-flex gap-1">
                        <Button
                          type="button"
                          variant="light"
                          onClick={() => openEdit(ev)}
                        >
                          Edit
                        </Button>
                        {isArchivedEvent(ev) ? (
                          <Button
                            color="green"
                            variant="light"
                            onClick={() => handleUnarchive(ev.id)}
                          >
                            Unarchive
                          </Button>
                        ) : (
                          <Button
                            color="red"
                            variant="light"
                            onClick={() => handleArchive(ev.id)}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={summaryOpened}
        onClose={() => setSummaryOpened(false)}
        size="xl"
        centered
        title="Events / Activity Summary"
      >
        <Stack gap="sm">
          <Group align="flex-end">
            <Select
              label="Filter by"
              placeholder="None"
              data={[
                { value: 'date', label: 'Date' },
                { value: 'location', label: 'Location' },
                { value: 'lead', label: 'Lead' },
                { value: 'status', label: 'Status' },
              ]}
              value={summaryFilterType}
              onChange={(v) => {
                const value = v || '';
                setSummaryFilterType(value);
                setSummaryDateMode('');
                setSummaryDateDay(null);
                setSummaryDateMonth(null);
                setSummaryDateYear('');
                setSummaryLocation('');
                setSummaryLead('');
                setSummaryStatus('');
                setSummaryPage(1);
              }}
              clearable
              w={220}
            />
            {summaryFilterType === 'date' && (
              <Group gap="sm" align="flex-end" style={{ flex: 1 }}>
                <Select
                  label="Date filter"
                  placeholder="Select granularity"
                  data={[
                    { value: 'day', label: 'Day' },
                    { value: 'month', label: 'Month' },
                    { value: 'year', label: 'Year' },
                  ]}
                  value={summaryDateMode}
                  onChange={(v) => {
                    setSummaryDateMode(v || '');
                    setSummaryDateDay(null);
                    setSummaryDateMonth(null);
                    setSummaryDateYear('');
                    setSummaryPage(1);
                  }}
                  w={180}
                />

                {summaryDateMode === 'day' && (
                  <DatePickerInput
                    label="Day"
                    placeholder="Pick date"
                    value={summaryDateDay}
                    onChange={(value) => {
                      setSummaryDateDay(value);
                      setSummaryPage(1);
                    }}
                    firstDayOfWeek={0}
                    valueFormat="MM/DD/YYYY"
                  />
                )}

                {summaryDateMode === 'month' && (
                  <MonthPickerInput
                    label="Month"
                    placeholder="Pick month"
                    value={summaryDateMonth}
                    onChange={(value) => {
                      setSummaryDateMonth(value);
                      setSummaryPage(1);
                    }}
                    firstDayOfWeek={0}
                  />
                )}

                {summaryDateMode === 'year' && (
                  <YearPickerInput
                    label="Year"
                    placeholder="Select year"
                    value={summaryDateYear}
                    onChange={(value) => {
                      setSummaryDateYear(value || '');
                      setSummaryPage(1);
                    }}
                  />
                )}
              </Group>
            )}

            {summaryFilterType === 'location' && (
              <Select
                label="Location"
                placeholder="Select location"
                data={summaryLocationOptions}
                value={summaryLocation}
                onChange={(v) => {
                  setSummaryLocation(v || '');
                  setSummaryPage(1);
                }}
                searchable
                clearable
                style={{ flex: 1 }}
              />
            )}

            {summaryFilterType === 'lead' && (
              <Select
                label="Lead"
                placeholder="Select lead"
                data={summaryLeadOptions}
                value={summaryLead}
                onChange={(v) => {
                  setSummaryLead(v || '');
                  setSummaryPage(1);
                }}
                searchable
                clearable
                style={{ flex: 1 }}
              />
            )}

            {summaryFilterType === 'status' && (
              <Select
                label="Status"
                placeholder="Any"
                data={summaryStatusOptions}
                value={summaryStatus}
                onChange={(v) => {
                  setSummaryStatus(v || '');
                  setSummaryPage(1);
                }}
                clearable
                style={{ flex: 1 }}
              />
            )}
          </Group>

          <Text size="sm">
            <b>Total events/activities:</b> {summaryFilteredItems.length}
          </Text>

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
                <Table.Th style={{ textAlign: 'left' }}>Title</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Date</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Start Time</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>End Time</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Location</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Lead</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summaryPagedItems.map((ev, index) => {
                const rowNumber = (summaryCurrentPage - 1) * summaryPageSize + index + 1;
                const start = ev.startDate ? dayjs(ev.startDate) : (ev.date ? dayjs(ev.date) : null);
                const end = ev.endDate ? dayjs(ev.endDate) : null;

                const rawStatus = String(ev.status || '');
                const upper = rawStatus.toUpperCase();
                let statusLabel = rawStatus || 'Unknown';

                if (upper === 'UPCOMING') {
                  statusLabel = 'UPCOMING';
                } else if (upper === 'ONGOING') {
                  statusLabel = 'ONGOING';
                } else if (upper === 'PAST') {
                  statusLabel = 'PAST';
                } else if (upper === 'ARCHIVED') {
                  statusLabel = 'CANCELLED';
                }

                return (
                  <Table.Tr key={ev.id}>
                    <Table.Td>{rowNumber}</Table.Td>
                    <Table.Td>{ev.title || 'Event / Activity'}</Table.Td>
                    <Table.Td>
                      {start
                        ? (!end || end.isSame(start, 'day')
                            ? start.format('MM/DD/YYYY')
                            : `${start.format('MM/DD/YYYY')} - ${end.format('MM/DD/YYYY')}`)
                        : '—'}
                    </Table.Td>
                    <Table.Td>{start ? start.format('h:mm A') : '—'}</Table.Td>
                    <Table.Td>{end ? end.format('h:mm A') : '—'}</Table.Td>
                    <Table.Td>{ev.location || '—'}</Table.Td>
                    <Table.Td>{ev.lead || '—'}</Table.Td>
                    <Table.Td>{statusLabel}</Table.Td>
                  </Table.Tr>
                );
              })}
              {summaryPagedItems.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Center>
                      <Text size="sm" c="dimmed">
                        No events or activities match the selected filters.
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

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        withCloseButton={false}
        centered
        size="xl"
      >
        <div
          className="row g-0 align-items-stretch"
          style={{ maxHeight: '70vh', overflowY: 'auto' }}
        >
          <div
            className="col-md-5 d-none d-md-block bg-light"
            style={{ borderLeft: '1px solid #e5e7eb', position: 'sticky', top: 0, alignSelf: 'flex-start' }}
          >
            <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center">
              <div className="mb-3 small text-muted">Preview</div>
              <div className="small text-muted mb-1">Title</div>
              <div className="fw-semibold mb-2">{form.values.title || 'Event / Activity'}</div>

              <div className="small text-muted mb-1">Date</div>
                <div className="mb-2">
                  {form.values.date
                    ? dayjs(form.values.date).format('MM/DD/YYYY')
                    : 'Not set'}
                </div>

              <div className="small text-muted mb-1">Time</div>
              <div className="mb-2">
                {form.values.startTime && form.values.endTime
                  ? `${form.values.startTime} - ${form.values.endTime}`
                  : form.values.startTime
                  ? form.values.startTime
                  : 'Not set'}
              </div>

              <div className="small text-muted mb-1">Location</div>
              <div className="mb-2">{form.values.location || 'Not specified'}</div>

              <div className="small text-muted mb-1">Lead</div>
              <div className="mb-2">{form.values.lead || 'Not specified'}</div>
            </div>
          </div>  

          <div className="col-12 col-md-7 p-4">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="text-uppercase small text-muted mb-1">Announcements / Calendar</div>
                <h2 className="h5 mb-0">{editingId ? 'Edit Event / Activity' : 'Edit Event'}</h2>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeModal}
              />
            </div>

            <form
              onSubmit={form.onSubmit((values) => {
                handleSubmit(values).catch(() => {});
              })}
            >
              <Stack>
                <TextInput label="Title" required {...form.getInputProps('title')} />
                <DatePickerInput
                  label="Date"
                  required
                  value={form.values.date}
                  onChange={(value) => form.setFieldValue('date', value)}
                  firstDayOfWeek={0}
                />
                <Group grow>
                  <TextInput label="Start time" type="time" {...form.getInputProps('startTime')} />
                  <TextInput label="End time" type="time" {...form.getInputProps('endTime')} />
                </Group>
                <TextInput label="Location" {...form.getInputProps('location')} />
                <TextInput label="Lead" {...form.getInputProps('lead')} />
                <Textarea
                  label="Description"
                  minRows={6}
                  autosize
                  {...form.getInputProps('description')}
                />

                <div className="d-flex justify-content-end gap-2 pt-2 mt-1 border-top">
                  <Button type="submit">Save changes</Button>
                </div>
              </Stack>
            </form>
          </div>
        </div>
      </Modal>
    </Stack>
  );
}
