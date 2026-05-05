import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { Shell, styles, BRAND } from '../email-templates/_brand.tsx'

interface TaskAssignedProps {
  recipientName?: string
  taskTitle?: string
  taskDescription?: string
  assignedBy?: string
  dueDate?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  programmeName?: string
  projectName?: string
  taskUrl?: string
}

const priorityColor = (p?: string) => {
  switch (p) {
    case 'critical': return '#b91c1c'
    case 'high': return '#c2410c'
    case 'medium': return '#a16207'
    default: return BRAND.muted
  }
}

const TaskAssignedEmail = ({
  recipientName,
  taskTitle = 'New task',
  taskDescription,
  assignedBy,
  dueDate,
  priority,
  programmeName,
  projectName,
  taskUrl,
}: TaskAssignedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{assignedBy ? `${assignedBy} assigned you a task: ${taskTitle}` : `New task assigned: ${taskTitle}`}</Preview>
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>
          {recipientName ? `Hi ${recipientName}, you have a new task` : 'You have a new task'}
        </Heading>
        <Text style={styles.text}>
          {assignedBy ? <><strong>{assignedBy}</strong> assigned you the following task</> : 'A new task has been assigned to you'}
          {programmeName || projectName
            ? <> in {projectName ? <strong>{projectName}</strong> : <strong>{programmeName}</strong>}.</>
            : '.'}
        </Text>
        <Section style={styles.callout}>
          <Text style={{ ...styles.text, margin: '0 0 6px', color: BRAND.navy, fontWeight: 600 }}>
            {taskTitle}
          </Text>
          {taskDescription ? (
            <Text style={{ ...styles.text, margin: '0 0 8px' }}>{taskDescription}</Text>
          ) : null}
          {priority ? (
            <Text style={{ ...styles.smallNote, margin: '0 0 4px', color: priorityColor(priority) }}>
              Priority: <strong>{priority.toUpperCase()}</strong>
            </Text>
          ) : null}
          {dueDate ? (
            <Text style={{ ...styles.smallNote, margin: 0 }}>Due: <strong>{dueDate}</strong></Text>
          ) : null}
        </Section>
        {taskUrl ? (
          <Button style={styles.button} href={taskUrl}>Open task</Button>
        ) : null}
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: TaskAssignedEmail,
  subject: (d: Record<string, any>) =>
    d?.taskTitle ? `New task: ${d.taskTitle}` : 'You have a new task',
  displayName: 'Task assigned',
  previewData: {
    recipientName: 'Alex',
    taskTitle: 'Review PRINCE2 Stage 2 plan',
    taskDescription: 'Please review and approve the Stage 2 plan before the Stage Boundary meeting.',
    assignedBy: 'Jordan Lee',
    dueDate: 'May 12, 2026',
    priority: 'high',
    programmeName: 'Digital Transformation Programme',
    projectName: 'Customer Portal Rebuild',
    taskUrl: 'https://thetaskmaster.lovable.app',
  },
} satisfies TemplateEntry
