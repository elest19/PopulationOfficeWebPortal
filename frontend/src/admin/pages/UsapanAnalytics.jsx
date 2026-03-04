import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Title, Group, Card, Text, Select, Loader, Center, Paper, Grid, Switch } from '@mantine/core';
import { PieChart, BarChart } from '@mantine/charts';
import dayjs from 'dayjs';

import { getCalendarEvents } from '../../api/calendar.js';
import { getAllAppointments } from '../../api/appointments.js';

export function UsapanAnalytics() {
  const [month, setMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showSchedulesMonthlyView, setShowSchedulesMonthlyView] = useState(true);
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);

  const fetchData = async (targetMonth) => {
    setLoading(true);
    try {
      // For analytics, load the full year that contains the selected month,
      // so we can compute schedules per month and per year similar to PMO.
      const start = dayjs(targetMonth).startOf('year').toISOString();
      const end = dayjs(targetMonth).endOf('year').toISOString();
      const [calendarRes, appointmentsRes] = await Promise.all([
        getCalendarEvents({ start, end }),
        getAllAppointments()
      ]);

      const allEvents = calendarRes.data.data || [];
      const onlyUsapan = allEvents.filter((e) => e && e.type === 'Usapan-Series');
      setEvents(onlyUsapan);

      const allAppointments = appointmentsRes?.data?.data || [];
      const usapanRequests = allAppointments.filter((a) => a && a.service_slug === 'usapan-series');
      setRequests(usapanRequests);
    } catch (err) {
      console.error(err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(month).catch(() => {});
  }, [month]);

  const summary = useMemo(() => {
    const total = events.length;

    const counts = {
      pending: 0,
      scheduled: 0,
      ongoing: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0
    };

    events.forEach((e) => {
      const status = String(e.status || '').trim().toUpperCase();
      if (status === 'PENDING') counts.pending += 1;
      else if (status === 'SCHEDULED') counts.scheduled += 1;
      else if (status === 'ONGOING') counts.ongoing += 1;
      else if (status === 'COMPLETED') counts.completed += 1;
      else if (status === 'REJECTED') counts.rejected += 1;
      else if (status === 'CANCELLED') counts.cancelled += 1;
    });

    return { total, ...counts };
  }, [events]);

  const scheduleStatusSummary = useMemo(() => {
    const rows = events || [];
    const summary = {
      pending: 0,
      scheduled: 0,
      ongoing: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0
    };

    rows.forEach((e) => {
      const status = String(e.status || '').trim().toUpperCase();
      if (status === 'PENDING') summary.pending += 1;
      else if (status === 'SCHEDULED') summary.scheduled += 1;
      else if (status === 'ONGOING') summary.ongoing += 1;
      else if (status === 'COMPLETED') summary.completed += 1;
      else if (status === 'REJECTED') summary.rejected += 1;
      else if (status === 'CANCELLED') summary.cancelled += 1;
    });

    return summary;
  }, [events]);

  const scheduleStatusPieData = useMemo(() => {
    const { pending, scheduled, ongoing, completed, rejected, cancelled } = scheduleStatusSummary;
    const total = pending + scheduled + ongoing + completed + rejected + cancelled;
    if (!total) return [];

    const pct = (value) => (value / total) * 100;
    const data = [];
    if (pending) data.push({ name: 'Pending', value: pct(pending), color: 'yellow.6' });
    if (scheduled) data.push({ name: 'Scheduled', value: pct(scheduled), color: 'blue.6' });
    if (ongoing) data.push({ name: 'Ongoing', value: pct(ongoing), color: 'orange.6' });
    if (completed) data.push({ name: 'Completed', value: pct(completed), color: 'teal.6' });
    if (rejected) data.push({ name: 'Rejected', value: pct(rejected), color: 'red.6' });
    if (cancelled) data.push({ name: 'Cancelled', value: pct(cancelled), color: 'gray.6' });
    return data;
  }, [scheduleStatusSummary]);

  const schedulesMonthlyData = useMemo(() => {
    const counts = {};
    (events || []).forEach((e) => {
      const d = dayjs(e.startDate || e.dateStr || e.date);
      if (!d.isValid()) return;
      const key = d.format('YYYY-MM');
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, count]) => ({ month: dayjs(key + '-01').format('MMM YYYY'), count }));
  }, [events]);

  const schedulesYearlyData = useMemo(() => {
    const counts = {};
    (events || []).forEach((e) => {
      const d = dayjs(e.startDate || e.dateStr || e.date);
      if (!d.isValid()) return;
      const key = d.format('YYYY');
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([year, count]) => ({ year, count }));
  }, [events]);

  const requestStatusSummary = useMemo(() => {
    const rows = requests || [];
    const summary = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      completed: 0
    };

    rows.forEach((r) => {
      const status = String(r.status || '').trim().toUpperCase();
      if (status === 'PENDING') summary.pending += 1;
      else if (status === 'APPROVED') summary.approved += 1;
      else if (status === 'REJECTED') summary.rejected += 1;
      else if (status === 'CANCELLED') summary.cancelled += 1;
      else if (status === 'COMPLETED') summary.completed += 1;
    });

    return summary;
  }, [requests]);

  const requestStatusPieData = useMemo(() => {
    const { pending, approved, rejected, cancelled, completed } = requestStatusSummary;
    const total = pending + approved + rejected + cancelled + completed;
    if (!total) return [];

    const pct = (value) => (value / total) * 100;
    const data = [];
    if (pending) data.push({ name: 'Pending', value: pct(pending), color: 'yellow.6' });
    if (approved) data.push({ name: 'Approved', value: pct(approved), color: 'green.6' });
    if (rejected) data.push({ name: 'Rejected', value: pct(rejected), color: 'red.6' });
    if (cancelled) data.push({ name: 'Cancelled', value: pct(cancelled), color: 'gray.6' });
    if (completed) data.push({ name: 'Completed', value: pct(completed), color: 'blue.6' });
    return data;
  }, [requestStatusSummary]);

  const topBarangays = useMemo(() => {
    const counts = {};
    events.forEach((e) => {
      const b = (e.location || '').trim();
      if (!b) return;
      counts[b] = (counts[b] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [events]);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Usapan-Series - Data Analytics</Title>
      </Group>

      {loading ? (
        <Center py="lg"><Loader /></Center>
      ) : (
        <>
          <Group align="stretch" mb="sm">
            {/* Total schedules - neutral blue/gray */}
            <Card
              withBorder
              radius="md"
              style={{
                flex: 1,
                backgroundColor: '#e5edff', // very light blue
                borderColor: '#2563EB',
              }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="#6B7280">Total Schedules</Text>
              <Text fw={900} size="xl" c="#697381ff">{summary.total}</Text>
            </Card>

            {/* Completed - green */}
            <Card
              withBorder
              radius="md"
              style={{
                flex: 1,
                backgroundColor: '#dcfce7',
                borderColor: '#16A34A',
              }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="#166534">Completed</Text>
              <Text fw={900} size="xl" c="#166534">{summary.completed}</Text>
            </Card>

            {/* Scheduled - blue */}
            <Card
              withBorder
              radius="md"
              style={{
                flex: 1,
                backgroundColor: '#dbeafe',
                borderColor: '#2563EB',
              }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="#1d4ed8">Approved</Text>
              <Text fw={900} size="xl" c="#1d4ed8">{summary.scheduled}</Text>
            </Card>

            {/* Pending - amber/orange */}
            <Card
              withBorder
              radius="md"
              style={{
                flex: 1,
                backgroundColor: '#fef3c7',
                borderColor: '#F59E0B',
              }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="#92400e">Pending</Text>
              <Text fw={900} size="xl" c="#92400e">{summary.pending}</Text>
            </Card>

            {/* Rejected - red */}
            <Card
              withBorder
              radius="md"
              style={{
                flex: 1,
                backgroundColor: '#fee2e2',
                borderColor: '#DC2626',
              }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="#b91c1c">Rejected</Text>
              <Text fw={900} size="xl" c="#b91c1c">{summary.rejected}</Text>
            </Card>

            {/* Cancelled - muted gray */}
            <Card
              withBorder
              radius="md"
              style={{
                flex: 1,
                backgroundColor: '#f3f4f6',
                borderColor: '#9CA3AF',
              }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="#4b5563">Cancelled</Text>
              <Text fw={900} size="xl" c="#4b5563">{summary.cancelled}</Text>
            </Card>
          </Group>

          {/* Schedules: status pie + per month + per year */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper withBorder p="md" radius="md" h="100%">
                <Text fw={600} mb="lg">Schedule Status</Text>
                {scheduleStatusPieData.length > 0 ? (
                  <div className="d-flex align-items-center gap-4" style={{ flex: 1, paddingLeft: '40px' }}>
                    <PieChart
                      h={240}
                      withLabels
                      labelsPosition="inside"
                      labelsType="percent"
                      data={scheduleStatusPieData}
                    />
                    <div className="d-flex flex-column" style={{ fontSize: '0.9rem', minWidth: 120 }}>
                      <span className="mb-1" style={{ fontWeight: 600 }}>Legends</span>
                      {scheduleStatusPieData.map((item) => {
                        const cssVar = `var(--mantine-color-${item.color.replace('.', '-')})`;
                        return (
                          <div key={item.name} className="d-flex align-items-center mb-1">
                            <span
                              style={{
                                display: 'inline-block',
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: cssVar,
                                marginRight: 6
                              }}
                            />
                            <span style={{ fontWeight: 500 }}>{item.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <Center h={200}><Text c="dimmed">No status data</Text></Center>
                )}
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 8 }}>
              <Paper withBorder p="md" radius="md" h="100%">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <Text fw={600}>Schedules</Text>
                    <Text size="xs" c="dimmed">
                      {showSchedulesMonthlyView ? 'Schedules per month' : 'Schedules per year'}
                    </Text>
                  </div>
                  <Switch
                    size="lg"
                    checked={!showSchedulesMonthlyView}
                    onChange={(event) =>
                      setShowSchedulesMonthlyView(!event.currentTarget.checked ? true : false)
                    }
                    onLabel="Year"
                    offLabel="Month"
                  />
                </div>

                {showSchedulesMonthlyView ? (
                  schedulesMonthlyData.length > 0 ? (
                    <BarChart
                      h={240}
                      data={schedulesMonthlyData}
                      dataKey="month"
                      series={[{ name: 'count', color: 'blue.6' }]}
                    />
                  ) : (
                    <Center h={200}><Text c="dimmed">No monthly schedule data</Text></Center>
                  )
                ) : schedulesYearlyData.length > 0 ? (
                  <BarChart
                    h={260}
                    data={schedulesYearlyData}
                    dataKey="year"
                    series={[{ name: 'count', color: 'blue.6' }]}
                  />
                ) : (
                  <Center h={200}><Text c="dimmed">No yearly schedule data</Text></Center>
                )}
              </Paper>
            </Grid.Col>

          </Grid>
        </>
      )}
    </Stack>
  );
}
