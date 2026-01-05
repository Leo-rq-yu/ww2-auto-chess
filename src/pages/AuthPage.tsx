import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button, Card } from '../components/ui';
import { LogIn, UserPlus, Mail, Lock, User, Sword, Shield, Target, Plane } from 'lucide-react';
import { insforge } from '../services';
import useGameStore from '../store/gameStore';

export function AuthPage() {
  const navigate = useNavigate();
  const { setUser } = useGameStore();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Login
        const result = await insforge.auth.signInWithPassword({
          email,
          password,
        });

        if ('error' in result && result.error) throw new Error(result.error.message);
        
        const userId = result.data?.user?.id;
        if (!userId) throw new Error('Login failed');

        // Get or create player record
        const { data: player } = await insforge.database
          .from('players')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (player) {
          setUser(player.id, player.username);
        } else {
          // Create player record
          const displayName = result.data?.user?.metadata?.username || email.split('@')[0];
          const { data: newPlayer, error: createError } = await insforge.database
            .from('players')
            .insert({
              user_id: userId,
              username: displayName,
            })
            .select()
            .single();

          if (createError) throw createError;
          if (newPlayer) {
            setUser(newPlayer.id, newPlayer.username);
          }
        }

        navigate('/lobby');
      } else {
        // Register
        if (!username.trim()) {
          setError('Please enter a username');
          return;
        }

        const result = await insforge.auth.signUp({
          email,
          password,
          name: username,
        });

        if ('error' in result && result.error) throw new Error(result.error.message);
        
        const userId = result.data?.user?.id;
        if (!userId) throw new Error('Registration failed');

        // Create player record
        const { data: newPlayer, error: createError } = await insforge.database
          .from('players')
          .insert({
            user_id: userId,
            username,
          })
          .select()
          .single();

        if (createError) throw createError;
        if (newPlayer) {
          setUser(newPlayer.id, newPlayer.username);
        }

        navigate('/lobby');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || (isLogin ? 'Login failed' : 'Registration failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestPlay = () => {
    // Allow guest play without auth
    navigate('/lobby');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 text-white flex items-center justify-center">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-black mb-2">
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              WW2 Auto-Chess
            </span>
          </h1>
          <p className="text-stone-400">
            Strategic Battle Royale
          </p>
          
          {/* Unit Icons */}
          <div className="flex justify-center gap-3 mt-4">
            {[Sword, Shield, Target, Plane].map((Icon, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="w-10 h-10 bg-stone-800 rounded-lg flex items-center justify-center border border-stone-700"
              >
                <Icon className="text-amber-400" size={20} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="elevated" className="p-6">
            {/* Tabs */}
            <div className="flex mb-6">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 text-center font-medium transition-colors border-b-2 ${
                  isLogin 
                    ? 'text-amber-400 border-amber-400' 
                    : 'text-stone-500 border-transparent hover:text-stone-300'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 text-center font-medium transition-colors border-b-2 ${
                  !isLogin 
                    ? 'text-amber-400 border-amber-400' 
                    : 'text-stone-500 border-transparent hover:text-stone-300'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm text-stone-400 mb-2">Username</label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      className="w-full pl-10 pr-4 py-3 bg-stone-900 border-2 border-stone-700 rounded-lg
                        text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none
                        transition-colors"
                      maxLength={20}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-stone-400 mb-2">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3 bg-stone-900 border-2 border-stone-700 rounded-lg
                      text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none
                      transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-stone-400 mb-2">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-stone-900 border-2 border-stone-700 rounded-lg
                      text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none
                      transition-colors"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full flex items-center justify-center"
                size="lg"
              >
                {isLogin ? (
                  <>
                    <LogIn size={18} className="mr-2" />
                    Login
                  </>
                ) : (
                  <>
                    <UserPlus size={18} className="mr-2" />
                    Register
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-stone-700" />
              <span className="px-4 text-stone-500 text-sm">or</span>
              <div className="flex-1 border-t border-stone-700" />
            </div>

            {/* Guest Play */}
            <Button
              variant="secondary"
              onClick={handleGuestPlay}
              className="w-full"
            >
              Play as Guest
            </Button>

            <p className="text-stone-500 text-xs text-center mt-4">
              Guest progress will not be saved
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default AuthPage;
