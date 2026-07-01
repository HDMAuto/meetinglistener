# MeetingListener Backend

Node.js + TypeScript + Express + Prisma (PostgreSQL) API.

## Setup

```bash
cd backend
npm install
createdb meetinglistener_dev
createdb meetinglistener_test
# create .env and .env.test with your Postgres DATABASE_URL (see below)
npx prisma db push        # sync schema to the dev database