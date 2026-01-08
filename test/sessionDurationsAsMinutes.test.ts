import { expect } from 'chai';
import { sessionDurationsToMinutes } from '../src/sessionDurationsToMinutes';

describe('#sessionDurationsToMinutes', () => {
  it('should not convert session durations to minutes if initial durations not defined', () => {
    const sessionDurations = sessionDurationsToMinutes({});

    expect(sessionDurations.idle_session_lifetime_in_minutes).to.be.undefined;
    expect(sessionDurations.session_lifetime_in_minutes).to.be.undefined;
    expect(sessionDurations.idle_ephemeral_session_lifetime_in_minutes).to.be.undefined;
    expect(sessionDurations.ephemeral_session_lifetime_in_minutes).to.be.undefined;
  });

  it('should convert all session durations to minutes when all are defined', () => {
    const sessionDurations = sessionDurationsToMinutes({
      session_lifetime: 1,
      idle_session_lifetime: 2,
      ephemeral_session_lifetime: 1.5,
      idle_ephemeral_session_lifetime: 0.5,
    });

    expect(sessionDurations.session_lifetime_in_minutes).to.equal(60);
    expect(sessionDurations.idle_session_lifetime_in_minutes).to.equal(120);
    expect(sessionDurations.ephemeral_session_lifetime_in_minutes).to.equal(90);
    expect(sessionDurations.idle_ephemeral_session_lifetime_in_minutes).to.equal(30);
  });

  it('should convert session durations to minutes when durations are partially defined', () => {
    const sessionDurations1 = sessionDurationsToMinutes({
      session_lifetime: undefined,
      idle_session_lifetime: 1,
    });

    expect(sessionDurations1.idle_session_lifetime_in_minutes).to.equal(60);
    expect(sessionDurations1.session_lifetime_in_minutes).to.be.undefined;
    expect(sessionDurations1.ephemeral_session_lifetime_in_minutes).to.be.undefined;

    const sessionDurations2 = sessionDurationsToMinutes({
      session_lifetime: 1,
      idle_session_lifetime: undefined,
    });

    expect(sessionDurations2.idle_session_lifetime_in_minutes).to.be.undefined;
    expect(sessionDurations2.session_lifetime_in_minutes).to.equal(60);

    const sessionDurations3 = sessionDurationsToMinutes({
      ephemeral_session_lifetime: 1,
    });

    expect(sessionDurations3.ephemeral_session_lifetime_in_minutes).to.equal(60);
    expect(sessionDurations3.idle_ephemeral_session_lifetime_in_minutes).to.be.undefined;
    expect(sessionDurations3.session_lifetime_in_minutes).to.be.undefined;
  });
});
