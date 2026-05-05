/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as genericHtml } from './generic-html.tsx'
import { template as taskAssigned } from './task-assigned.tsx'
import { template as programmeWeeklyDigest } from './programme-weekly-digest.tsx'
import { template as documentApproval } from './document-approval.tsx'
import { template as organizationInvite } from './organization-invite.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'generic-html': genericHtml,
  'task-assigned': taskAssigned,
  'programme-weekly-digest': programmeWeeklyDigest,
  'document-approval': documentApproval,
  'organization-invite': organizationInvite,
}
