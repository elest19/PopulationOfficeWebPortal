import React, { useEffect, useMemo, useState } from 'react';
import { Text, Loader, Center, Paper, Stack, Title, Group, Card, Switch } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { BarChart, PieChart } from '@mantine/charts';
import dayjs from 'dayjs';
import { showNotification } from '@mantine/notifications';

import { getFeedbackAnalytics } from '../../api/feedback.js';
import { getUsersAnalytics } from '../../api/users.js';
import { getFamilyPlanningAnalytics } from '../../api/familyPlanning.js';

export function GeneralAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: 0, totalFeedback: 0 });
  const [barangayData, setBarangayData] = useState([]);
  const [feedbackMonthly, setFeedbackMonthly] = useState([]);
  const [feedbackYearly, setFeedbackYearly] = useState([]);
  const [clientFeedbackMonthly, setClientFeedbackMonthly] = useState([]);
  const [clientFeedbackYearly, setClientFeedbackYearly] = useState([]);
  const [usersMonthly, setUsersMonthly] = useState([]);
  const [feedbackByBarangayMonthly, setFeedbackByBarangayMonthly] = useState([]);
  const [fpMonthly, setFpMonthly] = useState([]);
  const [fpYearly, setFpYearly] = useState([]);
  const [fpStatusCounts, setFpStatusCounts] = useState({ Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 });
  const [showFeedbackMonthlyView, setShowFeedbackMonthlyView] = useState(true);
  const [showFeedbackByBarangayView, setShowFeedbackByBarangayView] = useState(true);
  const [showFpMonthlyView, setShowFpMonthlyView] = useState(true);

  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getUsersAnalytics(),
      getFeedbackAnalytics(),
      getFamilyPlanningAnalytics()
    ])
      .then(([usersRes, fbRes, fpRes]) => {
        if (!active) return;
        const u = usersRes?.data?.data || {};
        const f = fbRes?.data?.data || {};
        const fp = fpRes?.data?.data || {};
        setStats({ totalUsers: u.totalUsers || 0, totalFeedback: f.totalFeedback || 0 });
        setBarangayData((u.accountsPerBarangay || []).map((r) => ({ barangay: r.barangay, count: r.count })));
        const fbMonthlyRows = f.feedbackMonthly || [];
        setFeedbackMonthly(fbMonthlyRows.map((r) => ({ month: dayjs(r.month).format('MMM YYYY'), count: r.count })));
        // Aggregate system feedback by year for yearly chart
        const fbYearMap = {};
        fbMonthlyRows.forEach((r) => {
          const year = dayjs(r.month).format('YYYY');
          fbYearMap[year] = (fbYearMap[year] || 0) + (r.count || 0);
        });
        const fbYearlyData = Object.entries(fbYearMap).map(([year, count]) => ({ year, count }));
        setFeedbackYearly(fbYearlyData);

        // Client feedback (from ClientSatisfactionFeedback)
        const clientMonthlyRows = f.clientFeedbackMonthly || [];
        setClientFeedbackMonthly(
          clientMonthlyRows.map((r) => ({ month: dayjs(r.month).format('MMM YYYY'), count: r.count }))
        );
        const clientYearMap = {};
        clientMonthlyRows.forEach((r) => {
          const year = dayjs(r.month).format('YYYY');
          clientYearMap[year] = (clientYearMap[year] || 0) + (r.count || 0);
        });
        const clientYearlyData = Object.entries(clientYearMap).map(([year, count]) => ({ year, count }));
        setClientFeedbackYearly(clientYearlyData);
        setUsersMonthly((u.usersMonthly || []).map((r) => ({ month: dayjs(r.month).format('MMM YYYY'), count: r.count })));
        setFeedbackByBarangayMonthly(f.feedbackByBarangayMonthly || []);

        const monthlyRows = fp.monthly || [];
        const monthlyMapped = monthlyRows.map((r) => ({
          month: dayjs(r.month).format('MMM YYYY'),
          count: r.count
        }));
        setFpMonthly(monthlyMapped);

        // Aggregate by year for yearly chart
        const yearMap = {};
        monthlyRows.forEach((r) => {
          const year = dayjs(r.month).format('YYYY');
          yearMap[year] = (yearMap[year] || 0) + (r.count || 0);
        });
        const yearlyData = Object.entries(yearMap).map(([year, count]) => ({ year, count }));
        setFpYearly(yearlyData);

        const statusRaw = fp.statusCounts || [];
        const statusMap = { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 };
        statusRaw.forEach((row) => {
          const key = String(row.status || '').trim();
          if (key && Object.prototype.hasOwnProperty.call(statusMap, key)) {
            statusMap[key] = row.count || 0;
          }
        });
        setFpStatusCounts(statusMap);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        showNotification({ title: 'Error', message: 'Failed to load analytics', color: 'red' });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const latestFeedbackBarangayPieData = useMemo(() => {
    if (!feedbackByBarangayMonthly.length) return { monthLabel: null, data: [] };
    const parsed = feedbackByBarangayMonthly.map((r) => ({
      month: dayjs(r.month),
      barangay: r.barangay,
      count: r.count
    }));
    const latestMonth = parsed.reduce((acc, cur) => (!acc || cur.month.isAfter(acc) ? cur.month : acc), null);
    if (!latestMonth) return { monthLabel: null, data: [] };
    const monthKey = latestMonth.startOf('month').valueOf();
    const monthLabel = latestMonth.format('MMMM YYYY');
    const monthRows = parsed.filter((r) => r.month.startOf('month').valueOf() === monthKey);
    const data = monthRows.map((r) => ({ name: r.barangay, value: r.count }));
    return { monthLabel, data };
  }, [feedbackByBarangayMonthly]);

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <Center py="lg">
          <Loader />
        </Center>
      </div>
    );
  }

  return (
    <div className="container-fluid py-3">
      <div className="row g-3 mb-3">
        <Stack gap={4}>
          <Title order={isMobile ? 3 : 2} fz={isMobile ? '1.4rem' : '1.8rem'}>
            General - Data Analytics
          </Title>
          <Text c="dimmed" size={isMobile ? 'sm' : 'md'}>
            Key performance indicators and orientation trends.
          </Text>
        </Stack>
          {/* Changed col-xl-4 to col-xl-12 to span full width */}
          <div className="col-12 col-xl-12">
            <div className="card shadow-sm h-100 border-0">
              <Paper withBorder p="md" radius="md">
                <p className="text-uppercase text-muted small mb-2">Family Planning Bookings by Status</p>
                {/* Mantine Group with 'grow' will now stretch these 4 cards evenly across the full width */}
                <Group grow>
                  <Card
                    withBorder
                    radius="md"
                    padding="md"
                    style={{
                      backgroundColor: '#fef9c3', // soft yellow
                      borderColor: '#facc15',
                    }}
                  >
                    <Text size="xs" fw={700} tt="uppercase" c="#854d0e">Pending</Text>
                    <Text fw={700} size={isMobile ? 'md' : 'lg'} c="#854d0e">{fpStatusCounts.Pending}</Text>
                  </Card>
                  <Card
                    withBorder
                    radius="md"
                    padding="md"
                    style={{
                      backgroundColor: '#dcfce7', // soft green
                      borderColor: '#22c55e',
                    }}
                  >
                    <Text size="xs" fw={700} tt="uppercase" c="#166534">Approved</Text>
                    <Text fw={700} size={isMobile ? 'md' : 'lg'} c="#166534">{fpStatusCounts.Approved}</Text>
                  </Card>
                  <Card
                    withBorder
                    radius="md"
                    padding="md"
                    style={{
                      backgroundColor: '#fee2e2', // soft red
                      borderColor: '#f97373',
                    }}
                  >
                    <Text size="xs" fw={700} tt="uppercase" c="#991b1b">Rejected</Text>
                    <Text fw={700} size={isMobile ? 'md' : 'lg'} c="#991b1b">{fpStatusCounts.Rejected}</Text>
                  </Card>
                  <Card
                    withBorder
                    radius="md"
                    padding="md"
                    style={{
                      backgroundColor: '#f3f4f6', // light gray
                      borderColor: '#e5e7eb',
                    }}
                  >
                    <Text size="xs" fw={700} tt="uppercase" c="#4b5563">Cancelled</Text>
                    <Text fw={700} size={isMobile ? 'md' : 'lg'} c="#4b5563">{fpStatusCounts.Cancelled}</Text>
                  </Card>
                </Group>
              </Paper>
            </div>
          </div>
        </div>

      {/* Feedback by barangay (pie) + Family planning bookings */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <Paper withBorder p="md" radius="md">
                <div className="card-header bg-white border-0 pb-0 d-flex justify-content-between align-items-start">
                  <div>
                    <h5 className="card-title h6 mb-1">System Feedback by Barangay</h5>
                    <p className="text-muted small mb-0">
                      {showFeedbackByBarangayView
                        ? 'Share of feedback coming from each barangay'
                        : 'How many feedback entries are received each month'}
                      {showFeedbackByBarangayView && latestFeedbackBarangayPieData.monthLabel
                        ? ` for ${latestFeedbackBarangayPieData.monthLabel}`
                        : ''}.
                    </p>
                  </div>
                  <Switch
                    size="lg"
                    checked={!showFeedbackByBarangayView}
                    onChange={(event) => setShowFeedbackByBarangayView(!event.currentTarget.checked ? true : false)}
                    onLabel="Month"
                    offLabel="Barangay"
                  />
                </div>

                {showFeedbackByBarangayView ? (
                  latestFeedbackBarangayPieData.data.length > 0 ? (
                    <div className="d-flex align-items-center gap-4">
                      <div style={{ flex: 1, paddingLeft: '40px' }}>
                        <PieChart
                          h={240}
                          withLabels
                          labelsPosition="inside"
                          labelsType="percent"
                          data={latestFeedbackBarangayPieData.data.map((item, index) => {
                            const colors = ['blue.6', 'teal.6', 'grape.6', 'orange.6', 'cyan.6', 'lime.6'];
                            const color = colors[index % colors.length];
                            return {
                              ...item,
                              color
                            };
                          })}
                        />
                      </div>

                      <div
                        className="d-flex flex-column"
                        style={{ flex: 1, fontSize: '0.9rem', minWidth: 260 }}
                      >
                        <span className="mb-1" style={{ fontWeight: 600 }}>Legends</span>
                        <div
                          style={{
                            columnCount: 2,
                            columnGap: '24px'
                          }}
                        >
                          {latestFeedbackBarangayPieData.data.map((item, index) => {
                            const colors = ['blue.6', 'teal.6', 'grape.6', 'orange.6', 'cyan.6', 'lime.6'];
                            const color = colors[index % colors.length];
                            const cssVar = `var(--mantine-color-${color.replace('.', '-')})`;
                            return (
                              <div
                                key={item.name}
                                className="d-flex align-items-center mb-1"
                              >
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
                    </div>
                  ) : (
                    <Center h={180}>
                      <Text c="dimmed">No data</Text>
                    </Center>
                  )
                ) : (
                  <div className="mt-3">
                    {feedbackMonthly.length > 0 ? (
                      <BarChart
                        h={200}
                        data={feedbackMonthly}
                        dataKey="month"
                        series={[{ name: 'count', color: 'teal.6' }]}
                      />
                    ) : (
                      <Center h={180}>
                        <Text c="dimmed">No data</Text>
                      </Center>
                    )}
                  </div>
                )}
              </Paper>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6 d-flex flex-column gap-3">
          <div className="card shadow-sm flex-fill">
            <div className="card-header bg-white border-0 pb-0 d-flex justify-content-between align-items-start">
              <div>
                <h5 className="card-title h6 mb-1">Family Planning Bookings</h5>
                <p className="text-muted small mb-0">
                  {showFpMonthlyView
                    ? 'Monthly volume of family planning bookings.'
                    : 'Yearly volume of family planning bookings.'}
                </p>
              </div>
              <Switch
                size="lg"
                checked={!showFpMonthlyView}
                onChange={(event) => setShowFpMonthlyView(!event.currentTarget.checked ? true : false)}
                onLabel="Year"
                offLabel="Month"
              />
            </div>
            <div className="card-body">
              <Paper withBorder p="md" radius="md">
                {showFpMonthlyView ? (
                  fpMonthly.length > 0 ? (
                    <BarChart
                      h={220}
                      data={fpMonthly}
                      dataKey="month"
                      series={[{ name: 'count', color: 'pink.6' }]}
                    />
                  ) : (
                    <Center h={180}>
                      <Text c="dimmed">No data</Text>
                    </Center>
                  )
                ) : fpYearly.length > 0 ? (
                  <BarChart
                    h={220}
                    data={fpYearly}
                    dataKey="year"
                    series={[{ name: 'count', color: 'pink.6' }]}
                  />
                ) : (
                  <Center h={180}>
                    <Text c="dimmed">No data</Text>
                  </Center>
                )}
              </Paper>
            </div>
          </div>
        </div>
      </div>

      {/* Client feedback + monthly charts */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-8">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0 d-flex justify-content-between align-items-start">
              <div>
                <h5 className="card-title h6 mb-1">Client Feedback Over Time</h5>
                <p className="text-muted small mb-0">
                  {showFeedbackMonthlyView
                    ? 'Monthly volume of client feedback submitted through the portal.'
                    : 'Yearly volume of client feedback submitted through the portal.'}
                </p>
              </div>
              <Switch
                size="lg"
                checked={!showFeedbackMonthlyView}
                onChange={(event) => setShowFeedbackMonthlyView(!event.currentTarget.checked ? true : false)}
                onLabel="Year"
                offLabel="Month"
              />
            </div>
            <div className="card-body">
              <Paper withBorder p="md" radius="md">
                {showFeedbackMonthlyView ? (
                  clientFeedbackMonthly.length > 0 ? (
                    <BarChart
                      h={380}
                      data={clientFeedbackMonthly}
                      dataKey="month"
                      series={[{ name: 'count', color: 'blue.6' }]}
                    />
                  ) : (
                    <Center h={200}>
                      <Text c="dimmed">No data</Text>
                    </Center>
                  )
                ) : clientFeedbackYearly.length > 0 ? (
                  <BarChart
                    h={380}
                    data={clientFeedbackYearly}
                    dataKey="year"
                    series={[{ name: 'count', color: 'blue.6' }]}
                  />
                ) : (
                  <Center h={200}>
                    <Text c="dimmed">No data</Text>
                  </Center>
                )}
              </Paper>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4 d-flex flex-column gap-3">
          <div className="card shadow-sm flex-fill">
            <div className="card-header bg-white border-0 pb-0">
              <h5 className="card-title h6 mb-1">User & Feedback Totals</h5>
              <p className="text-muted small mb-0">Overall usage of the portal.</p>
            </div>
            <div className="card-body">
              <Paper>
                <Group grow>
                  <Card withBorder radius="md" padding="md">
                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Users</Text>
                    <Text fw={700} size="xl">{stats.totalUsers}</Text>
                  </Card>
                  <Card withBorder radius="md" padding="md">
                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Feedback</Text>
                    <Text fw={700} size="xl">{stats.totalFeedback}</Text>
                  </Card>
                </Group>
              </Paper>
            </div>
          </div>

          <div className="card shadow-sm flex-fill">
            <div className="card-header bg-white border-0 pb-0">
              <h5 className="card-title h6 mb-1">New Users per Month</h5>
              <p className="text-muted small mb-0">Onboarding trend for new user accounts.</p>
            </div>
            <div className="card-body">
              <Paper withBorder p="md" radius="md">
                {usersMonthly.length > 0 ? (
                  <BarChart
                    h={180}
                    data={usersMonthly}
                    dataKey="month"
                    series={[{ name: 'count', color: 'indigo.6' }]}
                  />
                ) : (
                  <Center h={140}>
                    <Text c="dimmed">No data</Text>
                  </Center>
                )}
              </Paper>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
