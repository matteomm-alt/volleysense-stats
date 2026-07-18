import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const joinTeamWithCode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().min(1).max(32) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: teamId, error } = await supabaseAdmin
      .schema('private' as never)
      .rpc('join_team_with_code' as never, {
        _user_id: context.userId,
        _code: data.code,
      } as never);
    if (error) throw new Error(error.message);
    return { teamId: teamId as string };
  });