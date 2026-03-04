import React, { useEffect, useState } from 'react';
import { Stack, Title, Table, Loader, Center, Button, Group, Modal, Text, TextInput, Select, SegmentedControl, Pagination } from '@mantine/core';
import { DatePickerInput, MonthPickerInput, YearPickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';

import { getFeedback, getClientSatisfactionFeedback } from '../../api/feedback.js';
import { socket } from '../../socket.js';
import popcomLogo from '../../content/POPCOM-Logo.jpg';
import dayjs from 'dayjs';

export function FeedbackAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('website'); // 'website' | 'client'
  const [clientItems, setClientItems] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientViewing, setClientViewing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState(''); // string id for website OR { id, mode: 'client' }
  const [summaryOpened, setSummaryOpened] = useState(false);
  const [summaryFilterType, setSummaryFilterType] = useState(''); // barangay | date
  const [summaryBarangay, setSummaryBarangay] = useState('');
  const [summaryDateMode, setSummaryDateMode] = useState(''); // day | month | year
  const [summaryDateDay, setSummaryDateDay] = useState(null);
  const [summaryDateMonth, setSummaryDateMonth] = useState(null);
  const [summaryDateYear, setSummaryDateYear] = useState('');
  const [summaryPage, setSummaryPage] = useState(1);
  const [websitePage, setWebsitePage] = useState(1);
  const [clientPage, setClientPage] = useState(1);

  useEffect(() => {
    const handler = () => { fetchItems(); fetchClientItems(); };
    socket.on('feedback:updated', handler);
    return () => socket.off('feedback:updated', handler);
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await getFeedback({ page: 1, limit: 100 });
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to load feedback', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const fetchClientItems = async () => {
    setClientLoading(true);
    try {
      const res = await getClientSatisfactionFeedback({ page: 1, limit: 100 });
      setClientItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to load client satisfaction feedback', color: 'red' });
    } finally {
      setClientLoading(false);
    }
  };

  const filteredItems = items.filter((f) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(f.full_name || '').toLowerCase().includes(q) ||
      String(f.email || '').toLowerCase().includes(q) ||
      String(f.contact_number || '').toLowerCase().includes(q) ||
      String(f.barangay || '').toLowerCase().includes(q) ||
      String(f.message || '').toLowerCase().includes(q)
    );
  });

  const filteredClientItems = clientItems.filter((f) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(f.client_type || '').toLowerCase().includes(q) ||
      String(f.service_availed || '').toLowerCase().includes(q) ||
      String(f.region_of_residence || '').toLowerCase().includes(q) ||
      String(f.sex || '').toLowerCase().includes(q) ||
      String(f.age || '').toLowerCase().includes(q) ||
      String(f.suggestions || '').toLowerCase().includes(q) ||
      String(f.email || '').toLowerCase().includes(q)
    );
  });

  const summaryPageSize = 10;

  const listPageSize = 10;

  const websiteTotalPages = Math.max(1, Math.ceil(filteredItems.length / listPageSize));
  const websiteCurrentPage = Math.min(websitePage, websiteTotalPages);
  const websitePagedItems = filteredItems.slice(
    (websiteCurrentPage - 1) * listPageSize,
    websiteCurrentPage * listPageSize
  );

  const clientTotalPages = Math.max(1, Math.ceil(filteredClientItems.length / listPageSize));
  const clientCurrentPage = Math.min(clientPage, clientTotalPages);
  const clientPagedItems = filteredClientItems.slice(
    (clientCurrentPage - 1) * listPageSize,
    clientCurrentPage * listPageSize
  );

  const summaryBarangayOptions = Array.from(
    new Set(
      items
        .map((f) => (f.barangay != null ? String(f.barangay).trim() : ''))
        .filter((v) => v !== '')
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((barangay) => ({ value: barangay, label: barangay }));

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

  const summaryFilteredItems = items.filter((f) => {
    if (!summaryFilterType) return true;

    if (summaryFilterType === 'barangay') {
      if (!summaryBarangay) return true;
      return String(f.barangay || '').trim() === String(summaryBarangay).trim();
    }

    if (summaryFilterType === 'date') {
      return matchesGranularDate(f.created_at, summaryDateMode, summaryDateDay, summaryDateMonth, summaryDateYear);
    }

    return true;
  });

  const summaryTotalPages = Math.max(1, Math.ceil(summaryFilteredItems.length / summaryPageSize));
  const summaryCurrentPage = Math.min(summaryPage, summaryTotalPages);
  const summaryPagedItems = summaryFilteredItems.slice(
    (summaryCurrentPage - 1) * summaryPageSize,
    summaryCurrentPage * summaryPageSize
  );

  useEffect(() => {
    fetchItems().catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'client' && clientItems.length === 0 && !clientLoading) {
      fetchClientItems().catch(() => {});
    }
  }, [mode]);

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso || '';
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso || '';
    }
  };

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Group gap="md" align="center">
          <Title order={2}>Feedback</Title>
          <SegmentedControl
            size="sm"
            value={mode}
            onChange={setMode}
            data={[
              { label: 'Website', value: 'website' },
              { label: 'Client Satisfaction', value: 'client' }
            ]}
          />
        </Group>
        <Group gap="xs">
          <Button size="sm" variant="outline" onClick={() => setSummaryOpened(true)}>
            Summary
          </Button>
          <TextInput
            size="sm"
            placeholder={mode === 'website' ? 'Search website feedback...' : 'Search client satisfaction...'}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ maxWidth: 260 }}
          />
        </Group>
      </Group>

      {mode === 'website' && (loading ? (
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
              <Table.Th style={{ textAlign: 'left' }}>Barangay</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Message</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Date</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {websitePagedItems.map((f, index) => {
              const rowNumber = (websiteCurrentPage - 1) * listPageSize + index + 1;
              return (
              <Table.Tr key={f.id}>
                <Table.Td>{rowNumber}</Table.Td>
                <Table.Td>{f.barangay || '—'}</Table.Td>
                <Table.Td>{f.message}</Table.Td>
                <Table.Td>{formatDate(f.created_at)}</Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="center">
                    <Button size="xs" variant="light" onClick={() => setViewing(f)}>View</Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );})}
          </Table.Tbody>
        </Table>
      ))}

      {mode === 'website' && !loading && filteredItems.length > listPageSize && (
        <Group justify="flex-end">
          <Pagination
            value={websiteCurrentPage}
            onChange={setWebsitePage}
            total={websiteTotalPages}
            size="sm"
            radius="md"
          />
        </Group>
      )}

      {mode === 'client' && (clientLoading ? (
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
              <Table.Th style={{ textAlign: 'left' }}>Client type</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Service availed</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Region</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Sex / Age</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Date</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {clientPagedItems.map((f, index) => {
              const rowNumber = (clientCurrentPage - 1) * listPageSize + index + 1;
              return (
              <Table.Tr key={f.id}>
                <Table.Td>{rowNumber}</Table.Td>
                <Table.Td>{f.client_type}</Table.Td>
                <Table.Td>{f.service_availed}</Table.Td>
                <Table.Td>{f.region_of_residence}</Table.Td>
                <Table.Td>{`${f.sex || ''}${f.age != null ? `, ${f.age}` : ''}`}</Table.Td>
                {/* Show the CSM survey date (not submission timestamp) */}
                <Table.Td>{formatDate(f.date)}</Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="center">
                    <Button size="xs" variant="light" onClick={() => setClientViewing(f)}>View</Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );})}
            {filteredClientItems.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text size="sm" c="dimmed">
                    No client satisfaction feedback entries match the search.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      ))}

      <Modal
        opened={summaryOpened}
        onClose={() => setSummaryOpened(false)}
        size="xl"
        centered
        title={mode === 'website' ? 'Website Feedback Summary' : 'Client Satisfaction Summary'}
      >
        {mode === 'website' ? (
          <Stack gap="sm">
            <Group align="flex-end">
              <Select
                label="Filter by"
                placeholder="None"
                data={[
                  { value: 'barangay', label: 'Barangay' },
                  { value: 'date', label: 'Date' },
                ]}
                value={summaryFilterType}
                onChange={(v) => {
                  const value = v || '';
                  setSummaryFilterType(value);
                  setSummaryBarangay('');
                  setSummaryDateMode('');
                  setSummaryDateDay(null);
                  setSummaryDateMonth(null);
                  setSummaryDateYear('');
                  setSummaryPage(1);
                }}
                clearable
                w={200}
              />

              {summaryFilterType === 'barangay' && (
                <Select
                  label="Barangay"
                  placeholder="Select barangay"
                  data={summaryBarangayOptions}
                  value={summaryBarangay}
                  onChange={(v) => {
                    setSummaryBarangay(v || '');
                    setSummaryPage(1);
                  }}
                  searchable
                  clearable
                  style={{ flex: 1 }}
                />
              )}

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
                      valueFormat="MMM D, YYYY"
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
            </Group>

            <Text size="sm">
              <b>Total feedback entries:</b> {summaryFilteredItems.length}
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
                  <Table.Th style={{ textAlign: 'left' }}>Barangay</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>Message</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>Date</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summaryPagedItems.map((f, index) => {
                  const rowNumber = (summaryCurrentPage - 1) * summaryPageSize + index + 1;
                  return (
                    <Table.Tr key={f.id}>
                      <Table.Td>{rowNumber}</Table.Td>
                      <Table.Td>{f.barangay || '—'}</Table.Td>
                      <Table.Td>{f.message}</Table.Td>
                      <Table.Td>{formatDate(f.created_at)}</Table.Td>
                    </Table.Tr>
                  );
                })}
                {summaryPagedItems.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Center>
                        <Text size="sm" c="dimmed">
                          No feedback entries match the selected filters.
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
        ) : (
          <Stack gap="sm">
            <Text size="sm">
              <b>Total client satisfaction entries:</b> {clientItems.length}
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
                  <Table.Th style={{ textAlign: 'left' }}>Client type</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>Service availed</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>Region</Table.Th>
                  <Table.Th style={{ textAlign: 'left' }}>Date</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {clientItems.map((f, index) => (
                  <Table.Tr key={f.id}>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>{f.client_type}</Table.Td>
                    <Table.Td>{f.service_availed}</Table.Td>
                    <Table.Td>{f.region_of_residence}</Table.Td>
                    {/* Use the CSM survey date for summary as well */}
                    <Table.Td>{formatDate(f.date)}</Table.Td>
                  </Table.Tr>
                ))}
                {clientItems.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Center>
                        <Text size="sm" c="dimmed">
                          No client satisfaction feedback entries yet.
                        </Text>
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
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
                  <h2 className="h5 mb-0">Feedback Details</h2>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setViewing(null)}
                />
              </div>

              <Stack gap={6}>
                <Text size="sm"><strong>From:</strong> {viewing.full_name}</Text>
                <Text size="sm"><strong>Email:</strong> {viewing.email || '—'}</Text>
                <Text size="sm"><strong>Contact:</strong> {viewing.contact_number || '—'}</Text>
                <Text size="sm"><strong>Barangay:</strong> {viewing.barangay || '—'}</Text>
                <Text size="sm"><strong>Date:</strong> {formatDate(viewing.created_at)}</Text>
                <Text size="sm"><strong>Message:</strong></Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{viewing.message}</Text>
              </Stack>
            </div>
          </div>
        )}
      </Modal>

      <Modal opened={!!clientViewing} onClose={() => setClientViewing(null)} centered size="lg">
        {clientViewing && (
          <Stack gap="xs">
            <Title order={4}>Client Satisfaction Feedback Details</Title>
            <Text size="sm"><strong>Client type:</strong> {clientViewing.client_type}</Text>
            <Text size="sm"><strong>Service availed:</strong> {clientViewing.service_availed}</Text>
            <Text size="sm"><strong>Region:</strong> {clientViewing.region_of_residence}</Text>
            <Text size="sm">
              <strong>Sex / Age:</strong>{' '}
              {`${clientViewing.sex || ''}${clientViewing.age != null ? `, ${clientViewing.age}` : ''}`}
            </Text>
            <Text size="sm"><strong>Date:</strong> {formatDate(clientViewing.date)}</Text>
            <Text size="sm"><strong>Date submitted:</strong> {formatDate(clientViewing.created_at)}</Text>
            <Text size="sm"><strong>Email (optional):</strong> {clientViewing.email || '—'}</Text>
            <Text size="sm"><strong>Suggestions (optional):</strong></Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{clientViewing.suggestions || '—'}</Text>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
