import DespensaView from './components/DespensaView';
import RecetasView from './components/RecetasView';
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPin from './components/LoginPin';
import { Package, UtensilsCrossed, CalendarDays, LogOut, User } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [activeTab, setActiveTab] = useState('despensa');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) cargarPerfil(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) cargarPerfil(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const cargarPerfil = async (userId) => {
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setPerfil(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPerfil(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <LoginPin onLoginSuccess={(user) => cargarPerfil(user.id)} />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-20">
      {/* Header Superior */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">
            DF
          </div>
          <div>
            <h2 className="text-sm font-bold leading-tight">Despensa Hogar</h2>
            <p className="text-[10px] text-stone-500 flex items-center gap-1">
              <User className="w-2.5 h-2.5" />
              {perfil?.nombre || 'Usuario'} ({perfil?.rol || 'miembro'})
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Contenido Dinámico según Tab */}
      <main className="max-w-md mx-auto p-4">
        {activeTab === 'despensa' && <DespensaView />}

        {activeTab === 'recetas' && <RecetasView />}

        {activeTab === 'menu' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold">Menú Semanal & Votos</h1>
            <p className="text-xs text-stone-500">Aquí estará el calendario semanal y las votaciones.</p>
          </div>
        )}
      </main>

      {/* Barra de Navegación Inferior (Mobile Friendly) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-2 flex justify-around items-center z-20">
        <button
          onClick={() => setActiveTab('despensa')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
            activeTab === 'despensa' ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <Package className="w-5 h-5" />
          <span>Despensa</span>
        </button>

        <button
          onClick={() => setActiveTab('recetas')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
            activeTab === 'recetas' ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <UtensilsCrossed className="w-5 h-5" />
          <span>Recetas</span>
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
            activeTab === 'menu' ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
          <span>Menú</span>
        </button>
      </nav>
    </div>
  );
}