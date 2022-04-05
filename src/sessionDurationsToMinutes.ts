function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

export const sessionDurationsToMinutes = ({
  session_lifetime,
  idle_session_lifetime,
}: {
  session_lifetime?: number;
  idle_session_lifetime?: number;
}): { session_lifetime_in_minutes?: number; idle_session_lifetime_in_minutes?: number } => {
  const sessionDurations: {
    session_lifetime_in_minutes?: number;
    idle_session_lifetime_in_minutes?: number;
  } = {};

  if (!!session_lifetime)
    sessionDurations.session_lifetime_in_minutes = hoursToMinutes(session_lifetime);
  if (!!idle_session_lifetime)
    sessionDurations.idle_session_lifetime_in_minutes = hoursToMinutes(idle_session_lifetime);

  return sessionDurations;
};
