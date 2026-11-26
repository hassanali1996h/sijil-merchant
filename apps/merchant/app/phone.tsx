import { Redirect, useLocalSearchParams } from 'expo-router';

// Old invitation links may reference /phone. Keep the route, never the phone UI.
export default function LegacyPhoneRedirect() {
  const params = useLocalSearchParams<{ linkId?: string | string[] }>();
  const linkId = Array.isArray(params.linkId) ? params.linkId[0] : params.linkId;
  return <Redirect href={linkId ? { pathname: '/sign-in', params: { linkId } } : '/sign-in'} />;
}
