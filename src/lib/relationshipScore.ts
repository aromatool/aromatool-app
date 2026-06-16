export type ContactStatus =
  | 'prospect'
  | 'in_followup'
  | 'inactiv'
  | 'client_nou'
  | 'client_fidel'
  | 'team_member'

export interface ScoreInput {
  status: ContactStatus
  createdAt: string        // ISO date
  offersCount: number
  totalEur: number
  followupActive: boolean
  lastActivityAt: string | null // ISO date, null = no activity
}

export interface ScoreBreakdown {
  total: number
  items: { label: string; points: number }[]
}

function daysSince(isoDate: string | null): number {
  if (!isoDate) return 999
  const then = new Date(isoDate)
  const now = new Date()
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

export function computeRelationshipScore(input: ScoreInput): ScoreBreakdown {
  const items: { label: string; points: number }[] = []

  // Status
  const statusPoints: Record<ContactStatus, number> = {
    prospect: 5,
    in_followup: 8,
    inactiv: 0,
    client_nou: 10,
    client_fidel: 20,
    team_member: 25,
  }
  const statusLabels: Record<ContactStatus, string> = {
    prospect: 'Prospect',
    in_followup: 'În follow-up',
    inactiv: 'Inactiv',
    client_nou: 'Client nou',
    client_fidel: 'Client fidel',
    team_member: 'Membru echipă',
  }
  items.push({ label: statusLabels[input.status], points: statusPoints[input.status] })

  // Vechime CRM
  const ageDays = daysSince(input.createdAt)
  if (ageDays >= 180) items.push({ label: 'În CRM 180+ zile', points: 15 })
  else if (ageDays >= 90) items.push({ label: 'În CRM 90+ zile', points: 10 })
  else if (ageDays >= 30) items.push({ label: 'În CRM 30+ zile', points: 5 })

  // Oferte
  if (input.offersCount >= 5) items.push({ label: '5+ oferte trimise', points: 15 })
  else if (input.offersCount >= 3) items.push({ label: '3+ oferte trimise', points: 10 })
  else if (input.offersCount >= 1) items.push({ label: '1+ oferte trimise', points: 5 })

  // Valoare totală oferte
  if (input.totalEur >= 1000) items.push({ label: 'Valoare 1000€+', points: 15 })
  else if (input.totalEur >= 500) items.push({ label: 'Valoare 500€+', points: 10 })
  else if (input.totalEur >= 200) items.push({ label: 'Valoare 200€+', points: 5 })

  // Follow-up activ
  if (input.followupActive) items.push({ label: 'Follow-up activ', points: 5 })

  // Activitate recentă
  const lastDays = daysSince(input.lastActivityAt)
  if (lastDays <= 30) items.push({ label: 'Activitate recentă', points: 10 })
  else if (lastDays > 90) items.push({ label: 'Inactiv 90+ zile', points: -20 })
  else if (lastDays > 60) items.push({ label: 'Inactiv 60+ zile', points: -10 })

  const total = Math.max(0, Math.min(100, items.reduce((s, i) => s + i.points, 0)))
  return { total, items }
}

export function scoreColor(score: number): string {
  if (score >= 60) return '#2E8A58'  // grn
  if (score >= 30) return '#C4906A'  // amber
  return '#C94F6A'                    // red
}

export function scoreLabel(score: number): string {
  if (score >= 70) return 'Excelent'
  if (score >= 50) return 'Bun'
  if (score >= 30) return 'Mediu'
  return 'Slab'
}