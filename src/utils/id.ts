import { nanoid } from "nanoid";

export function createId(size = 21): string {
  return nanoid(size);
}

export function createInviteCode(): string {
  return nanoid(8).toUpperCase();
}
