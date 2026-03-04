import React from 'react';

export default function Hero({ backgroundUrl, title = 'Municipal Office of Population', subtitle, onGetStarted }) {
  const sectionStyle = {
    minHeight: '60vh',
  };

  const bgStyle = {
    backgroundImage: `url(${backgroundUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'contrast(1.05)'
  };

  return (
    <section className="position-relative overflow-hidden" style={sectionStyle}>
      <div className="w-100 h-100 position-absolute top-0 start-0" style={bgStyle} aria-hidden="true" />
      <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.35))' }} />
      <div className="container position-relative text-white py-5 d-flex align-items-center" style={sectionStyle}>
        <div className="col-12 col-lg-8">
          <h1 className="display-5 fw-bold">{title}</h1>
          {subtitle && (
            <p className="lead mt-3">{subtitle}</p>
          )}
          <div className="mt-4">
            <button className="btn btn-primary btn-lg" onClick={onGetStarted}>Get Started</button>
          </div>
        </div>
      </div>
    </section>
  );
}
