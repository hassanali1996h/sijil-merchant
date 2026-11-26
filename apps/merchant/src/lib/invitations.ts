import { Share } from 'react-native';

export function getCustomerInvitationUrl(linkId?: string): string {
  const url = 'debtledger-merchant://invite';
  return linkId ? `${url}?linkId=${encodeURIComponent(linkId)}` : url;
}

export async function shareCustomerInvitation(title: string, message: string, linkId?: string): Promise<void> {
  const url = getCustomerInvitationUrl(linkId);
  const store = "https://play.google.com/store/apps/details?id=com.debtledgeriq.sijil.merchant";
  await Share.share({ title, message: message + "\n" + url + "\n" + store });
}
