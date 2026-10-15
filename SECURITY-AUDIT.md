# Security Audit Report

**Date:** 2026-10-15  
**Repository:** `kpaul466/icard`  
**Result:** No substantiated vulnerabilities found in the reviewed scope.

## Scope

This was a focused review of security-relevant application code and configuration, including modified and untracked files. It was not a line-by-line audit of every repository file, dependency, or generated build artifact.

Reviewed surfaces:

- Firestore authorization logic: `firestore.rules` (lines 1–305).
- Authentication, profile lookup, employee queries, settings, and user/agency management: `src/App.tsx` (including lines 134–333, 954–1039, and 1187–1425).
- Employee creation, editing, and photo handling: `src/components/EmployeeForm.tsx`.
- Excel import: `src/components/EmployeeImport.tsx`.
- Employee listing, CSV export, printing, and deletion: `src/components/EmployeeList.tsx` (including CSV export at lines 121–152 and deletion at line 429).
- Agency and card-setting management: `src/components/AgencyManagement.tsx`, `src/components/CardDesignSettings.tsx`, `src/components/CardSettingsEditor.tsx`, and `src/lib/cardSettings.ts`.
- Firebase and application configuration: `src/firebase.ts`, `vite.config.ts`, `server.ts`, `firebase.json`, `.firebaserc`, and `package.json`.

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| — | — | — | — | No substantiated vulnerabilities found in the reviewed scope. | — |

In the reviewed code, Firestore rules constrain employee access by CCC and additionally by assigned agency for Editors. The client-side import path is subject to those server-side Firestore rules. Employee exports operate on records already read through the authorized application path. The Firebase client configuration is public application configuration, not a service credential.

## Limitations and deployment caveats

- The deployed Firestore rules were not independently compared with the local `firestore.rules`; therefore this report does not verify the live Firebase project's deployed authorization policy.
- Firebase Authentication provider configuration and allowed domains were not inspected in the Firebase console.
- Firebase Storage upload paths and Storage rules were not reviewed. The employee-photo handling observed in the reviewed code stores photo data in Firestore documents.
- This is a focused application security review, not a full dependency audit, penetration test, or exhaustive review of every repository file.
