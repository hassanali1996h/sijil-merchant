import { Share } from 'react-native';

export function getCustomerInvitationUrl(linkId?: string): string {
  const url = 'debtledger-customer://invite';
  return linkId ? `${url}?linkId=${encodeURIComponent(linkId)}` : url;
}

export async function shareCustomerInvitation(title: string, message: string, linkId?: string): Promise<void> {
  const url = getCustomerInvitationUrl(linkId);
  await Share.share({ title, message: `${message}\n${url}` });
}
