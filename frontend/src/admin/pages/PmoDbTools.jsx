import React, { useState } from 'react';
import { Stack, Title, Group, Checkbox, Button, Divider, Text, Table, Alert, Modal, ScrollArea, Accordion } from '@mantine/core';
import dayjs from 'dayjs';
import { exportAdminDatabase, importAdminDatabase } from '../../api/pmoAdmin.js';

export function PmoDbTools() {
  const [exportIncludeData, setExportIncludeData] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importPreview, setImportPreview] = useState([]); // [{ table, rowCount }]
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importPayload, setImportPayload] = useState(null); // full parsed JSON
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importSuccessModalOpen, setImportSuccessModalOpen] = useState(false);
  const [importResultMessage, setImportResultMessage] = useState('');
  const [skippedPreview, setSkippedPreview] = useState(null); // { [table]: rows[] }

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await exportAdminDatabase({
        format: 'json',
        includeData: exportIncludeData
      });

      const blob = res.data;
      const filename = `population-office-backup-${dayjs().format('YYYYMMDD-HHmmss')}.json`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files && event.target.files[0];
    setImportError('');
    setImportPreview([]);
    setImportPayload(null);
    setImportResultMessage('');
    setSkippedPreview(null);

    if (!file) {
      setImportFileName('');
      return;
    }

    setImportFileName(file.name);

    setImportLoading(true);
    try {
      const text = await file.text();

      try {
        const parsed = JSON.parse(text);

        const tables = [];

        // Expected backup format (current backend):
        // {
        //   meta: { tables: [ 'Table1', 'Table2', ... ], ... },
        //   tables: { Table1: { rows: [...] }, Table2: { rows: [...] }, ... }
        // }

        const tableNamesFromMeta = Array.isArray(parsed?.meta?.tables)
          ? parsed.meta.tables
          : null;

        const sourceTables = parsed.tables && typeof parsed.tables === 'object'
          ? parsed.tables
          : parsed;

        if (sourceTables && typeof sourceTables === 'object') {
          const entries = Object.entries(sourceTables);

          entries.forEach(([tableName, value]) => {
            // Handle { rows: [...] } shape
            if (value && typeof value === 'object' && Array.isArray(value.rows)) {
              tables.push({ table: tableName, rowCount: value.rows.length });
              return;
            }

            // Handle direct array shape: [ row1, row2, ... ]
            if (Array.isArray(value)) {
              tables.push({ table: tableName, rowCount: value.length });
            }
          });
        }

        // If meta.tables exists but we didn't find any rows, still surface those names with 0 rows
        if ((!tables.length) && tableNamesFromMeta) {
          tableNamesFromMeta.forEach((name) => {
            tables.push({ table: String(name), rowCount: 0 });
          });
        }

        if (!tables.length) {
          setImportError('No tables were detected in this JSON backup.');
        }

        setImportPreview(tables);
        setImportPayload(parsed);
      } catch (e) {
        console.error(e);
        setImportError('Unable to parse JSON backup file.');
      }
    } catch (e) {
      console.error(e);
      setImportError('Failed to read the selected file.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleOpenImportModal = () => {
    if (!importPayload || !importPreview.length || importLoading || importSubmitting) return;
    setImportModalOpen(true);
  };

  const handleConfirmImport = async () => {
    if (!importPayload) return;
    setImportSubmitting(true);
    setImportResultMessage('');
    setSkippedPreview(null);
    try {
      const res = await importAdminDatabase({ ...importPayload, mode: 'add' });
      const { mode, tables, skipped } = res?.data?.data || {};
      const importTables = Array.isArray(tables) ? tables : [];
      const totalRows = Array.isArray(tables)
        ? tables.reduce((sum, t) => sum + (t.rowCount || 0), 0)
        : 0;
      const summaryMessage = `Import (${mode || 'add'}) completed for ${importTables.length} table${importTables.length === 1 ? '' : 's'} (${totalRows} row${totalRows === 1 ? '' : 's'} inserted).`;
      setImportResultMessage(summaryMessage);
      if (mode === 'add' && skipped && typeof skipped === 'object') {
        setSkippedPreview(skipped);
      }
      setImportModalOpen(false);
      setImportSuccessModalOpen(true);
    } catch (err) {
      console.error(err);
      const apiMessage = err?.response?.data?.message || err?.response?.data?.error?.message;
      setImportResultMessage(apiMessage || 'Import failed. Please check the backup file and try again.');
      setImportModalOpen(false);
    } finally {
      setImportSubmitting(false);
    }
  };

  return (
    <Stack>
      <Title order={2}>Import / Export Database</Title>

      <Stack gap="xs">
        <Text fw={500} size="sm">Export options</Text>
        <Group align="center" gap="md">
          <Text size="sm"><b>File type:</b> JSON (.json)</Text>
          <Checkbox
            label="Include data (not just structure)"
            checked={exportIncludeData}
            onChange={(event) => setExportIncludeData(event.currentTarget.checked)}
            size="sm"
          />
          <Button
            size="sm"
            disabled={exportLoading}
            loading={exportLoading}
            onClick={handleExport}
          >
            Download
          </Button>
        </Group>
      </Stack>

      {skippedPreview && (
        <Stack mt="md" gap="xs">
          <Text fw={500} size="sm">Skipped rows (duplicates)</Text>
          <Text size="xs" c="dimmed">
            The following sample rows were skipped during add-mode import because records with matching keys already exist.
          </Text>
          <Accordion variant="contained" radius="md">
            {Object.entries(skippedPreview).map(([tableName, rows]) => (
              <Accordion.Item key={tableName} value={tableName}>
                <Accordion.Control>
                  <Text size="sm" fw={500}>{tableName}</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <ScrollArea h={180} type="always">
                    <Table
                      withTableBorder
                      withColumnBorders
                      fontSize="xs"
                      verticalSpacing={2}
                      style={{ minWidth: 600 }}
                    >
                      <Table.Thead>
                        <Table.Tr>
                          {rows && rows[0] && Object.keys(rows[0]).map((col) => (
                            <Table.Th key={col}>{col}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {rows.slice(0, 3).map((row, idx) => (
                          <Table.Tr key={idx}>
                            {Object.keys(rows[0]).map((col) => (
                              <Table.Td key={col}>{String(row[col] ?? '')}</Table.Td>
                            ))}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Stack>
      )}

      <Divider />

      <Stack gap="xs">
        <Text fw={500} size="sm">Import preview</Text>

        <Group align="center" gap="md">
          <Button
            component="label"
            size="sm"
            variant="outline"
            disabled={importLoading}
          >
            Choose backup file
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImportFileChange}
            />
          </Button>
          <Text size="sm" c={importFileName ? undefined : 'dimmed'}>
            {importFileName || 'No file selected'}
          </Text>
        </Group>

        {importLoading && (
          <Text size="sm" c="dimmed">
            Reading backup file and building preview...
          </Text>
        )}

        {importError && (
          <Alert color="red" radius="md" variant="light" title="Import preview">
            <Text size="sm">{importError}</Text>
          </Alert>
        )}

        {!importError && importPreview.length > 0 && (
          <ScrollArea h={260} type="always">
            <Table
              striped
              withTableBorder
              withColumnBorders
              highlightOnHover
              fontSize="sm"
              verticalSpacing="xs"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Table name</Table.Th>
                  <Table.Th style={{ textAlign: 'right', minWidth: 120 }}>Row count</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {importPreview.map((row) => (
                  <Table.Tr key={row.table}>
                    <Table.Td>{row.table}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{row.rowCount}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        {!importError && !importPreview.length && !importLoading && (
          <Text size="sm" c="dimmed">
            Choose a JSON backup file exported from this system to see a preview of tables and row counts.
            You can then apply the import to the database after confirming.
          </Text>
        )}

        {!importError && importPreview.length > 0 && (
          <Group justify="space-between" mt="sm" align="center">
            <Text size="sm">Mode: <b>Add (skip duplicates)</b></Text>
            <Button
              size="sm"
              color="red"
              disabled={!importPayload || importLoading || importSubmitting}
              loading={importSubmitting}
              onClick={handleOpenImportModal}
            >
              Import to database
            </Button>
          </Group>
        )}

        {importResultMessage && (
          <Alert color="blue" radius="md" variant="light" mt="sm">
            <Text size="sm">{importResultMessage}</Text>
          </Alert>
        )}
      </Stack>

      <Modal
        opened={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        centered
        withCloseButton={false}
      >
        <Stack gap="sm" align="stretch">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '999px',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: 32, lineHeight: 1, color: '#ef4444' }}>!</span>
            </div>
          </div>
          <Text ta="center" fw={700} size="lg">Are you sure?</Text>
          <Text ta="center" size="sm" c="dimmed">
            This will add data from the selected backup into the existing tables and skip rows that already exist
            based on primary keys. This action cannot be undone.
          </Text>
          {importSubmitting && (
            <Text ta="center" size="sm">
              Import in progress. This may take a while, please keep this window open until it finishes.
            </Text>
          )}
          <Group justify="center" mt="sm">
            <Button
              color="red"
              fullWidth
              onClick={handleConfirmImport}
              loading={importSubmitting}
            >
              Apply import
            </Button>
          </Group>
          <Group justify="center">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setImportModalOpen(false)}
              disabled={importSubmitting}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={importSuccessModalOpen}
        onClose={() => setImportSuccessModalOpen(false)}
        centered
      >
        <Stack gap="sm" align="stretch">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '999px',
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: 32, lineHeight: 1, color: '#16a34a' }}>✓</span>
            </div>
          </div>
          <Text ta="center" fw={700} size="lg">Import completed</Text>
          {importResultMessage && (
            <Text ta="center" size="sm" c="dimmed">
              {importResultMessage}
            </Text>
          )}
          <Group justify="center" mt="sm">
            <Button
              color="green"
              fullWidth
              onClick={() => setImportSuccessModalOpen(false)}
            >
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default PmoDbTools;
