import React from 'react';

export default function AnnouncementsGrid({ title = 'News & Announcements', items = [], viewAllHref = '#' }) {
  return (
    <section className="py-5">
      <div className="container">
        <div className="d-flex justify-content-between align-items-end mb-3">
          <h2 className="h3 m-0">{title}</h2>
          <a href={viewAllHref} className="text-decoration-none">View all</a>
        </div>

        <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
          {items.map((n) => (
            <div className="col" key={n.id}>
              <div className="card h-100 shadow-sm">
                {n.imageUrl || n.image ? (
                  <img
                    src={n.imageUrl || n.image}
                    className="card-img-top"
                    alt={n.title}
                    style={{ objectFit: 'cover', height: 160 }}
                  />
                ) : null}
                <div className="card-body">
                  <h5 className="card-title">{n.title}</h5>
                  {(n.date || n.publishedAt) && (
                    <p className="card-text text-muted small mb-2">{n.date || n.publishedAt}</p>
                  )}
                  {n.snippet && <p className="card-text">{n.snippet}</p>}
                </div>
                <div className="card-footer bg-transparent border-0 pt-0">
                  <a href={n.href || '#'} className="btn btn-outline-primary btn-sm">Read more</a>
                </div>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="col">
              <div className="alert alert-light border">
                No items to display right now. Please check back later.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
