import { useState } from 'react'
import { Eye, EyeOff, LogIn, Sparkles } from 'lucide-react'
import { signin, setSessionToken } from '../api/client'

interface SignInProps {
  onSignIn: () => void
  onSwitchToSignup?: () => void
}

export default function SignIn({ onSignIn, onSwitchToSignup }: SignInProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setError('')
    if (!username.trim()) {
      setError('Enter your username')
      return
    }
    if (!password) {
      setError('Enter your password')
      return
    }
    setLoading(true)
    try {
      const result = await signin(username.trim(), password)
      setSessionToken(result.session_token)
      onSignIn()
    } catch (e: any) {
      setError(e.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSignIn()
  }

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-warm-surface border border-warm-border rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-blue" />
            </div>
            <h1 className="text-2xl font-bold text-warm-text" style={{ fontFamily: 'var(--font-serif)' }}>
              Welcome back
            </h1>
            <p className="text-sm text-warm-muted mt-2">
              Sign in to continue using Cerebro
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-warm-muted uppercase tracking-wider mb-1.5 block">Username</label>
              <input
                type="text" value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="your-username"
                autoFocus
                className="w-full bg-warm-bg border border-warm-border rounded-lg px-4 py-2.5 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue"
              />
            </div>
            <div>
              <label className="text-xs text-warm-muted uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Your password"
                  className="w-full bg-warm-bg border border-warm-border rounded-lg px-4 py-2.5 pr-10 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-muted hover:text-warm-text"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-warm-danger/10 border border-warm-danger/30 rounded-lg px-4 py-2 text-sm text-warm-danger">
                {error}
              </div>
            )}

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full py-2.5 bg-blue text-black rounded-lg hover:opacity-90 transition-all font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <LogIn size={16} />}
            </button>

            <p className="text-center text-xs text-warm-muted pt-2">
              Don't have an account?{' '}
              <button onClick={onSwitchToSignup} className="text-blue hover:text-blue-light underline">
                Create one
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
