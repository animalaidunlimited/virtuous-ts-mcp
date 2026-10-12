import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CONTACT_OPTIONS, fakeVirtuous, jsonOf, serverWith } from '../helpers.js';

async function call(name: string, args: Record<string, unknown>, virtuous = fakeVirtuous()) {
  const server = serverWith(virtuous);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  const result = await client.callTool({ name, arguments: args });
  return { result, virtuous, client };
}

describe('contact tools', () => {
  it('find_contact rejects a call with no email and no reference pair', async () => {
    const { result, virtuous } = await call('find_contact', {});
    expect(result.isError).toBe(true);
    expect(jsonOf(result).error).toMatch(/email/i);
    expect(virtuous.contact.findContactByEmailOrReference).not.toHaveBeenCalled();
  });

  it('find_contact calls findContactByEmailOrReference and trims nulls', async () => {
    const virtuous = fakeVirtuous();
    virtuous.contact.findContactByEmailOrReference.mockResolvedValue({
      id: 7,
      name: 'Ada Lovelace',
      description: null,
      website: '',
    });
    const { result } = await call('find_contact', { email: 'ada@example.com' }, virtuous);
    expect(result.isError).toBeUndefined();
    expect(virtuous.contact.findContactByEmailOrReference).toHaveBeenCalledWith({
      email: 'ada@example.com',
      referenceSource: undefined,
      referenceId: undefined,
    });
    const body = jsonOf(result);
    expect(body).toMatchObject({ id: 7, name: 'Ada Lovelace' });
    expect(body).not.toHaveProperty('description');
    expect(body).not.toHaveProperty('website');
  });

  it('search_contacts passes text and take', async () => {
    const virtuous = fakeVirtuous();
    virtuous.contact.searchContacts.mockResolvedValue({
      list: [{ id: 1, name: 'Ada' }],
      total: 1,
    });
    const { result } = await call('search_contacts', { text: 'Ada', take: 5 }, virtuous);
    expect(virtuous.contact.searchContacts).toHaveBeenCalledWith({ search: 'Ada' }, { skip: 0, take: 5 });
    expect(jsonOf(result)).toMatchObject({ total: 1, returned: 1, truncated: false });
  });

  it('search_contacts rejects text shorter than 2 characters', async () => {
    const { result, virtuous } = await call('search_contacts', { text: 'A' });
    expect(result.isError).toBe(true);
    expect(virtuous.contact.searchContacts).not.toHaveBeenCalled();
  });

  it('get_contact loads by id', async () => {
    const virtuous = fakeVirtuous();
    virtuous.contact.getContactById.mockResolvedValue({ id: 9, name: 'Grace', tags: [] });
    const { result } = await call('get_contact', { contactId: 9 }, virtuous);
    expect(virtuous.contact.getContactById).toHaveBeenCalledWith(9);
    expect(jsonOf(result)).toMatchObject({ id: 9, name: 'Grace' });
  });

  it('get_contact_tags pages getTagsForContact until the list ends', async () => {
    const virtuous = fakeVirtuous();
    virtuous.contactTag.getTagsForContact.mockResolvedValue({
      list: [{ contactTagId: 1, tagId: 2, name: 'Donor' }],
      total: 1,
    });
    const { result } = await call('get_contact_tags', { contactId: 9 }, virtuous);
    expect(virtuous.contactTag.getTagsForContact).toHaveBeenCalled();
    const firstCall = virtuous.contactTag.getTagsForContact.mock.calls[0] as unknown[];
    expect(firstCall[0]).toBe(9);
    expect(jsonOf(result)).toMatchObject({ total: 1, returned: 1, truncated: false });
  });

  it('query_contacts returns isError and does not query when the parameter is unknown', async () => {
    const virtuous = fakeVirtuous();
    virtuous.contact.queryContactOptions.mockResolvedValue(CONTACT_OPTIONS);
    const { result } = await call(
      'query_contacts',
      {
        query: { groups: [{ conditions: [{ parameter: 'contact id', operator: 'Is', value: '1' }] }] },
      },
      virtuous,
    );
    expect(result.isError).toBe(true);
    const body = jsonOf(result);
    expect(body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'unknown-parameter', suggestion: 'Contact Id' })]),
    );
    expect(virtuous.contact.queryAllContacts).not.toHaveBeenCalled();
  });

  it('query_contacts calls queryAllContacts after a valid catalog check', async () => {
    const virtuous = fakeVirtuous();
    virtuous.contact.queryContactOptions.mockResolvedValue(CONTACT_OPTIONS);
    virtuous.contact.queryAllContacts.mockResolvedValue({
      list: [{ id: 1, name: 'Ada' }],
      total: 1,
      truncated: false,
    });
    const query = { groups: [{ conditions: [{ parameter: 'Contact Id', operator: 'Is', value: '1' }] }] };
    const { result } = await call('query_contacts', { query, maxRecords: 100 }, virtuous);
    expect(virtuous.contact.queryAllContacts).toHaveBeenCalledWith(query, { maxRecords: 100 });
    expect(jsonOf(result)).toMatchObject({ total: 1, returned: 1, truncated: false });
  });

  it('maps a not-found API error without leaking headers', async () => {
    const { VirtuousApiError } = await import('virtuous-ts');
    const virtuous = fakeVirtuous();
    const axiosLike = {
      message: 'not found',
      response: {
        status: 404,
        data: { error: 'NotFound', error_description: 'Contact 9 was not found' },
        headers: { authorization: 'Bearer super-secret-key' },
      },
      config: { headers: { Authorization: 'Bearer super-secret-key' } },
      isAxiosError: true,
    };
    virtuous.contact.getContactById.mockRejectedValue(
      new VirtuousApiError('Contact 9 was not found', axiosLike as never),
    );
    const { result } = await call('get_contact', { contactId: 9 }, virtuous);
    expect(result.isError).toBe(true);
    const text = JSON.stringify(jsonOf(result));
    expect(text).not.toMatch(/super-secret-key/);
    expect(text).not.toMatch(/Bearer/i);
    expect(text).not.toMatch(/authorization/i);
  });
});
