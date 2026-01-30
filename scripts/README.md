
# Data Backfill Scripts

This directory contains scripts to help you migrate your Google Sheets data into Supabase.

## Prerequisites

1.  **Node.js** installed.
2.  **Service Key**: Ensure your `.env.local` or `.env` file has `SUPABASE_SERVICE_ROLE_KEY`.

## Setup

1.  **Prepare Data**:
    *   Export your **Players** sheet to `scripts/data/players.csv`.
        *   Required Columns: `Full Name`, `Email ID`, `Rank` (or `Current Rank`), `Bracket`.
        *   Note: If `Rank` column exists, it will be used. Otherwise sorts by `Ladder Joined On`.
    *   Export your **Matches** sheet to `scripts/data/matches.csv`.
        *   Required Columns: `Date`, `Time`, `Challenger Name`, `Defender Name`, `Winner`, `Scoreline`.

2.  **Install Dependencies** (if not already):
    ```bash
    npm install
    ```

## Running the Scripts

### 1. Seed Players (Initial)
Run this to create users.

```bash
npx tsx scripts/seed-players.ts "Squash Open"
```

### 2. Seed Matches (Archive)
This replays matches and calculates ELO history.

```bash
npx tsx scripts/seed-matches.ts "Squash Open"
```


## Important Notes
- **Timestamps**: Matches are inserted with their historical date.
- **Triggers**: The system will automatically calculate ELO ratings
- **Idempotency**: The scripts try to be safe (checking if user exists), but it's best to run them on a clean state or be careful with duplicates.
