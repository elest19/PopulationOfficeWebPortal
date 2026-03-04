import React from 'react';
import { Title, Text, Stack, Paper, SimpleGrid, Image } from '@mantine/core';
import { ServiceBootstrapLayout } from './ServiceBootstrapLayout.jsx';
import imgCommunityEventsHome from '../../content/Home Images/CommunityEventsHomePage.jpg';
import RHULogo from '../../content/servicesImage/RHU.jpg';
import YouthLogo from '../../content/servicesImage/Youth.jpg';
import RedCrossLogo from '../../content/servicesImage/RedCross.png';

export function CommunityEvents() {
  return (
    <ServiceBootstrapLayout
      imageUrl={imgCommunityEventsHome}
      imageAlt="Support During Community Events"
    >
      <>
        <Text className="mb-3">
          Participation in LGU caravans and mobile population education activities to 
          bring services to remote barangays. This involves joint outreach activities 
          conducted with agencies such as the Philippine Red Cross, local youth 
          organizations, and the Rural Health Unit (RHU) of San Fabian.
        </Text>

        <Paper withBorder radius="md" p="md" className="mb-4">
          <Title order={3}>Health Caravans and Outreach</Title>
          <Text>
            Health caravans may include basic health consultations, counseling on 
            responsible parenthood and adolescent health, and information drives. 
            While San Fabian is a key partner, collaboration is not limited to the 
            Municipality of San Fabian, Pangasinan and may extend to provincial or 
            national agencies as needed.
          </Text>
        </Paper>

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
      </>
    </ServiceBootstrapLayout>
  );
}
