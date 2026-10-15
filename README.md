# iCard Generation Portal - User Manual

Welcome to the iCard Generation Portal! This application is designed to streamline the creation, management, and distribution of ID cards for agency staff and employees.

For the current implementation status and follow-up work, see [Project Progress](./PROGRESS.md).

## 🌟 Key Features

*   **Easy ID Card Creation:** Fill out a simple form, upload a photo, and instantly generate a professional ID card.
*   **Record-only UID Number:** Store an employee UID number in the employee record and Excel/CSV exports; it is not displayed or printed on the ID card.
*   **Export Options:** Download the generated ID cards as high-quality Images (PNG) or PDF documents for printing.
*   **Batch Printing:** Select multiple employee cards and print them at card size on A4 portrait sheets (up to 10 cards per sheet).
*   **CCC-Scoped Access Control:** Superusers manage Admins and assign CCCs; each Admin can access only their CCC.
*   **Admin Profiles:** Superusers manage Admin display names, phone numbers, and CCC assignments.
*   **Mobile Navigation:** Desktop navigation sits in a second header row; mobile navigation opens in a side panel.
*   **Agency-Scoped Editors:** CCC Admins maintain their agency list and assign each Editor to one agency.
*   **Agency Profiles:** Admins and Superusers can create, edit, and remove agency/company profiles with address, phone, email, enlistment number, and vendor code; only the agency name is required.
*   **ID Card Design:** Admins and Superusers can set CCC-wide defaults or per-user card layouts, including a live preview of header lines, font sizes, colors, and the default issue number.
*   **Popup Forms:** Employee, user, agency, and settings forms open in dialogs; Admins have a dedicated User Creation menu entry.
*   **Customizable Settings:** Set default issuing authorities, office contact details, and emergency tags.
*   **Excel Import:** Import multiple employee records from the provided `.xlsx` template.
*   **Mobile Ready (PWA):** Install the app directly to your phone's home screen for quick access.
*   **Offline Data Cache:** Firestore caches previously loaded records in browser storage and synchronizes changes when online. Live listeners continue to receive database updates.

---

## 👥 User Roles & Permissions

The portal uses Google Sign-In and has three levels of access:

### 1. Superuser
*   Superuser privileges are controlled by the protected `isSuperuser` flag on the user's Firestore profile, not by a hardcoded email address.
*   Can create and manage Admins, assign each Admin to a CCC, and maintain their display name and phone number.
*   Can view and manage employee records across CCCs and update global defaults.
*   Can delete employee records; Admins and Editors can only add or edit employee records.
*   Maintains the CCC options list in Settings; Admin assignments can only use saved CCC options.

### 2. Admin
*   Can view, add, and edit employee records assigned to their CCC only; cannot delete records.
*   Maintains the agency list for their CCC and must assign each Editor to an agency from that list.
*   Can authorize and manage Editors for that CCC, but cannot create or manage other Admins.
*   Can set the CCC card design and default issue number, and customize individual users' card designs.
*   Can update their office details; their assigned CCC is controlled by the Superuser.

### 3. Editor
*   Must be assigned to an agency by their CCC Admin.
*   Can view, create, edit, and import employee records only for their assigned agency within their assigned CCC; cannot delete records.
*   Editors cannot change the issue number; employee cards they create or import use the issue number configured by the Admin for their CCC.
*   Can customize personal office settings.

Firestore rules enforce these role, CCC, and Editor agency boundaries. A verified, database-flagged Superuser has read/write access across application documents; client requests still cannot create, change, or delete the protected `isSuperuser` flag. Admin-managed agency options are stored per CCC in Firestore. To bootstrap a Superuser, a trusted backend using the Firebase Admin SDK (or a trusted database administrator) sets either `users/{Firebase Auth UID}` or `users/{lowercase email}` with the verified account's lowercase `email`, `role: "admin"`, and `isSuperuser: true`. The profile email must match the verified sign-in email. Deploy the current Firestore rules after changing Superuser profile setup.

Firestore web persistence stores cached application data in the browser's IndexedDB so previously loaded data can be shown offline and synchronized with server changes. This data is not encrypted by the app; use this feature only on trusted devices and browser profiles, especially when viewing employee records.

Deploy Firestore rules to the configured Firebase project with `npx firebase-tools deploy --only firestore:rules --project icard-8ec36` after authenticating with `npx firebase-tools login`.

Legacy employee records without a `cccId` remain visible to a scoped Admin only when their existing `cccName` exactly matches that Admin's assigned CCC. Editing such a record adds the CCC identifier for future queries.

Admins and Superusers configure card layouts and default issue numbers from **Card Design**. CCC defaults are stored in `cccCardSettings/{cccId}`; per-user overrides are stored on the authorized user's profile and take precedence for layout only. The issue number always comes from that employee's CCC settings, so Editors cannot change the CCC-specific number or prefix. New employee cards retain a snapshot of the active card layout, and Firestore rules enforce the CCC-configured issue number for Editor-created records.

---

## 📱 How to Install on Mobile (PWA)

You can install this portal as an app on your smartphone (iOS or Android) for easy access.

**Important Login Instruction for Mobile:**
Because of how mobile operating systems handle secure popups, please follow these exact steps to install the app:

1.  Open the app's link in your mobile browser (Safari on iPhone, Chrome on Android).
2.  **Log in to the app FIRST** while still in the browser.
3.  Once successfully logged in, tap your browser's menu button (Share icon on iOS, three dots on Android).
4.  Select **"Add to Home Screen"** or **"Install App"**.
5.  You can now launch the app directly from your home screen, and you will remain logged in!

---

## 🛠️ Step-by-Step Usage Guide

### 1. Logging In
When you first open the app, click **"Sign in with Google"**. A Superuser or the Admin for your CCC must authorize your email before you can access the dashboard.

### 2. Creating an ID Card
1.  Navigate to the **"Create Card"** (or "Add") tab.
2.  Upload a passport-sized photo (Max 500KB, 3:4 ratio recommended).
3.  Fill in the employee's details (Name, Blood Group, Address, Designation, etc.).
4.  Review the "Card Header & Purpose" section at the bottom. These fields are pre-filled from your settings but can be changed for individual cards.
5.  Click **"Generate ID Card"**.

### 3. Viewing and Managing Cards
1.  Navigate to the **"Directory"** (or "List") tab.
2.  Here you will see a list of all cards you have access to.
3.  Use the **Search Bar** to quickly find a specific person by name, agency, or creator.
4.  Use **Filter** to narrow the directory by agency or designation. You can also click an agency name on a card or in the dashboard agency list to show that agency's staff.
5.  Select employees with the checkboxes to print multiple ID cards on A4 sheets.
6.  Click the **Edit** (pencil) icon to modify a card.
7.  Click the **Delete** (trash) icon to permanently remove a card.

### 4. Downloading / Printing Cards
1.  In the Directory, locate the card you want to download.
2.  Click the **Download** icon on that card.
3.  Choose your preferred format:
    *   **Download as Image:** Best for sharing digitally (e.g., via WhatsApp or Email).
    *   **Download as PDF:** Best for printing physical copies.
3.  To print several cards on A4 sheets, select the employee checkboxes and click **Print selected**. Each A4 portrait sheet holds up to 10 cards at standard ID-card dimensions. Set the printer paper to A4 and scaling to 100% or Actual Size.

### 5. Customizing Your Settings
1.  Navigate to the **"Settings"** tab.
2.  Update your Office Phone, Email, Issuing Authority, and Emergency Tag.
3.  Click **"Save Settings"**.
4.  *Note:* The next time you create a card, these new defaults will be automatically applied to the form.
5.  *Admins:* The assigned CCC is set by the Superuser and cannot be changed here. Your office details are saved to your account and are not shared with other Admins.

### 6. Managing Users and Agencies
1.  Admins and Superusers can open **"User Creation"** from the navigation menu. The user form opens in a dialog.
2.  Choose **"Manage agencies"** first to add and save agency names for the selected CCC. Superusers select the CCC in the agency dialog; Admins manage agencies for their assigned CCC.
3.  Create or edit an Editor and select an agency from the saved list. Editors can only manage employee records for that assigned agency.
4.  Open **"Agency Profiles"** to create and update company details for a CCC. Agency name is required; address, phone number, email, enlistment number, and vendor code are optional. Saved names are available in employee forms and Editor assignments. A profile cannot be deleted while employee or Editor records are assigned to its agency name.

### 7. Importing Employees from Excel
1.  In the Directory, click **"Template"** to download the `.xlsx` workbook.
2.  Add employee rows to the **Employees** worksheet without changing its column headers.
3.  Fill in the required **Name**, **Designation**, and **Agency Name** columns. Dates must use `YYYY-MM-DD`.
4.  Click **"Import Excel"** and choose the completed workbook.
5.  Confirm the import. Imported employees are added as new records; existing records are not changed. Photos are not included and can be added later by editing each card.

---

## ❓ Troubleshooting

*   **I logged in but see "Unauthorized Access":** Ask the Superuser or your CCC Admin to authorize your Google email.
*   **I can't see an ID card I know was created:** Editors see only records matching their assigned agency and CCC. Admins see records assigned to their CCC. Legacy records are included only if their `cccName` exactly matches the assigned CCC.
*   **The app crashes or doesn't load on my phone:** Ensure you followed the mobile installation steps (Log in *before* adding to the home screen). If issues persist, try clearing your browser cache or deleting and reinstalling the home screen shortcut.
