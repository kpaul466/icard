# iCard Generation Portal - User Manual

Welcome to the iCard Generation Portal! This application is designed to streamline the creation, management, and distribution of ID cards for agency staff and employees.

## 🌟 Key Features

*   **Easy ID Card Creation:** Fill out a simple form, upload a photo, and instantly generate a professional ID card.
*   **Export Options:** Download the generated ID cards as high-quality Images (PNG) or PDF documents for printing.
*   **Role-Based Access Control:** Secure access with Admin and Editor roles to ensure data privacy.
*   **Customizable Settings:** Set default issuing authorities, office contact details, and emergency tags.
*   **Mobile Ready (PWA):** Install the app directly to your phone's home screen for quick access.

---

## 👥 User Roles & Permissions

The portal uses Google Sign-In for authentication and has two main types of users:

### 1. Admin (Master Access)
*   **Visibility:** Can view, edit, and delete **all** ID cards created by any user.
*   **User Management:** Has access to the "Access Control" tab to authorize new users or revoke access.
*   **Global Settings:** Can define "Global System Defaults" (like the default CCC Name, Issuing Authority, etc.) that apply to all new users.

### 2. Editor (Standard User)
*   **Visibility:** Can **only** view, edit, and delete the ID cards that they have personally created. They cannot see cards created by others.
*   **Personal Settings:** Can customize their own "Office Settings" which will pre-fill their ID card forms, saving time on repetitive data entry.

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
When you first open the app, click the **"Sign in with Google"** button. If your email has been authorized by an Admin, you will be granted access to the dashboard.

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
4.  Click the **Edit** (pencil) icon to modify a card.
5.  Click the **Delete** (trash) icon to permanently remove a card.

### 4. Downloading / Printing Cards
1.  In the Directory, locate the card you want to download.
2.  Click the **Download** icon on that card.
3.  Choose your preferred format:
    *   **Download as Image:** Best for sharing digitally (e.g., via WhatsApp or Email).
    *   **Download as PDF:** Best for printing physical copies.

### 5. Customizing Your Settings
1.  Navigate to the **"Settings"** tab.
2.  Update your default CCC Name, Office Phone, Email, Issuing Authority, and Emergency Tag.
3.  Click **"Save Settings"**.
4.  *Note:* The next time you create a card, these new defaults will be automatically applied to the form.

---

## ❓ Troubleshooting

*   **I logged in but see "Unauthorized Access":** Your Google email has not been added to the authorized users list. Please contact the system Administrator to grant you access.
*   **I can't see an ID card I know was created:** If you are an Editor, you can only see cards *you* created. If an Admin or another Editor created it, it will not appear in your directory.
*   **The app crashes or doesn't load on my phone:** Ensure you followed the mobile installation steps (Log in *before* adding to the home screen). If issues persist, try clearing your browser cache or deleting and reinstalling the home screen shortcut.
