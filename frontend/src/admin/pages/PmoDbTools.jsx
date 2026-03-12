import React, { useState } from 'react';
import { Stack, Title, Group, Select, Checkbox, Button, Divider, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { exportAdminDatabase } from '../../api/pmoAdmin.js';

export function PmoDbTools() {
  const [exportFormat, setExportFormat] = useState(''); // 'json' | 'sql'
  const [exportIncludeData, setExportIncludeData] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    if (!exportFormat) return;
    setExportLoading(true);
    try {
      const res = await exportAdminDatabase({
        format: exportFormat,
        includeData: exportIncludeData
      });

      const blob = res.data;
      const extension = exportFormat === 'sql' ? 'sql' : 'json';
      const filename = `population-office-backup-${dayjs().format('YYYYMMDD-HHmmss')}.${extension}`;

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

  return (
    <Stack>
      <Title order={2}>Import / Export Database</Title>

      <Stack gap="xs">
        <Text fw={500} size="sm">Export options</Text>
        <Group align="center" gap="md">
          <Select
            label="File type"
            placeholder="Choose file type"
            data={[
              { value: 'json', label: 'JSON (.json)' },
              { value: 'sql', label: 'SQL (.sql)' }
            ]}
            value={exportFormat || null}
            onChange={(v) => setExportFormat(v || '')}
            w={220}
            size="sm"
          />
          <Checkbox
            label="Include data (not just structure)"
            checked={exportIncludeData}
            onChange={(event) => setExportIncludeData(event.currentTarget.checked)}
            size="sm"
          />
          <Button
            size="sm"
            disabled={!exportFormat || exportLoading}
            loading={exportLoading}
            onClick={handleExport}
          >
            Download
          </Button>
        </Group>
      </Stack>

      <Divider />

      <Text size="sm" c="dimmed">
        Import with preview will be added here. You will be able to upload a backup file
        and see a summary of tables and row counts before any changes are applied.
      </Text>
    </Stack>
  );
}

export default PmoDbTools;
