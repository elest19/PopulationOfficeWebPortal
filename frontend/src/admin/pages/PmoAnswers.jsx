import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Title, Text, Table, Loader, Center, Badge, Group, Button, Modal, Divider, Pagination } from '@mantine/core';
import dayjs from 'dayjs';

import { getPmoAdminAnswers } from '../../api/pmoAdmin.js';
import { socket } from '../../socket.js';

export function PmoAnswers() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadAnswers = () => {
    setLoading(true);
    getPmoAdminAnswers()
      .then((res) => setRows(res.data.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAnswers(); }, []);

  useEffect(() => {
    const handler = () => loadAnswers();
    socket.on('pmo:updated', handler);
    return () => socket.off('pmo:updated', handler);
  }, []);

  // Reset to first page whenever the total rows change
  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const groupedAnswers = useMemo(() => {
    const list = Array.isArray(viewRow?.answers) ? viewRow.answers : [];
    const byQuestion = new Map();

    for (const a of list) {
      const qid = a?.questionID;
      if (!qid) continue;
      if (!byQuestion.has(qid)) {
        byQuestion.set(qid, {
          questionID: qid,
          question_text: a.question_text,
          question_type: a.question_type,
          husband: null,
          wife: null,
        });
      }
      const item = byQuestion.get(qid);
      if (a.isHusband === true) item.husband = a;
      else if (a.isHusband === false) item.wife = a;
    }

    return Array.from(byQuestion.values());
  }, [viewRow]);

  return (
    <Stack>
      <Title order={2}>PMO - Answers</Title>
      <Text c="dimmed">Review submitted PMO questionnaire answers.</Text>

      {loading ? (
        <Center>
          <Loader size="sm" />
        </Center>
      ) : rows.length === 0 ? (
        <Text size="sm" c="dimmed">No answers found.</Text>
      ) : (
        <>
          <Table striped withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>No.</Table.Th>
                <Table.Th>Date of Submission</Table.Th>
                <Table.Th>Reference Number</Table.Th>
                <Table.Th>Husband & Wife</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedRows.map((r, index) => {
                const globalIndex = (page - 1) * pageSize + index + 1;
                return (
                  <Table.Tr key={r.coupleID}>
                    <Table.Td>{globalIndex}</Table.Td>
                    <Table.Td>{dayjs(r.created_at).format('MMM D, YYYY')}</Table.Td>
                    <Table.Td>
                      {r.referenceNumber
                        ? r.referenceNumber
                        : (r.coupleID != null ? `—` : '—')}
                    </Table.Td>
                    <Table.Td>
                      {r.husband_name} & {r.wife_name}
                    </Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="light" onClick={() => { setViewRow(r); setViewOpen(true); }}>
                        View
                      </Button>
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
        opened={viewOpen}
        onClose={() => { setViewOpen(false); setViewRow(null); }}
        title="PMO Answers"
        centered
        size="lg"
      >
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={600}>Couple</Text>
              <Text size="sm">{viewRow?.husband_name || '—'} & {viewRow?.wife_name || '—'}</Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text fw={600}>Submitted</Text>
              <Text size="sm">{viewRow?.created_at ? dayjs(viewRow.created_at).format('MMM D, YYYY h:mm A') : '—'}</Text>
            </div>
          </Group>

          <Divider />

          <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 6 }}>
            <Stack gap="md">
              {groupedAnswers.length === 0 ? (
                <Text size="sm" c="dimmed">No answers available.</Text>
              ) : (
                groupedAnswers.map((a) => (
                  <div key={a.questionID} className="card">
                    <div className="card-body">
                      <Stack gap={6}>
                        <Text fw={600}>{a.question_text}</Text>
                        <Text size="xs" c="dimmed">{a.question_type}</Text>

                        <Divider my={4} />

                        <div>
                          <Text size="sm" fw={600}>Husband</Text>
                          <Text size="sm"><b>Answer:</b> {a.husband?.answer || '—'}</Text>
                          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}><b>Reason:</b> {a.husband?.reason || '—'}</Text>
                        </div>

                        <Divider my={4} />

                        <div>
                          <Text size="sm" fw={600}>Wife</Text>
                          <Text size="sm"><b>Answer:</b> {a.wife?.answer || '—'}</Text>
                          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}><b>Reason:</b> {a.wife?.reason || '—'}</Text>
                        </div>
                      </Stack>
                    </div>
                  </div>
                ))
              )}
            </Stack>
          </div>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setViewOpen(false); setViewRow(null); }}>Close</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
