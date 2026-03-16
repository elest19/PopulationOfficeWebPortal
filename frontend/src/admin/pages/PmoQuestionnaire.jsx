import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Title, Text, Group, Button, Modal, TextInput, Select, Loader, Center, Box } from '@mantine/core';
import { showNotification } from '@mantine/notifications';

import { createPmoAdminQuestion, deletePmoAdminQuestion, getPmoAdminQuestionnaire, updatePmoAdminQuestion } from '../../api/pmoAdmin.js';
import { socket } from '../../socket.js';
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal.jsx';

export function PmoQuestionnaire() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({
    question_text: '',
    question_type: 'Standalone',
    parent_question_id: null,
    sort_order: 0
  });

  const resetForm = () => {
    setEditing(null);
    setForm({ question_text: '', question_type: 'Standalone', parent_question_id: null, sort_order: 0 });
  };

  const fillerOptions = useMemo(() => {
    const excludeId = editing?.questionID;
    return (rows || [])
      .filter((q) => q.question_type === 'Filler')
      .filter((q) => (excludeId ? q.questionID !== excludeId : true))
      .sort((a, b) => (a.sort_order - b.sort_order) || (a.questionID - b.questionID))
      .map((q) => ({
        value: String(q.questionID),
        label: `${q.sort_order} - ${q.question_text}`
      }));
  }, [rows, editing]);

  const normalizedForm = useMemo(() => {
    const type = form.question_type;
    const parentAllowed = type === 'Sub-question' || type === 'Filler' || type === 'Standalone';
    return {
      ...form,
      parent_question_id: parentAllowed ? form.parent_question_id : null
    };
  }, [form]);

  useEffect(() => {
    const handler = () => load();
    socket.on('pmo:updated', handler);
    return () => socket.off('pmo:updated', handler);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPmoAdminQuestionnaire();
      setRows(res.data.data || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (normalizedForm.question_type === 'Sub-question' && !normalizedForm.parent_question_id) {
        showNotification({ title: 'Validation', message: 'Parent question is required for Sub-question.', color: 'red' });
        return;
      }

      if (editing) {
        await updatePmoAdminQuestion(editing.questionID, normalizedForm);
        showNotification({ title: 'Saved', message: 'Question updated.', color: 'green' });
      } else {
        await createPmoAdminQuestion(normalizedForm);
        showNotification({ title: 'Saved', message: 'Question created.', color: 'green' });
      }

      setModalOpen(false);
      resetForm();
      await load();
    } catch (error) {
      const msg = error?.response?.data?.error?.message || 'Failed to create question';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  const byParent = useMemo(() => {
    const map = new Map();
    for (const q of rows || []) {
      const key = q.parent_question_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(q);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => (a.sort_order - b.sort_order) || (a.questionID - b.questionID));
      map.set(k, list);
    }
    return map;
  }, [rows]);

  const openAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (q) => {
    setEditing(q);
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      parent_question_id: q.parent_question_id ?? null,
      sort_order: q.sort_order
    });
    setModalOpen(true);
  };

  const renderNode = (q, depth, parentIsFiller) => {
    const children = byParent.get(q.questionID) || [];
    const isFiller = q.question_type === 'Filler';
    const isSub = q.question_type === 'Sub-question';

    const left = depth * 16;
    const labelStyle = isFiller
      ? { fontWeight: 700, fontSize: depth === 0 ? 16 : 15 }
      : { fontWeight: 500 };

    return (
      <Box key={q.questionID} style={{ paddingLeft: left, borderLeft: depth ? '2px solid #f1f3f5' : undefined, marginLeft: depth ? 6 : 0 }}>
        <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text style={labelStyle}>
              {isSub || (parentIsFiller && !isFiller) ? `• ${q.question_text}` : `${q.question_text}`}
            </Text>
            <Text size="xs" c="dimmed">{q.question_type}</Text>
          </Box>
          <Group gap="xs" wrap="nowrap">
            <Button size="xs" variant="light" onClick={() => openEdit(q)}>
              Edit
            </Button>
            <Button size="xs" color="red" variant="light" onClick={() => setDeleteId(q.questionID)}>
              Delete
            </Button>
          </Group>
        </Group>

        {children.length > 0 ? (
          <Stack gap={6} mt={6}>
            {children.map((child) => renderNode(child, depth + 1, isFiller || parentIsFiller))}
          </Stack>
        ) : null}
      </Box>
    );
  };

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>PMO - Questionnaire</Title>
        <Group gap="xs">
          <Button size="xs" onClick={openAdd}>Add Question</Button>
        </Group>
      </Group>
      <Text c="dimmed">Manage PMO questionnaire items.</Text>

      {loading ? (
        <Center>
          <Loader size="sm" />
        </Center>
      ) : rows.length === 0 ? (
        <Text size="sm" c="dimmed">No questions found.</Text>
      ) : (
        <Stack gap={10}>
          {(byParent.get(null) || []).map((q) => renderNode(q, 0, false))}
        </Stack>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editing ? 'Edit Question' : 'Add Question'}
        centered
      >
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Question"
              value={form.question_text}
              onChange={(e) => setForm((f) => ({ ...f, question_text: e.currentTarget.value }))}
              required
            />
            <Select
              label="Type"
              data={[
                { value: 'Standalone', label: 'Standalone' },
                { value: 'Filler', label: 'Filler' },
                { value: 'Sub-question', label: 'Sub-question' }
              ]}
              value={form.question_type}
              onChange={(v) => {
                const nextType = v;
                setForm((f) => ({
                  ...f,
                  question_type: nextType,
                  parent_question_id: nextType === 'Sub-question' || nextType === 'Filler' ? f.parent_question_id : null
                }));
              }}
            />
            <Select
              label="Parent question (optional)"
              placeholder="None"
              searchable
              clearable
              data={fillerOptions}
              required={form.question_type === 'Sub-question'}
              value={form.parent_question_id ? String(form.parent_question_id) : null}
              onChange={(v) => setForm((f) => ({ ...f, parent_question_id: v ? Number(v) : null }))}
            />
            <TextInput
              label="Sort order"
              value={String(form.sort_order)}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.currentTarget.value || 0) }))}
            />
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <DeleteConfirmModal
        opened={deleteId != null}
        onCancel={() => { if (!deleteLoading) setDeleteId(null); }}
        onConfirm={async () => {
          if (!deleteId) return;
          setDeleteLoading(true);
          try {
            await deletePmoAdminQuestion(deleteId);
            await load();
            setDeleteId(null);
          } catch (e) {
            const msg = e?.response?.data?.error?.message || 'Failed to delete question';
            showNotification({ title: 'Error', message: msg, color: 'red' });
          } finally {
            setDeleteLoading(false);
          }
        }}
        confirmLabel="Delete question"
        message="This action cannot be undone. The selected question will be removed from the questionnaire."
        loading={deleteLoading}
      />
    </Stack>
  );
}
