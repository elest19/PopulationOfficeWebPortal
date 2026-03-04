import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title,
  Text,
  Stack,
  Card,
  Loader,
  Center,
  Group,
  Image,
  TextInput,
  SegmentedControl,
  SimpleGrid,
  Modal,
  Button,
  ActionIcon,
  Box,
  AspectRatio
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { useMediaQuery } from '@mantine/hooks';
import { useMantineTheme } from '@mantine/core';
import { EDUCATION_MATERIALS, resolveItemThumbnail } from '../content/education.js';
import { listEducationWeb } from '../api/educationWeb.js';
import { listBooklets, listBookletPages } from '../api/educationBooklets.js';

export function EducationPage() {
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const smBreakpoint = theme.breakpoints.sm;
  const smMaxWidth = typeof smBreakpoint === 'number' ? `${smBreakpoint}px` : smBreakpoint;
  const isMobile = useMediaQuery(`(max-width: ${smMaxWidth})`);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [mode, setMode] = useState('web');
  const [viewerOpened, setViewerOpened] = useState(false);
  const [selectedBrochure, setSelectedBrochure] = useState(null);
  const [selectedPage, setSelectedPage] = useState(0);
  const [zoom, setZoom] = useState(1);

  const [hoveredMaterialId, setHoveredMaterialId] = useState(null);

  const [booklets, setBooklets] = useState([]);
  const [bookletsLoading, setBookletsLoading] = useState(false);
  const [bookletsError, setBookletsError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchWebContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await listEducationWeb();
        const apiItemsRaw = res?.data?.data || [];
        const apiItems = apiItemsRaw
          .filter((it) => it && (typeof it.isPublished === 'boolean' ? it.isPublished : it.is_published !== false))
          .map((it) => ({
            id: it.id,
            title: it.title,
            category: it.label || '',
            overview: it.overview,
            purpose: it.purpose,
            imageUrl: it.imageThumbnailUrl || it.image_thumbnail_url || null,
            _raw: it
          }));

        if (!isMounted) return;

        if (apiItems.length > 0) {
          setItems(apiItems);
        } else {
          // Fallback to static materials if backend returns nothing
          setItems(EDUCATION_MATERIALS || []);
        }
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setError('Failed to load education content. Showing default materials.');
        setItems(EDUCATION_MATERIALS || []);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const fetchBooklets = async () => {
      setBookletsLoading(true);
      setBookletsError(null);
      try {
        const res = await listBooklets();
        const apiItemsRaw = res?.data?.data || [];
        const apiItems = apiItemsRaw
          .filter((it) => it && (typeof it.isPublished === 'boolean' ? it.isPublished : it.is_published !== false))
          .map((it) => ({
            id: it.id,
            title: it.title,
            imageUrl: it.imageThumbnailUrl || it.image_thumbnail_url || null,
            brochureContentNumber: it.brochureContentNumber || it.brochure_content_number || 0,
            pages: [],
            _raw: it,
          }));

        if (!isMounted) return;
        setBooklets(apiItems);
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setBookletsError('Failed to load booklets.');
        setBooklets([]);
      } finally {
        if (isMounted) setBookletsLoading(false);
      }
    };

    fetchWebContent().catch(() => {});
    fetchBooklets().catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Toggle body scroll and notify global layout when brochure viewer opens/closes
    const eventName = 'brochure-viewer-toggle';

    // Notify listeners (e.g., AppShellLayout) about viewer open/close state
    window.dispatchEvent(
      new CustomEvent(eventName, { detail: { opened: viewerOpened } })
    );

    if (!viewerOpened) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      window.dispatchEvent(
        new CustomEvent(eventName, { detail: { opened: false } })
      );
    };
  }, [viewerOpened]);

  const handleMaterialClick = (item) => {
    if (!item) return;
    navigate(`/education/${item.id}`);
  };

  const getMaterialImageUrl = (item) => {
    // Prefer mapped thumbnail from Education Web/Thumbnail
    const resolved = resolveItemThumbnail(item);
    if (resolved) return resolved;

    // Fallbacks
    const category = String(item?.category || '').toLowerCase();
    const categoryImages = {
      'family planning':
        'https://images.unsplash.com/photo-1584516150909-c43483ee7932?auto=format&fit=crop&w=1200&q=60',
      'maternal health':
        'https://images.unsplash.com/photo-1511174511562-5f7f18b874f8?auto=format&fit=crop&w=1200&q=60',
      youth:
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=60'
    };
    return item?.imageUrl || categoryImages[category] || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=60';
  };

  const filtered = (items || []).filter((it) => {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return true;
    const fields = [it.title, it.category, it.overview, it.purpose];
    return fields
      .map((v) => String(v || '').toLowerCase())
      .some((text) => text.includes(q));
  });

  const brochureFiltered = useMemo(() => {
    const q = String(query || '').toLowerCase().trim();
    const list = booklets || [];
    if (!q) return list;
    return list.filter((b) => String(b.title || '').toLowerCase().includes(q));
  }, [query, booklets]);

  const openBrochure = async (brochure) => {
    if (!brochure) return;

    try {
      setSelectedPage(0);
      setZoom(1);

      // Load pages for this booklet from the API
      const res = await listBookletPages(brochure.id);
      const data = res?.data?.data || [];
      const pages = data
        .slice()
        .sort((a, b) => {
          const aNum = a.pageNumber ?? a.page_number ?? 0;
          const bNum = b.pageNumber ?? b.page_number ?? 0;
          return aNum - bNum;
        })
        .map((p) => p.imageUrl || p.image_url || '')
        .filter((src) => src && src.trim());

      setSelectedBrochure({ ...brochure, pages });
      setViewerOpened(true);
    } catch (err) {
      console.error(err);
      setBookletsError('Failed to load booklet pages.');
    }
  };

  const closeViewer = () => {
    setViewerOpened(false);
    setSelectedBrochure(null);
    setSelectedPage(0);
    setZoom(1);
  };

  return (
    <Stack spacing="lg" px="sm">
      <Title order={1} className="hover-underline">Education Corner</Title>

      <SegmentedControl
        value={mode}
        onChange={setMode}
        data={[
          { value: 'web', label: 'Web Content' },
          { value: 'brochures', label: 'Booklets / Brochures' }
        ]}
      />
      {loading && mode === 'web' ? (
        <Center py="lg">
          <Loader />
        </Center>
      ) : error && mode === 'web' ? (
        <Text color="red">{error}</Text>
      ) : mode === 'web' ? (
        filtered.length === 0 ? (
          <Text>No educational materials available.</Text>
        ) : (
          <SimpleGrid cols={isMobile ? 2 : 4} spacing="md">
            {filtered.map((item) => {
              return (
                <Card
                  key={item.id}
                  withBorder
                  radius="md"
                  shadow="sm"
                  className="holographic-card"
                  style={{
                    height: 'auto',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onClick={() => handleMaterialClick(item)}
                  onMouseEnter={() => setHoveredMaterialId(item.id)}
                  onMouseLeave={() => setHoveredMaterialId(null)}
                >
                  <Stack style={{ height: '100%' }} spacing="sm">
                    <AspectRatio ratio={3 / 4} style={{ background: 'var(--mantine-color-gray-1)', borderRadius: 'var(--mantine-radius-sm)' }}>
                      <Image
                        src={getMaterialImageUrl(item)}
                        alt={item.title}
                        fit="contain"
                        styles={{ image: { objectFit: 'contain' } }}
                      />
                    </AspectRatio>

                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text fw={700} lineClamp={2}>
                        {item.title}
                      </Text>
                    </Group>

                    <Text
                      size="sm"
                      c="dimmed"
                      style={{ flex: 1 }}
                      lineClamp={3}
                    >
                      {item.overview || item.purpose || ''}
                    </Text>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )
      ) : bookletsLoading ? (
        <Center py="lg">
          <Loader />
        </Center>
      ) : bookletsError ? (
        <Text color="red">{bookletsError}</Text>
      ) : brochureFiltered.length === 0 ? (
        <Text>No brochures available.</Text>
      ) : (
        <SimpleGrid cols={isMobile ? 2 : 4} spacing="md">
          {brochureFiltered.map((b) => (
            <Card
              key={b.id}
              withBorder
              radius="md"
              shadow="sm"
              className="holographic-card"
              style={{
                height: 'auto',
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
              }}
              onClick={() => openBrochure(b)}
            >
              <Stack spacing={8}>
                <AspectRatio
                  ratio={3 / 4}
                  style={{
                    background: 'var(--mantine-color-gray-1)',
                    borderRadius: 'var(--mantine-radius-sm)'
                  }}
                >
                  <Image
                    src={b.imageUrl || (Array.isArray(b.pages) && b.pages.length ? b.pages[0] : null)}
                    alt={b.title || 'Brochure'}
                    fit="contain"
                    w="100%"
                    h="100%"
                    styles={{
                      image: { objectFit: 'contain' }
                    }}
                  />
                </AspectRatio>
                <Text fw={700} size="sm" lineClamp={2}>
                  {b.title || 'Brochure'}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal
        opened={viewerOpened}
        onClose={closeViewer}
        fullScreen
        withCloseButton={false}
        centered
        transitionProps={{ transition: 'fade', duration: 160 }}
        styles={{
          content: { background: 'black' },
          body: { padding: 0, height: '100%' }
        }}
      >
        <Stack style={{ height: '100%' }} spacing={0}>
          <Box style={{ flex: 1, minHeight: 0 }}>
            <Carousel
              withIndicators
              height="calc(100vh - 70px)"
              slideGap="md"
              align="start"
              draggable
              initialSlide={selectedPage}
              onSlideChange={(idx) => {
                setSelectedPage(idx);
                setZoom(1);
              }}
              styles={{
                viewport: { height: 'calc(100vh - 70px)' },
                container: { height: 'calc(100vh - 70px)' },
                indicators: { bottom: 0}
              }}
            >
              {(selectedBrochure?.pages || []).map((src, idx) => (
                <Carousel.Slide key={`${selectedBrochure?.id || 'b'}-${idx}`}>
                  <Box
                    style={{
                      height: 'calc(100vh - 64px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      touchAction: zoom > 1 ? 'pan-x pan-y' : 'pan-y'
                    }}
                    onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                  >
                    <img
                      src={src}
                      alt={selectedBrochure?.title || 'Brochure'}
                      style={
                        zoom === 1
                          ? {
                              // Fit image to the available screen space while keeping aspect ratio
                              width: '100%',
                              height: '100%',
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain',
                              transition: 'transform 160ms ease'
                            }
                          : {
                              // When zoomed in, allow natural size and scale beyond viewport
                              width: 'auto',
                              height: 'auto',
                              maxWidth: 'none',
                              maxHeight: 'none',
                              transform: `scale(${zoom})`,
                              transformOrigin: 'center',
                              transition: 'transform 160ms ease'
                            }
                      }
                    />
                  </Box>
                </Carousel.Slide>
              ))}
            </Carousel>
          </Box>

          <Group
            justify="space-between"
            style={{
              padding: 12,
              background: 'rgba(0,0,0,0.85)',
              borderTop: '1px solid rgba(255,255,255,0.12)'
            }}
          >
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                aria-label="Zoom out"
              >
                -
              </ActionIcon>
              <Text c="white" size="sm">
                {Math.round(zoom * 100)}%
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                aria-label="Zoom in"
              >
                +
              </ActionIcon>
            </Group>
            <Button color="gray" variant="filled" onClick={closeViewer}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* detail modal removed; navigation to dedicated page instead */}
    </Stack>
  );
}
