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
import { COMPANY_ABUSE_EMAIL } from '../brand.ts'

interface Props {
  reporterUserId: string
  reporterEmail?: string
  memoryId?: string
  category: string
  message?: string
  reportId: string
  createdAt: string
}

const AbuseReportEmail = (p: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New abuse / content report</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New report received</Heading>
        <Text style={text}><strong>Report ID:</strong> {p.reportId}</Text>
        <Text style={text}><strong>Category:</strong> {p.category}</Text>
        <Text style={text}><strong>Reporter user ID:</strong> {p.reporterUserId}</Text>
        {p.reporterEmail ? <Text style={text}><strong>Reporter email:</strong> {p.reporterEmail}</Text> : null}
        {p.memoryId ? <Text style={text}><strong>Memory ID:</strong> {p.memoryId}</Text> : null}
        <Text style={text}><strong>Submitted:</strong> {p.createdAt}</Text>
        {p.message ? (
          <>
            <Text style={text}><strong>Message:</strong></Text>
            <Text style={quote}>{p.message}</Text>
          </>
        ) : null}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AbuseReportEmail,
  subject: 'New report received',
  displayName: 'Abuse report (internal)',
  to: COMPANY_ABUSE_EMAIL,
  previewData: {
    reporterUserId: '00000000-0000-0000-0000-000000000000',
    reporterEmail: 'user@example.com',
    memoryId: '11111111-1111-1111-1111-111111111111',
    category: 'dmca',
    message: 'Sample message body.',
    reportId: '22222222-2222-2222-2222-222222222222',
    createdAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = { fontSize: '20px', margin: '0 0 16px', color: '#1a1a1a' }
const text = { fontSize: '14px', color: '#333333', margin: '0 0 8px', lineHeight: '1.5' }
const quote = {
  fontSize: '14px', color: '#333333', lineHeight: '1.6',
  padding: '12px 14px', borderLeft: '3px solid #ddd', background: '#fafafa', margin: '4px 0 16px',
  whiteSpace: 'pre-wrap' as const,
}
