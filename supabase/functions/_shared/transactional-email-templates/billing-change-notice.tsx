/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailFooter } from './footer.tsx'
import { SITE_URL } from '../brand.ts'

interface Props {
  name?: string
  unsubscribeUrl?: string
}

const BillingChangeEmail = ({ name, unsubscribeUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>An update to your Okiro billing</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>An update to your Okiro billing</Heading>
        <Text style={text}>{name ? `Hi ${name},` : 'Hi there,'}</Text>
        <Text style={text}>
          We're writing to let you know that Okiro's standard price is now{' '}
          <strong>28 NOK per month</strong> (previously 7 NOK per week). The
          monthly cadence is simpler, easier to budget for, and matches how
          most of our subscribers prefer to be billed.
        </Text>
        <Text style={text}>
          <strong>If you're currently on the weekly plan</strong>, we've moved
          you to monthly. Your next renewal date stays the same — on that date
          you'll be charged 28 NOK instead of 7 NOK, with a small proration
          adjustment for any unused time. After that, you'll be billed once
          a month.
        </Text>
        <Text style={text}>
          <strong>If you're already on the monthly plan or still in your
          free trial</strong>, nothing changes for you.
        </Text>
        <Text style={text}>
          You can review or cancel your subscription anytime from your{' '}
          <Link href={`${SITE_URL}/profile`} style={link}>profile page</Link>.
        </Text>
        <Text style={text}>— The Okiro team</Text>
        <EmailFooter unsubscribeUrl={unsubscribeUrl} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BillingChangeEmail,
  subject: 'An update to your Okiro billing',
  displayName: 'Billing change notice',
  previewData: {
    name: 'Jane',
    unsubscribeUrl: 'https://okiro.online/unsubscribe?token=preview',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Georgia, "Times New Roman", serif',
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const heading = { color: '#1a1a1a', fontSize: '24px', margin: '0 0 16px' }
const text = { color: '#3a3a3a', fontSize: '15px', lineHeight: '24px' }
const link = { color: '#3a3a3a', textDecoration: 'underline' }
