import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import Logo from "@/components/Logo";

export default function Connections() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [message, setMessage] = useState({ type: '', text: '' });

  // Debug session state
  useEffect(() => {
    console.log('Session state:', { status, session: !!session, user: session?.user?.email });
  }, [status, session]);

  // Handle OAuth callback messages
  useEffect(() => {
    if (router.query.success) {
      const successMessages = {
        mailchimp_connected: 'Mailchimp connected successfully!',
        intercom_connected: 'Intercom connected successfully!'
      };
      setMessage({ type: 'success', text: successMessages[router.query.success] || 'Connected successfully!' });
      
      // Refresh session to update connection status
      update();
      
      // Clear the query parameters from URL
      router.replace('/connections', undefined, { shallow: true });
    } else if (router.query.error) {
      const errorMessages = {
        mailchimp_oauth_failed: 'Failed to connect to Mailchimp. Please try again.',
        mailchimp_invalid_response: 'Invalid response from Mailchimp. Please try again.',
        mailchimp_token_exchange_failed: 'Failed to exchange authorization code. Please try again.',
        mailchimp_user_info_failed: 'Failed to get user information from Mailchimp.',
        mailchimp_oauth_error: 'An error occurred during Mailchimp connection.',
        intercom_oauth_failed: 'Failed to connect to Intercom. Please try again.',
        intercom_invalid_response: 'Invalid response from Intercom. Please try again.',
        intercom_token_exchange_failed: 'Failed to exchange authorization code. Please try again.',
        intercom_user_info_failed: 'Failed to get user information from Intercom.',
        intercom_oauth_error: 'An error occurred during Intercom connection.',
      };
      setMessage({ type: 'error', text: errorMessages[router.query.error] || 'An error occurred.' });
      
      // Clear the query parameters from URL
      router.replace('/connections', undefined, { shallow: true });
    }
  }, [router.query, update, router]);

  // Redirect to sign in if not authenticated
  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  const handleConnectMailchimp = () => {
    // Use window.location.href for external OAuth redirects
    window.location.href = '/api/auth/mailchimp';
  };

  const handleConnectIntercom = () => {
    // Use window.location.href for external OAuth redirects
    window.location.href = '/api/auth/intercom';
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-6 py-3 z-10">
        <div className="flex justify-between items-center">
          <Logo className="h-8 w-auto" />
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{session?.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="pt-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Account Connections</h1>
          
          {/* Success/Error Messages */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {message.text}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mailchimp Connection */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Mailchimp</h2>
                <div className={`px-3 py-1 rounded-full text-sm ${
                  session?.connections?.mailchimp 
                    ? "bg-green-100 text-green-800" 
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {session?.connections?.mailchimp ? "Connected" : "Not Connected"}
                </div>
              </div>
              
              <p className="text-gray-600 mb-4">
                Connect your Mailchimp account to create campaigns directly from Vybescript.
              </p>
              
              {session?.connections?.mailchimp ? (
                <button
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                  disabled
                >
                  Connected ✓
                </button>
              ) : (
                <button
                  onClick={handleConnectMailchimp}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Connect Mailchimp
                </button>
              )}
            </div>

            {/* Intercom Connection */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Intercom</h2>
                <div className={`px-3 py-1 rounded-full text-sm ${
                  session?.connections?.intercom 
                    ? "bg-green-100 text-green-800" 
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {session?.connections?.intercom ? "Connected" : "Not Connected"}
                </div>
              </div>
              
              <p className="text-gray-600 mb-4">
                Connect your Intercom account to create news, posts, and banners directly from Vybescript.
              </p>
              
              {session?.connections?.intercom ? (
                <button
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                  disabled
                >
                  Connected ✓
                </button>
              ) : (
                <button
                  onClick={handleConnectIntercom}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Connect Intercom
                </button>
              )}
            </div>
          </div>

          <div className="mt-8 text-center">
            <a
              href="/"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Campaign Creator
            </a>
          </div>
        </div>
      </main>
    </div>
  );
} 