import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Center, Loader, Stack, Text, Button } from '@mantine/core';

import { getPmoAdminMeif } from '../../api/pmoAdmin.js';

export function PmoMeifPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getPmoAdminMeif(id);
        const payload = res.data?.data || null;
        if (payload) {
          console.log('MEIF payload:', payload);
        }
        setData(payload);
      } catch (err) {
        console.error(err);
        setError('Failed to load MEIF data.');
      } finally {
        setLoading(false);
      }
    };
    load().catch(() => {});
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Center style={{ minHeight: '60vh' }}>
        <Loader size="sm" />
      </Center>
    );
  }

  if (error || !data) {
    return (
      <Center style={{ minHeight: '60vh' }}>
        <Stack gap="sm" align="center">
          <Text c="red" size="sm">{error || 'No data found.'}</Text>
          <Button size="xs" variant="light" onClick={() => navigate(-1)}>Back</Button>
        </Stack>
      </Center>
    );
  }

  const { appointment, couple, answers } = data;

  const formatDate = (value) => {
    if (!value) return '';
    return dayjs(value).format('MMMM D, YYYY');
  };

  const boolMark = (v) => (v ? 'Yes   No' : 'Yes    No');

  const husbandName = couple?.husband_name || '';
  const wifeName = couple?.wife_name || '';

  const fullNameLine = `${husbandName} and ${wifeName}`.trim();

  const allAnswersRaw = Array.isArray(answers) ? answers : [];

  // Build a unique list of questions (one row per questionID) so that we can
  // construct the questionnaire structure independently of who answered it
  // (husband or wife). We then look up per-person answers for each question
  // when rendering the tables.
  const uniqueQuestions = [];
  const seenQuestionIds = new Set();
  allAnswersRaw.forEach((row) => {
    if (!row || typeof row.questionID === 'undefined') return;
    if (seenQuestionIds.has(row.questionID)) return;
    seenQuestionIds.add(row.questionID);
    uniqueQuestions.push(row);
  });

  // Organize questions hierarchically so that each outer filler is followed
  // by its inner fillers/standalone items, and each of those is immediately
  // followed by its sub-questions. This avoids cases where bullets appear
  // under the wrong numbered item due to sort_order inconsistencies.
  const buildOrderedQuestions = (rows) => {
    const byParent = new Map();
    rows.forEach((row) => {
      if (!row) return;
      const parentId = row.parent_question_id == null ? null : row.parent_question_id;
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId).push(row);
    });

    const ordered = [];
    const topLevel = byParent.get(null) || [];

    topLevel.forEach((section) => {
      ordered.push(section);
      const level1 = byParent.get(section.questionID) || [];
      level1.forEach((child) => {
        ordered.push(child);
        const level2 = byParent.get(child.questionID) || [];
        level2.forEach((grand) => {
          ordered.push(grand);
        });
      });
    });

    return ordered;
  };

  const orderedQuestions = buildOrderedQuestions(uniqueQuestions);

  // Determine outer filler IDs (fillers with no parent)
  const outerFillerIds = orderedQuestions
    .filter((row) => row?.question_type === 'Filler' && (row.parent_question_id == null))
    .map((row) => row.questionID);

  // Map outer filler IDs to labels A., B., C., ...
  const outerFillerLabels = new Map();
  outerFillerIds.forEach((id, index) => {
    const code = 'A'.charCodeAt(0) + index;
    const letter = String.fromCharCode(code);
    outerFillerLabels.set(id, `${letter}.`);
  });

  // Determine which items should be numbered (inner fillers + standalone)
  // and assign them sequential numbers 1., 2., 3., based on their
  // appearance order in the questionnaire.
  const numberedQuestionLabels = new Map();
  let runningNumber = 0;
  orderedQuestions.forEach((row) => {
    if (!row) return;
    const type = row.question_type;
    const parentId = row.parent_question_id;
    const isInnerFiller = type === 'Filler' && parentId != null;
    const isStandalone = type === 'Standalone';
    if (isInnerFiller || isStandalone) {
      runningNumber += 1;
      numberedQuestionLabels.set(row.questionID, `${runningNumber}.`);
    }
  });

  // Helper to find the specific answer row for a given question and person.
  const findAnswerFor = (questionID, person) => {
    const isHusbandTarget = person === 'husband';
    return allAnswersRaw.find((row) => {
      if (!row || row.questionID !== questionID) return false;
      const v = row.isHusband;
      const vBool = v === true || v === 't' || v === 1 || v === '1';
      return isHusbandTarget ? vBool : !vBool;
    }) || null;
  };

  return (
    <div className="meif-print-root">
      {/* Print-only styles to ensure only the MEIF document is printed */}
      <style>{`
        /* Base MEIF layout styles (screen + print) */
        .meif-page {
          max-width: 1040px;
          margin: 0 auto;
          padding: 8px 12px;
          font-family: 'Times New Roman', 'Times', serif;
          font-size: 11px;
          line-height: 1.2;
          color: #000;
        }

        .meif-header-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .meif-col {
          flex: 1;
        }

        .meif-col.meif-col-right {
          display: flex;
          justify-content: flex-end; /* push block to the right */
        }

        .meif-col-right-inner {
          text-align: left; /* keep labels + values left-aligned inside */
        }

        .meif-line {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 2px;
          white-space: nowrap;
        }

        .meif-underline {
          border-bottom: 1px solid #000;
          padding: 0 2px;
          min-height: 14px;
          display: inline-block;
        }

        .meif-underline.long {
          min-width: 220px;
          flex: 1;
        }

        .meif-underline.wide {
          min-width: 260px;
          flex: 1;
        }

        .meif-underline.medium {
          min-width: 140px;
        }

        .meif-underline.short {
          min-width: 40px;
        }

        .meif-inline-label {
          margin-left: 6px;
        }

        .meif-title-block {
          text-align: center;
          margin: 6px 0 4px;
        }

        .meif-title {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .meif-bold {
          font-weight: 700;
        }

        .meif-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 4px;
        }

        .meif-meta-row .meif-line.right {
          justify-content: flex-end;
        }

        .meif-instructions {
          font-size: 10px;
          margin: 4px 0 6px;
        }

        .meif-instructions p {
          margin: 0 0 2px;
        }

        .meif-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5px;
          table-layout: fixed;
        }

        .meif-table th,
        .meif-table td {
          border: 1px solid #000;
          padding: 2px 3px;
          vertical-align: top;
        }

        .meif-table thead th {
          text-align: center;
          font-weight: 700;
        }

        .meif-statement {
          width: 100%;
        }

        .meif-statement.meif-filler {
          font-weight: 700;
        }

        .meif-statement.meif-sub {
          padding-left: 12px;
        }

        .meif-statement.meif-standalone {
          font-weight: 700;
        }

        .meif-choice {
          text-align: center;
          width: 32px;
        }

        .meif-reason {
          width: 220px;
        }

        .meif-toolbar {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        /* Page setup for printing: long bond 8.5in x 13in */
        @page {
          size: 8.5in 13in;
          margin: 8mm;
        }

        .meif-copy {
          page-break-after: always;
        }

        @media print {
          /* Hide everything by default */
          body * {
            visibility: hidden;
          }

          /* Show only the MEIF print root */
          .meif-print-root, .meif-print-root * {
            visibility: visible;
          }

          /* Remove layout constraints so the MEIF page can use full sheet */
          .meif-print-root {
            position: absolute;
            inset: 0;
            margin: 0;
            padding: 0;
          }

          /* Hide elements explicitly marked as no-print (e.g., toolbar buttons) */
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="meif-toolbar no-print">
        <Button size="xs" variant="light" onClick={() => navigate(-1)}>Back</Button>
        <Button size="xs" onClick={handlePrint}>Print</Button>
      </div>

      {/* Husband copy */}
      <div className="meif-page meif-copy">
        <div className="meif-header-row">
          <div className="meif-col">
            <div className="meif-line">
              <span>Name of Husband:</span>
              <span className="meif-underline">{husbandName}</span>
            </div>
            <div className="meif-line">
              <span>Birthdate:</span>
              <span className="meif-underline">{formatDate(couple?.husband_birthday)}</span>
              <span className="meif-inline-label">Age:</span>
              <span className="meif-underline short">{couple?.husband_age ?? ''}</span>
            </div>
            <div className="meif-line">
              <span>Address:</span>
              <span className="meif-underline">{couple?.husband_address || ''}</span>
            </div>
            <div className="meif-line">
              <span>Occupation:</span>
              <span className="meif-underline">{couple?.husband_occupation || ''}</span>
            </div>
            <div className="meif-line">
              <span>4P's?</span>
              <span className="meif-underline short">{couple?.husband_4ps ? 'Yes' : 'No'}</span>
              <span className="meif-inline-label">PWD?</span>
              <span className="meif-underline short">{couple?.husband_pwd ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div className="meif-col meif-col-right">
            <div className="meif-col-right-inner">
              <div className="meif-line">
                <span>Name of Wife:</span>
                <span className="meif-underline">{wifeName}</span>
              </div>
              <div className="meif-line">
                <span>Birthdate:</span>
                <span className="meif-underline">{formatDate(couple?.wife_birthday)}</span>
                <span className="meif-inline-label">Age:</span>
                <span className="meif-underline short">{couple?.wife_age ?? ''}</span>
              </div>
              <div className="meif-line">
                <span>Address:</span>
                <span className="meif-underline">{couple?.wife_address || ''}</span>
              </div>
              <div className="meif-line">
                <span>Occupation:</span>
                <span className="meif-underline">{couple?.wife_occupation || ''}</span>
              </div>
              <div className="meif-line">
                <span>4P's?</span>
                <span className="meif-underline short">{couple?.wife_4ps ? 'Yes' : 'No'}</span>
                <span className="meif-inline-label">PWD?</span>
                <span className="meif-underline short">{couple?.wife_pwd ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="meif-title-block">
          <div className="meif-center-text meif-bold meif-title">The Marriage Expectations Inventory Form</div>
        </div>

        <div className="meif-meta-row">
          <div className="meif-line">
            <span>Name:</span>
            <span className="meif-underline wide">{husbandName}</span>
          </div>
          <div className="meif-line right">
            <span>Date:</span>
            <span className="meif-underline medium">{formatDate(appointment?.scheduleDate || appointment?.created_at)}</span>
          </div>
        </div>

        <div className="meif-instructions">
          <p>
            Below is the MEIF to be filled-out by would-be couples.
          </p>
          <p>
            Instructions: This Marriage Expectations Inventory Form helps you to express your expectations about marriage
            so you can engage each other into dialogue to make your relationship stronger. Kindly check your answer that
            corresponds to your level of agreement or disagreement.
          </p>
        </div>

        <table className="meif-table">
          <colgroup>
            <col style={{ width: '60%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Statement</th>
              <th>Agree</th>
              <th>Neutral</th>
              <th>Disagree</th>
              <th>Reason/s</th>
            </tr>
          </thead>
          <tbody>
            {orderedQuestions.map((q) => {
              if (!q) return null;

              const answerRow = findAnswerFor(q.questionID, 'husband');
              const rawAns = answerRow ? answerRow.answer : null;
              const ans = String(rawAns || '').trim().toLowerCase();
              const isAgree = ans === 'agree';
              const isDisagree = ans === 'disagree';
              let isNeutral = ans === 'neutral' || ans === 'neutral / unsure' || ans.startsWith('neutral');

              // Fallback: if there is some non-empty answer text that is
              // not clearly Agree/Disagree, treat it as Neutral so that
              // a checkmark is still rendered.
              if (!isAgree && !isDisagree && !isNeutral && ans.length > 0) {
                isNeutral = true;
              }

              const type = q.question_type;
              const isFiller = type === 'Filler';
              const isSub = type === 'Sub-question';
              const isStandalone = type === 'Standalone';
              let label = q.question_text || '';
              const parentId = q.parent_question_id;

              if (isFiller && (parentId == null)) {
                // Outer filler: label with A./B./C. and uppercase text
                const prefix = outerFillerLabels.get(q.questionID) || '';
                label = `${prefix} ${label.toUpperCase()}`.trim();
              }
              if ((isFiller && parentId != null) || type === 'Standalone') {
                const numPrefix = numberedQuestionLabels.get(q.questionID) || '';
                if (numPrefix) {
                  label = `${numPrefix} ${label}`.trim();
                }
              }
              if (isSub) label = `• ${label}`;

              const statementClass = `meif-statement${isFiller ? ' meif-filler' : ''}${isSub ? ' meif-sub' : ''}${isStandalone ? ' meif-standalone' : ''}`;

              return (
                <tr key={q.questionID}>
                  <td className={statementClass}>{label}</td>
                  <td className="meif-choice">{isAgree ? '✔' : ''}</td>
                  <td className="meif-choice">{isNeutral ? '✔' : ''}</td>
                  <td className="meif-choice">{isDisagree ? '✔' : ''}</td>
                  <td className="meif-reason">{answerRow?.reason || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Wife copy */}
      <div className="meif-page">
        <div className="meif-header-row">
          <div className="meif-col">
            <div className="meif-line">
              <span>Name of Husband:</span>
              <span className="meif-underline">{husbandName}</span>
            </div>
            <div className="meif-line">
              <span>Birthdate:</span>
              <span className="meif-underline">{formatDate(couple?.husband_birthday)}</span>
              <span className="meif-inline-label">Age:</span>
              <span className="meif-underline short">{couple?.husband_age ?? ''}</span>
            </div>
            <div className="meif-line">
              <span>Address:</span>
              <span className="meif-underline">{couple?.husband_address || ''}</span>
            </div>
            <div className="meif-line">
              <span>Occupation:</span>
              <span className="meif-underline">{couple?.husband_occupation || ''}</span>
            </div>
            <div className="meif-line">
              <span>4P's?</span>
              <span className="meif-underline short">{couple?.husband_4ps ? 'Yes' : 'No'}</span>
              <span className="meif-inline-label">PWD?</span>
              <span className="meif-underline short">{couple?.husband_pwd ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div className="meif-col meif-col-right">
            <div className="meif-col-right-inner">
              <div className="meif-line">
                <span>Name of Wife:</span>
                <span className="meif-underline">{wifeName}</span>
              </div>
              <div className="meif-line">
                <span>Birthdate:</span>
                <span className="meif-underline">{formatDate(couple?.wife_birthday)}</span>
                <span className="meif-inline-label">Age:</span>
                <span className="meif-underline short">{couple?.wife_age ?? ''}</span>
              </div>
              <div className="meif-line">
                <span>Address:</span>
                <span className="meif-underline">{couple?.wife_address || ''}</span>
              </div>
              <div className="meif-line">
                <span>Occupation:</span>
                <span className="meif-underline">{couple?.wife_occupation || ''}</span>
              </div>
              <div className="meif-line">
                <span>4P's?</span>
                <span className="meif-underline short">{couple?.wife_4ps ? 'Yes' : 'No'}</span>
                <span className="meif-inline-label">PWD?</span>
                <span className="meif-underline short">{couple?.wife_pwd ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="meif-title-block">
          <div className="meif-center-text meif-bold meif-title">The Marriage Expectations Inventory Form</div>
        </div>

        <div className="meif-meta-row">
          <div className="meif-line">
            <span>Name:</span>
            <span className="meif-underline wide">{wifeName}</span>
          </div>
          <div className="meif-line right">
            <span>Date:</span>
            <span className="meif-underline medium">{formatDate(appointment?.scheduleDate || appointment?.created_at)}</span>
          </div>
        </div>

        <div className="meif-instructions">
          <p>
            Below is the MEIF to be filled-out by would-be couples.
          </p>
          <p>
            Instructions: This Marriage Expectations Inventory Form helps you to express your expectations about marriage
            so you can engage each other into dialogue to make your relationship stronger. Kindly check your answer that
            corresponds to your level of agreement or disagreement.
          </p>
        </div>

        <table className="meif-table">
          <colgroup>
            <col style={{ width: '60%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Statement</th>
              <th>Agree</th>
              <th>Neutral</th>
              <th>Disagree</th>
              <th>Reason/s</th>
            </tr>
          </thead>
          <tbody>
            {orderedQuestions.map((q) => {
              if (!q) return null;

              const answerRow = findAnswerFor(q.questionID, 'wife');
              const rawAns = answerRow ? answerRow.answer : null;
              const ans = String(rawAns || '').trim().toLowerCase();
              const isAgree = ans === 'agree';
              const isDisagree = ans === 'disagree';
              let isNeutral = ans === 'neutral' || ans === 'neutral / unsure' || ans.startsWith('neutral');

              if (!isAgree && !isDisagree && !isNeutral && ans.length > 0) {
                isNeutral = true;
              }

              const type = q.question_type;
              const isFiller = type === 'Filler';
              const isSub = type === 'Sub-question';
              const isStandalone = type === 'Standalone';
              let label = q.question_text || '';
              const parentId = q.parent_question_id;

              if (isFiller && (parentId == null)) {
                const prefix = outerFillerLabels.get(q.questionID) || '';
                label = `${prefix} ${label.toUpperCase()}`.trim();
              }
              if ((isFiller && parentId != null) || type === 'Standalone') {
                const numPrefix = numberedQuestionLabels.get(q.questionID) || '';
                if (numPrefix) {
                  label = `${numPrefix} ${label}`.trim();
                }
              }
              if (isSub) label = `• ${label}`;

              const statementClass = `meif-statement${isFiller ? ' meif-filler' : ''}${isSub ? ' meif-sub' : ''}${isStandalone ? ' meif-standalone' : ''}`;

              return (
                <tr key={q.questionID + '-wife'}>
                  <td className={statementClass}>{label}</td>
                  <td className="meif-choice">{isAgree ? '✔' : ''}</td>
                  <td className="meif-choice">{isNeutral ? '✔' : ''}</td>
                  <td className="meif-choice">{isDisagree ? '✔' : ''}</td>
                  <td className="meif-reason">{answerRow?.reason || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PmoMeifPrint;
