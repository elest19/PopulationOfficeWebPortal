import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Title, Text, Stack, Card, Group, Image, Button, useMantineTheme, Divider, SimpleGrid, Table, List, Accordion, Badge, AspectRatio, Center, Loader } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

import { getEducationById, resolveEducationWebThumbnail, resolveItemDiagram, resolveItemThumbnail } from '../content/education.js';
import { listEducationWeb, listEducationWebKeyConcepts } from '../api/educationWeb.js';
import { YouTubeWithConsent } from '../components/common/YouTubeWithConsent.jsx';

export function EducationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const theme = useMantineTheme();
  const smBreakpoint = theme.breakpoints.sm;
  const smMaxWidth = typeof smBreakpoint === 'number' ? `${smBreakpoint}px` : smBreakpoint;
  const isMobile = useMediaQuery(`(max-width: ${smMaxWidth})`);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const toYouTubeEmbed = (url) => {
    if (!url) return '';
    try {
      const u = new URL(url);
      // youtu.be/<id>
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.replace('/', '').trim();
        return `https://www.youtube.com/embed/${id}`;
      }
      // www.youtube.com/watch?v=<id>
      if (u.hostname.includes('youtube.com')) {
        const id = u.searchParams.get('v');
        if (id) return `https://www.youtube.com/embed/${id}`;
        // already an embed link or shorts
        if (u.pathname.startsWith('/embed/')) return url;
        if (u.pathname.startsWith('/shorts/')) {
          const id2 = u.pathname.split('/')[2];
          if (id2) return `https://www.youtube.com/embed/${id2}`;
        }
      }
    } catch (_) {
      /* ignore */
    }
    return url;
  };

  const getImageUrl = (it) => {
    if (!it) return '';
    if (it.imageUrl) return it.imageUrl;
    const resolved = resolveItemThumbnail(it);
    if (resolved) return resolved;
    return '';
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // First, try existing static content
      const staticItem = getEducationById(id);
      if (staticItem) {
        if (!cancelled) {
          setItem(staticItem);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await listEducationWeb();
        const all = res?.data?.data || [];
        const found = all.find((it) => String(it.id) === String(id));
        if (!found) {
          if (!cancelled) {
            setItem(null);
          }
          return;
        }

        let keyConcepts = [];
        try {
          const kcRes = await listEducationWebKeyConcepts(found.id);
          const rawConcepts = kcRes?.data?.data || [];
          keyConcepts = rawConcepts.map((c) => {
            const rawText = c.conceptDescription || '';

            // If the description contains '-' markers, treat each line as a bullet item.
            const lines = String(rawText)
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean);

            const useBullets = lines.some((ln) => ln.includes('-'));

            return {
              title: c.conceptTitle,
              text: useBullets ? '' : rawText,
              bullets: useBullets ? lines : [],
            };
          });
        } catch (err) {
          console.error('Failed to load key concepts', err);
        }

        const benefitsArr = typeof found.benefits === 'string'
          ? found.benefits.split('\n').map((s) => s.trim()).filter(Boolean)
          : [];
        const limitationsArr = typeof found.limitationsOrNotes === 'string'
          ? found.limitationsOrNotes.split('\n').map((s) => s.trim()).filter(Boolean)
          : [];

        const mappedItem = {
          id: found.id,
          title: found.title,
          category: found.label || '',
          purpose: found.purpose || '',
          overview: found.overview || '',
          mainExplanation: found.mainExplanation || found.main_explanation || '',
          keyConcepts,
          visuals: found.visualImageUrl || found.visual_image_url
            ? [{ caption: '', filename: '', url: found.visualImageUrl || found.visual_image_url }]
            : [],
          benefits: benefitsArr,
          limitations: limitationsArr,
          videoUrl: found.youtubeVideoUrl || found.youtube_video_url || '',
          disclaimer: null,
          imageUrl: found.imageThumbnailUrl || found.image_thumbnail_url || found.visualImageUrl || found.visual_image_url || ''
        };

        if (!cancelled) {
          setItem(mappedItem);
        }
      } catch (err) {
        console.error('Failed to load education detail', err);
        if (!cancelled) {
          setItem(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <Stack spacing="lg" px="sm">
        <Center py="xl">
          <Loader />
        </Center>
      </Stack>
    );
  }

  if (!item) {
    return (
      <Stack spacing="lg" px="sm">
        <Title order={2}>Education material not found</Title>
        <Button onClick={() => navigate('/education')}>Back to Education Corner</Button>
      </Stack>
    );
  }

  const renderSection = (section, idx) => {
    if (!section) return null;

    const hasBullets = Array.isArray(section.bullets) && section.bullets.length > 0;
    const hasTable = section.table && Array.isArray(section.table.columns) && Array.isArray(section.table.rows);

    return (
      <Accordion.Item key={`${idx}-${section.title || 'section'}`} value={`${idx}-${section.title || 'section'}`}>
        <Accordion.Control>{section.title || 'Details'}</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            {section.text ? <Text size="sm">{section.text}</Text> : null}
            {hasBullets ? (
              <List size="sm" spacing={6} withPadding>
                {section.bullets.map((b, i) => (
                  <List.Item key={i}>{b}</List.Item>
                ))}
              </List>
            ) : null}
            {hasTable ? (
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    {section.table.columns.map((c) => (
                      <Table.Th key={c}>{c}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {section.table.rows.map((row, rIdx) => (
                    <Table.Tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <Table.Td key={cIdx}>{cell}</Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : null}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    );
  };

  return (
    <Stack spacing="lg" px="sm">
      <Stack gap={2}>
        <Group style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn-primary rounded-pill px-4 py-2 d-inline-flex align-items-center shadow-sm"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/education');
              }
            }}
            aria-label="Go back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="currentColor"
              className="me-2"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M11.354 1.146a.5.5 0 0 1 0 .708L5.207 8l6.147 6.146a.5.5 0 0 1-.708.708l-6.5-6.5a.5.5 0 0 1 0-.708l6.5-6.5a.5.5 0 0 1 .708 0z" />
            </svg>
            Back
          </button>
        </Group>
        <Title order={2} style={{ margin: 0, lineHeight: 1.15 }}>{item.title}</Title>
      </Stack>

      <div className="clearfix">
        {/* Sidebar for large screens, floated right like ServiceBootstrapLayout */}
        <aside className="d-none d-lg-block float-lg-end ms-lg-4" style={{ width: '38%' }}>
          <div className="vstack gap-3">
            <div className="card shadow-sm">
              <div className="card-header py-2 px-3 bg-light">
                <h5 className="card-title h6 mb-0">Services</h5>
              </div>
              <div className="card-body">
                <ul className="small mb-0">
                  <li><a href="/services/pre-marriage-orientation" className="text-decoration-none">Pre-Marriage Orientation (PMOC)</a></li>
                  <li><a href="/services/usapan-series" className="text-decoration-none">Usapan Series</a></li>
                  <li><a href="/services/rpfp" className="text-decoration-none">Responsible Parenthood &amp; Family Development (RPFP)</a></li>
                  <li><a href="/services/ahdp" className="text-decoration-none">Adolescent Health and Development Program (AHDP)</a></li>
                  <li><a href="/services/iec" className="text-decoration-none">Population Awareness &amp; IEC Activities</a></li>
                  <li><a href="/services/population-profiling" className="text-decoration-none">Demographic Data Collection &amp; Population Profiling</a></li>
                  <li><a href="/services/community-events" className="text-decoration-none">Support During Community Events</a></li>
                  <li><a href="/services/other-assistance" className="text-decoration-none">Other Assistance</a></li>
                </ul>
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-header py-2 px-3 bg-light">
                <h5 className="card-title h6 mb-0">Population Office Location</h5>
              </div>
              <div className="card-body">
                <div className="ratio ratio-4x3 rounded overflow-hidden">
                  <iframe
                    title="San Fabian Population Office Location"
                    src="https://www.google.com/maps?q=16.120723263859666,120.40280245009167&z=15&output=embed"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Top image card aligned with sidebar, matching Service layout sizing */}
        <div style={{ width: '100%' }}>
          <div className="card border-0 mb-3">
            <div className="card-body p-1 d-flex">
              <img
                src={getImageUrl(item)}
                alt={item.title}
                className="img-fluid rounded w-100"
                style={{
                  height: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Full-width content starting from Purpose, spanning under the sidebar */}
      <Card withBorder radius="md" p="md">
        <Stack spacing="md">
          <Group gap="xs">
            {item.category ? (
              <Badge variant="light" color="blue">
                {item.category}
              </Badge>
            ) : null}
          </Group>

          {item.purpose ? (
            <Stack gap={4}>
              <Text fw={700}>Purpose</Text>
              <Text size="sm">{item.purpose}</Text>
            </Stack>
          ) : null}

          {item.overview ? (
            <Stack gap={4}>
              <Text fw={700}>Overview</Text>
              <Text size="sm">{item.overview}</Text>
            </Stack>
          ) : null}

          {item.mainExplanation ? (
            <Stack gap={4}>
              <Text fw={700}>Main Explanation</Text>
              <Text size="sm">{item.mainExplanation}</Text>
            </Stack>
          ) : null}

          {Array.isArray(item.keyConcepts) && item.keyConcepts.length > 0 ? (
            <>
              <Divider />
              <Text fw={700}>Key Concepts</Text>
              <Accordion variant="separated" radius="md" multiple>
                {item.keyConcepts.map(renderSection)}
              </Accordion>
            </>
          ) : null}

          {Array.isArray(item.visuals) && item.visuals.length > 0 ? (
            <>
              <Divider />
              <Text fw={700}>Visuals / Images</Text>
              <SimpleGrid cols={isMobile ? 1 : 2} spacing="md">
                {item.visuals.slice(0, 1).map((v, idx) => (
                  <Card
                    key={idx}
                    withBorder
                    radius="md"
                    p="sm"
                    style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}
                  >
                    <Stack gap={6}>
                      <AspectRatio
                        ratio={isMobile ? 4 / 3 : 16 / 9}
                        style={{ width: '100%', maxHeight: '100%' }}
                      >
                        <Image
                          src={v.url || resolveItemDiagram(item)}
                          alt={v.caption || v.filename || item.title}
                          fit="contain"
                          styles={{ image: { objectFit: 'contain' } }}
                        />
                      </AspectRatio>
                      {v.caption ? <Text size="xs" c="dimmed">{v.caption}</Text> : null}
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            </>
          ) : null}

          <SimpleGrid cols={isMobile ? 1 : 2} spacing="md">
            <Card withBorder radius="md" p="md">
              <Stack gap={6}>
                <Text fw={700}>Benefits</Text>
                {Array.isArray(item.benefits) && item.benefits.length > 0 ? (
                  <List size="sm" spacing={6} withPadding>
                    {item.benefits.map((b, idx) => (
                      <List.Item key={idx}>{b}</List.Item>
                    ))}
                  </List>
                ) : (
                  <Text size="sm" c="dimmed">No benefits listed.</Text>
                )}
              </Stack>
            </Card>

            <Card withBorder radius="md" p="md">
              <Stack gap={6}>
                <Text fw={700}>Limitations / Important Notes</Text>
                {Array.isArray(item.limitations) && item.limitations.length > 0 ? (
                  <List size="sm" spacing={6} withPadding>
                    {item.limitations.map((b, idx) => (
                      <List.Item key={idx}>{b}</List.Item>
                    ))}
                  </List>
                ) : (
                  <Text size="sm" c="dimmed">No limitations listed.</Text>
                )}
              </Stack>
            </Card>
          </SimpleGrid>

          {item.videoUrl ? (
            <>
              <Divider />
              <Text fw={700}>Video</Text>
              <YouTubeWithConsent
                videoUrl={item.videoUrl}
                title={item.title}
                ratio="16x9"
              />
            </>
          ) : null}

          {item.disclaimer ? (
            <Card withBorder radius="md" p="md" style={{ background: 'var(--mantine-color-yellow-0)' }}>
              <Stack gap={4}>
                <Text fw={700}>Reminder / Disclaimer</Text>
                <Text size="sm">{item.disclaimer}</Text>
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Card>

      {/* Stacked Quick Links + Location Map for small screens, placed after main content */}
      <div className="d-lg-none mt-4">
        <div className="vstack gap-3">
          <div className="card shadow-sm">
            <div className="card-header py-2 px-3 bg-light">
              <h5 className="card-title h6 mb-0">Quick Links</h5>
            </div>
            <div className="card-body">
              <ul className="small mb-0">
                <li><a href="/services/pre-marriage-orientation" className="text-decoration-none">Pre-Marriage Orientation (PMOC)</a></li>
                <li><a href="/services/usapan-series" className="text-decoration-none">Usapan Series</a></li>
                <li><a href="/services/rpfp" className="text-decoration-none">Responsible Parenthood &amp; Family Development (RPFP)</a></li>
                <li><a href="/services/ahdp" className="text-decoration-none">Adolescent Health and Development Program (AHDP)</a></li>
                <li><a href="/services/iec" className="text-decoration-none">Population Awareness &amp; IEC Activities</a></li>
                <li><a href="/services/population-profiling" className="text-decoration-none">Demographic Data Collection &amp; Population Profiling</a></li>
                <li><a href="/services/community-events" className="text-decoration-none">Support During Community Events</a></li>
                <li><a href="/services/other-assistance" className="text-decoration-none">Other Assistance</a></li>
              </ul>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header py-2 px-3 bg-light">
              <h5 className="card-title h6 mb-0">Location Map</h5>
            </div>
            <div className="card-body">
              <div className="ratio ratio-4x3 rounded overflow-hidden">
                <iframe
                  title="San Fabian Population Office Location"
                  src="https://www.google.com/maps?q=16.120723263859666,120.40280245009167&z=15&output=embed"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Stack>
  );
}
