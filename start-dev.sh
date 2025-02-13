#!/bin/bash
# Build SDK and watch for changes
cd /app/sdk && npm run dev &
# Start backend with nodemon
cd /app/backend && npm run dev 