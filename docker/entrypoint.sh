#!/bin/sh
set -e
npx prisma db push --skip-generate
node /app/scripts/ensure-runtime.js
exec node server.js
