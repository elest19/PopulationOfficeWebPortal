import React from 'react';
import { Stack, Title, Text, Paper, Divider, Image } from '@mantine/core';
import { ServiceBootstrapLayout } from './ServiceBootstrapLayout.jsx';
import imgDemographicHome from '../../content/Home Images/DemographicHomePage.jpg';

export function PopulationProfiling() {
  const paperStyle = { wordBreak: 'break-word', overflowWrap: 'break-word' };
  
  const imageStyle = { 
    marginBottom: '1rem', 
    maxWidth: '400px', 
    marginLeft: 'auto', 
    marginRight: 'auto' 
  };

  return (
    <ServiceBootstrapLayout
      imageUrl={imgDemographicHome}
      imageAlt="Demographic Data Collection & Population Profiling"
    >
      <>
        <Text align="justify" className="mb-2">
          <b>Demographic Data Collection and Population Profiling</b>  is the "raw" gathering of facts. Unlike a national census that happens every few years, the local Population Office often conducts more frequent, localized surveys to keep their records "live."
          Population workers (often volunteer Barangay Population Workers) go house-to-house to interview families.
          The data is then compiled and used to create population profiles, which are used to plan and implement programs and services.
        </Text>

        <Paper radius="md" p="md" style={paperStyle} className="mb-2">
          <Title order={3}>Key Data Points:</Title>
          <Text style={{ padding: "10px", lineHeight: "200%", textAlign: "justify" }}>
            <b>Family Size & Composition:</b> Number of children, seniors, and working adults.<br />
            <b>Health Status:</b> Use of family planning, immunization records, and nutrition levels (to identify malnourished children).<br />
            <b>Socio-Economic Info:</b> Income levels, occupation, and educational attainment.<br />
            <b>Housing & Sanitation:</b> Type of housing material, access to clean water, and presence of sanitary toilets.<br />
          </Text>
        </Paper>

        <Text align="justify" className="mb-3">
          <b>Population Profiling</b>  happens once the data is collected, it is then "profiled." Profiling means turning raw numbers into a story or a map that identifies the community's needs.
          A comprehensive report for each barangay that summarizes who lives there. For example, it might show that "Barangay X has a high number of pregnant teenagers" or "Barangay Y has a high percentage of unemployed fathers."
        </Text>
        <Paper radius="md" p="md" style={paperStyle}>
          <Title order={3}>Targeting Vulnerable Groups:</Title>
          <Text style={{ padding: "10px", lineHeight: "200%", textAlign: "justify" }}>
            <b>Indigent Families:</b> Those living below the poverty line who qualify for government subsidies.<br />
            <b>Out-of-School Youth (OSY):</b> Identifying teens who need vocational training.<br />
            <b>Solo Parents:</b> Ensuring they are registered to receive legal benefits.<br />
          </Text>
        </Paper>
      </>
    </ServiceBootstrapLayout>
  );
}
