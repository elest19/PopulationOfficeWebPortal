import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Title, Text, Group, Paper, Loader, Center, Grid, Switch } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

import { BarChart, PieChart } from '@mantine/charts';

import dayjs from 'dayjs';

import { getPmoAdminAnalytics } from '../../api/pmoAdmin.js';

export function PmoAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showAppointmentsMonthlyView, setShowAppointmentsMonthlyView] = useState(true);
  const [showSchedulesMonthlyView, setShowSchedulesMonthlyView] = useState(true);

  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    setLoading(true);
    getPmoAdminAnalytics()
      .then((res) => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  // Prepare datasets for separate charts
  const schedulesMonthlyData = (data?.schedulesMonthly || []).map((r) => ({
    month: dayjs(r.month).format('MMM YYYY'),
    count: r.count,
  }));
  const appointmentsMonthlyData = (data?.appointmentsMonthly || []).map((r) => ({
    month: dayjs(r.month).format('MMM YYYY'),
    count: r.count,
  }));
  const schedulesYearlyData = (data?.schedulesYearly || []).map((r) => ({
    year: dayjs(r.year).format('YYYY'),
    count: r.count,
  }));
  const appointmentsYearlyData = (data?.appointmentsYearly || []).map((r) => ({
    year: dayjs(r.year).format('YYYY'),
    count: r.count,
  }));

  const appointmentStatusSummary = useMemo(() => {
    const rows = data?.appointmentStatusCounts || [];
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let cancelled = 0;

    rows.forEach((r) => {
      const status = String(r.status || '').trim().toUpperCase();
      const count = r.count || 0;
      if (status === 'PENDING') pending += count;
      else if (status === 'APPROVED') approved += count;
      else if (status === 'REJECTED') rejected += count;
      else if (status === 'CANCELLED') cancelled += count;
    });

    return { pending, approved, rejected, cancelled };
  }, [data]);

  const appointmentStatusPieData = useMemo(() => {
    const { pending, approved, rejected, cancelled } = appointmentStatusSummary;
    const total = pending + approved + rejected + cancelled;
    if (!total) return [];

    const pct = (value) => (value / total) * 100;
    return [
      { name: 'Pending', value: pct(pending), color: 'yellow.6' },
      { name: 'Approved', value: pct(approved), color: 'green.6' },
      { name: 'Rejected', value: pct(rejected), color: 'red.6' },
      { name: 'Cancelled', value: pct(cancelled), color: 'gray.6' }
    ];
  }, [appointmentStatusSummary]);

  const scheduleStatusSummary = useMemo(() => {
    const rows = data?.scheduleStatusCounts || [];
    let upcoming = 0;
    let finished = 0;
    let cancelled = 0;

    rows.forEach((r) => {
      const status = String(r.status || '').trim().toUpperCase();
      if (status === 'SCHEDULED') {
        upcoming += r.count || 0;
      } else if (status === 'COMPLETED') {
        finished += r.count || 0;
      } else if (status === 'CANCELLED') {
        cancelled += r.count || 0;
      }
    });

    const summary = { upcoming, finished, cancelled };
    return summary;
  }, [data]);

  const scheduleStatusPieData = useMemo(() => {
    const { upcoming, finished, cancelled } = scheduleStatusSummary;
    const total = upcoming + finished + cancelled;
    if (!total) return [];
    const pct = (value) => (value / total) * 100;
    return [
      { name: 'Upcoming', value: pct(upcoming), color: 'blue.6' },
      { name: 'Finished', value: pct(finished), color: 'teal.6' },
      { name: 'Cancelled', value: pct(cancelled), color: 'gray.6' }
    ];
  }, [scheduleStatusSummary]);

  const counselorsCount = data?.counselorsCount || 0;

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={isMobile ? 3 : 2} fz={isMobile ? '1.4rem' : '1.8rem'}>
          PMO - Data Analytics
        </Title>
        <Text c="dimmed" size={isMobile ? 'sm' : 'md'}>
          Key performance indicators and orientation trends.
        </Text>
      </Stack>

      {loading ? (
        <Center h={300}>
          <Loader size="md" />
        </Center>
      ) : !data ? (
        <Text size="sm" c="dimmed">No analytics data available.</Text>
      ) : (
        <Stack gap="md">
          {/* Appointments overview */}
          <Stack gap="xs">
            <Text fw={600} size={isMobile ? 'sm' : 'md'}>Appointments Overview</Text>
            <Group grow>

              {/* Total bookings - neutral blue/gray */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#e5edff',
                  borderColor: '#2563EB',
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="#6B7280">Total bookings</Text>
                <Text fw={700} size={isMobile ? 'md' : 'xl'} c="#4B5563">{data.totalBookings}</Text>
              </Paper>

              {/* Pending - amber */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#fef9c3',
                  borderColor: '#F59E0B',
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="#92400e">Pending</Text>
                <Text fw={700} size={isMobile ? 'md' : 'xl'} c="#92400e">{appointmentStatusSummary.pending}</Text>
              </Paper>

              {/* Approved - green */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#dcfce7',
                  borderColor: '#16A34A',
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="#166534">Approved</Text>
                <Text fw={700} size={isMobile ? 'md' : 'xl'} c="#166534">{appointmentStatusSummary.approved}</Text>
              </Paper>

              {/* Rejected - red */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#fee2e2',
                  borderColor: '#DC2626',
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="#b91c1c">Rejected</Text>
                <Text fw={700} size={isMobile ? 'md' : 'xl'} c="#b91c1c">{appointmentStatusSummary.rejected}</Text>
              </Paper>

              {/* Cancelled - muted gray */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#f3f4f6',
                  borderColor: '#9CA3AF',
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="#4b5563">Cancelled</Text>
                <Text fw={700} size={isMobile ? 'md' : 'xl'} c="#4b5563">{appointmentStatusSummary.cancelled}</Text>
              </Paper>
            </Group>
          </Stack>

          {/* Appointment statuses + Appointments per month/year */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper withBorder p="md" radius="md" h="100%">
                <Text fw={600} size={isMobile ? 'sm' : 'md'} mb="lg">Appointment Status</Text>

                {appointmentStatusPieData.length > 0 ? (
                  <div className="d-flex align-items-center gap-4" style={{ flex: 1, paddingLeft: '50px' }}>
                    <PieChart
                      h={isMobile ? 220 : 260}
                      withLabels
                      labelsPosition="inside"
                      labelsType="percent"
                      data={appointmentStatusPieData}
                    />
                    <div className="d-flex flex-column" style={{ fontSize: isMobile ? '0.8rem' : '0.9rem', minWidth: 120 }}>

                      <span className="mb-1" style={{ fontWeight: 600 }}>Legends</span>
                      {appointmentStatusPieData.map((item) => {
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
                    <Text fw={600} size={isMobile ? 'sm' : 'md'}>Appointments</Text>
                    <Text size={isMobile ? 'xs' : 'sm'} c="dimmed">
                      {showAppointmentsMonthlyView ? 'Appointments per month' : 'Appointments per year'}
                    </Text>
                  </div>
                  <Switch
                    size="lg"
                    checked={!showAppointmentsMonthlyView}
                    onChange={(event) =>
                      setShowAppointmentsMonthlyView(!event.currentTarget.checked ? true : false)
                    }
                    onLabel="Year"
                    offLabel="Month"
                  />
                </div>

                {showAppointmentsMonthlyView ? (
                  appointmentsMonthlyData.length > 0 ? (
                    <BarChart
                      h={isMobile ? 220 : 260}
                      data={appointmentsMonthlyData}
                      dataKey="month"
                      series={[{ name: 'count', color: 'green.6' }]}
                    />
                  ) : (
                    <Center h={200}><Text c="dimmed">No monthly appointment data</Text></Center>
                  )
                ) : appointmentsYearlyData.length > 0 ? (
                  <BarChart
                    h={isMobile ? 220 : 260}
                    data={appointmentsYearlyData}
                    dataKey="year"
                    series={[{ name: 'count', color: 'green.6' }]}
                  />
                ) : (
                  <Center h={200}><Text c="dimmed">No yearly appointment data</Text></Center>
                )}
              </Paper>
            </Grid.Col>
          </Grid>

          {/* Schedules overview */}
          <Stack gap="xs">
            <Text fw={600} size={isMobile ? 'sm' : 'md'}>Schedules Overview</Text>
            <Group grow>

              {/* Total schedules - neutral blue/gray */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#e5edff',
                  borderColor: '#2563EB',
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="#6B7280">Total schedules</Text>
                <Text fw={700} size={isMobile ? 'md' : 'xl'} c="#4B5563">
                  {scheduleStatusSummary.upcoming + scheduleStatusSummary.finished + scheduleStatusSummary.cancelled}
                </Text>
              </Paper>

              {/* Finished - green */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#dcfce7',
                  borderColor: '#16A34A',
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="#166534">Finished</Text>
                <Text fw={700} size={isMobile ? 'md' : 'xl'} c="#166534">{scheduleStatusSummary.finished}</Text>
              </Paper>

              {/* Upcoming - pending/upcoming (amber) */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#fef9c3',
                  borderColor: '#F59E0B',
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="#92400e">Upcoming</Text>
                <Text fw={700} size={isMobile ? 'md' : 'xl'} c="#92400e">{scheduleStatusSummary.upcoming}</Text>
              </Paper>

              {/* Cancelled - muted gray */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#f3f4f6',
                  borderColor: '#9CA3AF',
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="#4b5563">Cancelled</Text>
                <Text fw={700} size={isMobile ? 'md' : 'xl'} c="#4b5563">{scheduleStatusSummary.cancelled}</Text>
              </Paper>
            </Group>
          </Stack>

        </Stack>
      )}
    </Stack>
  );
}