/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Hr, Link, Section, Text } from 'npm:@react-email/components@0.0.22'
import {
  COMPANY_LEGAL_NAME,
  COMPANY_PRODUCT_NAME,
  COMPANY_POSTAL_LINE1,
  COMPANY_POSTAL_LINE2,
  COMPANY_CONTACT_EMAIL,
  SITE_URL,
} from '../brand.ts'

interface Props {
  unsubscribeUrl?: string
}

export const EmailFooter = ({ unsubscribeUrl }: Props) => (
  <Section>
    <Hr style={hr} />
    <Text style={small}>
      {COMPANY_PRODUCT_NAME} is a product of {COMPANY_LEGAL_NAME}
      <br />
      {COMPANY_POSTAL_LINE1}, {COMPANY_POSTAL_LINE2}
      <br />
      <Link href={`mailto:${COMPANY_CONTACT_EMAIL}`} style={link}>
        {COMPANY_CONTACT_EMAIL}
      </Link>
    </Text>
    <Text style={small}>
      <Link href={`${SITE_URL}/privacy`} style={link}>Privacy</Link>
      {' · '}
      <Link href={`${SITE_URL}/terms`} style={link}>Terms</Link>
      {unsubscribeUrl ? (
        <>
          {' · '}
          <Link href={unsubscribeUrl} style={link}>Unsubscribe</Link>
        </>
      ) : null}
    </Text>
    {unsubscribeUrl ? null : (
      <Text style={tiny}>
        You're receiving this because you have an {COMPANY_PRODUCT_NAME} account.
        Account-related messages cannot be unsubscribed from.
      </Text>
    )}
  </Section>
)

const hr = { borderColor: '#eaeaea', margin: '32px 0 16px' }
const small = { fontSize: '12px', color: '#888888', lineHeight: '1.6', margin: '0 0 8px' }
const tiny = { fontSize: '11px', color: '#aaaaaa', lineHeight: '1.5', margin: '8px 0 0' }
const link = { color: '#666666', textDecoration: 'underline' }

export default EmailFooter
