export default {
  'https://raw.githubusercontent.com/bojand/json-schema-test-samples/master/id.json': {
    description: 'unique identifier of a the object',
    type: 'string',
    minLength: 1,
  },
  'https://raw.githubusercontent.com/bojand/json-schema-test-samples/master/foo.json': {
    description: 'foo property',
    readOnly: true,
    type: 'number',
  },
  'https://raw.githubusercontent.com/bojand/json-schema-test-samples/master/bar.json': {
    description: 'bar property',
    type: 'boolean',
  },
  'https://raw.githubusercontent.com/bojand/json-schema-test-samples/master/common-definitions.json': {
    $schema: 'http://json-schema.org/draft-04/schema#',
    description: 'Some common definitions',
    type: 'object',
    definitions: {
      id: {
        description: 'Unique identifier.',
        readOnly: true,
        format: 'uuid',
        example: '01234567-89ab-cdef-0123-456789abcdef',
        type: 'string',
        minLength: 1,
      },
      created_at: {
        description: 'Creation time.',
        example: '2014-07-25T19:14:29.503Z',
        format: 'date-time',
        readOnly: true,
        type: 'string',
      },
      updated_at: {
        description: 'Update date-time.',
        example: '2014-07-25T19:14:29.503Z',
        format: 'date-time',
        readOnly: false,
        type: 'string',
      },
      email: {
        description: 'Email',
        format: 'email',
        readOnly: false,
        type: 'string',
        minLength: 1,
      },
    },
  },
  'https://raw.githubusercontent.com/bojand/json-schema-test-samples/master/address.json': {
    $schema: 'http://json-schema.org/draft-04/schema#',
    description: 'A simple address schema',
    type: 'object',
    definitions: {
      address1: {
        type: 'string',
      },
      address2: {
        type: 'string',
      },
      city: {
        type: 'string',
      },
      postalCode: {
        type: 'string',
      },
      state: {
        type: 'string',
      },
      country: {
        type: 'string',
      },
    },
    properties: {
      address1: {
        $ref: '#/definitions/address1',
      },
      address2: {
        $ref: '#/definitions/address2',
      },
      city: {
        $ref: '#/definitions/city',
      },
      postalCode: {
        $ref: '#/definitions/postalCode',
      },
      state: {
        $ref: '#/definitions/state',
      },
      country: {
        $ref: '#/definitions/country',
      },
    },
  },
  'https://foo.com/1/master/main.hub.yml': {
    pages: {
      '/': {
        data: {
          children: [
            {
              data: {
                $ref: 'https://foo.com/1/master/notifications.hub.yml#/pages/~1/data',
              },
            },
          ],
        },
      },
    },
  },
  'https://foo.com/1/master/notifications.hub.yml': {
    pages: {
      '/': {
        title: 'Notifications',
        data: {
          foo: 'bar',
        },
      },
    },
  },
  'https://root.com/foo.yml': {
    $ref: 'relative/bar.yml',
  },
  'https://root.com/relative/bar.yml': {
    foo: 'bear',
  },
  'https://exporter.stoplight.io/4254/master/main.oas2.yml': {
    swagger: '2.0',
    info: {
      version: '1.0',
      title: 'To-do Demo',
      description:
        'This OAS2 (Swagger 2) file jrepresents a real API that lives at http://todos.stoplight.io.\n\nFor authentication information, click the apikey security scheme in the editor sidebar.',
      contact: {
        name: 'Stoplight',
        url: 'https://stoplight.io',
      },
      license: {
        name: 'MIT',
      },
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
        parameters: [
          {
            name: 'todoId',
            in: 'path',
            required: true,
            type: 'string',
          },
        ],
        get: {
          operationId: 'GET_todo',
          summary: 'Get Todo',
          tags: ['Todos'],
          responses: {
            '200': {
              description: '',
              schema: {
                $ref: '#/definitions/todo-full',
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
              $ref: './common.oas2.yml#/responses/404',
            },
            '500': {
              $ref: 'common.oas2.yml#/responses/500',
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
                $ref: '#/definitions/todo-partial',
                example: {
                  name: "my todo's new name",
                  completed: false,
                },
              },
            },
          ],
          responses: {
            '200': {
              description: '',
              schema: {
                $ref: '#/definitions/todo-full',
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
              $ref: 'common.oas2.yml#/responses/401',
            },
            '404': {
              $ref: 'common.oas2.yml#/responses/404',
            },
            '500': {
              $ref: 'common.oas2.yml#/responses/500',
            },
          },
          security: [
            {
              apikey: [],
            },
          ],
        },
        delete: {
          operationId: 'DELETE_todo',
          summary: 'Delete Todo',
          tags: ['Todos'],
          responses: {
            '204': {
              description: '',
            },
            '401': {
              $ref: 'common.oas2.yml#/responses/401',
            },
            '404': {
              $ref: './common.oas2.yml#/responses/404',
            },
            '500': {
              $ref: 'common.oas2.yml#/responses/500',
            },
          },
          security: [
            {
              apikey: [],
            },
          ],
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
                $ref: '#/definitions/todo-partial',
                example: {
                  name: "my todo's name",
                  completed: false,
                },
              },
              description: 'fooooo',
            },
          ],
          responses: {
            '201': {
              description: '',
              schema: {
                $ref: '#/definitions/todo-full',
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
              $ref: 'common.oas2.yml#/responses/401',
            },
            '500': {
              $ref: 'common.oas2.yml#/responses/500',
            },
          },
          security: [
            {
              apikey: [],
            },
          ],
          description: 'This creates a Todo object.\n\nTesting `inline code`.',
        },
        get: {
          operationId: 'GET_todos',
          summary: 'List Todos',
          tags: ['Todos'],
          parameters: [
            {
              $ref: '#/parameters/limit',
            },
            {
              $ref: '#/parameters/skip',
            },
          ],
          responses: {
            '200': {
              description: '',
              schema: {
                type: 'array',
                items: {
                  $ref: '#/definitions/todo-full',
                },
              },
              examples: {
                'application/json': [
                  {
                    id: 1,
                    name: 'design the thingz',
                    completed: true,
                  },
                  {
                    id: 2,
                    name: 'mock the thingz',
                    completed: true,
                  },
                  {
                    id: 3,
                    name: 'code the thingz',
                    completed: false,
                  },
                ],
                empty: [],
              },
            },
            '500': {
              $ref: 'common.oas2.yml#/responses/500',
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
      skip: {
        name: 'skip',
        in: 'query',
        required: false,
        type: 'string',
      },
    },
    definitions: {
      'todo-partial': {
        title: 'Todo Partial',
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          completed: {
            type: ['boolean', 'null'],
          },
        },
        required: ['name', 'completed'],
      },
      'todo-full': {
        title: 'Todo Full',
        allOf: [
          {
            $ref: '#/definitions/todo-partial',
          },
          {
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                minimum: 0,
                maximum: 1000000,
              },
              completed_at: {
                type: ['string', 'null'],
                format: 'date-time',
              },
              created_at: {
                type: 'string',
                format: 'date-time',
              },
              updated_at: {
                type: 'string',
                format: 'date-time',
              },
              user: {
                $ref: 'common.oas2.yml#/definitions/user',
              },
            },
            required: ['id', 'user'],
          },
        ],
      },
    },
    tags: [
      {
        name: 'Todos',
      },
    ],
  },
  'https://exporter.stoplight.io/4254/master/common.oas2.yml': {
    swagger: '2.0',
    info: {
      version: '1.0',
      title: 'To-do Demo',
      description:
        '### Notes:\n\nThis OAS2 (Swagger 2) specification defines common models and responses, that other specifications may reference.\n\nFor example, check out the user poperty in the main.oas2 todo-partial model - it references the user model in this specification!\n\nLikewise, the main.oas2 operations reference the shared error responses in this common specification.',
      contact: {
        name: 'Stoplight',
        url: 'https://stoplight.io',
      },
      license: {
        name: 'MIT',
      },
    },
    host: 'example.com',
    securityDefinitions: {},
    paths: {},
    responses: {
      '401': {
        description: '',
        schema: {
          $ref: '#/definitions/error-response',
        },
        examples: {
          'application/json': {
            status: '401',
            error: 'Not Authorized',
          },
        },
      },
      '403': {
        description: '',
        schema: {
          $ref: '#/definitions/error-response',
        },
        examples: {
          'application/json': {
            status: '403',
            error: 'Forbbiden',
          },
        },
      },
      '404': {
        description: '',
        schema: {
          $ref: '#/definitions/error-response',
        },
        examples: {
          'application/json': {
            status: '404',
            error: 'Not Found',
          },
        },
      },
      '500': {
        description: '',
        schema: {
          $ref: '#/definitions/error-response',
        },
        examples: {
          'application/json': {
            status: '500',
            error: 'Server Error',
          },
        },
      },
    },
    definitions: {
      user: {
        title: 'User',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: "The user's full name.",
          },
          address: {
            $ref: 'foo/main.oas2.yml#/definitions/address',
          },
          age: {
            type: 'number',
            minimum: 0,
            maximum: 150,
          },
        },
        required: ['name', 'age'],
      },
      'error-response': {
        type: 'object',
        title: 'Error Response',
        properties: {
          status: {
            type: 'string',
          },
          error: {
            type: 'string',
          },
        },
        required: ['status', 'error'],
      },
    },
  },
  'https://exporter.stoplight.io/4254/master/foo/main.oas2.yml': {
    definitions: {
      address: {
        foo: 'bar',
      },
    },
  },

  // ./a#/foo -> ./b#bar -> ./a#/xxx -> ./c -> ./b#/zzz
  'https://back-pointing.com/a': {
    name: 'a',
    value: {
      $ref: './b#/defs/one',
    },
    defs: {
      one: {
        name: 'a1',
        value: {
          $ref: './c',
        },
      },
    },
  },
  'https://back-pointing.com/b': {
    name: 'b',
    defs: {
      one: {
        name: 'b1',
        value: {
          $ref: './a#/defs/one',
        },
      },
      two: 'b2',
    },
  },
  'https://back-pointing.com/c': {
    name: 'c',
    value: {
      $ref: './b#/defs/two',
    },
  },

  'https://exporter.stoplight.io/123/version%2F1.0/car.oas2.yml': {
    definitions: {
      inner: true,
    },
  },
  'https://exporter.stoplight.io/with-dead-refs': {
    data: {
      car: {
        $ref: 'https://exporter.stoplight.io/123/version%2F1.0/car.oas2.yml#/definitions/inner',
      },
      deadInner: {
        $ref: 'https://exporter.stoplight.io/i-do-not-exist-inner',
      },
    },
    deadOuter: {
      $ref: 'https://exporter.stoplight.io/i-do-not-exist-outer',
    },
    deadLocal: {
      car: {
        $ref: 'https://exporter.stoplight.io/123/version%2F1.0/car.oas2.yml#/definitions/inner',
      },
      deadInner: {
        $ref: '#/i-do-not-exist',
      },
    },
  },
};
