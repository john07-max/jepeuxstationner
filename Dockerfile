FROM node:24-bookworm-slim
WORKDIR /app
# Workspaces and SQL/data files must remain available to migration/sync commands.
COPY . .
RUN npm ci --include=dev && npm run build
# Existing sync scripts invoke tsc; pg also belongs to current devDependencies.
# Keep locked dependencies: omitting/pruning devDependencies would break these commands.
ENV NODE_ENV=production
CMD ["npm", "start"]
