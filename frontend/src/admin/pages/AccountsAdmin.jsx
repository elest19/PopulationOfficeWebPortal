import React, { useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Title,
  Group,
  Button,
  Table,
  Modal,
  TextInput,
  Select,
  Switch,
  Loader,
  Center,
  Pagination,
  Text
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import { getUsers, createUser, updateUser, setUserActive } from '../../api/users.js';
import { socket } from '../../socket.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ROLE_OPTIONS = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Barangay Officer', label: 'Barangay Officer' },
  { value: 'User', label: 'User' }
];

const BARANGAYS = [
  'Alacan',
  'Ambalangan-Dalin',
  'Angio',
  'Anonang',
  'Aramal',
  'Bigbiga',
  'Binday',
  'Bolaoen',
  'Bolasi',
  'Cabaruan',
  'Cayanga',
  'Colisao',
  'Gomot',
  'Inmalog',
  'Inmalog Norte',
  'Lekep-Butao',
  'Lipit-Tomeeng',
  'Longos',
  'Longos Proper',
  'Longos-Amangonan-Parac-Parac (Fabrica)',
  'Mabilao',
  'Nibaliw Central',
  'Nibaliw East',
  'Nibaliw Magliba',
  'Nibaliw Narvarte (Nibaliw West Compound)',
  'Nibaliw Vidal (Nibaliw West Proper)',
  'Palapad',
  'Poblacion',
  'Rabon',
  'Sagud-Bahley',
  'Sobol',
  'Tempra-Guilig',
  'Tiblong',
  'Tocok'
];

function validateContactNumber(value) {
  const s = String(value || '').trim();
  if (!s) return 'Contact number is required';
  if (!/^09\d{9}$/.test(s)) {
    return 'Contact number must be 11 digits and start with 09';
  }
  return null;
}

export function AccountsAdmin() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [summaryOpened, setSummaryOpened] = useState(false);
  const [summaryFilterType, setSummaryFilterType] = useState(''); // role | barangay
  const [summaryRole, setSummaryRole] = useState('');
  const [summaryBarangay, setSummaryBarangay] = useState('');
  const [summaryPage, setSummaryPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const barangayOptions = useMemo(() => BARANGAYS.map((b) => ({ value: b, label: b })), []);

  const form = useForm({
    initialValues: {
      fullName: '',
      username: '',
      email: '',
      contactNumber: '',
      role: 'Barangay Officer',
      barangay: '',
      password: ''
    },
    validate: {
      fullName: (v) => (String(v).trim().length >= 2 ? null : 'Full name is required'),
      username: (v) => (String(v).trim().length >= 3 ? null : 'Username is required'),
      contactNumber: (v) => validateContactNumber(v),
      role: (v) => (v ? null : 'Role is required'),
      barangay: (v, values) =>
        values.role === 'Barangay Officer' && !String(v || '').trim() ? 'Barangay is required' : null,
      password: (v) => (editingId ? null : String(v || '').trim().length >= 6 ? null : 'Password is required')
    }
  });

  useEffect(() => {
    const handler = () => fetchUsers();
    socket.on('accounts:updated', handler);
    return () => socket.off('accounts:updated', handler);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await getUsers({ page: 1, limit: 200 });
      const all = res.data.data || [];
      // Keep both active and inactive; main table will show active only, summary can filter
      setItems(all);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to load users';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedItems = useMemo(() => {
    // Main table shows either active or archived accounts depending on toggle
    const base = items.filter((u) => (showArchived ? u.isActive === false : u.isActive !== false));
    if (!sortField) return base;
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      const av = (sortField === 'role' ? a.role : a.barangay) || '';
      const bv = (sortField === 'role' ? b.role : b.barangay) || '';
      return av.localeCompare(bv) * dir;
    });
  }, [items, sortField, sortDirection, showArchived]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const summaryRoleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((u) => (u.role != null ? String(u.role).trim() : ''))
            .filter((v) => v !== '')
        )
      )
        .sort((a, b) => a.localeCompare(b))
        .map((role) => ({ value: role, label: role })),
    [items]
  );

  const summaryBarangayOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((u) => (u.barangay != null ? String(u.barangay).trim() : ''))
            .filter((v) => v !== '')
        )
      )
        .sort((a, b) => a.localeCompare(b))
        .map((barangay) => ({ value: barangay, label: barangay })),
    [items]
  );

  const summaryPageSize = 10;

  const summaryFilteredItems = items.filter((u) => {
    // When filtering by role or barangay, show only active accounts by default
    if (summaryFilterType === 'role' || summaryFilterType === 'barangay' || !summaryFilterType) {
      if (u.isActive === false) return false;
    }

    // Special filter: show only inactive accounts
    if (summaryFilterType === 'inactive') {
      return u.isActive === false;
    }

    if (!summaryFilterType) return true;

    if (summaryFilterType === 'role') {
      if (!summaryRole) return true;
      return String(u.role || '').trim() === String(summaryRole).trim();
    }

    if (summaryFilterType === 'barangay') {
      if (!summaryBarangay) return true;
      return String(u.barangay || '').trim() === String(summaryBarangay).trim();
    }

    return true;
  });

  const summaryTotalPages = Math.max(1, Math.ceil(summaryFilteredItems.length / summaryPageSize));
  const summaryCurrentPage = Math.min(summaryPage, summaryTotalPages);
  const summaryPagedItems = summaryFilteredItems.slice(
    (summaryCurrentPage - 1) * summaryPageSize,
    summaryCurrentPage * summaryPageSize
  );

  const handleArchive = async (u) => {
    setRowActionLoadingId(u.id);
    try {
      await setUserActive(u.id, false);
      await fetchUsers();
      showNotification({
        title: 'Archived',
        message: `Account for ${u.fullName || 'user'} archived`,
        color: 'green'
      });
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to archive account';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleUnarchive = async (u) => {
    setRowActionLoadingId(u.id);
    try {
      await setUserActive(u.id, true);
      await fetchUsers();
      showNotification({
        title: 'Restored',
        message: `Account for ${u.fullName || 'user'} restored`,
        color: 'green'
      });
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to restore account';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setRowActionLoadingId(null);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const closeModal = () => {
    setModalOpened(false);
    setEditingId(null);
    form.reset();
  };

  const openCreate = () => {
    setEditingId(null);
    form.setValues({ fullName: '', username: '', email: '', contactNumber: '', role: 'Barangay Officer', barangay: '', password: '' });
    setModalOpened(true);
  };

  const openEdit = (u) => {
    setEditingId(u.id);
    form.setValues({
      fullName: u.fullName || '',
      username: u.username || '',
      email: u.email || '',
      contactNumber: u.contactNumber || '',
      role: u.role || 'Barangay Officer',
      barangay: u.barangay || '',
      password: ''
    });
    setModalOpened(true);
  };

  const canManage = useMemo(() => isAdmin, [isAdmin]);

  const handleSubmit = async (values) => {
    const { hasErrors } = form.validate();
    if (hasErrors) return;

    try {
      const isEditing = editingId !== null && editingId !== undefined;

      if (isEditing) {
        await updateUser(editingId, values);
        showNotification({ title: 'Saved', message: 'User updated', color: 'green' });
      } else {
        await createUser(values);
        showNotification({ title: 'Created', message: 'User created', color: 'green' });
      }
      closeModal();
      await fetchUsers();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Failed to save user';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  if (!canManage) {
    return (
      <Stack>
        <Title order={2}>Accounts</Title>
      </Stack>
    );
  }

  const previewUser = {
    fullName: form.values.fullName || 'New account',
    role: form.values.role || 'Role not set',
    barangay: form.values.barangay || '',
    email: form.values.email || '',
    contact: form.values.contactNumber || ''
  };

  const previewInitials = previewUser.fullName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>Accounts</Title>
        <Group gap="sm">
          <Button size="sm" variant="outline" onClick={() => setSummaryOpened(true)}>
            Summary
          </Button>
          <Button onClick={openCreate}>Add Account</Button>
          <Button
            size="sm"
            variant={showArchived ? 'filled' : 'outline'}
            color={showArchived ? 'gray' : 'dark'}
            onClick={() => {
              setShowArchived((prev) => !prev);
              setPage(1);
            }}
          >
            Archived
          </Button>
        </Group>
      </Group>

      {loading ? (
        <Center py="lg">
          <Loader />
        </Center>
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
              <Table.Th style={{ textAlign: 'left' }}>No.</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Name</Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Email</Table.Th>
              <Table.Th
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => handleSort('role')}
              >
                {`Role${sortField === 'role' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}`}
              </Table.Th>
              <Table.Th
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => handleSort('barangay')}
              >
                {`Barangay${sortField === 'barangay' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}`}
              </Table.Th>
              <Table.Th style={{ textAlign: 'left' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pagedItems.map((u, index) => {
              const rowNumber = (currentPage - 1) * pageSize + index + 1;
              const isArchived = u.isActive === false;
              const isRowBusy = rowActionLoadingId === u.id;
              return (
                <Table.Tr key={u.id}>
                  <Table.Td>{rowNumber}</Table.Td>
                  <Table.Td>{u.fullName}</Table.Td>
                  <Table.Td>{u.email || '—'}</Table.Td>
                  <Table.Td>{u.role}</Table.Td>
                  <Table.Td>{u.barangay || '—'}</Table.Td>
                  <Table.Td>
                    <div className="d-inline-flex gap-1">
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => openEdit(u)}
                        disabled={isRowBusy}
                      >
                        Edit
                      </Button>
                      {!isArchived && (
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          disabled={isRowBusy}
                          onClick={() => !isRowBusy && handleArchive(u)}
                        >
                          Archive
                        </Button>
                      )}
                      {isArchived && (
                        <Button
                          size="xs"
                          color="green"
                          variant="light"
                          disabled={isRowBusy}
                          onClick={() => !isRowBusy && handleUnarchive(u)}
                        >
                          Unarchive
                        </Button>
                      )}
                    </div>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      {sortedItems.length > pageSize && (
        <Group justify="flex-end" mt="md">
          <Pagination
            size="md"
            value={currentPage}
            onChange={setPage}
            total={totalPages}
          />
        </Group>
      )}

      <Modal
        opened={summaryOpened}
        onClose={() => setSummaryOpened(false)}
        size="xl"
        centered
        title="Accounts Summary"
      >
        <Stack gap="sm">
          <Group align="flex-end">
            <Select
              label="Filter by"
              placeholder="None"
              data={[
                { value: 'role', label: 'Role' },
                { value: 'barangay', label: 'Barangay' },
                { value: 'inactive', label: 'Archived Accounts' }
              ]}
              value={summaryFilterType}
              onChange={(v) => {
                const value = v || '';
                setSummaryFilterType(value);
                setSummaryRole('');
                setSummaryBarangay('');
                setSummaryPage(1);
              }}
              clearable
              w={200}
            />

            {summaryFilterType === 'role' && (
              <Select
                label="Role"
                placeholder="Select role"
                data={summaryRoleOptions}
                value={summaryRole}
                onChange={(v) => {
                  setSummaryRole(v || '');
                  setSummaryPage(1);
                }}
                searchable
                clearable
                style={{ flex: 1 }}
              />
            )}

            {summaryFilterType === 'barangay' && (
              <Select
                label="Barangay"
                placeholder="Select barangay"
                data={summaryBarangayOptions}
                value={summaryBarangay}
                onChange={(v) => {
                  setSummaryBarangay(v || '');
                  setSummaryPage(1);
                }}
                searchable
                clearable
                style={{ flex: 1 }}
              />
            )}
          </Group>

          <Text size="sm">
            <b>Total accounts:</b> {summaryFilteredItems.length}
          </Text>

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
                <Table.Th style={{ textAlign: 'left' }}>No.</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Name</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Email</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Role</Table.Th>
                <Table.Th style={{ textAlign: 'left' }}>Barangay</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summaryPagedItems.map((u, index) => {
                const rowNumber = (summaryCurrentPage - 1) * summaryPageSize + index + 1;
                return (
                  <Table.Tr key={u.id}>
                    <Table.Td>{rowNumber}</Table.Td>
                    <Table.Td>{u.fullName}</Table.Td>
                    <Table.Td>{u.email || '—'}</Table.Td>
                    <Table.Td>{u.role}</Table.Td>
                    <Table.Td>{u.barangay || '—'}</Table.Td>
                  </Table.Tr>
                );
              })}
              {summaryPagedItems.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Center>
                      <Text size="sm" c="dimmed">
                        No accounts match the selected filters.
                      </Text>
                    </Center>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>

          {summaryFilteredItems.length > summaryPageSize && (
            <Group justify="flex-end" mt="sm">
              <Pagination
                size="sm"
                value={summaryCurrentPage}
                onChange={setSummaryPage}
                total={summaryTotalPages}
              />
            </Group>
          )}
        </Stack>
      </Modal>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        withCloseButton={false}
        centered
        size="xl"
      >
        <div className="row g-0 align-items-stretch">
          <div
            className="col-md-5 d-none d-md-block bg-light"
            style={{ borderLeft: '1px solid #e5e7eb' }}
          >
            <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center">
              <div className="d-flex flex-column align-items-center text-center">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                  style={{ width: 80, height: 80, backgroundColor: '#e5e7eb', fontWeight: 600 }}
                >
                  {previewInitials || '?'}
                </div>
                <div className="fw-semibold">{previewUser.fullName}</div>
                <div className="text-muted small mb-1">
                  {previewUser.role}
                  {previewUser.barangay ? ` • ${previewUser.barangay}` : ''}
                </div>
                <div className="small" style={{ color: '#6b7280' }}>
                  {previewUser.email || 'No email set'}
                </div>
                {previewUser.contact && (
                  <div className="small" style={{ color: '#6b7280' }}>
                    {previewUser.contact}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-7 p-4">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="text-uppercase small text-muted mb-1">Accounts</div>
                <h2 className="h5 mb-0">{editingId !== null ? 'Edit account' : 'Add account'}</h2>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeModal}
              />
            </div>

            <form
              onSubmit={form.onSubmit((values) => {
                handleSubmit(values).catch(() => {});
              })}
            >
              <Stack>
                <TextInput label="Full name" required {...form.getInputProps('fullName')} />
                <TextInput label="Username" required {...form.getInputProps('username')} />
                <TextInput label="Email" placeholder="Optional" {...form.getInputProps('email')} />
                <TextInput label="Contact number" required {...form.getInputProps('contactNumber')} />
                <Select
                  label="Role"
                  data={ROLE_OPTIONS}
                  required
                  value={form.values.role}
                  onChange={(value) => {
                    const role = value || '';
                    form.setFieldValue('role', role);
                    if (role === 'Admin') {
                      form.setFieldValue('barangay', '');
                    }
                  }}
                  error={form.errors.role}
                />
                {form.values.role === 'Barangay Officer' ? (
                  <Select
                    label="Barangay"
                    searchable
                    required
                    data={barangayOptions}
                    value={form.values.barangay}
                    onChange={(v) => form.setFieldValue('barangay', v)}
                    error={form.errors.barangay}
                  />
                ) : (
                  <TextInput
                    label="Barangay"
                    placeholder="Must be empty for Admin"
                    disabled
                    {...form.getInputProps('barangay')}
                  />
                )}
                <TextInput
                  label={editingId !== null ? 'New password (optional)' : 'Password'}
                  type="password"
                  required={editingId === null}
                  {...form.getInputProps('password')}
                />

                <div className="d-flex justify-content-end gap-2 pt-2 mt-1 border-top">
                  <Button type="submit">Save changes</Button>
                </div>
              </Stack>
            </form>
          </div>
        </div>
      </Modal>
    </Stack>
  );
}
