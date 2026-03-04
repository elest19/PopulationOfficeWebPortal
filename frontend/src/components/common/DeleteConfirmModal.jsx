import React from 'react';
import { Modal, Button, Stack, Text } from '@mantine/core';

export function DeleteConfirmModal({
  opened,
  onCancel,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  loading = false,
  color = 'red',
  cancelLabel = 'Cancel',
  closeOnEscape = true,
  closeOnClickOutside = true
}) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      withCloseButton={false}
      closeOnEscape={closeOnEscape}
      closeOnClickOutside={closeOnClickOutside}
      centered
      size="sm"
      radius="lg"
    >
      <Stack gap="md">
        <div className="d-flex flex-column align-items-center text-center">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center mb-3"
            style={{ width: 56, height: 56, backgroundColor: '#fee2e2', color: '#b91c1c' }}
          >
            <span style={{ fontSize: 24 }}>!</span>
          </div>
          <Text fw={600} size="lg" mb={2}>
            {title}
          </Text>
          <Text size="sm" c="dimmed">
            {message}
          </Text>
        </div>

        <div className="d-flex flex-column gap-2 mt-2">
          <Button
            color={color}
            fullWidth
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
          <Button
            variant="default"
            fullWidth
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
