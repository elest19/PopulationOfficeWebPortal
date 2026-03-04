import React from 'react';
import { Text, Title, Divider, Paper } from '@mantine/core';
import { ServiceBootstrapLayout } from './ServiceBootstrapLayout.jsx';
import imgAdolescentHome from '../../content/Home Images/AdolescentHomePage.jpg';
 
import { YouTubeWithConsent } from '../../components/common/YouTubeWithConsent.jsx';

export function Ahdp() {
  // 1. Define missing variables
  const videoUrl = "https://www.youtube.com/embed/uFBxi76S6dw";

  return (
    <ServiceBootstrapLayout
      imageUrl={imgAdolescentHome}
      imageAlt="Adolescent Health and Development Program"
    >
      <Text align="justify">
        The <b>Adolescent Health and Development Program (AHDP)</b> is the Population Office’s primary response to the complex challenges facing today’s youth. Recognizing that adolescence is a critical period of physical, emotional, and social transition, this program moves beyond traditional healthcare to provide a holistic support system. Our mission is to ensure that every adolescent in our community is well-informed, empowered, and healthy. We focus on reducing the incidence of teenage pregnancy, preventing the spread of STIs and HIV/AIDS, and mitigating risky behaviors such as substance abuse and early sexual involvement. By investing in the youth today, we are securing a more sustainable and productive population for the future.
      </Text>

      {videoUrl ? (
        <>
          <YouTubeWithConsent
            videoUrl={videoUrl}
            title="Adolescent Health and Development Program (AHDP)"
            ratio="16x9"
          />
          <Divider my="md" />
        </>
      ) : null}

      <Title order={2} style={{paddingBottom: "1rem"}}>Key Service Pillars</Title>
      
      <Paper withBorder radius="md" p="md" mb="sm">
        <Title order={3}>Peer Education and Youth Mobilization</Title>
        <Text align="justify">
          One of the most effective ways to reach a teenager is through their friends. Our program heavily emphasizes "Peer-to-Peer" advocacy.
        </Text>
        <Title order={3} style={{marginLeft: "3%", marginTop: "10px"}}>Peer Facilitaton Training</Title>
        <Text style={{marginLeft: "3%", padding: "10px", lineHeight: "1.6", textAlign: "justify"}}>
          We identify and train student leaders and community youth to become certified Peer Educators. They are equipped to facilitate "U4U" and "Teen Trail" workshops—interactive sessions that use games and dialogue to teach reproductive health, self-esteem, and decision-making.
        </Text>
        <Title order={3} style={{marginLeft: "3%"}}>Youth Leadership</Title>
        <Text style={{marginLeft: "3%", padding: "10px", lineHeight: "1.6", textAlign: "justify"}}>
          By empowering young advocates, we ensure that accurate health information is shared naturally within social circles, correcting misconceptions and encouraging positive health-seeking behaviors among their peers.
        </Text>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Title order={3}>Parent and Teen Talk and Family Support</Title>
        <Text align="justify">
          Healthy adolescent development requires a supportive home environment. Many of our activities are designed to bridge the communication gap between generations.
        </Text>
        <Title order={3} style={{marginLeft: "3%", marginTop: "10px"}}>Parenting the Adolescent (PAM)</Title>
        <Text style={{marginLeft: "3%", padding: "10px", lineHeight: "1.6", textAlign: "justify"}}>
          We facilitate workshops that teach parents how to talk to their children about sensitive topics like sexuality and relationships. These sessions aim to move from "lecturing" to "listening," fostering trust and preventing domestic conflicts.
        </Text>
        <Title order={3} style={{marginLeft: "3%"}}>Service Delivery Network (SDN)</Title>
        <Text style={{marginLeft: "3%", padding: "10px", lineHeight: "1.6", textAlign: "justify"}}>
          We maintain a strong referral system that links schools, barangay centers, and hospitals. This ensures that if a teen is in crisis—whether due to pregnancy, abuse, or mental health issues—there is a clear, fast, and supportive path to the professional help they need.
        </Text>
      </Paper>
    </ServiceBootstrapLayout>
  );
}

