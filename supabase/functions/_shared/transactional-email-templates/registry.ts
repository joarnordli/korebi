import * as React from 'npm:react@18.3.1'
import { template as welcomeTemplate } from './welcome.tsx'
import { template as abuseReportTemplate } from './abuse-report.tsx'
import { template as billingChangeTemplate } from './billing-change-notice.tsx'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

// NOTE: All user-facing templates must render <EmailFooter /> (postal address
// is required by CAN-SPAM and other consumer-protection laws).
export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome: welcomeTemplate,
  'abuse-report': abuseReportTemplate,
  'billing-change-notice': billingChangeTemplate,
}

