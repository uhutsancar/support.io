// The public API's description, OpenAPI 3.1 (plan v10 PRD-12). Served at
// GET /api/v1/openapi.json with the server's own address, and read by the
// documentation page (/dokumantasyon/api). It describes routes/publicApi.ts;
// tests/publicApi.e2e.test.ts checks that every path here answers.

const id = { type: 'string', pattern: '^[0-9a-f]{24}$', examples: ['6727a19ee4b0f3a9d1c2b2f0'] };
const time = { type: ['string', 'null'], format: 'date-time' };

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const list = (name: string, extra: Record<string, unknown> = {}) => ({
  type: 'object',
  required: ['data'],
  properties: { data: { type: 'array', items: ref(name) }, ...extra }
});
const one = (name: string) => ({
  type: 'object',
  required: ['data'],
  properties: { data: ref(name) }
});
const json = (schema: unknown) => ({ content: { 'application/json': { schema } } });

const errors = {
  '401': { description: 'No key, or a key that is unknown or revoked', ...json(ref('Error')) },
  '403': {
    description: 'The plan has no API, the key lacks the scope, or the site is read-only',
    ...json(ref('Error'))
  },
  '404': { description: 'Not found in this workspace', ...json(ref('Error')) },
  '429': { description: 'Too many requests for this key (300 a minute)', ...json(ref('Error')) }
};

const query = (name: string, schema: unknown, description: string, required = false) => ({
  name,
  in: 'query',
  required,
  description,
  schema
});
const path = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: id
});

export function openApiDocument(base: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Support.io API',
      version: '1.0.0',
      description:
        'Read your conversations, messages, visitors and FAQ, reply to visitors and keep your FAQ in step with your own systems. Every call needs a workspace key from Settings → API keys, sent as `Authorization: Bearer sk_live_…`. GET needs the read scope, everything else write. The API is part of the Enterprise plan.'
    },
    servers: [{ url: `${base}/api/v1` }],
    security: [{ apiKey: [] }],
    tags: [
      { name: 'Sites', description: 'The sites of the workspace the key belongs to.' },
      {
        name: 'Conversations',
        description: 'Conversations with visitors: read, close, reopen, tag.'
      },
      {
        name: 'Messages',
        description: 'What was written in a conversation, and replies to the visitor.'
      },
      { name: 'Visitors', description: 'Who has been on a site, without their IP address.' },
      { name: 'FAQ', description: 'The entries the assistant and the help center answer from.' }
    ],
    paths: {
      '/sites': {
        get: {
          tags: ['Sites'],
          summary: 'The workspace’s sites',
          operationId: 'listSites',
          responses: { '200': { description: 'The sites', ...json(list('Site')) }, ...errors }
        }
      },
      '/conversations': {
        get: {
          tags: ['Conversations'],
          summary: 'Conversations, newest activity first',
          operationId: 'listConversations',
          parameters: [
            query('siteId', id, 'Only this site'),
            query(
              'status',
              { enum: ['open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned'] },
              'Only this status'
            ),
            query(
              'updatedSince',
              { type: 'string', format: 'date-time' },
              'Last message at or after'
            ),
            query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 50 }, 'Page size'),
            query('cursor', { type: 'string' }, 'nextCursor of the previous page')
          ],
          responses: {
            '200': {
              description: 'A page of conversations',
              ...json(list('Conversation', { nextCursor: { type: ['string', 'null'] } }))
            },
            ...errors
          }
        }
      },
      '/conversations/{id}': {
        get: {
          tags: ['Conversations'],
          summary: 'One conversation',
          operationId: 'getConversation',
          parameters: [path('id', 'The conversation')],
          responses: {
            '200': { description: 'The conversation', ...json(one('Conversation')) },
            ...errors
          }
        },
        patch: {
          tags: ['Conversations'],
          summary: 'Close, reopen or tag a conversation',
          operationId: 'updateConversation',
          parameters: [path('id', 'The conversation')],
          requestBody: {
            required: true,
            ...json({
              type: 'object',
              properties: {
                status: { enum: ['open', 'pending', 'resolved', 'closed'] },
                tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 32 } }
              }
            })
          },
          responses: {
            '200': { description: 'The conversation', ...json(one('Conversation')) },
            ...errors
          }
        }
      },
      '/conversations/{id}/messages': {
        get: {
          tags: ['Messages'],
          summary: 'A conversation’s messages, oldest first',
          operationId: 'listMessages',
          parameters: [
            path('id', 'The conversation'),
            query('after', id, 'Only messages after this one'),
            query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 100 }, 'Page size')
          ],
          responses: {
            '200': {
              description: 'The messages',
              ...json(list('Message', { hasMore: { type: 'boolean' } }))
            },
            ...errors
          }
        },
        post: {
          tags: ['Messages'],
          summary: 'Reply to the visitor',
          description:
            'The reply reaches the visitor as a team message and silences the FAQ assistant in this conversation.',
          operationId: 'createMessage',
          parameters: [path('id', 'The conversation')],
          requestBody: {
            required: true,
            ...json({
              type: 'object',
              required: ['content'],
              properties: {
                content: { type: 'string', minLength: 1, maxLength: 5000 },
                senderName: { type: 'string', maxLength: 60, default: 'Support' }
              }
            })
          },
          responses: {
            '201': { description: 'The message', ...json(one('Message')) },
            '409': { description: 'The conversation has ended', ...json(ref('Error')) },
            ...errors
          }
        }
      },
      '/visitors': {
        get: {
          tags: ['Visitors'],
          summary: 'A site’s visitors, most recently active first',
          operationId: 'listVisitors',
          parameters: [
            query('siteId', id, 'The site', true),
            query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 50 }, 'Page size')
          ],
          responses: { '200': { description: 'The visitors', ...json(list('Visitor')) }, ...errors }
        }
      },
      '/faqs': {
        get: {
          tags: ['FAQ'],
          summary: 'A site’s FAQ entries',
          operationId: 'listFaqs',
          parameters: [query('siteId', id, 'The site', true)],
          responses: { '200': { description: 'The entries', ...json(list('Faq')) }, ...errors }
        },
        post: {
          tags: ['FAQ'],
          summary: 'Add an FAQ entry',
          operationId: 'createFaq',
          requestBody: { required: true, ...json(ref('FaqInput')) },
          responses: { '201': { description: 'The entry', ...json(one('Faq')) }, ...errors }
        }
      },
      '/faqs/{id}': {
        patch: {
          tags: ['FAQ'],
          summary: 'Change an FAQ entry',
          operationId: 'updateFaq',
          parameters: [path('id', 'The entry')],
          requestBody: { required: true, ...json(ref('FaqInput')) },
          responses: { '200': { description: 'The entry', ...json(one('Faq')) }, ...errors }
        },
        delete: {
          tags: ['FAQ'],
          summary: 'Delete an FAQ entry',
          operationId: 'deleteFaq',
          parameters: [path('id', 'The entry')],
          responses: { '204': { description: 'Deleted' }, ...errors }
        }
      }
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'A workspace key: sk_live_ followed by 40 characters'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error', 'code'],
          properties: { error: { type: 'string' }, code: { type: 'string' } }
        },
        Site: {
          type: 'object',
          properties: {
            id,
            name: { type: 'string' },
            domain: { type: 'string' },
            active: { type: 'boolean' },
            createdAt: time
          }
        },
        Conversation: {
          type: 'object',
          properties: {
            id,
            siteId: id,
            ticketId: { type: ['string', 'null'], examples: ['#0042'] },
            status: { enum: ['open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned'] },
            priority: { enum: ['low', 'normal', 'high', 'urgent'] },
            visitor: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
                phone: { type: ['string', 'null'] }
              }
            },
            assignedAgentId: { type: ['string', 'null'] },
            tags: { type: 'array', items: { type: 'string' } },
            rating: {
              type: ['object', 'null'],
              properties: { score: { type: 'integer' }, comment: { type: ['string', 'null'] } }
            },
            createdAt: time,
            lastMessageAt: time,
            closedAt: time
          }
        },
        Message: {
          type: 'object',
          properties: {
            id,
            senderType: { enum: ['visitor', 'agent', 'bot', 'system'] },
            senderName: { type: ['string', 'null'] },
            content: { type: 'string' },
            type: { enum: ['text', 'image', 'file', 'system'] },
            file: {
              type: ['object', 'null'],
              properties: {
                url: { type: 'string' },
                name: { type: ['string', 'null'] },
                size: { type: ['integer', 'null'] }
              }
            },
            createdAt: time
          }
        },
        Visitor: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            country: { type: ['string', 'null'] },
            browser: { type: ['string', 'null'] },
            os: { type: ['string', 'null'] },
            currentPage: { type: ['string', 'null'] },
            lastActiveAt: time,
            firstSeenAt: time
          }
        },
        Faq: {
          type: 'object',
          properties: {
            id,
            siteId: id,
            question: { type: 'string' },
            answer: { type: 'string' },
            category: { type: 'string' },
            keywords: { type: 'array', items: { type: 'string' } },
            active: { type: 'boolean' },
            order: { type: 'integer' },
            updatedAt: time
          }
        },
        FaqInput: {
          type: 'object',
          properties: {
            siteId: { ...id, description: 'Required when adding' },
            question: { type: 'string', maxLength: 500 },
            answer: { type: 'string', maxLength: 5000 },
            category: { type: 'string', maxLength: 60 },
            keywords: { type: 'array', maxItems: 20, items: { type: 'string' } },
            active: { type: 'boolean' },
            order: { type: 'integer' }
          }
        }
      }
    }
  };
}
