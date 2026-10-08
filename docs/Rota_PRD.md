# 1. Product Summary

## 1.1 Product definition

**Rota** is a mobile-first shift scheduling application for small
businesses with teams that work scheduled shifts, including restaurants,
clinics, retail stores, salons, hospitality businesses, and similar
organizations.

Rota gives owners and managers one place to:

-   Create and manage teams and locations.
-   Invite and manage staff.
-   Create one-time and recurring shifts.
-   Build schedules in draft form.
-   Publish schedules to staff.
-   Detect scheduling conflicts.
-   Consider staff availability and preferences.
-   Handle shift swaps and open shifts.
-   Notify affected staff about schedule events.
-   Manage a subscription based on active staff seats.

Staff use Rota to:

-   View their upcoming and historical shifts.
-   See schedule changes.
-   Set availability and scheduling preferences.
-   Request swaps.
-   Offer assigned shifts as open shifts.
-   Claim eligible open shifts where permitted.
-   Receive important notifications.

Rota is **not** a payroll, attendance, or employee clock-in/clock-out
system.

## 1.2 Core value proposition

Rota replaces fragmented scheduling workflows such as:

-   Excel/Google Sheets for schedule creation.
-   WhatsApp/group chats for schedule announcements.
-   Paper schedules displayed at the workplace.
-   Manual conversations for finding shift replacements.
-   Separate payment/subscription processes.

The core value proposition is:

> **Create a schedule, publish it to the right people, manage changes
> safely, and let staff handle legitimate shift changes without losing
> managerial control.**

## 1.3 Primary workflow

The core Rota workflow is:

1.  Owner creates a business/team.
2.  Owner or authorized manager invites staff.
3.  Staff accept invitations and join the team.
4.  Staff configure availability and preferences.
5.  Manager creates a draft schedule.
6.  Rota validates assignments and identifies conflicts.
7.  Manager publishes the schedule.
8.  Staff receive notifications and view their shifts.
9.  Staff request swaps or offer eligible shifts.
10. Eligible staff may claim open shifts.
11. Manager approves or rejects changes where approval is required.
12. Rota validates the resulting schedule.
13. Rota records the change in the audit history.
14. Affected users receive notifications.

## 1.4 Target customer

The initial target customer is a small business with approximately
**5--100 staff members per team** where employees work predictable or
semi-predictable shifts.

Examples:

-   Restaurants.
-   Cafés.
-   Retail stores.
-   Clinics.
-   Salons and beauty businesses.
-   Hospitality businesses.
-   Small warehouses.
-   Fitness businesses.
-   Service businesses with shift-based employees.

## 1.5 Business model

Rota uses a **subscription model based primarily on active staff
seats**.

-   Owner is responsible for billing.
-   Managers are not billable by default.
-   Staff are billable seats.
-   The initial product includes a 14-day trial.
-   There is no permanent free plan.
-   Billing failure enters a grace period before restrictions are
    applied.
-   Existing schedules and historical records are retained after billing
    problems.

**OPEN QUESTION:** Exact seat price.

**DECISION:** Flutterwave is the locked payment provider for Rota.

## 1.6 Why Rota instead of spreadsheets and group chats?

  -------------------------------------------------------------------------
  Problem         Spreadsheet       Group chat        Rota
  --------------- ----------------- ----------------- ---------------------
  Schedule        Manual            Poor              Structured
  creation                                            

  Conflict        Usually manual    None              Built in
  detection                                           

  Staff           Separate/manual   Messages          Stored in profile
  availability                                        

  Publishing      Send/export       Message           Controlled publish
                                                      action

  Schedule        Easy to miss      Buried in chat    Targeted
  changes                                             notifications

  Shift swaps     Manual            Manual            Structured workflow
                  conversations     conversations     

  Swap approval   Informal          Informal          Manager-controlled

  Historical      Difficult         Difficult         Built in
  audit                                               

  Team access     File-based        Group-based       Role-based

  Billing         Separate          Separate          Integrated
  -------------------------------------------------------------------------

Rota's primary advantage is not simply displaying a calendar. It creates
a **controlled scheduling workflow** in which schedule creation,
publication, changes, swaps, notifications, permissions, and history are
connected.

------------------------------------------------------------------------

# 2. Problem Statement

## 2.1 Current problems

Small businesses often manage employee schedules using spreadsheets,
paper calendars, messaging applications, or combinations of these tools.

This creates several recurring problems.

### Problem 1: Schedule creation is manual

Managers manually assign people to shifts and must remember:

-   Who is available.
-   Who is already scheduled.
-   Who has requested particular days off.
-   Which employees are qualified for a role.
-   Whether someone has overlapping shifts.

**Affected users:** Owners and managers.

**MVP:** Yes.

------------------------------------------------------------------------

### Problem 2: Employees do not have a reliable schedule source

A schedule may be:

-   Printed and posted on a wall.
-   Sent through WhatsApp.
-   Attached to an email.
-   Updated in a spreadsheet.

Employees may therefore work from an outdated version.

**Affected users:** Staff, managers, owners.

**MVP:** Yes.

------------------------------------------------------------------------

### Problem 3: Schedule changes are difficult to communicate

A manager may change a shift after the original schedule was published.

Without a structured system, the manager has to remember who was
affected and manually notify them.

**Affected users:** All roles.

**MVP:** Yes.

------------------------------------------------------------------------

### Problem 4: Shift swaps are informal

A staff member who cannot work a shift may need to:

1.  Find another employee.
2.  Ask whether they can cover.
3.  Tell the manager.
4.  Wait for approval.
5.  Make sure the schedule is actually updated.

Messaging applications do not provide a reliable state machine for this
process.

**Affected users:** Primarily staff and managers.

**MVP:** Yes.

------------------------------------------------------------------------

### Problem 5: Scheduling conflicts are easy to create

A staff member can accidentally be assigned:

-   Two shifts at the same time.
-   Two overlapping shifts.
-   A shift immediately after another shift in a way that is
    operationally impossible.

**Affected users:** Managers and staff.

**MVP:** Yes.

------------------------------------------------------------------------

### Problem 6: Availability information is disconnected from scheduling

Staff often communicate availability using messages such as:

> "I can't work Tuesday mornings."

The manager then has to remember this when building future schedules.

Rota stores availability as structured data.

**Affected users:** Staff and managers.

**MVP:** Yes.

------------------------------------------------------------------------

### Problem 7: There is no reliable scheduling history

A business may need to understand:

-   Who changed a shift.
-   Who approved a swap.
-   When a schedule was published.
-   Who removed an employee.
-   What happened to a cancelled shift.

Manual tools make this difficult.

**Affected users:** Owners and managers.

**MVP:** Yes.

------------------------------------------------------------------------

## 2.2 Problems explicitly outside MVP

The following are intentionally not solved by the first version:

-   Payroll.
-   Tax calculation.
-   Employee clock-in/out.
-   Attendance tracking.
-   Automated wage calculation.
-   Full HR management.
-   Performance management.
-   Recruitment.
-   Benefits management.
-   Complex labor-law optimization.
-   Fully autonomous AI scheduling.

These may become future products or integrations.

------------------------------------------------------------------------

# 3. Goals and Non-Goals

## 3.1 Product goals

### Goal 1 --- Faster schedule creation

**Proposed target:** A manager should be able to create and publish a
normal weekly schedule for a small team in **15 minutes or less** after
becoming familiar with the product.

### Goal 2 --- Reduce scheduling conflicts

**Proposed target:** Rota should prevent confirmed schedules from
creating accidental overlapping assignments for the same staff member.

### Goal 3 --- Make schedules authoritative

There should be one current published schedule rather than multiple
competing spreadsheet/chat versions.

### Goal 4 --- Make shift swaps structured

A staff member should be able to initiate a swap or open-shift workflow
without leaving the scheduling system.

### Goal 5 --- Communicate changes reliably

Affected staff should receive notifications when:

-   They receive a shift.
-   A published shift changes.
-   A swap request affects them.
-   A swap is approved/rejected.
-   An important schedule event occurs.

### Goal 6 --- Encourage staff adoption

**Proposed target:** At least **70% of invited staff** should activate
their accounts during an onboarded business's first 30 days.

### Goal 7 --- Establish recurring revenue

Rota should convert businesses from the trial to paid subscriptions and
grow revenue as active staff seats increase.

------------------------------------------------------------------------

## 3.2 Non-goals

Rota MVP will not:

-   Process payroll.
-   Track clock-in/clock-out.
-   Track attendance.
-   Calculate employee wages.
-   Automatically approve schedule swaps without required managerial
    approval.
-   Automatically modify schedules based solely on AI output.
-   Replace a full HR information system.
-   Provide a permanent free plan.
-   Implement complex offline synchronization.
-   Attempt to optimize every possible labor-law constraint globally.
-   Provide autonomous workforce management.

------------------------------------------------------------------------

# 4. User Personas

## 4.1 Owner

### Responsibilities

The owner:

-   Creates the business/team.
-   Manages billing.
-   Manages users and managers.
-   Controls team access.
-   Oversees schedules.
-   Can perform manager-level scheduling operations.

### Goals

-   Know that schedules are being managed correctly.
-   Reduce administrative work.
-   Keep staff informed.
-   Control costs.
-   Maintain historical records.
-   Prevent unauthorized access.

### Pain points

-   Managers using inconsistent processes.
-   Staff missing schedule changes.
-   Time spent resolving shift conflicts.
-   Staff asking about schedules repeatedly.
-   Billing becoming disconnected from actual team size.

### Permissions

The owner can:

-   Create teams/locations.
-   Invite users.
-   Assign/change roles.
-   Remove/deactivate memberships.
-   Create/edit/publish schedules.
-   Manage shifts.
-   Manage swaps.
-   Manage availability-related information where operationally
    appropriate.
-   Access audit history.
-   Manage subscription and billing.

The owner cannot bypass fundamental data integrity rules such as
creating an overlapping confirmed shift without an explicit override
mechanism being designed.

### Common workflows

1.  Create business.
2.  Create location/team.
3.  Invite manager.
4.  Invite staff.
5.  Configure billing.
6.  Review schedules.
7.  Review audit activity.
8.  Manage subscription.

### Edge cases

-   Owner attempts to remove themselves as the only owner.
-   Owner cancels billing while future schedules exist.
-   Owner removes a manager who created schedules.
-   Owner removes a staff member who has future shifts.

------------------------------------------------------------------------

## 4.2 Manager

### Responsibilities

-   Build schedules.
-   Assign staff.
-   Publish schedules.
-   Edit published schedules where permitted.
-   Handle shift swaps.
-   Monitor scheduling conflicts.
-   Manage scheduling for permitted teams.

### Goals

-   Create schedules quickly.
-   Avoid conflicts.
-   Know staff availability.
-   Make changes safely.
-   Resolve swaps without unnecessary messaging.

### Pain points

-   Manual conflict checking.
-   Staff availability being scattered across messages.
-   Finding replacement workers.
-   Staff missing schedule changes.
-   Multiple managers editing the same schedule.

### Permissions

Managers can:

-   View permitted teams.
-   Create/edit shifts.
-   Create recurring shifts.
-   Publish schedules.
-   Cancel shifts.
-   Process swap requests.
-   Manage open shifts.
-   View staff availability/preferences required for scheduling.

Managers cannot by default:

-   Manage billing.
-   Transfer ownership.
-   Access unrelated teams.
-   Delete the business.
-   Change their own role to owner.

**ASSUMPTION:** The owner can configure whether managers may invite
staff. The initial default is **enabled**.

### Common workflows

-   Build weekly schedule.
-   Publish schedule.
-   Change one staff member's shift.
-   Approve swap.
-   Reject invalid swap.
-   Fill an open shift.

### Edge cases

-   Two managers edit the same shift.
-   Another manager modifies a shift while a swap is pending.
-   Manager loses team access while editing.
-   Manager attempts to assign an inactive user.

------------------------------------------------------------------------

## 4.3 Staff member

### Responsibilities

-   Review assigned shifts.
-   Maintain availability.
-   Maintain scheduling preferences.
-   Request swaps.
-   Offer shifts.
-   Claim eligible open shifts.
-   Respond to notifications.

### Goals

-   Know when they work.
-   Avoid unexpected schedule changes.
-   Request replacements easily.
-   Control availability.
-   See current schedule from anywhere.

### Pain points

-   Schedule messages getting buried.
-   Finding replacement staff.
-   Not knowing whether a manager approved a swap.
-   Outdated schedule information.

### Permissions

Staff can:

-   View their own schedule.
-   View permitted schedule information required for swaps.
-   Manage their own availability.
-   Manage their own preferences.
-   Request swaps.
-   Offer eligible shifts.
-   Claim eligible open shifts.

Staff cannot:

-   Publish schedules.
-   Modify another employee's shift.
-   Approve swaps.
-   Manage billing.
-   Invite arbitrary users unless separately authorized.

### Edge cases

-   Staff member requests a swap after a shift has started.
-   Staff member is removed while they have future shifts.
-   Staff member tries to claim a shift they are unavailable for.
-   Staff member attempts to claim an already claimed open shift.

------------------------------------------------------------------------

## 4.4 Permission model

  --------------------------------------------------------------------------
  Capability            Owner   Manager                Staff
  --------------------- ------- ---------------------- ---------------------
  Manage billing        Yes     No                     No

  Manage owner account  Yes     No                     No

  Manage team           Yes     Limited                No

  Invite staff          Yes     Configurable           No

  Change roles          Yes     Limited/No             No

  Create shifts         Yes     Yes                    No

  Edit shifts           Yes     Yes                    No

  Publish schedule      Yes     Yes                    No

  View own shifts       Yes     Yes                    Yes

  View team schedule    Yes     Yes                    Limited

  Set own availability  Yes     Yes                    Yes

  Request swap          Yes     Yes                    Yes

  Approve swap          Yes     Yes                    No

  Claim open shift      Yes     Yes                    Yes

  View audit history    Yes     Relevant team history  Own relevant history
  --------------------------------------------------------------------------

------------------------------------------------------------------------

# 5. Functional Requirements

## 5.1 Authentication and accounts

### 5.1.1 Registration

A new user can register using:

-   Email.
-   Password.
-   Required account information.

**ASSUMPTION:** A user must verify their email before performing
sensitive account/team operations.

The system must:

-   Validate email format.
-   Enforce password requirements.
-   Hash passwords using a modern adaptive password hashing algorithm.
-   Prevent duplicate active accounts for the same email.
-   Rate-limit registration attempts.
-   Record account creation.

### 5.1.2 Login

Login requires:

-   Email.
-   Password.

The system must:

-   Verify credentials securely.
-   Create an authenticated session/token.
-   Rate-limit repeated failures.
-   Avoid revealing whether an email exists through error messages.
-   Record relevant security events.

### 5.1.3 Logout

Logout invalidates the relevant authenticated session.

If multiple devices/sessions are supported, users should be able to
revoke sessions where appropriate.

### 5.1.4 Password reset

Password reset must:

1.  Accept an email.
2.  Generate a single-use reset token.
3.  Store only the required secure representation of the token.
4.  Expire the token.
5.  Allow password replacement once.
6.  Invalidate the token after use.

### 5.1.5 Google OAuth

**RECOMMENDATION:** Support Google OAuth after baseline email/password
authentication is stable.

OAuth should:

-   Verify provider identity.
-   Link to an existing account where safe.
-   Avoid creating unintended duplicate accounts.
-   Maintain the same authorization model as password users.

### 5.1.6 Account deactivation

A user can deactivate their account where permitted.

Historical scheduling records must not be destroyed solely because the
account is deactivated.

------------------------------------------------------------------------

## 5.2 Business and team management

### 5.2.1 Business creation

The owner can create a business with:

-   Business name.
-   Default timezone.
-   Basic business information.

**ASSUMPTION:** A business can contain multiple teams/locations.

### 5.2.2 Team/location

A team/location has:

-   Name.
-   Timezone.
-   Business relationship.
-   Active/inactive state.

Examples:

-   Lagos Branch.
-   Victoria Island Store.
-   Main Clinic.
-   Kitchen Team.

### 5.2.3 Team membership

A membership associates:

-   User.
-   Team.
-   Role.
-   Status.
-   Membership timestamps.

A user can belong to multiple teams.

**ASSUMPTION:** A user may have different roles in different teams
because role is stored on `TeamMembership`, not globally on `User`.

This differs slightly from the simpler assumption that a user has one
role within a team; the role remains team-specific.

### 5.2.4 Invitations

Authorized users can invite people by:

-   Email.
-   Secure invite link.

Invitation requirements:

-   Unique secure token.
-   Expiration.
-   Team association.
-   Intended role.
-   Inviting user.
-   Status.
-   Created/accepted/expired timestamps.

Duplicate active invitations for the same email/team/role should be
prevented or consolidated.

### 5.2.5 Removing a member

Removing a member should normally deactivate their membership rather
than delete the user.

Future scheduling behavior:

**RECOMMENDATION:** Existing future shifts remain visible in history but
require manager resolution before the schedule can be considered fully
staffed.

The system should:

-   Preserve historical assignments.
-   Remove team access.
-   Mark affected future shifts as requiring attention.
-   Notify relevant managers.

------------------------------------------------------------------------

# 5.3 Scheduling

## 5.3.1 Shift structure

A shift contains at minimum:

-   Team.
-   Date/start datetime.
-   End datetime.
-   Assigned staff member.
-   Position/role.
-   Notes.
-   Status.
-   Publication state.
-   Creation metadata.
-   Last modification metadata.

### Shift status

Recommended states:

-   `DRAFT`
-   `PUBLISHED`
-   `CANCELLED`
-   `COMPLETED`

A shift's publication state and operational status may be represented
separately if needed.

### Shift lifecycle

``` mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PUBLISHED: Publish
    DRAFT --> CANCELLED: Cancel
    PUBLISHED --> PUBLISHED: Edit
    PUBLISHED --> CANCELLED: Cancel
    PUBLISHED --> COMPLETED: End time passes
    CANCELLED --> [*]
    COMPLETED --> [*]
```

**ASSUMPTION:** Historical shifts are retained rather than physically
deleted.

------------------------------------------------------------------------

## 5.3.2 Create shift

Managers/owners can create a shift by providing:

-   Date.
-   Start time.
-   End time.
-   Team/location.
-   Staff member.
-   Position.
-   Notes.

Validation must check:

-   Start is before end.
-   Timezone is valid.
-   Assigned staff is an active member of the team.
-   Staff does not have an overlapping shift.
-   Shift is not otherwise invalid according to business rules.

### Shift crossing midnight

A shift may cross midnight.

Example:

> 22:00 Monday → 06:00 Tuesday.

The system stores this as actual datetimes rather than treating
start/end as independent dates.

The display can show the human-readable local date representation.

------------------------------------------------------------------------

## 5.3.3 Edit shift

Managers can edit draft shifts.

Published shifts may also be edited.

When a published shift changes, Rota must:

1.  Identify affected users.
2.  Validate the resulting schedule.
3.  Persist the change transactionally.
4.  Record the audit event.
5.  Generate notifications.

### Concurrent editing

Two managers may attempt to edit the same shift.

**RECOMMENDATION:** Use optimistic concurrency control.

Each mutable scheduling record should have a version or updated-at
value.

An update must fail with a conflict if the client's version is stale.

The manager then reloads the latest state.

------------------------------------------------------------------------

## 5.3.4 Delete/cancel shift

A published shift should normally be **cancelled**, not hard-deleted.

Draft shifts may be deleted where no historical audit requirement is
violated.

Cancellation must:

-   Update shift status.
-   Record actor.
-   Record reason if required.
-   Notify affected staff.
-   Preserve historical information.

------------------------------------------------------------------------

## 5.3.5 Draft schedules

Managers can construct schedules in draft state.

Draft schedules:

-   Are visible to authorized scheduling users.
-   Are not treated as the authoritative employee schedule.
-   Do not generate ordinary schedule-publication notifications.
-   Can be edited repeatedly before publication.

**ASSUMPTION:** MVP uses schedule grouping by team/date rather than
requiring a separate persistent `Schedule` entity. Publication is
represented by shift state/publication metadata.

A separate schedule entity may be introduced later if versioning or
approval workflows require it.

------------------------------------------------------------------------

## 5.3.6 Publishing

Publishing a schedule changes eligible shifts from draft to published.

Before publishing, Rota validates:

-   Staff membership.
-   Overlaps.
-   Shift dates.
-   Required fields.
-   Invalid/inactive staff.
-   Other configured scheduling rules.

If blocking conflicts exist, publication fails and the manager receives
actionable errors.

**RECOMMENDATION:** Non-blocking warnings such as availability
mismatches should be distinguishable from hard conflicts.

------------------------------------------------------------------------

## 5.3.7 Recurring shifts

Managers can create recurring shift patterns.

A recurring pattern may contain:

-   Team.
-   Staff assignment.
-   Position.
-   Start time.
-   End time.
-   Days of week.
-   Start date.
-   End date or number of occurrences.
-   Timezone.
-   Notes.

The recurrence rule creates individual shift instances.

### Recurring shift modification

Managers must be able to distinguish:

-   Modify this occurrence.
-   Modify this and future occurrences.
-   Modify the entire series.

**ASSUMPTION:** Once generated, individual historical shifts become
independent records. Changing a recurrence rule must not rewrite
historical shifts.

------------------------------------------------------------------------

## 5.3.8 Schedule views

Mobile clients should support:

### Staff

-   Upcoming shifts.
-   Weekly view.
-   Monthly view.
-   Shift details.
-   Historical shifts.

### Managers/owners

-   Team schedule.
-   Day view.
-   Week view.
-   Staff-focused view.
-   Draft/published indication.
-   Conflict indicators.

### Filtering

Managers should be able to filter by:

-   Team.
-   Staff member.
-   Date range.
-   Position.
-   Status.

------------------------------------------------------------------------

## 5.3.9 Conflict detection

The system must prevent or clearly flag overlapping shifts for the same
staff member.

A shift overlaps when:

``` text
existing.start < new.end
AND
existing.end > new.start
```

For confirmed/published schedules, overlapping assignments should be a
blocking error.

**ASSUMPTION:** Availability conflicts are warnings rather than
automatic blockers because staff availability is advisory.

------------------------------------------------------------------------

## 5.3.10 Availability

Staff can configure recurring or date-specific availability.

Examples:

-   Available Monday 09:00--17:00.
-   Unavailable Tuesday.
-   Available only after 18:00 on Wednesday.

Availability must use the team's relevant timezone.

### Availability behavior

Availability is scheduling information, not an automatic scheduling
command.

If a manager schedules a staff member outside their availability:

-   Rota displays a warning.
-   The manager must explicitly acknowledge the warning if the product
    later allows such assignments.
-   The system does not silently reject the shift unless a business rule
    explicitly marks the availability as mandatory.

**RECOMMENDATION:** MVP treats availability as a warning, not a hard
constraint.

------------------------------------------------------------------------

## 5.3.11 Staff preferences

Preferences may include:

-   Preferred shift times.
-   Preferred days.
-   Preferred positions.
-   Maximum preferred shifts per week.
-   Minimum preferred hours.
-   Other scheduling preferences.

Preferences are advisory.

They should help managers make decisions but should not automatically
modify schedules.

------------------------------------------------------------------------

## 5.3.12 Time zones

Every team/location has a timezone.

All shift datetimes are stored in a timezone-safe format, preferably as
UTC timestamps plus the relevant team timezone context.

The mobile application displays shifts in the team/location timezone.

A user's physical location must not silently change a shift's actual
scheduled time.

------------------------------------------------------------------------

## 5.3.13 Historical schedules

Historical shifts remain available for:

-   Staff viewing.
-   Manager reference.
-   Reporting.
-   Audit purposes.

Historical records must retain enough information to identify:

-   Original staff assignment.
-   Team.
-   Time.
-   Status.
-   Relevant changes.

------------------------------------------------------------------------

# 5.4 Shift swaps

## 5.4.1 Swap types

Rota supports two related workflows.

### Direct swap

Staff member A requests to exchange an assigned shift with eligible
staff member B.

### Open shift

Staff member A offers their shift.

An eligible staff member B claims it.

Manager approval is required before the assignment becomes final.

------------------------------------------------------------------------

## 5.4.2 Swap eligibility

A proposed recipient must:

-   Be an active member of the same team.
-   Be eligible for the relevant position where position eligibility is
    configured.
-   Not have a conflicting shift.
-   Not be removed/deactivated.
-   Meet other configured business rules.

Availability may produce a warning.

------------------------------------------------------------------------

## 5.4.3 Swap state machine

``` mermaid
stateDiagram-v2
    [*] --> REQUESTED
    REQUESTED --> APPROVED: Manager approves
    REQUESTED --> REJECTED: Manager rejects
    REQUESTED --> CANCELLED: Requester cancels
    REQUESTED --> EXPIRED: Shift deadline passes
    APPROVED --> EXECUTED: Assignment transaction succeeds
    APPROVED --> FAILED: Schedule validation fails
    FAILED --> REQUESTED: Corrected/re-submitted
    REJECTED --> [*]
    CANCELLED --> [*]
    EXPIRED --> [*]
    EXECUTED --> [*]
```

**RECOMMENDATION:** Approval and actual assignment update should occur
inside one database transaction so the system cannot report an approved
swap while retaining the old assignment.

------------------------------------------------------------------------

## 5.4.4 Request swap workflow

1.  Staff selects an eligible shift.
2.  Staff selects another eligible staff member or uses an open-shift
    flow.
3.  Rota validates eligibility.
4.  Rota checks current conflicts.
5.  Request is created.
6.  Relevant manager receives notification.
7.  Recipient may receive notification where applicable.
8.  Manager approves/rejects.
9.  Rota re-checks all conditions at approval time.
10. If valid, assignment is updated transactionally.
11. Audit record is created.
12. Affected staff are notified.

### Important rule

A validation performed when the request is created is not sufficient.

The system must perform validation again when the manager approves
because the schedule may have changed.

------------------------------------------------------------------------

## 5.4.5 Duplicate swap requests

The system must prevent duplicate active swap requests involving the
same shift and same intended transition.

A repeated API request should be idempotent where the client provides an
idempotency key.

------------------------------------------------------------------------

## 5.4.6 Swap after shift start

**RECOMMENDATION:** A swap request cannot be created after the shift's
scheduled start time.

An already-created request that reaches the shift start should
automatically become expired unless an explicit emergency override is
later introduced.

------------------------------------------------------------------------

## 5.4.7 Manager approval race condition

If:

1.  Staff requests swap.
2.  Manager A opens request.
3.  Manager B changes the underlying shift.
4.  Manager A approves the swap.

The approval transaction must re-check:

-   Shift version.
-   Current assignment.
-   Shift time.
-   Recipient eligibility.
-   Conflicts.
-   Membership state.

If any validation fails, the approval fails safely and the manager
receives an explanation.

------------------------------------------------------------------------

# 5.5 Open shifts

A staff member can offer an assigned shift as an open shift.

The shift:

-   Remains associated with the original staff member until claimed and
    approved.
-   Is visible to eligible staff.
-   Cannot be claimed by an ineligible or conflicting user.
-   Cannot be claimed twice.

**OPEN QUESTION:** Whether the business wants open-shift claims to
require manager approval. The default recommendation is **yes for MVP**.

------------------------------------------------------------------------

# 5.6 Notifications

## 5.6.1 Notification events

At minimum:

  Event                           Recipient
  ------------------------------- -----------------------
  Invitation                      Invited user
  Invitation accepted             Inviter
  New shift assignment            Staff
  Schedule published              Affected staff
  Published shift changed         Affected staff
  Shift cancelled                 Affected staff
  Swap requested                  Relevant manager
  Swap request accepted/updated   Relevant participants
  Swap approved                   Affected staff
  Swap rejected                   Requester
  Open shift available            Eligible staff
  Open shift claimed              Manager
  Billing warning                 Owner
  Payment failure                 Owner
  Subscription status change      Owner

## 5.6.2 Push notifications

Push is the primary mobile notification channel.

The system must support device registration and multiple devices per
user where appropriate.

Each notification should have a stable event/idempotency identifier.

## 5.6.3 Email

Email should be used for:

-   Invitations.
-   Password reset.
-   Important billing events.
-   Critical account/security events.
-   Important scheduling events when push delivery is unavailable or
    user preference requires it.

## 5.6.4 Notification preferences

Users can control non-critical notifications.

Critical security/account notifications cannot necessarily be disabled.

**ASSUMPTION:** MVP provides a simple notification preference model
rather than granular per-event configuration for every event.

## 5.6.5 Delivery reliability

Notification delivery should use a background job system.

Requirements:

-   Retry transient failures.
-   Exponential backoff.
-   Idempotency.
-   Delivery status tracking.
-   Permanent failure state.
-   No duplicate user-visible notification for the same event.

------------------------------------------------------------------------

# 5.7 Billing

## 5.7.1 Trial

The default trial is:

**14 days.**

Trial begins when the business starts its subscription trial according
to the billing provider integration.

**OPEN QUESTION:** Whether a payment method must be collected at trial
start.

------------------------------------------------------------------------

## 5.7.2 Billable seats

**ASSUMPTION:** Active staff memberships are billable.

Owners and managers are not billable by default.

A user who belongs to multiple teams must have billing treatment
explicitly defined.

**OPEN QUESTION:** Whether billing is calculated per business or
independently per team/location.

**RECOMMENDATION:** Calculate billing at the **business level**, with
active staff across that business contributing to the seat count.

------------------------------------------------------------------------

## 5.7.3 Seat counting

A staff seat is counted when the staff membership is active.

Removing/deactivating a staff member reduces the billable count
according to the billing provider's subscription rules.

**RECOMMENDATION:** Use a monthly subscription with a seat quantity
synchronized to the current active staff count.

------------------------------------------------------------------------

## 5.7.4 Payment failure

When payment fails:

1.  Provider sends webhook.
2.  Rota records billing event.
3.  Subscription enters a payment-failed state.
4.  Owner receives notification.
5.  Grace period begins.
6.  Billing system retries according to provider policy.
7.  If payment succeeds, subscription returns to active.
8.  If grace period expires, restrictions are applied.

Existing schedule data is retained.

------------------------------------------------------------------------

## 5.7.5 Grace period

**ASSUMPTION:** Proposed grace period is **7 days**.

During grace:

-   Existing schedules remain viewable.
-   Scheduling remains operational.
-   Owner receives reminders.

After grace period:

**RECOMMENDATION:** Move to restricted mode rather than deleting or
hiding historical data.

Potential restrictions:

-   No new schedule publication.
-   No new staff invitations.
-   No new billable staff additions.
-   Existing schedule viewing remains available.

------------------------------------------------------------------------

## 5.7.6 Cancellation

Cancellation should:

-   Stop future billing at the appropriate billing boundary.
-   Preserve business data.
-   Preserve schedules.
-   Preserve historical records.
-   Allow subscription restoration during the configured retention
    period.

------------------------------------------------------------------------

# 5.8 Audit and history

The system must audit sensitive actions.

At minimum:

-   Business creation.
-   Team creation.
-   Invitation.
-   Role change.
-   Membership removal.
-   Shift creation.
-   Shift assignment.
-   Shift edit.
-   Shift cancellation.
-   Schedule publication.
-   Swap request.
-   Swap approval.
-   Swap rejection.
-   Open-shift claim.
-   Billing state changes.
-   Subscription changes.
-   AI-confirmed scheduling actions.

Audit records should contain:

-   Actor.
-   Action.
-   Entity type.
-   Entity ID.
-   Timestamp.
-   Relevant before/after information where appropriate.
-   Team/business context.
-   Request/correlation identifier where available.

Sensitive information should not be unnecessarily duplicated into audit
logs.

------------------------------------------------------------------------

# 5.9 Important edge cases

## Two managers editing the same schedule

Use optimistic concurrency control.

A stale mutation fails rather than silently overwriting another
manager's changes.

------------------------------------------------------------------------

## Staff removed after being assigned

The membership becomes inactive.

Historical shifts remain.

Future affected shifts are flagged for manager resolution.

------------------------------------------------------------------------

## Manager approves swap while another manager changes the shift

Approval performs transactional revalidation.

If the shift changed, approval fails safely.

------------------------------------------------------------------------

## Shift overlap

Published/confirmed overlapping shifts for the same staff member are
blocked.

------------------------------------------------------------------------

## Shift crossing midnight

Store actual start/end timestamps.

Do not infer the end date solely from a displayed clock time.

------------------------------------------------------------------------

## Daylight-saving changes

Timezone-aware calculations must account for DST transitions.

A recurring shift should be represented in the team's local timezone
before being converted to its actual timestamp.

------------------------------------------------------------------------

## Time-zone differences

The team timezone is authoritative for shift scheduling.

A staff member travelling to another timezone should still see the
correct team-local scheduled time.

------------------------------------------------------------------------

## Expired invitation

Expired invitations cannot be accepted.

The inviter may resend a new invitation.

------------------------------------------------------------------------

## Duplicate invitation

Only one active invitation should exist for the same relevant email/team
combination.

------------------------------------------------------------------------

## Duplicate swap request

Duplicate active requests for the same underlying transition should be
rejected or return the existing request.

------------------------------------------------------------------------

## Swap after shift started

Rejected.

------------------------------------------------------------------------

## User leaves team with future shifts

Membership access is revoked.

Future shifts remain for historical integrity but require manager
resolution.

------------------------------------------------------------------------

## Billing failure during active schedule

Schedules are not deleted.

Access transitions according to grace-period rules.

------------------------------------------------------------------------

## Duplicate notification

Notification event IDs and delivery records prevent duplicate delivery.

------------------------------------------------------------------------

## Network failure during mutation

Client retries using an idempotency key where the mutation is safe to
retry.

The API must return the existing result when the same valid idempotency
key is reused.

------------------------------------------------------------------------

## Duplicate API request

Mutation endpoints that can create duplicate business effects should
support idempotency keys.

Examples:

-   Invitation.
-   Swap request.
-   Shift creation where retry risk exists.
-   Billing-related actions.
-   AI command execution.

------------------------------------------------------------------------

## Recurring shift modification

The UI must explicitly communicate whether the change applies to:

-   One occurrence.
-   This and future occurrences.
-   Entire series.

Historical occurrences remain unchanged.

------------------------------------------------------------------------

## Schedule changes after publication

Any materially affected staff member receives a notification.

The audit log records the change.

------------------------------------------------------------------------

# 6. AI Processing Pipeline

## 6.1 AI purpose

AI is an optional scheduling assistant.

Example input:

> "Schedule John for Tuesday morning."

The AI does not directly modify the schedule.

It produces a structured scheduling proposal that the deterministic Rota
application validates.

## 6.2 AI scope

AI may:

-   Interpret natural-language scheduling requests.
-   Identify referenced staff members.
-   Interpret dates and approximate times.
-   Interpret scheduling intent.
-   Produce structured scheduling proposals.
-   Explain detected scheduling conflicts.
-   Suggest alternatives based on available scheduling data.

AI must not:

-   Directly write to the database.
-   Bypass authorization.
-   Approve swaps.
-   Publish schedules automatically.
-   Override scheduling rules.
-   Treat generated output as trusted.
-   Invent staff members.
-   Invent shifts.
-   Invent permissions.
-   Silently modify existing schedules.

**RECOMMENDATION:** AI should be **Phase 2**, not MVP.

The core product must function fully without AI.

------------------------------------------------------------------------

## 6.3 AI entry points

Potential entry points:

### Natural-language scheduling

> "Schedule John for Tuesday morning."

### Schedule modification

> "Move John's Tuesday shift to Wednesday afternoon."

### Scheduling assistance

> "Who is available Thursday morning?"

### Conflict explanation

> "Why can't I assign Sarah to this shift?"

The first two are higher-risk because they can eventually cause state
changes.

------------------------------------------------------------------------

## 6.4 Complete processing pipeline

``` mermaid
stateDiagram-v2
    [*] --> INPUT_RECEIVED
    INPUT_RECEIVED --> VALIDATING_INPUT
    VALIDATING_INPUT --> AI_PROCESSING: Valid
    VALIDATING_INPUT --> FAILED: Invalid
    AI_PROCESSING --> OUTPUT_VALIDATION
    AI_PROCESSING --> RETRYING: Transient failure
    RETRYING --> AI_PROCESSING
    RETRYING --> FAILED: Retry limit reached
    OUTPUT_VALIDATION --> BUSINESS_VALIDATION: Valid structured output
    OUTPUT_VALIDATION --> FAILED: Invalid output
    BUSINESS_VALIDATION --> CONFLICT_CHECK
    BUSINESS_VALIDATION --> FAILED: Rule violation
    CONFLICT_CHECK --> AWAITING_CONFIRMATION: Valid proposal
    CONFLICT_CHECK --> FAILED: Blocking conflict
    AWAITING_CONFIRMATION --> EXECUTING: User confirms
    AWAITING_CONFIRMATION --> CANCELLED: User rejects/expires
    EXECUTING --> AUDITED: Transaction succeeds
    EXECUTING --> FAILED: Transaction fails
    AUDITED --> NOTIFICATION: Notification required
    NOTIFICATION --> COMPLETED
    AUDITED --> COMPLETED: No notification
    FAILED --> [*]
    CANCELLED --> [*]
    COMPLETED --> [*]
```

------------------------------------------------------------------------

## 6.5 Input validation

Before AI processing:

-   Authenticate user.
-   Verify team access.
-   Verify user permissions.
-   Validate input length.
-   Sanitize input.
-   Establish team context.
-   Identify available scheduling context.

The AI should receive only the minimum context required.

------------------------------------------------------------------------

## 6.6 AI context

For a scheduling request, relevant context might include:

-   Team ID.
-   Team timezone.
-   Current date.
-   Relevant staff IDs and names.
-   Relevant positions.
-   Existing schedule.
-   Availability.
-   Preferences.
-   Scheduling rules.

Sensitive information unrelated to the request should not be sent to the
AI provider.

------------------------------------------------------------------------

## 6.7 Structured output

AI output must follow a strict schema.

Example conceptual structure:

``` json
{
  "action": "CREATE_SHIFT",
  "teamId": "team-id",
  "staffId": "staff-id",
  "date": "2026-10-13",
  "startTime": "09:00",
  "endTime": "13:00",
  "position": "Server",
  "notes": null,
  "confidence": 0.94
}
```

The actual application must validate:

-   Enum values.
-   UUID/identifier formats.
-   Dates.
-   Times.
-   Timezone.
-   Staff membership.
-   Position.
-   Required fields.
-   Allowed action types.

**IMPORTANT:** `confidence` must not be treated as permission to execute
an action.

------------------------------------------------------------------------

## 6.8 Business-rule validation

After schema validation, deterministic application logic checks:

-   Does the staff member exist?
-   Is the user a member of the team?
-   Is the staff member active?
-   Does the requesting user have scheduling permission?
-   Is the date valid?
-   Does the shift overlap?
-   Does it violate configured scheduling rules?
-   Is the target shift already cancelled?
-   Is the requested change permitted?

------------------------------------------------------------------------

## 6.9 Conflict detection

The same deterministic conflict engine used by normal scheduling actions
must be used by AI-generated proposals.

AI must not have a separate scheduling-rule implementation.

This prevents:

> Human-created shifts follow one set of rules while AI-created shifts
> follow another.

------------------------------------------------------------------------

## 6.10 User confirmation

The mobile UI displays:

-   Proposed action.
-   Staff member.
-   Date.
-   Start/end time.
-   Team.
-   Position.
-   Detected warnings/conflicts.
-   Resulting schedule effect.

The user must explicitly confirm.

For consequential actions, the confirmation UI should make the exact
mutation clear.

------------------------------------------------------------------------

## 6.11 Execution

After confirmation:

1.  Client sends the structured command to the normal application API.
2.  API authenticates user.
3.  API authorizes user.
4.  API validates command.
5.  API performs conflict validation.
6.  Database transaction executes.
7.  Audit record is created.
8.  Notification job is created if required.

The AI provider is not involved in the final database mutation.

------------------------------------------------------------------------

## 6.12 Failed AI processing

Failures fall into:

### User input failure

Example:

> "Schedule John sometime next week."

If insufficient information exists, ask the user to clarify.

### AI provider failure

Retry transient errors.

### Invalid AI output

Do not execute.

Record the failure.

### Business-rule failure

Show the rule violation and, where useful, allow the AI to suggest
alternatives.

### Conflict

Do not execute.

Show the conflicting shift and allow the user to revise the proposal.

------------------------------------------------------------------------

## 6.13 Retry policy

AI requests may use:

-   Limited retries.
-   Exponential backoff.
-   Jitter.
-   Provider-specific timeout handling.

Retries must be idempotent at the AI-request level.

A retry must not create a duplicate scheduling action because execution
happens only after explicit confirmation through the normal API.

------------------------------------------------------------------------

## 6.14 AI logging

Record:

-   AI request ID.
-   User/team context.
-   Model/provider.
-   Request timestamp.
-   Processing status.
-   Latency.
-   Structured output.
-   Validation result.
-   Error category.
-   Token/cost metadata where available.

Do not unnecessarily store raw sensitive user input indefinitely.

**RECOMMENDATION:** Define configurable retention for AI request
content.

------------------------------------------------------------------------

## 6.15 AI security

The AI layer must protect against:

-   Prompt injection.
-   Data exfiltration attempts.
-   Unauthorized team access.
-   Tool/action abuse.
-   Malicious structured output.
-   Cross-team context leakage.

The AI must never receive unrestricted database access.

------------------------------------------------------------------------

## 6.16 AI cost controls

Potential controls:

-   Maximum input size.
-   Context minimization.
-   Model selection by task complexity.
-   Request rate limits.
-   Per-business AI usage tracking.
-   Retry limits.
-   Cost monitoring.

**RECOMMENDATION:** AI usage should initially be included within
controlled limits rather than being unlimited.

------------------------------------------------------------------------

# 7. Technical Requirements

## 7.1 Architecture

The locked architecture is:

``` mermaid
flowchart LR
    Mobile["React Native + Expo Mobile App"]
    API["Node.js + Express API"]
    DB["PostgreSQL"]
    Redis["Redis"]
    Queue["BullMQ Queue"]
    Worker["Background Job Worker"]
    Push["Push Notification Provider"]
    Email["Email Provider"]
    Billing["Flutterwave"]
    AI["AI Provider - Phase 2"]

    Mobile --> API
    API --> DB
    API --> Redis
    API --> Queue
    Queue --> Redis
    Worker --> Queue
    Worker --> DB
    Worker --> Push
    Worker --> Email
    Worker --> Billing
    API --> Billing
    API --> AI
    Worker --> AI
```

### Backend choice

**LOCKED:** Use **Node.js with Express** for the backend API.

The backend must remain application-controlled. Do not replace the
backend with a managed backend platform that bypasses Rota's API,
authorization, tenant isolation, transactions, scheduling rules, or
audit boundaries.

**ASSUMPTION:** TypeScript is used across the mobile application, API,
and worker code.

------------------------------------------------------------------------

## 7.2 Locked technology

  -----------------------------------------------------------------------
  Layer                   Technology
  ----------------------- -----------------------------------------------
  Mobile                  React Native

  Mobile framework        Expo

  Backend runtime         Node.js LTS

  Backend framework       Express

  Language                TypeScript

  Primary database        PostgreSQL

  Cache / rate limiting / Redis
  locks                   

  Background job queue    BullMQ (runs on Redis)

  Development environment Antigravity

  Authentication          Backend-controlled

  Notifications           Push + email

  Billing                 Flutterwave

  AI                      External AI provider, Phase 2
  -----------------------------------------------------------------------

React Native, Expo, Node.js, Express, PostgreSQL, Redis, BullMQ, and
TypeScript are mandatory. A hosted Redis free tier such as **Upstash**
is acceptable for development/MVP use where its limits are sufficient.

Do not add another backend framework, database, cache, queue, or payment
provider without an explicit product decision.

------------------------------------------------------------------------

## 7.3 API design

### Versioning

API paths should use:

``` text
/api/v1/
```

### Authentication

Authenticated endpoints require a valid session/access credential.

### Authorization

Every team-scoped request must:

1.  Authenticate the user.
2.  Resolve the requested team/business.
3.  Verify membership.
4.  Verify role permission.
5.  Execute the operation only within that scope.

### Validation

All input must be validated server-side.

Client validation improves UX but is not trusted.

### Error format

Use a consistent structure:

``` json
{
  "error": {
    "code": "SHIFT_CONFLICT",
    "message": "The staff member already has an overlapping shift.",
    "details": {}
  }
}
```

### Pagination

List endpoints should support pagination.

**RECOMMENDATION:** Cursor pagination for high-volume resources and
page/limit pagination for simpler administrative lists where
appropriate.

### Filtering

Examples:

``` text
GET /api/v1/shifts?teamId=...&from=...&to=...
```

### Sorting

Examples:

``` text
GET /api/v1/shifts?sort=startAt&direction=asc
```

### Rate limiting

Apply rate limits to:

-   Login.
-   Registration.
-   Password reset.
-   Invitations.
-   AI requests.
-   General API access.

Redis is the shared rate-limit store so limits work consistently across
multiple API instances.

### Redis

Redis is used for:

-   Caching hot, non-authoritative data where useful.
-   Distributed rate limiting.
-   Short-lived locks where a distributed lock is required.
-   BullMQ queue state and coordination.

Redis must never become the authoritative source for scheduling,
billing, membership, or audit data. PostgreSQL remains authoritative.

A hosted Redis free tier such as Upstash is acceptable for
MVP/development if its limits, latency, connection model, and durability
characteristics are sufficient for the workload.

### Background queue

Use **BullMQ**, backed by Redis, for durable asynchronous work such as
notifications, email, billing reconciliation, webhook follow-up work,
recurring schedule generation where required, and Phase 2 AI processing.

BullMQ is the queue mechanism; PostgreSQL remains the source of truth
for business state. Queue jobs must be safe to retry and must not bypass
normal authorization or transaction rules.

------------------------------------------------------------------------

## 7.4 Representative endpoints

### Authentication

``` text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/password-reset/request
POST /api/v1/auth/password-reset/confirm
GET  /api/v1/auth/me
```

### Teams

``` text
POST /api/v1/businesses
GET  /api/v1/businesses/:businessId
POST /api/v1/teams
GET  /api/v1/teams/:teamId
GET  /api/v1/teams/:teamId/members
```

### Invitations

``` text
POST /api/v1/teams/:teamId/invitations
POST /api/v1/invitations/:token/accept
POST /api/v1/invitations/:id/resend
```

### Shifts

``` text
POST /api/v1/teams/:teamId/shifts
GET  /api/v1/teams/:teamId/shifts
GET  /api/v1/shifts/:shiftId
PATCH /api/v1/shifts/:shiftId
POST /api/v1/shifts/:shiftId/cancel
POST /api/v1/teams/:teamId/schedule/publish
```

### Swaps

``` text
POST /api/v1/shifts/:shiftId/swap-requests
GET  /api/v1/teams/:teamId/swap-requests
POST /api/v1/swap-requests/:id/approve
POST /api/v1/swap-requests/:id/reject
POST /api/v1/swap-requests/:id/cancel
```

### Availability

``` text
GET  /api/v1/me/availability
PUT  /api/v1/me/availability
GET  /api/v1/me/preferences
PUT  /api/v1/me/preferences
```

### Billing

``` text
GET  /api/v1/businesses/:businessId/subscription
POST /api/v1/businesses/:businessId/subscription
POST /api/v1/businesses/:businessId/subscription/cancel
POST /api/v1/billing/webhooks/:provider
```

### AI

Phase 2:

``` text
POST /api/v1/teams/:teamId/ai/scheduling-proposals
GET  /api/v1/ai/requests/:id
POST /api/v1/ai/requests/:id/confirm
POST /api/v1/ai/requests/:id/cancel
```

------------------------------------------------------------------------

## 7.5 Idempotency

Mutating operations that can safely be retried should accept:

``` text
Idempotency-Key
```

The server should store:

-   Key.
-   Request scope/user.
-   Request hash.
-   Result.
-   Expiration.

Reusing a key with a materially different request should return an
error.

------------------------------------------------------------------------

## 7.6 Security

### Authentication

-   Secure password hashing.
-   Secure sessions.
-   Session expiration.
-   Session revocation.
-   Email verification.
-   Password reset tokens.
-   Rate limiting.

### Authorization

Backend authorization is mandatory.

Do not rely on mobile UI hiding buttons.

### Tenant isolation

Every query involving business/team data must include appropriate
ownership/membership constraints.

A valid object ID alone must never grant access.

Example:

``` text
GET /api/v1/shifts/:shiftId
```

must verify that the authenticated user has access to the team
associated with that shift.

### API security

-   Validate every request.
-   Limit payload sizes.
-   Rate-limit sensitive operations.
-   Protect webhooks.
-   Avoid leaking internal errors.
-   Use secure transport.

### Secrets

Secrets must not be committed to source control.

Use environment-specific secret management.

### Audit security

Audit records should be append-oriented and protected against ordinary
user modification.

------------------------------------------------------------------------

## 7.7 Reliability

### Database transactions

Use transactions for operations such as:

-   Swap approval.
-   Role changes with related membership updates.
-   Schedule publication.
-   Billing state changes where local records must stay consistent.
-   Confirmed AI scheduling actions.

### Background jobs

Use **BullMQ on Redis** for asynchronous work such as:

-   Push notifications.
-   Emails.
-   Invitation delivery.
-   Billing reconciliation.
-   Notification retries.
-   Recurring schedule generation where required.
-   AI processing where asynchronous execution is appropriate.

Workers must process jobs idempotently. Queue delivery is treated as
at-least-once; duplicate execution must not create duplicate business
effects.

### Job states

The application-level lifecycle remains:

``` text
PENDING
PROCESSING
SUCCEEDED
FAILED
DEAD
```

BullMQ manages queue execution/retry mechanics, while PostgreSQL may
store the application's durable job record when business-level
visibility, auditability, or reconciliation requires it.

Workers must claim/process jobs safely. Use BullMQ's locking/worker
mechanisms for queue ownership and PostgreSQL transactions for
business-state changes.

### Stuck jobs

Jobs that remain active/processing beyond a configured timeout must be
recoverable. BullMQ's stalled-job handling should be configured
appropriately, and application-level job records must not remain
permanently stuck if the worker dies.

### Payment webhooks

Webhook handling must be:

-   Authenticated.
-   Idempotent.
-   Persisted.
-   Retry-safe.

The same webhook must not create duplicate billing effects.

------------------------------------------------------------------------

## 7.8 Performance targets

These are **proposed targets**, not contractual SLAs.

  Operation                 Target
  ------------------------- -------------------------------
  Standard API request      p95 \< 500 ms
  Schedule load             p95 \< 1.5 s
  Shift creation            p95 \< 500 ms
  Swap request              p95 \< 700 ms
  Schedule publication      p95 \< 2 s for 100-staff team
  Notification enqueue      p95 \< 500 ms
  Push delivery             Provider-dependent
  AI proposal generation    Target \< 10 s
  Database conflict check   \< 200 ms under MVP scale

Schedule publication should not synchronously wait for push/email
delivery.

It should persist the schedule and enqueue notifications.

------------------------------------------------------------------------

## 7.9 Mobile requirements

### Platforms

-   iOS.
-   Android.

Expo should be used for the React Native development workflow.

### Navigation

Recommended primary navigation:

**Staff**

-   Schedule.
-   Swaps.
-   Availability.
-   Notifications.
-   Profile.

**Manager**

-   Schedule.
-   Team.
-   Swaps.
-   Notifications.
-   More/settings.

**Owner**

-   Schedule.
-   Team.
-   Billing.
-   Activity.
-   Settings.

### Loading states

Every network-dependent screen needs:

-   Initial loading.
-   Refreshing.
-   Error.
-   Empty state.

### Offline behavior

The app may cache recently loaded schedules for viewing.

Mutations require connectivity.

**RECOMMENDATION:** Do not implement offline mutation synchronization in
MVP.

### Accessibility

The app should support:

-   Screen readers.
-   Accessible labels.
-   Sufficient touch targets.
-   Keyboard navigation where applicable.
-   Dynamic text sizing.
-   Clear error messages.
-   Non-color-only status indicators.

------------------------------------------------------------------------

# 8. Business Model

## 8.1 Subscription structure

Rota uses a recurring subscription based on active staff seats.

**LOCKED PAYMENT PROVIDER:** Flutterwave.

### Proposed structure

**RECOMMENDATION:** Use a tiered seat-based model rather than charging
every user equally.

Example conceptual structure:

  Tier       Staff capacity   Purpose
  ---------- ---------------- -------------------------
  Starter    5--15            Small teams
  Team       16--50           Growing businesses
  Business   51--100          Larger small businesses

An alternative is pure per-seat pricing.

**RECOMMENDATION:** Start with transparent per-active-staff pricing
during validation because it is easier for small businesses to
understand.

------------------------------------------------------------------------

## 8.2 Pricing

The exact price is deliberately not defined.

**OPEN QUESTION:** Exact price per active staff seat.

**RECOMMENDATION:** Validate a proposed range equivalent to
approximately **\$1--\$5 per active staff member/month**, adjusted for
purchasing power and launch market.

The final price should be based on:

-   Competitor pricing.
-   Willingness to pay.
-   Local purchasing power.
-   Notification/payment infrastructure costs.
-   Support costs.
-   AI costs if AI becomes a paid feature.
-   Customer acquisition cost.
-   Trial conversion.

This range is a research starting point, not a final price.

------------------------------------------------------------------------

## 8.3 Trial

Default:

**14-day free trial.**

**OPEN QUESTION:** Whether the trial requires a payment method.

**RECOMMENDATION:** Initially allow trial without requiring payment
details to reduce onboarding friction, then test payment-method
collection later.

------------------------------------------------------------------------

## 8.4 Seat lifecycle

1.  Business starts trial.
2.  Active staff count is calculated.
3.  Subscription is created.
4.  Staff are added/removed.
5.  Seat quantity changes.
6.  Provider bills according to subscription terms.
7.  Failed payment enters grace period.
8.  Subscription recovers or becomes restricted.

------------------------------------------------------------------------

## 8.5 Upgrade/downgrade

Adding staff should increase the subscription quantity.

Removing staff should reduce future billing according to provider rules.

Historical usage must remain available.

------------------------------------------------------------------------

## 8.6 Billing provider

### Flutterwave --- locked payment provider

Rota will use **Flutterwave** for payment and subscription billing.

Flutterwave is the payment infrastructure provider; Rota remains
authoritative for its own subscription state, active-staff seat
counting, trial period, grace period, restricted mode, cancellation
state, and billing history.

The billing integration must support, as applicable to the selected
launch market and Flutterwave capabilities:

-   Subscription creation and management.
-   Payment initiation where required.
-   Provider customer/subscription references.
-   Webhook signature/authentication verification.
-   At-least-once webhook delivery handling.
-   Provider event-id idempotency.
-   Duplicate webhook protection.
-   Out-of-order event handling.
-   Billing reconciliation.
-   Payment failure and recovery handling.

**LOCKED:** Do not implement Stripe, Paystack, or another payment
provider as an alternative billing provider unless the product
requirements are explicitly changed.

Provider-specific code must remain isolated behind the billing
integration boundary so the core subscription domain does not depend on
Flutterwave request/response shapes.

The launch market is still an open product decision, but it no longer
determines the payment provider.

------------------------------------------------------------------------

## 8.7 Subscription lifecycle

``` mermaid
stateDiagram-v2
    [*] --> TRIALING
    TRIALING --> ACTIVE: Payment/subscription activated
    TRIALING --> EXPIRED: Trial ends without subscription
    ACTIVE --> PAST_DUE: Payment failure
    PAST_DUE --> ACTIVE: Payment succeeds
    PAST_DUE --> GRACE_PERIOD: Provider/business policy
    GRACE_PERIOD --> ACTIVE: Payment succeeds
    GRACE_PERIOD --> RESTRICTED: Grace expires
    ACTIVE --> CANCELLING: Cancellation requested
    CANCELLING --> CANCELLED: Billing period ends
    CANCELLED --> ACTIVE: Subscription restored
    RESTRICTED --> ACTIVE: Payment restored
    RESTRICTED --> CANCELLED: Retention period expires
```

------------------------------------------------------------------------

# 9. Risks

  -----------------------------------------------------------------------------------------
  Risk           Why it matters       Likelihood   Impact        Mitigation
  -------------- -------------------- ------------ ------------- --------------------------
  Scheduling     Can cause real       High         High          Conflict detection,
  mistake        operational                                     confirmation, audit
                 disruption                                      

  Notification   Staff may miss       Medium       High          Background jobs, retries,
  failure        schedule changes                                delivery tracking

  Billing error  Direct               Medium       High          Webhook idempotency,
                 revenue/customer                                reconciliation
                 trust impact                                    

  Incorrect AI   Could produce        Medium       High          Treat AI as untrusted,
  output         harmful scheduling                              deterministic validation,
                 proposals                                       confirmation

  AI costs grow  Can reduce margins   Medium       Medium        Usage limits, model
  unexpectedly                                                   selection, monitoring

  Privacy breach Team/staff data may  Low/Medium   High          Tenant isolation,
                 be exposed                                      authorization,
                                                                 minimization

  Multi-tenant   Could expose one     Low          Critical      Server-side scoped
  isolation      business's data to                              queries, authorization
  failure        another                                         tests

  Concurrent     Can cause lost       Medium       High          Optimistic concurrency
  edits          scheduling changes                              

  Low staff      Product fails if     Medium       High          Simple mobile UX, reliable
  adoption       staff keep using                                notifications
                 messaging apps                                  

  Business churn Recurring revenue    Medium       High          Activation/retention
                 declines                                        measurement

  Payment        Revenue interruption Medium       Medium/High   Grace period, retries,
  failures                                                       reminders

  Poor offline   Users may be unable  Medium       Medium        Cached schedule viewing
  behavior       to see recent                                   
                 changes                                         

  Recurring      Can produce          Medium       High          Explicit occurrence/series
  schedule       unexpected changes                              semantics
  complexity                                                     

  Timezone/DST   Can result in        Low/Medium   High          Timezone-aware datetime
  errors         incorrect shifts                                handling

  Overly large   Delays validation    High         Medium        Strict phased roadmap
  MVP                                                            

  AI introduced  Adds complexity      Medium       Medium        Phase 2 AI
  too early      without validating                              
                 core value                                      

  Scaling issues Large businesses may Low          Medium        Indexed PostgreSQL,
                 outgrow MVP          initially                  Redis-backed
                 architecture                                    caching/coordination,
                                                                 BullMQ background jobs,
                                                                 modular API
  -----------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 10. PostgreSQL Data Model

## 10.1 Modeling principles

The initial database should prioritize:

-   Strong tenant isolation.
-   Historical integrity.
-   Explicit relationships.
-   Transaction-safe scheduling.
-   Team-scoped authorization.
-   Auditability.
-   Minimal unnecessary entities.

The primary ownership hierarchy is:

``` text
Business
  └── Team
       └── TeamMembership
             └── User
```

A user can belong to multiple teams.

------------------------------------------------------------------------

## 10.2 Major entities

  Entity                 Purpose
  ---------------------- ------------------------------------
  User                   Authentication/account identity
  Business               Customer/business billing boundary
  Team                   Scheduling/location boundary
  TeamMembership         User's role/access in a team
  Invitation             Pending team membership invitation
  Shift                  Individual scheduled work
  RecurringShift         Template for recurring shifts
  StaffAvailability      Availability rules
  StaffPreference        Scheduling preferences
  ShiftSwap              Shift-change workflow
  Notification           Logical notification event
  NotificationDelivery   Channel-specific delivery
  Subscription           Business billing state
  BillingEvent           Provider event history
  AuditLog               Important action history
  AIRequest              AI processing lifecycle

------------------------------------------------------------------------

## 10.3 Relational schema reference

The following is the proposed initial relational model. It is shown in
implementation-neutral notation for readability. Implement the model in
PostgreSQL without assuming a specific ORM; **Prisma is not a locked
dependency**.

``` text
enum UserStatus {
  ACTIVE
  DEACTIVATED
}

enum TeamMembershipRole {
  OWNER
  MANAGER
  STAFF
}

enum MembershipStatus {
  ACTIVE
  INACTIVE
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

enum ShiftStatus {
  DRAFT
  PUBLISHED
  CANCELLED
  COMPLETED
}

enum ShiftSwapType {
  DIRECT_SWAP
  OPEN_SHIFT
}

enum ShiftSwapStatus {
  REQUESTED
  APPROVED
  REJECTED
  CANCELLED
  EXPIRED
  EXECUTED
  FAILED
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}

enum NotificationChannel {
  PUSH
  EMAIL
}

enum NotificationDeliveryStatus {
  PENDING
  PROCESSING
  SENT
  FAILED
  DEAD
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  GRACE_PERIOD
  RESTRICTED
  CANCELLING
  CANCELLED
  EXPIRED
}

enum BillingEventStatus {
  RECEIVED
  PROCESSED
  IGNORED
  FAILED
}

enum AvailabilityType {
  AVAILABLE
  UNAVAILABLE
}

enum AIRequestStatus {
  RECEIVED
  VALIDATING
  PROCESSING
  OUTPUT_VALIDATED
  BUSINESS_VALIDATED
  AWAITING_CONFIRMATION
  EXECUTING
  COMPLETED
  FAILED
  CANCELLED
  EXPIRED
}

model User {
  id                String             @id @default(uuid())
  email             String             @unique
  passwordHash      String?
  firstName         String
  lastName          String?
  status            UserStatus         @default(ACTIVE)
  emailVerifiedAt   DateTime?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  deactivatedAt     DateTime?

  memberships       TeamMembership[]
  sentInvitations   Invitation[]       @relation("InvitationSender")
  assignedShifts    Shift[]            @relation("ShiftAssignee")
  createdShifts     Shift[]            @relation("ShiftCreator")
  modifiedShifts    Shift[]            @relation("ShiftModifier")
  availability      StaffAvailability[]
  preferences       StaffPreference?
  requestedSwaps    ShiftSwap[]        @relation("SwapRequester")
  targetSwaps       ShiftSwap[]        @relation("SwapTarget")
  approvedSwaps     ShiftSwap[]        @relation("SwapApprover")
  notifications     Notification[]
  auditLogs         AuditLog[]
  aiRequests        AIRequest[]
}

model Business {
  id                String         @id @default(uuid())
  name              String
  defaultTimezone   String
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  deactivatedAt     DateTime?

  teams             Team[]
  subscription      Subscription?
  billingEvents     BillingEvent[]
}

model Team {
  id                String          @id @default(uuid())
  businessId        String
  name              String
  timezone          String
  isActive          Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  business          Business        @relation(fields: [businessId], references: [id], onDelete: Restrict)
  memberships       TeamMembership[]
  invitations       Invitation[]
  shifts            Shift[]
  recurringShifts   RecurringShift[]
  availability      StaffAvailability[]
  swaps             ShiftSwap[]
  notifications     Notification[]
  auditLogs         AuditLog[]
  aiRequests        AIRequest[]

  @@index([businessId])
  @@index([businessId, isActive])
}

model TeamMembership {
  id          String              @id @default(uuid())
  userId      String
  teamId      String
  role        TeamMembershipRole
  status      MembershipStatus    @default(ACTIVE)
  joinedAt    DateTime            @default(now())
  deactivatedAt DateTime?

  user        User                @relation(fields: [userId], references: [id], onDelete: Restrict)
  team        Team                @relation(fields: [teamId], references: [id], onDelete: Restrict)

  @@unique([userId, teamId])
  @@index([teamId, status])
  @@index([teamId, role, status])
}

model Invitation {
  id            String           @id @default(uuid())
  teamId        String
  invitedById   String
  email         String
  role          TeamMembershipRole
  tokenHash     String           @unique
  status        InvitationStatus @default(PENDING)
  expiresAt     DateTime
  acceptedAt    DateTime?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  team          Team             @relation(fields: [teamId], references: [id], onDelete: Restrict)
  invitedBy     User             @relation("InvitationSender", fields: [invitedById], references: [id], onDelete: Restrict)

  @@index([teamId, email, status])
  @@index([email, status])
  @@index([expiresAt])
}

model Shift {
  id                String       @id @default(uuid())
  teamId            String
  assignedStaffId   String?
  createdById       String
  modifiedById      String?
  startAt           DateTime
  endAt             DateTime
  position          String?
  notes             String?
  status            ShiftStatus  @default(DRAFT)
  publishedAt       DateTime?
  cancelledAt       DateTime?
  completedAt       DateTime?
  version           Int          @default(1)
  recurringShiftId  String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  team             Team          @relation(fields: [teamId], references: [id], onDelete: Restrict)
  assignedStaff    User?         @relation("ShiftAssignee", fields: [assignedStaffId], references: [id], onDelete: Restrict)
  createdBy        User          @relation("ShiftCreator", fields: [createdById], references: [id], onDelete: Restrict)
  modifiedBy       User?         @relation("ShiftModifier", fields: [modifiedById], references: [id], onDelete: Restrict)
  recurringShift   RecurringShift? @relation(fields: [recurringShiftId], references: [id], onDelete: SetNull)
  swaps            ShiftSwap[]

  @@index([teamId, startAt, endAt])
  @@index([teamId, status, startAt])
  @@index([assignedStaffId, startAt, endAt])
  @@index([recurringShiftId])
}

model RecurringShift {
  id              String    @id @default(uuid())
  teamId          String
  assignedStaffId String?
  position        String?
  notes           String?
  recurrenceRule  String
  startDate       DateTime
  endDate         DateTime?
  timezone        String
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  team            Team      @relation(fields: [teamId], references: [id], onDelete: Restrict)
  assignedStaff   User?     @relation(fields: [assignedStaffId], references: [id], onDelete: Restrict)
  shifts          Shift[]

  @@index([teamId, isActive])
  @@index([assignedStaffId, isActive])
}

model StaffAvailability {
  id          String           @id @default(uuid())
  userId      String
  teamId      String
  type        AvailabilityType
  dayOfWeek   Int?
  startTime   String?
  endTime     String?
  specificDate DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  user        User             @relation(fields: [userId], references: [id], onDelete: Restrict)
  team        Team             @relation(fields: [teamId], references: [id], onDelete: Restrict)

  @@index([teamId, userId])
  @@index([teamId, specificDate])
  @@index([teamId, dayOfWeek])
}

model StaffPreference {
  id                  String    @id @default(uuid())
  userId              String    @unique
  preferredDays        Json?
  preferredStartTime   String?
  preferredEndTime     String?
  preferredPositions   Json?
  maxShiftsPerWeek    Int?
  minHoursPerWeek     Int?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user                User      @relation(fields: [userId], references: [id], onDelete: Restrict)
}

model ShiftSwap {
  id              String          @id @default(uuid())
  teamId          String
  shiftId         String
  requesterId     String
  targetUserId    String?
  type            ShiftSwapType
  status          ShiftSwapStatus @default(REQUESTED)
  reason          String?
  approvedById    String?
  requestedAt     DateTime        @default(now())
  approvedAt      DateTime?
  rejectedAt      DateTime?
  cancelledAt     DateTime?
  executedAt      DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  team            Team            @relation(fields: [teamId], references: [id], onDelete: Restrict)
  shift           Shift           @relation(fields: [shiftId], references: [id], onDelete: Restrict)
  requester       User             @relation("SwapRequester", fields: [requesterId], references: [id], onDelete: Restrict)
  targetUser      User?           @relation("SwapTarget", fields: [targetUserId], references: [id], onDelete: Restrict)
  approvedBy      User?           @relation("SwapApprover", fields: [approvedById], references: [id], onDelete: Restrict)

  @@index([teamId, status])
  @@index([shiftId, status])
  @@index([requesterId, status])
  @@index([targetUserId, status])
}

model Notification {
  id              String             @id @default(uuid())
  userId          String
  teamId          String?
  eventKey        String
  eventType       String
  payload         Json
  status          NotificationStatus @default(PENDING)
  createdAt       DateTime           @default(now())
  sentAt          DateTime?

  user            User               @relation(fields: [userId], references: [id], onDelete: Restrict)
  team            Team?              @relation(fields: [teamId], references: [id], onDelete: Restrict)
  deliveries      NotificationDelivery[]

  @@unique([userId, eventKey])
  @@index([userId, createdAt])
  @@index([teamId, createdAt])
}

model NotificationDelivery {
  id             String                     @id @default(uuid())
  notificationId String
  channel        NotificationChannel
  status         NotificationDeliveryStatus @default(PENDING)
  attempts       Int                        @default(0)
  providerId     String?
  lastError      String?
  nextAttemptAt  DateTime?
  sentAt         DateTime?
  createdAt      DateTime                   @default(now())
  updatedAt      DateTime                   @updatedAt

  notification   Notification               @relation(fields: [notificationId], references: [id], onDelete: Cascade)

  @@unique([notificationId, channel])
  @@index([status, nextAttemptAt])
}

model Subscription {
  id                String             @id @default(uuid())
  businessId        String             @unique
  provider          String
  providerCustomerId String            @unique
  providerSubscriptionId String?       @unique
  status            SubscriptionStatus
  seatQuantity      Int                @default(0)
  trialEndsAt       DateTime?
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  graceEndsAt       DateTime?
  cancelledAt       DateTime?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  business          Business           @relation(fields: [businessId], references: [id], onDelete: Restrict)
}

model BillingEvent {
  id              String             @id @default(uuid())
  businessId      String
  provider        String
  providerEventId String
  eventType       String
  status          BillingEventStatus @default(RECEIVED)
  payload         Json
  processedAt     DateTime?
  createdAt       DateTime           @default(now())

  business        Business           @relation(fields: [businessId], references: [id], onDelete: Restrict)

  @@unique([provider, providerEventId])
  @@index([businessId, createdAt])
  @@index([status, createdAt])
}

model AuditLog {
  id          String    @id @default(uuid())
  businessId  String
  teamId      String?
  actorId     String?
  action      String
  entityType  String
  entityId    String
  beforeData  Json?
  afterData   Json?
  metadata    Json?
  createdAt   DateTime  @default(now())

  actor       User?     @relation(fields: [actorId], references: [id], onDelete: SetNull)
  team        Team?     @relation(fields: [teamId], references: [id], onDelete: SetNull)

  @@index([businessId, createdAt])
  @@index([teamId, createdAt])
  @@index([entityType, entityId, createdAt])
  @@index([actorId, createdAt])
}

model AIRequest {
  id              String          @id @default(uuid())
  userId          String
  teamId          String
  status          AIRequestStatus
  provider        String?
  model           String?
  input           Json?
  structuredOutput Json?
  validationResult Json?
  errorCode       String?
  errorMessage    String?
  tokenUsage      Json?
  costMetadata    Json?
  confirmedAt     DateTime?
  executedAt      DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  expiresAt       DateTime?

  user            User            @relation(fields: [userId], references: [id], onDelete: Restrict)
  team            Team            @relation(fields: [teamId], references: [id], onDelete: Restrict)

  @@index([userId, createdAt])
  @@index([teamId, createdAt])
  @@index([status, createdAt])
}
```

## 10.4 Important schema considerations

### User roles

Role belongs to `TeamMembership`.

This allows:

``` text
User A
  Team X → MANAGER
  Team Y → STAFF
```

without creating duplicate accounts.

### Historical integrity

Most user/team relationships use `Restrict` rather than cascading
deletion.

Historical scheduling records must survive membership changes.

### Shift assignment

`assignedStaffId` is nullable because:

-   A shift may initially be unassigned.
-   An open shift may temporarily have no final replacement.
-   A removed member may require schedule resolution.

### Overlap constraints

PostgreSQL should additionally consider a database-level exclusion
constraint for published shifts if appropriate.

**RECOMMENDATION:** Use PostgreSQL range/exclusion constraints as a
defense-in-depth mechanism where required SQL migrations can safely
support the constraint.

Application-level conflict checks remain necessary for useful error
messages.

### Team isolation

Every team-owned entity should be resolved through the authenticated
user's authorized membership.

The API must never trust a client-provided team ID alone.

------------------------------------------------------------------------

# 11. Success Metrics

## 11.1 Activation

  -----------------------------------------------------------------------
  Metric                            Proposed target
  --------------------------------- -------------------------------------
  Business creates first team       \>80% of onboarded businesses

  Business invites first staff      \>75%
  member                            

  Business creates first shift      \>70%

  Business publishes first schedule \>60% within first 24h after staff
                                    setup

  Invited staff who activate        \>70%
  -----------------------------------------------------------------------

### Activation definition

A business is considered activated when:

1.  Team exists.
2.  At least 3 staff are invited/active.
3.  At least one schedule is created.
4.  At least one schedule is published.

------------------------------------------------------------------------

## 11.2 Engagement

  -----------------------------------------------------------------------
  Metric                                     Proposed target
  ------------------------------------------ ----------------------------
  Weekly active businesses                   \>60% of activated
                                             businesses

  Weekly active staff                        \>50%

  Businesses publishing schedules monthly    \>70%

  Staff viewing schedule weekly              \>60%

  Monthly swap activity among eligible teams Track baseline
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 11.3 Scheduling quality

### Scheduling conflicts

Track:

-   Blocked overlap attempts.
-   Published conflict rate.
-   Availability warnings.
-   Post-publication corrections.

**Proposed target:** \<2% of published shifts require correction because
of preventable scheduling mistakes.

### Time to publish

**Proposed target:** Median weekly schedule creation + publication time
below **15 minutes** for teams with ≤50 staff.

### Swap completion

Track:

``` text
completed swaps / initiated eligible swap requests
```

**Proposed target:** \>60% completion for valid requests.

------------------------------------------------------------------------

## 11.4 Retention

Track:

-   30-day business retention.
-   90-day business retention.
-   Monthly business churn.
-   Staff activation retention.
-   Weekly schedule engagement.

**Proposed initial target:** Monthly logo churn below **5%** after
product-market validation.

------------------------------------------------------------------------

## 11.5 Trial conversion

**Proposed target:** 20--30% trial-to-paid conversion initially.

This should be treated as a benchmark rather than a guaranteed outcome.

------------------------------------------------------------------------

## 11.6 Revenue

Track:

-   Monthly recurring revenue.
-   Average revenue per business.
-   Revenue per active seat.
-   Number of paid businesses.
-   Net seat growth.
-   Expansion revenue.
-   Churned revenue.

### Proposed north-star metric

**Weekly active scheduled staff**

Definition:

> Number of active staff members who view or interact with at least one
> current published shift during a rolling seven-day period.

This measures whether Rota is actually becoming part of the team's
scheduling workflow rather than merely being purchased.

------------------------------------------------------------------------

# 12. Assumptions

## 12.1 User-confirmed assumptions

These are directly established by the product requirements.

-   Rota is a mobile shift scheduling product.
-   React Native is mandatory.
-   Expo is mandatory.
-   PostgreSQL is mandatory.
-   Redis is mandatory for caching, rate limiting, distributed locks,
    and BullMQ infrastructure.
-   BullMQ is mandatory for background job queueing and runs on Redis.
-   Backend runs on Node.js with Express.
-   A user can belong to multiple teams.
-   A business can have multiple teams/locations.
-   One owner exists per team/business initially.
-   Managers can create/edit shifts.
-   Staff can request swaps.
-   Staff can claim eligible open shifts.
-   Manager approval is required for requested swaps.
-   Rota supports one-time shifts.
-   Rota supports recurring shifts.
-   Shifts use team/location timezone.
-   Published changes notify affected staff.
-   Payroll is out of scope.
-   Clock-in/out is out of scope.
-   Mobile may cache recently loaded schedules.
-   Mutations require connectivity.
-   AI is not required for core scheduling.
-   AI output is untrusted.
-   AI must require user confirmation.
-   AI execution uses the normal application API.
-   Businesses pay based on staff seats.
-   Owners/managers are not billable by default.
-   Trial is 14 days by default.
-   Failed payments have a grace period.
-   Existing schedule data is retained.
-   No permanent free plan initially.
-   Initial team scale is approximately 5--100 staff.

## 12.2 Sensible defaults

**ASSUMPTION:** Email verification is required before sensitive account
actions.

**ASSUMPTION:** Staff availability is advisory rather than automatically
blocking assignments.

**ASSUMPTION:** A staff member cannot request a new swap after the
underlying shift has started.

**ASSUMPTION:** Published shifts are cancelled rather than deleted.

**ASSUMPTION:** Future shifts assigned to removed staff remain in the
database and are flagged for resolution.

**ASSUMPTION:** Managers can invite staff by default, subject to owner
configuration.

**ASSUMPTION:** Managers cannot manage billing.

**ASSUMPTION:** A business is the billing boundary, even if it contains
multiple teams.

**ASSUMPTION:** Open-shift claims require manager approval in MVP.

**ASSUMPTION:** A 7-day billing grace period is used initially.

------------------------------------------------------------------------

## 12.3 Product recommendations

**RECOMMENDATION:** Keep AI out of MVP.

**RECOMMENDATION:** Treat availability as advisory rather than a hard
constraint.

**RECOMMENDATION:** Use optimistic concurrency for schedule edits.

**RECOMMENDATION:** Use PostgreSQL transactional validation for swap
execution.

**RECOMMENDATION:** Use background jobs for notification and
external-provider operations.

**RECOMMENDATION:** Use transparent per-active-staff pricing during
initial validation.

**RECOMMENDATION:** Keep offline support read-only in MVP.

------------------------------------------------------------------------

## 12.4 Technical assumptions

**ASSUMPTION:** TypeScript is used for backend and mobile application
development.

**ASSUMPTION:** PostgreSQL is the authoritative scheduling database.

**ASSUMPTION:** UTC timestamps plus explicit team timezone context are
used for persistent scheduling data.

**ASSUMPTION:** Push notifications require a third-party push delivery
service.

**ASSUMPTION:** Email requires a transactional email provider.

**ASSUMPTION:** Billing is integrated through Flutterwave.

**ASSUMPTION:** AI processing uses an external model provider rather
than a self-hosted model in the initial implementation.

------------------------------------------------------------------------

# 13. Phased Roadmap

## Phase 1: MVP

### Objective

Validate that small businesses will use Rota as their authoritative
scheduling system and pay for it.

### Features

#### Authentication

-   Email/password registration.
-   Login.
-   Logout.
-   Password reset.
-   Email verification.
-   Basic session management.

#### Business/team

-   Business creation.
-   Team/location creation.
-   Owner role.
-   Manager role.
-   Staff role.
-   Team memberships.
-   Invitations.
-   Role management.
-   Membership deactivation.

#### Scheduling

-   Create shift.
-   Edit shift.
-   Cancel shift.
-   Assign staff.
-   Draft schedule.
-   Publish schedule.
-   Day/week schedule views.
-   Staff schedule view.
-   Recurring shifts.
-   Timezone support.
-   Conflict detection.
-   Availability.
-   Staff preferences.
-   Historical shifts.

#### Swaps

-   Direct swap request.
-   Open shift.
-   Claim open shift.
-   Manager approval/rejection.
-   Cancellation.
-   Conflict revalidation.
-   Swap audit history.

#### Notifications

-   Push notifications.
-   Invitation email.
-   Password-reset email.
-   Schedule notifications.
-   Swap notifications.
-   Basic notification preferences.
-   Retryable notification delivery.

#### Billing

-   14-day trial.
-   Subscription.
-   Active staff seat counting.
-   Payment status.
-   Failed-payment handling.
-   Grace period.
-   Cancellation.
-   Owner billing screen.

#### Audit

-   Sensitive action audit logging.

### MVP deliberately excludes

-   AI scheduling.
-   Payroll.
-   Attendance.
-   Clock-in/out.
-   Advanced reporting.
-   Labor-law optimization.
-   Complex offline editing.
-   Advanced workforce forecasting.
-   Automated schedule optimization.

### Dependencies

-   Authentication.
-   Team/membership model.
-   Scheduling model.
-   Notification infrastructure.
-   Flutterwave billing integration.

------------------------------------------------------------------------

## Phase 2: Growth

### Objective

Increase retention, reduce manager workload, and differentiate Rota.

### Features

#### AI scheduling assistant

-   Natural-language scheduling.
-   Structured proposals.
-   Conflict-aware suggestions.
-   User confirmation.
-   AI audit trail.
-   AI usage limits.

#### Better scheduling tools

-   Improved staff availability visualization.
-   Schedule templates.
-   Bulk schedule operations.
-   More powerful recurring schedules.
-   Schedule duplication.
-   Better conflict explanations.

#### Reporting

-   Schedule activity.
-   Shift coverage.
-   Swap statistics.
-   Staff scheduling patterns.
-   Business activity dashboard.

#### Notifications

-   More granular notification preferences.
-   Email fallback logic.
-   Improved delivery analytics.

#### Billing

-   Multiple pricing tiers.
-   More sophisticated seat changes.
-   In-app billing history.

### Dependencies

-   Stable MVP scheduling engine.
-   Reliable event/notification architecture.
-   AI safety infrastructure.
-   Product analytics.

### Deliberately out of scope

-   Payroll.
-   Attendance.
-   Fully autonomous scheduling.
-   Complex HR.

------------------------------------------------------------------------

## Phase 3: Advanced

### Objective

Expand Rota from a scheduling application into a broader workforce
coordination platform without immediately becoming a full HR/payroll
system.

### Potential features

-   Advanced schedule optimization.
-   Forecast-based scheduling.
-   Demand-aware staffing.
-   Advanced reporting.
-   Multi-business administration.
-   Staff qualification/certification rules.
-   Labor-rule assistance.
-   Advanced AI scheduling.
-   Integration with payroll systems.
-   Integration with accounting systems.
-   Public API for business integrations.
-   Advanced team/location hierarchy.

### Dependencies

-   Demonstrated product-market fit.
-   Strong scheduling data.
-   Reliable billing.
-   Proven AI safety.
-   Customer demand.

### Deliberately out of scope unless validated

-   Full HRIS.
-   Payroll engine.
-   Attendance platform.
-   Benefits administration.
-   Recruitment platform.

------------------------------------------------------------------------

# 14. Open Questions

## 14.1 Target launch market

**OPEN QUESTION:** Is Rota initially launching in Nigeria, another
African market, the US, Europe, or globally?

**Why it matters:**

-   Flutterwave billing integration.
-   Pricing.
-   Currency.
-   Taxes.
-   Privacy/compliance.
-   Notification infrastructure.
-   Labor regulations.

**RECOMMENDED DEFAULT:** Start with one clearly defined market rather
than launching globally.

If Nigeria is selected, local payment infrastructure should receive
priority.

------------------------------------------------------------------------

## 14.2 Exact price per staff seat

**OPEN QUESTION:** What should an active staff seat cost?

**RECOMMENDED DEFAULT:** Validate transparent per-seat pricing,
initially exploring approximately \$1--\$5 equivalent per active
staff/month.

**What changes:** Pricing affects acquisition, positioning, billing
architecture, and packaging.

------------------------------------------------------------------------

## 14.3 Billing provider

**DECISION:** Flutterwave is the locked payment provider.

**What changes:** Subscription APIs, webhook behavior, currencies,
payment methods, and billing implementation must follow Flutterwave's
supported capabilities for the selected launch market.

Provider-specific implementation must remain isolated behind the billing
integration boundary so the core subscription domain remains
provider-independent.

------------------------------------------------------------------------

## 14.4 Free trial duration

**OPEN QUESTION:** Is 14 days correct?

**RECOMMENDED DEFAULT:** 14 days.

Possible alternatives:

-   7 days.
-   14 days.
-   30 days.

**What changes:** Trial conversion and time available for businesses to
establish scheduling habits.

------------------------------------------------------------------------

## 14.5 Do managers count toward billing?

**OPEN QUESTION:** Should managers consume paid seats?

**RECOMMENDED DEFAULT:** No.

**What changes:** Revenue model and role packaging.

------------------------------------------------------------------------

## 14.6 Billing boundary for multiple teams

**OPEN QUESTION:** Is billing:

1.  Per business across all teams?
2.  Per team/location?
3.  Per business with location-specific seat allocation?

**RECOMMENDED DEFAULT:** One business-level subscription.

**What changes:** Subscription architecture and multi-location pricing.

------------------------------------------------------------------------

## 14.7 User roles across teams

**OPEN QUESTION:** Can one user be a manager in Team A but staff in Team
B?

**RECOMMENDED DEFAULT:** Yes.

This is already supported by placing role on `TeamMembership`.

**What changes:** Authorization must always evaluate team membership
rather than a global user role.

------------------------------------------------------------------------

## 14.8 Staff open-shift claims

**OPEN QUESTION:** Should a staff member claiming an open shift require
manager approval?

**RECOMMENDED DEFAULT:** Yes for MVP.

**What changes:** If automatic claims are allowed, the system needs
stronger real-time concurrency controls and potentially stricter
eligibility validation.

------------------------------------------------------------------------

## 14.9 AI MVP versus later phase

**OPEN QUESTION:** Should AI launch with MVP?

**RECOMMENDED DEFAULT:** No. Launch AI in Phase 2.

**Why:** Scheduling works deterministically without AI. AI introduces
provider costs, security risks, validation complexity, and additional
failure modes before the core product has been validated.

------------------------------------------------------------------------

## 14.10 AI provider

**OPEN QUESTION:** Which AI provider should Rota use?

Possible categories:

-   General-purpose hosted LLM provider.
-   Multiple-provider abstraction.
-   Self-hosted model.

**RECOMMENDED DEFAULT:** Use a provider abstraction so the application
does not tightly couple scheduling logic to one model provider.

**What changes:** Cost, latency, privacy, reliability, model
capabilities, and regional availability.

------------------------------------------------------------------------

## 14.11 Notification channels

**OPEN QUESTION:** Should email be fallback-only or independently
configurable?

**RECOMMENDED DEFAULT:**

-   Push as primary.
-   Email for important account/billing/security events.
-   Email fallback for critical scheduling events where appropriate.

**What changes:** Notification infrastructure and delivery costs.

------------------------------------------------------------------------

## 14.12 Business/location structure

**OPEN QUESTION:** How should businesses with multiple physical
locations operate?

Possible models:

1.  Business → Teams/locations.
2.  Business → Locations → Teams.
3.  Business → Teams with optional location metadata.

**RECOMMENDED DEFAULT:** Business → Team/location for MVP.

This keeps the hierarchy simple while supporting multiple locations.

------------------------------------------------------------------------

## 14.13 Scheduling positions

**OPEN QUESTION:** Should positions be free-text or structured entities?

**RECOMMENDED DEFAULT:** Free-text position initially, optionally
evolving into a structured `Position` entity.

**What changes:** Qualification rules, filtering, reporting, and shift
eligibility.

------------------------------------------------------------------------

## 14.14 Availability enforcement

**OPEN QUESTION:** Should unavailable staff be completely blocked from
assignment?

**RECOMMENDED DEFAULT:** Advisory warning in MVP.

**What changes:** Hard-blocking availability makes scheduling safer but
less flexible for managers handling exceptions.

------------------------------------------------------------------------

## 14.15 Regulatory/compliance requirements

**OPEN QUESTION:** What legal, privacy, employment, and data-retention
requirements apply to the initial launch market?

At minimum, the final implementation should assess:

-   Privacy requirements.
-   Data retention.
-   Data deletion.
-   Employee-related data handling.
-   Payment regulations.
-   Communication consent.
-   Applicable employment scheduling rules.

**RECOMMENDED DEFAULT:** Complete a market-specific compliance review
before production launch.

------------------------------------------------------------------------

## 14.16 Shift approval model

**OPEN QUESTION:** Should managers need to approve all schedule
publication or only individual changes?

**RECOMMENDED DEFAULT:** Managers with scheduling permission can publish
directly in MVP.

**What changes:** Workflow complexity and owner oversight.

------------------------------------------------------------------------

## 14.17 Schedule versioning

**OPEN QUESTION:** Does Rota need complete published schedule versions?

**RECOMMENDED DEFAULT:** Not for MVP. Use audit history plus shift-level
change records.

A full schedule-versioning system can be introduced if customers need to
reconstruct exact historical published versions.

------------------------------------------------------------------------

## 14.18 Staff visibility of team schedule

**OPEN QUESTION:** Can staff see only their shifts, or the entire team's
schedule?

**RECOMMENDED DEFAULT:** Staff see their own shifts and only the minimum
team information required for swaps/open shifts.

**Why:** This reduces unnecessary exposure of employee scheduling
information.

------------------------------------------------------------------------

## 14.19 Billing restrictions after grace period

**OPEN QUESTION:** What can a business do after the grace period
expires?

**RECOMMENDED DEFAULT:** Restricted mode:

-   Existing schedules remain viewable.
-   Historical data remains accessible.
-   New schedule publication is disabled.
-   New staff invitations are disabled.
-   Billing restoration reactivates normal operations.

------------------------------------------------------------------------

## 14.20 Data retention

**OPEN QUESTION:** How long should historical schedules, audit logs,
notifications, and AI requests be retained?

**RECOMMENDED DEFAULT:** Keep scheduling history for the duration of the
customer relationship and define separate retention policies for audit
and AI processing data.

**What changes:** Storage costs, privacy compliance, and reporting
capabilities.
