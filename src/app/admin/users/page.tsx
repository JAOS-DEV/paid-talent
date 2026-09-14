import React from "react";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { searchAdminUsers } from "@/lib/admin/users";
import { Button, Card, CardContent, Input } from "@/components/ui";

interface AdminUsersPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps): Promise<React.ReactElement> {
  await requireAdminPage("/admin/users");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const result = await searchAdminUsers({ query, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Users</h1>
        <p className="text-charcoal-400 mt-1">
          Search accounts by email, name, or user id.
        </p>
      </div>

      <form className="flex flex-col sm:flex-row gap-3" action="/admin/users">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Email, name, or user id"
          aria-label="Search users"
        />
        <Button type="submit">Search</Button>
      </form>

      <Card padding="none">
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-charcoal-400 border-b border-charcoal-800">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Premium</th>
                </tr>
              </thead>
              <tbody>
                {result.users.map((user) => (
                  <tr key={user.id} className="border-b border-charcoal-800">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${user.id}`}
                        prefetch={false}
                        className="text-primary-300 hover:text-primary-200"
                      >
                        {user.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-charcoal-200">
                      {user.name || "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{user.role}</td>
                    <td className="px-4 py-3 text-charcoal-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {user.ageVerified ? "Verified" : "Unverified"}
                    </td>
                    <td className="px-4 py-3 capitalize">{user.accountStatus}</td>
                    <td className="px-4 py-3">{user.premiumSummary}</td>
                  </tr>
                ))}
                {result.users.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-charcoal-500" colSpan={7}>
                      No users matched that search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-charcoal-400">
        <p>
          Page {result.page} of {totalPages} · {result.total} users
        </p>
        <div className="flex gap-2">
          {result.page > 1 && (
            <Link
              prefetch={false}
              className="px-3 py-2 rounded-lg bg-charcoal-800"
              href={`/admin/users?q=${encodeURIComponent(query)}&page=${result.page - 1}`}
            >
              Previous
            </Link>
          )}
          {result.page < totalPages && (
            <Link
              prefetch={false}
              className="px-3 py-2 rounded-lg bg-charcoal-800"
              href={`/admin/users?q=${encodeURIComponent(query)}&page=${result.page + 1}`}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
