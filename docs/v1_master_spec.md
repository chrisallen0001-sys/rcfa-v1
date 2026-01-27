# RCFA V1 Master Spec

AI-guided Root Cause Failure Analysis tool that standardizes investigations and serves as a system of record.

## Goal of V1

- Ensure RCFAs are conducted with consistent rigor regardless of who leads them
- Capture investigations in a searchable system of record
- Translate findings into actionable, trackable corrective actions

## In-Scope (V1)

- Web-based RCFA intake form
- AI-generated follow-up questions, root cause candidates, action item candidates
- Human validation: promote candidates → final records (copy with lineage preserved)
- Action item assignment, tracking, completion
- Status workflow (manual transitions): `draft` → `investigation` → `actions_open` → `closed`
- Local user accounts (email/password) with roles: `admin`, `user`
- Audit logging: status changes, promotions, edits, deletes
- Search RCFAs by `equipment_description`, `failure_description` (full-text)

### Workflow Triggers

| Transition | Trigger |
|------------|---------|
| `draft` → `investigation` | User clicks "Start Investigation" |
| `investigation` → `actions_open` | User clicks "Finalize Root Causes" |
| `actions_open` → `closed` | User clicks "Close RCFA" (requires ≥1 final root cause, all actions done/canceled) |

### Role Permissions

| Action | `user` | `admin` |
|--------|--------|---------|
| Create/edit own RCFAs | ✓ | ✓ |
| View all RCFAs | ✓ | ✓ |
| Delete any RCFA | ✗ | ✓ |
| Manage users | ✗ | ✓ |

## Out of Scope (V1)

- CMMS integration
- SSO / Active Directory
- File/image attachments

## Intake Fields

| Field | Required | Description |
|-------|----------|-------------|
| Equipment Description | Yes | Free-text description of equipment and function |
| Make / Model / Serial | No | Equipment identifiers |
| Approximate Age | No | Years or lifecycle stage |
| Recent Work History | No | Maintenance in last 1–3 years |
| Active PMs/PdMs | No | Current preventive/predictive tasks |
| Operating Context | Yes | `running`, `startup`, `shutdown`, `maintenance`, `unknown` |
| Pre-Failure Conditions | No | Abnormal observations prior to failure |
| Failure Description | Yes | What failed and how |
| Downtime / Costs | No | Minutes, production $, maintenance $ |
| Additional Notes | No | Anything else relevant |

→ See [V1 Intake Form](02-intake/V1%20Intake%20Form.md) for full details

## LLM Prompt Contract

**System role:** Expert reliability engineer performing RCFA

**Invocation:** Single call on intake submit; user can optionally re-analyze after answering follow-ups

**Required inputs:** `equipmentDescription`, `failureDescription`

**Expected JSON output:**

```json
{
  "followUpQuestions": ["string"],
  "rootCauseContenders": [
    { "cause": "string", "rationale": "string", "confidence": "low|medium|high" }
  ],
  "actionItems": [
    { "action": "string", "owner": "string", "priority": "low|medium|high",
      "timeframe": "Immediate|Short-term|Long-term", "successCriteria": "string" }
  ]
}
```

**Rules:**
- `followUpQuestions`: 5–10 items
- `rootCauseContenders`: 3–6 items
- `actionItems`: 5–10 items
- Output must be valid JSON only (no markdown)
- If info missing → ask follow-up questions, don't invent specifics

<details>
<summary>Field Definitions</summary>

| Field | Description |
|-------|-------------|
| `followUpQuestions` | Clarifying questions for failure modes, contributing factors, missing info. App assigns `category = 'other'` by default. |
| `cause` | Description of potential root cause |
| `rationale` | Why this is a candidate |
| `confidence` | `low`, `medium`, `high` |
| `action` | Recommended corrective action |
| `owner` | Suggested responsible role |
| `priority` | `low`, `medium`, `high` |
| `timeframe` | `Immediate`, `Short-term`, `Long-term` |
| `successCriteria` | How to measure completion |

</details>

→ See [RCFA V1 ChatGPT Prompt](03-ai/RCFA%20V1%20ChatGPT%20Prompt.md) for implementation

## Data Model Summary

**Pattern:** AI suggestions (Candidates) vs human-validated records (Finals)

| Table | Purpose |
|-------|---------|
| `app_user` | Local accounts |
| `rcfa` | Parent investigation record |
| `rcfa_followup_question` | AI/human questions + answers |
| `rcfa_root_cause_candidate` | AI suggestions (non-authoritative) |
| `rcfa_root_cause_final` | Validated root causes (authoritative) |
| `rcfa_action_item_candidate` | AI suggestions (non-authoritative) |
| `rcfa_action_item` | Tracked actions with owner, due date, status |
| `rcfa_audit_event` | Change log for defensibility |

**Relationships:**
```
rcfa (parent)
 ├── followup_question (1:N)
 ├── root_cause_candidate (1:N) → root_cause_final (promoted)
 ├── action_item_candidate (1:N) → action_item (promoted)
 └── audit_event (1:N)
```

<details>
<summary>Enums / Valid Values</summary>

| Field | Values |
|-------|--------|
| `user.role` | `admin`, `user` |
| `rcfa.status` | `draft`, `investigation`, `actions_open`, `closed` |
| `rcfa.operating_context` | `running`, `startup`, `shutdown`, `maintenance`, `unknown` |
| `question.category` | `failure_mode`, `evidence`, `operating_context`, `maintenance_history`, `safety`, `other` |
| `confidence_label` | `low`, `medium`, `high` |
| `action.priority` | `low`, `medium`, `high` |
| `action.status` | `open`, `in_progress`, `blocked`, `done`, `canceled` |

</details>

<details>
<summary>Audit Event Types</summary>

| Event | When |
|-------|------|
| `status_changed` | RCFA status transitions |
| `candidate_generated` | AI generates candidates |
| `promoted_to_final` | User promotes candidate → final |
| `final_updated` | User edits a final record |
| `final_deleted` | User deletes a final record |
| `action_completed` | Action item marked done/canceled |

</details>

→ **Source of truth:** [schema/051 v1_schema.sql](schema/051%20v1_schema.sql)

## Non-Goals

- Perfect UX polish (V1 is for feedback)
- Performance optimization at scale
- Complex RBAC permissions
- Mobile-native experience
- Multi-language support
