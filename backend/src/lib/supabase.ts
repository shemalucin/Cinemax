import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper functions for common Supabase operations

export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] Error fetching user by email:', error);
  }
  
  return data;
}

export async function getUserBySupabaseId(supabaseId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', supabaseId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] Error fetching user by Supabase ID:', error);
  }
  
  return data;
}

export async function createUserProfile(profile: {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role?: string;
  onboarding?: any;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url || null,
      role: profile.role || 'user',
      onboarding: profile.onboarding || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Supabase] Error creating user profile:', error);
    throw error;
  }
  
  return data;
}

export async function updateUserProfile(userId: string, updates: any) {
  console.log('[Supabase] Updating user profile:', { userId, updates });
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('[Supabase] Error updating user profile:', error);
    throw error;
  }
  
  console.log('[Supabase] User profile updated successfully:', data);
  return data;
}

export async function addToWatchlist(userId: string, movieId: number) {
  const { data, error } = await supabase
    .from('watchlists')
    .insert({
      user_id: userId,
      movie_id: movieId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Supabase] Error adding to watchlist:', error);
    throw error;
  }
  
  return data;
}

export async function removeFromWatchlist(userId: string, movieId: number) {
  const { error } = await supabase
    .from('watchlists')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', movieId);
  
  if (error) {
    console.error('[Supabase] Error removing from watchlist:', error);
    throw error;
  }
}

export async function addToFavorites(userId: string, movieId: number) {
  const { data, error } = await supabase
    .from('favorites')
    .insert({
      user_id: userId,
      movie_id: movieId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Supabase] Error adding to favorites:', error);
    throw error;
  }
  
  return data;
}

export async function removeFromFavorites(userId: string, movieId: number) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', movieId);
  
  if (error) {
    console.error('[Supabase] Error removing from favorites:', error);
    throw error;
  }
}

export async function addToMyList(userId: string, movieId: number) {
  const { data, error } = await supabase
    .from('my_lists')
    .insert({
      user_id: userId,
      movie_id: movieId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Supabase] Error adding to my list:', error);
    throw error;
  }
  
  return data;
}

export async function removeFromMyList(userId: string, movieId: number) {
  const { error } = await supabase
    .from('my_lists')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', movieId);
  
  if (error) {
    console.error('[Supabase] Error removing from my list:', error);
    throw error;
  }
}

export async function getUserWatchlist(userId: string) {
  const { data, error } = await supabase
    .from('watchlists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[Supabase] Error fetching watchlist:', error);
    return [];
  }
  
  return data || [];
}

export async function getUserFavorites(userId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[Supabase] Error fetching favorites:', error);
    return [];
  }
  
  return data || [];
}

export async function getUserMyList(userId: string) {
  const { data, error } = await supabase
    .from('my_lists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[Supabase] Error fetching my list:', error);
    return [];
  }
  
  return data || [];
}
