import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { Theme } from '../types';

export function useTheme() {
  const { user } = useAuthStore();
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    if (!user) {
      setTheme('light');
      document.documentElement.classList.remove('dark');
      return;
    }

    setTheme(user.theme as Theme);
    if (user.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user]);

  const toggleTheme = async () => {
    if (!user) return;

    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    try {
      await supabase.from('profiles').update({ theme: newTheme }).eq('id', user.id);
    } catch (error) {
      console.error('Failed to update theme:', error);
    }
  };

  return { theme, toggleTheme };
}
