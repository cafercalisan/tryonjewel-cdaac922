import { useQuery } from '@tanstack/react-query';
import { invokeApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export function useIsAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['isAdmin', user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await invokeApi('admin-data', {
        body: { table: 'user_roles', checkAdmin: true },
      });

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      return !!data?.isAdmin;
    },
    enabled: !!user,
  });
}
