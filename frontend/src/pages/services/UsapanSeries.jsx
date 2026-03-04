import React from 'react';
import { ServiceBootstrapLayout } from './ServiceBootstrapLayout.jsx';
import imgUsapanHome from '../../content/Home Images/UsapanSeriesHomePage.jpg';

export function UsapanSeries() {
  return (
    <ServiceBootstrapLayout
      imageUrl={imgUsapanHome}
      imageAlt="Usapan Sessions"
    >
      <p>
        The <b>Usapan Series</b> is an interactive, group-based information and service delivery strategy designed to reach
        individuals at the community level. It aims to bridge the gap between awareness and practice by providing a
        comfortable space for couples and individuals to discuss reproductive health, family planning, and responsible
        parenthood.
      </p>
      <div className="mb-4">
        <a className="btn btn-primary" href="/services?book=usapan">Book An Appointment</a>
      </div>
      <hr />
      <h3 className="h5 mt-4"><b>The Three Core Modules of the Series</b></h3>
      <p>
        The program is categorized into three specific "Usapan" (Talk) sessions, each tailored to a different demographic
        or life stage:
      </p>

      
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h4 className="h5 mt-3"><b>1. Usapan ni Buntis (Talk for Pregnant Women)</b></h4>
          <p className="mb-2">
            This session is dedicated to expectant mothers and their partners. It focuses on ensuring a safe pregnancy and
            preparing for the future of the newborn.
          </p>
          <ul className="mb-0">
            <li><strong>Maternal Health:</strong> Educating mothers on prenatal care, nutrition, and identifying danger signs
              during pregnancy.</li>
            <li><strong>Safe Motherhood:</strong> Discussing the importance of facility-based delivery and skilled birth
              attendance.</li>
            <li><strong>Post-partum Family Planning:</strong> Helping parents decide on a family planning method before the
              baby is born to ensure proper birth spacing.</li>
          </ul>
        </div>
      </div>
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h4 className="h5 mt-3"><b>2. Usapan ni Nanay at Tatay (Talk for Mothers and Fathers)</b></h4>
          <p>
            This module targets current parents and couples of reproductive age who wish to space their children or limit their
            family size.
          </p>
          <ul>
            <li><strong>Responsible Parenthood:</strong> Re-orienting parents on their roles and the importance of providing
              for the basic needs of their children (education, health, love).</li>
            <li><strong>Modern Family Planning Methods:</strong> A detailed discussion on various methods (pills, implants,
              IUDs, etc.) to dispel myths and misconceptions.</li>
            <li><strong>Decision Making:</strong> Encouraging joint decision-making between partners regarding family size and
              financial planning.</li>
          </ul>
      </div>
    </div>
    <div className="card shadow-sm mb-3">
      <div className="card-body">
        <h4 className="h5 mt-3"><b>3. Usapan ng mga Kabataan (Talk for the Youth)</b></h4>
        <p>
          Focused on Adolescent Health and Development (AHD), this session addresses the unique needs of young people.
        </p>
        <ul>
          <li><strong>Adolescent Sexuality:</strong> Providing age-appropriate information on reproductive health to prevent
            teenage pregnancy.</li>
          <li><strong>Life Skills and Values:</strong> Guidance on self-esteem, peer pressure, and making responsible choices
            for their future careers and personal lives.</li>
          <li><strong>STI and HIV Awareness:</strong> Educating the youth on the risks and prevention of sexually transmitted
            infections.</li>
        </ul>
      </div>
    </div>

      <h3 className="h5 mt-4">Key Objectives of the Program</h3>
      <ul>
        <li><strong>Informed Choice:</strong> To provide accurate, scientific information so that every Filipino can make
          an informed choice regarding their reproductive health.</li>
        <li><strong>Service Linkage:</strong> Unlike a standard seminar, Usapan sessions often conclude with a direct link
          to health service providers, allowing participants to access their chosen family planning method immediately.</li>
        <li><strong>Community Engagement:</strong> Utilizing health caravans or barangay assemblies to bring government
          services directly to the doorsteps of the people.</li>
      </ul>

      <h3 className="h5 mt-4">Why is it Effective?</h3>
      <ul>
        <li><strong>Interactive Format:</strong> Uses a facilitated discussion style rather than a one-way lecture, allowing
          participants to ask questions and share personal concerns.</li>
        <li><strong>Culturally Sensitive:</strong> Sessions are conducted in local dialects and use relatable analogies to
          explain complex medical concepts.</li>
        <li><strong>Empowerment:</strong> Shifts the focus from population control to family well-being, emphasizing that
          planning a family is a pathway to a better quality of life.</li>
      </ul>
    </ServiceBootstrapLayout>
  );
}
