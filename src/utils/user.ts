import { users } from "../db/schema";

type UserRow = typeof users.$inferSelect;

export function omitPassword(user: UserRow) {
  const { password: _, passwordRecovery: __, ...safe } = user;
  return safe;
}
