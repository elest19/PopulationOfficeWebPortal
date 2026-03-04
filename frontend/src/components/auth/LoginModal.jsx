import React, { useEffect, useState } from 'react';
import { Modal, Button } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import { useAuth } from '../../context/AuthContext.jsx';
import { startPasswordReset, verifyPasswordReset, completePasswordReset } from '../../api/auth.js';
import PopcomLogo from '../../content/POPCOM-Logo.jpg';

// mode: 'login' | 'forgot-identify' | 'forgot-verify' | 'forgot-reset'
// Helper to mask email or contact number for display
function maskIdentifier(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';

  // Phone-like: start with 09 and contains mostly digits
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.startsWith('09') && digits.length >= 7) {
    const first = digits.slice(0, 4);
    const last = digits.slice(-3);
    return `${first}****${last}`;
  }

  // Email-like
  const atIndex = value.indexOf('@');
  if (atIndex > 0) {
    const local = value.slice(0, atIndex);
    const domain = value.slice(atIndex + 1);
    const firstChar = local[0] || '';
    return `${firstChar}*******@${domain || '***.***'}`;
  }

  // Fallback: generic mask
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export function LoginModal({ opened, onClose, redirectTo, onOpenRegister }) {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [submitting, setSubmitting] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);

  const loginForm = useForm({
    initialValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
    validate: {
      username: (value) => (value && value.length >= 3 ? null : 'Username should be at least 3 characters'),
      password: (value) => (value.length >= 6 ? null : 'Password should be at least 6 characters')
    }
  });

  const resetForm = useForm({
    initialValues: {
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      newPassword: (value) => (value && value.length >= 6 ? null : 'Password should be at least 6 characters'),
      confirmPassword: (value, values) =>
        value === values.newPassword ? null : 'Passwords do not match',
    }
  });

  const closeAndReset = () => {
    setMode('login');
    setIdentifier('');
    setCode('');
    setResendSeconds(0);
    loginForm.reset();
    resetForm.reset();
    onClose?.();
  };

  const handleResendCode = async () => {
    if (resendSeconds > 0) return;
    const value = identifier.trim();
    if (!value) return;
    setSubmitting(true);
    try {
      await startPasswordReset(value);
      showNotification({
        title: 'Verification code sent',
        message: 'A new verification code has been sent if the account exists.',
        color: 'green',
      });
      setResendSeconds(120);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to resend verification code.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  // Countdown timer for resend code cooldown (used across forgot-identify and forgot-verify steps)
  useEffect(() => {
    if (resendSeconds <= 0) return;

    const id = setInterval(() => {
      setResendSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(id);
  }, [resendSeconds]);

  const handleLoginSubmit = async (values) => {
    setSubmitting(true);
    try {
      await login(values.username, values.password, redirectTo);
      closeAndReset();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartForgot = async (e) => {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) {
      showNotification({ title: 'Missing information', message: 'Please enter your email or contact number.', color: 'red' });
      return;
    }
    setSubmitting(true);
    try {
      await startPasswordReset(value);
      showNotification({
        title: 'Verification code sent',
        message: 'If an account matches these details, a verification code has been sent.',
        color: 'green',
      });
      setMode('forgot-verify');
      setResendSeconds(120);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to start password reset.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      showNotification({ title: 'Missing code', message: 'Please enter the verification code.', color: 'red' });
      return;
    }
    setSubmitting(true);
    try {
      await verifyPasswordReset(identifier.trim(), trimmed);
      showNotification({ title: 'Code verified', message: 'You can now set a new password.', color: 'green' });
      setMode('forgot-reset');
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Invalid or expired verification code.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (values) => {
    setSubmitting(true);
    try {
      await completePasswordReset(identifier.trim(), code.trim(), values.newPassword);
      showNotification({ title: 'Password updated', message: 'Your password has been changed successfully.', color: 'green' });
      // Return to login view with username prefilled if identifier looked like username/email
      setMode('login');
      resetForm.reset();
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to change password.';
      showNotification({ title: 'Error', message: msg, color: 'red' });
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
          <div className="col-md-5 d-none d-md-flex align-items-center justify-content-center" style={{ backgroundColor: '#2835bdff', margin: 0, padding:0}}>
            <div className="text-center text-white p-4">
              <img
                src={PopcomLogo}
                alt="POPCOM logo"
                style={{
                  maxWidth: '70%',
                  height: 'auto',
                  marginBottom: '1.5rem',
                  borderRadius: '100%'
                }}
              />
              <h5 className="fw-semibold mb-2">Welcome back</h5>
              <p className="small mb-0">Sign in to continue managing population office services.</p>
            </div>
          </div>

          {/* Form / right panel */}
          <div className="col-12 col-md-7" >
            <div className="p-4 p-md-5">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <h2 className="h4 fw-bold mb-0">
                  {mode === 'login' && 'Log In'}
                  {mode === 'forgot-identify' && 'Forgot Password'}
                  {mode === 'forgot-verify' && 'Verify Code'}
                  {mode === 'forgot-reset' && 'Change Password'}
                </h2>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeAndReset}
                />
              </div>

              {mode === 'login' && (
                <form
                  onSubmit={loginForm.onSubmit((values) => {
                    handleLoginSubmit(values).catch(() => {});
                  })}
                >
                  <div className="mb-3">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className={`form-control${loginForm.errors.username ? ' is-invalid' : ''}`}
                      placeholder="Your username"
                      {...loginForm.getInputProps('username')}
                    />
                    {loginForm.errors.username && <div className="invalid-feedback">{loginForm.errors.username}</div>}
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-0">Password</label>
                    <input
                      type="password"
                      className={`form-control${loginForm.errors.password ? ' is-invalid' : ''}`}
                      placeholder="Your password"
                      {...loginForm.getInputProps('password')}
                    />
                    {loginForm.errors.password && <div className="invalid-feedback">{loginForm.errors.password}</div>}
                    <div className="d-flex justify-content-end mt-1">
                      <button
                        type="button"
                        className="btn btn-link p-0 small"
                        style={{ textDecoration: 'none' }}
                        onClick={() => {
                          setMode('forgot-identify');
                          setIdentifier('');
                          setCode('');
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>
                  <br />
                  <div className="d-flex align-items-center mb-3 gap-2" >
                    <Button
                      type="submit"
                      loading={submitting}
                      className="me-2"
                      styles={{ root: { backgroundColor: '#3081faff' } }}
                    >
                      Login
                    </Button>
                    <br />
                    <span className="small me-1">Want to create an account?</span>
                    <button
                      type="button"
                      className="btn btn-link p-0 small"
                      onClick={() => {
                        closeAndReset();
                        onOpenRegister?.();
                      }}
                    >
                      Sign up
                    </button>
                  </div>
                  <div className="text-center mt-3">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-md"
                      onClick={closeAndReset}
                    >
                      Continue as guest
                    </button>
                  </div>
                  <br />
                  <div className="text-center mt-3 mb-2">
                    <span className="text-muted small"><i><b>Note:</b> By creating an account, you will be able to access the Family Planning Booking in the Service Page and the Feedback Form in the About Us page.</i></span>
                  </div>
                </form>
              )}

              {mode === 'forgot-identify' && (
                <form onSubmit={handleStartForgot}>
                  <div className="mb-3">
                    <label className="form-label">Email or contact number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter your email or 09xxxxxxxxx"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.currentTarget.value)}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <button
                      type="button"
                      className="btn btn-link p-0 small"
                      onClick={() => {
                        setMode('login');
                        setIdentifier('');
                        setCode('');
                      }}
                    >
                      Back to login
                    </button>
                    <Button
                      type="submit"
                      loading={submitting}
                      disabled={resendSeconds > 0 || submitting}
                      styles={{ root: { backgroundColor: '#3081faff' } }}
                    >
                      {resendSeconds > 0
                        ? `Send code (${Math.floor(resendSeconds / 60)}:${String(resendSeconds % 60).padStart(2, '0')})`
                        : 'Send code'}
                    </Button>
                  </div>
                </form>
              )}

              {mode === 'forgot-verify' && (
                <form onSubmit={handleVerifyCode}>
                  <div className="mb-3">
                    <label className="form-label">Verification code</label>
                    {identifier && (
                      <p className="small text-muted mb-2">
                        We sent a code to <strong>{maskIdentifier(identifier)}</strong>.
                      </p>
                    )}
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter the code you received"
                      value={code}
                      onChange={(e) => setCode(e.currentTarget.value)}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <button
                      type="button"
                      className="btn btn-link p-0 small"
                      onClick={() => {
                        setMode('forgot-identify');
                        setCode('');
                      }}
                    >
                      Back
                    </button>
                    <div className="d-flex flex-column align-items-end gap-1">
                      <Button
                        type="button"
                        variant="subtle"
                        size="xs"
                        disabled={resendSeconds > 0 || submitting}
                        onClick={handleResendCode}
                      >
                        {resendSeconds > 0
                          ? `Resend code (${Math.floor(resendSeconds / 60)}:${String(resendSeconds % 60).padStart(2, '0')})`
                          : 'Resend code'}
                      </Button>
                      <Button type="submit" loading={submitting} styles={{ root: { backgroundColor: '#3081faff' } }}>
                        Verify code
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {mode === 'forgot-reset' && (
                <form
                  onSubmit={resetForm.onSubmit((values) => {
                    handleResetPassword(values).catch(() => {});
                  })}
                >
                  <div className="mb-3">
                    <label className="form-label">New password</label>
                    <input
                      type="password"
                      className={`form-control${resetForm.errors.newPassword ? ' is-invalid' : ''}`}
                      placeholder="Enter new password"
                      {...resetForm.getInputProps('newPassword')}
                    />
                    {resetForm.errors.newPassword && (
                      <div className="invalid-feedback">{resetForm.errors.newPassword}</div>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Confirm new password</label>
                    <input
                      type="password"
                      className={`form-control${resetForm.errors.confirmPassword ? ' is-invalid' : ''}`}
                      placeholder="Re-enter new password"
                      {...resetForm.getInputProps('confirmPassword')}
                    />
                    {resetForm.errors.confirmPassword && (
                      <div className="invalid-feedback">{resetForm.errors.confirmPassword}</div>
                    )}
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <button
                      type="button"
                      className="btn btn-link p-0 small"
                      onClick={() => {
                        setMode('login');
                        resetForm.reset();
                      }}
                    >
                      Back to login
                    </button>
                    <Button type="submit" loading={submitting} styles={{ root: { backgroundColor: '#3081faff' } }}>
                      Change password
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
