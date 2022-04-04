import { expect } from 'chai';

import {
  sessionDurationsToMinutes
} from '../src/sessionDurationsToMinutes';

describe('#sessionDurationsToMinutes', () => {
  it('should not convert session durations to minutes if initial durations not defined', () => {
    const sessionDurations = sessionDurationsToMinutes({})

    expect(sessionDurations.idle_session_lifetime_in_minutes).to.be.undefined;
    expect(sessionDurations.session_lifetime_in_minutes).to.be.undefined;
  });

  it('should convert session durations to minutes durations are defined', () => {
    const sessionDurations = sessionDurationsToMinutes({ session_lifetime: 1, idle_session_lifetime: 1 })

    expect(sessionDurations.idle_session_lifetime_in_minutes).to.equal(60);
    expect(sessionDurations.session_lifetime_in_minutes).to.equal(60);
  });

  it('should convert session durations to minutes durations are partially defined', () => {
    const sessionDurations1 = sessionDurationsToMinutes({ session_lifetime: undefined, idle_session_lifetime: 1 })

    expect(sessionDurations1.idle_session_lifetime_in_minutes).to.equal(60);
    expect(sessionDurations1.session_lifetime_in_minutes).to.be.undefined;

    const sessionDurations2 = sessionDurationsToMinutes({ session_lifetime: 1, idle_session_lifetime: undefined })

    expect(sessionDurations2.idle_session_lifetime_in_minutes).to.be.undefined;
    expect(sessionDurations2.session_lifetime_in_minutes).to.equal(60);
  });
});
