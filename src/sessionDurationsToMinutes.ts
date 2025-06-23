/* eslint-disable camelcase */
function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

type SessionDurations = {
  session_lifetime_in_minutes?: number;
  idle_session_lifetime_in_minutes?: number;
};

const sessionDurationsToMinutes = (
  session_lifetime: number | undefined,
  idle_session_lifetime: number | undefined
): SessionDurations => {
  const sessionDurations: SessionDurations = {};

  if (session_lifetime)
    sessionDurations.session_lifetime_in_minutes = hoursToMinutes(session_lifetime);
  if (idle_session_lifetime)
    sessionDurations.idle_session_lifetime_in_minutes = hoursToMinutes(idle_session_lifetime);

  return sessionDurations;
};

export default sessionDurationsToMinutes;
