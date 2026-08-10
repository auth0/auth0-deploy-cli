/* eslint-disable camelcase */
function hoursToMinutes(hours: number): number {
  return parseFloat(Math.round(hours * 60).toFixed(4));
}

type SessionDurations = {
  session_lifetime_in_minutes?: number;
  idle_session_lifetime_in_minutes?: number;
  ephemeral_session_lifetime_in_minutes?: number;
  idle_ephemeral_session_lifetime_in_minutes?: number;
};

export function sessionDurationsToMinutes({
  session_lifetime,
  idle_session_lifetime,
  ephemeral_session_lifetime,
  idle_ephemeral_session_lifetime,
}: {
  session_lifetime?: number;
  idle_session_lifetime?: number;
  ephemeral_session_lifetime?: number;
  idle_ephemeral_session_lifetime?: number;
} = {}): SessionDurations {
  const sessionDurations: SessionDurations = {};

  if (session_lifetime !== undefined)
    sessionDurations.session_lifetime_in_minutes = hoursToMinutes(session_lifetime);
  if (idle_session_lifetime !== undefined)
    sessionDurations.idle_session_lifetime_in_minutes = hoursToMinutes(idle_session_lifetime);
  if (ephemeral_session_lifetime !== undefined)
    sessionDurations.ephemeral_session_lifetime_in_minutes = hoursToMinutes(
      ephemeral_session_lifetime
    );
  if (idle_ephemeral_session_lifetime !== undefined)
    sessionDurations.idle_ephemeral_session_lifetime_in_minutes = hoursToMinutes(
      idle_ephemeral_session_lifetime
    );

  return sessionDurations;
}

export default sessionDurationsToMinutes;
