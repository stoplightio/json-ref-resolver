export default {
  'https://exporter.io/resolved': {
    swagger: '2.0',
    info: {
      version: '1.0',
      title: 'To-do Demo',
      description:
        'This OAS2 (Swagger 2) file jrepresents a real API that lives at http://todos.stoplight.io.\n\nFor authentication information, click the apikey security scheme in the editor sidebar.',
      contact: { name: 'Stoplight', url: 'https://stoplight.io' },
      license: { name: 'MIT' },
    },
    host: 'todos.stoplight.io',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      apikey: {
        name: 'apikey',
        type: 'apiKey',
        in: 'query',
        description: '#### Use ?apikey=123 to authenticate requests. Super secure, we know ;).',
      },
    },
    paths: {
      '/todos/{todoId}': {
        parameters: [{ name: 'todoId', in: 'path', required: true, type: 'string' }],
        get: {
          operationId: 'GET_todo',
          summary: 'Get Todo',
          tags: ['Todos'],
          responses: {
            '200': {
              description: '',
              schema: {
                title: 'Todo Full',
                allOf: [
                  {
                    title: 'Todo Partial',
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      completed: { type: ['boolean', 'null'] },
                    },
                    required: ['name', 'completed'],
                  },
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'integer', minimum: 0, maximum: 1000000 },
                      completed_at: { type: ['string', 'null'], format: 'date-time' },
                      created_at: { type: 'string', format: 'date-time' },
                      updated_at: { type: 'string', format: 'date-time' },
                      user: {
                        title: 'User',
                        type: 'object',
                        properties: {
                          address: { foo: 'bar' },
                          name: { type: 'string', description: "The user's full name." },
                          age: { type: 'number', minimum: 0, maximum: 150 },
                        },
                        required: ['name', 'age'],
                      },
                    },
                    required: ['id', 'user'],
                  },
                ],
              },
              examples: {
                'application/json': {
                  id: 1,
                  name: 'get food',
                  completed: false,
                  completed_at: '1955-04-23T13:22:52.685Z',
                  created_at: '1994-11-05T03:26:51.471Z',
                  updated_at: '1989-07-29T11:30:06.701Z',
                },
                random: '{\n\t"foo": "bar"\n}\n',
              },
            },
            '404': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '404', error: 'Not Found' } },
            },
            '500': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '500', error: 'Server Error' } },
            },
          },
        },
        put: {
          operationId: 'PUT_todos',
          summary: 'Update Todo',
          tags: ['Todos'],
          parameters: [
            {
              name: 'body',
              in: 'body',
              schema: {
                title: 'Todo Partial',
                type: 'object',
                properties: { name: { type: 'string' }, completed: { type: ['boolean', 'null'] } },
                required: ['name', 'completed'],
              },
            },
          ],
          responses: {
            '200': {
              description: '',
              schema: {
                title: 'Todo Full',
                allOf: [
                  {
                    title: 'Todo Partial',
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      completed: { type: ['boolean', 'null'] },
                    },
                    required: ['name', 'completed'],
                  },
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'integer', minimum: 0, maximum: 1000000 },
                      completed_at: { type: ['string', 'null'], format: 'date-time' },
                      created_at: { type: 'string', format: 'date-time' },
                      updated_at: { type: 'string', format: 'date-time' },
                      user: {
                        title: 'User',
                        type: 'object',
                        properties: {
                          address: { foo: 'bar' },
                          name: { type: 'string', description: "The user's full name." },
                          age: { type: 'number', minimum: 0, maximum: 150 },
                        },
                        required: ['name', 'age'],
                      },
                    },
                    required: ['id', 'user'],
                  },
                ],
              },
              examples: {
                'application/json': {
                  id: 9000,
                  name: "It's Over 9000!!!",
                  completed: true,
                  completed_at: null,
                  created_at: '2014-08-28T14:14:28.494Z',
                  updated_at: '2015-08-28T14:14:28.494Z',
                },
              },
            },
            '401': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '401', error: 'Not Authorized' } },
            },
            '404': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '404', error: 'Not Found' } },
            },
            '500': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '500', error: 'Server Error' } },
            },
          },
          security: [{ apikey: [] }],
        },
        delete: {
          operationId: 'DELETE_todo',
          summary: 'Delete Todo',
          tags: ['Todos'],
          responses: {
            '204': { description: '' },
            '401': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '401', error: 'Not Authorized' } },
            },
            '404': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '404', error: 'Not Found' } },
            },
            '500': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '500', error: 'Server Error' } },
            },
          },
          security: [{ apikey: [] }],
        },
      },
      '/todos': {
        post: {
          operationId: 'POST_todos',
          summary: 'Create Todo',
          tags: ['Todos'],
          parameters: [
            {
              name: 'body',
              in: 'body',
              schema: {
                title: 'Todo Partial',
                type: 'object',
                properties: { name: { type: 'string' }, completed: { type: ['boolean', 'null'] } },
                required: ['name', 'completed'],
              },
              description: 'fooooo',
            },
          ],
          responses: {
            '201': {
              description: '',
              schema: {
                title: 'Todo Full',
                allOf: [
                  {
                    title: 'Todo Partial',
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      completed: { type: ['boolean', 'null'] },
                    },
                    required: ['name', 'completed'],
                  },
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'integer', minimum: 0, maximum: 1000000 },
                      completed_at: { type: ['string', 'null'], format: 'date-time' },
                      created_at: { type: 'string', format: 'date-time' },
                      updated_at: { type: 'string', format: 'date-time' },
                      user: {
                        title: 'User',
                        type: 'object',
                        properties: {
                          address: { foo: 'bar' },
                          name: { type: 'string', description: "The user's full name." },
                          age: { type: 'number', minimum: 0, maximum: 150 },
                        },
                        required: ['name', 'age'],
                      },
                    },
                    required: ['id', 'user'],
                  },
                ],
              },
              examples: {
                'application/json': {
                  id: 9000,
                  name: "It's Over 9000!!!",
                  completed: null,
                  completed_at: null,
                  created_at: '2014-08-28T14:14:28.494Z',
                  updated_at: '2014-08-28T14:14:28.494Z',
                },
              },
            },
            '401': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '401', error: 'Not Authorized' } },
            },
            '500': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '500', error: 'Server Error' } },
            },
          },
          security: [{ apikey: [] }],
          description: 'This creates a Todo object.\n\nTesting `inline code`.',
        },
        get: {
          operationId: 'GET_todos',
          summary: 'List Todos',
          tags: ['Todos'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              description: 'This is how it works.',
              required: false,
              type: 'integer',
              maximum: 100,
            },
            { name: 'skip', in: 'query', required: false, type: 'string' },
          ],
          responses: {
            '200': {
              description: '',
              schema: {
                type: 'array',
                items: {
                  title: 'Todo Full',
                  allOf: [
                    {
                      title: 'Todo Partial',
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        completed: { type: ['boolean', 'null'] },
                      },
                      required: ['name', 'completed'],
                    },
                    {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', minimum: 0, maximum: 1000000 },
                        completed_at: { type: ['string', 'null'], format: 'date-time' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                        user: {
                          title: 'User',
                          type: 'object',
                          properties: {
                            address: { foo: 'bar' },
                            name: { type: 'string', description: "The user's full name." },
                            age: { type: 'number', minimum: 0, maximum: 150 },
                          },
                          required: ['name', 'age'],
                        },
                      },
                      required: ['id', 'user'],
                    },
                  ],
                },
              },
              examples: {
                'application/json': [
                  { id: 1, name: 'design the thingz', completed: true },
                  { id: 2, name: 'mock the thingz', completed: true },
                  { id: 3, name: 'code the thingz', completed: false },
                ],
                empty: [],
              },
            },
            '500': {
              description: '',
              schema: {
                type: 'object',
                title: 'Error Response',
                properties: { status: { type: 'string' }, error: { type: 'string' } },
                required: ['status', 'error'],
              },
              examples: { 'application/json': { status: '500', error: 'Server Error' } },
            },
          },
        },
      },
    },
    parameters: {
      limit: {
        name: 'limit',
        in: 'query',
        description: 'This is how it works.',
        required: false,
        type: 'integer',
        maximum: 100,
      },
      skip: { name: 'skip', in: 'query', required: false, type: 'string' },
    },
    definitions: {
      'todo-partial': {
        title: 'Todo Partial',
        type: 'object',
        properties: { name: { type: 'string' }, completed: { type: ['boolean', 'null'] } },
        required: ['name', 'completed'],
      },
      'todo-full': {
        title: 'Todo Full',
        allOf: [
          {
            title: 'Todo Partial',
            type: 'object',
            properties: { name: { type: 'string' }, completed: { type: ['boolean', 'null'] } },
            required: ['name', 'completed'],
          },
          {
            type: 'object',
            properties: {
              id: { type: 'integer', minimum: 0, maximum: 1000000 },
              completed_at: { type: ['string', 'null'], format: 'date-time' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
              user: {
                title: 'User',
                type: 'object',
                properties: {
                  address: { foo: 'bar' },
                  name: { type: 'string', description: "The user's full name." },
                  age: { type: 'number', minimum: 0, maximum: 150 },
                },
                required: ['name', 'age'],
              },
            },
            required: ['id', 'user'],
          },
        ],
      },
    },
    tags: [{ name: 'Todos' }],
  },
};
