import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db";

export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function getOrCreateDbUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find(
      (entry) => entry.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress;

  return prisma.user.upsert({
    where: { clerkId: userId },
    create: { clerkId: userId, email: email ?? null },
    update: { email: email ?? null },
  });
}
