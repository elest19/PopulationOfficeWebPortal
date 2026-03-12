import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Title, Table, Group, Badge, Pagination, Loader, Center, Text, Button, Modal, Divider, Select } from '@mantine/core';
import { useOutletContext } from 'react-router-dom';
import dayjs from 'dayjs';
import { getPmoSmsLogs, resendPmoSmsLog, getPmoSmsFailedCount } from '../../api/pmoAdmin.js';

// All known SMS event types across modules (Family Planning, PMO, Usapan-Series)
const ALL_EVENT_TYPES = [
  // PMO booking lifecycle
  'PMO_CONFIRMATION',
  'PMO_APPROVED',
  'PMO_REJECTED',
  'PMO_CANCELLED',

  // PMO reminders
  'PMO_REMINDER_2_DAYS',
  'PMO_REMINDER_SAME_DAY',

  // Family Planning booking lifecycle
  'FP_Booking_Confirmation',
  'FP_APPROVED',
  'FP_REJECTED',
  'FP_CANCELLED',

  // Family Planning reminders
  'FP_REMINDER_2_DAYS',
  'FP_REMINDER_SAME_DAY',

  // Usapan-Series booking lifecycle
  'USAPAN-SERIES_CONFIRMATION',
  'USAPAN-SERIES_PENDING',
  'USAPAN-SERIES_APPROVED',
  'USAPAN-SERIES_REJECTED',
  'USAPAN-SERIES_CANCELLED',

  // Usapan-Series reminders
  'USAPAN_REMINDER_2_DAYS',
  'USAPAN_REMINDER_SAME_DAY',

  // File task reminders
  'FILETASK_OVERDUE_REMINDER'
];

const REFRESH_INTERVAL_SECONDS = 15 * 60;
const REFRESH_STORAGE_KEY = 'pmoSmsLogsLastRefreshAt';

function getRecipientDisplay(row) {
  if (!row) return '—';

  // Prefer an explicit mainContact field if present and not just digits
  if (row.mainContact) {
    const trimmed = String(row.mainContact).trim();
    if (trimmed && !/^\d+$/.test(trimmed)) {
      return trimmed;
    }
  }

  // Try to extract name from the message pattern: "Hello {Name}, ..."
  if (row.message) {
    const m = String(row.message).match(/Hello\s+([^,]+),/i);
    if (m && m[1]) {
      const name = m[1].trim();
      if (name) return name;
    }
  }

  // PMO templates: try to derive a combined name from Husband/Wife lines
  if (row.message) {
    const text = String(row.message);
    const husbandMatch = text.match(/Husband:\s*([^\n]+)/i);
    const wifeMatch = text.match(/Wife:\s*([^\n]+)/i);
    const husband = husbandMatch && husbandMatch[1] ? husbandMatch[1].trim() : '';
    const wife = wifeMatch && wifeMatch[1] ? wifeMatch[1].trim() : '';
    const combined = [husband, wife].filter(Boolean).join(' & ');
    if (combined) return combined;
  }

  // Fallback to raw recipient (phone number) if nothing else is available
  if (row.recipient) {
    return row.recipient;
  }

  return '—';
}

function PmoSmsLogs() {
  const outletContext = useOutletContext?.() || {};
  const { setSmsFailed } = outletContext;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [eventFilter, setEventFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [autoRefreshSecondsLeft, setAutoRefreshSecondsLeft] = useState(() => {
    // Initialize countdown based on last refresh time stored in localStorage
    if (typeof window === 'undefined') return REFRESH_INTERVAL_SECONDS;
    try {
      const stored = Number(window.localStorage.getItem(REFRESH_STORAGE_KEY) || '0');
      if (!stored) return REFRESH_INTERVAL_SECONDS;
      const now = Date.now();
      const elapsed = Math.floor((now - stored) / 1000);
      if (elapsed >= REFRESH_INTERVAL_SECONDS || elapsed < 0) return 0;
      return REFRESH_INTERVAL_SECONDS - elapsed;
    } catch {
      return REFRESH_INTERVAL_SECONDS;
    }
  });
  const [resendLoading, setResendLoading] = useState(false);

  const fetchLogs = async (pageNum, currentEventFilter, currentStatusFilter) => {
    setLoading(true);
    try {
      const params = {
        page: pageNum,
        limit
      };

      if (currentEventFilter) params.eventType = currentEventFilter;
      if (currentStatusFilter) params.status = currentStatusFilter;

      const res = await getPmoSmsLogs(params);
      setItems(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page, eventFilter, statusFilter).catch(() => {});
  }, [page, eventFilter, statusFilter]);

  // Auto-refresh timer: every 15 minutes refresh the current page
  useEffect(() => {
    const interval = setInterval(() => {
      setAutoRefreshSecondsLeft((prev) => {
        if (prev <= 1) {
          // Trigger a refresh when countdown hits zero
          fetchLogs(page, eventFilter, statusFilter).catch(() => {});
          try {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(REFRESH_STORAGE_KEY, String(Date.now()));
            }
          } catch {
            // ignore storage failures
          }
          return REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [page, eventFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const eventOptions = useMemo(
    () =>
      ALL_EVENT_TYPES.map((v) => ({
        value: v,
        label: v
      })),
    []
  );

  const statusOptions = useMemo(
    () => [
      { value: 'SENT', label: 'SENT' },
      { value: 'FAILED', label: 'FAILED' }
    ],
    []
  );

  const handleResend = async () => {
    if (!viewRow || !viewRow.id) return;
    setResendLoading(true);
    try {
      const res = await resendPmoSmsLog(viewRow.id);
      // After re-send, refresh the list so the latest status appears
      await fetchLogs(page, eventFilter, statusFilter);

      // If the resend succeeded and we have access to setSmsFailed from the
      // admin layout, refresh the failed-SMS counter immediately so the badge
      // updates in real time without waiting for the 30s interval.
      if (res?.data?.success && typeof setSmsFailed === 'function') {
        try {
          const failedRes = await getPmoSmsFailedCount();
          const count = failedRes.data?.data?.count ?? 0;
          setSmsFailed(count);
        } catch (e) {
          // ignore counter refresh errors; UI will still update on next interval
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setViewOpen(false);
      setViewRow(null);
      setResendLoading(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>SMS Logs</Title>
        <Group gap="xs" align="center">
          <Select
            placeholder="Filter by event"
            data={eventOptions}
            value={eventFilter || null}
            onChange={(v) => {
              setPage(1);
              setEventFilter(v || '');
            }}
            clearable
            size="xs"
            w={260}
          />
          <Select
            placeholder="Filter by status"
            data={statusOptions}
            value={statusFilter || null}
            onChange={(v) => {
              setPage(1);
              setStatusFilter(v || '');
            }}
            clearable
            size="xs"
            w={160}
          />
        </Group>
      </Group>

      {loading ? (
        <Center py="lg"><Loader/></Center>
      ) : items.length === 0 ? (
        <Text size="sm" c="dimmed">No SMS logs found.</Text>
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
              <Table.Th style={{ textAlign: 'center', minWidth: 150 }}>Time</Table.Th>
              <Table.Th>Recipient</Table.Th>
              <Table.Th>Event Type</Table.Th>
              <Table.Th style={{ textAlign: 'center', minWidth: 90 }}>Status</Table.Th>
              <Table.Th>Message</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((row, index) => {
              const rowNumber = (page - 1) * limit + index + 1;
              return (
                <Table.Tr key={row.id}>
                  <Table.Td>{rowNumber}</Table.Td>
                  <Table.Td>{row.createdAt ? dayjs(row.createdAt).format('MMM D, YYYY h:mm A') : '—'}</Table.Td>
                  <Table.Td>{getRecipientDisplay(row)}</Table.Td>
                  <Table.Td>{row.eventType}</Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge color={row.success ? 'green' : 'red'}>{row.success ? 'SENT' : 'FAILED'}</Badge>
                  </Table.Td>
                  <Table.Td style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.message}</Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="light" onClick={() => { setViewRow(row); setViewOpen(true); }}>
                      View
                    </Button>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={viewOpen}
        onClose={() => { setViewOpen(false); setViewRow(null); }}
        title="SMS Log Details"
        centered
        size="lg"
      >
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={600}>Time</Text>
              <Text size="sm">{viewRow?.createdAt ? dayjs(viewRow.createdAt).format('MMM D, YYYY h:mm A') : '—'}</Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text fw={600}>Status</Text>
              <Badge color={viewRow?.success ? 'green' : 'red'}>{viewRow?.success ? 'SENT' : 'FAILED'}</Badge>
            </div>
          </Group>
          <Divider />
          <Text size="sm"><b>Recipient:</b> {getRecipientDisplay(viewRow)}</Text>
          <Text size="sm"><b>Event:</b> {viewRow?.eventType || '—'}</Text>
          {viewRow?.errorMessage ? (
            <Text size="sm" c="red"><b>Error:</b> {viewRow.errorMessage}</Text>
          ) : null}
          <Text size="sm"><b>Message:</b></Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{viewRow?.message || '—'}</Text>
          {!viewRow?.success && (
            <Group justify="flex-end" mt="sm">
              <Button size="xs" loading={resendLoading} onClick={handleResend}>
                Re-send SMS
              </Button>
            </Group>
          )}
        </Stack>
      </Modal>

      {items.length > 0 && (
        <Group justify="flex-end">
          <Pagination value={page} onChange={setPage} total={totalPages} size="sm" radius="md"/>
        </Group>
      )}
    </Stack>
  );
}

// Support both default and named imports (for older bundles or builds)
export { PmoSmsLogs };
export default PmoSmsLogs;
