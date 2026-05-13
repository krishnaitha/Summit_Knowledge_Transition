import { UsersTable } from '@/components/admin/users-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllUsers } from '@/lib/data';

export default async function AdminUsersPage() {
  const users = await getAllUsers();

  return (
    <div className="space-y-8">
      {/* Users list */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <UsersTable users={users} />
        </CardContent>
      </Card>
    </div>
  );
}
