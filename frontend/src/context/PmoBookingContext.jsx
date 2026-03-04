import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'pmoBookingDraft';

const defaultDraft = {
  schedule: null,
  personalInfo: {
    husband_name: '',
    husband_birthday: null,
    husband_age: '',
    husband_address: '',
    husband_occupation: '',
    husband_religion: '',
    husband_educational_attainment: '',
    husband_citizenship: '',
    husband_id_type: '',
    husband_id_number: '',
    husband_id_photo: '',
    husband_4ps: null,
    husband_pwd: null,

    wife_name: '',
    wife_birthday: null,
    wife_age: '',
    wife_address: '',
    wife_occupation: '',
    wife_religion: '',
    wife_educational_attainment: '',
    wife_citizenship: '',
    wife_id_type: '',
    wife_id_number: '',
    wife_id_photo: '',
    wife_4ps: null,
    wife_pwd: null,

    has_marriage_date: null,
    marriage_date: null,
    solemnizing_officer: '',
    main_contact: '',
    backup_contact: '',
    email: ''
  },
  // questionnaireAnswers[questionID] = { husband: { answer, reason }, wife: { answer, reason } }
  questionnaireAnswers: {},
  submitted: false
};

function safeParseDraft(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

const PmoBookingContext = createContext(null);

export function PmoBookingProvider({ children }) {
  const [draft, setDraft] = useState(defaultDraft);

  useEffect(() => {
    const stored = safeParseDraft(sessionStorage.getItem(STORAGE_KEY));
    if (!stored) return;
    setDraft((prev) => ({ ...prev, ...stored }));
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const value = useMemo(() => {
    const updateDraft = (partial) => {
      setDraft((prev) => ({ ...prev, ...partial }));
    };

    const updatePersonalInfo = (partial) => {
      setDraft((prev) => ({
        ...prev,
        personalInfo: {
          ...prev.personalInfo,
          ...partial
        }
      }));
    };

    const updateQuestionnaireAnswers = (partial) => {
      setDraft((prev) => ({
        ...prev,
        questionnaireAnswers: {
          ...prev.questionnaireAnswers,
          ...partial
        }
      }));
    };

    const clearDraft = () => {
      setDraft(defaultDraft);
      sessionStorage.removeItem(STORAGE_KEY);
    };

    return {
      draft,
      updateDraft,
      updatePersonalInfo,
      updateQuestionnaireAnswers,
      clearDraft
    };
  }, [draft]);

  return <PmoBookingContext.Provider value={value}>{children}</PmoBookingContext.Provider>;
}

export function usePmoBooking() {
  const ctx = useContext(PmoBookingContext);
  if (!ctx) {
    throw new Error('usePmoBooking must be used within a PmoBookingProvider');
  }
  return ctx;
}
