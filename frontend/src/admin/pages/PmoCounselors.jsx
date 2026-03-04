import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Title, Text, Group, Button, Modal, TextInput, SimpleGrid, Badge, Switch, Table, Loader, Center } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { getCounselors, createCounselor, updateCounselor, deleteCounselor } from '../../api/counselors.js';
import { socket } from '../../socket.js';
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal.jsx';

export function PmoCounselors() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({ counselor_name: '', email: '', contact_number: '', isActive: true });
  const [contactError, setContactError] = useState('');

  const setField = (key) => (input) => {
    const value = typeof input === 'string' ? input : input?.currentTarget?.value ?? '';
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'contact_number') {
      setContactError('');
    }
  };

  useEffect(() => {
    const handler = () => load();
    socket.on('pmo:updated', handler);
    return () => socket.off('pmo:updated', handler);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getCounselors();
      setItems(res.data.data || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (showInactive) return (items || []).filter((x) => x.isActive === false);
    return (items || []).filter((x) => x.isActive !== false);
  }, [items, showInactive]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedContact = String(form.contact_number || '').trim();
    if (!/^09\d{9}$/.test(normalizedContact)) {
      const msg = 'Contact number must be 11 digits and start with 09';
      setContactError(msg);
      showNotification({ title: 'Invalid contact number', message: msg, color: 'red' });
      return;
    }
    try {
      if (editingId) {
        await updateCounselor(editingId, { ...form, contact_number: normalizedContact, isActive: !!form.isActive });
      } else {
        await createCounselor({ ...form, contact_number: normalizedContact, isActive: !!form.isActive });
      }
      setModalOpen(false);
      setEditingId(null);
      setForm({ counselor_name: '', email: '', contact_number: '', isActive: true });
      setContactError('');
      await load();
    } catch (e) {}
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ counselor_name: '', email: '', contact_number: '', isActive: true });
    setContactError('');
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditingId(c.counselorID);
    setForm({
      counselor_name: c.counselor_name || '',
      email: c.email || '',
      contact_number: c.contact_number || '',
      isActive: c.isActive !== false
    });
    setContactError('');
    setModalOpen(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
  };

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>PMO - Counselors</Title>
        <Group gap="xs">
          <Button size="xs" onClick={openCreate}>Add Counselor</Button>
          <Button size="xs" variant="light" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? 'View Active' : 'View Inactive'}
          </Button>
        </Group>
      </Group>
      <Text c="dimmed">Manage PMO counselors roster and assignments.</Text>

      {loading ? (
        <Center py="lg"><Loader /></Center>
      ) : visible.length === 0 ? (
        <Text size="sm" c="dimmed">No counselors found.</Text>
      ) : (
        <Table
          striped
          withTableBorder
          withColumnBorders
          highlightOnHover
          verticalSpacing="xs"
          fontSize="sm"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ textAlign: 'left' }}>Name</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Email</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Contact</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Status</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visible.map((c) => (
              <Table.Tr key={c.counselorID}>
                <Table.Td>{c.counselor_name}</Table.Td>
                <Table.Td>{c.email || '—'}</Table.Td>
                <Table.Td>{c.contact_number || '—'}</Table.Td>
                <Table.Td>
                  <Badge color={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  <Group justify="center" gap="xs">
                    <Button size="xs" variant="light" onClick={() => openEdit(c)}>Edit</Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <DeleteConfirmModal
        opened={deleteId != null}
        onCancel={() => { if (!deleteLoading) setDeleteId(null); }}
        onConfirm={async () => {
          if (!deleteId) return;
          setDeleteLoading(true);
          try {
            await deleteCounselor(deleteId);
            await load();
            setDeleteId(null);
          } catch (e) {
          } finally {
            setDeleteLoading(false);
          }
        }}
        confirmLabel="Delete counselor"
        message="This action cannot be undone. The selected counselor will be removed from the roster."
        loading={deleteLoading}
      />

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Counselor' : 'Add Counselor'}
        centered
        size="lg"
        radius="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="container-fluid">
            <div className="row">
              <div className="col-md-7 pe-md-4">
                <Stack>
                  <TextInput
                    label="Full name"
                    value={form.counselor_name}
                    onChange={setField('counselor_name')}
                    required
                  />
                  <TextInput
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={setField('email')}
                    required
                  />
                  <TextInput
                    label="Contact number"
                    value={form.contact_number}
                    onChange={setField('contact_number')}
                    required
                    error={contactError}
                  />

                  <Group justify="space-between" align="center">
                    <Text size="sm" c="dimmed">Counselor status</Text>
                    <Switch
                      label={form.isActive ? 'Active' : 'Inactive'}
                      checked={!!form.isActive}
                      onChange={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    />
                  </Group>

                  <Group justify="flex-end">
                    <Button type="submit">Save</Button>
                  </Group>
                </Stack>
              </div>

              <div className="col-md-5 ps-md-4 border-start">
                <div className="d-flex flex-column align-items-center">
                  <div className="rounded-circle bg-light d-flex align-items-center justify-content-center mb-3" style={{ width: 92, height: 92 }}>
                    <Text fw={700} size="xl">
                      {String(form?.counselor_name || 'C').trim().slice(0, 1).toUpperCase()}
                    </Text>
                  </div>
                  <Text fw={700} size="lg" className="text-center">
                    {String(form?.counselor_name || 'Counselor')}
                  </Text>
                  <Badge color={form?.isActive ? 'green' : 'gray'} mt="xs">
                    {form?.isActive ? 'Active' : 'Inactive'}
                  </Badge>

                  <div className="w-100 mt-3">
                    <div className="card border-0 bg-light">
                      <div className="card-body py-2 px-3">
                        <Text size="sm"><b>Email:</b> {form?.email || '—'}</Text>
                        <Text size="sm"><b>Contact:</b> {form?.contact_number || '—'}</Text>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </Stack>
  );
}
