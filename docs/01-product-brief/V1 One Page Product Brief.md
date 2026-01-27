**Problem**

When equipment failures occur, the immediate priority is restoring operations as quickly as possible. Once the equipment is back online, attention shifts to preventing recurrence through Root Cause Failure Analysis (RCFA).

In practice, RCFA execution is highly inconsistent. The process is typically led by a single individual, with varying levels of experience, rigor, and team involvement. As a result, RCFAs are performed differently depending on who leads them. Time pressure and skill gaps often lead to incomplete investigations, misidentified root causes, and corrective actions that address symptoms rather than underlying causes.

In addition, critical technical information, such as equipment manuals, operating limits, and known failure modes, is often difficult or time-consuming to locate, if it can be found at all. Investigators may spend significant time searching for documentation or proceed without it, further degrading RCFA quality.

Without structured guidance and ready access to relevant equipment knowledge, organizations invest substantial effort in RCFA activities without reliably preventing repeat failures.

**V1 Goal**

The V1 RCFA AI Tool is a web-based application that standardizes and strengthens Root Cause Failure Analysis by combining structured workflows with AI-guided investigation, while also serving as a system of record for failures and corrective actions.

The goal of V1 is to ensure that RCFAs are conducted with consistent rigor, captured in a searchable system, and translated into actionable, trackable improvements, without adding unnecessary process overhead.

**How It Works**

1.  **Structured Intake  **
    Users enter failure details through a structured web-based intake form, capturing key information such as equipment details, failure description, operating context, and relevant history.

2.  **AI-Guided Investigation  **
    The intake data is sent to ChatGPT via API integration. The system generates targeted follow-up questions designed to clarify failure modes, contributing factors, and missing information.  
    Users may answer all, some, or none of the questions before proceeding.

3.  **AI Analysis & Recommendations  **
    After follow-up input is submitted, the system analyzes the full dataset and returns:

    - Potential root causes

    - Suggested corrective action items

4.  **Human Validation & Finalization  **
    Users review and select finalized root causes and corrective actions. These selections form the official RCFA record.

5.  **System of Record  **
    Each RCFA is stored as a persistent record with a unique ID. Users can:

    - View and update root causes and action items

    - Add supporting details such as downtime and cost impact

    - Assign action items to users

    - Complete action items and close out RCFA records

    - Search and review historical RCFA records

**In Scope**

- Web-based RCFA intake and review interface

- AI-powered analysis via ChatGPT API

- Persistent database storage of RCFA records

- Local user accounts

- Action item assignment and tracking

- Reporting and dashboards

**Out of Scope**

- CMMS integration

- Active Directory or SSO authentication

- Picture attachments

**Success Criteria**

V1 is successful if:

- Users find the AI-generated questions, root causes, and corrective actions valuable in accelerating and improving RCFA quality

- RCFAs are consistently documented and easy to retrieve as a system of record

- Users find action item assignment and follow-up workflows intuitive and useful

- The tool increases confidence that corrective actions address true root causes rather than symptoms
