/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailFooter } from './footer.tsx'

interface Props {
  name?: string
  unsubscribeUrl?: string
}

const WelcomeEmail = ({ name, unsubscribeUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Okiro</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Welcome to Okiro</Heading>
        <Text style={text}>{name ? `Hi ${name},` : 'Hi there,'}</Text>
        <Text style={text}>
          Thanks for joining Okiro — your daily place for the little moments
          that matter. Capture one photo a day and watch your year unfold.
        </Text>
        <Text style={text}>— The Okiro team</Text>
        <EmailFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to Okiro',
  displayName: 'Welcome',
  previewData: { name: 'Jane', unsubscribeUrl: 'https://okiro.online/unsubscribe?token=preview' },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Georgia, "Times New Roman", serif',
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const heading = { color: '#1a1a1a', fontSize: '24px', margin: '0 0 16px' }
const text = { color: '#3a3a3a', fontSize: '15px', lineHeight: '24px' }
