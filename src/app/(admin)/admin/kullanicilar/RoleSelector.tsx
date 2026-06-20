"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";

async function updateRole(userId: string, role: Role) {
  const res = await fetch("/api/admin/users/role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok) throw new Error("Rol güncellenemedi");
}

export default function RoleSelector({ userId, currentRole }: { userId: string; currentRole: Role }) {
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as Role;
    startTransition(async () => {
      try {
        await updateRole(userId, newRole);
        toast.success("Rol güncellendi");
      } catch {
        toast.error("Rol güncellenemedi");
      }
    });
  }

  return (
    <select
      defaultValue={currentRole}
      onChange={handleChange}
      disabled={pending}
      className="rounded border bg-background px-2 py-1 text-xs disabled:opacity-50"
    >
      <option value="USER">Üye</option>
      <option value="EDITOR">Editör</option>
      <option value="ADMIN">Admin</option>
    </select>
  );
}
