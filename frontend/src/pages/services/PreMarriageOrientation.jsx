import React from 'react';
import { useNavigate } from 'react-router-dom';

import { ServiceBootstrapLayout } from './ServiceBootstrapLayout.jsx';
import imgPMOHome from '../../content/Home Images/PMOHomePage.jpg';
import { useAuth } from '../../context/AuthContext.jsx';

export function PreMarriageOrientation() {
  const navigate = useNavigate();
  const { user, isAdmin, isOfficer } = useAuth();

  const handleBookClick = () => {
    if (!user) {
      navigate('/services?book=pmo');
      return;
    }
    if (isAdmin || isOfficer) {
      navigate('/services?restricted=pmo');
      return;
    }
    navigate('/services?book=pmo');
  };

  return (
    <ServiceBootstrapLayout
      imageUrl={imgPMOHome}
      imageAlt="Pre-Marriage Orientation"
    >
      <p className="text-justify">
        The <b>Pre-Marriage Orientation and Counseling (PMOC)</b> program is a mandatory government service mandated by Presidential Decree 965 and the Responsible Parenthood and Reproductive Health Act (RA 10354). Before a marriage license can be issued by the Local Civil Registrar, all contracting parties, regardless of age, must participate in this program. Its primary goal is to provide would-be couples with a solid foundation for their future life together, moving beyond the wedding day to focus on the long-term success of the marriage and the health of the family unit.
      </p>
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleBookClick}
        >
          Book An Appointment
        </button>
      </div>

      <hr className="my-4" />
      <h2 className="h4">The Two Phases of the Program</h2>
      <h3 className="h5 mt-3 "><b>Phase 1: Pre-marriage Orientation (PMO)</b></h3>
      <div className="card shadow-sm mb-3"><div className="card-body">
        <p className="mb-2">
          The Orientation is the foundational phase that all couples must attend. This session typically lasts for a minimum of four hours and focuses on providing essential information about the legal and social aspects of marriage in the Philippines.
        </p>
        <ul className="mb-0">
          <li><b>Legal Responsibilities:</b> Couples are briefed on the Family Code of the Philippines, discussing the rights and obligations of both husband and wife.</li>
          <li><b>Responsible Parenthood:</b> This core module explores the value of "planning the family" based on the couple's health, income, and aspirations. It covers maternal and child health, the importance of breastfeeding, and newborn care.</li>
          <li><b>Home Management:</b> Guidance is provided on financial literacy, budgeting for a household, and maintaining a healthy work-life balance.</li>
        </ul>
      </div></div>

      <h3 className="h5"><b>Phase 2: Pre-Marriage Counseling (PMC)</b></h3>
      <div className="card shadow-sm mb-3"><div className="card-body">
        <p className="mb-2">
          While the Orientation is for everyone, the Counseling phase is more specialized. Under the law, this is mandatory for couples where at least one party is between 18 and 25 years old, as well as for couples who request it.
        </p>
        <ul className="mb-0">
          <li><b>Deep-Dive Discussions:</b> Led by accredited counselors, this phase focuses on the psychological and emotional readiness of the couple.</li>
          <li><b>Conflict Resolution:</b> Couples are taught communication techniques and healthy ways to resolve disagreements before they escalate.</li>
          <li><b>Individualized Guidance:</b> Based on a "Marriage Expectations Inventory" filled out during registration, the counselor helps the couple address specific concerns unique to their relationship.</li>
        </ul>
      </div></div>

      <hr className="my-4" />
      <h2 className="h4">Key Topics Covered</h2>
      <ul>
        <li><b>Marriage as an Inviolable Institution:</b> Understanding the sanctity and legal permanence of the union.</li>
        <li><b>Family Planning and Reproductive Health:</b> Providing scientifically accurate information on modern family planning methods to help couples space their children effectively.</li>
        <li><b>Gender Sensitivity:</b> Discussing equality in the home and the prevention of domestic violence.</li>
        <li><b>STI, HIV, and AIDS Awareness:</b> Educating couples on sexual health and protection.</li>
      </ul>

      <h3 className="h5">Why is it required?</h3>
      <p>
        The Philippine government views marriage as the "foundation of the nation." By requiring this orientation, the state aims to:
      </p>
      <ul>
        <li><b>Reduce Marriage Failures:</b> By ensuring couples have discussed critical issues (finances, kids, in-laws) before saying "I do."</li>
        <li><b>Promote Maternal Health:</b> By educating future mothers on the importance of prenatal care and proper birth spacing.</li>
        <li><b>Empower Families:</b> By providing access to government social and health services right at the start of their journey together.</li>
      </ul>

    </ServiceBootstrapLayout>
  );
}
