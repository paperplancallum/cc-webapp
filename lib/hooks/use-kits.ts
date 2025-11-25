import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Kit, KitInsert } from '@/types/database.types';

const supabase = createClient();

export function useKits() {
  return useQuery({
    queryKey: ['kits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Kit[];
    },
  });
}

export function useKit(kitId: string) {
  return useQuery({
    queryKey: ['kit', kitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kits')
        .select('*')
        .eq('id', kitId)
        .single();

      if (error) throw error;
      return data as Kit;
    },
    refetchInterval: (query) => {
      // Refetch every 1 second if status is EXPOSING
      const kit = query.state.data;
      return kit?.status === 'EXPOSING' ? 1000 : false;
    },
  });
}

export function useRegisterKit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { kit_id: string; location_name: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const kit: Partial<KitInsert> = {
        kit_id: data.kit_id,
        location_name: data.location_name,
        user_id: user.id,
        status: 'REGISTERED',
        exposure_duration_minutes: 60,
      };

      const { data: newKit, error } = await supabase
        .from('kits')
        .insert(kit)
        .select()
        .single();

      if (error) throw error;
      return newKit as Kit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
    },
  });
}

export function useStartExposure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (kitId: string) => {
      const now = new Date();
      const completesAt = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes

      const { error } = await supabase
        .from('kits')
        .update({
          status: 'EXPOSING',
          exposure_started_at: now.toISOString(),
          exposure_completed_at: completesAt.toISOString(),
        })
        .eq('id', kitId);

      if (error) throw error;
    },
    onSuccess: (_, kitId) => {
      queryClient.invalidateQueries({ queryKey: ['kit', kitId] });
      queryClient.invalidateQueries({ queryKey: ['kits'] });
    },
  });
}

export function useSealLid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (kitId: string) => {
      const { error } = await supabase
        .from('kits')
        .update({
          status: 'INCUBATING',
          lid_sealed_at: new Date().toISOString(),
        })
        .eq('id', kitId);

      if (error) throw error;
    },
    onSuccess: (_, kitId) => {
      queryClient.invalidateQueries({ queryKey: ['kit', kitId] });
      queryClient.invalidateQueries({ queryKey: ['kits'] });
    },
  });
}
