import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Modal, TextInput, Select, Radio, Textarea, Button, Group, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import dayjs from 'dayjs';

import { submitClientSatisfactionFeedback } from '../../api/feedback.js';

export function ServiceBootstrapLayout({ title, imageUrl, imageAlt, showBack = true, children }) {
  const navigate = useNavigate();
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackValues, setFeedbackValues] = useState({
    clientType: '',
    date: null,
    regionOfResidence: '',
    sex: '',
    age: '',
    serviceAvailed: '',
    cc1: '',
    cc2: '',
    cc3: '',
    sqd0: '',
    sqd1: '',
    sqd2: '',
    sqd3: '',
    sqd4: '',
    sqd5: '',
    sqd6: '',
    sqd7: '',
    sqd8: '',
    suggestions: '',
    email: ''
  });
  const [feedbackErrors, setFeedbackErrors] = useState({});

  const serviceItems = [
    { to: '/services/pre-marriage-orientation', label: 'Pre-Marriage Orientation (PMOC)' },
    { to: '/services/usapan-series', label: 'Usapan Sessions' },
    { to: '/services/rpfp', label: 'Responsible Parenthood (RPFP)' },
    { to: '/services/ahdp', label: 'Adolescent Health (AHDP)' },
    { to: '/services/iec', label: 'Population Awareness (IEC)' },
    { to: '/services/population-profiling', label: 'Demographic Profiling' },
    { to: '/services/community-events', label: 'Community Events' },
    { to: '/services/other-assistance', label: 'Other Assistance' }
  ];

  const ageOptions = useMemo(
    () =>
      Array.from({ length: 91 }, (_, i) => {
        const age = i + 10;
        return { value: String(age), label: String(age) };
      }),
    []
  );

  const serviceOptions = useMemo(
    () => serviceItems.map((s) => ({ value: s.label, label: s.label })),
    [serviceItems]
  );

  const clientTypeOptions = [
    { value: 'Citizen', label: 'Citizen' },
    { value: 'Business', label: 'Business' },
    { value: 'Government', label: 'Government (Employee or another agency)' }
  ];

  const sqdOptions = [
    { value: 'SD', label: 'Strongly Disagree' },
    { value: 'D', label: 'Disagree' },
    { value: 'N', label: 'Neutral' },
    { value: 'A', label: 'Agree' },
    { value: 'SA', label: 'Strongly Agree' },
    { value: 'NA', label: 'Not Applicable' }
  ];

  const handleFieldChange = (name, value) => {
    setFeedbackValues((prev) => ({ ...prev, [name]: value }));
    setFeedbackErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const selectedWeekday = useMemo(() => {
    if (!feedbackValues.date) return '';
    try {
      return dayjs(feedbackValues.date).format('ddd');
    } catch {
      return '';
    }
  }, [feedbackValues.date]);

  const validateFeedbackForm = () => {
    const errors = {};
    const requiredFields = [
      'clientType',
      'date',
      'regionOfResidence',
      'sex',
      'age',
      'serviceAvailed',
      'cc1',
      'cc2',
      'cc3',
      'sqd0',
      'sqd1',
      'sqd2',
      'sqd3',
      'sqd4',
      'sqd5',
      'sqd6',
      'sqd7',
      'sqd8'
    ];

    requiredFields.forEach((field) => {
      if (!feedbackValues[field]) {
        errors[field] = 'This field is required';
      }
    });

    if (feedbackValues.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(feedbackValues.email)) {
      errors.email = 'Please enter a valid email address';
    }

    setFeedbackErrors(errors);

    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      // Scroll to the first unanswered required field inside the modal
      const firstKey = requiredFields.find((field) => errors[field]);
      if (firstKey) {
        const targetId = `csm-${firstKey}`;
        const el = typeof document !== 'undefined' ? document.getElementById(targetId) : null;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Try to focus the first input-like element within that section
          const focusable = el.querySelector('input, select, textarea, button, [role="textbox"]');
          if (focusable && typeof focusable.focus === 'function') {
            focusable.focus();
          }
        }
      }
    }

    return !hasErrors;
  };

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    if (!validateFeedbackForm()) return;

    setSubmittingFeedback(true);
    try {
      await submitClientSatisfactionFeedback({
        clientType: feedbackValues.clientType,
        date: feedbackValues.date ? dayjs(feedbackValues.date).format('YYYY-MM-DD') : null,
        regionOfResidence: feedbackValues.regionOfResidence,
        sex: feedbackValues.sex,
        age: Number(feedbackValues.age),
        serviceAvailed: feedbackValues.serviceAvailed,
        cc1: feedbackValues.cc1,
        cc2: feedbackValues.cc2,
        cc3: feedbackValues.cc3,
        sqd0: feedbackValues.sqd0,
        sqd1: feedbackValues.sqd1,
        sqd2: feedbackValues.sqd2,
        sqd3: feedbackValues.sqd3,
        sqd4: feedbackValues.sqd4,
        sqd5: feedbackValues.sqd5,
        sqd6: feedbackValues.sqd6,
        sqd7: feedbackValues.sqd7,
        sqd8: feedbackValues.sqd8,
        suggestions: feedbackValues.suggestions,
        email: feedbackValues.email
      });

      showNotification({
        title: 'Feedback submitted',
        message: 'Thank you for your feedback. Your response has been recorded.',
        color: 'green'
      });

      setFeedbackModalOpen(false);
      setFeedbackValues({
        clientType: '',
        date: null,
        regionOfResidence: '',
        sex: '',
        age: '',
        serviceAvailed: '',
        cc1: '',
        cc2: '',
        cc3: '',
        sqd0: '',
        sqd1: '',
        sqd2: '',
        sqd3: '',
        sqd4: '',
        sqd5: '',
        sqd6: '',
        sqd7: '',
        sqd8: '',
        suggestions: '',
        email: ''
      });
      setFeedbackErrors({});
    } catch (err) {
      console.error(err);
      const message = err?.response?.data?.error?.message || 'Failed to submit feedback.';
      showNotification({ title: 'Error', message, color: 'red' });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <section className="py-4 bg-white">
      <div className="container">
        {/* Float sidebar on the right for large screens so main text can flow underneath */}
        <aside className="d-none d-lg-block float-lg-end ms-lg-4" style={{ width: "35%" }}>
          <div className="vstack gap-3">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title h6 mb-2">Services</h5>
                <hr />
                <div className="row small">
                  <div className="col-12">
                    <ul className="list-styled mb-0">
                      {serviceItems.slice(0, Math.ceil(serviceItems.length)).map((s) => (
                        <li key={s.to} className="mb-1"><Link to={s.to} className="text-decoration-none">{s.label}</Link></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-body" >
                <h5 className="card-title h6 mb-2"><b>Population Office Location</b></h5>
                <hr />
                <div className="ratio ratio-4x3 rounded overflow-hidden mb-3">
                  <iframe
                    title="San Fabian Population Office Location"
                    src="https://www.google.com/maps?q=16.120723263859666,120.40280245009167&z=15&output=embed"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <Link to="/services/meif-template" className="btn btn-outline-primary w-100 btn-sm">
                  View MEIF Form
                </Link>
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100 btn-sm mt-2"
                  onClick={() => setFeedbackModalOpen(true)}
                >
                  View Client Feedback Form
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="service-content fs-6" style={{ display: 'contents', whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
            {showBack ? (
              <div className="d-flex mb-3">
                <button
                  className="btn btn-primary rounded-pill px-4 py-2 d-inline-flex align-items-center shadow-sm"
                  onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/services'))}
                  aria-label="Go back"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" className="me-2" aria-hidden="true" focusable="false">
                    <path d="M11.354 1.146a.5.5 0 0 1 0 .708L5.207 8l6.147 6.146a.5.5 0 0 1-.708.708l-6.5-6.5a.5.5 0 0 1 0-.708l6.5-6.5a.5.5 0 0 1 .708 0z"/>
                  </svg>
                  Back
                </button>
              </div>
            ) : null}
            
            {imageUrl ? (
              <div className="card border-0 mb-3">
                <div className="card-body p-1 d-flex justify-content-center">
                  <img
                    src={imageUrl}
                    alt={imageAlt || title}
                    className="img-fluid rounded"
                    style={{
                      height: 'auto',
                      maxWidth: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              </div>
            ) : null}

            {title ? (
              <h1 className="h3 fw-bold mb-3" style={{paddingBottom: '1rem'}}>{title}</h1>
            ) : null}

            {children}
        </div>
        

        {/* Stacked sidebar for small screens */}
        <div className="d-lg-none mt-4">
          <div className="vstack gap-3">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title h6 mb-2">Services</h5>
                <hr />
                <div className="row small">
                  <div className="col-6">
                    <ul className="list-styled mb-0">
                      {serviceItems.slice(0, Math.ceil(serviceItems.length / 2)).map((s) => (
                        <li key={s.to} className="mb-1"><Link to={s.to}>{s.label}</Link></li>
                      ))}
                    </ul>
                  </div>
                  <div className="col-6">
                    <ul className="list-styled mb-0">
                      {serviceItems.slice(Math.ceil(serviceItems.length / 2)).map((s) => (
                        <li key={s.to} className="mb-1"><Link to={s.to}>{s.label}</Link></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title h6 mb-2"><b>Population Office Location</b></h5>
                <div className="ratio ratio-4x3 rounded overflow-hidden mb-3">
                  <iframe
                    title="San Fabian Population Office Location"
                    src="https://www.google.com/maps?q=16.120723263859666,120.40280245009167&z=15&output=embed"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <Link to="/services/meif-template" className="btn btn-outline-primary w-100 btn-sm">
                  View MEIF Form
                </Link>
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100 btn-sm mt-2"
                  onClick={() => setFeedbackModalOpen(true)}
                >
                  View Client Feedback Form
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal
        opened={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        title={
          <h5 className="mb-0 fw-bold">Client Satisfaction Measurement (CSM) Form</h5>
        }
        size="xl"
        centered
      >
        <form onSubmit={handleFeedbackSubmit} className="fs-6">
          <div className="container-fluid p-3 p-md-4">
            {/* Header, similar to survey screenshot */}
            <div className="mb-4 border-bottom pb-3">
              <h2 className="h4 fw-bold mb-1">Client Satisfaction Questionnaire</h2>
              <p className="text-muted mb-0">
                Thank you for taking the time to answer these questions. Your feedback helps us understand how well our
                services are meeting your needs.
              </p>
            </div>

            {/* 1. Respondent Information */}
            <div className="mb-4">
              <p className="fw-semibold mb-3">1. Respondent Information</p>

              {/* Row 1: Client type / Date */}
              <div className="row g-3 mb-3">
                <div className="col-md-6" id="csm-clientType">
                  <Select
                    label="Client type"
                    placeholder="Select client type"
                    data={clientTypeOptions}
                    value={feedbackValues.clientType}
                    onChange={(value) => handleFieldChange('clientType', value || '')}
                    error={feedbackErrors.clientType}
                    withCheckIcon={false}
                  />
                </div>
                <div className="col-md-6" id="csm-date">
                  <DatePickerInput
                    label="Date"
                    placeholder="Select a date"
                    firstDayOfWeek={0}
                    value={feedbackValues.date}
                    onChange={(value) => handleFieldChange('date', value)}
                    error={feedbackErrors.date}
                    maxDate={new Date()}
                  />
                  {selectedWeekday && (
                    <Text size="xs" c="dimmed" mt={2}>
                      Selected day: {selectedWeekday}
                    </Text>
                  )}
                </div>
              </div>

              {/* Row 2: Region / Sex */}
              <div className="row g-3 mb-3">
                <div className="col-md-6" id="csm-regionOfResidence">
                  <TextInput
                    label="Region of residence"
                    value={feedbackValues.regionOfResidence}
                    onChange={(e) => handleFieldChange('regionOfResidence', e.currentTarget.value)}
                    error={feedbackErrors.regionOfResidence}
                  />
                </div>
                <div className="col-md-6">
                  <Radio.Group
                    label="Sex"
                    value={feedbackValues.sex}
                    onChange={(value) => handleFieldChange('sex', value)}
                    error={feedbackErrors.sex}
                  >
                    <div className="d-flex gap-3 mt-2">
                      <Radio value="Male" label="Male" />
                      <Radio value="Female" label="Female" />
                    </div>
                  </Radio.Group>
                </div>
              </div>

              {/* Row 3: Service Availed / Age */}
              <div className="row g-3">
                <div className="col-md-6" id="csm-serviceAvailed">
                  <Select
                    label="Service Availed"
                    placeholder="Select service"
                    data={serviceOptions}
                    value={feedbackValues.serviceAvailed}
                    onChange={(value) => handleFieldChange('serviceAvailed', value || '')}
                    error={feedbackErrors.serviceAvailed}
                    withCheckIcon={false}
                  />
                </div>
                <div className="col-md-6">
                  <Select
                    label="Age"
                    placeholder="Age"
                    data={ageOptions}
                    value={feedbackValues.age}
                    onChange={(value) => handleFieldChange('age', value || '')}
                    error={feedbackErrors.age}
                    withCheckIcon={false}
                    searchable
                    clearable
                    nothingFoundMessage="No matching age"
                  />
                </div>
              </div>
            </div>
            <hr />

            {/* 2. CC Questions */}
            <div className="mb-4">
              <p className="fw-semibold mb-2">2. Citizen's Charter (CC) Questions</p>
              <p className="text-muted mb-3">
                For each of the following, please select the answer that best reflects your experience.
              </p>

              <div className="mb-4" id="csm-cc1">
                <p className="mb-2">2.1 Which of the following best describes your awareness of a CC?</p>
                <div className="ms-3">
                  <Radio.Group
                    value={feedbackValues.cc1}
                    onChange={(value) => handleFieldChange('cc1', value)}
                    error={feedbackErrors.cc1}
                  >
                    <div className="d-flex flex-column gap-1">
                      <Radio value="1" label="I know what a CC is and I saw this office's CC." />
                      <Radio value="2" label="I know what a CC is but I did NOT see this office's CC." />
                      <Radio value="3" label="I learned of the CC only when I saw this office's CC." />
                      <Radio value="4" label="I do not know what a CC is and I did not see one in this office." />
                    </div>
                  </Radio.Group>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2">2.2 If aware of CC, would you say that the CC of this office was ...? (If not aware, select N/A)</p>
                <div className="ms-3">
                  <Radio.Group
                    value={feedbackValues.cc2}
                    onChange={(value) => handleFieldChange('cc2', value)}
                    error={feedbackErrors.cc2}
                  >
                    <div className="d-flex flex-column gap-1">
                      <Radio value="1" label="Easy to see" />
                      <Radio value="2" label="Somewhat easy to see" />
                      <Radio value="3" label="Difficult to see" />
                      <Radio value="4" label="Not visible at all" />
                      <Radio value="5" label="N/A" />
                    </div>
                  </Radio.Group>
                </div>
              </div>

              <div className="mb-3" id="csm-cc3">
                <p className="mb-2">2.3 If aware of CC, how much did the CC help your transaction?</p>
                <div className="ms-3">
                  <Radio.Group
                    value={feedbackValues.cc3}
                    onChange={(value) => handleFieldChange('cc3', value)}
                    error={feedbackErrors.cc3}
                  >
                    <div className="d-flex flex-column gap-1">
                      <Radio value="1" label="Helped very much" />
                      <Radio value="2" label="Somewhat helped" />
                      <Radio value="3" label="Did not help" />
                      <Radio value="4" label="N/A" />
                    </div>
                  </Radio.Group>
                </div>
              </div>
            </div>
            <hr />
            {/* 3. SQD Questions */}
            <div className="mb-4">
              <p className="fw-semibold mb-2">3. Service Quality Dimensions (SQD)</p>
              <p className="text-muted mb-3">
                For SQD01, please choose one option for each statement.
              </p>

              <div className="d-flex flex-column gap-3">
                {[
                  {
                    key: 'sqd0',
                    label: 'SQD0. I am satisfied with the service that I availed.'
                  },
                  {
                    key: 'sqd1',
                    label: 'SQD1. I spent a reasonable amount of time for my transaction.'
                  },
                  {
                    key: 'sqd2',
                    label:
                      "SQD2. The office followed the transaction's requirements and steps based on the information provided."
                  },
                  {
                    key: 'sqd3',
                    label:
                      'SQD3. The steps (including payment) I needed to do for my transaction were easy and simple.'
                  },
                  {
                    key: 'sqd4',
                    label:
                      'SQD4. I easily found information about my transaction from the office or its website.'
                  },
                  {
                    key: 'sqd5',
                    label: 'SQD5. I paid a reasonable amount of fees for my transaction.'
                  },
                  {
                    key: 'sqd6',
                    label:
                      'SQD6. I felt the office was fair to everyone, or "walang palakasan", during my transaction.'
                  },
                  {
                    key: 'sqd7',
                    label:
                      'SQD7. I was treated courteously by the staff, and (if I asked for help) the staff was helpful.'
                  },
                  {
                    key: 'sqd8',
                    label:
                      'SQD8. I got what I needed from the government office, or (if denied) denial of request was sufficiently explained to me.'
                  }
                ].map((q, index) => (
                  <div key={q.key} id={`csm-${q.key}`}>
                    <p className="mb-1">{q.label}</p>
                    <div className="ms-3">
                      <Radio.Group
                        value={feedbackValues[q.key]}
                        onChange={(value) => handleFieldChange(q.key, value)}
                        error={feedbackErrors[q.key]}
                      >
                        <div className="d-flex flex-column gap-1">
                          {sqdOptions.map((opt) => (
                            <Radio key={opt.value} value={opt.value} label={opt.label} />
                          ))}
                        </div>
                      </Radio.Group>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <hr />
            {/* 4. Additional Feedback */}
            <div className="mb-4">
              <p className="fw-semibold mb-2">4. Additional Feedback (Optional)</p>
              <div className="mb-3">
                <Textarea
                  label="Suggestions on how we can further improve our services (optional)"
                  autosize
                  minRows={3}
                  maxRows={8}
                  value={feedbackValues.suggestions}
                  onChange={(e) => handleFieldChange('suggestions', e.currentTarget.value)}
                />
              </div>
              <div className="mb-2">
                <TextInput
                  type="email"
                  label="Email address (optional)"
                  value={feedbackValues.email}
                  onChange={(e) => handleFieldChange('email', e.currentTarget.value)}
                  error={feedbackErrors.email}
                />
              </div>
            </div>

            <p className="text-center fw-semibold mt-2 mb-4">THANK YOU!</p>

            <div className="d-flex justify-content-end gap-2">
              <Button type="submit" loading={submittingFeedback}>
                Submit Feedback
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </section>
  );
}
