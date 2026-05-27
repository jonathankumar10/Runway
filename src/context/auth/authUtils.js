/**
 * Returns true when a user is signed in and allowed past protected routes.
 * Email/password users must verify their address; OAuth users are trusted by provider.
 */
export function isAuthedAndVerified(user) {
  if (!user) return false

  const isEmailUser = user.providerData?.some(provider => provider.providerId === 'password')
  return !isEmailUser || user.emailVerified
}
