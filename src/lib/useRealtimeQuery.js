import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// Declarar las listas de tablas fuera de los componentes para mantener su identidad.
export function useRealtimeQuery(load, tables, channelName) {
  const [snapshot, setSnapshot] = useState({ load: null, data: null, error: null });
  const refreshRef = useRef(null);

  useEffect(() => {
    let active = true;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const data = await load();
        if (active && current === request) setSnapshot({ load, data, error: null });
      } catch (error) {
        if (active && current === request) setSnapshot({ load, data: null, error: error.message });
      }
    };
    refreshRef.current = refresh;
    void refresh();
    let channel = supabase.channel(channelName);
    for (const table of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    channel.subscribe();
    return () => {
      active = false;
      refreshRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [load, tables, channelName]);

  const refresh = useCallback(() => refreshRef.current?.(), []);
  const current = snapshot.load === load;
  return { data: current ? snapshot.data : null, error: current ? snapshot.error : null,
    loading: !current, refresh };
}
