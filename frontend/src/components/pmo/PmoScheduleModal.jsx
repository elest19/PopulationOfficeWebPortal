import React from 'react';
import { ActionIcon, Badge, Box, Button, Group, Modal, Radio, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function PmoScheduleModal({
  opened,
  onClose,
  onNext,
  month,
  setMonth,
  loading,
  schedules,
  visibleSchedules,
  selectedScheduleId,
  onSelectSchedule,
}) {
  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId) || null;

  const handleContinue = () => {
    if (!selectedScheduleId) return;
    if (onNext) onNext();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      radius="lg"
      padding="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      withCloseButton={false}
    >
      <div className="card border-0 shadow-lg" style={{ borderRadius: '0.75rem' }}>
        {/* Header: step label + title (Bootstrap-style spacing) */}
        <div className="card-header bg-white border-0 px-4 pt-3 pb-0">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <div className="text-uppercase small text-muted fw-semibold mb-1">Step 1 of 3</div>
              <h5 className="mb-0 fw-bold">Select Schedule</h5>
            </div>
          </div>
        </div>

        {/* Body: month controls + list + summary */}
        <div className="card-body px-4 pt-3 pb-3">
          <div className="d-flex justify-content-center align-items-center gap-2 mb-3">
            <ActionIcon
              variant="default"
              onClick={() => setMonth((prev) => dayjs(prev).add(-1, 'month').toDate())}
            >
              {'<'}
            </ActionIcon>
            <Text fw={600}>{dayjs(month).format('MMMM YYYY')}</Text>
            <ActionIcon
              variant="default"
              onClick={() => setMonth((prev) => dayjs(prev).add(1, 'month').toDate())}
            >
              {'>'}
            </ActionIcon>
            <Button size="xs" variant="light" onClick={() => setMonth(new Date())}>
              Today
            </Button>
          </div>

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
                  onSelectSchedule(found);
                }}
              >
                <Stack>
                  {visibleSchedules.map((s) => (
                    <div
                      key={s.id}
                      className={`card mb-2 border-1 ${
                        selectedScheduleId === s.id ? 'border-primary bg-primary-subtle' : ''
                      }`}
                      style={{ cursor: 'pointer', transition: 'background 120ms ease, border-color 120ms ease' }}
                      onClick={() => {
                        onSelectSchedule(s);
                      }}
                    >
                      <div className="card-body py-2 px-3">
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
                      </div>
                    </div>
                  ))}
                </Stack>
              </Radio.Group>
            </Box>
          )}

          {selectedSchedule && (
            <div className="card border-0 bg-light mt-3">
              <div className="card-body py-2 px-3">
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
              </div>
            </div>
          )}
        </div>

        {/* Footer: Close + Next Step (Bootstrap-like bar) */}
        <div className="card-footer bg-white border-0 px-4 py-3 d-flex justify-content-between align-items-center">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Close
          </Button>
          <Button disabled={!selectedScheduleId} onClick={handleContinue}>
            Next Step
          </Button>
        </div>
      </div>
    </Modal>
  );
}
