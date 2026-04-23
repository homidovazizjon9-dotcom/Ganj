---
name: ganj-project-context
description: >-
  Provides essential project context, architecture details, and core guidelines for the Ganj Expense Tracker application.
  Use this skill to quickly orient yourself on how the app is structured, what databases and roles exist, and how to deploy.
---

# Ganj Expense Tracker - Project Context

Welcome to the Ganj project! This document outlines the project's architecture, data structure, RBAC (Role-Based Access Control), and unique quirks to help AI agents (like yourself) navigate and modify the codebase without breaking existing logic.

## 🏗 Architecture & Stack
- **Frontend**: Vanilla JavaScript (`app.js`), Vanilla CSS (`style.css`), and a single HTML file (`index.html`).
- **No Bundler**: There is no Webpack, Vite, or npm build step. Scripts are loaded directly in the browser.
- **Backend & Database**: Firebase Realtime Database.
- **Authentication**: Firebase Auth (Google Sign-In).
- **Deployment**: Deployed via Firebase CLI (`firebase deploy --only hosting`) and hosted on GitHub Pages / Firebase Hosting.

## 🔐 Role-Based Access Control (RBAC)
Access rights are strictly defined by the user's role (stored in `/users/$uid/role`). We enforce this using the `canEdit()`, `canManageUsers()`, and `canViewHistory()` helper functions in `app.js`.

- **Superadmin** (`homidovazizjon9@gmail.com`): Absolute control. Has exclusive access to the `/trash` (Корзина) feature to restore or hard-delete data.
- **Cashier** (`cashier`): The only role (besides superadmin) that returns `true` for `canEdit()`. Can add, modify, and delete (soft-delete) records.
- **Director** / **Accountant** (`director`, `accountant`): Read-only access to records and history. Cannot edit.
- **Observer** (`observer`): Default fallback role. Strictly read-only, cannot view history.

> [!WARNING]
> When creating or updating functions that modify data in `app.js` (e.g., `saveStudent`, `deletePayment`), you **must** include `if (!canEdit()) return;` at the very top to prevent unauthorized actions.

## 🗄 Data Structure (Realtime Database)
- `/students`: `{ name, class, fee, phone, createdAt }`
- `/payments`: `{ studentId, studentName, studentClass, amount, month, year, monthKey, note, createdAt }`
- `/expenses`: `{ description, amount, category, date, createdAt }`
- `/users`: `{ email, name, role, photoURL, lastLogin }`
- `/auditLog`: `{ action, user, timestamp, details }`
- `/trash`: Used for soft deletes. Contains `{ _collection, _originalId, _deletedAt, _deletedBy, ...originalData }`.

## 🗑 Soft Delete System
Records are never immediately deleted. Instead, the `softDelete(collection, id, data)` function is used.
1. It moves the record to the `/trash` collection.
2. It removes it from the original path.
3. The Superadmin can access the "Корзина" page to call `restoreFromTrash()` or `hardDeleteFromTrash()`.

## ⚠️ Known Quirks & Specific Workarounds

### 1. Cache-Busting (Browser Cache)
Since there is no bundler, browser caching is a major issue. 
> [!IMPORTANT]
> If you make any logical changes to `app.js` or visual changes to `style.css`, you **MUST** increment the query parameter version string in `index.html` (e.g., `<script src="app.js?v=1777000004"></script>`). Failure to do so will result in users running outdated cached code.

### 2. CSV Export Encoding (Cyrillic to Excel)
Russian Microsoft Excel cannot properly read standard UTF-8 CSV files without manual import steps.
- We use a custom `encodeCP1251(str)` function in `app.js` to convert output strings to Windows-1251.
- We export the file as a `Uint8Array` Blob with the MIME type `text/csv;charset=windows-1251`.
- Do **not** revert CSV exports back to UTF-8 BOM, as this breaks functionality for the primary users.

## 🚀 Deployment Workflow
1. Commit and push changes to GitHub:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```
2. Deploy to Firebase:
   ```bash
   firebase deploy --only hosting
   ```
