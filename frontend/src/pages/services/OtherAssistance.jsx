import React from 'react';
import { Stack, Title, Text, Paper, Divider, SimpleGrid, Image } from '@mantine/core';
import { ServiceBootstrapLayout } from './ServiceBootstrapLayout.jsx';
import imgSupportHome from '../../content/Home Images/SupportHomePage.jpg';
import { YouTubeWithConsent } from '../../components/common/YouTubeWithConsent.jsx';
import RHULogo from '../../content/servicesImage/RHU.jpg';
import YouthLogo from '../../content/servicesImage/Youth.jpg';
import RedCrossLogo from '../../content/servicesImage/RedCross.png';

export function OtherAssistance() {
  const paperStyle = { wordBreak: 'break-word', overflowWrap: 'break-word' };
  
  // (Kept for potential future media styling)
  const imageStyle = {
    marginBottom: '1rem',
    maxWidth: '400px',
    marginLeft: 'auto',
    marginRight: 'auto',
  };

  return (
    <ServiceBootstrapLayout
      imageUrl={imgSupportHome}
      imageAlt="LGU assistance and referral services"
    >
      <>
        <Text align="justify" className="mb-3">
          Other Assistance includes referral-based support that the LGU may provide depending on local arrangements.
          The focus is on counseling, information, and connecting clients to appropriate health or social welfare
          partners.
        </Text>
        
        <Divider className="mb-3" />

        <Stack>
          <Title order={3}>Partner Agencies</Title>
          <SimpleGrid 
            cols={3} 
            spacing="md" 
            breakpoints={[
              { maxWidth: 'md', cols: 2 }, 
              { maxWidth: 'sm', cols: 1 }
            ]}
          >
            <Paper withBorder radius="md" p="md">
              <Stack>
                <Image
                  src={RedCrossLogo}
                  alt="Philippine Red Cross"
                  radius="sm"
                />
                <Title order={4}>Philippine Red Cross</Title>
                <Text size="sm">
                  Partner in emergency response, first aid, blood donation mobilization, 
                  and community health information during caravans and outreach events.
                </Text>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Stack>
                <Image
                  src={YouthLogo}
                  alt="Local youth organizations"
                  radius="sm"
                />
                <Title order={4}>Local Youth Organizations</Title>
                <Text size="sm">
                  Engage youth leaders and volunteers in U4U/AHYD activities, peer 
                  education, and information sessions that are youth-friendly and inclusive.
                </Text>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Stack>
                <Image
                  src={RHULogo}
                  alt="RHU of San Fabian"
                  radius="sm"
                />
                <Title order={4}>RHU of San Fabian</Title>
                <Text size="sm">
                  Provides clinical services, counseling, and referrals during caravans; 
                  coordinates schedules and facility-based follow-up for clients reached 
                  in the community.
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Stack> 

        <hr />

        {/* 1. Health-Related Procedures: The "Referral Chain" */}
        <Stack spacing="md" className="mb-4">
          <Title order={2}>Health-Related Procedures: The "Referral Chain"</Title>
          <Paper withBorder radius="md" p="md" style={paperStyle}>
            <Title order={3}>Vasectomy</Title>
            <YouTubeWithConsent
              videoUrl="https://www.youtube.com/embed/W4sr_lOD3jk"
              title="What to Know Before Getting A Vasectomy | Kevin Campbell, MD | UF Health"
              ratio="16x9"
            />
            <Text align="justify">
              Vasectomy is a permanent family planning option for men who are sure they do not want more children.
              Under the MNCHN (Maternal, Newborn, Child Health and Nutrition) guidelines, the LGU focuses on demand
              generation and navigation rather than performing the surgical procedure itself.
            </Text>
            <Text align="justify" mt="sm">
              Before any referral, clients undergo <strong>Pre‑Referral Counseling</strong>. This is a mandated
              session where a counselor uses the Decision‑Making Tool (DMT) to ensure that the client&apos;s decision is
              voluntary and fully informed.
            </Text>
            
            <Divider my="md" />
            
            <Title order={3}>Ligation</Title>
            <YouTubeWithConsent
              videoUrl="https://www.youtube.com/embed/GxRJH2f--P0"
              title="Tubal Ligation Surgery"
              ratio="16x9"
            />
            <Text align="justify">
              Ligation (tubal ligation) is a permanent family planning option for women who are sure they do not want
              more children. Similar to vasectomy, the LGU&apos;s role is to prepare and navigate clients toward accredited
              facilities that can safely perform the procedure.
            </Text>
            <Text align="justify" mt="sm">
              Through <strong>Ligation/Vasectomy Caravans</strong>, the LGU may consolidate 10–20 clients and provide a
              dedicated vehicle (often an ambulance or van) to transport them to DOH‑retained hospitals or
              PhilHealth‑accredited private clinics.
            </Text>
            <Text align="justify" mt="sm">
              LGU staff also help clients review their <strong>PhilHealth Member Data Record (MDR)</strong> so that
              eligible indigent clients can avail of <strong>No Balance Billing</strong> and pay zero out‑of‑pocket for
              the procedure.
            </Text>
          </Paper>
        </Stack>

        {/* 2. Civil Registration: The "Legal Gateway" */}
        <Stack spacing="md" className="mb-4">
          <Title order={2}>Civil Registration: The "Legal Gateway"</Title>
          <Paper withBorder radius="md" p="md" style={paperStyle}>
            <Title order={3}>A. Late Birth Registration Process</Title>
            <YouTubeWithConsent
              videoUrl="https://www.youtube.com/embed/aBll55Hk-FE"
              title="Late PSA Birth Certificate Registration in the Philippines: Step-by-Step Guide"
              ratio="16x9"
            />
            <Text align="justify">
              Birth registration and mass weddings are managed by the Local Civil Registrar (LCR) under Republic Act No. 3753. For children in remote areas, the LGU helps parents complete late registration through <strong>Mobile Registration</strong> activities.
            </Text>
            <Text align="justify" mt="sm">
              The LGU first assists parents in obtaining a <strong>Negative Certification</strong> from the PSA to
              confirm that the child has not been registered elsewhere. If hospital records are missing (e.g., home
              births), staff coordinate with the Barangay Captain to identify two neighbors who can execute an
              <strong> Affidavit of Two Disinterested Persons</strong> to attest to the child&apos;s birth in that locality.
            </Text>
            <Text align="justify" mt="sm">
              For children of unmarried parents, the LGU helps implement <strong>RA 9255</strong> by assisting the
              father in signing the <strong>Affidavit of Admission of Paternity (AAP)</strong>, allowing the child to
              legally use the father&apos;s surname.
            </Text>

            <Divider my="md" />

            <Title order={3} mt="md">B. Kasalang Bayan (Mass Wedding) Screening</Title>
            <YouTubeWithConsent
              videoUrl="https://www.youtube.com/embed/RAUW222iY5U"
              title="Mga dapat ihandang dokumento sa libreng kasalan"
              ratio="16x9"
            />
            <Text align="justify">
              In partnership with the Mayor&apos;s Office, we organize and screen candidates for annual
              <strong> Kasalang Bayan</strong> (Mass Wedding) events. Beyond the ceremony, this serves as a legal vetting
              process.
            </Text>
            <Text align="justify" mt="sm">
              The LGU often assists couples in securing their <strong>CENOMAR (Certificate of No Marriage)</strong> to
              ensure that neither party is in an existing legal union. For couples who have lived together for five or
              more years, staff facilitate an <strong>Affidavit of Cohabitation</strong> under Article 34, allowing them
              to marry without the standard 10‑day posting of a marriage license.
            </Text>
          </Paper>
        </Stack>

        {/* 3. Special Population Case Management (OFW Families) */}
        <Stack spacing="md">
          <Title order={2}>Special Population Case Management (OFW Families)</Title>
          <Paper withBorder radius="md" p="md" style={paperStyle}>
            <Title order={3}>OFW Family Support</Title>
            <YouTubeWithConsent
              videoUrl="https://www.youtube.com/embed/ZZ3nZ66ykcs"
              title="OFW Help Desk | TFC News EMEA"
              ratio="16x9"
            />
            <Text align="justify">
              We offer specialized guidance and counseling for the families of Overseas Filipino Workers (OFWs), focusing
              on the <strong>social cost of migration</strong>. LGUs are now mandated to maintain an OFW Help Desk under
              RA 8042.
            </Text>
            <Text align="justify" mt="sm">
              For <strong>Left‑Behind Families (LBFs)</strong>, the LGU organizes OFW Family Circles (OFCs) — support
              groups where spouses and caregivers can discuss parenting, mental health, and shared challenges.
            </Text>
            <Text align="justify" mt="sm">
              In crisis situations (e.g., distressed or broken‑contract OFWs abroad), the LGU acts as a local link to <strong>OWWA</strong>, helping families process repatriation requests or insurance claims without having to
              travel to the regional center.
            </Text>
            <Text align="justify" mt="sm">
              Many LGUs also coordinate <strong>financial literacy</strong> activities with banks and partners, guiding
              families on how to channel remittances into productive investments such as micro‑enterprises, livelihood
              projects, or small family businesses.
            </Text>
          </Paper>
        </Stack>
      </>
    </ServiceBootstrapLayout>
  );
}
