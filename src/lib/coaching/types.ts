/**
 * Moved here from lib/dashboard/types.ts: this is coaching-domain data
 * (a coach's client roster and its stats), and /coaching is now the real
 * home for it — /dashboard's CoachingDashboardSection just imports and
 * reuses the same getCoachingDashboard query rather than a second copy.
 */
export interface CoachingClientSummary {
  id: string;
  clientId: string;
  email: string;
  lastActivityOn: string | null;
  /** No logged session in 14+ days (or ever). */
  needsAttention: boolean;
  /** This client's globally-active program, but only if this coach is the
   * one who owns it — RLS means a coach can't see the name of a program
   * they didn't assign (self-programmed, or assigned by another coach),
   * so this is null in those cases rather than a guess. */
  activeProgramName: string | null;
}

export interface CoachingDashboardData {
  activeClientCount: number;
  pendingInviteCount: number;
  clients: CoachingClientSummary[];
  recentActivity: { clientEmail: string; performedOn: string }[];
}
