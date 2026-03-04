import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  FileInput,
  Grid,
  Group,
  Modal,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import { usePmoBooking } from '../../context/PmoBookingContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { createPmoBooking, getPmoQuestionnaire } from '../../api/pmo.js';

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function calculateAge(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age -= 1;
  }
  return String(Math.max(age, 0));
}

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function compressImageToDataUrl(file, { maxWidth = 900, maxHeight = 900, quality = 0.7 } = {}) {
  const dataUrl = await fileToDataUrl(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      const targetW = Math.round(width * ratio);
      const targetH = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      } catch (_) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const ANSWER_OPTIONS = [
  { value: 'Agree', label: 'Agree' },
  { value: 'Neutral / Unsure', label: 'Neutral / Unsure' },
  { value: 'Disagree', label: 'Disagree' },
];

const PH_RELIGION_OPTIONS = [
  'Roman Catholic',
  'Iglesia ni Cristo',
  'Evangelical / Born Again Christian',
  'Protestant (other)',
  'Aglipayan / Philippine Independent Church',
  'Seventh-day Adventist',
  "Jehovah's Witnesses",
  'Other Christian',
  'Islam',
  'Tribal / Indigenous beliefs',
  'Buddhist',
  'Hindu',
  'No religion / None',
  'Prefer not to say',
];

const PH_EDUCATION_OPTIONS = [
  'No formal education',
  'Elementary level',
  'Junior high school level',
  'Senior high school level',
  'Technical/vocational',
  'College level',
  'College graduate',
  'Post-graduate',
  'Prefer not to say',
];

function isAlphaText(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^[A-Za-zÀ-ÿ\s'.-]+$/.test(s);
}

function digitsOnly(v) {
  return String(v || '').replace(/[^0-9]/g, '');
}

function validateContactNumber(v) {
  const s = String(v || '').trim();
  if (!s) return 'Required';
  if (!/^09\d{9}$/.test(s)) {
    return 'Contact number must be 11 digits and start with 09';
  }
  return null;
}

function validateIdNumberByType(type, raw) {
  const value = String(raw || '').trim();
  if (!value) return 'Required';
  const digits = digitsOnly(value);

  switch (type) {
    case 'National ID':
      if (!/^\d{12}$/.test(digits)) return 'National ID must have 12 digits';
      return null;
    case "Driver's License":
      if (!/^\d{11}$/.test(digits)) return "Driver's License must have 11 digits";
      return null;
    case 'Passport': {
      if (!/^[A-Za-z][0-9]{7}[A-Za-z]$/.test(value)) {
        return 'Passport must be 9 characters (letter, 7 digits, letter)';
      }
      return null;
    }
    case "Voter's ID":
      if (!/^\d{12}$/.test(digits)) return "Voter's ID must have 12 digits";
      return null;
    case 'SSS/UMID':
      if (!/^\d{10}$/.test(digits)) return 'SSS/UMID number must have 10 digits';
      return null;
    case 'PhilHealth ID':
      if (!/^\d{12}$/.test(digits)) return 'PhilHealth ID must have 12 digits';
      return null;
    case 'Postal ID':
      if (!/^[A-Za-z0-9]{16}$/.test(value)) return 'Postal ID must be 16 letters / digits';
      return null;
    case 'Barangay ID':
      if (!/^\d{4,12}$/.test(digits)) return 'Barangay ID must have between 4 and 12 digits';
      return null;
    default:
      return null;
  }
}

function isAnswerable(q) {
  return q.question_type !== 'Filler';
}

function sortQuestions(a, b) {
  const ao = Number(a?.sort_order ?? 0);
  const bo = Number(b?.sort_order ?? 0);
  if (ao !== bo) return ao - bo;
  return Number(a?.questionID ?? 0) - Number(b?.questionID ?? 0);
}

export function PmoWizardModal({ opened, onClose, schedulesLoading, schedules, month, setMonth }) {
  const { draft, updateDraft, updatePersonalInfo, updateQuestionnaireAnswers, clearDraft } = usePmoBooking();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [personalStepValid, setPersonalStepValid] = useState(true);
  const scrollRef = useRef(null);

  const selectedScheduleId = draft.schedule?.id || null;
  const selectedSchedule = useMemo(
    () => schedules.find((s) => s.id === selectedScheduleId) || null,
    [schedules, selectedScheduleId]
  );

  const visibleSchedules = useMemo(() => {
    const m = dayjs(month);
    const now = dayjs();

    return schedules.filter((s) => {
      const d = dayjs(s.date);
      if (!d.isValid()) return false;

      // Only show schedules in the selected month
      if (!d.isSame(m, 'month')) return false;

      // Hide past schedules
      if (d.isBefore(now, 'minute')) return false;

      // Hide schedules explicitly marked as finished (case-insensitive)
      const status = (s.status || '').toString().toLowerCase();
      if (status === 'finished') return false;

      return true;
    });
  }, [month, schedules]);

  // Questionnaire
  const [qLoading, setQLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [qErrors, setQErrors] = useState({});

  useEffect(() => {
    if (!opened) return;
    // Reset to step 1 when reopened
    setStep(1);
    setSubmitted(false);
    setSubmitting(false);
    setPersonalStepValid(true);
  }, [opened]);

  useEffect(() => {
    if (!opened) return;
    if (step !== 3) return;

    setQLoading(true);
    getPmoQuestionnaire()
      .then((res) => setQuestions(res.data.data || []))
      .catch(() => setQuestions([]))
      .finally(() => setQLoading(false));
  }, [opened, step]);

  const orderedQuestions = useMemo(() => {
    const list = questions || [];
    const byParent = new Map();
    for (const q of list) {
      const key = q.parent_question_id ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(q);
    }
    for (const [k, v] of byParent.entries()) {
      v.sort(sortQuestions);
      byParent.set(k, v);
    }

    const out = [];
    const walk = (parentId, depth) => {
      const children = byParent.get(parentId ?? null) || [];
      for (const child of children) {
        out.push({ ...child, __depth: depth });
        walk(child.questionID, depth + 1);
      }
    };

    walk(null, 0);
    return out;
  }, [questions]);

  const answers = draft.questionnaireAnswers || {};

  const getPersonAnswer = (questionID, personKey) => {
    const cur = answers?.[questionID]?.[personKey];
    return cur && typeof cur === 'object' ? cur : { answer: '', reason: '' };
  };

  const validateQuestionnaireAll = () => {
    const nextErrors = {};

    for (const q of orderedQuestions) {
      if (!isAnswerable(q)) continue;

      const h = getPersonAnswer(q.questionID, 'husband');
      const w = getPersonAnswer(q.questionID, 'wife');

      if (!h?.answer) nextErrors[`h-${q.questionID}`] = 'Husband answer is required';
      if (!h?.reason || h.reason.trim().length === 0) nextErrors[`h-${q.questionID}`] = 'Husband reason is required';

      if (!w?.answer) nextErrors[`w-${q.questionID}`] = 'Wife answer is required';
      if (!w?.reason || w.reason.trim().length === 0) nextErrors[`w-${q.questionID}`] = 'Wife reason is required';
    }

    setQErrors(nextErrors);
    const keys = Object.keys(nextErrors);
    if (keys.length === 0) return true;

    // Scroll to the first question card with an error
    const firstKey = keys[0]; // format: "h-<id>" or "w-<id>"
    const parts = firstKey.split('-');
    const qId = parts.length > 1 ? parts[1] : null;
    if (qId) {
      const el = document.getElementById(`pmo-q-${qId}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return false;
  };

  // Personal Info Form and auth state
  const { sessionExpired, user } = useAuth();

  const initialPersonalValues = useMemo(() => {
    const pi = draft.personalInfo || {};
    return {
      ...pi,
      // Default contact values from logged-in user
      // Always prefer the current user's contact/email over any saved draft values
      main_contact: user?.contactNumber || pi.main_contact || '',
      email: user?.email || pi.email || '',
      husband_birthday: parseDateOrNull(pi.husband_birthday),
      wife_birthday: parseDateOrNull(pi.wife_birthday),
      marriage_date: parseDateOrNull(pi.marriage_date),
    };
  }, [draft.personalInfo, user]);

  const personalForm = useForm({
    initialValues: initialPersonalValues,
    validate: {
      husband_name: (v) => {
        if (String(v || '').trim().length === 0) return 'Required';
        if (!isAlphaText(v)) return 'Name must contain letters only';
        return null;
      },
      husband_birthday: (v) => (v ? null : 'Required'),
      husband_address: (v) => (v.trim().length === 0 ? 'Required' : null),
      husband_occupation: (v) => (v.trim().length === 0 ? 'Required' : null),
      husband_religion: (v) => (v ? null : 'Required'),
      husband_educational_attainment: (v) => (v ? null : 'Required'),
      husband_citizenship: (v) => {
        if (String(v || '').trim().length === 0) return 'Required';
        if (!isAlphaText(v)) return 'Citizenship must contain letters only';
        return null;
      },
      husband_id_type: (v) => (v ? null : 'Required'),
      husband_id_number: (v, values) => validateIdNumberByType(values.husband_id_type, v),
      husband_id_photo: (v) => (String(v || '').trim().length === 0 ? 'ID photo is required' : null),
      husband_4ps: (v) => (typeof v === 'boolean' ? null : 'Required'),
      husband_pwd: (v) => (typeof v === 'boolean' ? null : 'Required'),

      wife_name: (v) => {
        if (String(v || '').trim().length === 0) return 'Required';
        if (!isAlphaText(v)) return 'Name must contain letters only';
        return null;
      },
      wife_birthday: (v) => (v ? null : 'Required'),
      wife_address: (v) => (v.trim().length === 0 ? 'Required' : null),
      wife_occupation: (v) => (v.trim().length === 0 ? 'Required' : null),
      wife_religion: (v) => (v ? null : 'Required'),
      wife_educational_attainment: (v) => (v ? null : 'Required'),
      wife_citizenship: (v) => {
        if (String(v || '').trim().length === 0) return 'Required';
        if (!isAlphaText(v)) return 'Citizenship must contain letters only';
        return null;
      },
      wife_id_type: (v) => (v ? null : 'Required'),
      wife_id_number: (v, values) => validateIdNumberByType(values.wife_id_type, v),
      wife_id_photo: (v) => (String(v || '').trim().length === 0 ? 'ID photo is required' : null),
      wife_4ps: (v) => (typeof v === 'boolean' ? null : 'Required'),
      wife_pwd: (v) => (typeof v === 'boolean' ? null : 'Required'),

      // Marriage info is optional. Only validate date/officer when the user explicitly indicates there is a marriage date.
      has_marriage_date: () => null,
      marriage_date: (v, values) => (values.has_marriage_date ? (v ? null : 'Required') : null),
      solemnizing_officer: (v, values) => (values.has_marriage_date ? (v.trim().length === 0 ? 'Required' : null) : null),
      main_contact: (v) => validateContactNumber(v),
      backup_contact: (v) => validateContactNumber(v),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Valid email is required'),
    },
  });

  const lastPersonalSyncRef = useRef(null);

  useEffect(() => {
    const husbandAge = calculateAge(personalForm.values.husband_birthday);
    const wifeAge = calculateAge(personalForm.values.wife_birthday);

    if (personalForm.values.husband_age !== husbandAge) personalForm.setFieldValue('husband_age', husbandAge);
    if (personalForm.values.wife_age !== wifeAge) personalForm.setFieldValue('wife_age', wifeAge);
  }, [personalForm.values.husband_birthday, personalForm.values.wife_birthday]);

  useEffect(() => {
    if (!opened) return;

    const values = personalForm.values;
    const payload = {
      ...values,
      husband_birthday: values.husband_birthday ? values.husband_birthday.toISOString().slice(0, 10) : null,
      wife_birthday: values.wife_birthday ? values.wife_birthday.toISOString().slice(0, 10) : null,
      marriage_date:
        values.has_marriage_date && values.marriage_date
          ? values.marriage_date.toISOString().slice(0, 10)
          : null,
      solemnizing_officer: values.has_marriage_date ? values.solemnizing_officer : null,
    };

    const serialized = JSON.stringify(payload);
    if (lastPersonalSyncRef.current === serialized) return;
    lastPersonalSyncRef.current = serialized;

    updatePersonalInfo(payload);
  }, [opened, personalForm.values, updatePersonalInfo]);

  const closeWizard = () => {
    onClose();
  };

  const headerMeta =
    step === 1
      ? { label: 'Step 1 of 4', title: 'Select Schedule'}
      : step === 2
        ? { label: 'Step 2 of 4', title: 'Personal Information' }
        : step === 3
          ? { label: 'Step 3 of 4', title: 'Questionnaire' }
          : { label: 'Step 4 of 4', title: 'Confirmation' };

  const payload = useMemo(() => {
    const pi = draft.personalInfo || {};
    const personalInfo = {
      ...pi,
      marriage_date: pi.has_marriage_date ? (pi.marriage_date || null) : null,
      solemnizing_officer: pi.has_marriage_date ? (pi.solemnizing_officer || null) : null,
    };
    // Backend Joi schema does not include has_marriage_date
    delete personalInfo.has_marriage_date;

    const answersArray = [];
    const obj = draft.questionnaireAnswers || {};
    for (const [questionIDRaw, v] of Object.entries(obj)) {
      const questionID = Number(questionIDRaw);
      if (!Number.isInteger(questionID)) continue;

      const husband = v?.husband;
      const wife = v?.wife;

      if (husband?.answer && husband?.reason) {
        answersArray.push({ questionID, isHusband: true, answer: husband.answer, reason: husband.reason });
      }
      if (wife?.answer && wife?.reason) {
        answersArray.push({ questionID, isHusband: false, answer: wife.answer, reason: wife.reason });
      }
    }

    return {
      schedule: draft.schedule,
      personalInfo,
      answers: answersArray,
    };
  }, [draft.personalInfo, draft.questionnaireAnswers, draft.schedule]);

  const canSubmit = Boolean(draft?.schedule?.id);

  const handleSubmit = async () => {
    if (!canSubmit || submitted) return;
    if (sessionExpired) {
      showNotification({
        title: 'Session expired',
        message: 'Please log in again before submitting your PMO booking.',
        color: 'red',
      });
      return;
    }
    setSubmitting(true);
    try {
      console.log('PMO booking payload:', payload);
      await createPmoBooking(payload);
      setSubmitted(true);
      clearDraft();
      personalForm.reset();
      showNotification({
        title: 'Submitted',
        message: 'Your PMO booking has been submitted successfully.',
        color: 'green',
      });
      // Auto-close the wizard shortly after a successful submission
      setTimeout(() => {
        closeWizard();
      }, 2000);
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to submit PMO booking.', color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (step === 1) {
      return (
        <>
          <div className="d-flex justify-content-center align-items-center gap-2 mb-3">
            <ActionIcon variant="default" onClick={() => setMonth((prev) => dayjs(prev).add(-1, 'month').toDate())}>
              {'<'}
            </ActionIcon>
            <Text fw={600}>{dayjs(month).format('MMMM YYYY')}</Text>
            <ActionIcon variant="default" onClick={() => setMonth((prev) => dayjs(prev).add(1, 'month').toDate())}>
              {'>'}
            </ActionIcon>
            <Button size="xs" variant="light" onClick={() => setMonth(new Date())}>
              Today
            </Button>
          </div>

          {schedulesLoading ? (
            <Text c="dimmed">Loading schedules...</Text>
          ) : schedules.length === 0 ? (
            <Text c="dimmed">No available schedules at the moment.</Text>
          ) : (
            <Box className="pmo-schedule-scroll" style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              <Radio.Group
                value={selectedScheduleId}
                onChange={(value) => {
                  const found = schedules.find((s) => s.id === value) || null;
                  updateDraft({ schedule: found });
                }}
              >
                <Stack>
                  {visibleSchedules.map((s) => (
                    <div
                      key={s.id}
                      className={`card mb-2 border-1 ${selectedScheduleId === s.id ? 'border-primary bg-primary-subtle' : ''}`}
                      style={{ cursor: 'pointer', transition: 'background 120ms ease, border-color 120ms ease' }}
                      onClick={() => updateDraft({ schedule: s })}
                    >
                      <div className="card-body py-2 px-3">
                        <Group justify="space-between" align="flex-start">
                          <Stack gap={2} style={{ flex: 1 }}>
                            <Text fw={600}>{formatDateTime(s.date)}</Text>
                            <Text size="sm" c="dimmed">
                              {s.place}
                            </Text>
                            <Text size="sm">Assigned counselor: {s.counselor}</Text>
                          </Stack>
                          <Radio value={s.id} aria-label={`Select schedule ${formatDateTime(s.date)}`} />
                        </Group>
                      </div>
                    </div>
                  ))}
                </Stack>
              </Radio.Group>
            </Box>
          )}

          {selectedSchedule && (
            <div className="card border-0 bg-light mt-3">
              <div className="card-body py-2 px-3">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Badge color="blue" variant="light">
                        Selected schedule
                      </Badge>
                      <Text fw={600}>{formatDateTime(selectedSchedule.date)}</Text>
                    </Group>
                    <Text size="sm">{selectedSchedule.place}</Text>
                    <Text size="sm" c="dimmed">
                      Counselor: {selectedSchedule.counselor}
                    </Text>
                  </Stack>
                </Group>
              </div>
            </div>
          )}
        </>
      );
    }

    if (step === 2) {
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <Grid gutter="md">
            <Grid.Col span={12}>
              <Divider
                label="Husband"
                labelPosition="left"
                my="xs"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Husband Name"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('husband_name')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <DatePickerInput
                label="Husband Birthday"
                required
                withAsterisk={false}
                value={personalForm.values.husband_birthday}
                onChange={(v) => personalForm.setFieldValue('husband_birthday', v)}
                firstDayOfWeek={0}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Husband Age" value={personalForm.values.husband_age || ''} disabled />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Husband Address"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('husband_address')}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Husband Occupation"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('husband_occupation')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Husband Religion (Philippines)"
                required
                withAsterisk={false}
                data={PH_RELIGION_OPTIONS}
                value={personalForm.values.husband_religion || ''}
                onChange={(v) => personalForm.setFieldValue('husband_religion', v || '')}
                error={personalForm.errors.husband_religion}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Husband Educational Attainment"
                required
                withAsterisk={false}
                data={PH_EDUCATION_OPTIONS}
                value={personalForm.values.husband_educational_attainment || ''}
                onChange={(v) => personalForm.setFieldValue('husband_educational_attainment', v || '')}
                error={personalForm.errors.husband_educational_attainment}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Husband Citizenship"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('husband_citizenship')}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Husband ID Type"
                required
                withAsterisk={false}
                data={[
                  'National ID',
                  "Driver's License",
                  'Passport',
                  "Voter's ID",
                  'SSS/UMID',
                  'PhilHealth ID',
                  'Postal ID',
                  'Barangay ID',
                ]}
                value={personalForm.values.husband_id_type}
                onChange={(v) => personalForm.setFieldValue('husband_id_type', v)}
                error={personalForm.errors.husband_id_type}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Husband ID Number"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('husband_id_number')}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <FileInput
                label="Husband ID Photo"
                required
                placeholder="Upload image (JPG/PNG)"
                accept="image/png,image/jpeg"
                onChange={async (file) => {
                  if (!file) {
                    personalForm.setFieldValue('husband_id_photo', '');
                    return;
                  }
                  const maxSize = 5 * 1024 * 1024;
                  if (file.size > maxSize) {
                    personalForm.setFieldError('husband_id_photo', 'Max file size is 5MB');
                    return;
                  }
                  try {
                    const dataUrl = await compressImageToDataUrl(file, { maxWidth: 900, maxHeight: 900, quality: 0.72 });
                    personalForm.setFieldValue('husband_id_photo', dataUrl);
                  } catch {
                    personalForm.setFieldError('husband_id_photo', 'Failed to read file');
                  }
                }}
                error={personalForm.errors.husband_id_photo}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  4P's Beneficiary?
                </Text>
                <Radio.Group
                  value={
                    typeof personalForm.values.husband_4ps === 'boolean'
                      ? String(personalForm.values.husband_4ps)
                      : ''
                  }
                  onChange={(v) => personalForm.setFieldValue('husband_4ps', v === 'true')}
                >
                  <Group>
                    <Radio value="true" label="Yes" />
                    <Radio value="false" label="No" />
                  </Group>
                </Radio.Group>
                {personalForm.errors.husband_4ps && (
                  <Text size="xs" c="red">
                    {personalForm.errors.husband_4ps}
                  </Text>
                )}
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  PWD?
                </Text>
                <Radio.Group
                  value={
                    typeof personalForm.values.husband_pwd === 'boolean'
                      ? String(personalForm.values.husband_pwd)
                      : ''
                  }
                  onChange={(v) => personalForm.setFieldValue('husband_pwd', v === 'true')}
                >
                  <Group>
                    <Radio value="true" label="Yes" />
                    <Radio value="false" label="No" />
                  </Group>
                </Radio.Group>
                {personalForm.errors.husband_pwd && (
                  <Text size="xs" c="red">
                    {personalForm.errors.husband_pwd}
                  </Text>
                )}
              </Stack>
            </Grid.Col>

            <Grid.Col span={12}>
              <Divider
                label="Wife"
                labelPosition="left"
                my="xs"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Wife Name"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('wife_name')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <DatePickerInput
                label="Wife Birthday"
                required
                withAsterisk={false}
                value={personalForm.values.wife_birthday}
                onChange={(v) => personalForm.setFieldValue('wife_birthday', v)}
                firstDayOfWeek={0}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Wife Age" value={personalForm.values.wife_age || ''} disabled />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Wife Address"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('wife_address')}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Wife Occupation"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('wife_occupation')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Wife Religion (Philippines)"
                required
                withAsterisk={false}
                data={PH_RELIGION_OPTIONS}
                value={personalForm.values.wife_religion || ''}
                onChange={(v) => personalForm.setFieldValue('wife_religion', v || '')}
                error={personalForm.errors.wife_religion}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Wife Educational Attainment"
                required
                withAsterisk={false}
                data={PH_EDUCATION_OPTIONS}
                value={personalForm.values.wife_educational_attainment || ''}
                onChange={(v) => personalForm.setFieldValue('wife_educational_attainment', v || '')}
                error={personalForm.errors.wife_educational_attainment}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Wife Citizenship"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('wife_citizenship')}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Wife ID Type"
                required
                withAsterisk={false}
                data={[
                  'National ID',
                  "Driver's License",
                  'Passport',
                  "Voter's ID",
                  'SSS/UMID',
                  'PhilHealth ID',
                  'Postal ID',
                  'Barangay ID',
                ]}
                value={personalForm.values.wife_id_type}
                onChange={(v) => personalForm.setFieldValue('wife_id_type', v)}
                error={personalForm.errors.wife_id_type}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Wife ID Number"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('wife_id_number')}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <FileInput
                label="Wife ID Photo"
                required
                placeholder="Upload image (JPG/PNG)"
                accept="image/png,image/jpeg"
                onChange={async (file) => {
                  if (!file) {
                    personalForm.setFieldValue('wife_id_photo', '');
                    return;
                  }
                  const maxSize = 5 * 1024 * 1024;
                  if (file.size > maxSize) {
                    personalForm.setFieldError('wife_id_photo', 'Max file size is 5MB');
                    return;
                  }
                  try {
                    const dataUrl = await compressImageToDataUrl(file, { maxWidth: 900, maxHeight: 900, quality: 0.72 });
                    personalForm.setFieldValue('wife_id_photo', dataUrl);
                  } catch {
                    personalForm.setFieldError('wife_id_photo', 'Failed to read file');
                  }
                }}
                error={personalForm.errors.wife_id_photo}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  4P's Beneficiary?
                </Text>
                <Radio.Group
                  value={
                    typeof personalForm.values.wife_4ps === 'boolean'
                      ? String(personalForm.values.wife_4ps)
                      : ''
                  }
                  onChange={(v) => personalForm.setFieldValue('wife_4ps', v === 'true')}
                >
                  <Group>
                    <Radio value="true" label="Yes" />
                    <Radio value="false" label="No" />
                  </Group>
                </Radio.Group>
                {personalForm.errors.wife_4ps && (
                  <Text size="xs" c="red">
                    {personalForm.errors.wife_4ps}
                  </Text>
                )}
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  PWD?
                </Text>
                <Radio.Group
                  value={
                    typeof personalForm.values.wife_pwd === 'boolean'
                      ? String(personalForm.values.wife_pwd)
                      : ''
                  }
                  onChange={(v) => personalForm.setFieldValue('wife_pwd', v === 'true')}
                >
                  <Group>
                    <Radio value="true" label="Yes" />
                    <Radio value="false" label="No" />
                  </Group>
                </Radio.Group>
                {personalForm.errors.wife_pwd && (
                  <Text size="xs" c="red">
                    {personalForm.errors.wife_pwd}
                  </Text>
                )}
              </Stack>
            </Grid.Col>

            <Grid.Col span={12}>
              <Divider
                label="Marriage and Contact Information"
                labelPosition="left"
                my="xs"
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Is there a Date of Marriage?
                </Text>
                <Radio.Group
                  value={
                    typeof personalForm.values.has_marriage_date === 'boolean'
                      ? String(personalForm.values.has_marriage_date)
                      : ''
                  }
                  onChange={(v) => {
                    const yes = v === 'true';
                    personalForm.setFieldValue('has_marriage_date', yes);
                    if (!yes) {
                      personalForm.setFieldValue('marriage_date', null);
                      personalForm.setFieldValue('solemnizing_officer', '');
                    }
                  }}
                >
                  <Group>
                    <Radio value="true" label="Yes" />
                    <Radio value="false" label="No" />
                  </Group>
                </Radio.Group>
                {personalForm.errors.has_marriage_date && (
                  <Text size="xs" c="red">
                    {personalForm.errors.has_marriage_date}
                  </Text>
                )}
              </Stack>
            </Grid.Col>

            {personalForm.values.has_marriage_date ? (
              <>
                <Grid.Col span={12} md={6}>
                  <DatePickerInput
                    label="Marriage date"
                    value={personalForm.values.marriage_date}
                    onChange={(v) => personalForm.setFieldValue('marriage_date', v)}
                    minDate={new Date()}
                    firstDayOfWeek={0}
                  />
                </Grid.Col>
                <Grid.Col span={12} md={6}>
                  <TextInput
                    label="Solemnizing officer"
                    required
                    withAsterisk={false}
                    {...personalForm.getInputProps('solemnizing_officer')}
                  />
                </Grid.Col>
              </>
            ) : null}

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Contact Number"
                required
                withAsterisk={false}
                value={personalForm.values.main_contact || ''}
                readOnly
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Emergency Contact"
                required
                withAsterisk={false}
                {...personalForm.getInputProps('backup_contact')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Email"
                required
                withAsterisk={false}
                value={personalForm.values.email || ''}
                readOnly
              />
            </Grid.Col>
          </Grid>
          </form>
        );
      }

    if (step === 3) {
      return (
        <>
          {qLoading ? (
            <Text c="dimmed" size="sm">Loading questionnaire...</Text>
          ) : orderedQuestions.length === 0 ? (
            <Text c="dimmed" size="sm">No questionnaire available.</Text>
          ) : (
            <div className="no-scrollbar" style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 6 }}>
              <Stack spacing="md">
                {orderedQuestions.map((q) => {
                  const depth = Number(q.__depth || 0);

                  if (!isAnswerable(q)) {
                    return (
                      <div
                        key={q.questionID}
                        className="card border-0 bg-light"
                        style={{ marginLeft: depth ? depth * 12 : 0 }}
                      >
                        <div className="card-body py-2 px-3">
                          <Text fw={700}>{q.question_text}</Text>
                        </div>
                      </div>
                    );
                  }

                  const h = getPersonAnswer(q.questionID, 'husband');
                  const w = getPersonAnswer(q.questionID, 'wife');
                  const hError = qErrors[`h-${q.questionID}`];
                  const wError = qErrors[`w-${q.questionID}`];

                  return (
                    <div
                      key={q.questionID}
                      className="card"
                      style={{ marginLeft: depth ? depth * 12 : 0 }}
                    >
                      <div className="card-body">
                        <Stack gap="xs">
                          <Text fw={600}>{q.question_text}</Text>

                          <Divider label="Husband" labelPosition="left" />

                          <Radio.Group
                            value={h.answer || ''}
                            onChange={(value) => {
                              updateQuestionnaireAnswers({
                                [q.questionID]: {
                                  ...answers[q.questionID],
                                  husband: {
                                    ...h,
                                    answer: value,
                                  },
                                },
                              });
                            }}
                          >
                            <Stack gap={6}>
                              {ANSWER_OPTIONS.map((opt) => (
                                <Radio key={opt.value} value={opt.value} label={opt.label} />
                              ))}
                            </Stack>
                          </Radio.Group>

                          <Textarea
                            label="Reason"
                            required
                            minRows={3}
                            value={h.reason || ''}
                            onChange={(e) => {
                              updateQuestionnaireAnswers({
                                [q.questionID]: {
                                  ...answers[q.questionID],
                                  husband: {
                                    ...h,
                                    reason: e.currentTarget.value,
                                  },
                                },
                              });
                            }}
                          />

                          {hError ? (
                            <Text size="xs" c="red">
                              {hError}
                            </Text>
                          ) : null}

                          <Divider label="Wife" labelPosition="left" />

                          <Radio.Group
                            value={w.answer || ''}
                            onChange={(value) => {
                              updateQuestionnaireAnswers({
                                [q.questionID]: {
                                  ...answers[q.questionID],
                                  wife: {
                                    ...w,
                                    answer: value,
                                  },
                                },
                              });
                            }}
                          >
                            <Stack gap={6}>
                              {ANSWER_OPTIONS.map((opt) => (
                                <Radio key={opt.value} value={opt.value} label={opt.label} />
                              ))}
                            </Stack>
                          </Radio.Group>

                          <Textarea
                            label="Reason"
                            required
                            minRows={3}
                            value={w.reason || ''}
                            onChange={(e) => {
                              updateQuestionnaireAnswers({
                                [q.questionID]: {
                                  ...answers[q.questionID],
                                  wife: {
                                    ...w,
                                    reason: e.currentTarget.value,
                                  },
                                },
                              });
                            }}
                          />

                          {wError ? (
                            <Text size="xs" c="red">
                              {wError}
                            </Text>
                          ) : null}
                        </Stack>
                      </div>
                    </div>
                  );
                })}
              </Stack>
            </div>
          )}
        </>
      );
    }

    return (
      <Stack gap="md">
        <div className="card border-0 bg-light">
          <div className="card-body">
            <Text fw={700}>Review your details</Text>
            <Text size="sm" c="dimmed">
              Please verify the information below before submitting.
            </Text>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <Stack gap={6}>
              <Text fw={600}>Selected schedule</Text>
              <Text>{draft.schedule ? formatDateTime(draft.schedule.date) : 'No schedule selected'}</Text>
              {draft.schedule?.place ? <Text>{draft.schedule.place}</Text> : null}
              {draft.schedule?.counselor ? <Text>Counselor: {draft.schedule.counselor}</Text> : null}
            </Stack>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <Stack gap={6}>
              <Text fw={600}>Couple</Text>
              <Text>Husband: {draft.personalInfo?.husband_name || ''}</Text>
              <Text>Wife: {draft.personalInfo?.wife_name || ''}</Text>
              <Text>Contact: {draft.personalInfo?.main_contact || ''}</Text>
              <Text>Email: {draft.personalInfo?.email || ''}</Text>
            </Stack>
          </div>
        </div>

        {submitted ? (
          <div className="card border-0 bg-light">
            <div className="card-body">
              <Text fw={700}>Submission received</Text>
              <Text size="sm" c="dimmed">You may close this window.</Text>
            </div>
          </div>
        ) : null}
      </Stack>
    );
  };

  const handleBack = () => {
    if (step === 1) return;
    setStep((s) => Math.max(1, s - 1));
  };

  const validatePersonalStep = () => {
    const { hasErrors } = personalForm.validate();
    setPersonalStepValid(!hasErrors);
    if (!hasErrors) return true;

    // Scroll to the first invalid input inside the wizard body
    const container = scrollRef.current;
    if (container) {
      const invalid = container.querySelector('[data-invalid], [aria-invalid="true"]');
      if (invalid && typeof invalid.scrollIntoView === 'function') {
        invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof invalid.focus === 'function') {
          invalid.focus();
        }
      }
    }

    return false;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedScheduleId) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validatePersonalStep()) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!validateQuestionnaireAll()) return;
      setStep(4);
      return;
    }
    if (step === 4) {
      if (!submitted) {
        handleSubmit();
        return;
      }
      closeWizard();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={closeWizard}
      size="xl"
      radius="lg"
      padding="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      withCloseButton={false}
      keepMounted
      classNames={{ body: 'pmo-modal-body' }}
    >
      <style>{`
        .pmo-wizard-scroll {
          max-height: 80vh;
          overflow-y: auto;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
          scrollbar-color: transparent transparent; /* Firefox */
        }
        .pmo-wizard-scroll::-webkit-scrollbar {
          width: 0px; /* Chrome, Safari */
          height: 0px;
          background: transparent;
        }

        .pmo-schedule-scroll {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
          scrollbar-color: transparent transparent; /* Firefox */
        }
        .pmo-schedule-scroll::-webkit-scrollbar {
          width: 0px; /* Chrome, Safari */
          height: 0px;
          background: transparent;
        }

        .pmo-modal-body {
          max-height: 80vh;
          overflow: hidden;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        .pmo-modal-body::-webkit-scrollbar {
          width: 0px; /* Chrome, Safari */
          height: 0px;
          background: transparent;
        }

        .no-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        .no-scrollbar::-webkit-scrollbar {
          width: 0px; /* Chrome, Safari */
          height: 0px;
          background: transparent;
        }
      `}</style>
      <div
        className="bg-white"
        style={{ maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="card-header bg-white border-0 px-4 pt-3 pb-0">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h5 className="mb-0 fw-bold">Pre‑Marriage Orientation Booking</h5>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={closeWizard}
            />
          </div>
          <div className="mt-3 d-flex justify-content-between align-items-start gap-3">
            <div>
              <div className="text-uppercase small text-muted fw-semibold mb-1">{headerMeta.label}</div>
              <h6 className="mb-2 fw-semibold">{headerMeta.title}</h6>
            </div>
            {selectedSchedule && step !== 1 ? (
              <div className="text-end">
                <div className="text-uppercase small text-muted fw-semibold mb-1">Selected schedule</div>
                <div className="fw-semibold">{formatDateTime(selectedSchedule.date)}</div>
                <div className="small">{selectedSchedule.place}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="card-body px-4 pt-3 pb-3 pmo-wizard-scroll"
          style={{ flex: 1 }}
        >
          {renderBody()}
        </div>

        <div
          className={`card-footer bg-white border-0 px-4 py-3 d-flex ${
            step === 1 ? 'justify-content-end' : 'justify-content-between'
          } align-items-center`}
        >
          {!(step === 4 && submitted) && step !== 1 && (
            <Button
              variant="subtle"
              color="gray"
              onClick={handleBack}
              disabled={submitting}
            >
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            loading={submitting}
            disabled={
              step === 1
                ? !selectedScheduleId
                : step === 4
                  ? !canSubmit || submitted
                  : false
            }
          >
            {step === 4 ? 'Submit' : 'Next Step'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
