# Codenection2026

React + Vite + JS + PixiJS + Tailwind /css

> **Your personal workload and recovery assistant — understand your capacity, rebalance your schedule, and prevent burnout before it happens.**

Moodify helps students manage their workload by combining **objective calendar data** with **subjective stress signals**. Instead of being another to-do list, Moodify understands how much is on your plate, how it feels, and recommends actions to bring your workload back into balance.

---

## ✨ Core Concept

Moodify follows a simple loop:

**Calendar → Measure Load → Check In → Understand Capacity → Take Action → Recover**

### Objective Load vs Subjective Stress

* **Objective Load:** How much is actually on your plate, calculated automatically from your schedule.
* **Daily Check-In:** How the workload feels to you, captured through a simple 1–5 stress signal.
* **Capacity Gauge:** Combines both signals into a single, easy-to-understand view of your current capacity.

This means Moodify doesn't just ask:

> *"How busy are you?"*

It asks:

> *"How much are you carrying, and how are you actually feeling about it?"*

---

# 🚀 Features

## Tier 1 — Core Features

These features form the main Moodify experience.

### 📅 1. Calendar Sync

Automatically imports the user's schedule through:

* Google Calendar API
* `.ics` calendar fallback

Users don't need to manually enter every task or commitment.

---

### 🧠 2. Auto Load Classifier

Automatically analyzes synced calendar events and categorizes them into:

* 🧠 **Cognitive** — classes, studying, assignments, exams
* 👥 **Social** — meetings, events, clubs, social commitments
* 🌿 **Recharge** — rest, breaks, hobbies, recovery activities

Classification can be performed using keyword rules or lightweight LLM classification.

---

### 📊 3. Objective Load Engine

Moodify calculates workload automatically from calendar data.

Each activity contributes to the user's overall load based on its duration and assigned weight.

The result is an objective representation of:

> **"How much is on my plate?"**

---

### ❤️ 4. Daily Check-In

A one-tap **1–5 subjective stress signal**.

Example:

> How are you feeling today?

`1 😌  2 🙂  3 😐  4 😣  5 😫`

Unlike the Load Engine, the Check-In does **not** measure workload.

It answers:

> **"How does it feel?"**

The Daily Check-In is the app's only direct ground-truth input from the user.

---

### 🎯 5. Capacity Gauge

Combines:

* Objective workload
* Subjective stress

into one visual indicator.

Example:

```text
Your Capacity

█████████████████░░░ 87%

⚠️ High load detected
```

This gives users an immediate understanding of whether they are approaching overload.

---

### 🧹 6. Load Shedder

Automatically identifies low-consequence, flexible tasks that can be deferred.

Moodify shows the user the impact before making changes.

Example:

```text
Current Capacity
87%

Move:
Grocery Shopping
Tuesday → Thursday

New Capacity
72%

▼ 15% reduction
```

The goal is not to remove important responsibilities, but to **reduce unnecessary pressure**.

---

### 🌿 7. AI Recovery Scheduler

Detects:

* Available free time
* Inactivity
* High stress
* Recovery opportunities

and recommends a suitable recovery activity.

Examples:

* 🚶 Short walk
* ☕ Quiet break
* 🎮 Hobby / gaming
* 🧘 Relaxation
* 👥 Social recharge

Users can insert the recommended recovery block into their calendar with one tap.

---

### 🤖 8. AI Timetable Suggester

Suggests healthier arrangements for flexible tasks.

Moodify presents a clear **Before → After** comparison.

```text
BEFORE

Tuesday
├── Class
├── Assignment
├── Grocery Shopping
└── Club Meeting

AFTER

Tuesday
├── Class
├── Assignment
└── Club Meeting

Thursday
└── Grocery Shopping
```

Users approve changes **per task** before anything is written back to their calendar.

---

# 🟡 Tier 2 — High Impact

> Build these if development time allows.

### 🛡️ Boundary Guard

Generates one-tap AI message templates for:

* Declining commitments
* Deferring requests
* Asking for extensions
* Setting personal boundaries

---

### 📦 Task Batching

Groups multiple small errands into one suggested time block.

Instead of:

```text
Buy groceries
Return package
Get stationery
Pick up laundry
```

Moodify can suggest:

```text
🛒 Tuesday 5:00–6:00 PM
Complete all nearby errands
```

---

### 😴 Sleep Proxy Estimator

Infers a rough sleep window from gaps in the user's calendar.

No manual sleep logging is required.

> **Roadmap:** This can later be replaced or enhanced by wearable data.

---

### 🚨 Upcoming Deadline Density Flag

Looks at the next three days and identifies unusually heavy days.

Example:

> ⚠️ **Heavy day ahead**
>
> You have 4 high-load commitments tomorrow.

---

### 📈 Per-Category Load Breakdown

Automatically breaks workload down into categories:

```text
Cognitive   ████████████  55%
Social      █████         25%
Recharge    ████          20%
```

This helps users understand **what is consuming their capacity**.

---

### 🔥 Recovery Streak Tracker

Automatically tracks completed recovery blocks.

Example:

> 🔥 **4-day recovery streak**

No manual tracking is required.

---

### 📤 Load Snapshot Share

Generates a shareable capacity card.

Example:

```text
┌─────────────────────────┐
│       MY MOODIFY        │
│                         │
│        72%              │
│      CAPACITY           │
│                         │
│   Feeling manageable    │
└─────────────────────────┘
```

---

# 🔵 Tier 3 — Roadmap

These features are planned for future versions and will be mentioned in the product roadmap rather than implemented in the hackathon MVP.

### 🎓 LMS Integration

Direct integration with learning platforms such as:

* Canvas
* Moodle

This would allow assignments, deadlines, and academic workload to be automatically imported.

---

### ⌚ Wearable Sync

Integration with:

* Apple Health
* Google Fit
* Other wearable platforms

This could provide real biometric signals such as:

* Heart-rate variability
* Sleep duration
* Sleep quality
* Activity levels

This would upgrade Moodify's current proxy-based signals into more accurate physiological measurements.

---

### 🔮 Predictive 7-Day Load Forecasting

Instead of only analyzing the current workload, Moodify could predict upcoming capacity.

Example:

```text
MON   62%  🟢
TUE   74%  🟡
WED   91%  🔴
THU   83%  🟠
FRI   58%  🟢
```

Moodify could then proactively suggest schedule changes **before the user becomes overloaded**.

---

# 🧩 Feature Architecture

```text
                GOOGLE CALENDAR
                       │
                       ▼
              ┌─────────────────┐
              │ Calendar Sync   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Load Classifier │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Objective Load  │
              │     Engine      │
              └────────┬────────┘
                       │
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐             ┌────────────────┐
│ Daily Check-  │             │ Calendar Data  │
│     In        │             │   & Load       │
└───────┬───────┘             └───────┬────────┘
        │                             │
        └──────────────┬──────────────┘
                       ▼
              ┌─────────────────┐
              │ Capacity Gauge  │
              └────────┬────────┘
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
      ┌─────────────┐    ┌─────────────────┐
      │ Load Shedder│    │ AI Recovery     │
      │             │    │ Scheduler       │
      └──────┬──────┘    └────────┬────────┘
             │                    │
             └──────────┬─────────┘
                        ▼
               ┌─────────────────┐
               │ AI Timetable    │
               │ Suggester       │
               └─────────────────┘
```

---

# 🎯 MVP Scope

For the hackathon MVP, Moodify focuses on the **eight Tier 1 features**:

1. Calendar Sync
2. Auto Load Classifier
3. Objective Load Engine
4. Daily Check-In
5. Capacity Gauge
6. Load Shedder
7. AI Recovery Scheduler
8. AI Timetable Suggester

The objective is to demonstrate a complete working loop:

> **Detect overload → Understand why → Recommend an intervention → Rebalance the schedule**

Tier 2 features will be implemented selectively if development time allows, while Tier 3 features form the long-term roadmap.

---

# 💡 What Makes Moodify Different?

Traditional productivity apps focus on:

> **"How much can you get done?"**

Moodify focuses on:

> **"How much can you realistically handle?"**

It combines **what is scheduled** with **how the user feels**, then takes action to rebalance the user's workload.

**Moodify doesn't just manage your time. It manages your capacity.**
