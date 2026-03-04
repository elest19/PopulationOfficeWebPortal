import React, { useEffect, useMemo, useState } from 'react';
import { Center, Loader, Text, Button } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import { getPmoQuestionnairePublic } from '../../api/pmoAdmin.js';

export function MeifTemplate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getPmoQuestionnairePublic();
        setRows(res.data?.data || []);
      } catch (err) {
        console.error('Failed to load MEIF questionnaire', err);
        setError('Failed to load MEIF questionnaire.');
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => {});
  }, []);

  const { orderedQuestions, outerFillerLabels, numberedQuestionLabels } = useMemo(() => {
    const result = {
      orderedQuestions: [],
      outerFillerLabels: new Map(),
      numberedQuestionLabels: new Map()
    };

    const all = Array.isArray(rows) ? rows : [];
    if (!all.length) return result;

    const byParent = new Map();
    all.forEach((row) => {
      if (!row) return;
      const parentId = row.parent_question_id == null ? null : row.parent_question_id;
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId).push(row);
    });

    // Sort each group by sort_order then questionID for stability
    for (const [key, list] of byParent.entries()) {
      list.sort((a, b) => (a.sort_order - b.sort_order) || (a.questionID - b.questionID));
      byParent.set(key, list);
    }

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

    // Outer filler IDs (fillers with no parent)
    const outerFillerIds = ordered
      .filter((row) => row?.question_type === 'Filler' && (row.parent_question_id == null))
      .map((row) => row.questionID);

    const outerLabels = new Map();
    outerFillerIds.forEach((id, index) => {
      const code = 'A'.charCodeAt(0) + index;
      const letter = String.fromCharCode(code);
      outerLabels.set(id, `${letter}.`);
    });

    const numberedLabels = new Map();
    let runningNumber = 0;
    ordered.forEach((row) => {
      if (!row) return;
      const type = row.question_type;
      const parentId = row.parent_question_id;
      const isInnerFiller = type === 'Filler' && parentId != null;
      const isStandalone = type === 'Standalone';
      if (isInnerFiller || isStandalone) {
        runningNumber += 1;
        numberedLabels.set(row.questionID, `${runningNumber}.`);
      }
    });

    result.orderedQuestions = ordered;
    result.outerFillerLabels = outerLabels;
    result.numberedQuestionLabels = numberedLabels;
    return result;
  }, [rows]);

  return (
    <section className="py-4 bg-white">
      <div className="container">
        <div className="mb-3">
          <Button
            size="xs"
            variant="outline"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/services'))}
          >
            Back to Services
          </Button>
        </div>
        <div className="meif-print-root">
          <style>{`
            .meif-page {
              max-width: 100%;
              margin: 0 auto;
              padding: 8px 12px;
              font-family: 'Times New Roman', 'Times', serif;
              font-size: 15px;
              line-height: 1.2;
              color: #000;
            }
            .meif-header-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 24px;
              margin-bottom: 12px;
            }
            .meif-col {
              flex: 1;
              min-width: 0;
            }
            .meif-wife-col {
              display: flex;
              justify-content: flex-end;
            }
            .meif-wife-inner {
              display: inline-block;
              text-align: left;
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
              min-width: 160px;
            }
            .meif-title-block {
              text-align: center;
              margin: 6px 0 4px;
            }
            .meif-title {
              margin-top: 30px;
              font-size: 25px;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }
            .meif-instructions {
              font-size: 15px;
              margin: 4px 0 6px;
            }
            .meif-table {
              width: 100%;
              min-width: 720px;
              border-collapse: collapse;
              font-size: 15px;
              table-layout: fixed;
            }
            .meif-table-wrapper {
              width: 100%;
              overflow-x: auto;
            }
            .meif-table th,
            .meif-table td {
              border: 1px solid #000;
              padding: 2px 3px;
              vertical-align: top;
              white-space: normal;
            }
            .meif-table thead th {
              text-align: center;
              font-weight: 700;
            }
            .meif-statement { width: 100%; }
            .meif-statement.meif-filler {
              font-weight: 700;
            }
            .meif-statement.meif-sub {
              padding-left: 12px;
            }
            .meif-statement.meif-standalone {
              font-weight: 700;
            }
            @media (max-width: 768px) {
              .meif-page {
                padding: 8px 6px;
              }
              .meif-header-row {
                flex-direction: column;
                gap: 12px;
              }
              .meif-title {
                font-size: 20px;
                margin-top: 16px;
              }
              .meif-instructions {
                font-size: 13px;
              }
              .meif-table {
                font-size: 11px;
              }
            }
          `}</style>

          <div className="meif-page">
            <div className="meif-header-row">
              <div className="meif-col">
                <div className="meif-line">
                  <span>Name of Husband:</span>
                  <span className="meif-underline" />
                </div>
                <div className="meif-line">
                  <span>Birthdate:</span>
                  <span className="meif-underline" />
                  <span className="ms-2">Age:</span>
                  <span className="meif-underline" style={{ minWidth: 40 }} />
                </div>
                <div className="meif-line">
                  <span>Address:</span>
                  <span className="meif-underline" />
                </div>
                <div className="meif-line">
                  <span>Occupation:</span>
                  <span className="meif-underline" />
                </div>
              </div>

              <div className="meif-col meif-wife-col">
                <div className="meif-wife-inner">
                  <div className="meif-line">
                    <span>Name of Wife:</span>
                    <span className="meif-underline" />
                  </div>
                  <div className="meif-line">
                    <span>Birthdate:</span>
                    <span className="meif-underline" />
                    <span className="ms-2">Age:</span>
                    <span className="meif-underline" style={{ minWidth: 40 }} />
                  </div>
                  <div className="meif-line">
                    <span>Address:</span>
                    <span className="meif-underline" />
                  </div>
                  <div className="meif-line">
                    <span>Occupation:</span>
                    <span className="meif-underline" />
                  </div>
                </div>
              </div>
            </div>

            <div className="meif-title-block">
              <div className="meif-title">The Marriage Expectations Inventory Form</div>
            </div>

            <div className="meif-instructions">
              <p>
                Below is the MEIF to be filled out by would-be couples.
              </p>
              <p>
                Instructions: This Marriage Expectations Inventory Form helps you express your expectations about marriage
                so you can engage each other in dialogue to make your relationship stronger. Kindly check your answer that
                corresponds to your level of agreement or disagreement and provide reasons when needed.
              </p>
            </div>

            <div className="meif-table-wrapper">
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
                  {loading && (
                    <tr>
                      <td colSpan={5}>
                        <Center py="sm">
                          <Loader size="sm" />
                        </Center>
                      </td>
                    </tr>
                  )}
                  {!loading && error && (
                    <tr>
                      <td colSpan={5}>
                        <Text size="sm" c="red">
                          {error}
                        </Text>
                      </td>
                    </tr>
                  )}
                  {!loading && !error && orderedQuestions.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <Text size="sm" c="dimmed">
                          No questionnaire items configured yet.
                        </Text>
                      </td>
                    </tr>
                  )}
                  {!loading && !error && orderedQuestions.length > 0 &&
                    orderedQuestions.map((q) => {
                      if (!q) return null;
                      <Text size="sm" c="dimmed">
                        No questionnaire items configured yet.
                      </Text>
                    }
                  )}
                {!loading && !error && orderedQuestions.length > 0 &&
                  orderedQuestions.map((q) => {
                    if (!q) return null;

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
                      <tr key={q.questionID}>
                        <td className={statementClass}>{label}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </section>
  );
}
