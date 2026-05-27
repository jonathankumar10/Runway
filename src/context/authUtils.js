export function isAuthedAndVerified(user) {
  if (!user) return false

  const isEmailUser = user.providerData?.some(provider => provider.providerId === 'password')
  return !isEmailUser || user.emailVerified
}
