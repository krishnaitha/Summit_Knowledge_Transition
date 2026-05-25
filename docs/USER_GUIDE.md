# Summit KT Portal — User Guide

> This guide covers all three roles: **Super Admin**, **Project Admin**, and **Member**.  
> Use the table of contents to jump directly to your role's section.

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Super Admin Guide](#2-super-admin-guide)
   - 2.1 [Admin Dashboard](#21-admin-dashboard)
   - 2.2 [Managing Projects](#22-managing-projects)
   - 2.3 [Uploading and Processing Documents](#23-uploading-and-processing-documents)
   - 2.4 [Inviting Members](#24-inviting-members)
   - 2.5 [Generating Quizzes](#25-generating-quizzes)
   - 2.6 [Sending Announcements](#26-sending-announcements)
   - 2.7 [Managing Users](#27-managing-users)
   - 2.8 [Handling Quiz Retake Requests](#28-handling-quiz-retake-requests)
   - 2.9 [Promoting a Member to Project Admin](#29-promoting-a-member-to-project-admin)
   - 2.10 [AI Document Generator](#210-ai-document-generator)
3. [Project Admin Guide](#3-project-admin-guide)
   - 3.1 [What a Project Admin Can Do](#31-what-a-project-admin-can-do)
   - 3.2 [Accessing Your Project](#32-accessing-your-project)
   - 3.3 [Managing Documents](#33-managing-documents)
   - 3.4 [Managing Members](#34-managing-members)
   - 3.5 [Managing Quizzes](#35-managing-quizzes)
   - 3.6 [Handling Retake Requests](#36-handling-retake-requests)
4. [Member Guide](#4-member-guide)
   - 4.1 [Dashboard Overview](#41-dashboard-overview)
   - 4.2 [Navigating Your Projects](#42-navigating-your-projects)
   - 4.3 [Reading KT Documents](#43-reading-kt-documents)
   - 4.4 [Using the AI Assistant (Chat)](#44-using-the-ai-assistant-chat)
   - 4.5 [Saving AI Answers (Bookmarks)](#45-saving-ai-answers-bookmarks)
   - 4.6 [Taking the Readiness Quiz](#46-taking-the-readiness-quiz)
   - 4.7 [Viewing Your Quiz Results](#47-viewing-your-quiz-results)
   - 4.8 [Requesting a Quiz Retake](#48-requesting-a-quiz-retake)
5. [Account Management](#5-account-management)
   - 5.1 [Registering an Account](#51-registering-an-account)
   - 5.2 [Accepting an Invite](#52-accepting-an-invite)
   - 5.3 [Resetting Your Password](#53-resetting-your-password)
6. [Glossary](#6-glossary)

---

## 1. Logging In

1. Navigate to your organisation's Summit KT Portal URL (e.g. `http://localhost:3000` during development or your production domain)
2. Enter your **email address** and **password**
3. Click **Sign in**

If your account is locked, you will see an error message. Contact your super admin to re-enable your account.

If you have forgotten your password, click **Forgot password?** on the login page. See [Section 5.3](#53-resetting-your-password).

---

## 2. Super Admin Guide

> **UI terminology note:** The application now uses **Products** as the user-facing label for project workspaces in navigation and page headings.

Super admins have full access to the entire portal — all projects, all users, analytics, and system-wide settings.

### 2.1 Admin Dashboard

**Location:** `/admin/dashboard`

The admin dashboard gives you a real-time snapshot of portal activity:

| Card                        | What it shows                                                  |
| --------------------------- | -------------------------------------------------------------- |
| **Total users**             | All authenticated users registered in the portal               |
| **Active users**            | Users who have logged in or taken an action in the last 7 days |
| **Documents**               | Total KT documents uploaded across all projects                |
| **Chatbot messages**        | Total AI assistant interactions                                |
| **Quiz completion**         | Percentage of members who have submitted a quiz attempt        |
| **Quiz re-enable requests** | Pending retake requests — click to go to Projects              |

Below the stats cards, the **Activity Feed** shows the 20 most recent events across the entire portal (logins, document views, quiz submissions, chat messages).

---

### 2.2 Managing Projects

**Location:** `/admin/projects`

#### Create a new project

1. Click **New project**
2. Enter a **Project name** and optional **Description**
3. Optionally set a **Pass threshold** (default: 60%) — the minimum score required to pass the quiz
4. Click **Create project**

#### Configure a quiz window

A quiz window restricts when members can take the quiz:

1. Open the project → click **Edit window**
2. Set **Open date/time** and **Close date/time**
3. Click **Save**

Members outside the window will see the quiz as unavailable. The system auto-submits any in-progress attempts when the window closes.

#### Archive a project

Toggle the **Active** switch on the project card to deactivate it. Members will no longer see inactive projects on their dashboard.

---

### 2.3 Uploading and Processing Documents

**Location:** `/admin/projects/[id]/documents`

Documents must be uploaded and processed before they appear in the AI chat and quiz generation.

#### Step 1 — Upload a document

1. Navigate to the project's **Documents** page
2. Click **Upload document**
3. Select a file. Supported formats:
   - PDF (`.pdf`)
   - Word document (`.docx`)
   - CSV (`.csv`)
   - Plain text (`.txt`)
4. Optionally tick **Required** — members must view required documents before the quiz unlocks
5. Click **Upload**

The document appears in the list with status **Uploaded**.

#### Step 2 — Process the document

Processing extracts text, detects PII, and generates vector embeddings:

1. Click **Process** next to the uploaded document
2. The status changes to **Processing** — this may take 30–120 seconds depending on document size
3. Once the background worker completes, status changes to **Processed**

> **Important:** A document must be in **Processed** status for it to appear in AI chat answers and quiz generation. If processing fails, click **Retry**.

#### Document classification

Documents are automatically classified during processing:

| Classification   | Meaning                                                     |
| ---------------- | ----------------------------------------------------------- |
| **Public**       | No sensitive content detected                               |
| **Internal**     | Business-sensitive content (detected heuristically)         |
| **Confidential** | PII detected (email addresses, phone numbers, SSN patterns) |

PII detections are counted and shown on the document card. Review confidential documents before distributing.

#### Connect external sources (Confluence / SharePoint / Jira / Monday / OneDrive / GitHub)

You can import external documentation directly into a project using connectors.

1. Navigate to **Documents** for a project
2. In **Document Connectors**, add either:
   - Confluence connector
   - SharePoint connector
   - Jira connector
   - Monday connector
   - OneDrive connector
   - GitHub connector
3. For quick validation, use sample connector presets
4. Click **Sync now** to ingest source content into project documents

Imported content is saved as project documents and becomes available for AI chat, search, and quiz generation.

For connector-specific credentials, scopes, and setup examples, see [docs/CONNECTOR_SETUP.md](docs/CONNECTOR_SETUP.md).

---

### 2.4 Inviting Members

**Location:** `/admin/projects/[id]/members`

You can invite users directly to a project:

1. Enter the **email address** of the person to invite
2. Click **Send invite**
3. The invitee receives an email with a secure link to set their password and join the project

> Invite links expire after **72 hours**. Resend from the same form if needed.

Alternatively, members can self-register at `/register` — you then assign them to projects manually.

---

### 2.5 Generating Quizzes

**Location:** `/admin/projects/[id]/quiz`

Quiz generation requires at least one **processed** document in the project.

1. Click **Generate quiz set**
2. Configure:
   - **Category:** `functional` (process/workflow questions) or `technical` (technical/system questions)
   - **Number of sets:** 1–5 (each set has a unique question pool)
   - **Questions per set:** default 10
3. Click **Generate**

The generation job is queued. The worker selects up to 30 document chunks, calls Groq once per set, and inserts the questions. This typically takes 15–60 seconds.

Once generated, quiz sets appear in the list. You can:

- **Activate / deactivate** a set (only active sets are assigned to members)
- **Preview** questions before assigning

---

### 2.6 Sending Announcements

**Location:** `/admin/projects/[id]` (scroll to Announcements section)

Announcements appear on the member dashboard under **Admin updates**.

1. Enter a **Title** and **Message**
2. Click **Send announcement**

Announcements are project-scoped — only members of that project see them.

---

### 2.7 Managing Users

**Location:** `/admin/users`

The Users table shows all registered users with full-text search, advanced filters, bulk actions, and CSV export.

#### Search and filter

- **Search bar** — filters by name or email in real time
- **Filters panel** — filter by:
  - Role (admin / member)
  - Status (active / locked)
  - Project membership
  - Last login date range

#### Bulk actions

1. Select users with the checkboxes (or tick the header checkbox to select all visible)
2. Use the bulk action toolbar:
   - **Lock selected** — prevents login
   - **Unlock selected** — restores login access
   - **Make admin** — promotes to super admin (use with caution)
   - **Make member** — demotes to member role
   - **Assign to project** — adds selected users to a project

#### User detail drawer

Click any user row to open their detail drawer showing:

- Account info and last login
- Project memberships
- Quiz attempt summary

#### Export

Click **Export CSV** to download the current filtered user list.

---

### 2.8 Handling Quiz Retake Requests

**Location:** `/admin/projects/[id]` → **Retake requests** card

When a member requests a quiz retake (after an auto-submit or failed attempt), the request appears here.

1. Review the member's name, submission timestamp, and reason (if provided)
2. Click **Approve** to delete the attempt — the member can retake from scratch
3. Click **Reject** to dismiss the request — the original attempt stands

Pending requests also appear as a badge on the project card in the Projects list and as a stat card on the admin dashboard.

---

### 2.9 Promoting a Member to Project Admin

**Location:** `/admin/projects/[id]/members`

1. Find the member in the project members list
2. Click **Make admin** next to their name
3. The badge next to their name changes to **Project admin**

Project admins can manage their specific project's documents, members, and quizzes. They cannot access the global dashboard, user management, or other projects. To remove project admin rights, click **Remove admin**.

---

### 2.10 AI Document Generator

**Location:** `/admin/generate-document`

Super admins and project admins can paste a transcript and generate a polished knowledge document using AI.

1. Open **AI Document Generator** from the admin sidebar
2. Paste transcript content
3. Optionally provide a document title
4. Choose export format (`.md` or `.txt`)
5. Click **Generate Document**
6. Review and download the generated output

---

## 3. Project Admin Guide

### 3.1 What a Project Admin Can Do

A project admin has elevated access **only for their assigned project**:

| Can do                         | Cannot do                        |
| ------------------------------ | -------------------------------- |
| Upload and process documents   | Access other projects            |
| Invite and manage members      | View the global admin dashboard  |
| Generate and manage quiz sets  | Access the Users management page |
| Use AI Document Generator      | Manage global users/roles        |
| Send announcements             | View analytics tab               |
| Approve/reject retake requests | Promote anyone to super admin    |

### 3.2 Accessing Your Project

After logging in, you arrive at the **Member Dashboard**. The dashboard shows:

- A **"Your managed projects"** section with a **Manage** button
- Clicking **Manage** takes you to your project's admin page at `/admin/projects/[id]`

From there, the sidebar shows:

- **Products** — your project list (only your assigned project is accessible)
- **AI Document Generator** — transcript-to-document generation tool

---

### 3.3 Managing Documents

Same workflow as the super admin (see [Section 2.3](#23-uploading-and-processing-documents)).

---

### 3.4 Managing Members

**Location:** `/admin/projects/[id]/members`

You can:

- Invite new members by email
- Promote members to project admin
- Remove members from the project

---

### 3.5 Managing Quizzes

Same workflow as the super admin (see [Section 2.5](#25-generating-quizzes)).

---

### 3.6 Handling Retake Requests

Same workflow as the super admin (see [Section 2.8](#28-handling-quiz-retake-requests)).

---

## 4. Member Guide

### 4.1 Dashboard Overview

After logging in, you land on your personal dashboard at `/dashboard`.

The dashboard has three main areas:

| Area                    | Description                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| **Welcome banner**      | Your name, quick stats (projects, completed, in-progress, docs), and a shortcut to your next action |
| **Quick command panel** | One-click access to Ask AI and Quiz for your next project                                           |
| **Assigned projects**   | All active projects you have been assigned to, with status badges and progress indicators           |
| **Saved AI answers**    | Your most recently bookmarked AI responses                                                          |
| **Recent activity**     | Your last 6 actions on the portal                                                                   |

If you are also a **Project Admin**, you will see a **"Your managed projects"** section with a **Manage** button.

---

### 4.2 Navigating Your Projects

From the **My Projects** sidebar link or the dashboard project cards, you can open any project you have been assigned to.

Each project card shows:

- **Project name** and quiz status badge (Not Started / In Progress / Completed)
- **Docs reviewed** progress bar — how many of the project's documents you have viewed
- **Quiz score** progress bar (after submission)
- **Ask AI**, **Take Quiz**, and **Documents** buttons

Click **Open** or the project name to go to the full project overview page.

---

### 4.3 Reading KT Documents

**Location:** `/projects/[id]` → KT Documents section, or click **Documents** on a project card

The document list shows all files uploaded by the admin. For each document:

- Click the file type badge (PDF / DOCX / TXT / CSV) to **open/download** the document
- Required documents are marked with an **amber "Required" badge** — you must view these before the quiz will unlock

Your reading progress is tracked automatically when you open a document.

---

### 4.4 Using the AI Assistant (Chat)

**Location:** `/projects/[id]/chat`

The AI assistant is grounded in the KT documents for this project. It can only answer questions based on the uploaded material.

**How to ask a question:**

1. Type your question in the chat input at the bottom
2. Press **Enter** or click **Send**
3. The assistant streams a response citing relevant document sections
4. Source references appear below the answer — you can see which document and section was used

**Tips for better answers:**

- Ask specific, focused questions ("What is the process for X?")
- If an answer is incomplete, follow up: "Can you elaborate on the second point?"
- If the AI says it doesn't have information, check whether the relevant document has been uploaded and processed by your admin

> The AI cannot answer questions outside the scope of the uploaded documents. It will tell you if a topic is not covered.

---

### 4.5 Saving AI Answers (Bookmarks)

During a chat session, you can bookmark any assistant response:

1. Hover over an assistant message
2. Click the **Bookmark icon** (🔖) that appears
3. The bookmark is saved and appears on your dashboard under **Saved AI answers**

To view all your bookmarks for a project, visit `/projects/[id]/bookmarks`.

Bookmarks show:

- The question you asked
- The AI's answer
- The project name and date

---

### 4.6 Taking the Readiness Quiz

**Location:** `/projects/[id]/quiz`

The quiz is a one-time readiness assessment. You have **one attempt** unless an admin resets it.

#### Before you start

- Make sure you have read the KT documents — especially any marked as **Required**
- Check whether a quiz window is active (the quiz may only be available between certain dates)
- Find a distraction-free environment — the quiz has an **anti-cheat guard** (see below)

#### During the quiz

- Questions are multiple choice (A/B/C/D) or true/false
- There is no time limit unless a quiz window close date is approaching
- Your answers are saved as you go — you can navigate between questions
- **Anti-cheat guard:** Switching browser tabs 3 or more consecutive times will trigger an automatic submission. Stay on the quiz tab

#### Submitting

Click **Submit quiz** when you have answered all questions. You will be redirected to your results immediately.

---

### 4.7 Viewing Your Quiz Results

After submitting, you see:

| Section                    | Description                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------- |
| **Score**                  | Your raw score and percentage                                                          |
| **Pass / Fail**            | Based on the project's pass threshold (default 60%)                                    |
| **Per-question breakdown** | Which answers were correct and which were wrong                                        |
| **AI coaching plan**       | Automatically generated recommendations highlighting your weak areas and what to study |

You can review your results any time from the project overview page.

---

### 4.8 Requesting a Quiz Retake

If your quiz was auto-submitted (e.g. due to tab switching) or if you failed and want another attempt:

1. Go to `/projects/[id]/quiz`
2. Click **Request retake**
3. Optionally enter a reason for your request
4. Click **Submit request**

Your request is sent to the project admin. When approved, your previous attempt is deleted and you can retake the quiz from scratch. You will be notified (if email notifications are configured).

---

## 5. Account Management

### 5.1 Registering an Account

If self-registration is enabled:

1. Visit `/register`
2. Enter your **full name**, **email address**, and **password** (minimum 8 characters)
3. Click **Create account**

After registering, your account will have **Member** role. A super admin must assign you to projects.

---

### 5.2 Accepting an Invite

When a super admin invites you by email:

1. Open the invite email from Summit KT Portal
2. Click **Accept invitation**
3. You are taken to `/auth/accept-invite?token=…`
4. Set your **password** and click **Set password & join**

You will be logged in immediately and your project assignment is applied automatically.

> Invite links expire after 72 hours. Ask the admin to resend if your link has expired.

---

### 5.3 Resetting Your Password

1. Go to the login page and click **Forgot password?**
2. Enter your registered **email address**
3. Click **Send reset link**
4. Open the email from Summit KT Portal and click **Reset password**
5. Enter and confirm your **new password**
6. Click **Set new password**

You are redirected to the login page. Sign in with your new password.

> Password reset links expire after **1 hour**.

---

## 6. Glossary

| Term                  | Definition                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **KT**                | Knowledge Transfer — the process of sharing system, process, and organisational knowledge from one person or team to another |
| **RAG**               | Retrieval-Augmented Generation — the technique used by the AI assistant to ground answers in the uploaded documents          |
| **Quiz window**       | A date/time range configured by an admin during which members can take the quiz                                              |
| **Required document** | A document marked as required by an admin; members must open it before the quiz unlocks                                      |
| **Quiz set**          | One pool of questions generated by AI. A project may have multiple sets; each member is assigned one                         |
| **Auto-submit**       | Automatic quiz submission triggered by the anti-cheat guard (repeated tab switches)                                          |
| **Retake request**    | A formal request from a member to have their quiz attempt reset so they can retake it                                        |
| **Coaching plan**     | An AI-generated post-quiz report highlighting weak topic areas and recommended study actions                                 |
| **Super Admin**       | A portal-wide administrator with access to all projects, users, analytics, and settings                                      |
| **Project Admin**     | A member promoted to manage a specific project; no access to other projects or global admin features                         |
| **Processing**        | The background task of extracting text from a document, detecting PII, and generating embeddings for AI search               |
| **Embedding**         | A 384-dimension numerical vector representation of text used for semantic similarity search                                  |
| **Bookmark**          | A saved AI assistant answer that appears on the member dashboard for quick reference                                         |
