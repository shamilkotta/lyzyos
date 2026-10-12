/** Roles an admin can assign when creating a member. Shared by the users API and its client. */
export const memberRoles = ["user", "admin", "agent"] as const;
export type MemberRole = (typeof memberRoles)[number];
