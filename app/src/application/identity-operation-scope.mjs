// Shared lifecycle operation guard; persistence and ownership stay in each domain.
export async function runLifecycleTransaction(database, scope, stores, mode, operation) {
  scope?.assertCurrent();
  const result = await database.runTransaction(stores, mode, async (transaction) => {
    scope?.assertCurrent();
    const value = await operation(transaction);
    scope?.assertCurrent();
    return value;
  }, { signal: scope?.signal ?? null });
  scope?.assertCurrent();
  return result;
}
