import React from 'react';
import { Title, Text, Stack, Paper, SimpleGrid, Image, Divider } from '@mantine/core';
import { ServiceBootstrapLayout } from './ServiceBootstrapLayout.jsx';
import imgPopulationAwarenessHome from '../../content/Home Images/PopulationAwarenessHomePage.jpg';

export function Iec() {
  return (
    <ServiceBootstrapLayout
      imageUrl={imgPopulationAwarenessHome}
      imageAlt="Population Awareness & IEC Activities"
    >
      <>
        <Text align="justify" className="mb-3">
          <b>Population Awareness and Information, Education, and Communication Activities (IEC)</b> is a service that focuses on making complex population issues easy for the general public to understand. The goal is to create a "Population-Aware" community that understands how family size and migration affect their quality of life.
          We conduct mobile "rekorida" (public announcements) and community assemblies to discuss topics like the Responsible Parenthood and Reproductive Health Act (RPRH Law) and gender equality.
          Our office leads the local celebration of significant milestones such as <b>World Population Day (July 11)</b> and <b>Family Planning Month (August)</b>, using these events to highlight the success of local families and promote government services.
        </Text>

        <Divider className="mb-3" />

        <Title order={2} className="mb-2">Development and Distribution of IEC Materials</Title>
        <Text align="justify" className="mb-2">
          To ensure that information sticks, our office produces localized and easy-to-digest educational tools. We translate national policies into the local dialect and visual formats that every citizen can understand.
        </Text>
        <Paper radius="md" p="md" className="mb-3">
          <Title order={3}>Printed Resources</Title>
          <Text style={{ padding: "10px", lineHeight: "200%", textAlign: "justify" }}>
            We design and distribute brochures, posters, and flyers covering topics such as modern family planning methods, the dangers of teenage pregnancy, and the roles of men in the family (KATROPA).
          </Text>
          <Title order={3}>Audio-Visual Presentations</Title>
          <Text style={{ padding: "10px", lineHeight: "200%", textAlign: "justify" }}>
            We produce and screen short educational videos in barangay health centers and waiting areas to educate clients while they wait for services.
          </Text>
          <Title order={3}>Visual Aids for Workers</Title>
          <Text style={{ padding: "10px", lineHeight: "200%", textAlign: "justify" }}>
            We provide specialized "Flipcharts" and kits to Barangay Population Workers, enabling them to conduct effective house-to-house counseling and small-group discussions.
          </Text>
        </Paper>
        <Divider className="mb-3" />
        <Title order={2} className="mb-2">Peer Education and Volunteer Mobilization</Title>
        <Text align="justify" className="mb-2">
          Awareness is most effective when it comes from a trusted peer. We train local leaders and youth to become "Advocates" within their own circles.
        </Text>
        <Paper radius="md" p="md">
          <Title order={3}>Peer Facilitator Training</Title>
          <Text style={{ padding: "10px", lineHeight: "200%", textAlign: "justify" }}>
            We identify and train student leaders to become "Peer Educators" who can provide a safe space for their classmates to ask questions about reproductive health.
          </Text>
          <Title order={3}>Barangay Population Volunteer Training</Title>
          <Text style={{ padding: "10px", lineHeight: "200%", textAlign: "justify" }}>
            We provide continuous education to our community volunteers, ensuring they are updated on the latest health protocols and communication techniques for their house-to-house visits.
          </Text>
        </Paper>

      </>
    </ServiceBootstrapLayout>
  );
}
