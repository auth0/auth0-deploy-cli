# Auth0 Security Audit — `tenant.yaml`

**12 issue(s) found:** 0 critical · 11 high · 1 medium

| # | Severity | Resource | Name |
|---|----------|----------|------|
| 1 | 🟠 HIGH | `clients` | API Explorer Application |
| 2 | 🟠 HIGH | `clients` | Default App |
| 3 | 🟠 HIGH | `clients` | My Flask App |
| 4 | 🟠 HIGH | `clients` | My Flask App |
| 5 | 🟠 HIGH | `riskAssessment` | riskAssessment |
| 6 | 🟠 HIGH | `guardianPolicies` | guardianPolicies |
| 7 | 🟠 HIGH | `tenant` | tenant.flags |
| 8 | 🟠 HIGH | `clients` | Default App |
| 9 | 🟠 HIGH | `clients` | My Flask App |
| 10 | 🟠 HIGH | `clients` | My Flask App |
| 11 | 🟠 HIGH | `attackProtection` | breachedPasswordDetection |
| 12 | 🟡 MEDIUM | `logStreams` | logStreams |

---

## 1. 🟠 HIGH — API Explorer Application

**Resource:** `clients`

**Issue:** Refresh tokens are non-expiring and non-rotating. A stolen refresh token grants permanent access with no way to detect or invalidate it.

**Fix:** Set refresh_token.expiration_type to 'expiring' and refresh_token.rotation_type to 'rotating'. Set refresh_token.token_lifetime and refresh_token.idle_token_lifetime to appropriate values (e.g. 2592000 / 1296000).

---

## 2. 🟠 HIGH — Default App

**Resource:** `clients`

**Issue:** Refresh tokens are non-expiring and non-rotating. A stolen refresh token grants permanent access with no way to detect or invalidate it.

**Fix:** Set refresh_token.expiration_type to 'expiring' and refresh_token.rotation_type to 'rotating'. Set refresh_token.token_lifetime and refresh_token.idle_token_lifetime to appropriate values (e.g. 2592000 / 1296000).

---

## 3. 🟠 HIGH — My Flask App

**Resource:** `clients`

**Issue:** Refresh tokens are non-expiring and non-rotating. A stolen refresh token grants permanent access with no way to detect or invalidate it.

**Fix:** Set refresh_token.expiration_type to 'expiring' and refresh_token.rotation_type to 'rotating'. Set refresh_token.token_lifetime and refresh_token.idle_token_lifetime to appropriate values (e.g. 2592000 / 1296000).

---

## 4. 🟠 HIGH — My Flask App

**Resource:** `clients`

**Issue:** Refresh tokens are non-expiring and non-rotating. A stolen refresh token grants permanent access with no way to detect or invalidate it.

**Fix:** Set refresh_token.expiration_type to 'expiring' and refresh_token.rotation_type to 'rotating'. Set refresh_token.token_lifetime and refresh_token.idle_token_lifetime to appropriate values (e.g. 2592000 / 1296000).

---

## 5. 🟠 HIGH — riskAssessment

**Resource:** `riskAssessment`

**Issue:** Risk assessment is disabled. Auth0 cannot detect impossible travel, new device logins, or velocity anomalies. In the 0ktapus campaign (2022), attackers compromised 130+ companies by replaying stolen OTP codes in real time — risk assessment would have re-challenged every one of those stolen sessions.

**Fix:** Set riskAssessment.settings.enabled to true.

---

## 6. 🟠 HIGH — guardianPolicies

**Resource:** `guardianPolicies`

**Issue:** Guardian MFA policy is set to 'none' rather than 'all-applications'. Individual applications can opt out of MFA. Scattered Spider used this exact gap in the MGM Resorts breach (Sep 2023, ~$100M loss) — they targeted organisations where a single unprotected app bypassed tenant-wide MFA.

**Fix:** Set guardianPolicies.policies to ['all-applications'] to enforce MFA across every application with no exceptions.

---

## 7. 🟠 HIGH — tenant.flags

**Resource:** `tenant`

**Issue:** The Resource Owner Password Credential (ROPC) grant is enabled. ROPC sends the user's password directly to the application, bypassing Auth0's Universal Login and MFA entirely. It is deprecated in OAuth 2.1 and is the mechanism used in large-scale credential-stuffing attacks via phishing proxies.

**Fix:** Set tenant.flags.allow_legacy_ro_grant_types to false. Migrate clients using ROPC to the authorization_code flow with PKCE.

---

## 8. 🟠 HIGH — Default App

**Resource:** `clients`

**Issue:** Client 'Default App' has the implicit grant type enabled. Implicit flow delivers access tokens in URL fragments, which leak via Referer headers and browser history. It is removed in OAuth 2.1 (IETF BCP 212).

**Fix:** Remove 'implicit' from grant_types. Use authorization_code with PKCE instead.

---

## 9. 🟠 HIGH — My Flask App

**Resource:** `clients`

**Issue:** Client 'My Flask App' has the implicit grant type enabled. Implicit flow delivers access tokens in URL fragments, which leak via Referer headers and browser history. It is removed in OAuth 2.1 (IETF BCP 212).

**Fix:** Remove 'implicit' from grant_types. Use authorization_code with PKCE instead.

---

## 10. 🟠 HIGH — My Flask App

**Resource:** `clients`

**Issue:** Client 'My Flask App' has the implicit grant type enabled. Implicit flow delivers access tokens in URL fragments, which leak via Referer headers and browser history. It is removed in OAuth 2.1 (IETF BCP 212).

**Fix:** Remove 'implicit' from grant_types. Use authorization_code with PKCE instead.

---

## 11. 🟠 HIGH — breachedPasswordDetection

**Resource:** `attackProtection`

**Issue:** Breached password detection is disabled. Auth0 will not check credentials against known breach databases (HaveIBeenPwned). Credentials leaked in past breaches — RockYou2021 (8.4B records), LinkedIn 2016, and hundreds of others — will work silently with no block and no alert.

**Fix:** Set attackProtection.breachedPasswordDetection.enabled to true. Add shields: [block, admin_notification] to block and alert on compromised credential use.

---

## 12. 🟡 MEDIUM — logStreams

**Resource:** `logStreams`

**Issue:** No log streams are configured. Auth0 events are not being forwarded to a SIEM (Splunk, Datadog, Sumo Logic, etc.). In the Okta Support System breach (Oct 2023), attackers accessed customer tenant data for weeks undetected — customers with no log streaming had zero real-time visibility.

**Fix:** Configure at least one log stream under attackProtection > logStreams to forward events to your SIEM or logging platform.

---
