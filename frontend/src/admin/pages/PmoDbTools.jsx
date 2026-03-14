import React, { useState } from 'react';
import { Stack, Title, Group, Checkbox, Button, Divider, Text, Table, Alert, Modal, Radio } from '@mantine/core';
import dayjs from 'dayjs';
import { exportAdminDatabase, importAdminDatabase, importAdminDatabaseSql } from '../../api/pmoAdmin.js';

export function PmoDbTools() {
  const [exportIncludeData, setExportIncludeData] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importPreview, setImportPreview] = useState([]); // unused for SQL-only import
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importPayload, setImportPayload] = useState(null); // full parsed JSON
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResultMessage, setImportResultMessage] = useState('');
  const [importMode, setImportMode] = useState('replace'); // 'replace' | 'add'
  const [skippedPreview, setSkippedPreview] = useState(null); // { [table]: rows[] }
  const [isSqlImport, setIsSqlImport] = useState(false);
  const [sqlImportText, setSqlImportText] = useState('');

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await exportAdminDatabase({
        format: 'sql',
        includeData: exportIncludeData
      });

      const blob = res.data;
      const filename = `population-office-backup-${dayjs().format('YYYYMMDD-HHmmss')}.sql`;

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
    setIsSqlImport(false);
    setSqlImportText('');

    if (!file) {
      setImportFileName('');
      return;
    }

    setImportFileName(file.name);

    const isSql = file.name.toLowerCase().endsWith('.sql');

    setImportLoading(true);
    try {
      const text = await file.text();

      if (isSql) {
        // For SQL files we run the script as-is; no preview is available.
        setIsSqlImport(true);
        setSqlImportText(text);
        setImportPreview([]);
        setImportPayload(null);
        setImportError('');
      } else {
        setImportError('Unsupported file type. Please select a .sql backup file.');
      }
    } catch (e) {
      console.error(e);
      setImportError('Failed to read the selected file.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleOpenImportModal = () => {
    if (isSqlImport) {
      if (!sqlImportText || importLoading || importSubmitting) return;
      setImportModalOpen(true);
      return;
    }
    if (!importPayload || !importPreview.length || importLoading || importSubmitting) return;
    setImportModalOpen(true);
  };

  const handleConfirmImport = async () => {
    if (isSqlImport) {
      if (!sqlImportText) return;
      setImportSubmitting(true);
      setImportResultMessage('');
      try {
        await importAdminDatabaseSql(sqlImportText);
        setImportResultMessage('SQL import completed successfully.');
      } catch (err) {
        console.error(err);
        const apiMessage = err?.response?.data?.message || err?.response?.data?.error?.message;
        setImportResultMessage(apiMessage || 'SQL import failed. Please check the script and try again.');
      } finally {
        setImportSubmitting(false);
        setImportModalOpen(false);
      }
      return;
    }

    if (!importPayload) return;
    setImportSubmitting(true);
    setImportResultMessage('');
    setSkippedPreview(null);
    try {
      const res = await importAdminDatabase({ ...importPayload, mode: importMode });
      const { mode, tables, skipped } = res?.data?.data || {};
      const importTables = Array.isArray(tables) ? tables : [];
      const totalRows = Array.isArray(tables)
        ? tables.reduce((sum, t) => sum + (t.rowCount || 0), 0)
        : 0;
      setImportResultMessage(
        `Import (${mode || importMode}) completed for ${importTables.length} table${importTables.length === 1 ? '' : 's'} (${totalRows} row${totalRows === 1 ? '' : 's'} inserted).`
      );
      if (mode === 'add' && skipped && typeof skipped === 'object') {
        setSkippedPreview(skipped);
      }
      setImportModalOpen(false);
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
          <Text size="sm"><b>File type:</b> SQL (.sql)</Text>
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

      {skippedPreview && importMode === 'add' && (
        <Stack mt="md" gap="xs">
          <Text fw={500} size="sm">Skipped rows (duplicates)</Text>
          <Text size="xs" c="dimmed">
            The following sample rows were skipped during add-mode import because records with matching keys already exist.
          </Text>
          {Object.entries(skippedPreview).map(([tableName, rows]) => (
            <Stack key={tableName} gap={4}>
              <Text size="sm" fw={500}>{tableName}</Text>
              <Table withTableBorder withColumnBorders fontSize="xs" verticalSpacing={2}>
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
            </Stack>
          ))}
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
              accept=".sql,text/sql,application/sql"
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

        {!importError && !importPreview.length && !importLoading && (
          <Text size="sm" c="dimmed">
            Choose a SQL backup file exported from this system. The SQL script will be executed as-is
            against the current database inside a single transaction.
          </Text>
        )}

        <Group justify="flex-end" mt="sm" align="center">
          <Button
            size="sm"
            color="red"
            disabled={!sqlImportText || importLoading || importSubmitting}
            loading={importSubmitting}
            onClick={handleOpenImportModal}
          >
            Import SQL to database
          </Button>
        </Group>

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
            {isSqlImport
              ? 'This will execute the uploaded SQL script directly against the current database inside a single transaction. Make sure you are using a test database before proceeding.'
              : 'This will replace the contents of the affected tables with the data from the selected backup. This action cannot be undone.'}
          </Text>
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
    </Stack>
  );
}

export default PmoDbTools;
