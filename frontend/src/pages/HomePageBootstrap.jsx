import React, { useEffect, useState } from 'react';
import { Modal, Text, TextInput, Textarea, FileInput, Button as MantineButton, Stack, Progress, Pagination } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import heroBackground from '../content/HeroBackground.jpg';
import imgPMOHome from '../content/Home Images/PMOHomePage.jpg';
import imgUsapanHome from '../content/Home Images/UsapanSeriesHomePage.jpg';
import imgResponsibleParenthoodHome from '../content/Home Images/ResponsibleParenthoodHomePage.jpg';
import imgAdolescentHome from '../content/Home Images/AdolescentHomePage.jpg';
import imgPopulationAwarenessHome from '../content/Home Images/PopulationAwarenessHomePage.jpg';
import imgDemographicHome from '../content/Home Images/DemographicHomePage.jpg';
import imgCommunityEventsHome from '../content/Home Images/CommunityEventsHomePage.jpg';
import imgSupportHome from '../content/Home Images/SupportHomePage.jpg';
import { getNewsList, createNews } from '../api/news.js';
import { uploadImage } from '../api/uploads.js';
import { getAnnouncements } from '../api/announcements.js';
import { searchSite } from '../api/search.js';

import MissionVision from '../components/home/MissionVision.jsx';

export function HomePage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newsModalOpened, setNewsModalOpened] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [annError, setAnnError] = useState(null);
  const [siteSearch, setSiteSearch] = useState('');
  const [siteSearchOpen, setSiteSearchOpen] = useState(false);
  const [siteSearchLoading, setSiteSearchLoading] = useState(false);
  const [siteSearchRemote, setSiteSearchRemote] = useState([]);
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const { user, isAdmin, isOfficer } = auth;

  // Hero carousel slides
  const heroSlides = [
    { src: imgPMOHome, alt: 'Pre-Marriage Orientation' },
    { src: imgUsapanHome, alt: 'Usapan Series' },
    { src: imgResponsibleParenthoodHome, alt: 'Responsible Parenthood & Family Development' },
    { src: imgAdolescentHome, alt: 'Adolescent Health and Development Program' },
    { src: imgPopulationAwarenessHome, alt: 'Population Awareness & IEC Activities' },
    { src: imgDemographicHome, alt: 'Demographic Data Collection & Population Profiling' },
    { src: imgCommunityEventsHome, alt: 'Support During Community Events' },
    { src: imgSupportHome, alt: 'Other Assistance / Support' },
  ];

  const [heroIndex, setHeroIndex] = useState(0);

  const newsForm = useForm({
    initialValues: { title: '', description: '', imageFile: null },
    validate: {
      title: (v) => (String(v).trim().length > 0 ? null : 'Title is required'),
      description: (v) => (String(v).trim().length > 0 ? null : 'Description is required'),
    },
  });

  // Maintain a preview of the selected image (scaled down)
  useEffect(() => {
    const file = newsForm.values.imageFile;
    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [newsForm.values.imageFile]);

  // Auto-rotate hero carousel every 2 seconds
  useEffect(() => {
    if (heroSlides.length <= 1) return undefined;

    const id = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 2000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const limit = 5;
    getNewsList({ page, limit })
      .then((res) => {
        if (!active) return;
        const rows = res.data.data || [];
        setNews(rows);
        const meta = res.data.meta || {};
        const total = Number(meta.total ?? 0);
        const lim = Number(meta.limit ?? limit);
        let pages = 1;
        if (total > 0 && lim > 0) {
          pages = Math.max(1, Math.ceil(total / lim));
        } else if (rows.length >= lim) {
          // Fallback: if backend omits meta or ignores limit but returns at least a full page, assume more pages exist
          pages = Math.max(2, page + 1);
        }
        setTotalPages(pages);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        setError('Failed to load latest news');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  useEffect(() => {
    let active = true;
    setAnnLoading(true);
    setAnnError(null);
    getAnnouncements({ page: 1, limit: 6 })
      .then((res) => {
        if (!active) return;
        setAnnouncements(res.data.data || []);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        setAnnError('Failed to load latest announcements');
      })
      .finally(() => {
        if (!active) return;
        setAnnLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const getCurrentUserId = () => {
    if (!user) return null;
    return user.id ?? user.userId ?? null;
  };

  const mappedNews = (news || []).map((n) => ({
    id: n.id,
    title: n.title,
    imageUrl: n.imageUrl,
    // Prefer content; fall back to any legacy description/shortDescription/snippet
    description: n.content || n.description || n.shortDescription || n.snippet || '',
    href: `/news/${n.id}`,
    ownerId:
      n.createdById ??
      n.createdByUserId ??
      n.userId ??
      n.authorId ??
      n.createdBy ??
      null,
  }));

  const mappedAnnouncements = (announcements || []).map((a) => ({
    id: a.id,
    title: a.title,
    imageUrl: a.imageUrl,
    href: `/announcements/${a.id}`,
  }));

  const staticSearchItems = [
    { title: 'Services', description: 'Explore all municipal population services', href: '/services', type: 'Page' },
    { title: 'Calendar', description: 'View schedules, activities, and events', href: '/calendar', type: 'Page' },
    { title: 'Education', description: 'Read learning materials and educational content', href: '/education', type: 'Page' },
    { title: 'FAQs', description: 'Frequently asked questions', href: '/faqs', type: 'Page' },
    { title: 'Contact', description: 'Contact the Municipal Population Office', href: '/contact', type: 'Page' },
    {
      title: 'Pre-Marriage Orientation & Counseling (PMOC)',
      description: 'Pre-marriage orientation schedules and booking',
      href: '/services/pre-marriage-orientation',
      type: 'Service'
    },
    {
      title: 'Usapan Sessions (Usapan Series)',
      description: 'Barangay sessions on responsible parenthood and teen health',
      href: '/services/usapan-series',
      type: 'Service'
    },
    {
      title: 'Responsible Parenthood & Family Development (RPFP)',
      description: 'Family planning, BIBA, Parent-Teen Talk, U4U Teen Trail',
      href: '/services/rpfp',
      type: 'Service'
    },
    {
      title: 'Adolescent Health and Development Program (AHDP)',
      description: 'Youth-centered programs for teen pregnancy prevention',
      href: '/services/ahdp',
      type: 'Service'
    },
    {
      title: 'Population Awareness & IEC Activities',
      description: 'Information, education and communication activities',
      href: '/services/iec',
      type: 'Service'
    },
    {
      title: 'Demographic Data Collection & Population Profiling',
      description: 'Population data collection and profiling support',
      href: '/services/population-profiling',
      type: 'Service'
    },
    {
      title: 'Support During Community Events',
      description: 'LGU caravans and mobile population education support',
      href: '/services/community-events',
      type: 'Service'
    },
    {
      title: 'Other Assistance Service',
      description: 'Referral-based assistance depending on municipal arrangements',
      href: '/services/other-assistance',
      type: 'Service'
    },
  ];

  const localSiteSearchResults = React.useMemo(() => {
    const q = String(siteSearch || '').trim().toLowerCase();
    if (!q) return [];

    const items = [];
    staticSearchItems.forEach((it) => {
      const hay = `${it.title} ${it.description || ''}`.toLowerCase();
      if (hay.includes(q)) items.push({ ...it });
    });

    return items.slice(0, 12);
  }, [siteSearch]);

  const siteSearchResults = React.useMemo(() => {
    const q = String(siteSearch || '').trim();
    if (!q) return [];

    const merged = [];
    localSiteSearchResults.forEach((x) => merged.push(x));
    (siteSearchRemote || []).forEach((x) => merged.push(x));
    return merged.slice(0, 12);
  }, [siteSearch, localSiteSearchResults, siteSearchRemote]);

  useEffect(() => {
    let active = true;
    const q = String(siteSearch || '').trim();
    if (!q) {
      setSiteSearchRemote([]);
      setSiteSearchLoading(false);
      return () => {
        active = false;
      };
    }

    setSiteSearchLoading(true);
    const t = setTimeout(() => {
      searchSite({ q, page: 1, limit: 8 })
        .then((res) => {
          if (!active) return;
          const rows = res?.data?.data || [];
          const mapped = rows.map((r) => ({
            title: r.title,
            description: r.snippet || (r.type === 'Announcement' ? 'Announcement' : ''),
            href: r.href,
            type: r.type
          }));
          setSiteSearchRemote(mapped);
        })
        .catch(() => {
          if (!active) return;
          setSiteSearchRemote([]);
        })
        .finally(() => {
          if (!active) return;
          setSiteSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [siteSearch]);

  // Note: using server-side pagination (limit=5) with totalPages from API

  const handleNewsSubmit = async (values) => {
    try {
      let imageUrl = null;
      if (values.imageFile instanceof File) {
        setUploadProgress(1);
        const up = await uploadImage(values.imageFile, {
          onProgress: (pct) => setUploadProgress(pct),
        });
        imageUrl = up?.data?.data?.publicUrl || null;
      }

      const payload = {
        title: values.title,
        content: values.description,
        imageUrl,
        isPublished: true,
      };
      await createNews(payload);
      showNotification({ title: 'News Created', message: 'SUCCESSFULLY!', color: 'green' });
      setNewsModalOpened(false);
      newsForm.reset();
      setUploadProgress(0);
      // Refresh homepage news immediately
      const limit = 5;
      const res = await getNewsList({ page: 1, limit });
      const rows = res?.data?.data || [];
      setNews(rows);
      const meta = res?.data?.meta || {};
      const total = Number(meta.total ?? 0);
      const lim = Number(meta.limit ?? limit);
      let pages = 1;
      if (total > 0 && lim > 0) {
        pages = Math.max(1, Math.ceil(total / lim));
      } else if (rows.length >= lim) {
        pages = Math.max(2, 2);
      }
      setTotalPages(pages);
      setPage(1);
    } catch (err) {
      console.error(err);
      setUploadProgress(0);
      const msg = err?.response?.data?.error?.message || 'Failed to create news';
      showNotification({ title: 'Error', message: msg, color: 'red' });
    }
  };

  return (
    <div className="pb-4" style={{backgroundColor: 'rgba(240, 239, 239, 1)'}}>
      {/* Local override: prevent global button :hover styles from affecting carousel controls */}
      <style>{`
        .no-hover-effect:hover,
        .no-hover-effect:focus,
        .no-hover-effect:active {
          transform: none !important;
          box-shadow: none !important;
          filter: none !important;
          background: transparent !important;
          opacity: 1 !important;
        }
      `}</style>

      <section
        className="py-5 position-relative"
        style={{
          backgroundImage: `url(${heroBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >

        <div className="container position-relative">
          <div className="row align-items-center g-6">
            <div className="col-12 col-lg-6">
              <div className="pe-lg-4">
                <h1 className="display-5 fw-bold text-dark mb-3 ">
                  Municipal Office of Population
                </h1>
                <p className="lead text-secondary mb-4" style={{ maxWidth: '450px', textAlign: 'justify' }}>
                  Serving the people of San Fabian with accurate population data, responsible parenthood programs,
                  and community development initiatives.
                </p>
                <div className="d-flex gap-2">
                  <button className="btn btn-primary btn-lg" onClick={() => navigate('/services')}>Explore Services</button>
                  <button className="btn btn-outline-primary btn-lg" onClick={() => navigate('/contact')}>Contact Us</button>
                </div>
              </div>
              <br />
            </div>

            <div className="col-12 col-lg-6">
              <div
                id="heroServicesCarousel"
                className="carousel slide carousel-fade shadow-sm rounded overflow-hidden"
                style={{ maxHeight: '380px', height: '100%' }}
              >
                <div className="carousel-inner">
                  {heroSlides.map((slide, idx) => (
                    <div
                      key={slide.alt}
                      className={`carousel-item d-flex justify-content-center align-items-center${
                        idx === heroIndex ? ' active' : ''
                      }`}
                    >
                      <img
                        src={slide.src}
                        className="d-block"
                        alt={slide.alt}
                        style={{ objectFit: 'contain', height: '100%', width: 'auto', maxWidth: '100%' }}
                      />
                    </div>
                  ))}
                </div>
                {/*
                  <button
                    className="carousel-control-prev no-hover-effect"
                    type="button"
                    style={{ opacity: 1 }}
                    onClick={() =>
                      setHeroIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)
                    }
                  >
                    <span className="carousel-control-prev-icon" aria-hidden="true"></span>
                    <span className="visually-hidden">Previous</span>
                  </button>
                  <button
                    className="carousel-control-next no-hover-effect"
                    type="button"
                    style={{ opacity: 1 }}
                    onClick={() => setHeroIndex((prev) => (prev + 1) % heroSlides.length)}
                  >
                    <span className="carousel-control-next-icon" aria-hidden="true"></span>
                    <span className="visually-hidden">Next</span>
                  </button>
                */}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-5 bg-white">
        <div className="container">
          <div className="row g-4">
            <div className="col-12 col-lg-8">
              <h2 className="h3 fw-bold text-uppercase mb-3">News & Announcement</h2>
              {(isAdmin || isOfficer) && (
                <div className="d-flex justify-content-end mb-2">
                  <button className="btn btn-sm btn-primary" onClick={() => setNewsModalOpened(true)}>Add News & Announcement</button>
                </div>
              )}
              {loading ? (
                <div className="py-4 text-center">
                  <div className="spinner-border" role="status" aria-label="Loading news" />
                </div>
              ) : error ? (
                <div className="alert alert-danger" role="alert">{error}</div>
              ) : (
                <div className="list-group list-group-flush">
                  {mappedNews.map((n) => (
                    <article key={n.id} className="py-4 border-bottom">
                      <div className="d-flex gap-3 gap-md-4">
                        {n.imageUrl && (
                          <img
                            src={n.imageUrl}
                            alt={n.title}
                            className="rounded-2 flex-shrink-0 shadow-sm"
                            style={{ width: 220, height: 140, objectFit: 'contain' }}
                          />
                        )}
                        <div className="flex-grow-1">
                          <h3 className="h5 mb-1 text-uppercase">
                            <a href={n.href} className="text-decoration-none text-blue fw-bold">
                              {n.title}
                            </a>
                          </h3>
                          {n.description && (
                            <p className="mb-2 text-secondary fs-6" style={{ maxWidth: '70ch', textAlign: 'justify' }}>
                              {n.description.length > 200 ? `${n.description.slice(0, 200)}...` : n.description}
                            </p>
                          )}
                          <a href={n.href} className="text-primary small fw-semibold text-decoration-none">
                            READ MORE →
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                  {/* Pagination (Mantine, consistent with CalendarPage) */}
                  {totalPages > 1 && (
                    <div className="mt-3 d-flex justify-content-center" aria-label="News pagination">
                      <Pagination
                        total={totalPages}
                        value={page}
                        onChange={setPage}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="col-12 col-lg-4">
              <div className="vstack gap-3">
                <div className="card shadow-sm">
                  <div className="card-header py-2 px-3 bg-light">
                    <h5 className="card-title h6 mb-0">Search</h5>
                  </div>
                  <div className="card-body py-2 px-3">
                    <TextInput
                      value={siteSearch}
                      onChange={(e) => {
                        setSiteSearch(e.currentTarget.value);
                        setSiteSearchOpen(true);
                      }}
                      onFocus={() => setSiteSearchOpen(true)}
                      onBlur={() => {
                        // Allow click on results before closing
                        setTimeout(() => setSiteSearchOpen(false), 150);
                      }}
                      placeholder="Search the website..."
                      aria-label="Search the website"
                    />

                    {siteSearchOpen && siteSearchResults.length > 0 && (
                      <div className="mt-2">
                        <div className="list-group">
                          {siteSearchResults.map((r) => (
                            <button
                              key={`${r.type}-${r.href}-${r.title}`}
                              type="button"
                              className="list-group-item list-group-item-action"
                              onClick={() => {
                                setSiteSearchOpen(false);
                                setSiteSearch('');
                                navigate(r.href);
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-start">
                                <div className="me-2" style={{ textAlign: 'left' }}>
                                  <div className="fw-semibold">{r.title}</div>
                                  {r.description ? (
                                    <div className="small text-muted">
                                      {String(r.description).length > 80
                                        ? `${String(r.description).slice(0, 80)}...`
                                        : r.description}
                                    </div>
                                  ) : null}
                                </div>
                                <span className="badge text-bg-light border">{r.type}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {siteSearchOpen && siteSearchLoading && (
                      <div className="mt-2 small text-muted">Searching...</div>
                    )}

                    {siteSearchOpen && String(siteSearch || '').trim() && siteSearchResults.length === 0 && (
                      <div className="mt-2 small text-muted">No results found.</div>
                    )}
                  </div>
                </div>
                <div className="card shadow-sm">
                  <div className="card-header py-2 px-3 bg-light">
                    <h5 className="card-title h6 mb-0"> Services</h5>
                  </div>
                  <div className="card-body">
                    <ul className="small mb-0">
                      <li><a href="/services/pre-marriage-orientation" className="text-decoration-none">Pre-Marriage Orientation (PMOC)</a></li>
                      <li><a href="/services/usapan-series" className="text-decoration-none">Usapan Series</a></li>
                      <li><a href="/services/responsible-parenthood-family-development" className="text-decoration-none">Responsible Parenthood & Family Development (RPFP)</a></li>
                      <li><a href="/services/adolescent-health-and-development-program" className="text-decoration-none">Adolescent Health and Development Program (AHDP)</a></li>
                      <li><a href="/services/Iec" className="text-decoration-none">Population Awareness & IEC Activities</a></li>
                      <li><a href="/services/Population-Profiling" className="text-decoration-none">Demographic Data Collection & Population Profiling</a></li>
                      <li><a href="/services/Community-Events" className="text-decoration-none">Support During Community Events</a></li>
                      <li><a href="/services/Other-Assistance" className="text-decoration-none">Other Assistance</a></li>
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
            </div>
          </div>
        </div>
      </section>
      <MissionVision />

      {/* Add News and Announcement Modal (styled similar to Calendar Add Schedule modal) */}
      <Modal
        opened={newsModalOpened}
        onClose={() => {
          setNewsModalOpened(false);
          setUploadProgress(0);
        }}
        withCloseButton={false}
        centered
        size="xl"
        padding={0}
        styles={{
          content: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
          },
          body: {
            padding: 0,
          },
        }}
      >
        <div className="card border-0 shadow-lg" style={{ borderRadius: '0.75rem' }}>
          <form
            onSubmit={newsForm.onSubmit((values) => {
              handleNewsSubmit(values).catch(() => {});
            })}
          >
            <div className="row g-0 align-items-stretch">
              {/* Left: preview panel */}
              <div
                className="col-md-4 d-none d-md-block bg-light"
                style={{ borderRight: '1px solid #e5e7eb' }}
              >
                <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center" align="left">
                  <div className="mb-2 small text-muted">News & Announcement preview</div>
                  <Stack gap="xs">
                    <Text fw={600}>
                      {newsForm.values.title || 'Untitled news'}
                    </Text>
                    <Text size="sm" c="dimmed" lineClamp={4}>
                      {newsForm.values.description || 'News description will appear here once provided.'}
                    </Text>
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Selected preview"
                        className="img-fluid rounded border mt-2"
                        style={{ maxHeight: 160, objectFit: 'contain' }}
                      />
                    )}
                  </Stack>
                </div>
              </div>

              {/* Right: form fields */}
              <div className="col-12 col-md-8 p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <div className="text-uppercase small text-muted mb-1">News & Announcement</div>
                    <h2 className="h5 mb-0">Add News</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => {
                      setNewsModalOpened(false);
                      setUploadProgress(0);
                    }}
                  />
                </div>

                <Stack gap="sm">
                  <FileInput
                    label="News Image (optional)"
                    accept="image/*"
                    {...newsForm.getInputProps('imageFile')}
                  />
                  {previewUrl && (
                    <div className="mt-2 d-flex flex-column align-items-start gap-2">
                      <img
                        src={previewUrl}
                        alt="Selected preview"
                        className="img-fluid rounded border"
                        style={{ maxHeight: 220, objectFit: 'contain' }}
                      />
                      <MantineButton
                        variant="subtle"
                        color="red"
                        size="xs"
                        onClick={() => {
                          newsForm.setFieldValue('imageFile', null);
                          setPreviewUrl(null);
                          setUploadProgress(0);
                        }}
                      >
                        Remove image
                      </MantineButton>
                    </div>
                  )}
                  <TextInput label="News Title" required {...newsForm.getInputProps('title')} />
                  <Textarea
                    label="News Description"
                    required
                    autosize
                    minRows={4}
                    maxRows={12}
                    {...newsForm.getInputProps('description')}
                  />
                  {uploadProgress > 0 && uploadProgress < 100 && <Progress value={uploadProgress} />}
                </Stack>

                <div className="d-flex justify-content-end gap-2 pt-3 mt-3 border-top">
                  <MantineButton
                    type="button"
                    variant="default"
                    onClick={() => {
                      setNewsModalOpened(false);
                      setUploadProgress(0);
                    }}
                  >
                    Cancel
                  </MantineButton>
                  <MantineButton type="submit">Submit</MantineButton>
                </div>
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
