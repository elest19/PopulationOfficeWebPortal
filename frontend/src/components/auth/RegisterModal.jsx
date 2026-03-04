import React, { useMemo, useState } from 'react';
import { Modal, Button } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import { registerRequest } from '../../api/auth.js';
import PopcomLogo from '../../content/POPCOM-Logo.jpg';

const BARANGAYS = [
  'Alacan','Ambalangan-Dalin','Angio','Anonang','Aramal','Bigbiga','Binday','Bolaoen','Bolasi','Cabaruan','Cayanga','Colisao','Gomot','Inmalog','Inmalog Norte','Lekep-Butao','Lipit-Tomeeng','Longos','Longos Proper','Longos-Amangonan-Parac-Parac (Fabrica)','Mabilao','Nibaliw Central','Nibaliw East','Nibaliw Magliba','Nibaliw Narvarte (Nibaliw West Compound)','Nibaliw Vidal (Nibaliw West Proper)','Palapad','Poblacion','Rabon','Sagud-Bahley','Sobol','Tempra-Guilig','Tiblong','Tocok'
];

function isAlphaText(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  return /^[A-Za-zÀ-ÿ\s'.-]+$/.test(s);
}

function validateContactNumber(value) {
  const s = String(value || '').trim();
  if (!s) return 'Contact number is required';
  if (!/^09\d{9}$/.test(s)) {
    return 'Contact number must be 11 digits and start with 09';
  }
  return null;
}

export function RegisterModal({ opened, onClose, onOpenLogin, defaultRole = 'User', lockRole = false }) {
  const [submitting, setSubmitting] = useState(false);

  const barangayOptions = useMemo(() => BARANGAYS.map((b) => ({ value: b, label: b })), []);

  const form = useForm({
    initialValues: {
      fullName: '',
      username: '',
      email: '',
      contactNumber: '',
      password: '',
      role: defaultRole,
      barangay: ''
    },
    validate: {
      fullName: (v) => {
        const s = String(v || '').trim();
        if (!s) return 'Full name is required';
        if (!isAlphaText(s)) return 'Full name must contain letters only';
        return null;
      },
      username: (v) => {
        const s = String(v || '').trim();
        if (!s) return 'Username is required';
        if (s.length < 3) return 'Username should be at least 3 characters';
        return null;
      },
      email: (v) => {
        const s = String(v || '').trim();
        if (!s) return 'Email is required';
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? null : 'Invalid email';
      },
      contactNumber: (v) => validateContactNumber(v),
      password: (v) => (String(v || '').length >= 6 ? null : 'Password should be at least 6 characters'),
      role: (v) => (v ? null : 'Role is required'),
      barangay: (v, values) =>
        values.role !== 'Admin' ? (String(v || '').trim() ? null : 'Barangay is required') : null,
    }
  });

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        fullName: values.fullName,
        username: values.username,
        email: String(values.email || '').trim() ? values.email : null,
        contactNumber: values.contactNumber,
        password: values.password,
        role: values.role,
        barangay: values.role === 'Admin' ? null : values.barangay
      };

      await registerRequest(payload);

      showNotification({
        title: 'Account created',
        message: 'Your account has been created successfully. Please log in.',
        color: 'green'
      });

      form.reset();
      onClose?.();
      onOpenLogin?.();
    } catch (error) {
      const message = error?.response?.data?.error?.message || 'Registration failed';
      showNotification({
        title: 'Registration failed',
        message,
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      withCloseButton={false}
      size="auto"
      styles={{
        content: {
          maxWidth: '900px',
          width: '100%',
        },
        body: {
          padding: 0,
        },
      }}
    >
      <div className="container-fluid p-0">
        <div className="row g-0">
          {/* Illustration / left panel (same as LoginModal) */}
          <div
            className="col-md-5 d-none d-md-flex align-items-center justify-content-center"
            style={{ backgroundColor: '#2835bdff', margin: 0, padding: 0 }}
          >
            <div className="text-center text-white p-4">
              <img
                src={PopcomLogo}
                alt="POPCOM logo"
                style={{
                  maxWidth: '70%',
                  height: 'auto',
                  marginBottom: '1.5rem',
                  borderRadius: '100%',
                }}
              />
              <h5 className="fw-semibold mb-2">Create your account</h5>
              <p className="small mb-0">Register to access municipal population office services.</p>
            </div>
          </div>

          {/* Form / right panel */}
          <div className="col-12 col-md-7 bg-white">
            <div className="p-4 p-md-5">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <h2 className="h4 fw-bold mb-0">Create Account</h2>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                />
              </div>

              <form
                onSubmit={form.onSubmit((values) => {
                  handleSubmit(values).catch(() => {});
                })}
              >
                <div className="mb-3">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className={`form-control${form.errors.fullName ? ' is-invalid' : ''}`}
                    {...form.getInputProps('fullName')}
                  />
                  {form.errors.fullName && <div className="invalid-feedback">{form.errors.fullName}</div>}
                </div>

                <div className="mb-3">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className={`form-control${form.errors.username ? ' is-invalid' : ''}`}
                    {...form.getInputProps('username')}
                  />
                  {form.errors.username && <div className="invalid-feedback">{form.errors.username}</div>}
                </div>

                <div className="mb-3">
                  <label className="form-label">Email Address</label>
                  <input
                  required
                    type="email"
                    className={`form-control${form.errors.email ? ' is-invalid' : ''}`}
                    placeholder="you@example.com"
                    {...form.getInputProps('email')}
                  />
                  {form.errors.email && <div className="invalid-feedback">{form.errors.email}</div>}
                </div>

                <div className="mb-3">
                  <label className="form-label">Contact Number</label>
                  <input
                    type="text"
                    className={`form-control${form.errors.contactNumber ? ' is-invalid' : ''}`}
                    {...form.getInputProps('contactNumber')}
                  />
                  {form.errors.contactNumber && (
                    <div className="invalid-feedback">{form.errors.contactNumber}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className={`form-control${form.errors.password ? ' is-invalid' : ''}`}
                    {...form.getInputProps('password')}
                  />
                  {form.errors.password && <div className="invalid-feedback">{form.errors.password}</div>}
                </div>

                {form.values.role !== 'Admin' && (
                  <div className="mb-3">
                    <label className="form-label">Barangay</label>
                    <select
                      className={`form-select${form.errors.barangay ? ' is-invalid' : ''}`}
                      {...form.getInputProps('barangay')}
                    >
                      <option value="">Select Barangay</option>
                      {barangayOptions.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    {form.errors.barangay && (
                      <div className="invalid-feedback">{form.errors.barangay}</div>
                    )}
                  </div>
                )}

                <div className="d-flex align-items-center justify-content-between mt-3">
                  <button
                    type="button"
                    className="btn btn-link p-0 small"
                    onClick={() => {
                      onClose?.();
                      onOpenLogin?.();
                    }}
                  >
                    Back to Login
                  </button>
                  <Button type="submit" loading={submitting} styles={{ root: { backgroundColor: '#3081faff' } }}>
                    Register
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
