import React from 'react';

const cardBaseStyle = {
  height: 'auto',
  // Allow height to grow with content while keeping a nice minimum height
  minHeight: '180px',
  borderRadius: '1rem',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  background: 'linear-gradient(145deg, #ffffff, #f5f7ff)',
  transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
  cursor: 'default',
};

function attachHoverAnimation(e, active) {
  if (active) {
    e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
    e.currentTarget.style.boxShadow = '0 0.75rem 1.5rem rgba(15, 23, 42, 0.16)';
    e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.4)';
  } else {
    e.currentTarget.style.transform = 'none';
    e.currentTarget.style.boxShadow = '';
    e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
  }
}

export default function MissionVision() {
  return (
    <section
      className="py-5"
      style={{ backgroundColor: 'rgba(240, 239, 239, 1)13, 1)', borderTop: '1px solid lightgray' }}
    >
      <div className="container">
        <h2 className="h1 mb-4 hover-underline" align="center"><b>MISSION & VISION</b></h2>
        <hr />
        <div className="row g-4" align="justify">
          <div className="col-12 col-sm-6 col-lg-4 d-flex">
            <div
              className="card shadow-sm w-100 h-100 holographic-card"
              style={cardBaseStyle}
              onMouseEnter={(e) => attachHoverAnimation(e, true)}
              onMouseLeave={(e) => attachHoverAnimation(e, false)}
            >
              <div className="card-body d-flex flex-column justify-content-center align-items-start gap-3">
                <h5 className="card-title mb-2 hover-underline">Mission</h5>
                <div>
                  <p className="card-text mb-0">
                    To strengthen institutional capacities to formulate, coordinate, and implement integrated population
                    and development strategies, policies, and programs, grounded in socioeconomic and demographic data,
                    information, and knowledge.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg-4 d-flex">
            <div
              className="card shadow-sm w-100 h-100"
              style={cardBaseStyle}
              onMouseEnter={(e) => attachHoverAnimation(e, true)}
              onMouseLeave={(e) => attachHoverAnimation(e, false)}
            >
              <div className="card-body d-flex flex-column justify-content-center align-items-start gap-3">
                <h5 className="card-title mb-2 hover-underline">Vision</h5>
                <div>
                  <p className="card-text mb-4">
                    To be the lead agency advancing the country&apos;s population and development policies and programs,
                    increasing every Filipino&apos;s share in and opportunity for socioeconomic progress.
                  </p>
                </div>
              </div>   
            </div>
          </div>
          
          <div className="col-12 col-sm-6 col-lg-4 d-flex">
            <div
              className="card shadow-sm w-100 h-100"
              style={cardBaseStyle}
              onMouseEnter={(e) => attachHoverAnimation(e, true)}
              onMouseLeave={(e) => attachHoverAnimation(e, false)}
            >
              <div className="card-body d-flex flex-column justify-content-center align-items-start gap-3">
                <h5 className="card-title mb-2 hover-underline">Beliefs</h5>
                <ul>
                  <li className="card-text mb-0"><b>Excellence</b> - To be the best.</li>
                  <li className="card-text mb-0"><b>Integrity</b> - To be trusted.</li>
                  <li className="card-text mb-0"><b>Adaptiveness</b> - To stay relevant.</li>
                  <li className="card-text mb-0"><b>Inclusivity</b> - To be fair.</li>
                </ul> 
                </div>
              </div>  
            </div>
          </div>
        </div>
      </section>
  );
}
