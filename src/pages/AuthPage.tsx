import { SignInButton, SignUpButton, useUser } from '@insforge/react'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function AuthPage() {
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate('/lobby')
    }
  }, [user, navigate])

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-gray-900">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl max-w-md w-full">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          WWII Auto Chess
        </h1>
        <p className="text-gray-300 text-center mb-8">
          WWII-themed auto-battler game
        </p>

        <div className="space-y-4">
          <SignUpButton className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
            Sign Up
          </SignUpButton>
          <SignInButton className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
            Sign In
          </SignInButton>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/lobby')}
            className="text-gray-400 hover:text-white text-sm underline"
          >
            Guest Mode (View Only)
          </button>
        </div>
      </div>
    </div>
  )
}
