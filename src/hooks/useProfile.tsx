import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, invokeApi } from '@/lib/api';
import { useAuth } from './useAuth';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  credits: number;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async (): Promise<Profile | null> => {
      if (!user) return null;

      const { data, error } = await fetchApi('profile');

      if (error) throw error;
      return data?.data || null;
    },
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<Profile, 'first_name' | 'last_name' | 'phone' | 'company'>>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await invokeApi('profile', {
        body: { action: 'update', ...updates },
      });

      if (error) throw error;
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });
}

export function useDeductCredit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await invokeApi('profile', {
        body: { action: 'deduct-credit' },
      });

      if (error) throw error;
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });
}
