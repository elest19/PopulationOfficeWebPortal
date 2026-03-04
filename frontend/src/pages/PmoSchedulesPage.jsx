import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionIcon, Badge, Box, Button, Card, Group, Radio, Stack, Text, Title } from '@mantine/core';
import dayjs from 'dayjs';

import { usePmoBooking } from '../context/PmoBookingContext.jsx';
import { getPmoAvailableSchedules } from '../api/pmo.js';
import { ServiceLayout } from './services/ServiceLayout.jsx';
import { PmoBookingModal } from '../components/pmo/PmoBookingModal.jsx';
import { PmoScheduleModal } from '../components/pmo/PmoScheduleModal.jsx';

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function PmoSchedulesPage() {
  const navigate = useNavigate();
  const { draft, updateDraft } = usePmoBooking();

  const [month, setMonth] = useState(new Date());

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPmoAvailableSchedules()
      .then((res) => {
        const items = res.data.data || [];
        const mapped = items.map((r) => {
          const dateStr = new Date(r.date).toISOString().slice(0, 10);
          const start = String(r.start_time).slice(0, 5);
          return {
            id: String(r.id),
            date: `${dateStr}T${start}:00`,
            place: r.description || 'Municipal Hall – PMO Room',
            counselor: r.counselor_name || 'Assigned counselor'
          };
        });
        setSchedules(mapped);
      })
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleSchedules = useMemo(() => {
    const m = dayjs(month);
    return schedules.filter((s) => dayjs(s.date).isSame(m, 'month'));
  }, [month, schedules]);

  const selectedScheduleId = draft.schedule?.id || null;

  const selectedSchedule = useMemo(
    () => schedules.find((s) => s.id === selectedScheduleId) || null,
    [schedules, selectedScheduleId]
  );

  return (
    <ServiceLayout title="Available Schedules" showBack={false}>
      <Stack spacing="lg">

      <Group justify="center" gap="xs">
        <ActionIcon variant="default" onClick={() => setMonth((prev) => dayjs(prev).add(-1, 'month').toDate())}>
          {'<'}
        </ActionIcon>
        <Text fw={600}>{dayjs(month).format('MMMM YYYY')}</Text>
        <ActionIcon variant="default" onClick={() => setMonth((prev) => dayjs(prev).add(1, 'month').toDate())}>
          {'>'}
        </ActionIcon>
        <Button size="xs" variant="light" onClick={() => setMonth(new Date())}>
          Today
        </Button>
      </Group>

      {loading ? (
        <Text c="dimmed">Loading schedules...</Text>
      ) : schedules.length === 0 ? (
        <Text c="dimmed">No available schedules at the moment.</Text>
      ) : (
        <Box style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
          <Radio.Group
            value={selectedScheduleId}
            onChange={(value) => {
              const found = schedules.find((s) => s.id === value) || null;
              updateDraft({ schedule: found });
            }}
          >
            <Stack>
              {visibleSchedules.map((s) => (
                <Card
                  key={s.id}
                  withBorder
                  radius="md"
                  padding="md"
                  style={{
                    borderColor: selectedScheduleId === s.id ? 'var(--mantine-color-blue-6)' : undefined,
                    background: selectedScheduleId === s.id ? 'var(--mantine-color-blue-0)' : undefined,
                    transition: 'background 120ms ease, border-color 120ms ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    updateDraft({ schedule: s });
                  }}
                >
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text fw={600}>{formatDateTime(s.date)}</Text>
                      <Text size="sm" c="dimmed">
                        {s.place}
                      </Text>
                      <Text size="sm">Assigned counselor: {s.counselor}</Text>
                    </Stack>
                    <Radio value={s.id} aria-label={`Select schedule ${formatDateTime(s.date)}`} />
                  </Group>
                </Card>
              ))}
            </Stack>
          </Radio.Group>
        </Box>
      )}

      {selectedSchedule && (
        <Card withBorder radius="md" p="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Group gap="xs">
                <Badge color="blue" variant="light">
                  Selected schedule
                </Badge>
                <Text fw={600}>{formatDateTime(selectedSchedule.date)}</Text>
              </Group>
              <Text size="sm">{selectedSchedule.place}</Text>
              <Text size="sm" c="dimmed">
                Counselor: {selectedSchedule.counselor}
              </Text>
            </Stack>
          </Group>
        </Card>
      )}

      <Group justify="space-between" mt="sm">
        <Button variant="default" onClick={() => navigate('/services')}>
          Back to Services
        </Button>
        <Button disabled={!selectedScheduleId} onClick={() => setScheduleOpen(true)}>
          Continue
        </Button>
      </Group>
      </Stack>

      <PmoScheduleModal
        opened={scheduleOpen}
        onClose={() => {
          setScheduleOpen(false);
          navigate('/services');
        }}
        onNext={() => {
          setScheduleOpen(false);
          setBookingOpen(true);
        }}
        month={month}
        setMonth={setMonth}
        loading={loading}
        schedules={schedules}
        visibleSchedules={visibleSchedules}
        selectedScheduleId={selectedScheduleId}
        onSelectSchedule={(s) => updateDraft({ schedule: s })}
      />

      <PmoBookingModal
        opened={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onNext={() => {
          setBookingOpen(false);
          navigate('/pmo/questionnaire');
        }}
      />
    </ServiceLayout>
  );
}
