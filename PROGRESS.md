# Project Progress

This document summarizes the implementation currently present in the repository. It is a code snapshot, not a deployment or production-readiness certification.

## Implemented

- React, TypeScript, and Vite application with a development server and production build configuration.
- Google sign-in backed by Firebase Authentication.
- Firestore-backed employee ID card records, user authorization, and role-aware Superuser, CCC-scoped Admin, and Editor access.
- Employee ID card creation and editing, including employee details, photo upload and editing, and configurable card fields.
- Employee directory with search, card printing, and individual PNG, JPG, and PDF downloads.
- Compact employee directory cards arranged in responsive grids up to four columns on desktop.
- Selecting an agency name in the dashboard or employee directory filters the directory to that agency's employees.
- Multi-select employee records and print ID cards at standard size on A4 portrait sheets, up to 10 cards per sheet.
- Interactive dashboard cards for employee, agency, and current-month issue-date records; agency selection drills down to its employees.
- Superuser management of Admin and Editor profiles, including CCC assignment and Admin profile details.
- Superuser authorization derives from a protected Firestore profile flag (UID-keyed or normalized-email-keyed) rather than a hardcoded email identity.
- Verified, database-flagged Superusers have app-wide Firestore read/write access; client-side changes to the protected Superuser flag are denied.
- Superuser-managed CCC option list; user assignments select from saved options.
- CCC-scoped Admin access and same-CCC Editor authorization, enforced in Firestore rules.
- Admin-maintained agency lists scoped to each CCC; Editors must be assigned one listed agency.
- Admins and Superusers can create/update agency company profiles with optional address, phone, email, enlistment number, and vendor code; only agency name is required.
- Agency profile names feed employee agency dropdowns and the existing Editor assignment list; profiles cannot be deleted while records or Editor accounts use the name.
- Editor employee reads, creates, edits, deletes, and Excel imports are limited to the assigned agency and CCC.
- Desktop second-row navigation and a mobile left-side navigation panel.
- Employee create/edit, user create/edit, agency management, and settings forms open in modal dialogs; navigation includes User Creation.
- Legacy employee lookup by exact CCC-name match, with CCC ID backfill when edited.
- User and office settings, including global defaults and personal settings.
- Excel `.xlsx` import using a downloadable template; imports append new employee records.
- Progressive Web App configuration and an install prompt for supported browsers.
- Express server with a health endpoint and production static-file serving.

## Follow-up work

- The directory's **Filter** and **Export** controls are displayed but are not wired to actions yet.
- Deploy the updated Firestore rules before using CCC-scoped roles. Provision the trusted Superuser's `isSuperuser: true` flag on their UID-keyed user document through the Firebase Admin SDK or trusted database administration. Existing authorized users stored under random document IDs must be edited by the Superuser once to migrate their profiles to their canonical email-based document IDs.
- Verify the Firebase project configuration and authentication settings for the intended deployment.
- Test the key sign-in, authorization, CCC-isolation, profile-management, card-management, and download flows in the target environment.

## Current validation

Validation commands are defined in `package.json`:

- `npm run lint` runs the TypeScript compiler without emitting files.
- `npm run build` creates a production Vite build.

TypeScript validation and the production build pass after the agency profile workflow changes. The build reports the existing large JavaScript chunk advisory and an outdated Browserslist database. Firebase rules deployment and emulator validation, plus end-to-end sign-in, CCC-isolation, agency profile, settings, import, and Admin dashboard flows, still need verification in the target environment.
