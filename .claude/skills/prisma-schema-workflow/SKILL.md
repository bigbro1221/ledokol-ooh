# Skill: Prisma Schema Workflow

## Trigger
Use this skill whenever you modify `prisma/schema.prisma` or need to apply DB schema changes.

## Mandatory Steps (in order)

### 1. Assess data loss risk
- Adding a nullable column or column with default → **safe**
- Adding a non-nullable column without default → **data loss risk — ask user first**
- Dropping a column or model → **data loss risk — ask user first**
- Never run `--accept-data-loss` without explicit user approval

### 2. Stop the dev server
The Next.js dev server locks `node_modules/.prisma/client/query_engine-windows.dll.node`.
Running `prisma generate` while it's running causes EPERM.

```bash
npx kill-port 3000
```

### 3. Push the schema (apply DDL)

```bash
# Safe changes:
npx prisma db push

# Data-loss changes — only after explicit user approval:
npx prisma db push --accept-data-loss
```

### 4. Regenerate the Prisma client

```bash
npx prisma generate
```

### 5. Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### 6. Restart dev server

```bash
npm run dev
```

Do all of this yourself — do not ask the user to run these commands.

## Production Deployment Notes

- In Docker standalone mode, node_modules is stripped from the runner stage.
- The Dockerfile explicitly copies Prisma CLI from the deps stage:
  ```dockerfile
  COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
  COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
  COPY --from=deps /app/node_modules/@prisma/client ./node_modules/@prisma/client
  COPY --from=deps /app/node_modules/@prisma/engines-version ./node_modules/@prisma/engines-version
  ```
- To run migrations on prod: `docker compose exec app ./node_modules/.bin/prisma db push`
- This project uses Prisma **6.x**. If `npx prisma` downloads 7.x, use `npx prisma@6` or the local binary.

## BigInt Serialization

Prisma returns `BigInt` for fields like `totalBudgetUzs`, `priceDiscounted`, etc. JSON.stringify() fails on BigInt.
Always convert before returning from API routes:

```ts
return NextResponse.json({
  ...campaign,
  totalBudgetUzs: campaign.totalBudgetUzs ? Number(campaign.totalBudgetUzs) : null,
  totalFinal: campaign.totalFinal ? Number(campaign.totalFinal) : null,
});
```

And when writing BigInt to DB from user input (number → BigInt):

```ts
totalBudgetUzs: value ? BigInt(Math.round(value)) : null
```

## Cascade Delete Pattern

When a parent model is deleted, children must cascade. Always check `onDelete` on relations:

```prisma
model Screen {
  period CampaignPeriod? @relation(fields: [periodId], references: [id], onDelete: Cascade)
}
```

Default is `SetNull` for optional relations — that's wrong when you want children to be removed.
