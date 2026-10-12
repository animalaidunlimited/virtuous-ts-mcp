import type { VirtuousClient } from 'virtuous-ts';

/**
 * Structural view of the client methods the tools call.
 * Tests pass a fake with vi.fn() on each method. Production passes VirtuousClient.
 * Only read methods are listed, so a write cannot sneak into a tool by accident.
 */
export interface VirtuousReader {
  getRateLimitStatus: VirtuousClient['getRateLimitStatus'];
  queryOptionsCache?: VirtuousClient['queryOptionsCache'];
  contact: {
    findContactByEmailOrReference: VirtuousClient['contact']['findContactByEmailOrReference'];
    searchContacts: VirtuousClient['contact']['searchContacts'];
    getContactById: VirtuousClient['contact']['getContactById'];
    queryAllContacts: VirtuousClient['contact']['queryAllContacts'];
    queryContactsWithFullDetails?: VirtuousClient['contact']['queryContactsWithFullDetails'];
    queryContactOptions: VirtuousClient['contact']['queryContactOptions'];
    getContactTypes: VirtuousClient['contact']['getContactTypes'];
    getContactCustomFields: VirtuousClient['contact']['getContactCustomFields'];
    getContactPrefixes: VirtuousClient['contact']['getContactPrefixes'];
  };
  contactTag: {
    getTagsForContact: VirtuousClient['contactTag']['getTagsForContact'];
    listAllTagsFully: VirtuousClient['contactTag']['listAllTagsFully'];
  };
  gift: {
    getGiftsByContact: VirtuousClient['gift']['getGiftsByContact'];
    queryAllGifts: VirtuousClient['gift']['queryAllGifts'];
    queryGiftsWithFullDetails?: VirtuousClient['gift']['queryGiftsWithFullDetails'];
    getGiftQueryOptions: VirtuousClient['gift']['getGiftQueryOptions'];
    getGiftCustomFields: VirtuousClient['gift']['getGiftCustomFields'];
    getNonCashGiftTypes: VirtuousClient['gift']['getNonCashGiftTypes'];
  };
  campaign: {
    queryCampaigns: VirtuousClient['campaign']['queryCampaigns'];
    getCampaignSteps: VirtuousClient['campaign']['getCampaignSteps'];
    getCampaignQueryOptions: VirtuousClient['campaign']['getCampaignQueryOptions'];
  };
  project: {
    getProjectQueryOptions: VirtuousClient['project']['getProjectQueryOptions'];
  };
  recurringGift: {
    getRecurringGiftQueryOptions: VirtuousClient['recurringGift']['getRecurringGiftQueryOptions'];
  };
  contactNote: {
    getContactNoteQueryOptions: VirtuousClient['contactNote']['getContactNoteQueryOptions'];
  };
}
